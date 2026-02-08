# Campfires — Future State Sketch

**As of February 8, 2026**

---

## The Three Surfaces

The product is three UIs powered by one data pipeline:

### 1. Campfires IDE (VS Code sidebar) — for devs

- Sidebar panel: live teammate presence (who's online, what file/function, what branch), filterable activity feed (saves, commits, branch switches), focus mode
- Gutter decorations: colored dots showing teammates in the same file
- Status bar: online count, draft mode toggle, connection state
- Draft mode: one-click toggle to go dark — shows "in draft mode" but hides all file/activity detail

### 2. Campfire Watch (terminal) — for terminal devs

- Three-tier layout in a narrow split pane (~35 chars wide):
  - **Tier 1 — Bonfire (org)**: company name, campfire count, online count, AI one-liner summaries per team
  - **Tier 2 — Campfire (team)**: member list with status emoji (active, idle, draft, agent), current file -> function. Agents nested under their human with indented prefix
  - **Tier 3 — Activity feed**: raw chronological events, commits highlighted in amber
- Read-only display, no interactive commands in MVP

### 3. Campfires Reel (web app) — for everyone else (PMs, execs, designers)

- URL: `campfires.app/org/{orgId}`
- AI-summarized feed grouped by team, sorted by recency
- Summaries batch-generated every 15-30 min using Claude API + company context (mission, roadmap, team descriptions)
- Translates raw dev activity into business language: *"The payments team is building Stripe webhook support — this is part of the Q1 billing migration"*
- Click-through to team detail: who's active, hot modules, recent commits with messages, AI progress summary
- **Never exposes raw file-level activity** — that stays in the IDE/CLI

---

## The Data Pipeline

```
VS Code Extension ──┐
                     ├──> Yjs WebSocket Room (per team) ──> Server ──> SQLite activity_log
CLI (campfire watch) ┘       (awareness + events)                           |
                                                                            v
                                                              Batch Summarizer (every 15-30min)
                                                              Claude API + company context
                                                                            |
                                                                            v
                                                                     Summaries table
                                                                            |
                                                              +-------------+-------------+
                                                              v             v             v
                                                         Reel (SSE)   CLI Tier 1     REST API
```

---

## Naming Hierarchy

| Level | Name | Emoji | Example |
|-------|------|-------|---------|
| Org | **Bonfire** | fire | "Gusto Bonfire" |
| Team | **Campfire** | camping | "Payments Campfire" |
| Individual | **Flame** | sparkler | Single dev's activity |

---

## Agent Model

Agents (Claude Code, etc.) are first-class citizens with `type: 'agent'` and `parentUserId` linking them to their human. They show nested under their owner in both the sidebar and CLI. Agents stay visible even when their human goes idle. Activity captured via git hooks + filesystem watchers.

---

## Key Gaps (spec vs. built)

| Spec feature | Status |
|---|---|
| Sidebar webview HTML/CSS | Not built |
| Reel web app | Not started |
| AI summarization (Claude API batch job) | Not started |
| Agent registration + `parentUserId` | Data model missing `parentUserId` |
| Agent REST endpoints (`/agents`, `/agents/activity`) | Not built |
| Git hooks install (`post-commit`, `post-checkout`) | Not built |
| Function detection via `DocumentSymbolProvider` | Stubbed |
| SSE summary streaming | Stubbed |
| Company context ingestion (mission/roadmap for Reel AI) | API exists, no UI |
| Summary `oneLiner` field | Not in current data model |
| Reel click-through detail page | Not started |
| Filters (by person, directory, event type, focus mode) | Not built |

---

## Current State Summary (what works end-to-end)

- **Auth**: signup/login with JWT, stored in VS Code secrets or `~/.campfires/token`
- **Team management**: create org, create team, join via invite code
- **Real-time presence**: VS Code extension and CLI both connect to same Yjs room, broadcast awareness state
- **Activity feed**: file opens/saves, commits, branch switches, session events flow through Yjs and persist to SQLite
- **VS Code extension**: idle detection, git watching, draft mode, status bar, gutter decorations
- **CLI**: 3-tier terminal UI with ANSI colors, file + git watchers emitting activity
- **Server**: Express + SQLite + y-websocket, all REST endpoints functional

### Package status

| Package | Files | Status |
|---------|-------|--------|
| **shared** | 2 | Complete — single source of truth for all types |
| **server** | 5 | Functional — auth, REST, WebSocket, SQLite all working |
| **extension** | 7 | Core working, webview UI not built |
| **cli** | 7 | Connection + renderer + watchers working |
| **reel** | 0 src | Not started |
