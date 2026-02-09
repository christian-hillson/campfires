import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { setupWSConnection, docs } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import type { ActivityEvent, AwarenessState, CONFIG } from '@campfires/shared';
import { getPersistence } from './persistence.js';
import { verifyToken } from './auth.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  teamId?: string;
  isAlive?: boolean;
}

// Rate limiting state
const userEventTimestamps: Map<string, number[]> = new Map();

function isRateLimited(userId: string, maxEventsPerSecond: number): boolean {
  const now = Date.now();
  const oneSecondAgo = now - 1000;

  let timestamps = userEventTimestamps.get(userId) || [];
  timestamps = timestamps.filter((ts) => ts > oneSecondAgo);

  if (timestamps.length >= maxEventsPerSecond) {
    return true;
  }

  timestamps.push(now);
  userEventTimestamps.set(userId, timestamps);
  return false;
}

export function createWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const db = getPersistence();

  // Handle upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const pathname = url.pathname;

    // Only handle /campfire:teamId paths (y-websocket format)
    if (!pathname.startsWith('/campfire:')) {
      socket.destroy();
      return;
    }

    // Extract token from query string
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const teamId = pathname.slice('/campfire:'.length);

    // Verify user belongs to this team
    if (payload.teamId !== teamId) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      authWs.userId = payload.userId;
      authWs.teamId = teamId;
      authWs.isAlive = true;

      wss.emit('connection', authWs, request);
    });
  });

  // Handle connections
  wss.on('connection', (ws: AuthenticatedWebSocket, request: http.IncomingMessage) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const teamId = ws.teamId!;
    const docName = `campfire:${teamId}`;

    // Set up y-websocket connection
    setupWSConnection(ws, request, { docName });

    // Get the Yjs document for this room
    const doc = docs.get(docName);
    if (doc) {
      setupActivityLogging(doc, teamId, db);
    }

    // Handle pong for keep-alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    console.log(`Client connected to campfire:${teamId}`);
  });

  // Ping interval to detect stale connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        return authWs.terminate();
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  return wss;
}

// Set up activity logging for a Yjs document
const loggedDocs = new Set<string>();

function setupActivityLogging(
  doc: Y.Doc,
  teamId: string,
  db: ReturnType<typeof getPersistence>
): void {
  const docName = `campfire:${teamId}`;

  // Only set up once per document
  if (loggedDocs.has(docName)) {
    return;
  }
  loggedDocs.add(docName);

  // Get the activity feed Y.Array
  const activityFeed = doc.getArray<ActivityEvent>('activityFeed');

  // Listen for new activity events
  activityFeed.observe((event) => {
    if (event.changes.added.size === 0) {
      return;
    }

    // Process added items
    event.changes.added.forEach((item) => {
      if (item.content.type === Y.ContentAny) {
        const events = (item.content as Y.ContentAny).arr as ActivityEvent[];
        events.forEach((activityEvent) => {
          // Rate limiting check
          if (isRateLimited(activityEvent.userId, 1)) {
            console.log(`Rate limited event from user ${activityEvent.userId}`);
            return;
          }

          // Persist to activity log
          try {
            db.appendActivityEvent({
              userId: activityEvent.userId,
              userType: activityEvent.userType,
              parentUserId: activityEvent.parentUserId ?? null,
              teamId: activityEvent.teamId,
              type: activityEvent.type,
              file: activityEvent.file,
              branch: activityEvent.branch,
              message: activityEvent.message,
              metadata: activityEvent.metadata,
            });
            console.log(`Logged activity: ${activityEvent.type} from ${activityEvent.userId}`);
          } catch (err) {
            console.error('Failed to persist activity event:', err);
          }
        });
      }
    });
  });

  console.log(`Activity logging set up for ${docName}`);
}

// Get connected clients for a team
export function getConnectedClients(wss: WebSocketServer, teamId: string): AuthenticatedWebSocket[] {
  const clients: AuthenticatedWebSocket[] = [];
  wss.clients.forEach((ws) => {
    const authWs = ws as AuthenticatedWebSocket;
    if (authWs.teamId === teamId && authWs.readyState === WebSocket.OPEN) {
      clients.push(authWs);
    }
  });
  return clients;
}

// Broadcast a message to all clients in a team
export function broadcastToTeam(
  wss: WebSocketServer,
  teamId: string,
  message: unknown
): void {
  const clients = getConnectedClients(wss, teamId);
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    ws.send(data);
  });
}
