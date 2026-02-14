#!/bin/bash
# Shared HTTP helper for Campfires API calls
# Handles retries, timeouts, and error logging

CAMPFIRES_LOG_DIR="$HOME/.campfires/logs"
mkdir -p "$CAMPFIRES_LOG_DIR"

campfires_post() {
  local endpoint="$1"
  local data="$2"
  local max_retries=2
  local timeout=5

  for attempt in $(seq 1 $max_retries); do
    if curl -sf --max-time "$timeout" \
      -X POST "$CAMPFIRES_SERVER_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CAMPFIRES_API_KEY" \
      -d "$data" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  # Log failure silently — never interrupt the developer
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FAILED: POST $endpoint" >> "$CAMPFIRES_LOG_DIR/errors.log"
  return 1
}
