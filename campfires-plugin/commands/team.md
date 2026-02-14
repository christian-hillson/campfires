Show your current Campfires team. Fetch the team members from the server and display their current status.

Read config from ~/.campfires/config.json, then call GET /teams/{team_id}/members on the server.

Display each team member with:
- Name
- Status (active / idle / draft / offline)
- What they're working on (current file/function if available)
- Last activity timestamp

Format as a clean terminal-friendly table or list.
