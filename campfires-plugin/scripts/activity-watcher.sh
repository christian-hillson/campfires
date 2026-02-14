#!/bin/bash
# Watches for high-signal tool uses: git commits, branch switches, file writes
# Sends activity events to the Campfires server

set -euo pipefail
source "$(dirname "$0")/lib/config.sh"

if [[ "$CAMPFIRES_SHARE_MODE" == "off" ]]; then
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Only send events for high-signal tools
case "$TOOL_NAME" in
  Bash)
    # Check if this was a git command
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    if [[ "$COMMAND" == git\ commit* ]]; then
      EVENT_TYPE="commit"
      # Try to extract commit message
      MESSAGE=$(echo "$COMMAND" | grep -oP '(?<=-m\s")[^"]*' || echo "$COMMAND")
      BRANCH=$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    elif [[ "$COMMAND" == git\ checkout* ]] || [[ "$COMMAND" == git\ switch* ]]; then
      EVENT_TYPE="branch_switch"
      MESSAGE=""
      BRANCH=$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    else
      # Not a git command we care about — skip
      exit 0
    fi
    ;;
  Write|Edit)
    EVENT_TYPE="file_save"
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    MESSAGE=""
    BRANCH=$(cd "$CWD" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    ;;
  *)
    # Not a tool we track — skip
    exit 0
    ;;
esac

# Build JSON payload safely using jq to escape all user-controlled strings
PAYLOAD=$(jq -n \
  --arg sid "$SESSION_ID" \
  --arg uid "$CAMPFIRES_USER_ID" \
  --arg tid "$CAMPFIRES_TEAM_ID" \
  --arg type "$EVENT_TYPE" \
  --arg file "${FILE_PATH:-}" \
  --arg branch "$BRANCH" \
  --arg message "$MESSAGE" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{session_id: $sid, user_id: $uid, team_id: $tid, type: $type, file: $file, branch: $branch, message: $message, timestamp: $ts}')

# Send activity event
curl -sf -X POST "$CAMPFIRES_SERVER_URL/api/activity" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
  -d "$PAYLOAD" > /dev/null 2>&1 &

exit 0
