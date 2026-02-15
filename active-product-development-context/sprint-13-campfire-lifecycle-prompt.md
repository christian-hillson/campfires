# Sprint 13: Campfire Lifecycle — Cold Firepits, Kindle Animation & Founder Ceremony

## Context

You are working on Campfires, a pixel-art RPG-style map web app (`campfire-stories/`) that visualizes team development activity. Each team is represented as a campfire on an HTML5 canvas. Currently, campfires only exist when teams are active. This sprint adds a full campfire lifecycle: cold firepits for offline teams, a kindle animation when the first person logs in, revised fire intensity tiers, a decay system with grace period, and a special founder animation for brand-new teams.

**Codebase location:** Monorepo. The map renderer lives in `campfire-stories/src/map/`. Key files:

- `renderer.ts` — Main canvas render loop, `drawCampfire()`, day/night cycle
- `sprites.ts` — Human and golem sprite rendering + animations
- `environment.ts` — Trees, paths, woodpiles, barrels, crates, torches
- `layout.ts` — Elliptical auto-layout for campfire positions
- `camera.ts` — Zoom/pan camera system

The server lives in `server/src/`. Key files:

- `api.ts` — REST endpoints
- `persistence.ts` — SQLite persistence
- `ws-server.ts` — WebSocket + Yjs awareness

Read all of these files before making changes. Understand the existing rendering pipeline, animation queue system, and how fire intensity is currently calculated before modifying anything.

---

## What We're Building

### 1. Cold Firepit State (Tier 0)

Every registered team gets a campfire position on the map at all times, even when no one is online. When a team is fully offline, their campfire renders as a **cold firepit**:

**Visual elements:**

- **Stone ring** — 6-8 small gray stones arranged in a circle (pixel-art style, 3-4px each). Use slightly varied gray tones (#555, #666, #777) for a natural look.
- **Charred logs** — 2-3 small dark brown/black log shapes inside the ring, crossed casually. These are remnants of the last fire.
- **Faint smoke wisp** — A single thin wisp of smoke rising from the center, very subtle. 1-2px wide, light gray (#888 at ~30% opacity), slow sinusoidal drift. This signals "this was a fire" without suggesting it's active.
- **Leftover tools/workstations** — When transitioning from active to cold (not on first load), leave behind 1-2 small pixel-art props near the firepit: a tiny anvil, a scroll, a pickaxe, a small crate. Randomly select from the existing environmental art palette. These persist until the fire is rekindled the next day, then clear. On first page load of a cold firepit, show the tools if the team was active earlier today (check last activity timestamp), otherwise show a clean firepit.
- **Team name label** — Still displayed below the firepit, same as active campfires, but dimmed (#555 instead of the normal color).

**Day/night interaction:**

- At night, the charred logs should have a very faint orange-red glow (embers effect) — just 2-3 pixels flickering between #8B2500 and #4A1400 at ~40% opacity. The stone ring catches faint moonlight (slightly lighter gray on the top-facing edges).
- During day, no ember glow. Just the cold stones and charred logs.

### 2. Fire Intensity Tiers (Revised)

Replace the current 3-tier system with 4 tiers plus the cold state:

| Tier | Name            | Trigger                                     | Visual                                                                                                                                                  |
| ---- | --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Cold/Smoldering | No team members online                      | Stone ring, charred logs, faint smoke, leftover tools. See above.                                                                                       |
| 1    | Kindled         | First person logs in                        | Small flame (60% of current min size). Minimal sparks (1-2). Warm glow radius small. Fire is clearly lit but modest. The "someone just got here" state. |
| 2    | Steady          | Multiple people active, moderate event rate | Normal campfire. Steady flame, moderate sparks (3-5). This is roughly what the current "low/medium" tier looks like.                                    |
| 3    | Roaring         | High activity, lots of events flowing       | Big flames, lots of sparks (6-10), expanded glow radius. Current "high" tier.                                                                           |

**Tier transitions** should use the existing smooth 1-second transition system. Tier calculation should factor in:

- Number of online team members (0 = Tier 0, 1 = at least Tier 1)
- Event rate over the last 60 seconds (file_saves, commits, branch_switches)
- Suggested thresholds: 0 events/min → Tier 1 (if anyone online), 1-5 events/min → Tier 2, 6+ events/min → Tier 3

Adjust these thresholds based on what looks good — the numbers above are starting points, not gospel.

### 3. Kindle Animation

When the first team member comes online and a campfire transitions from Tier 0 → Tier 1, play a **kindle animation** (~1.5 seconds):

**Sequence:**

1. **Spark** (0-0.3s) — A small bright spark (#FFD700) appears at the center of the firepit, jumping between the charred logs. 2-3 quick position jitters.
2. **Catch** (0.3-0.7s) — The spark expands into a tiny flame. Charred logs begin to glow orange at contact points. Faint crackle particles (2-3 tiny orange dots rising).
3. **Grow** (0.7-1.5s) — Flame smoothly grows to Tier 1 size. Glow radius expands. Smoke wisp transitions from gray to light white/yellow (now it's real fire smoke). Leftover tools from the cold state fade out or get "picked up" (shrink and vanish over 0.3s).

**Staggering for 9am rush:** If multiple campfires kindle within the same 2-second window, stagger the animations by 200-300ms each. This creates a pleasant "village waking up" popcorn effect rather than everything firing at once. Implement with a simple kindle queue that spaces out start times.

### 4. Offline Decay with Grace Period

When the last team member goes offline:

1. **Grace period** — Wait 5 minutes before starting decay. If anyone reconnects during this window, cancel the decay. This handles browser refreshes, brief disconnections, etc.
2. **Decay animation** (~60 seconds) — Fire gradually shrinks through the tiers in reverse: current tier → Tier 1 → smoldering → cold. Don't rush it. The fire should feel like it's naturally dying out.
3. **Final state** — Settle into the Tier 0 cold firepit visual. Leave behind 1-2 random leftover tools (see Cold Firepit section above).

Track the grace period on the server side via the session/heartbeat system. The client should receive an event or poll state that indicates "team is in grace period" vs "team is fully offline." During grace period, the fire stays at Tier 1 minimum — don't start visual decay until the grace period expires.

### 5. Founder Ceremony (New Team Registration)

When a brand-new team registers for the first time (not a daily rekindle — the very first time this team appears on any org map), play a special **founder ceremony animation** (~4 seconds):

**The Founder Pig:**

- A small pixel-art pig character (8-10px wide, 6-8px tall). Pink body (#FFB6C1 / #FF69B4), darker pink snout, tiny black dot eyes, small pointed ears, curly tail. Keep it cute and simple — this is pixel art, not a painting. 4 colors max.
- The pig should have a tiny hard hat or construction hat (yellow, #FFD700) to signal "builder."

**Animation sequence:**

1. **Entrance** (0-1s) — The pig trots in from the nearest map edge toward the designated campfire position. Movement speed similar to sprite walk animations. Small bouncy gait (1-2px vertical bob per step).
2. **Building** (1-2.5s) — The pig stops at the position. Stones appear one at a time in a circle (each stone pops in with a tiny 1-frame scale-up). After the ring is placed, the pig pushes/rolls 2 log shapes into the center (logs slide in from the pig's position).
3. **Lighting** (2.5-3.5s) — The pig faces the firepit. A bright spark appears (same as kindle spark). The fire catches and grows to Tier 1. Brief celebration particles — 3-4 gold sparkles around the pig.
4. **Exit** (3.5-4s) — The pig does a small jump (happy bounce), then trots off the map edge. The campfire is now live and behaves normally.

**Important:** This animation should ONLY play when a team is brand-new to the org. Not on daily rekindle. Store a `firstSeenAt` timestamp on the team record in SQLite. If `firstSeenAt` is null or was just set in the current request, trigger the founder ceremony on connected clients. Deliver this via SSE event (`type: "team_registered"`) or via the awareness state.

### 6. Layout Persistence

Campfire positions must be **stable and persistent**. People build spatial memory ("Payments is top-left").

**On team registration:**

- Calculate a position for the new campfire using the existing elliptical auto-layout algorithm, but now accounting for all existing campfires (not just active ones).
- Persist the (x, y) world coordinates to SQLite on the team record.
- Existing campfires do NOT move when a new one is added. The new campfire gets placed in the best available gap.

**On map load:**

- Read persisted positions from the server. If a team has stored coordinates, use them. Only run auto-layout for teams that don't have persisted positions (migration case).
- Add a new endpoint or extend the existing teams endpoint: `GET /orgs/:id/teams` should include `mapX` and `mapY` fields.

**Migration:** For existing teams that don't have persisted positions yet, run the auto-layout once on server startup or first request, persist the results, and never recalculate them unless a team is deleted.

---

## Implementation Order

1. **Layout persistence** — Add `mapX`, `mapY`, `firstSeenAt` columns to the teams table. Update the teams endpoint. Migrate existing teams with auto-layout positions.
2. **Cold firepit rendering** — New `drawColdFirepit()` function in `renderer.ts`. Render stone ring, charred logs, smoke wisp, leftover tools. Hook into the day/night cycle for ember glow.
3. **Revised fire tiers** — Refactor `drawCampfire()` to support 4 tiers. Update tier calculation logic to use member count + event rate. Ensure smooth transitions between all tiers including 0↔1.
4. **Kindle animation** — Implement the spark→catch→grow sequence. Add kindle queue for staggering. Wire up to the Tier 0→1 transition.
5. **Offline decay** — Server-side grace period tracking. Client-side decay animation (reverse kindle). Leftover tool placement on full decay.
6. **Founder pig ceremony** — Pig sprite rendering. 4-phase animation sequence. SSE event for new team registration. Wire up to layout persistence (new team gets position + ceremony).

---

## Technical Constraints

- **Canvas rendering only** — No DOM elements for campfire visuals. Everything is drawn on the HTML5 canvas in the existing render loop.
- **Pixel-art aesthetic** — All new visual elements must match the existing pixel-art style. No anti-aliasing on sprites. Use integer coordinates. Keep color palettes limited per element (4-6 colors max).
- **Performance** — The map may show 20+ campfires simultaneously. Cold firepits should be cheaper to render than active fires (no particle systems, minimal animation). The smoke wisp and ember glow should use simple math, not particle emitters.
- **Existing animation system** — Use the existing animation queue (FIFO with onStart/onComplete callbacks) for the kindle and founder animations. Don't build a parallel animation system.
- **Day/night cycle** — All new visual elements must respect the existing day/night cycle in `renderer.ts`. Use the existing `glowMultiplier` and ambient color overlay system.
- **Camera system** — All new rendering must work correctly at all zoom levels and pan positions. Use world-space coordinates, not screen-space.

---

## Files You'll Likely Touch

**Map rendering (campfire-stories/src/map/):**

- `renderer.ts` — `drawCampfire()` refactor, new `drawColdFirepit()`, tier logic, kindle animation, decay animation
- `sprites.ts` — Founder pig sprite (new), leftover tool sprites (may reuse environment art)
- `environment.ts` — Possibly extend for leftover tool props
- `layout.ts` — Persist positions, gap-finding for new teams

**Server (server/src/):**

- `persistence.ts` — New columns: `mapX`, `mapY`, `firstSeenAt` on teams table. Grace period tracking on sessions.
- `api.ts` — Extend `GET /orgs/:id/teams` with position data. SSE event for team registration.
- Possibly `ws-server.ts` if awareness state needs to carry team online/offline status for tier calculation.

**Shared (shared/src/):**

- `types.ts` — Update Team type with `mapX`, `mapY`, `firstSeenAt`. Add fire tier enum/type if not implicit.

---

## What Success Looks Like

1. Open the map for an org with 5 registered teams, 2 of which have members online. You see 2 lit campfires (Tier 1-3 based on activity) and 3 cold firepits with stone rings, charred logs, and faint smoke. At night, the cold firepits have faint ember glow.
2. A team member logs in. Their team's firepit plays the kindle animation — spark, catch, grow — and transitions smoothly to Tier 1. If 3 teams kindle within seconds of each other, the animations stagger with a pleasant popcorn effect.
3. Activity picks up. The fire grows through Tier 2 → Tier 3 with smooth transitions.
4. Everyone on a team logs off. The fire stays at Tier 1 for 5 minutes (grace period). After 5 minutes, it slowly decays over ~60 seconds back to the cold firepit state, leaving behind a couple of small tools.
5. A brand-new team registers. The founder pig trots in, places stones, lights the fire, celebrates, and trots away. The campfire is now permanent on the map at that position.
6. Refresh the page. All campfires are in the same positions. The new team's campfire is right where the pig placed it.

---

## Out of Scope

- Touch/mobile support
- Sound effects
- Sprite customization
- Campfire detail panel redesign
- New team layout reflow (existing campfires don't move — new ones find gaps)
- Pig sprite reuse for anything other than the founder ceremony
