#!/bin/bash
# Loads Campfires configuration from ~/.campfires/config.json
# Sets environment variables for use by all hook scripts

CONFIG_FILE="$HOME/.campfires/config.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  # No config = plugin not set up, exit silently
  export CAMPFIRES_SHARE_MODE="off"
  return 0 2>/dev/null || exit 0
fi

# Enforce restrictive permissions on config (contains auth token)
chmod 600 "$CONFIG_FILE" 2>/dev/null

export CAMPFIRES_SERVER_URL=$(jq -r '.server_url // empty' "$CONFIG_FILE")
export CAMPFIRES_API_KEY=$(jq -r '.api_key // empty' "$CONFIG_FILE")
export CAMPFIRES_USER_ID=$(jq -r '.user_id // empty' "$CONFIG_FILE")
export CAMPFIRES_TEAM_ID=$(jq -r '.team_id // empty' "$CONFIG_FILE")
export CAMPFIRES_ORG_ID=$(jq -r '.org_id // empty' "$CONFIG_FILE")
export CAMPFIRES_SHARE_MODE=$(jq -r '.share_mode // "off"' "$CONFIG_FILE")

# If any critical config is missing, disable
if [[ -z "$CAMPFIRES_SERVER_URL" ]] || [[ -z "$CAMPFIRES_API_KEY" ]]; then
  export CAMPFIRES_SHARE_MODE="off"
fi
