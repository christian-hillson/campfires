export type UserType = 'human' | 'agent';
export type UserStatus = 'active' | 'idle' | 'draft' | 'offline';
export type ActivityEventType = 'file_open' | 'file_save' | 'commit' | 'branch_switch' | 'session_start' | 'session_end';
/**
 * User (Persisted)
 * Represents a user in the system
 */
export interface User {
    userId: string;
    email: string;
    displayName: string;
    avatarColor: string;
    teamId: string;
    orgId: string;
    type: UserType;
    createdAt: string;
}
/**
 * Org (Persisted)
 * Represents an organization
 */
export interface Org {
    orgId: string;
    name: string;
    mission: string;
    roadmap: string;
    createdAt: string;
}
/**
 * Team (Persisted)
 * Represents a team within an organization
 */
export interface Team {
    teamId: string;
    orgId: string;
    name: string;
    description: string;
    inviteCode: string;
    createdAt: string;
}
/**
 * Team with members populated
 */
export interface TeamWithMembers extends Team {
    members: User[];
}
/**
 * Activity Event (Persisted, Append-Only)
 * Discrete events written to the activity_log table
 */
export interface ActivityEvent {
    id: string;
    timestamp: string;
    userId: string;
    userType: UserType;
    teamId: string;
    type: ActivityEventType;
    file: string | null;
    branch: string | null;
    message: string | null;
    metadata: Record<string, unknown> | null;
}
/**
 * Summary (Persisted)
 * AI-generated summaries for the Reel
 */
export interface Summary {
    id: string;
    orgId: string;
    teamId: string;
    periodStart: string;
    periodEnd: string;
    content: string;
    eventCount: number;
    createdAt: string;
}
/**
 * Awareness State (Real-Time, In-Memory via Yjs)
 * Ephemeral state broadcast via Yjs awareness protocol
 */
export interface AwarenessState {
    userId: string;
    displayName: string;
    type: UserType;
    status: UserStatus;
    currentFile: string | null;
    currentFunction: string | null;
    currentBranch: string | null;
    lastActivity: string;
    color: string;
}
/**
 * Filter configuration for the activity feed
 */
export interface FilterConfig {
    users: string[];
    directories: string[];
    eventTypes: ActivityEventType[];
    focusMode: boolean;
}
export interface SignupRequest {
    email: string;
    password: string;
    displayName: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    token: string;
    user: User;
}
export interface CreateOrgRequest {
    name: string;
    mission?: string;
    roadmap?: string;
}
export interface UpdateOrgRequest {
    name?: string;
    mission?: string;
    roadmap?: string;
}
export interface CreateTeamRequest {
    orgId: string;
    name: string;
    description?: string;
}
export interface JoinTeamRequest {
    inviteCode: string;
}
export interface JwtPayload {
    userId: string;
    email: string;
    teamId: string | null;
    orgId: string | null;
    type: UserType;
}
export declare const CONFIG: {
    readonly THROTTLE_FILE_SAVE: 5000;
    readonly THROTTLE_FILE_OPEN: 2000;
    readonly MAX_EVENTS_PER_USER_PER_SECOND: 1;
    readonly IDLE_TIMEOUT: number;
    readonly AWARENESS_TIMEOUT: number;
    readonly SUMMARIZATION_INTERVAL: number;
    readonly ACTIVITY_FEED_MAX_EVENTS: 500;
};
//# sourceMappingURL=types.d.ts.map