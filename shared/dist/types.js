"use strict";
// Campfires - Shared Types
// This is the source of truth for all data types
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
// ============================================
// Config Constants
// ============================================
exports.CONFIG = {
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
};
//# sourceMappingURL=types.js.map