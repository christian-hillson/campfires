// Campfires - Shared Types
// This is the source of truth for all data types

// User type: human or agent
export type UserType = 'human' | 'agent';

// User status in awareness
export type UserStatus = 'active' | 'idle' | 'draft' | 'offline';

// Activity event types
export type ActivityEventType =
  | 'file_open'
  | 'file_save'
  | 'commit'
  | 'branch_switch'
  | 'session_start'
  | 'session_end';

// ============================================
// Persisted Models
// ============================================

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
  parentUserId: string | null;
  createdAt: string; // ISO timestamp
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
  createdAt: string; // ISO timestamp
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
  createdAt: string; // ISO timestamp
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
  timestamp: string; // ISO timestamp
  userId: string;
  userType: UserType;
  parentUserId: string | null;
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
  periodStart: string; // ISO timestamp
  periodEnd: string; // ISO timestamp
  content: string;
  eventCount: number;
  createdAt: string; // ISO timestamp
}

// ============================================
// Real-Time Models (In-Memory via Yjs)
// ============================================

/**
 * Awareness State (Real-Time, In-Memory via Yjs)
 * Ephemeral state broadcast via Yjs awareness protocol
 */
export interface AwarenessState {
  userId: string;
  displayName: string;
  type: UserType;
  parentUserId: string | null;
  status: UserStatus;
  currentFile: string | null;
  currentFunction: string | null;
  currentBranch: string | null;
  lastActivity: string; // ISO timestamp
  color: string;
}

// ============================================
// Filter & Configuration
// ============================================

/**
 * Filter configuration for the activity feed
 */
export interface FilterConfig {
  users: string[]; // Filter by specific user IDs (empty = all)
  directories: string[]; // Filter by directory paths
  eventTypes: ActivityEventType[]; // Filter by event types
  focusMode: boolean; // When true, only show immediate collaborators
}

// ============================================
// API Request/Response Types
// ============================================

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

// ============================================
// Agent API Types
// ============================================

export interface RegisterAgentRequest {
  displayName?: string;
}

export interface RegisterAgentResponse {
  agent: User;
  token: string;
}

export interface AgentActivityRequest {
  type: ActivityEventType;
  file?: string;
  branch?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// JWT Payload
// ============================================

export interface JwtPayload {
  userId: string;
  email: string;
  teamId: string | null;
  orgId: string | null;
  type: UserType;
}

// ============================================
// Config Constants
// ============================================

export const CONFIG = {
  // Throttling values (in milliseconds)
  THROTTLE_FILE_SAVE: 5000, // 5 seconds
  THROTTLE_FILE_OPEN: 2000, // 2 seconds

  // Server-side rate limiting
  MAX_EVENTS_PER_USER_PER_SECOND: 1,

  // Idle detection
  IDLE_TIMEOUT: 5 * 60 * 1000, // 5 minutes

  // Awareness timeout (when to show user as offline)
  AWARENESS_TIMEOUT: 30 * 1000, // 30 seconds

  // Reel summarization interval
  SUMMARIZATION_INTERVAL: 15 * 60 * 1000, // 15 minutes

  // Activity feed rolling window
  ACTIVITY_FEED_MAX_EVENTS: 500,
} as const;
