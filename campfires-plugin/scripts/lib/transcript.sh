#!/bin/bash
# Handles incremental transcript uploads via byte-offset tracking.
# Called by both heartbeat.sh (mid-session) and session-end.sh (final flush).
#
# The transcript file is a .jsonl that Claude Code appends to throughout the session.
# We track how many bytes we've already uploaded in /tmp/campfires-{session_id}-offset.
# On each call, we read only the new bytes (the delta) and send them to the server.
# The server appends these deltas to build the complete transcript.

upload_transcript_delta() {
  local session_id="$1"
  local transcript_path="$2"
  local is_final="${3:-false}"  # "true" on SessionEnd, "false" during session

  local offset_file="$HOME/.campfires/sessions/${session_id}-offset"

  # Read last uploaded offset (default to 0 if file missing)
  local last_offset=0
  if [[ -f "$offset_file" ]]; then
    last_offset=$(cat "$offset_file" 2>/dev/null || echo "0")
  fi

  # Check transcript exists
  if [[ ! -f "$transcript_path" ]]; then
    return 0
  fi

  # Get current file size
  local current_size
  current_size=$(wc -c < "$transcript_path" 2>/dev/null || echo "0")

  # Nothing new to send
  if [[ "$current_size" -le "$last_offset" ]]; then
    # Still notify server on final flush so it knows the session is complete
    if [[ "$is_final" == "true" ]]; then
      curl -sf --max-time 10 -X POST "$CAMPFIRES_SERVER_URL/api/sessions/transcript-delta" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
        -d "{
          \"session_id\": \"$session_id\",
          \"offset\": $last_offset,
          \"delta\": \"\",
          \"is_final\": true,
          \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" > /dev/null 2>&1
    fi
    return 0
  fi

  # Extract the new content (everything after last_offset)
  # Using tail -c + to get bytes from offset to end of file
  local delta
  delta=$(tail -c +$((last_offset + 1)) "$transcript_path" 2>/dev/null || echo "")

  if [[ -z "$delta" ]]; then
    return 0
  fi

  # Send delta to server
  # The delta is raw .jsonl lines — we JSON-encode it for safe transport
  curl -sf --max-time 15 -X POST "$CAMPFIRES_SERVER_URL/api/sessions/transcript-delta" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
    -d "{
      \"session_id\": \"$session_id\",
      \"offset\": $last_offset,
      \"delta\": $(echo "$delta" | jq -Rs .),
      \"is_final\": $is_final,
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }" > /dev/null 2>&1

  # Update offset only if upload succeeded
  if [[ $? -eq 0 ]]; then
    echo "$current_size" > "$offset_file"
  fi
}
