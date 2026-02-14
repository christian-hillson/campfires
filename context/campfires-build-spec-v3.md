# CAMPFIRES

**Build-Ready Technical Specification**
**For Claude Code Implementation**
**v3.0 — February 2026**

Authors: Christian + JC

> **Note:** This is the v1 prototype spec. It describes the original three-client architecture (VS Code Extension + Terminal CLI + Web App). The current vision has pivoted to: Claude Code Plugin (source) → Campfires Server (system) → Campfires Web App (surface). See the README for the current architecture and ROADMAP.md for the active sprint plan.

> Two products. One data pipeline. One CLI. The campfire everyone gathers around.

---

## 1. What We're Building

Campfires is three surfaces powered by one data pipeline:

**Product A: Campfires IDE (VS Code Extension)**
The data production layer. Devs install it, it captures their activity (file opens, saves, commits, branch switches, presence), and broadcasts it to their team in real time. Devs use the sidebar panel to see what teammates are working on. This is the dev-to-dev coordination tool.

**Product B: Campfire Stories (Web App)**
The data consumption layer. Anyone at the company can open it. It shows an AI-summarized, human-readable feed of what engineering is building right now, translated using company context (mission, roadmap, project descriptions). PMs, designers, execs, and other teams use this to understand what's happening without asking.

Campfire Stories is not a filtered view of raw events. It's a translation layer: it takes technical activity data and produces business-legible summaries like "The payments team is building Stripe webhook support — this is part of the Q1 billing migration."

**Product C: Campfire Watch (Terminal CLI)**
The terminal-native awareness surface. Developers working in Claude Code or other terminal workflows run `campfire watch` in a split pane to get the same ambient team awareness as the VS Code sidebar. It is a read-only client consuming existing WebSocket and REST endpoints — no new server infrastructure required.

### 1.1 Naming Hierarchy

The product uses a fire-based naming hierarchy across all surfaces (CLI, extension, Campfire Stories):

| Level        | Name         | Emoji | Scope                                      |
| ------------ | ------------ | ----- | ------------------------------------------ |
| Organization | **Bonfire**  | `🔥`  | Company-wide view (e.g. "Gusto Bonfire")   |
| Team         | **Campfire** | `🏕️`  | Team-level view (e.g. "Payments Campfire") |
| Individual   | **Flame**    | `🎇`  | Single developer's activity                |

### 1.2 Core Principles

- One campfire per team for devs (detailed, real-time, technical). One Campfire Stories per org for everyone (summarized, near-real-time, legible). One CLI for terminal-first devs (same data, different surface).
- Medium awareness by default. File, function, and intent via commit messages. Not keystroke-level streaming.
- Draft mode respects the ego. Devs can go dark with one toggle. Adoption requires trust, and trust requires opt-out.
- Human and agent activity are separated from day one. The `type` field (`human | agent`) exists on every user and awareness state. Agents are nested under their human owner.
- Campfire Stories never exposes raw dev activity to non-devs. It only shows AI-summarized project-level information. This is critical for dev trust.
- Commit messages as intent in MVP. AI summarization in Campfire Stories adds the translation layer.

### 1.3 The Adoption Flywheel

Devs install Campfires IDE because it helps them coordinate with their team. Terminal devs run `campfire watch` for the same benefit without leaving their workflow. Campfire Stories gives everyone else a reason to care that Campfires exists. Campfire Stories creates organizational demand ("why isn't your team on Campfires?"), which drives more dev adoption, which makes Campfire Stories more useful.

### 1.4 Philosophical Foundation

Inspired by Steve Yegge's Hive Mind article and the SageOx operating model. Key concepts: full transparency of work streams within the team, the campfire model (evolutionary development around a living prototype), death of the ego, "Yes, and..." improv at scale. Campfires makes this operational for any team, not just 3 people in a room above a coffee shop.

---

## 2. MVP Scope

The MVP is built in sprints with Claude Code agents. The goal: devs coordinating via Campfires IDE or `campfire watch`, while Campfire Stories shows AI-summarized activity to anyone with the org link.

### 2.1 Sprint 1: Campfires IDE (Days 1-3)

The minimum to see each other and start dogfooding.

**The Campfire Panel (Sidebar)**
A VS Code sidebar view displaying a live, filterable activity stream for the team:

- **Presence**: who is online, active, idle, or in draft mode
- **Location**: what file and function each teammate is currently in
- **Activity feed**: chronological stream of events — file opens, saves, commits, branch switches
- **Intent** (via commits): commit messages appear as high-signal intent markers
- **Filters**: by person, by directory/module, by event type. Focus mode to mute all except immediate collaborators

**Inline Awareness (Editor Decorations)**

- Gutter badges showing when a teammate is in the same file
- File-level indicator in the tab bar or breadcrumb showing teammate presence
- Ghost cursors deferred — this is awareness, not co-editing

**Draft Mode**
A toggle in the status bar that immediately stops streaming your activity to the campfire. Your presence shows as "in draft mode" but no file, function, or activity details are shared.

**Status Bar**
Compact status bar item showing: number of active devs, your visibility mode (live vs. draft), connection status.

**Idle Detection**
No editor activity for 5 minutes triggers idle status. Any keystroke, scroll, or file switch resets to active. Implemented as a simple timer in the extension, not via Yjs.

### 2.2 Sprint 2: Campfire Watch CLI (Days 4-5)

The terminal-native surface — lighter lift than Campfire Stories, validates the data pipeline end-to-end, and unblocks Claude Code developers immediately.

**Three-Tier Layout**

_Tier 1: Org Header_

- Company name (Bonfire), active campfire count, online user count
- AI-generated one-liner summaries of what each campfire is working on
- Summaries pulled from the Campfire Stories summarization pipeline via REST
- Updates every 15-30 minutes (matches the Campfire Stories batch cycle)

_Tier 2: Your Campfire_

- Team name with member presence
- Each human member shows: name, status (active/idle/draft), current file -> function
- Agents nested under their human owner with `↳` prefix and `🤖` icon
- Agents remain visible and active even when their human owner is idle
- Status indicators: `🔥` active, `💤` idle, `🔒` draft, `🤖` agent

_Tier 3: Activity Feed_

- Chronological stream of raw events from your campfire
- File saves, commits (highlighted), branch switches, file opens
- No AI interpretation — devs want the raw data in the terminal
- Same data as the VS Code sidebar activity feed

**Agent Activity Emission**

Claude Code agents (and other CLI-based agents) cannot be instrumented directly. Their activity is captured via:

- **Git hooks**: `post-commit` and `post-checkout` hooks broadcast events through the Campfires pipeline
- **Filesystem watchers**: a background process detects file saves in the workspace and attributes them to the active agent session

This requires the `parentUserId` field on agent users in the data model (see Section 6.1).

**Scope**

- Plain text terminal output with ANSI colors and emoji
- Three-tier layout (org header, team presence, activity feed)
- Read-only display (no interactive commands beyond starting/stopping)

**Deferred from CLI MVP**

- Graphical/TUI version (borders, scrollable regions, mouse interaction)
- Campfire-level AI summaries (only org-level summaries in MVP)
- Interactive commands (e.g., toggling draft mode from the CLI)
- Agent identity configuration (naming, color assignment for agents)

### 2.3 Sprint 3: Campfire Stories (Days 6-9)

The AI-summarized org-wide view.

**Campfire Stories Web App**

- Single-page web app accessible at `campfires.app/org/{orgId}`
- Shows AI-summarized activity feed across all teams in the org
- Summaries generated every 15-30 minutes as a batch, not per-event
- Uses Claude API with company context (mission, roadmap, team descriptions) as system prompt
- Translates raw activity into business-legible summaries
- Grouped by team, sorted by recency

**Campfire Stories Context Ingestion**
During org setup, the admin provides:

- Team names and brief descriptions of what each team owns
- Company mission statement
- Current roadmap or list of active projects/initiatives

This context is stored as structured text and injected into the AI summarization prompt.

**AI Summarization Context Sources**

_MVP_: Hardcoded/uploaded text provided during org setup

- Team names and descriptions of what each team owns
- Company mission statement
- Current roadmap or list of active projects/initiatives

_Future (deferred)_: Notion integration as an automatic context provider, replacing or supplementing uploaded text. This would pull roadmap items, project docs, and team wikis directly from Notion via OAuth. The context injection interface should be designed as a simple text blob so that swapping in Notion (or other sources) later is just a new context provider behind the same interface.

**Campfire Stories Click-Through**
Clicking a team or project in Campfire Stories shows a project-level detail page (still within the web app). This shows: who's active on that team, what modules are hot, recent commits with messages, AI summary of recent progress. It does NOT show raw file-level activity — that stays in the IDE.

### 2.4 Sprint 4: Polish (Days 10-12)

Iterate based on dogfooding experience. Tune throttling, improve AI summaries, fix UX issues discovered during real use.

### 2.5 Explicitly Not in MVP

| Feature                                       | Phase    | Rationale                                       |
| --------------------------------------------- | -------- | ----------------------------------------------- |
| PM Dashboard (separate from Campfire Stories) | Phase 2  | Campfire Stories covers this for now            |
| Co-editing / shared cursors                   | Phase 3+ | Not the differentiator; Live Share exists       |
| AI merge/conflict detection                   | Phase 3+ | Requires mature activity log                    |
| Self-hosted / enterprise                      | Phase 4  | Cloud-first for internal launch                 |
| Campfire Stories notifications / follow       | Phase 2  | Get the core view right first                   |
| Daily digest emails                           | Phase 2  | Campfire Stories is the primary interface first |
| Graphical TUI for CLI                         | Phase 2  | Plain text CLI first                            |
| Interactive CLI commands                      | Phase 2  | Read-only display first                         |
| Agent identity config (naming, colors)        | Phase 2  | Data model supports it; UI deferred             |

---

## 3. Technical Architecture

### 3.1 System Overview

Campfires has five components:

1. **VS Code Extension (Campfires IDE)** — captures dev activity, connects to team Yjs room, renders sidebar/decorations/status bar
2. **Campfire Watch CLI** — read-only terminal display of team awareness and activity, consumes the same WebSocket and REST endpoints
3. **WebSocket Server (real-time hub)** — manages Yjs rooms, broadcasts awareness, writes activity events to the log
4. **Persistence Layer (activity log)** — append-only SQLite database of all activity events
5. **Campfire Stories Web App** — reads from activity log, calls Claude API for summarization, serves the org-wide view

### 3.2 Yjs Room Topology

Each team gets one Yjs document, identified by `campfire:{teamId}`. All team members connect to that single room — VS Code extension clients and `campfire watch` CLI clients alike.

The Yjs doc holds a `Y.Array` for the activity feed (rolling window of ~500 recent events for the sidebar). Awareness states are handled by the Yjs awareness protocol, which is separate from the doc.

The append-only activity log in SQLite is written server-side by listening to `Y.Array` updates. The Yjs doc is the real-time broadcast layer, not the persistence layer. Campfire Stories reads from the SQLite activity log, not from Yjs directly.

### 3.3 Why Yjs + WebSocket

- **Decentralized by design**: CRDTs merge automatically without conflicts
- **Awareness protocol**: built-in API for presence and arbitrary user state
- **Monaco bindings**: native bindings for future co-editing (Phase 3)
- **Network-agnostic**: start with WebSocket, add WebRTC later
- **Proven at scale**: used by AFFiNE, Huly, Nimbus Note, and dozens of production apps

### 3.4 Campfire Stories Data Pipeline

Campfire Stories does not connect to Yjs rooms. It reads from the persisted activity log via a REST API on the server. The summarization pipeline:

1. Batch job runs every 15-30 minutes
2. Queries `activity_log` for all events since last summarization, grouped by team
3. Constructs a prompt with: raw events, team descriptions, company context/roadmap
4. Calls Claude API (`claude-sonnet-4-5-20250929`) for summarization
5. Stores the generated summary in a `summaries` table
6. Campfire Stories web app and `campfire watch` CLI poll or use SSE to display latest summaries

### 3.5 Agent Activity Pipeline

Agents running in CLI environments (Claude Code, etc.) cannot be instrumented via VS Code extension APIs. Instead:

1. **Git hooks** (`post-commit`, `post-checkout`) are installed in the workspace. On trigger, they call the Campfires server REST API with the event and the agent's auth token.
2. **Filesystem watcher** — a lightweight background process (spawned by `campfire watch` or run standalone) monitors workspace file saves and attributes them to the active agent session.
3. Events flow into the same `activity_log` table with `userType: 'agent'` and the agent's `parentUserId` linking back to the human owner.

The agent's auth token is derived from the parent user's session. When a human starts a Claude Code session, the CLI registers an agent user with `parentUserId` set, and the agent inherits the parent's `teamId` and `orgId`.

### 3.6 Reconnection Strategy

When WebSocket drops: immediately show "reconnecting..." in status bar (extension) or terminal (CLI). Yjs WebSocket provider has built-in reconnection with exponential backoff. During disconnection, the user's awareness state goes stale — after 30 seconds without an awareness update, other clients show that user as offline (Yjs awareness timeout parameter). On reconnect, the client re-broadcasts its full awareness state.

---

## 4. Project Structure

Monorepo with five packages:

| Path                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| **server/**                       | Node.js + Express WebSocket server                                            |
| `server/ws-server.ts`             | WebSocket server using y-websocket, handles connections and room management   |
| `server/awareness-engine.ts`      | Processes awareness updates, maintains team state, broadcasts activity events |
| `server/persistence.ts`           | Append-only activity log (SQLite)                                             |
| `server/auth.ts`                  | JWT-based auth for teams/orgs                                                 |
| `server/summarizer.ts`            | Batch job that calls Claude API to generate Campfire Stories summaries        |
| `server/api.ts`                   | REST endpoints for auth, teams, summaries, and health                         |
| **extension/**                    | VS Code Extension (Campfires IDE)                                             |
| `extension/extension.ts`          | Extension entry point, lifecycle management                                   |
| `extension/awareness-provider.ts` | Captures local dev activity: active file, function, saves, commits            |
| `extension/campfire-panel.ts`     | Sidebar webview showing the live activity stream with filters                 |
| `extension/decorations.ts`        | Inline editor decorations for teammate presence                               |
| `extension/status-bar.ts`         | Status bar: active count, draft mode toggle, connection status                |
| `extension/git-watcher.ts`        | Watches for commits and branch switches via VS Code Git API                   |
| `extension/idle-detector.ts`      | 5-minute idle timer, resets on any editor activity                            |
| **cli/**                          | Campfire Watch terminal client                                                |
| `cli/index.ts`                    | Entry point, auth check, WebSocket connection                                 |
| `cli/renderer.ts`                 | ANSI terminal rendering for the three-tier layout                             |
| `cli/agent-watcher.ts`            | Filesystem watcher for agent activity emission                                |
| `cli/git-hooks.ts`                | Installs/manages post-commit and post-checkout hooks                          |
| **campfire-stories/**             | Campfire Stories Web App                                                      |
| `campfire-stories/index.html`     | Single-page app entry point                                                   |
| `campfire-stories/app.ts`         | Main app logic, fetches and displays summaries                                |
| `campfire-stories/components/`    | UI components: team cards, summary feed, detail views                         |
| **shared/**                       | Shared types and protocol                                                     |
| `shared/types.ts`                 | ActivityEvent, User, Team, Org, AwarenessState, FilterConfig, Summary types   |
| `shared/protocol.ts`              | Message types and serialization for client-server communication               |

---

## 5. Tech Stack

| Layer                    | Technology                  | Rationale                                                                                |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| Real-time sync           | Yjs + y-websocket           | Battle-tested CRDT with awareness protocol; Monaco bindings for future co-editing        |
| Transport                | WebSocket                   | Simple, reliable; upgradeable to WebRTC via Yjs provider swap                            |
| IDE Extension            | TypeScript + VS Code API    | Native sidebar, decorations, status bar, webview panels                                  |
| CLI                      | Node.js + ANSI escape codes | Same language as server/extension; no TUI framework overhead for MVP                     |
| Server                   | Node.js + Express           | Same language as extension; y-websocket is Node-native                                   |
| Persistence              | SQLite (better-sqlite3)     | Append-only activity log; synchronous reads for simplicity; Postgres upgrade path exists |
| Auth                     | JWT tokens                  | Simple team/org scoping; upgradeable to SSO for enterprise                               |
| Campfire Stories Web App | Vanilla TypeScript + Vite   | Lightweight, fast build, no framework overhead for a read-mostly app                     |
| Campfire Stories Data    | SSE (Server-Sent Events)    | Simpler than WebSocket for a read-only summary stream                                    |
| AI Summarization         | Claude API (Sonnet)         | Batch summarization every 15-30 min with company context                                 |
| Hosting                  | Railway or Fly.io           | Zero-friction; WebSocket support out of the box                                          |

---

## 6. Data Model

### 6.1 User (Persisted)

| Field        | Type          | Description                                                                                                       |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| userId       | UUID          | Unique user identifier                                                                                            |
| email        | string        | User email                                                                                                        |
| displayName  | string        | Name shown in the campfire                                                                                        |
| avatarColor  | string        | Server-assigned color for decorations                                                                             |
| teamId       | UUID          | Single team per user in MVP                                                                                       |
| orgId        | UUID          | Organization the user belongs to                                                                                  |
| type         | enum          | `human \| agent`                                                                                                  |
| parentUserId | UUID \| null  | For agents: the human owner's userId. Null for humans. Used for nested display in campfire watch and the sidebar. |
| createdAt    | ISO timestamp | When the user was created                                                                                         |

### 6.2 Org (Persisted)

| Field     | Type          | Description                                                         |
| --------- | ------------- | ------------------------------------------------------------------- |
| orgId     | UUID          | Unique org identifier                                               |
| name      | string        | Organization name (displayed as "{name} Bonfire")                   |
| mission   | text          | Company mission statement (for Campfire Stories AI context)         |
| roadmap   | text          | Current roadmap / active projects (for Campfire Stories AI context) |
| createdAt | ISO timestamp | When the org was created                                            |

### 6.3 Team (Persisted)

| Field       | Type          | Description                                           |
| ----------- | ------------- | ----------------------------------------------------- |
| teamId      | UUID          | Unique team identifier                                |
| orgId       | UUID          | Parent org                                            |
| name        | string        | Team display name (displayed as "{name} Campfire")    |
| description | text          | What this team owns (for Campfire Stories AI context) |
| inviteCode  | string        | Shareable code for joining the campfire               |
| members     | User[]        | List of team members                                  |
| createdAt   | ISO timestamp | When the team was created                             |

### 6.4 Awareness State (Real-Time, In-Memory via Yjs)

Each connected client broadcasts this via the Yjs awareness protocol. Ephemeral, not persisted.

| Field           | Type           | Description                                               |
| --------------- | -------------- | --------------------------------------------------------- |
| userId          | string         | Unique user identifier                                    |
| displayName     | string         | Name shown in the campfire                                |
| type            | enum           | `human \| agent`                                          |
| parentUserId    | string \| null | For agents: the human owner's userId                      |
| status          | enum           | `active \| idle \| draft \| offline`                      |
| currentFile     | string \| null | Relative path of active editor file                       |
| currentFunction | string \| null | Function/symbol name at cursor via DocumentSymbolProvider |
| currentBranch   | string \| null | Active git branch                                         |
| lastActivity    | ISO timestamp  | Last time any editor activity was detected                |
| color           | string         | Assigned avatar color for decorations                     |

### 6.5 Activity Event (Persisted, Append-Only)

Discrete events written to the `activity_log` table. These form the forensic trail and the input to Campfire Stories summarization.

| Field        | Type           | Description                                                                         |
| ------------ | -------------- | ----------------------------------------------------------------------------------- |
| id           | UUID           | Unique event ID                                                                     |
| timestamp    | ISO timestamp  | When the event occurred                                                             |
| userId       | string         | Who triggered the event                                                             |
| userType     | enum           | `human \| agent` (denormalized for query efficiency)                                |
| parentUserId | string \| null | For agent events: the human owner's userId                                          |
| teamId       | UUID           | Which team campfire this belongs to                                                 |
| type         | enum           | `file_open \| file_save \| commit \| branch_switch \| session_start \| session_end` |
| file         | string \| null | File involved in the event                                                          |
| branch       | string \| null | Branch at time of event                                                             |
| message      | string \| null | Commit message (for commit events)                                                  |
| metadata     | JSON \| null   | Extensible payload for future event types                                           |

### 6.6 Summary (Persisted)

AI-generated summaries for Campfire Stories and the campfire watch org header, stored after each batch summarization run.

| Field       | Type          | Description                                                            |
| ----------- | ------------- | ---------------------------------------------------------------------- |
| id          | UUID          | Unique summary ID                                                      |
| orgId       | UUID          | Which org this summary is for                                          |
| teamId      | UUID          | Which team this summary covers                                         |
| periodStart | ISO timestamp | Start of the summarized period                                         |
| periodEnd   | ISO timestamp | End of the summarized period                                           |
| content     | text          | The AI-generated summary text                                          |
| oneLiner    | text          | Short one-line summary for campfire watch org header and compact views |
| eventCount  | integer       | Number of raw events summarized                                        |
| createdAt   | ISO timestamp | When the summary was generated                                         |

---

## 7. REST API Surface

The WebSocket handles real-time awareness. These HTTP endpoints handle everything else.

### 7.1 Auth

| Endpoint        | Method | Description                                                                                 |
| --------------- | ------ | ------------------------------------------------------------------------------------------- |
| `/auth/signup`  | POST   | Create account with email/password or GitHub OAuth. Returns JWT with userId, teamId, orgId. |
| `/auth/login`   | POST   | Authenticate, returns JWT.                                                                  |
| `/auth/refresh` | POST   | Refresh expired JWT.                                                                        |

### 7.2 Org & Team Management

| Endpoint             | Method | Description                                                    |
| -------------------- | ------ | -------------------------------------------------------------- |
| `/orgs`              | POST   | Create org. Returns orgId.                                     |
| `/orgs/:id`          | GET    | Get org details including mission, roadmap.                    |
| `/orgs/:id`          | PUT    | Update org context (mission, roadmap) for Campfire Stories AI. |
| `/orgs/:id/teams`    | GET    | List all teams in org.                                         |
| `/teams`             | POST   | Create team within org. Returns teamId + inviteCode.           |
| `/teams/join`        | POST   | Join a team via invite code.                                   |
| `/teams/:id/members` | GET    | List team members.                                             |

### 7.3 Campfire Stories & Summaries

| Endpoint                     | Method | Description                                                                                                                            |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/orgs/:id/summaries`        | GET    | Latest summaries for all teams in org. Supports `?since=` param. Returns both full `content` and `oneLiner` fields.                    |
| `/orgs/:id/summaries/stream` | GET    | SSE stream of new summaries as they are generated.                                                                                     |
| `/teams/:id/activity`        | GET    | Recent activity events for a team (for Campfire Stories detail view). Filtered to commits + branch switches only for non-team-members. |

### 7.4 Agent Management

| Endpoint           | Method | Description                                                                                     |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| `/agents`          | POST   | Register an agent user linked to the authenticated human via `parentUserId`. Returns agent JWT. |
| `/agents/activity` | POST   | Submit activity events from git hooks / filesystem watchers. Requires agent JWT.                |

### 7.5 System

| Endpoint  | Method | Description          |
| --------- | ------ | -------------------- |
| `/health` | GET    | Server health check. |

---

## 8. Extension Lifecycle

### 8.1 Activation

The extension activates on `onStartupFinished` (VS Code activation event).

Activation sequence:

1. Check for stored JWT in VS Code SecretStorage
2. If no JWT: show login/signup webview (inline, no browser redirect)
3. If valid JWT: extract teamId from token
4. Connect WebSocket to `campfire:{teamId}` Yjs room
5. Start broadcasting awareness state
6. Register event listeners for file open, save, git operations
7. Start idle detection timer (5 minutes)
8. Render sidebar panel and status bar

### 8.2 Deactivation

On extension deactivate or VS Code close:

1. Send `session_end` activity event
2. Set awareness state to offline
3. Disconnect WebSocket cleanly

### 8.3 Webview Communication

The campfire sidebar panel is a VS Code webview. It communicates with the extension host via `postMessage`. The extension host owns the Yjs connection and pushes state updates to the webview. The webview is purely a renderer — it does not hold any Yjs state. Webviews can be destroyed and recreated by VS Code at any time, so the extension host is the source of truth.

### 8.4 Function Detection

Uses VS Code's `DocumentSymbolProvider` to detect the current function at the cursor position. Works well for TypeScript, Python, Go, Java, Rust, C#. For languages where it returns nothing, `currentFunction` is set to null and the sidebar shows file path only. No custom AST parsing in MVP.

---

## 9. CLI Lifecycle

### 9.1 Startup

```
campfire watch
```

Startup sequence:

1. Check for stored JWT in `~/.campfires/token` (same token format as the extension)
2. If no token: prompt for login interactively in the terminal
3. If valid token: extract teamId, orgId from token
4. Connect WebSocket to `campfire:{teamId}` Yjs room (read-only awareness consumer)
5. Fetch latest org summaries via `GET /orgs/:id/summaries`
6. Render the three-tier layout to stdout with ANSI colors
7. Listen for awareness updates and activity events, re-render on change

### 9.2 Agent Session Registration

When `campfire watch` detects it is running alongside a Claude Code session (or is explicitly started with `--agent` flag):

1. Call `POST /agents` to register an agent user linked to the human
2. Install git hooks in the current workspace (`post-commit`, `post-checkout`)
3. Start filesystem watcher for the workspace directory
4. Agent activity events are submitted via `POST /agents/activity`

### 9.3 Shutdown

On `Ctrl+C` or terminal close:

1. Send `session_end` for any active agent sessions
2. Disconnect WebSocket cleanly
3. Git hooks remain installed (idempotent; no-op when CLI isn't running)

### 9.4 Display Rendering

The CLI renders plain text with ANSI escape codes. Target width: ~35 characters (narrow split pane). Rendering approach:

- Clear and redraw on each state change (awareness update or new activity event)
- Truncate file paths and function names with ellipsis to fit width
- Commits highlighted in amber/orange
- Agent lines indented with `↳` prefix and dimmed

---

## 10. Activity Throttling

| Event Type    | Debounce       | Rationale                                                          |
| ------------- | -------------- | ------------------------------------------------------------------ |
| file_save     | 5 seconds      | Collapses rapid Cmd+S without losing the "actively working" signal |
| file_open     | 2 seconds      | Collapses rapid tab switching                                      |
| commit        | None (instant) | High-signal intent marker, never throttle                          |
| branch_switch | None (instant) | High-signal context change                                         |
| session_start | None (instant) | Only fires once per session                                        |
| session_end   | None (instant) | Only fires once per session                                        |

Server-side safety valve: max 1 event per user per second, any events exceeding this are dropped silently. These values are config constants, not hardcoded — tunable based on dogfooding experience.

---

## 11. Activation Flow

The onboarding must be fast enough that a dev can go from discovery to seeing teammates in under 5 minutes.

**IDE path:**

1. Install the Campfires extension from the VS Code marketplace (or .vsix sideload for internal use)
2. Sign up with email or GitHub OAuth (inline in extension, no browser redirect)
3. Create an org or join an existing one
4. Create a team within the org, or join one via invite code (one click)
5. See the campfire — sidebar immediately shows your activity; teammates appear as they join
6. Share the invite code with your team via Slack, email, or any channel
7. Share the Campfire Stories URL (`campfires.app/org/{orgId}`) with PMs, execs, anyone who should see the summary view

**CLI path:**

1. Install via `npm install -g campfires` (or local dev install)
2. Run `campfire watch` — prompted to log in or sign up on first run
3. Join a team via invite code if not already on one
4. Split terminal: Claude Code on the left, `campfire watch` on the right
5. Team activity appears immediately in the right pane

---

## 12. Phased Roadmap

| Phase                | Timeline   | Deliverables                                                                                                                                     | Success Metric                                                 |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1a: IDE              | Days 1-3   | VS Code extension with campfire panel, inline decorations, draft mode, status bar, cloud server, append-only log                                 | 2 devs on one campfire, daily active usage while building      |
| 1b: CLI              | Days 4-5   | `campfire watch` terminal client with three-tier layout, agent activity emission via git hooks + fs watcher                                      | Terminal-first dev using campfire watch alongside Claude Code  |
| 1c: Campfire Stories | Days 6-9   | Web app with AI-summarized org feed, company context ingestion, team detail views                                                                | Non-dev stakeholder checks Campfire Stories daily              |
| 1d: Polish           | Days 10-12 | Iterate based on dogfooding, tune throttling, improve AI summaries                                                                               | All three surfaces feel usable without friction                |
| 2: Intelligence      | Weeks 3-6  | Intent inference from diffs, Campfire Stories notifications/follow, daily digest, agent identity config, interactive CLI commands, graphical TUI | PMs actively using Campfire Stories; AI summaries rated useful |
| 3: Hive Mind         | Weeks 7-12 | AI merge/conflict detection, agent doing visible work, co-editing (Yjs + Monaco), role-based views                                               | Teams reporting measurable coordination improvement            |
| 4: Enterprise        | Months 4-6 | Self-hosted option, SSO/SAML, audit logs, compliance, admin console                                                                              | First external team using Campfires                            |

---

## 13. Competitive Positioning

Campfires occupies a new category. No existing tool provides both ambient dev awareness inside the editor AND AI-translated visibility for the rest of the org.

| Tool                 | What It Does                                     | How Campfires Differs                                                                                         |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| VS Code Live Share   | Real-time co-editing with shared cursors         | Co-editing is a feature, not the product. Campfires is about awareness, not shared editing sessions.          |
| GitHub / GitLab      | Async collaboration via PRs, issues, code review | Campfires is real-time and continuous. PRs are after-the-fact; Campfires is during-the-fact.                  |
| Tuple / Pop          | Pair programming with video/screen share         | Campfires is ambient and always-on. Pair programming is synchronous and session-based.                        |
| Linear / Jira        | Project management and issue tracking            | PM tools track planned work. Campfires shows actual work happening right now.                                 |
| Slack / Teams        | Chat-based communication for teams               | Chat is manual and interruptive. Campfires is automatic and ambient.                                          |
| GitHub Activity Feed | Shows commits, PRs, issues across repos          | Raw and technical. Campfire Stories translates activity into business-legible summaries with company context. |

---

## 14. Risks & Mitigations

| Risk                                            | Severity | Mitigation                                                                                                                                                                           |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Developers resist transparency ("surveillance") | High     | Draft mode is prominent. Medium awareness only. Campfire Stories never exposes raw activity to non-devs. Messaging emphasizes team benefit.                                          |
| Campfire Stories AI summaries are low quality   | High     | Require good company context. Use commit messages as primary signal. Iterate on prompts. Allow human correction of summaries in Phase 2.                                             |
| Stream becomes too noisy at scale               | Medium   | Client-side filters from day one. Focus mode. Event throttling on saves/opens. Server-side rate limiting.                                                                            |
| WebSocket server scalability                    | Medium   | Yjs is designed for scale. y-redis exists for multi-server. Start simple, shard by team later.                                                                                       |
| Security concerns (code metadata in cloud)      | Medium   | Only file paths and function names transmitted, never code content. Enterprise self-hosted option in Phase 4.                                                                        |
| Low initial adoption / cold start               | Low      | Dogfooding from day one. Minimum viable campfire is 2 people. Campfire Stories creates org-level pull for adoption.                                                                  |
| Agent attribution accuracy                      | Medium   | Git hooks are reliable for commits/branches. Filesystem watcher may misattribute saves — use heuristics (active agent session in the same workspace) and accept imperfection in MVP. |

---

## 15. Resolved Design Decisions

These questions were open during the design phase and are now resolved:

- **Function detection**: Use VS Code's `DocumentSymbolProvider`. No custom AST parsing. Show null gracefully when it fails. Collect telemetry on failure rate. Revisit in Phase 2 only if data warrants it.
- **Activity throttling**: file_save at 5s, file_open at 2s, commits and branch switches are instant. Server-side max 1 event/user/second safety valve. All values are config constants.
- **Git integration depth**: Commits and branch switches only. No stash, rebase, or merge events in MVP. The ActivityEvent metadata field supports future extension.
- **Agent identity**: `type: human | agent` on User model and AwarenessState from day one. `parentUserId` links agents to their human owner. CLI and sidebar both render agents nested under their parent. Phase 2 adds agent identity config (naming, color assignment).
- **Stream naming**: "Activity feed" in the UI, "activity_log" in the database, "activityFeed" in the Yjs `Y.Array`. Users see a feed; the backend writes a log.
- **Idle detection**: 5 minutes of no editor activity triggers idle status. Any keystroke, scroll, or file switch resets to active. Simple timer in the extension.
- **Campfire Stories detail drill-down**: Clicking into a team from Campfire Stories shows a project-level summary page within the web app. It does NOT expose raw file-level activity. This protects dev trust.
- **User-to-team mapping**: One user, one team in MVP. Multi-team support deferred to Phase 3+.
- **CLI vs. TUI**: MVP is plain text with ANSI colors and emoji. No TUI framework (blessed, ink, etc.). Graphical TUI deferred to Phase 2.
- **Agent activity capture**: Git hooks for commits/branches, filesystem watcher for saves. Hooks installed by `campfire watch` on startup, persist across sessions. Filesystem watcher runs only while CLI is active.
- **Naming hierarchy**: Bonfire (org), Campfire (team), Flame (individual). Applied consistently across all surfaces.
- **Pricing**: Deferred. This is an internal hackathon project. No gating infrastructure needed.

---

_Build the campfire. Gather the team. Start sculpting together._
