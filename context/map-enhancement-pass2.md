# Campfires Map Enhancement — Pass 2: Golem Enhancements + Spark-to-Golem Spawn/Despawn

## Context

This is Pass 2 of 2. Pass 1 (`context/map-enhancement-pass1.md`) established the mock event system, animation queue, fire reactivity, sprite micro-animations, milestone celebrations, and ambient pulses. This pass builds on that foundation to add golem (agent) visual enhancements and the spark-to-golem spawn/despawn animation — the showpiece of the map.

The mockup file has already been updated by Pass 1. The animation queue, mutable sprite registry, and event stream infrastructure are in place. This pass extends them.

## 1. Golem (Agent) Visual Distinction

Golems must feel mechanically different from humans at a glance:

- **Speed**: Move 2x faster than human sprites in all animations (walking to fire for commits, repositioning, etc.)
- **Afterimage**: Draw the golem's previous position at 25% opacity, creating a subtle motion trail. Clear after 3 frames.
- **Activity glow**: A faint aura around the golem whose brightness scales with recent event rate. More events in the last 30s = brighter glow. Use a warm amber color, not the team color.
- **Idle behavior**: Golems do NOT sit down like humans. They stand still, eyes dim (reduce eye glow opacity to 30%), body darkens slightly. Like a construct in standby mode.
- **Carrying orb**: Golems carry a small glowing orb (2x2 pixels) that represents accumulated work. The orb starts tiny and dim on spawn, grows slightly brighter with each `file_save` event. On `commit`, the golem walks to the fire and "deposits" the orb (it merges into the flames, fire flares). Golem gets a new dim orb and continues.

## 2. Spark-to-Golem Agent Spawning (THE KEY ANIMATION)

Agents are NOT placed on the map. They are **born from the campfire**. The fire is the forge.

**Spawning sequence (~2.5 seconds total):**

1. **SPARK DETACH** (~0.5s): One of the campfire's existing ambient sparks behaves differently — instead of arcing upward and fading, it rises higher than normal, holds position above the fire, and grows brighter. It pulses 2-3 times, growing from 1px to 3px. The other ambient sparks continue normally so the special spark stands out.

2. **CASTING** (~0.3s): The human sprite who spawned the agent turns to face the campfire and raises one arm (1 frame pose change, held for 0.3s). A faint line of tiny particles connects the human's raised hand to the hovering spark, like they're directing energy into it.

3. **SPARK DESCENT** (~0.3s): The bright spark arcs downward from its hover point to an open position on the ground near the fire's edge. On impact: brief white/gold flash (a 5px radius circle at full brightness for 1 frame, then gone).

4. **FORMATION** (~1.0s): At the impact point, the spark expands over 3-4 frames into the golem silhouette. Start fully bright white/gold, then transition through the team color to the golem's final muted color palette. Think molten material cooling into solid form. Small particles shed outward during the transition like cooling sparks.

5. **ACTIVATION** (~0.3s): Golem snaps to full form. Eyes glow on (bright amber, 2 frames: dim → full). Golem immediately begins working. The carrying orb appears as a tiny dim point.

**Despawning sequence (when agent task completes):**

1. Golem stops current animation, turns toward campfire
2. Walks to the fire's edge (at 2x speed, it's eager to return)
3. Dissolves over 3 frames — reverse of formation. Shape breaks apart into bright particles that drift upward and inward toward the fire
4. Particles merge back into the campfire's ambient spark cycle (they become normal sparks)
5. Fire briefly flares (`fireHeight * 1.3` for 0.5s) as it reabsorbs the energy. A satisfying visual "gulp."

**Multiple spawns**: If several agents spawn in rapid succession, stagger the spark detach by 0.5s each so you see a rapid pop-pop-pop of sparks transforming. Don't batch them.

**Implementation**: Create a `spawnGolem(teamId, humanSpriteId)` function and a `despawnGolem(golemSpriteId)` function. Store active spawn/despawn animations in a `pendingAnimations` array with per-frame progress tracking. Add a test button or keyboard shortcut (press `S` to spawn, `D` to despawn) for development.

## 3. Extended Mock Event Stream

Add the following events to the existing mock event stream from Pass 1. These should be spliced into the existing timeline:

```typescript
// --- Agent spawning (spark-to-golem sequence) ---
{ time: 18,   type: "agent_spawn",    userId: "christian", agentId: "golem-1", teamId: "payments" },

// --- Agent working (golem file saves, orb grows) ---
{ time: 21,   type: "file_save",      userId: "golem-1",   file: "server/summarizer.ts", userType: "agent" },
{ time: 23,   type: "file_save",      userId: "golem-1",   file: "server/summarizer.ts", userType: "agent" },
{ time: 25,   type: "file_save",      userId: "golem-1",   file: "server/batch-job.ts",  userType: "agent" },

// --- Agent commit (golem deposits orb, fire flares) ---
{ time: 32,   type: "commit",         userId: "golem-1",   message: "wire up batch summarizer", userType: "agent" },

// --- Multiple rapid agent spawns (staggered pop-pop-pop) ---
{ time: 40,   type: "agent_spawn",    userId: "christian", agentId: "golem-2", teamId: "payments" },
{ time: 40.5, type: "agent_spawn",    userId: "christian", agentId: "golem-3", teamId: "payments" },

// --- Agent despawn (golem dissolves back into fire) ---
{ time: 56,   type: "agent_despawn",  agentId: "golem-1",  teamId: "payments" },

// --- Remaining agents despawn ---
{ time: 78,   type: "agent_despawn",  agentId: "golem-2",  teamId: "payments" },
{ time: 80,   type: "agent_despawn",  agentId: "golem-3",  teamId: "payments" },
```

These events drive:
- The full 5-step spawn animation for golem-1 at t=18
- Golem orb growing via file_save events at t=21, 23, 25
- Golem orb deposit + fire flare on commit at t=32
- Staggered rapid spawns at t=40/40.5
- Despawn dissolve-back-to-fire at t=56, 78, 80

The existing static agents from the team data should be **removed** — all golems now spawn dynamically via events. At loop reset, all golems are cleared.

## Architecture Notes

- Build on top of the Pass 1 mockup — the animation queue, sprite registry, and event stream are already in place
- **Single HTML file**. No separate CSS/JS files.
- Sprite animations are frame-based (2-4 frames), not tweened/eased. Pixel art snaps between frames.
- All new visual elements must respect the existing `PIXEL_SCALE` constant and art style
- Use the Silkscreen pixel font for any text
- The `S` and `D` keyboard shortcuts for manual spawn/despawn testing should remain in the final file (useful for demos)

## What NOT To Do

- No scrolling or zoom interaction
- No separate files — everything in one HTML file
- No game engine or framework — keep the raw canvas + requestAnimationFrame pattern
- Don't refactor Pass 1 code unless a change is necessary for the new features
- No sound
- No WebGL — stick to 2D canvas context

## Testing Checklist

When done, the following should be demonstrable by watching the map for 60-90 seconds:

- [ ] At least one golem spawns from a spark with the full 5-step sequence (detach, casting, descent, formation, activation)
- [ ] The human "casting" pose is visible during spawn — arm raised, particle line to spark
- [ ] A golem despawns and dissolves back into the fire with a brief flare
- [ ] Multiple agent spawns stagger visually (pop-pop-pop, not simultaneous)
- [ ] Golems move 2x faster than humans in all walking animations
- [ ] Golems have a visible afterimage trail when moving
- [ ] Golems carry a glowing orb that grows brighter with file_save events
- [ ] On golem commit, the orb is deposited into the fire (merges + flare)
- [ ] Golem idle state shows standing with dimmed eyes (not sitting like humans)
- [ ] Activity glow around golems scales with recent event frequency
- [ ] Pressing `S` manually triggers a spawn, pressing `D` triggers a despawn
- [ ] All Pass 1 features still work correctly (fire reactivity, human animations, milestones, pulses)
- [ ] Static agents from team data are replaced by dynamic spawn-based golems
