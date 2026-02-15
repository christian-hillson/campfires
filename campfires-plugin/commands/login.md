Set up the Campfires plugin. This is the first-time onboarding flow that handles login, signup, and auto-provisioning of org and team.

Walk the user through each step interactively:

## Step 1: Gather connection info

Ask the user for:

1. **Server URL** — Default to `http://localhost:3000` for local dev. Accept any URL.
2. **Email** — Their email address.
3. **Password** — Their password.
4. **Display name** — Their preferred display name (used in team views and summaries).

## Step 2: Authenticate

Try `POST {server_url}/api/auth/login` with `{ email, password }`.

- **If 200 OK**: Login succeeded. Extract the `token` and `user` from the response.
- **If 401 Unauthorized**: The account doesn't exist or the password is wrong. Ask the user if they'd like to create a new account. If yes, call `POST {server_url}/api/auth/signup` with `{ email, password, displayName }`. Extract the `token` and `user` from the response.
- **If the server is unreachable**: Show a clear error and suggest checking the URL.

## Step 3: Ensure the user has an org

Check if `user.orgId` is set and non-empty.

- **If no org**: Create one automatically. Use the basename of the git remote origin URL (or the git repo root directory name, or "My Organization" as a last resort) as the org name. Call `POST {server_url}/api/orgs` with `{ name }` using the Bearer token. Extract `orgId` from the response.

## Step 4: Ensure the user has a team

Check if `user.teamId` is set and non-empty.

- **If no team**: Create one automatically. Use the current working directory basename (or "My Team" as a fallback) as the team name. Call `POST {server_url}/api/teams` with `{ orgId, name }` using the Bearer token. Extract the `team` from the response (includes `teamId` and `inviteCode`).

## Step 5: Refresh the token

After creating org/team, the original JWT won't have the updated claims. Call `POST {server_url}/api/auth/refresh` with the Bearer token to get a fresh token that includes `orgId` and `teamId`.

## Step 6: Write config

Create `~/.campfires/` directory if it doesn't exist, then write `~/.campfires/config.json`:

```json
{
  "server_url": "<server_url>",
  "token": "<refreshed_token>",
  "user_id": "<user.userId>",
  "email": "<email>",
  "team_id": "<teamId>",
  "org_id": "<orgId>",
  "share_mode": "full"
}
```

## Step 7: Confirm success

Show a success message including:
- Server URL
- Organization name
- Team name
- Team invite code (so they can share with teammates)
- Share mode (full)

Remind them that teammates can join with `/campfires:login` and use the invite code via `/campfires:team`.
