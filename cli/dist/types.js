"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_CONFIG = void 0;
// ============================================
// CLI Configuration Constants
// ============================================
exports.CLI_CONFIG = {
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
};
//# sourceMappingURL=types.js.map