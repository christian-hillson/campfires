# Campfires

Read CONTRIBUTING.md for repo conventions, branch prefixes, and development setup.
Read ROADMAP.md for current sprint status, feature ownership, and what's in progress.
Read campfires-build-spec-v3.md in the context folder for the original technical specification (v1 prototype).

## Architecture

Campfires has three layers:

1. **Source — Claude Code Plugin** captures developer activity (file edits, commands, sessions) and uploads session transcripts when Share is enabled. Plugin design is in progress.
2. **System — Campfires Server** stores activity, manages teams/orgs, and runs AI summarization via Claude API.
3. **Surface — Campfire Stories (Web App)** displays a pixel-art organization map, Fireside Panel with AI summaries, and real-time activity log.

## Stack

- TypeScript throughout (server, campfire-stories, shared)
- Node.js + Express for the server
- Vite for the Campfire Stories web app
- SQLite (better-sqlite3) for persistence
- Claude API for AI summarization

## Structure

Core packages: shared/, server/, campfire-stories/
Plugin: campfires-plugin/ (Claude Code hooks, commands, skills)
Reference docs: context/
Legacy (v1 prototype): extension/, cli/

## Naming

- **Bonfire** — organization level ("Acme Bonfire")
- **Campfire** — team level ("Payments Campfire")
- **Flame** — individual developer's activity stream
- **Golem** — AI agent's activity stream

## Rules

- shared/types.ts is the source of truth for all data types
- Activity log is append-only, never update or delete rows
- All throttling values are config constants, not hardcoded
- Campfire Stories never exposes raw dev activity to non-devs — only AI-summarized project-level information
- Human and agent (golem) activity are separated — `type` field on every user and awareness state
- Agents are nested under their human owner via `parentUserId`
