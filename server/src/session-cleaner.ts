import { CONFIG } from '@campfires/shared';
import { getPersistence } from './persistence.js';

export class SessionCleaner {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    console.log(`[SessionCleaner] Starting with 60s interval`);
    this.intervalId = setInterval(() => {
      this.runOnce();
    }, 60_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SessionCleaner] Stopped');
    }
  }

  runOnce(): void {
    const db = getPersistence();
    const incomplete = db.getIncompleteTranscripts();

    const now = Date.now();
    const cutoff = CONFIG.SESSION_STALE_TIMEOUT;
    let closed = 0;

    for (const session of incomplete) {
      const updatedAt = new Date(session.updatedAt).getTime();
      if (now - updatedAt > cutoff) {
        db.endSession(session.sessionId);
        closed++;
      }
    }

    if (closed > 0) {
      console.log(`[SessionCleaner] Closed ${closed} stale session${closed !== 1 ? 's' : ''}`);
    }
  }
}
