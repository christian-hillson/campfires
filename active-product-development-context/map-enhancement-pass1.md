# Campfires Map Enhancement — Pass 1: Event System, Fire Reactivity, Sprite Animations

## Context

The Campfires map (`active-product-development-context/campfires-map-mockup.html`) is a 2D pixel-art HTML5 canvas showing teams as campfires with human sprites and golem (agent) sprites. It's an alternative rendering mode for the Campfires Reel — same data pipeline, same REST endpoints. Currently sprites just shuffle back and forth and the campfires burn at a static intensity. We want to make the graphics **reactive to AI activity summaries and real events** so the map becomes a visual dashboard you can read at a glance.

The aesthetic is pixel-art RPG — think RollerCoaster Tycoon, Suikoden, Stardew Valley. The campfire is the central metaphor: it's the team's hearth, forge, and gathering place. Everything visual should reinforce that fire = team energy.

**This is Pass 1 of 2.** This pass establishes the mock data/event system, fire reactivity, sprite animation queue, event-driven micro-animations, milestone celebrations, and ambient pulses. Pass 2 (in `active-product-development-context/map-enhancement-pass2.md`) builds golem enhancements and the spark-to-golem spawn/despawn sequence on top of this foundation.

## 1. Structured Summary Metadata + Mock Event Stream

Extend the AI summarizer output (or mock it for now) to include structured fields alongside the plain-text summary. These fields drive all the visual reactivity below.

```typescript
interface SummaryMetadata {
  activityLevel: 'high' | 'steady' | 'low'; // based on event count in the period
  milestone: boolean; // true if significant commit/merge happened
  mood: 'building' | 'fixing' | 'exploring' | 'blocked'; // inferred from commit messages/file patterns
  hotModules: string[]; // which areas of the codebase are active
}
```

Create a `mockSummaryData` object per team and a `mockEventStream` array that replays events on a timer, so all visual behaviors can be tested without the real pipeline.

The mock event stream must cover **every visual state and animation** in this pass. Replay events on a looping timer (~60-90 second full cycle) so you can watch the map and see everything without interaction. Include at minimum:

```typescript
const mockEventStream = [
  // --- Session & Presence ---
  { time: 0, type: 'session_start', userId: 'christian', teamId: 'payments' },
  { time: 2, type: 'session_start', userId: 'jc', teamId: 'payments' },

  // --- Basic file activity ---
  { time: 5, type: 'file_open', userId: 'christian', file: 'server/api.ts' },
  { time: 8, type: 'file_save', userId: 'christian', file: 'server/api.ts' },
  { time: 10, type: 'file_save', userId: 'jc', file: 'reel/app.ts' },

  // --- Branch switch (sprite repositions around fire) ---
  { time: 14, type: 'branch_switch', userId: 'jc', branch: 'feat/reel-ui' },

  // --- Commit (sprite walks to fire, tosses, message floats) ---
  { time: 28, type: 'commit', userId: 'christian', message: 'add JWT refresh endpoint' },

  // --- Draft mode toggle (sprite enters tent) ---
  { time: 36, type: 'draft_mode_on', userId: 'jc' },

  // --- Draft mode exit (sprite leaves tent) ---
  { time: 44, type: 'draft_mode_off', userId: 'jc' },

  // --- Summary update: activity level shift (fire intensity change) ---
  {
    time: 48,
    type: 'summary_update',
    teamId: 'payments',
    activityLevel: 'high',
    milestone: false,
    mood: 'building',
  },
  {
    time: 48,
    type: 'summary_update',
    teamId: 'platform',
    activityLevel: 'low',
    milestone: false,
    mood: 'fixing',
  },

  // --- Milestone event (celebration: jump, particles, flag) ---
  {
    time: 52,
    type: 'summary_update',
    teamId: 'payments',
    activityLevel: 'high',
    milestone: true,
    mood: 'building',
  },

  // --- Session end (sprite walks off map) ---
  { time: 62, type: 'session_end', userId: 'jc', teamId: 'payments' },

  // --- Idle state (human goes idle after no events) ---
  { time: 68, type: 'idle', userId: 'christian' },

  // --- Activity resumes (idle resets) ---
  { time: 74, type: 'file_save', userId: 'christian', file: 'server/auth.ts' },

  // --- Wind down: activity drops ---
  {
    time: 84,
    type: 'summary_update',
    teamId: 'payments',
    activityLevel: 'steady',
    milestone: false,
    mood: 'exploring',
  },
  {
    time: 84,
    type: 'summary_update',
    teamId: 'platform',
    activityLevel: 'steady',
    milestone: false,
    mood: 'building',
  },
];
```

This cycle should loop. After the last event, pause 5 seconds, then reset all state and replay from the top. The other teams (platform, growth, infra) should have their own lighter background activity (occasional saves and commits from pre-placed sprites) so the map never looks dead — only the payments team needs the full choreographed sequence above.

**Note:** The event stream also includes `agent_spawn`, `agent_despawn`, and agent `file_save`/`commit` events in the full spec. Those are **deferred to Pass 2**. For this pass, agents from the existing static team data remain on the map with their current animations. The event stream here only drives human sprite behavior and fire/summary reactivity.

## 2. Campfire Reacts to Activity Level

The fire itself is the primary visual indicator of team energy:

- **`high`**: Fire roars tall (`fireHeight * 1.5`), more sparks with wider scatter, faster flicker rate, ground glow radius expands by 30%, more embers. The fire should feel aggressive and alive.
- **`steady`**: Current fire behavior (the default). Comfortable, warm, productive.
- **`low`**: Fire dims to embers. Fewer flames (reduce flame count by half), warm but small glow, slower flicker. Occasional single spark rises lazily. The fire is resting, not dead.

Transition between levels should be animated over ~1 second (gradual height/intensity interpolation), not instant.

## 3. Event-Driven Sprite Micro-Animations

Instead of generic shuffling, sprites react to their actual events from the activity feed. Each animation is 2-4 frames max, frame-based (not tweened):

- **`file_save`** → Sprite plays a 2-frame "hammering" animation (arm up / arm down) at their current position. Brief tiny spark at the "anvil point."
- **`commit`** → This is the highest-signal event. Sprite walks toward the campfire center, tosses something in (1 frame arm motion), fire briefly flares (`fireHeight * 1.2` for 0.3s). The commit message floats as tiny pixel text above the fire, drifting upward and fading over ~2 seconds. Use the Silkscreen font at small size.
- **`branch_switch`** → Sprite repositions to a different spot around the campfire ring. Walks along the stone ring path, doesn't teleport.
- **`session_start`** → Sprite walks in from the nearest map edge toward their campfire. Fades from 0 to full opacity over the walk.
- **`session_end`** → Sprite walks away from the campfire toward the nearest tree line, fades to 0 opacity, then is removed.
- **`draft_mode`** → A small tent object (3x5 pixel art, earth tones) is drawn. Sprite walks into it, tent flap closes (1 frame change). While in draft mode, only the tent is visible. Exiting draft mode reverses: flap opens, sprite walks out, tent disappears after a beat.

Queue animations so they don't overlap — if a sprite is mid-commit-walk and a save fires, the save animation plays after the commit finishes.

### Animation Queue Architecture

The current mockup uses static `task` assignments on sprites. This pass replaces that with:

- A **mutable sprite registry** (not the static `teams[].members` array) that tracks each sprite's current animation state, position, queued animations, and opacity.
- Each sprite has an `animationQueue: Animation[]` where each `Animation` has a type, duration, progress, and callback.
- The render loop advances each sprite's current animation by delta-time. When an animation completes, the next one in the queue starts.
- When the queue is empty, the sprite returns to its default task animation (smithing/scribing/mining based on deterministic index assignment, same as current).

## 4. Milestone Celebrations

When `milestone: true` in a summary update:

- All sprites at that campfire briefly jump (2px up, hold 2 frames, back down)
- Particle burst above the fire: 8-12 gold/white sparks that arc outward and upward in a fountain pattern, then fade over 1 second
- A small flag/banner (2x4 pixel art) plants next to the campfire. It persists until the next summary cycle replaces it. Use the team's color for the flag.
- Fire briefly shifts to gold/white for 0.5s before returning to team color

## 5. Ambient Org Pulse

Each campfire emits a subtle radial light pulse on a rhythm. The pulse is a faint expanding ring of the team's color at low opacity (8-12% alpha) that expands outward and fades.

- **`high` activity**: Pulse every 2 seconds, ring expands to `baseRadius * 3`
- **`steady` activity**: Pulse every 5 seconds, ring expands to `baseRadius * 2`
- **`low` activity**: Pulse every 10 seconds, ring expands to `baseRadius * 1.5`

When multiple campfires pulse, their rings can overlap — the overlapping areas get slightly brighter. This creates an emergent visual of org-wide energy flow.

## Architecture Notes

- The map consumes the same data as the text Reel: SSE summary stream + awareness state via REST
- Mock all data for now. The `mockSummaryData` and `mockEventStream` should demonstrate all visual states (high/steady/low fires, commits with messages, milestones, draft mode)
- **Single HTML file**. No separate CSS/JS files. Canvas rendering with the existing `requestAnimationFrame` loop.
- Sprite animations are frame-based (2-4 frames), not tweened/eased. Pixel art snaps between frames.
- All new visual elements must respect the existing `PIXEL_SCALE` constant and art style
- The existing `campfires-map-mockup.html` is the starting point — build on top of it, don't rewrite from scratch
- Use the Silkscreen pixel font (already loaded via Google Fonts in the mockup) for any text

## What NOT To Do

- No scrolling or zoom interaction
- No click-to-inspect interaction (hover tooltips are fine if simple)
- No separate files — everything in one HTML file
- No game engine or framework — keep the raw canvas + requestAnimationFrame pattern
- Don't refactor existing drawing functions unless a change is necessary for the new features
- No sound
- No WebGL — stick to 2D canvas context
- No golem enhancements or spawn/despawn — those are Pass 2

## Testing Checklist

When done, the following should be demonstrable by watching the map for 60-90 seconds:

- [ ] Mock event stream replays on a loop, resetting state after the cycle completes
- [ ] Campfires burn at different intensities based on activity level (high/steady/low)
- [ ] Activity level transitions animate smoothly (not instant jumps)
- [ ] A commit event shows a sprite walking to the fire, tossing something in, and commit text floating up
- [ ] A file_save event triggers a brief hammering animation on the sprite
- [ ] A branch_switch event shows a sprite walking to a new position around the ring
- [ ] A session_start shows a sprite walking in from the map edge with fade-in
- [ ] A session_end shows a sprite walking off toward the tree line with fade-out
- [ ] A draft mode toggle shows a sprite entering/exiting a tent
- [ ] A milestone celebration triggers with jumping sprites, particle burst, and flag
- [ ] Ambient pulses radiate from each campfire at different rates based on activity level
- [ ] Background teams have light ambient activity (not frozen)
- [ ] Existing static agents still render with their current animations (unchanged from mockup)
