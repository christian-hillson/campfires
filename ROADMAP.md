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

## Sprint 3: Campfires Reel (Web App)

AI-summarized org-wide view for non-dev stakeholders.

| Feature                                | Status | Owner | Notes                                                                                    |
| -------------------------------------- | ------ | ----- | ---------------------------------------------------------------------------------------- |
| Reel: web app shell                    | Done   | —     | Vite + vanilla TS, `reel/index.html`, `reel/src/main.ts`                                 |
| Reel: summary feed UI                  | Done   | —     | Team cards grouped by recency, SSE live updates, `reel/src/components/summary-feed.ts`   |
| Reel: team detail drill-down           | Done   | —     | Members, full summary, recent activity, `reel/src/components/detail-view.ts`             |
| Server: AI summarization batch job     | Done   | —     | Stubbed `generateSummary()` in `server/src/summarizer.ts`, pluggable for real Claude API |
| Server: org context ingestion          | Done   | —     | Mission, roadmap, team descriptions passed to summarizer                                 |
| Server: SSE for summary stream         | Done   | —     | `GET /orgs/:id/summaries/stream`, intervals in CONFIG                                    |
| Shared: `oneLiner` on Summary          | Done   | —     | Added to types + persistence for compact card display                                    |
| Server: read endpoints opened for Reel | Done   | —     | `GET /orgs/:id`, `/orgs/:id/teams`, `/teams/:id/members` use optional auth               |

## Sprint 4: Reel Map View — RPG-Style Graphical Interface

2D pixel-art map view as an alternative rendering mode for PMs and non-dev stakeholders. Same data pipeline, same SSE stream, same access controls — canvas-based rendering layer on top of the existing Reel.

**Core concept:** Each team is a campfire on the map. Fire size/intensity reflects activity level. Human users are small sprites with task animations (smithing, scribing, mining). Agent sprites are visually distinct (blockier, glowing eyes) and color-matched to their human owner. Status maps to animation: active = working, idle = sitting with zzz, draft = inside tent, offline = absent.

**Tech approach:** Pure HTML5 canvas with pixel-art rendering, y-sorted depth, auto-layout. Feed/Map toggle in shared header. Awareness polling via REST endpoint every 10s.

| Feature                                 | Status | Owner | Notes                                                                            |
| --------------------------------------- | ------ | ----- | -------------------------------------------------------------------------------- |
| Reel: Feed/Map toggle + shared header   | Done   | —     | `reel/src/components/header.ts`, Press Start 2P + Silkscreen fonts               |
| Map: canvas renderer + campfire sprites | Done   | —     | 3 intensity levels from event count, `reel/src/map/renderer.ts`                  |
| Map: human user sprites + animations    | Done   | —     | smithing/scribing/mining + idle/zzz + draft/tent, `reel/src/map/sprites.ts`      |
| Map: agent/golem sprites                | Done   | —     | Blockier body, glowing eyes, color-matched to parent, `reel/src/map/sprites.ts`  |
| Map: environmental art                  | Done   | —     | Trees, paths, woodpiles, barrels, crates, torches, `reel/src/map/environment.ts` |
| Map: zoomed-out org view                | Done   | —     | Elliptical auto-layout, AI summary one-liners overlay, `reel/src/map/layout.ts`  |
| Map: hover tooltips                     | Done   | —     | Hit detection on sprites, name/role/team/file tooltip                            |
| Server: awareness REST endpoint         | Done   | —     | `GET /api/teams/:id/awareness`, reads Yjs awareness state                        |
| Mockup: `campfires-map-mockup.html`     | Done   | —     | Visual direction established                                                     |

**Deferred from Sprint 4:** Zoom/scroll interaction, ambient display mode (TV in office), sprite customization, day/night cycle.

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

| Feature                                         | Status | Owner | Notes                                                                                     |
| ----------------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------- |
| Map: click campfire to open detail overlay      | Done   | —     | Team name, AI summary, member list with statuses, headcount                               |
| Reel: campfire detail as entry point for visits | Done   | —     | Existing detail drill-down gains a "Visit this campfire" action                           |
| Server: cross-team read access for visitors     | Done   | —     | Read-only awareness + activity for any team in your org                                   |
| Server: visitor presence (lightweight)          | Done   | —     | Visitors appear in awareness with a distinct `visitor` status, don't emit activity events |
| Extension: visit campfire command               | Done   | —     | Switch sidebar to observe a different team's campfire temporarily                         |
| CLI: visit campfire flag                        | Done   | —     | `campfire watch --visit <teamId>` to observe another team                                 |

---

## Phase 2: Claude Code Plugin + AI Summarization

The architectural pivot. Claude Code Plugin replaces the VS Code Extension and CLI as the primary data source. Session transcripts become the primary input to AI summarization, producing richer business-legible summaries.

---

## Sprint 7: Claude Code Plugin (Source Layer)

The plugin captures developer activity ambiently and uploads session transcripts when sharing is enabled. Plugin design is in progress — details TBD.

| Feature                                          | Status      | Owner | Notes                                                        |
| ------------------------------------------------ | ----------- | ----- | ------------------------------------------------------------ |
| Plugin: session lifecycle (start/end)            | Not started | —     | Heartbeats so the server knows who's active                  |
| Plugin: Share toggle (on/off)                    | Not started | —     | Privacy control — nothing sent when Share is off             |
| Plugin: session transcript upload on completion  | Not started | —     | Full conversation sent to server when Share = On             |
| Plugin: git event detection (commits, branches)  | Not started | —     | Real-time signals for the map and activity log               |
| Server: transcript ingestion endpoint + storage  | Not started | —     | New endpoint for receiving and storing session transcripts   |
| Shared: new types (SessionTranscript, ShareMode) | Not started | —     | `shared/src/types.ts`                                        |

## Sprint 8: AI Summarizer (Intelligence Layer)

Replace the stubbed summarizer with real Claude API integration. Transcripts provide much richer context than raw file events.

| Feature                                           | Status      | Owner | Notes                                                          |
| ------------------------------------------------- | ----------- | ----- | -------------------------------------------------------------- |
| Server: Claude API integration replacing stub     | Not started | —     | `server/src/summarizer.ts`                                     |
| Server: transcript → summary pipeline             | Not started | —     | Process transcripts into business-legible team summaries       |
| Server: summary quality tuning                    | Not started | —     | Prompt engineering, chunking for long sessions                 |
| Reel: Fireside Panel branding for summary feed    | Not started | —     | Rename/restyle the existing summary feed view                  |
| Reel: richer summary cards from transcript data   | Not started | —     | Summaries powered by "what was accomplished" vs raw file saves |

## Sprint 9: Integration & Polish

End-to-end flow: Claude Code Plugin → Server → AI Summarizer → Reel. Driven by real usage and dogfooding.

| Feature                                     | Status      | Owner | Notes                                               |
| ------------------------------------------- | ----------- | ----- | --------------------------------------------------- |
| End-to-end plugin → server → reel flow      | Not started | —     | Full pipeline working with real data                 |
| Zero-config onboarding experience           | Not started | —     | Plugin captures activity with no setup beyond Share  |
| Deprecate extension + CLI as primary inputs | Not started | —     | Keep as reference, remove from active development    |

## Not Yet Planned

These are explicitly deferred. Don't build them yet.

- Co-editing / shared cursors (not the differentiator)
- AI merge/conflict detection (needs mature activity log)
- Self-hosted / enterprise (cloud-first)
- Reel notifications / follow
- Daily digest emails
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
