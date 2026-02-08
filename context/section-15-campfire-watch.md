15. Campfire Watch CLI (Terminal Interface)

15.1 Overview

campfire watch is a terminal-native interface for Campfires, designed for developers working primarily in Claude Code or other terminal workflows. It runs in a split terminal pane alongside the developer's workspace, providing the same ambient team awareness as the VS Code sidebar but in a terminal context.

This is not a replacement for the VS Code extension — it's a second surface for the same data pipeline. The extension captures activity; campfire watch displays it. A developer using Claude Code would have campfire watch in a narrow right pane (~35 characters wide) while their Claude Code session occupies the larger left pane.

15.2 Naming Hierarchy

The product uses a fire-based naming hierarchy across all surfaces (CLI, extension, Reel):

| Level | Name | Emoji | Scope |
|-------|------|-------|-------|
| Organization | Bonfire | 🔥 | Company-wide view (Gusto Bonfire) |
| Team | Campfire | 🏕️ | Team-level view (Payments Campfire) |
| Individual | Flame | 🎇 | Single developer's activity |

15.3 Three-Tier Layout

The campfire watch display has three information tiers, each zooming in:

Tier 1: Org Header
- Company name (Bonfire), active campfire count, online user count
- AI-generated one-liner summaries of what each campfire is working on
- These summaries are pulled from the Reel's existing summarization pipeline via REST — no separate AI pipeline needed
- Updates every 15-30 minutes (matches the Reel batch cycle)

Tier 2: Your Campfire
- Team name with member presence
- Each human member shows: name, status (active/idle/draft), current file → function
- Agents nested under their human owner with ↳ prefix and 🤖 icon
- Agents remain visible and active even when their human owner is idle
- Status indicators: 🔥 active, 💤 idle, 🔒 draft, 🤖 agent

Tier 3: Activity Feed
- Chronological stream of raw events from your campfire
- File saves, commits (highlighted), branch switches, file opens
- No AI interpretation — devs want the raw data in the terminal
- Same data as the VS Code sidebar activity feed

15.4 Technical Approach

campfire watch is a Node.js CLI that:
- Connects via WebSocket to the team's Yjs room (same connection as the VS Code extension)
- Fetches latest Reel summaries via REST for the org header
- Formats output for terminal display with ANSI colors/emoji
- Requires the same JWT auth token as the extension (stored locally after first login)

No new server infrastructure is needed. The CLI is a read-only client consuming existing WebSocket and REST endpoints.

15.5 Agent Activity Emission

Claude Code agents (and other CLI-based agents) cannot be instrumented directly. Instead, their activity is captured via:
- Git hooks: post-commit and post-checkout hooks broadcast events through the Campfires pipeline
- Filesystem watchers: a background process detects file saves in the workspace and attributes them to the active agent session

This requires a parentUserId field on agent users in the data model, linking each agent to its human owner for the nested display in Tier 2.

15.6 AI Summarization Context

The Reel's AI summarization (which feeds into Tier 1 of campfire watch) uses company context injected into the Claude API system prompt. Context sources:

MVP: Hardcoded/uploaded text provided during org setup
- Team names and descriptions of what each team owns
- Company mission statement
- Current roadmap or list of active projects/initiatives

Future (deferred): Notion integration as an automatic context provider, replacing or supplementing uploaded text. This would pull roadmap items, project docs, and team wikis directly from Notion via OAuth. The context injection interface should be designed as a simple text blob so that swapping in Notion (or other sources) later is just a new context provider behind the same interface.

15.7 Scope and Deferrals

In scope for the campfire watch CLI:
- Plain text terminal output with ANSI colors and emoji
- Three-tier layout (org header, team presence, activity feed)
- Read-only display (no interactive commands beyond starting/stopping)

Deferred:
- Graphical/TUI version (borders, scrollable regions, mouse interaction)
- Campfire-level AI summaries (only org-level summaries in MVP)
- Interactive commands (e.g., toggling draft mode from the CLI)
- Agent identity configuration (naming, color assignment for agents)
