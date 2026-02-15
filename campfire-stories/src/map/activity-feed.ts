import type { ActivityEvent, Team } from '@campfires/shared';
import { ACTIVITY_POLL_INTERVAL } from './animation-constants.js';

export class ActivityFeed {
  private lastSeenTimestamp: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private seenIds = new Set<string>();

  constructor() {
    this.lastSeenTimestamp = new Date().toISOString();
  }

  start(teams: Team[], serverUrl: string, onEvents: (events: ActivityEvent[]) => void): void {
    this.stop();

    const poll = async () => {
      const allNewEvents: ActivityEvent[] = [];

      for (const team of teams) {
        try {
          const url = `${serverUrl}/api/teams/${team.teamId}/activity?since=${encodeURIComponent(this.lastSeenTimestamp)}&limit=50`;
          const res = await fetch(url);
          if (!res.ok) continue;

          const events: ActivityEvent[] = await res.json();
          for (const event of events) {
            if (!this.seenIds.has(event.id)) {
              this.seenIds.add(event.id);
              allNewEvents.push(event);
            }
          }
        } catch {
          // Silently skip failed team polls
        }
      }

      if (allNewEvents.length > 0) {
        // Sort by timestamp
        allNewEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        // Update cursor to latest seen
        this.lastSeenTimestamp = allNewEvents[allNewEvents.length - 1].timestamp;
        onEvents(allNewEvents);
      }

      // Prevent seenIds from growing unbounded
      if (this.seenIds.size > 1000) {
        const arr = [...this.seenIds];
        this.seenIds = new Set(arr.slice(arr.length - 500));
      }
    };

    // Initial poll
    poll();
    this.intervalId = setInterval(poll, ACTIVITY_POLL_INTERVAL);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
