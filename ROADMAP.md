# Campfires Roadmap

Current status as of the latest update to this file. Update this doc when work starts, finishes, or plans change.

## Sprint 1: Campfires IDE (VS Code Extension)

The minimum to see each other and start dogfooding.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Server: WebSocket + Yjs rooms | Scaffolded | — | `server/src/ws-server.ts` |
| Server: REST API (auth, teams, summaries) | Scaffolded | — | `server/src/api.ts`, `server/src/auth.ts` |
| Server: SQLite persistence | Scaffolded | — | `server/src/persistence.ts` |
| Shared types | Scaffolded | — | `shared/src/types.ts` |
| Extension: activation + auth flow | Scaffolded | — | `extension/src/extension.ts` |
| Extension: awareness provider | Scaffolded | — | Captures file, function, saves, commits |
| Extension: campfire sidebar panel | Scaffolded | — | Webview with live activity stream |
| Extension: editor decorations | Scaffolded | — | Gutter badges for teammate presence |
| Extension: status bar | Scaffolded | — | Active count, draft toggle, connection |
| Extension: draft mode | Scaffolded | — | One-toggle privacy |
| Extension: idle detection | Scaffolded | — | 5-min timer |
| Extension: git watcher | Scaffolded | — | Commits + branch switches |

## Sprint 2: Campfire Watch CLI

Terminal-native awareness for Claude Code and terminal workflows.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| CLI: entry point + auth | Done | — | `cli/src/index.ts`, `cli/src/auth.ts` |
| CLI: three-tier terminal renderer | Done | — | `cli/src/renderer.ts`, ANSI + alt screen buffer |
| CLI: agent activity via git hooks | Not started | — | `post-commit`, `post-checkout` |
| CLI: filesystem watcher for agent saves | Not started | — | Attributes saves to active agent session |

## Sprint 3: Campfires Reel (Web App)

AI-summarized org-wide view for non-dev stakeholders.

| Feature | Status | Owner | Notes |
|---------|--------|-------|-------|
| Reel: web app shell | Scaffolded | — | Vite + vanilla TS |
| Reel: summary feed UI | Not started | — | Team cards, grouped by recency |
| Reel: team detail drill-down | Not started | — | Project-level view, no raw file activity |
| Server: AI summarization batch job | Scaffolded | — | `server/src/summarizer.ts`, Claude API |
| Server: org context ingestion | Not started | — | Mission, roadmap, team descriptions |
| Server: SSE for summary stream | Not started | — | `GET /orgs/:id/summaries/stream` |

## Sprint 4: Polish

Iterate based on dogfooding. No fixed feature list — driven by real usage.

## Not in MVP

These are explicitly deferred. Don't build them yet.

- PM dashboard (Reel covers this for now)
- Co-editing / shared cursors (not the differentiator)
- AI merge/conflict detection (needs mature activity log)
- Self-hosted / enterprise (cloud-first)
- Reel notifications / follow
- Daily digest emails
- Graphical TUI for CLI
- Interactive CLI commands
- Agent identity config (naming, colors)

## How to Use This Doc

- **Claiming work:** Put your name in the Owner column before starting. Check for conflicts first.
- **Updating status:** Use `Not started`, `Scaffolded`, `In progress`, `Done`.
- **Adding work:** Add rows to the appropriate sprint table. If it doesn't fit a sprint, add it to "Not in MVP" with a rationale.
- **Decisions:** If you make an architectural decision that affects others, note it here or in CONTRIBUTING.md.
