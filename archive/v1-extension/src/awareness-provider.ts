import * as vscode from 'vscode';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type {
  AwarenessState,
  ActivityEvent,
  ActivityEventType,
  UserStatus,
} from '@campfires/shared';
import { CONFIG } from '@campfires/shared';

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
}

export type ConnectionCallback = (state: ConnectionState) => void;
export type AwarenessCallback = (states: Map<number, AwarenessState>) => void;
export type ActivityCallback = (events: ActivityEvent[]) => void;

export class AwarenessProvider implements vscode.Disposable {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private activityFeed: Y.Array<ActivityEvent>;
  private disposables: vscode.Disposable[] = [];

  private userId: string;
  private displayName: string;
  private teamId: string;
  private token: string;
  private serverUrl: string;
  private color: string;

  private isDraftMode = false;
  private isIdle = false;
  private currentFile: string | null = null;
  private currentFunction: string | null = null;
  private currentBranch: string | null = null;

  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private awarenessCallbacks: Set<AwarenessCallback> = new Set();
  private activityCallbacks: Set<ActivityCallback> = new Set();

  // Throttling state
  private lastFileSave: Map<string, number> = new Map();
  private lastFileOpen: Map<string, number> = new Map();

  private visitorMode: boolean;
  private homeTeamId: string | null;

  constructor(options: {
    userId: string;
    displayName: string;
    teamId: string;
    token: string;
    serverUrl: string;
    color: string;
    visitorMode?: boolean;
    homeTeamId?: string;
  }) {
    this.userId = options.userId;
    this.displayName = options.displayName;
    this.teamId = options.teamId;
    this.token = options.token;
    this.serverUrl = options.serverUrl;
    this.color = options.color;
    this.visitorMode = options.visitorMode || false;
    this.homeTeamId = options.homeTeamId || null;

    this.doc = new Y.Doc();
    this.activityFeed = this.doc.getArray<ActivityEvent>('activityFeed');

    this.setupActivityListener();
  }

  public connect(): void {
    const wsUrl = this.serverUrl.replace(/^http/, 'ws');
    const roomName = `campfire:${this.teamId}`;

    this.provider = new WebsocketProvider(wsUrl, roomName, this.doc, {
      params: { token: this.token },
    });

    this.provider.on('status', (event: { status: string }) => {
      const connected = event.status === 'connected';
      this.notifyConnectionCallbacks({
        connected,
        reconnecting: event.status === 'connecting',
      });
    });

    this.provider.awareness.on('change', () => {
      this.notifyAwarenessCallbacks();
    });

    // Broadcast initial awareness state
    this.updateAwareness();
  }

  private setupActivityListener(): void {
    this.activityFeed.observe(() => {
      const events = this.activityFeed.toArray();
      this.notifyActivityCallbacks(events);
    });
  }

  public disconnect(): void {
    if (this.provider) {
      // Send session end event
      this.pushActivityEvent('session_end');
      this.provider.awareness.setLocalState(null);
      this.provider.disconnect();
      this.provider = null;
    }
  }

  // ============================================
  // Awareness State Management
  // ============================================

  public updateAwareness(): void {
    if (!this.provider) return;

    const state: AwarenessState = {
      userId: this.userId,
      displayName: this.displayName,
      type: 'human',
      parentUserId: null,
      status: this.visitorMode ? 'visitor' : this.getStatus(),
      currentFile: this.visitorMode ? null : this.isDraftMode ? null : this.currentFile,
      currentFunction: this.visitorMode ? null : this.isDraftMode ? null : this.currentFunction,
      currentBranch: this.visitorMode ? null : this.isDraftMode ? null : this.currentBranch,
      lastActivity: new Date().toISOString(),
      color: this.color,
      ...(this.visitorMode && this.homeTeamId ? { homeTeamId: this.homeTeamId } : {}),
    };

    this.provider.awareness.setLocalState(state);
  }

  private getStatus(): UserStatus {
    if (this.isDraftMode) return 'draft';
    if (this.isIdle) return 'idle';
    return 'active';
  }

  public setDraftMode(enabled: boolean): void {
    this.isDraftMode = enabled;
    this.updateAwareness();
  }

  public setIdle(idle: boolean): void {
    this.isIdle = idle;
    this.updateAwareness();
  }

  public setCurrentFile(file: string | null): void {
    this.currentFile = file;
    this.updateAwareness();
  }

  public setCurrentFunction(func: string | null): void {
    this.currentFunction = func;
    this.updateAwareness();
  }

  public setCurrentBranch(branch: string | null): void {
    this.currentBranch = branch;
    this.updateAwareness();
  }

  public getDraftMode(): boolean {
    return this.isDraftMode;
  }

  // ============================================
  // Activity Event Management
  // ============================================

  public pushActivityEvent(
    type: ActivityEventType,
    options: {
      file?: string;
      branch?: string;
      message?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): void {
    if (this.visitorMode) {
      return; // Visitors don't emit activity events
    }

    if (this.isDraftMode && type !== 'session_start' && type !== 'session_end') {
      return; // Don't log activity in draft mode
    }

    // Apply throttling
    if (!this.shouldEmitEvent(type, options.file)) {
      return;
    }

    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: this.userId,
      userType: 'human',
      parentUserId: null,
      teamId: this.teamId,
      type,
      file: options.file || null,
      branch: options.branch || this.currentBranch,
      message: options.message || null,
      metadata: options.metadata || null,
    };

    this.activityFeed.push([event]);
  }

  private shouldEmitEvent(type: ActivityEventType, file?: string): boolean {
    const now = Date.now();

    switch (type) {
      case 'file_save': {
        if (!file) return true;
        const lastSave = this.lastFileSave.get(file) || 0;
        if (now - lastSave < CONFIG.THROTTLE_FILE_SAVE) return false;
        this.lastFileSave.set(file, now);
        return true;
      }
      case 'file_open': {
        if (!file) return true;
        const lastOpen = this.lastFileOpen.get(file) || 0;
        if (now - lastOpen < CONFIG.THROTTLE_FILE_OPEN) return false;
        this.lastFileOpen.set(file, now);
        return true;
      }
      default:
        return true; // No throttling for commits, branch switches, session events
    }
  }

  // ============================================
  // Getters for state
  // ============================================

  public getAwarenessStates(): Map<number, AwarenessState> {
    if (!this.provider) return new Map();
    return this.provider.awareness.getStates() as Map<number, AwarenessState>;
  }

  public getActivityFeed(): ActivityEvent[] {
    return this.activityFeed.toArray();
  }

  public getConnectedCount(): number {
    if (!this.provider) return 0;
    return this.provider.awareness.getStates().size;
  }

  public isConnected(): boolean {
    return this.provider?.wsconnected || false;
  }

  // ============================================
  // Callback Registration
  // ============================================

  public onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.add(callback);
  }

  public offConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.delete(callback);
  }

  public onAwarenessChange(callback: AwarenessCallback): void {
    this.awarenessCallbacks.add(callback);
  }

  public offAwarenessChange(callback: AwarenessCallback): void {
    this.awarenessCallbacks.delete(callback);
  }

  public onActivityChange(callback: ActivityCallback): void {
    this.activityCallbacks.add(callback);
  }

  public offActivityChange(callback: ActivityCallback): void {
    this.activityCallbacks.delete(callback);
  }

  private notifyConnectionCallbacks(state: ConnectionState): void {
    this.connectionCallbacks.forEach((cb) => cb(state));
  }

  private notifyAwarenessCallbacks(): void {
    const states = this.getAwarenessStates();
    this.awarenessCallbacks.forEach((cb) => cb(states));
  }

  private notifyActivityCallbacks(events: ActivityEvent[]): void {
    this.activityCallbacks.forEach((cb) => cb(events));
  }

  public dispose(): void {
    this.disconnect();
    this.disposables.forEach((d) => d.dispose());
    this.doc.destroy();
  }
}
