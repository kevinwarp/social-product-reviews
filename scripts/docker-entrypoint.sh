#!/bin/sh
set -e

echo "[entrypoint] Refreshing featured searches before going live…"
node scripts/refresh-featured-searches.js

echo "[entrypoint] Featured searches up to date — starting server."
exec node server.js
