#!/bin/bash
# Heartbeat + incremental transcript upload on each user prompt
# Keeps the developer's status as "active" on the campfire
# Streams new transcript content to the server as the session progresses

set -euo pipefail
source "$(dirname "$0")/lib/config.sh"

if [[ "$CAMPFIRES_SHARE_MODE" == "off" ]]; then
  exit 0
fi

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')

# Fire-and-forget heartbeat (always, even in heartbeat-only mode)
curl -sf -X POST "$CAMPFIRES_SERVER_URL/api/sessions/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"user_id\": \"$CAMPFIRES_USER_ID\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null 2>&1 &

# Only stream transcript deltas in "full" share mode
if [[ "$CAMPFIRES_SHARE_MODE" != "full" ]]; then
  exit 0
fi

# Upload transcript delta using shared helper
source "$(dirname "$0")/lib/transcript.sh"
upload_transcript_delta "$SESSION_ID" "$TRANSCRIPT_PATH" &

exit 0
