# ADR-0005: Append-Only Activity Log

## Status

Accepted

## Context

The server records developer and agent activity events (file saves, commits, branch switches, session starts/ends). These events feed into AI summarization and the real-time activity feed. The question was whether activity records should be mutable (updateable, deletable) or immutable (append-only).

## Decision

The `activity_log` table is strictly append-only. Events are never updated or deleted. New state is expressed by appending new events, not by modifying existing ones.

## Consequences

- **Easier:** Data integrity is guaranteed — there's no risk of corrupting historical data through accidental updates. The summarizer can trust that past events haven't changed. Debugging is simpler because the log is a complete, ordered record. Conflict resolution is trivial (last write wins for presence, all events are preserved for activity).
- **Harder:** Storage grows monotonically. A retention/archival strategy will eventually be needed. Correcting bad data requires appending a correction event rather than fixing the original. Privacy-related deletion (e.g., GDPR right to erasure) requires special handling.
