import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { AwarenessState, ActivityEvent } from '@campfires/shared';
import { CLI_CONFIG } from './types.js';

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
}

export type ConnectionCallback = (state: ConnectionState) => void;
export type AwarenessCallback = (states: Map<number, AwarenessState>) => void;
export type ActivityCallback = (events: ActivityEvent[]) => void;

export class CampfireConnection {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private activityFeed: Y.Array<ActivityEvent>;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  private connectionCallbacks = new Set<ConnectionCallback>();
  private awarenessCallbacks = new Set<AwarenessCallback>();
  private activityCallbacks = new Set<ActivityCallback>();

  constructor(
    private serverUrl: string,
    private teamId: string,
    private token: string,
    private userId: string,
    private displayName: string,
    private color: string,
  ) {
    this.doc = new Y.Doc();
    this.activityFeed = this.doc.getArray<ActivityEvent>('activityFeed');
    this.setupActivityListener();
  }

  connect(): void {
    const wsUrl = this.serverUrl.replace(/^http/, 'ws');
    const roomName = `campfire:${this.teamId}`;

    this.provider = new WebsocketProvider(wsUrl, roomName, this.doc, {
      params: { token: this.token },
    });

    this.provider.on('status', (event: { status: string }) => {
      const connected = event.status === 'connected';
      this.notifyConnection({
        connected,
        reconnecting: event.status === 'connecting',
      });
    });

    this.provider.awareness.on('change', () => {
      this.notifyAwareness();
    });

    // Broadcast initial awareness
    this.updateAwareness();

    // Refresh lastActivity periodically to stay within AWARENESS_TIMEOUT
    this.refreshInterval = setInterval(() => {
      this.updateAwareness();
    }, CLI_CONFIG.AWARENESS_REFRESH);
  }

  private updateAwareness(): void {
    if (!this.provider) return;

    const state: AwarenessState = {
      userId: this.userId,
      displayName: this.displayName,
      type: 'human',
      status: 'active',
      currentFile: null,
      currentFunction: null,
      currentBranch: null,
      lastActivity: new Date().toISOString(),
      color: this.color,
    };

    this.provider.awareness.setLocalState(state);
  }

  private setupActivityListener(): void {
    this.activityFeed.observe(() => {
      const events = this.activityFeed.toArray();
      this.notifyActivity(events);
    });
  }

  disconnect(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.provider) {
      this.provider.awareness.setLocalState(null);
      this.provider.disconnect();
      this.provider = null;
    }

    this.doc.destroy();
  }

  // Callback registration
  onConnectionChange(cb: ConnectionCallback): void { this.connectionCallbacks.add(cb); }
  onAwarenessChange(cb: AwarenessCallback): void { this.awarenessCallbacks.add(cb); }
  onActivityChange(cb: ActivityCallback): void { this.activityCallbacks.add(cb); }

  getAwarenessStates(): Map<number, AwarenessState> {
    if (!this.provider) return new Map();
    return this.provider.awareness.getStates() as Map<number, AwarenessState>;
  }

  getActivityFeed(): ActivityEvent[] {
    return this.activityFeed.toArray();
  }

  private notifyConnection(state: ConnectionState): void {
    this.connectionCallbacks.forEach((cb) => cb(state));
  }

  private notifyAwareness(): void {
    const states = this.getAwarenessStates();
    this.awarenessCallbacks.forEach((cb) => cb(states));
  }

  private notifyActivity(events: ActivityEvent[]): void {
    this.activityCallbacks.forEach((cb) => cb(events));
  }
}
