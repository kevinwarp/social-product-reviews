#!/bin/sh
set -e

echo "[entrypoint] Starting server…"
node server.js &
SERVER_PID=$!

# Wait for the server to be ready before refreshing
echo "[entrypoint] Waiting for server to become ready on port ${PORT:-8080}…"
for i in $(seq 1 30); do
  if wget -q --spider "http://localhost:${PORT:-8080}/" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "[entrypoint] Refreshing featured searches in background…"
node scripts/refresh-featured-searches.js
REFRESH_EXIT=$?

if [ "$REFRESH_EXIT" -ne 0 ]; then
  echo "[entrypoint] ✗ Featured search refresh failed (exit $REFRESH_EXIT). Stopping server."
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

echo "[entrypoint] ✓ Featured searches up to date."
wait $SERVER_PID
