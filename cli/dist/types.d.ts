import type { ActivityEvent, Summary } from '@campfires/shared';
export declare const CLI_CONFIG: {
    readonly RENDER_DEBOUNCE: 50;
    readonly AWARENESS_REFRESH: 15000;
    readonly SUMMARY_POLL_INTERVAL: number;
    readonly DEFAULT_SERVER_URL: "http://localhost:3000";
    readonly ACTIVITY_DISPLAY_MAX: 20;
    readonly MIN_WIDTH: 40;
};
export interface Tier1State {
    orgName: string;
    teamCount: number;
    onlineCount: number;
    summaries: Summary[];
}
export interface MemberState {
    userId: string;
    displayName: string;
    type: 'human' | 'agent';
    status: 'active' | 'idle' | 'draft' | 'offline';
    currentFile: string | null;
    currentFunction: string | null;
    color: string;
    parentUserId?: string;
}
export interface Tier2State {
    teamName: string;
    members: MemberState[];
}
export interface ActivityDisplayEvent {
    time: string;
    name: string;
    description: string;
    type: ActivityEvent['type'];
}
export interface Tier3State {
    events: ActivityDisplayEvent[];
}
export interface RenderState {
    tier1: Tier1State;
    tier2: Tier2State;
    tier3: Tier3State;
    connected: boolean;
    reconnecting: boolean;
}
export interface TokenPayload {
    userId: string;
    email: string;
    teamId: string | null;
    orgId: string | null;
    type: 'human' | 'agent';
}
//# sourceMappingURL=types.d.ts.map