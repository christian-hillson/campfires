# Campfires Roadmap

Current status as of the latest update to this file. Update this doc when work starts, finishes, or plans change.

## Sprint 1: Core Server + Shared Types

The foundation everything else builds on.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Server: WebSocket + Yjs rooms | Done | — | `server/src/ws-server.ts` |
| Server: REST API (auth, teams, summaries) | Done | — | `server/src/api.ts`, `server/src/auth.ts` |
| Server: SQLite persistence | Done | — | `server/src/persistence.ts` |
| Shared types | Done | — | `shared/src/types.ts` |

## Sprint 2: Campfire Watch CLI

Terminal-native awareness for Claude Code and terminal workflows.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| CLI: entry point + auth | Done | — | `cli/src/index.ts`, `cli/src/auth.ts` |
| CLI: three-tier terminal renderer | Done | — | `cli/src/renderer.ts`, ANSI + alt screen buffer |
| CLI: agent activity via git hooks | Done | — | `post-commit`, `post-checkout` in `.git/hooks/`, config in `.git/campfires.json` |
| CLI: filesystem watcher for agent saves | Done | — | Routes file saves through agent identity when agent is active |

## Sprint 3: Campfires Reel (Web App)

AI-summarized org-wide view for non-dev stakeholders.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Reel: web app shell | Done | — | Vite + vanilla TS, `reel/index.html`, `reel/src/main.ts` |
| Reel: summary feed UI | Done | — | Team cards grouped by recency, SSE live updates, `reel/src/components/summary-feed.ts` |
| Reel: team detail drill-down | Done | — | Members, full summary, recent activity, `reel/src/components/detail-view.ts` |
| Server: AI summarization batch job | Done | — | Stubbed `generateSummary()` in `server/src/summarizer.ts`, pluggable for real Claude API |
| Server: org context ingestion | Done | — | Mission, roadmap, team descriptions passed to summarizer |
| Server: SSE for summary stream | Done | — | `GET /orgs/:id/summaries/stream`, intervals in CONFIG |
| Shared: `oneLiner` on Summary | Done | — | Added to types + persistence for compact card display |
| Server: read endpoints opened for Reel | Done | — | `GET /orgs/:id`, `/orgs/:id/teams`, `/teams/:id/members` use optional auth |

## Sprint 4: Reel Map View — RPG-Style Graphical Interface

2D pixel-art map view as an alternative rendering mode for PMs and non-dev stakeholders. Same data pipeline, same SSE stream, same access controls — canvas-based rendering layer on top of the existing Reel.

**Core concept:** Each team is a campfire on the map. Fire size/intensity reflects activity level. Human users are small sprites with task animations (smithing, scribing, mining). Agent sprites are visually distinct (blockier, glowing eyes) and color-matched to their human owner. Status maps to animation: active = working, idle = sitting with zzz, draft = inside tent, offline = absent.

**Tech approach:** Pure HTML5 canvas with pixel-art rendering, y-sorted depth, auto-layout. Feed/Map toggle in shared header. Awareness polling via REST endpoint every 10s.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Reel: Feed/Map toggle + shared header | Done | — | `reel/src/components/header.ts`, Press Start 2P + Silkscreen fonts |
| Map: canvas renderer + campfire sprites | Done | — | 3 intensity levels from event count, `reel/src/map/renderer.ts` |
| Map: human user sprites + animations | Done | — | smithing/scribing/mining + idle/zzz + draft/tent, `reel/src/map/sprites.ts` |
| Map: agent/golem sprites | Done | — | Blockier body, glowing eyes, color-matched to parent, `reel/src/map/sprites.ts` |
| Map: environmental art | Done | — | Trees, paths, woodpiles, barrels, crates, torches, `reel/src/map/environment.ts` |
| Map: zoomed-out org view | Done | — | Elliptical auto-layout, AI summary one-liners overlay, `reel/src/map/layout.ts` |
| Map: hover tooltips | Done | — | Hit detection on sprites, name/role/team/file tooltip |
| Server: awareness REST endpoint | Done | — | `GET /api/teams/:id/awareness`, reads Yjs awareness state |
| Mockup: `campfires-map-mockup.html` | Done | — | Visual direction established |

**Deferred from Sprint 4:** Zoom/scroll interaction, ambient display mode (TV in office), sprite customization, day/night cycle.

## Sprint 5: Campfires IDE (VS Code Extension)

Build fixes, esbuild bundling, CSP, and configuration — extension compiles and runs.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Extension: activation + auth flow | Done | — | `extension/src/extension.ts` |
| Extension: awareness provider | Done | — | Captures file, function, saves, commits; uses CONFIG constants |
| Extension: campfire sidebar panel | Done | — | Webview with CSP and live activity stream |
| Extension: editor decorations | Done | — | Gutter badges for teammate presence |
| Extension: status bar | Done | — | Active count, draft toggle, connection |
| Extension: draft mode | Done | — | One-toggle privacy |
| Extension: idle detection | Done | — | 5-min timer |
| Extension: git watcher | Done | — | Commits + branch switches |

## Sprint 6: Polish

Iterate based on dogfooding. No fixed feature list — driven by real usage.

## Sprint 7: Cross-Team Observation & Campfire Visits

Let people see into other campfires and temporarily visit them. The Map View already shows all campfires in the org — this sprint makes them interactive. Click a campfire to see who's there, what they're working on (via AI summary), and optionally join as a visitor.

**Core concept:** You're at your campfire and you see a big fire burning across the map. You walk over, peek in, see what's happening, and maybe sit down for a while. Visitors see the same awareness and activity feed as members but don't broadcast their own activity into that campfire.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Map: click campfire to open detail overlay | Not started | — | Team name, AI summary, member list with statuses, headcount |
| Reel: campfire detail as entry point for visits | Not started | — | Existing detail drill-down gains a "Visit this campfire" action |
| Server: cross-team read access for visitors | Not started | — | Read-only awareness + activity for any team in your org |
| Server: visitor presence (lightweight) | Not started | — | Visitors appear in awareness with a distinct `visitor` status, don't emit activity events |
| Extension: visit campfire command | Not started | — | Switch sidebar to observe a different team's campfire temporarily |
| CLI: visit campfire flag | Not started | — | `campfire watch --visit <teamId>` to observe another team |

## Not in MVP

These are explicitly deferred. Don't build them yet.

- Co-editing / shared cursors (not the differentiator)
- AI merge/conflict detection (needs mature activity log)
- Self-hosted / enterprise (cloud-first)
- Reel notifications / follow
- Daily digest emails
- Graphical TUI for CLI
- Interactive CLI commands
- Agent identity config (naming, colors)
- Map View: zoom/scroll interaction (add if needed, Phaser.js)
- Map View: ambient display mode (TV in the office)
- Map View: sprite customization
- Map View: day/night cycle

## How to Use This Doc

- **Claiming work:** Put your name in the Owner column before starting. Check for conflicts first.
- **Updating status:** Use `Not started`, `Scaffolded`, `In progress`, `Done`.
- **Adding work:** Add rows to the appropriate sprint table. If it doesn't fit a sprint, add it to "Not in MVP" with a rationale.
- **Decisions:** If you make an architectural decision that affects others, note it here or in CONTRIBUTING.md.
