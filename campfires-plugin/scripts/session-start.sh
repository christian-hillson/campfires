#!/bin/bash
# Reads JSON from stdin with: session_id, transcript_path, cwd, source, model
# Sends session registration to Campfires server
# Initializes the transcript byte-offset tracker for incremental uploads

set -euo pipefail

# Source shared config
source "$(dirname "$0")/lib/config.sh"

# Exit silently if share mode is off
if [[ "$CAMPFIRES_SHARE_MODE" == "off" ]]; then
  exit 0
fi

# Parse input from Claude Code
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')
SOURCE=$(echo "$INPUT" | jq -r '.source')

# Detect git context
BRANCH=$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
REPO=$(cd "$CWD" && basename "$(git rev-parse --show-toplevel 2>/dev/null)" || echo "unknown")

# Initialize transcript offset tracker (start at 0 bytes)
OFFSET_DIR="$HOME/.campfires/sessions"
mkdir -p "$OFFSET_DIR" && chmod 700 "$OFFSET_DIR"
OFFSET_FILE="$OFFSET_DIR/${SESSION_ID}-offset"
echo "0" > "$OFFSET_FILE"
chmod 600 "$OFFSET_FILE"

# Send session start to server
curl -sf -X POST "$CAMPFIRES_SERVER_URL/api/sessions/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"user_id\": \"$CAMPFIRES_USER_ID\",
    \"team_id\": \"$CAMPFIRES_TEAM_ID\",
    \"repo\": \"$REPO\",
    \"branch\": \"$BRANCH\",
    \"source\": \"$SOURCE\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null 2>&1 &

# Fire and forget — don't block Claude Code startup
exit 0
