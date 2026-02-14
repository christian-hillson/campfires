Set up the Campfires plugin. This is the first-time setup flow.

Prompt the user for:
1. **Server URL** — The Campfires server URL (e.g., https://campfires.example.com). Default to http://localhost:3000 for local dev.
2. **Email** — Their email address for the Campfires account.
3. **Password or API key** — Either their password (which gets exchanged for a JWT) or a pre-generated API key.

Then:
1. Create ~/.campfires/ directory if it doesn't exist
2. Call the server's /auth/login endpoint to authenticate
3. Fetch the user's team and org info from the server
4. Write ~/.campfires/config.json with all the credentials and IDs
5. Set share_mode to "full" by default
6. Confirm successful setup

If the server is unreachable, show a clear error and suggest checking the URL.
