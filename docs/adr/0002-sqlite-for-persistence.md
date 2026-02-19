# ADR-0002: SQLite for Persistence

## Status

Accepted

## Context

The server needs to persist users, teams, organizations, activity logs, summaries, and sparks. Options considered were PostgreSQL, SQLite, and in-memory stores. At this stage, the product is single-server, single-process, and prioritizes simplicity and fast iteration over horizontal scaling.

## Decision

Use SQLite via `better-sqlite3` for all server persistence. The database file is auto-created on first run, requires no external service, and supports the full SQL feature set we need.

## Consequences

- **Easier:** Zero infrastructure beyond a Node.js process. No database server to provision, configure, or maintain. Developers can run the full stack with `npm run dev:server`. Database is a single file that can be deleted and recreated.
- **Harder:** Single-writer constraint means the server is single-process. Horizontal scaling will require migrating to PostgreSQL or similar. SQLite file locking means only one server instance can access the database at a time.
