# Campfires Awareness

This skill provides context about the Campfires plugin for team awareness.

When the user asks about their team, what teammates are working on, or wants to coordinate with other developers, use the /campfires:team command to check team status.

When the user wants to change their visibility, use /campfires:share to toggle share mode.

The Campfires plugin automatically tracks this session's activity and shares it with the team (if share mode is enabled). The developer doesn't need to do anything — it happens via hooks in the background.

Key concepts:
- **Share mode**: Controls what gets sent to the team. "full" streams transcripts incrementally throughout the session, "heartbeat" shares presence only, "off" is invisible.
- **Transcript streaming**: When share mode is "full", new transcript content is sent to the server on every prompt submission (not just at the end). This means the Reel can show work-in-progress summaries of what you're building mid-session.
- **Heartbeats**: Keep the developer's status as "active" on the team campfire during the session.
- **The Reel**: A web app where anyone in the org can see AI-summarized activity from all teams. Non-developers use this to understand what engineering is building.
