import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { WebsocketProvider } from 'y-websocket';
import type { AwarenessState, ActivityEvent, ActivityEventType } from '@campfires/shared';
import { CLI_CONFIG } from './types.js';

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
}

export interface AgentConfig {
  agentUserId: string;
  agentDisplayName: string;
  agentColor: string;
  parentUserId: string;
}

export type ConnectionCallback = (state: ConnectionState) => void;
export type AwarenessCallback = (states: Map<number, AwarenessState>) => void;
export type ActivityCallback = (events: ActivityEvent[]) => void;

export interface VisitorConfig {
  homeTeamId: string;
}

export class CampfireConnection {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private activityFeed: Y.Array<ActivityEvent>;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  private connectionCallbacks = new Set<ConnectionCallback>();
  private awarenessCallbacks = new Set<AwarenessCallback>();
  private activityCallbacks = new Set<ActivityCallback>();
  private throttleMap = new Map<string, number>();
  private agentConfig: AgentConfig | null = null;
  private visitorConfig: VisitorConfig | null = null;

  constructor(
    private serverUrl: string,
    private teamId: string,
    private token: string,
    private userId: string,
    private displayName: string,
    private color: string,
    visitorConfig?: VisitorConfig,
  ) {
    this.visitorConfig = visitorConfig || null;
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
      parentUserId: null,
      status: this.visitorConfig ? 'visitor' : 'active',
      currentFile: this.visitorConfig ? null : null,
      currentFunction: this.visitorConfig ? null : null,
      currentBranch: this.visitorConfig ? null : null,
      lastActivity: new Date().toISOString(),
      color: this.color,
      ...(this.visitorConfig ? { homeTeamId: this.visitorConfig.homeTeamId } : {}),
    };

    this.provider.awareness.setLocalState(state);
  }

  private setupActivityListener(): void {
    this.activityFeed.observe(() => {
      const events = this.activityFeed.toArray();
      this.notifyActivity(events);
    });
  }

  pushActivityEvent(
    type: ActivityEventType,
    options: { file?: string; branch?: string; message?: string; metadata?: Record<string, unknown> } = {},
  ): void {
    if (this.visitorConfig) return; // Visitors don't emit activity events
    if (!this.shouldEmitEvent(type, options.file)) return;

    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: this.userId,
      userType: 'human',
      parentUserId: null,
      teamId: this.teamId,
      type,
      file: options.file ?? null,
      branch: options.branch ?? null,
      message: options.message ?? null,
      metadata: options.metadata ?? null,
    };

    this.activityFeed.push([event]);
  }

  setAgentConfig(config: AgentConfig): void {
    this.agentConfig = config;
  }

  pushAgentActivityEvent(
    type: ActivityEventType,
    options: { file?: string; branch?: string; message?: string; metadata?: Record<string, unknown> } = {},
  ): void {
    if (this.visitorConfig) return; // Visitors don't emit activity events
    if (!this.agentConfig) return;
    if (!this.shouldEmitEvent(type, options.file)) return;

    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: this.agentConfig.agentUserId,
      userType: 'agent',
      parentUserId: this.agentConfig.parentUserId,
      teamId: this.teamId,
      type,
      file: options.file ?? null,
      branch: options.branch ?? null,
      message: options.message ?? null,
      metadata: options.metadata ?? null,
    };

    this.activityFeed.push([event]);
  }

  private shouldEmitEvent(type: ActivityEventType, file?: string): boolean {
    let throttle: number;
    switch (type) {
      case 'file_save':
        throttle = CLI_CONFIG.THROTTLE_FILE_SAVE;
        break;
      case 'file_open':
        throttle = CLI_CONFIG.THROTTLE_FILE_OPEN;
        break;
      default:
        return true; // No throttle for commits, branch switches, session events
    }

    const key = `${type}:${file ?? ''}`;
    const now = Date.now();
    const last = this.throttleMap.get(key);
    if (last && now - last < throttle) return false;
    this.throttleMap.set(key, now);
    return true;
  }

  setCurrentBranch(branch: string): void {
    if (!this.provider) return;

    const current = this.provider.awareness.getLocalState() as AwarenessState | null;
    if (!current) return;

    this.provider.awareness.setLocalState({
      ...current,
      currentBranch: branch,
      lastActivity: new Date().toISOString(),
    });
  }

  disconnect(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.provider) {
      if (!this.visitorConfig) {
        this.pushActivityEvent('session_end');
      }
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
