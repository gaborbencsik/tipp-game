#!/bin/sh
# Render cron entrypoint for the internal sync endpoints.
# Required env vars: BACKEND_URL, SYNC_SERVICE_TOKEN, ENDPOINT
# Posts to "$BACKEND_URL/api/internal/sync/$ENDPOINT" with bearer auth.

set -eu

if [ -z "${BACKEND_URL:-}" ] || [ -z "${SYNC_SERVICE_TOKEN:-}" ] || [ -z "${ENDPOINT:-}" ]; then
  echo "missing required env: BACKEND_URL=${BACKEND_URL:-} SYNC_SERVICE_TOKEN=${SYNC_SERVICE_TOKEN:+set} ENDPOINT=${ENDPOINT:-}" >&2
  exit 2
fi

URL="${BACKEND_URL%/}/api/internal/sync/${ENDPOINT}"
echo "POST $URL"

exec curl --fail-with-body -sS -X POST \
  -H "Authorization: Bearer ${SYNC_SERVICE_TOKEN}" \
  "$URL"
