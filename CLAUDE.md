# Campfires

Read CONTRIBUTING.md for repo conventions, branch prefixes, and development setup.
Read campfires-build-spec-v3.md in the context folder for the full technical specification.

## Stack
- TypeScript throughout (server, extension, reel, shared)
- Node.js + Express + y-websocket for the server
- VS Code Extension API for the IDE client
- Vite for the Reel web app
- SQLite (better-sqlite3) for persistence
- Yjs for real-time sync and awareness

## Structure
Monorepo with five packages: server/, extension/, cli/, reel/, shared/

## Rules
- shared/types.ts is the source of truth for all data types
- Extension webview is a renderer only — no Yjs state in the webview
- Activity log is append-only, never update or delete rows
- All throttling values are config constants, not hardcoded
