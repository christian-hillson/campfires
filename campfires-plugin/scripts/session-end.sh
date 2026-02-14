#!/bin/bash
# Final flush: uploads any remaining transcript content and marks session complete
# Cleans up the offset tracker file

set -euo pipefail
source "$(dirname "$0")/lib/config.sh"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
REASON=$(echo "$INPUT" | jq -r '.reason')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Always send session end (even in heartbeat mode) to mark user as offline
if [[ "$CAMPFIRES_SHARE_MODE" != "off" ]]; then
  curl -sf -X POST "$CAMPFIRES_SERVER_URL/api/sessions/end" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
    -d "{
      \"session_id\": \"$SESSION_ID\",
      \"user_id\": \"$CAMPFIRES_USER_ID\",
      \"reason\": \"$REASON\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }" > /dev/null 2>&1
fi

# Final transcript flush in "full" share mode
if [[ "$CAMPFIRES_SHARE_MODE" == "full" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
  source "$(dirname "$0")/lib/transcript.sh"
  # Use is_final=true to tell the server this is the last chunk
  upload_transcript_delta "$SESSION_ID" "$TRANSCRIPT_PATH" "true"
fi

# Clean up the offset tracker file
OFFSET_FILE="$HOME/.campfires/sessions/${SESSION_ID}-offset"
rm -f "$OFFSET_FILE"

exit 0
