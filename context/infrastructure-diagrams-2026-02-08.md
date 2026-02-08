# Campfires — Infrastructure Diagrams

**February 8, 2026**

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                        │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  VS Code Extension│  │  campfire watch  │  │     Reel Web App         │   │
│  │  (Campfires IDE)  │  │  (Terminal CLI)  │  │  campfires.app/org/{id}  │   │
│  │                   │  │                  │  │                          │   │
│  │  - Sidebar panel  │  │  - Tier 1: Org   │  │  - AI summary feed      │   │
│  │  - Gutter badges  │  │  - Tier 2: Team  │  │  - Team cards            │   │
│  │  - Status bar     │  │  - Tier 3: Feed  │  │  - Detail drill-down     │   │
│  │  - Draft mode     │  │  - File watcher  │  │                          │   │
│  │  - Idle detection │  │  - Git watcher   │  │  Read-only consumer      │   │
│  │                   │  │                  │  │  No WebSocket connection  │   │
│  │  PRODUCER + CONSUMER  PRODUCER + CONSUMER  │                          │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
│           │                     │                          │                 │
└───────────┼─────────────────────┼──────────────────────────┼─────────────────┘
            │ WebSocket           │ WebSocket                │ HTTP (REST + SSE)
            │                     │                          │
┌───────────┼─────────────────────┼──────────────────────────┼─────────────────┐
│           ▼                     ▼                          ▼        SERVER   │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────────┐   │
│  │          y-websocket Server             │  │      Express REST API   │   │
│  │                                         │  │                         │   │
│  │  Yjs Room: campfire:{teamId}            │  │  /auth/*    Auth        │   │
│  │  ┌───────────────┐ ┌─────────────────┐  │  │  /orgs/*    Org CRUD   │   │
│  │  │  Awareness    │ │  Y.Array        │  │  │  /teams/*   Team CRUD  │   │
│  │  │  (ephemeral)  │ │  activityFeed   │  │  │  /agents/*  Agent mgmt │   │
│  │  │               │ │  (rolling 500)  │  │  │  /orgs/:id/summaries   │   │
│  │  │  Who's online │ │  Recent events  │  │  │  /orgs/:id/summaries/  │   │
│  │  │  File/branch  │ │  for sidebar    │  │  │    stream (SSE)        │   │
│  │  │  Status       │ │                 │  │  │  /teams/:id/activity   │   │
│  │  └───────────────┘ └────────┬────────┘  │  │  /health               │   │
│  └─────────────────────────────┼───────────┘  └─────────────────────────┘   │
│                                │                                            │
│                                │ Server-side listener                       │
│                                │ persists events                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        SQLite (WAL mode)                             │   │
│  │                                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │   │
│  │  │  orgs    │ │  teams   │ │  users   │ │ activity │ │ summaries │ │   │
│  │  │          │ │          │ │          │ │   _log   │ │           │ │   │
│  │  │  name    │ │  name    │ │  email   │ │ (append  │ │  AI text  │ │   │
│  │  │  mission │ │  orgId   │ │  teamId  │ │  only)   │ │  teamId   │ │   │
│  │  │  roadmap │ │  invite  │ │  type    │ │          │ │  period   │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Batch Summarizer (every 15-30 min)                 │   │
│  │                                                                      │   │
│  │  activity_log ──> Claude API (Sonnet) + company context ──> summaries│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Real-Time Data Flow

How a single dev action flows through the system:

```
  Developer saves a file
          │
          ▼
  ┌───────────────────┐
  │  VS Code Extension │    OR    ┌──────────────────┐
  │  onDidSaveDocument │          │  CLI FileWatcher  │
  └─────────┬─────────┘          │  fs.watch()       │
            │                     └────────┬─────────┘
            ▼                              ▼
  ┌──────────────────────────────────────────────┐
  │  Throttle check (5s per file)                │
  │  Duplicate? ──> Drop silently                │
  │  New? ──> Continue                           │
  └──────────────────┬───────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────┐
  │  Push to Yjs Y.Array (activityFeed)          │
  │                                              │
  │  {                                           │
  │    id: uuid,                                 │
  │    type: "file_save",                        │
  │    userId: "...",                             │
  │    file: "src/api.ts",                       │
  │    timestamp: "2026-02-08T14:30:00Z"         │
  │  }                                           │
  └──────────────────┬───────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │  Yjs CRDT sync      │
          │  (WebSocket)        │
          └──────────┬──────────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
  ┌─────────┐  ┌─────────┐  ┌──────────┐
  │ Other   │  │ Other   │  │  Server  │
  │ VS Code │  │ CLI     │  │ listener │
  │ clients │  │ clients │  │          │
  │         │  │         │  │ Persists │
  │ Sidebar │  │ Tier 3  │  │ to SQLite│
  │ updates │  │ updates │  │ activity │
  │         │  │         │  │ _log     │
  └─────────┘  └─────────┘  └──────────┘
```

---

## 3. Awareness vs. Activity (Two Separate Channels)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Yjs Room: campfire:{teamId}                     │
│                                                                     │
│  ┌───────────────────────────────┐  ┌────────────────────────────┐  │
│  │     AWARENESS PROTOCOL        │  │     Y.Array activityFeed   │  │
│  │     (ephemeral, in-memory)    │  │     (persisted to SQLite)  │  │
│  │                               │  │                            │  │
│  │  What it carries:             │  │  What it carries:          │  │
│  │  - Who is online              │  │  - file_open               │  │
│  │  - Current file + function    │  │  - file_save               │  │
│  │  - Current branch             │  │  - commit (+ message)      │  │
│  │  - Status (active/idle/draft) │  │  - branch_switch           │  │
│  │  - User color                 │  │  - session_start           │  │
│  │  - Last activity timestamp    │  │  - session_end             │  │
│  │                               │  │                            │  │
│  │  Lifetime: gone when you      │  │  Lifetime: rolling 500     │  │
│  │  disconnect. 30s timeout.     │  │  events in Yjs, permanent  │  │
│  │                               │  │  in SQLite activity_log    │  │
│  │  Updates: continuous          │  │  Updates: on each event    │  │
│  │  (every keystroke resets      │  │  (throttled per type)      │  │
│  │   lastActivity)               │  │                            │  │
│  │                               │  │                            │  │
│  │  Used by:                     │  │  Used by:                  │  │
│  │  - Sidebar presence list      │  │  - Sidebar activity feed   │  │
│  │  - CLI Tier 2 (team members)  │  │  - CLI Tier 3 (feed)       │  │
│  │  - Gutter decorations         │  │  - Reel (via SQLite)       │  │
│  │  - Status bar online count    │  │  - AI summarization input  │  │
│  └───────────────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reel Summarization Pipeline

```
                              Every 15-30 minutes
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         BATCH SUMMARIZER                            │
│                                                                     │
│  1. Query activity_log since last run, grouped by team              │
│                                                                     │
│     SELECT * FROM activity_log                                      │
│     WHERE timestamp > last_summarization                            │
│     GROUP BY teamId                                                 │
│                                                                     │
│  2. For each team, build prompt:                                    │
│                                                                     │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  SYSTEM PROMPT                                          │     │
│     │                                                         │     │
│     │  Company: {org.name}                                    │     │
│     │  Mission: {org.mission}                                 │     │
│     │  Roadmap: {org.roadmap}                                 │     │
│     │  Team: {team.name} — {team.description}                 │     │
│     │                                                         │     │
│     │  RAW EVENTS                                             │     │
│     │  - alice committed "Add Stripe webhook handler"         │     │
│     │  - alice saved src/payments/webhook.ts (x12)            │     │
│     │  - bob switched to branch feat/billing-migration        │     │
│     │  - bob committed "Update invoice model for new schema"  │     │
│     │  ...                                                    │     │
│     └─────────────────────────────────────────────────────────┘     │
│                          │                                          │
│                          ▼                                          │
│                   Claude API (Sonnet)                                │
│                          │                                          │
│                          ▼                                          │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  OUTPUT                                                 │     │
│     │                                                         │     │
│     │  content: "The payments team is actively building       │     │
│     │  Stripe webhook support. Alice has been focused on      │     │
│     │  the webhook handler while Bob is updating the          │     │
│     │  invoice data model — both part of the Q1 billing       │     │
│     │  migration on the roadmap."                             │     │
│     │                                                         │     │
│     │  oneLiner: "Building Stripe webhook support for         │     │
│     │  Q1 billing migration"                                  │     │
│     └─────────────────────────────────────────────────────────┘     │
│                          │                                          │
│  3. Store in summaries table                                        │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ Reel App   │ │ CLI Tier 1 │ │ REST API   │
     │            │ │            │ │            │
     │ Full       │ │ oneLiner   │ │ Both       │
     │ content    │ │ per team   │ │ fields     │
     │ + detail   │ │            │ │            │
     │ drill-down │ │            │ │            │
     └────────────┘ └────────────┘ └────────────┘
```

---

## 5. Agent Activity Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer's Terminal                                            │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │  Left pane             │  │  Right pane                    │  │
│  │                        │  │                                │  │
│  │  Claude Code           │  │  campfire watch --dir .        │  │
│  │  (or other agent)      │  │                                │  │
│  │                        │  │  Tier 1: Acme Bonfire          │  │
│  │  Writes files ────────────▶  Tier 2:                       │  │
│  │  Makes commits ───────────▶    Alice  active  api.ts       │  │
│  │  Switches branches ──────▶    ↳ Claude  active  api.ts     │  │
│  │                        │  │    Bob    idle                  │  │
│  │                        │  │  Tier 3:                       │  │
│  │                        │  │    14:30 Claude committed ...  │  │
│  │                        │  │    14:28 Alice saved api.ts    │  │
│  └────────────────────────┘  └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

HOW AGENT EVENTS ARE CAPTURED:

  Agent writes to disk
        │
        ├──────────────────────┐
        ▼                      ▼
  ┌──────────────┐    ┌──────────────────┐
  │ FileWatcher  │    │ GitWatcher       │
  │ (fs.watch)   │    │ (.git/HEAD,      │
  │              │    │  .git/refs/...)   │
  │ Detects file │    │                  │
  │ changes      │    │ Detects commits  │
  │              │    │ + branch switches│
  └──────┬───────┘    └────────┬─────────┘
         │                     │
         ▼                     ▼
  ┌─────────────────────────────────────┐
  │  pushActivityEvent()               │
  │  userType: 'agent'                 │
  │  parentUserId: human's userId      │
  │                                    │
  │  Pushed to Yjs activityFeed        │
  │  over existing WebSocket           │
  └─────────────────────────────────────┘

  ALSO (future): git hooks
  ┌─────────────────────────────────────┐
  │  .git/hooks/post-commit             │
  │  .git/hooks/post-checkout           │
  │                                     │
  │  Calls POST /agents/activity        │
  │  with agent JWT                     │
  │  (works even when CLI isn't running)│
  └─────────────────────────────────────┘
```

---

## 6. Auth & Connection Flow

```
  ┌───────────────────────┐         ┌──────────────────────────┐
  │  VS Code Extension    │         │  CLI (campfire watch)    │
  │                       │         │                          │
  │  Token stored in      │         │  Token stored in         │
  │  VS Code SecretStorage│         │  ~/.campfires/token      │
  └───────────┬───────────┘         └────────────┬─────────────┘
              │                                  │
              │  POST /auth/login                 │
              │  { email, password }              │
              ▼                                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                        SERVER                                │
  │                                                              │
  │  Returns JWT containing:                                     │
  │  {                                                           │
  │    userId:  "abc-123",                                       │
  │    email:   "alice@acme.com",                                │
  │    teamId:  "team-456",                                      │
  │    orgId:   "org-789",                                       │
  │    type:    "human"                                          │
  │  }                                                           │
  └──────────────────────────────────────────────────────────────┘
              │                                  │
              ▼                                  ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  WebSocket connects to ws://server/campfire:{teamId}         │
  │                                                              │
  │  1. Authenticate with JWT (passed as query param)            │
  │  2. Join Yjs room for the team                               │
  │  3. Broadcast awareness state                                │
  │  4. Listen for awareness + activity updates                  │
  │  5. Refresh awareness every 15s (stay within 30s timeout)    │
  └──────────────────────────────────────────────────────────────┘
```
