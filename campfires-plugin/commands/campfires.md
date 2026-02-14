Show the current Campfires plugin status. Read the config from ~/.campfires/config.json and display:

1. **Share mode**: Current share mode (full / heartbeat / off)
2. **Server**: Connected server URL and connection status (ping the /health endpoint)
3. **Identity**: Your display name, team name, and org name (fetch from server if possible, fall back to IDs from config)
4. **Recent activity**: Count of events sent this session (read from ~/.campfires/logs/session.log if it exists)

Format the output clearly for the terminal. If ~/.campfires/config.json doesn't exist, tell the user to run /campfires:login first.
