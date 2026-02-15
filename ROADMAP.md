# Campfires Roadmap

Current status as of the latest update to this file. Update this doc when work starts, finishes, or plans change.

---

## Phase 1: Prototype (Complete)

Sprints 1-6 built the v1 prototype with three clients: VS Code Extension, Terminal CLI, and Web App. This validated the core data pipeline and real-time coordination concepts. The extension and CLI are now legacy — the Claude Code Plugin replaces them as the primary data source.

---

## Sprint 1: Core Server + Shared Types

The foundation everything else builds on.

| Feature                                   | Status | Owner | Notes                                     |
| ----------------------------------------- | ------ | ----- | ----------------------------------------- |
| Server: WebSocket + Yjs rooms             | Done   | —     | `server/src/ws-server.ts`                 |
| Server: REST API (auth, teams, summaries) | Done   | —     | `server/src/api.ts`, `server/src/auth.ts` |
| Server: SQLite persistence                | Done   | —     | `server/src/persistence.ts`               |
| Shared types                              | Done   | —     | `shared/src/types.ts`                     |

## Sprint 2: Campfire Watch CLI

Terminal-native awareness for Claude Code and terminal workflows.

| Feature                                 | Status | Owner | Notes                                                                            |
| --------------------------------------- | ------ | ----- | -------------------------------------------------------------------------------- |
| CLI: entry point + auth                 | Done   | —     | `cli/src/index.ts`, `cli/src/auth.ts`                                            |
| CLI: three-tier terminal renderer       | Done   | —     | `cli/src/renderer.ts`, ANSI + alt screen buffer                                  |
| CLI: agent activity via git hooks       | Done   | —     | `post-commit`, `post-checkout` in `.git/hooks/`, config in `.git/campfires.json` |
| CLI: filesystem watcher for agent saves | Done   | —     | Routes file saves through agent identity when agent is active                    |

## Sprint 3: Campfire Stories (Web App)

AI-summarized org-wide view for non-dev stakeholders.

| Feature                                            | Status | Owner | Notes                                                                                              |
| -------------------------------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------- |
| Campfire Stories: web app shell                    | Done   | —     | Vite + vanilla TS, `campfire-stories/index.html`, `campfire-stories/src/main.ts`                   |
| Campfire Stories: summary feed UI                  | Done   | —     | Team cards grouped by recency, SSE live updates, `campfire-stories/src/components/summary-feed.ts` |
| Campfire Stories: team detail drill-down           | Done   | —     | Members, full summary, recent activity, `campfire-stories/src/components/detail-view.ts`           |
| Server: AI summarization batch job                 | Done   | —     | Stubbed `generateSummary()` in `server/src/summarizer.ts`, pluggable for real Claude API           |
| Server: org context ingestion                      | Done   | —     | Mission, roadmap, team descriptions passed to summarizer                                           |
| Server: SSE for summary stream                     | Done   | —     | `GET /orgs/:id/summaries/stream`, intervals in CONFIG                                              |
| Shared: `oneLiner` on Summary                      | Done   | —     | Added to types + persistence for compact card display                                              |
| Server: read endpoints opened for Campfire Stories | Done   | —     | `GET /orgs/:id`, `/orgs/:id/teams`, `/teams/:id/members` use optional auth                         |

## Sprint 4: Campfire Stories Map View — RPG-Style Graphical Interface

2D pixel-art map view as an alternative rendering mode for PMs and non-dev stakeholders. Same data pipeline, same SSE stream, same access controls — canvas-based rendering layer on top of the existing Campfire Stories app.

**Core concept:** Each team is a campfire on the map. Fire size/intensity reflects activity level. Human users are small sprites with task animations (smithing, scribing, mining). Agent sprites are visually distinct (blockier, glowing eyes) and color-matched to their human owner. Status maps to animation: active = working, idle = sitting with zzz, draft = inside tent, offline = absent.

**Tech approach:** Pure HTML5 canvas with pixel-art rendering, y-sorted depth, auto-layout. Feed/Map toggle in shared header. Awareness polling via REST endpoint every 10s.

| Feature                                 | Status | Owner | Notes                                                                                                                            |
| --------------------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| Campfire Stories: shared header         | Done   | —     | `campfire-stories/src/components/header.ts`, Press Start 2P + Silkscreen fonts. Feed/Map toggle removed in Sprint 10 (map-only). |
| Map: canvas renderer + campfire sprites | Done   | —     | 3 intensity levels from event count, `campfire-stories/src/map/renderer.ts`                                                      |
| Map: human user sprites + animations    | Done   | —     | smithing/scribing/mining + idle/zzz + draft/tent, `campfire-stories/src/map/sprites.ts`                                          |
| Map: agent/golem sprites                | Done   | —     | Blockier body, glowing eyes, color-matched to parent, `campfire-stories/src/map/sprites.ts`                                      |
| Map: environmental art                  | Done   | —     | Trees, paths, woodpiles, barrels, crates, torches, `campfire-stories/src/map/environment.ts`                                     |
| Map: zoomed-out org view                | Done   | —     | Elliptical auto-layout, AI summary one-liners overlay, `campfire-stories/src/map/layout.ts`                                      |
| Map: hover tooltips                     | Done   | —     | Hit detection on sprites, name/role/team/file tooltip                                                                            |
| Server: awareness REST endpoint         | Done   | —     | `GET /api/teams/:id/awareness`, reads Yjs awareness state                                                                        |
| Mockup: `campfires-map-mockup.html`     | Done   | —     | Visual direction established                                                                                                     |

**Deferred from Sprint 4:** Ambient display mode (TV in office), sprite customization. _(Zoom/scroll and day/night cycle were implemented in Sprint 10.)_

## Sprint 4b: Map Enhancement — Event-Driven Animations & Golem Spawning

Two-pass enhancement to the map mockup (`active-product-development-context/campfires-map-mockup.html`), making the map reactive to events and adding the signature spark-to-golem spawn animation. Specs in `active-product-development-context/map-enhancement-pass1.md` and `active-product-development-context/map-enhancement-pass2.md`.

**Pass 1 — Event System, Fire Reactivity, Sprite Animations:**

| Feature                                             | Status | Owner | Notes                                                                                |
| --------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------ |
| Mock event stream with looping ~90s cycle           | Done   | —     | Drives all sprite behavior, resets after 5s pause                                    |
| Campfire reacts to activity level (high/steady/low) | Done   | —     | Fire height, spark count, flicker rate, glow radius — smooth 1s transitions          |
| Event-driven sprite micro-animations                | Done   | —     | file_save → strike, commit → walk + toss + floating text, branch_switch → reposition |
| Session start/end (walk in from edge / walk off)    | Done   | —     | Fade in/out opacity during walk                                                      |
| Draft mode (enter/exit tent)                        | Done   | —     | Tent drawn at sprite position, flap open/close animation                             |
| Animation queue per sprite                          | Done   | —     | FIFO queue with onStart/onComplete callbacks, no overlapping animations              |
| Mutable sprite registry                             | Done   | —     | Replaces static team member arrays for animation state tracking                      |
| Milestone celebrations                              | Done   | —     | Jumping sprites, gold/white particle burst, team-color flag, fire shifts to gold     |
| Ambient org pulse                                   | Done   | —     | Radial light rings at intervals based on activity level (2s/5s/10s)                  |
| Background team activity                            | Done   | —     | Other teams have ambient file_save/commit events so the map is never frozen          |

**Pass 2 — Golem Enhancements & Spark-to-Golem Spawn/Despawn:**

| Feature                                        | Status | Owner | Notes                                                                              |
| ---------------------------------------------- | ------ | ----- | ---------------------------------------------------------------------------------- |
| Spark-to-golem spawn animation (5 phases)      | Done   | —     | Spark detach → casting → descent → formation → activation (~2.5s total)            |
| Human casting pose during spawn                | Done   | —     | Arm raised, particle line connecting hand to spark                                 |
| Golem despawn (dissolve back into fire)        | Done   | —     | Walk to fire at 2x, dissolve to particles, fire flares 1.3x                        |
| Staggered multi-spawn                          | Done   | —     | Multiple spawns offset by 0.5s for pop-pop-pop effect                              |
| Golem 2x movement speed                        | Done   | —     | All walk animations run at double speed                                            |
| Golem afterimage trail                         | Done   | —     | Previous position at 25% opacity during movement                                   |
| Golem activity glow                            | Done   | —     | Warm amber aura scaling with recent event frequency (30s window)                   |
| Golem carrying orb                             | Done   | —     | Glowing orb grows brighter with file_saves, deposits into fire on commit           |
| Golem idle standby                             | Done   | —     | Standing still, dimmed eyes (30% opacity), darkened body — not sitting like humans |
| Dynamic golem spawning (static agents removed) | Done   | —     | All golems spawn via agent_spawn events, cleared on cycle reset                    |
| S/D keyboard shortcuts                         | Done   | —     | Manual spawn/despawn for development and demos                                     |

## Sprint 5: Campfires IDE (VS Code Extension)

Build fixes, esbuild bundling, CSP, and configuration — extension compiles and runs.

| Feature                           | Status | Owner | Notes                                                          |
| --------------------------------- | ------ | ----- | -------------------------------------------------------------- |
| Extension: activation + auth flow | Done   | —     | `extension/src/extension.ts`                                   |
| Extension: awareness provider     | Done   | —     | Captures file, function, saves, commits; uses CONFIG constants |
| Extension: campfire sidebar panel | Done   | —     | Webview with CSP and live activity stream                      |
| Extension: editor decorations     | Done   | —     | Gutter badges for teammate presence                            |
| Extension: status bar             | Done   | —     | Active count, draft toggle, connection                         |
| Extension: draft mode             | Done   | —     | One-toggle privacy                                             |
| Extension: idle detection         | Done   | —     | 5-min timer                                                    |
| Extension: git watcher            | Done   | —     | Commits + branch switches                                      |

## Sprint 6: Cross-Team Observation & Campfire Visits

Let people see into other campfires and temporarily visit them. The Map View already shows all campfires in the org — this sprint makes them interactive. Click a campfire to see who's there, what they're working on (via AI summary), and optionally join as a visitor.

**Core concept:** You're at your campfire and you see a big fire burning across the map. You walk over, peek in, see what's happening, and maybe sit down for a while. Visitors see the same awareness and activity feed as members but don't broadcast their own activity into that campfire.

| Feature                                                     | Status | Owner | Notes                                                                                     |
| ----------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------- |
| Map: click campfire to show stories panel                   | Done   | —     | Persistent bottom-right panel with AI summary, member list, status dots, Home button      |
| Campfire Stories: campfire detail as entry point for visits | Done   | —     | Existing detail drill-down gains a "Visit this campfire" action                           |
| Server: cross-team read access for visitors                 | Done   | —     | Read-only awareness + activity for any team in your org                                   |
| Server: visitor presence (lightweight)                      | Done   | —     | Visitors appear in awareness with a distinct `visitor` status, don't emit activity events |
| Extension: visit campfire command                           | Done   | —     | Switch sidebar to observe a different team's campfire temporarily                         |
| CLI: visit campfire flag                                    | Done   | —     | `campfire watch --visit <teamId>` to observe another team                                 |

---

## Phase 2: Claude Code Plugin + AI Summarization

The architectural pivot. Claude Code Plugin replaces the VS Code Extension and CLI as the primary data source. Session transcripts become the primary input to AI summarization, producing richer business-legible summaries.

---

## Sprint 7: Claude Code Plugin (Source Layer)

The plugin captures developer activity ambiently via Claude Code hooks and uploads session transcripts incrementally when sharing is enabled. Implemented in `campfires-plugin/` using bash scripts (jq + curl), config at `~/.campfires/config.json`.

| Feature                                         | Status | Owner | Notes                                                                                 |
| ----------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------- |
| Plugin: session lifecycle (start/end)           | Done   | —     | SessionStart/SessionEnd hooks, heartbeat on UserPromptSubmit, stale cleanup at 10m    |
| Plugin: Share toggle (full/heartbeat/off)       | Done   | —     | `/share` command cycles modes, scripts exit silently when off                         |
| Plugin: incremental transcript upload           | Done   | —     | Byte-offset delta streaming via `/api/sessions/transcript-delta`, 500KB max per delta |
| Plugin: git event detection (commits, branches) | Done   | —     | PostToolUse hook on Bash/Write/Edit, detects git commit/checkout/switch + file saves  |
| Server: session + transcript endpoints          | Done   | —     | `/api/sessions/start`, `/heartbeat`, `/end`, `/transcript-delta`, `/api/activity`     |
| Shared: SessionTranscript type                  | Done   | —     | `shared/src/types.ts` — sessionId, content, isComplete, repo, branch                  |

## Sprint 4c: Map Mockup — Logs Panel & UI Cleanup

Iterative pass on the map mockup (`active-product-development-context/campfires-map-mockup.html`). Added the Logs panel (team detail) concept and cleaned up unused UI elements.

| Feature                                                  | Status | Owner | Notes                                                                     |
| -------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------- |
| Mockup: remove legend panel                              | Done   | —     | Legend was unnecessary clutter, removed HTML + CSS                        |
| Mockup: remove orphaned minimap CSS                      | Done   | —     | CSS rules existed with no corresponding HTML element                      |
| Mockup: rename FIRESIDE → CAMPFIRE STORIES               | Done   | —     | Org-wide summary panel in top-right                                       |
| Mockup: add "Logs — Payments" panel                      | Done   | —     | Bottom-right panel with detailed, multi-line team updates over 90s loop   |
| Mockup: story_update events in simulation timeline       | Done   | —     | 6 narrative entries for Payments team spread across the cycle             |
| Mockup: handleStoryUpdate() with fade-in + max 4 entries | Done   | —     | Prepend with relative timestamps, oldest fades out, clears on cycle reset |

## Sprint 8: AI Summarizer (Intelligence Layer)

Replace the stubbed summarizer with real Claude API integration. Transcripts provide much richer context than raw file events.

| Feature                                                       | Status | Owner | Notes                                                                              |
| ------------------------------------------------------------- | ------ | ----- | ---------------------------------------------------------------------------------- |
| Server: Claude API integration replacing stub                 | Done   | —     | `server/src/summarizer.ts`, Claude API wired up                                    |
| Server: transcript → summary pipeline                         | Done   | —     | `preprocessTranscript()` strips noise, display names in headers                    |
| Server: summary quality tuning                                | Done   | —     | Plain-text prompt, narrative voice, smart chunking for long sessions               |
| Campfire Stories: Campfire Stories panel (org-wide summaries) | Done   | —     | Restyled summary feed to pixel-art aesthetic with CAMPFIRE STORIES branding        |
| Campfire Stories: Logs panel (team detail)                    | Done   | —     | Narrative log entries from activity events, pixel-art restyled detail view         |
| Campfire Stories: richer summary cards from transcript data   | Done   | —     | Content preview on feed cards, one-liner headline in detail view, plain-text stubs |

## Sprint 9: Integration & Polish

End-to-end flow: Claude Code Plugin → Server → AI Summarizer → Campfire Stories. Driven by real usage and dogfooding.

| Feature                                            | Status | Owner | Notes                                                        |
| -------------------------------------------------- | ------ | ----- | ------------------------------------------------------------ |
| End-to-end plugin → server → campfire-stories flow | Done   | —     | Static serving, SPA fallback, sessionId threading            |
| Zero-config onboarding experience                  | Done   | —     | Login command handles signup + auto-provision org/team       |
| Deprecate extension + CLI as primary inputs        | Done   | —     | Removed from workspaces + build pipeline, kept for reference |

## Sprint 10: Map Enhancements — Camera Controls, Day/Night Cycle, Map-Only View

Interactive camera controls, ambient day/night lighting, and removal of the Feed view in favor of a map-only experience. The Campfire Stories panel (org-wide summaries) provides the text summaries previously shown in the Feed.

| Feature                                       | Status | Owner | Notes                                                                                     |
| --------------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------- |
| Map: zoom/pan camera system                   | Done   | —     | `campfire-stories/src/map/camera.ts` — mouse wheel zoom toward cursor, click-drag pan     |
| Map: camera bounds clamping                   | Done   | —     | Viewport stays within world edges at all zoom levels                                      |
| Map: Reset View button                        | Done   | —     | Smooth lerp animation back to center/zoom 1.0, styled top-left overlay                    |
| Map: day/night cycle (120s period)            | Done   | —     | Night/dawn/day/dusk phases, ambient color overlay, `campfire-stories/src/map/renderer.ts` |
| Map: campfire glow scales with time of day    | Done   | —     | `glowMultiplier` on `drawCampfire` — 2x glow at night, 1x during day                      |
| Map: twinkling stars at night                 | Done   | —     | 60 deterministic stars in upper 40%, visible during night/dusk phases                     |
| Map: world-space ground rendering             | Done   | —     | `drawGround` uses world dimensions for correct rendering under camera transform           |
| Map: hit-testing works at all zoom/pan levels | Done   | —     | `screenToWorld()` conversion for tooltips and campfire clicks                             |
| Map: keyboard controls                        | Done   | —     | Arrow keys pan, +/- zoom, Home resets view                                                |
| Map: smooth zoom with easing                  | Done   | —     | Target-based zoom with per-frame lerp, anchor point preserved under cursor                |
| Remove Feed view, map-only experience         | Done   | —     | Feed/Map toggle removed from header, app defaults to map view                             |

## Sprint 11: Security Hardening

Holistic security review and hardening pass across server, plugin, and client. No new features — focused on closing gaps identified in a full-stack security audit.

**Explicitly deferred from this sprint:** password complexity rules, RBAC, SQLite encryption, CSP tightening, legacy SHA256 migration removal.

| Feature                                     | Status | Owner | Notes                                                                                                                                                  |
| ------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server: tiered API rate limiting            | Done   | —     | 60 req/min authenticated, 10 req/min unauthenticated via `express-rate-limit`. `/health` exempt. `authLimiter` applied to `/auth/refresh`              |
| Server: single-use WebSocket upgrade tokens | Done   | —     | `POST /auth/ws-token` returns 30s opaque token (Map + TTL cleanup). `ws-server.ts` consumes on connect. JWT no longer in query string                  |
| Server: CORS origin allowlist               | Done   | —     | `ALLOWED_ORIGINS` env var (comma-separated, trimmed). Defaults to localhost for dev. Documented in `.env.example`                                      |
| Plugin: config file permission enforcement  | Done   | —     | `chmod 600` on `~/.campfires/config.json` in login command, share command, and config.sh loader                                                        |
| Server: structured audit logging            | Done   | —     | `server/src/audit-log.ts` — JSON to stdout for auth failures, authorization denials, rate limit hits. Wired into auth middleware and all 403 responses |
| Server: prompt injection defenses           | Done   | —     | Control character stripping + 2000 char cap on org mission, roadmap, and team description via Zod transform. These fields flow into Claude API prompts |

## Sprint 12: Sparks — Cross-Team Intelligence Layer

AI-powered cross-team connection detection. After each batch summarization cycle, a second Claude API call analyzes all team summaries together and surfaces "Sparks" — brief, high-signal connections between campfires. Full spec in `active-product-development-context/sprint-12-sparks.md`.

**Core concept:** Sparks are precious, not noisy. Max 1 per campfire per 24h. They appear as an animated arc on the map, a momentary stories entry, and persistent badges on connected campfires. Dismissed sparks are preserved in a searchable log.

| Feature                                                 | Status      | Owner | Notes                                                                                            |
| ------------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------ |
| Shared: Spark + SparkTeamConnection types               | Done        | —     | `shared/src/types.ts` — Spark, SparkTeamConnection                                               |
| Server: sparks table + persistence methods              | Not started | —     | `server/src/persistence.ts` — CRUD, dedup queries, expiration                                    |
| Server: spark detection prompt                          | Not started | —     | `server/src/summarizer.ts` — second Claude API call after team summaries                         |
| Server: spark rate limiter                              | Not started | —     | 1 spark/campfire/24h, select highest confidence when over limit                                  |
| Server: spark deduplication                             | Not started | —     | Content hash + active spark check before creation                                                |
| Server: spark expiration                                | Not started | —     | 72h TTL, check-on-read or background cleanup                                                     |
| Server: spark API endpoints                             | Not started | —     | GET sparks, GET log, POST dismiss, POST view                                                     |
| Server: SSE spark events                                | Not started | —     | Extend existing summary stream with spark event type                                             |
| Campfire Stories: map arc animation                     | Not started | —     | Bezier particle arc between campfires, plays once on new spark                                   |
| Campfire Stories: persistent spark badge on campfires   | Not started | —     | Amber lightning badge on campfires with active sparks                                            |
| Campfire Stories: momentary spark in stories panel      | Not started | —     | 15s fade-out spark notification in Campfire Stories panel (org-wide summaries)                   |
| Campfire Stories: campfire detail spark section         | Not started | —     | Persistent spark display in Logs panel, with dismiss, view tracking, visit prompt                |
| Campfire Stories: spark log                             | Not started | —     | Historical log in Campfire Stories panel (org-wide summaries), all statuses, scrollable          |
| Mockup: spark arc + badge + stories entry in simulation | Done        | —     | 2 spark events in 90s loop (Payments↔Platform t=35, Growth↔Infra t=65), amber #fbbf24 throughout |

## Sprint 13: Campfire Lifecycle — Cold Firepits, Kindle Animation & Founder Ceremony

Full campfire lifecycle: firepits persist on the map even when nobody's around. Offline teams show cold firepits with stone rings and charred logs. Fire intensity is now 4-tier (cold/kindled/steady/roaring) based on online member count + activity. New teams get a founder pig ceremony. Map positions are persisted in SQLite.

| Feature                                               | Status | Owner | Notes                                                                                                    |
| ----------------------------------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------------- |
| Shared: Team mapX/mapY/firstSeenAt fields             | Done   | —     | `shared/src/types.ts` — FireTier type, GRACE_PERIOD_MS + DECAY_DURATION_MS in CONFIG                     |
| Server: teams table migration + position methods      | Done   | —     | `server/src/persistence.ts` — mapX/mapY/firstSeenAt columns, updateTeamPosition, setTeamFirstSeen        |
| Server: auto-layout migration + SSE team_registered   | Done   | —     | `server/src/api.ts` — position calc on GET teams + POST teams, broadcastOrgEvent for new teams           |
| Map: persisted layout + gap-finding                   | Done   | —     | `campfire-stories/src/map/layout.ts` — uses persisted positions, findGapPosition for new teams           |
| Map: 4-tier fire system (cold/kindled/steady/roaring) | Done   | —     | `animation-constants.ts` + `fire-state.ts` — member count drives cold/kindled, events drive higher tiers |
| Map: cold firepit rendering                           | Done   | —     | `renderer.ts` — drawColdFirepit with stone ring, charred logs, smoke wisp, night ember glow              |
| Map: kindle animation (spark→catch→grow)              | Done   | —     | `renderer.ts` — drawKindleAnimation, stagger queue in index.ts                                           |
| Map: founder pig ceremony                             | Done   | —     | `sprites.ts` — drawFounderPig with hard hat, 4-phase ceremony (entrance/building/lighting/exit)          |
| Map: offline decay with grace period                  | Done   | —     | `index.ts` — 5min grace keeps kindled minimum, 60s decay interpolates multipliers to cold, spawns tools  |
| Campfire Stories: team_registered SSE handling        | Done   | —     | `main.ts` — adds team to state, triggers founder ceremony on map                                         |

## Not Yet Planned

These are explicitly deferred. Don't build them yet.

- Co-editing / shared cursors (not the differentiator)
- AI merge/conflict detection (needs mature activity log)
- Self-hosted / enterprise (cloud-first)
- Campfire Stories notifications / follow
- Daily digest emails
- Agent identity config (naming, colors)
- Map View: touch support (pinch-to-zoom, touch-drag) — low priority
- Map View: ambient display mode (TV in the office)
- Map View: sprite customization
- Map View: ambient sound (campfire crackling, proximity-based)
- ~~Map View: campfire detail side panel redesign~~ — Done (replaced centered overlay with persistent bottom-right stories panel)

## How to Use This Doc

- **Claiming work:** Put your name in the Owner column before starting. Check for conflicts first.
- **Updating status:** Use `Not started`, `Scaffolded`, `In progress`, `Done`.
- **Adding work:** Add rows to the appropriate sprint table. If it doesn't fit a sprint, add it to "Not in MVP" with a rationale.
- **Decisions:** If you make an architectural decision that affects others, note it here or in CONTRIBUTING.md.
