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

2D pixel-art map view as an alternative rendering mode for PMs and non-dev stakeholders. Same data pipeline, same endpoints, no new backend — just a canvas-based rendering layer on top of the existing Reel.

**Core concept:** Each team is a campfire on the map. Fire size/intensity reflects activity level. Human users are small sprites with task animations (smithing, scribing, mining, chopping). Agent sprites are visually distinct (blockier, glowing eyes) and color-matched to their human owner. Status maps to animation: active = working, idle = sitting with zzz, draft = inside tent, offline = absent.

**Tech approach:** HTML5 canvas with pixel-art rendering, small sprite sheet (5-6 states), campfire animation with 3 intensity levels. Feed/Map toggle in the Reel UI. Phaser.js optional if zoom/scroll needed later.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Reel: Feed/Map toggle | Not started | — | Switch between text feed and canvas map |
| Map: canvas renderer + campfire sprites | Not started | — | 3 intensity levels based on team activity |
| Map: human user sprites + animations | Not started | — | 5-6 states: working, idle/zzz, draft/tent, offline/absent |
| Map: agent/golem sprites | Not started | — | Visually distinct, color-matched to parent user |
| Map: environmental art | Not started | — | Woodpiles, barrels, torches, trees, paths between campfires |
| Map: zoomed-out org view | Not started | — | All campfires visible, AI summary one-liners overlay |
| Map: click-in team detail | Not started | — | Individual sprites, current file/function on hover |
| Mockup: `campfires-map-mockup.html` | Done | — | Visual direction established |

**Deferred from Sprint 4:** Zoom/scroll interaction, ambient display mode (TV in office), sprite customization, day/night cycle.

## Sprint 5: Campfires IDE (VS Code Extension)

Deprioritized — CLI + Reel cover the core workflows. Revisit after Map View.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Extension: activation + auth flow | Scaffolded | — | `extension/src/extension.ts` |
| Extension: awareness provider | Scaffolded | — | Captures file, function, saves, commits |
| Extension: campfire sidebar panel | Scaffolded | — | Webview with live activity stream |
| Extension: editor decorations | Scaffolded | — | Gutter badges for teammate presence |
| Extension: status bar | Scaffolded | — | Active count, draft toggle, connection |
| Extension: draft mode | Scaffolded | — | One-toggle privacy |
| Extension: idle detection | Scaffolded | — | 5-min timer |
| Extension: git watcher | Scaffolded | — | Commits + branch switches |

## Sprint 6: Polish

Iterate based on dogfooding. No fixed feature list — driven by real usage.

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
