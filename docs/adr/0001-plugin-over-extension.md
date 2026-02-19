# ADR-0001: Plugin over VS Code Extension

## Status

Accepted

## Context

Campfires originally captured developer activity through a VS Code extension (`extension/`). This worked but had significant limitations: it only captured activity from VS Code users, required a complex extension build pipeline (esbuild, CSP, webview), and couldn't capture AI agent activity from Claude Code sessions. As Claude Code became the primary AI coding tool for our target users, we needed activity capture that lived where the AI work happens.

## Decision

Replace the VS Code extension with a Claude Code plugin (`campfires-plugin/`) as the primary data source. The plugin uses Claude Code's hook system (SessionStart, SessionEnd, UserPromptSubmit, PostToolUse) to capture activity ambiently. Session transcripts become the primary input to AI summarization, producing richer summaries than file-event-only data.

The VS Code extension and CLI are archived in `archive/v1-extension/` and `archive/v1-cli/` respectively.

## Consequences

- **Easier:** Activity capture is zero-config for Claude Code users (install plugin, login, done). Session transcripts give the summarizer much richer context than file events alone. The plugin is simple bash scripts (jq + curl) with no build step.
- **Harder:** Users of other AI coding tools (Cursor, Copilot) don't get automatic activity capture yet. A generic agent activity API is needed for non-Claude-Code tools (see AE-2 in business requirements).
