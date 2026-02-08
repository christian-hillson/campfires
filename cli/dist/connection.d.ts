import type { AwarenessState, ActivityEvent } from '@campfires/shared';
export interface ConnectionState {
    connected: boolean;
    reconnecting: boolean;
}
export type ConnectionCallback = (state: ConnectionState) => void;
export type AwarenessCallback = (states: Map<number, AwarenessState>) => void;
export type ActivityCallback = (events: ActivityEvent[]) => void;
export declare class CampfireConnection {
    private serverUrl;
    private teamId;
    private token;
    private userId;
    private displayName;
    private color;
    private doc;
    private provider;
    private activityFeed;
    private refreshInterval;
    private connectionCallbacks;
    private awarenessCallbacks;
    private activityCallbacks;
    constructor(serverUrl: string, teamId: string, token: string, userId: string, displayName: string, color: string);
    connect(): void;
    private updateAwareness;
    private setupActivityListener;
    disconnect(): void;
    onConnectionChange(cb: ConnectionCallback): void;
    onAwarenessChange(cb: AwarenessCallback): void;
    onActivityChange(cb: ActivityCallback): void;
    getAwarenessStates(): Map<number, AwarenessState>;
    getActivityFeed(): ActivityEvent[];
    private notifyConnection;
    private notifyAwareness;
    private notifyActivity;
}
//# sourceMappingURL=connection.d.ts.map