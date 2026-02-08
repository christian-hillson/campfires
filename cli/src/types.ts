import type { AwarenessState, ActivityEvent, Summary, Org, Team, User } from '@campfires/shared';

// ============================================
// CLI Configuration Constants
// ============================================

export const CLI_CONFIG = {
  // Render coalescing (milliseconds)
  RENDER_DEBOUNCE: 50,

  // Awareness refresh interval (milliseconds) — must be < AWARENESS_TIMEOUT (30s)
  AWARENESS_REFRESH: 15_000,

  // Summary polling interval (milliseconds)
  SUMMARY_POLL_INTERVAL: 5 * 60 * 1000, // 5 minutes

  // Default server URL
  DEFAULT_SERVER_URL: 'http://localhost:3000',

  // Activity feed max display lines
  ACTIVITY_DISPLAY_MAX: 20,

  // Minimum terminal width before heavy truncation
  MIN_WIDTH: 40,
} as const;

// ============================================
// Render State
// ============================================

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
  time: string; // HH:MM
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

// ============================================
// Auth types
// ============================================

export interface TokenPayload {
  userId: string;
  email: string;
  teamId: string | null;
  orgId: string | null;
  type: 'human' | 'agent';
}
