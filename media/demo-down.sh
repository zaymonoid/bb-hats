#!/usr/bin/env bash
# Stop the demo bb. Pass --wipe to delete its data so the next demo-up.sh
# seeds from scratch.
set -euo pipefail
ROOT=${HATS_DEMO_ROOT:-/tmp/bb-hats-demo}
PORT=${HATS_DEMO_PORT:-39886}
pids=$(lsof -ti "tcp:$PORT" -ti "tcp:$((PORT + 1))" -sTCP:LISTEN 2>/dev/null || true)
[ -n "$pids" ] && kill $pids && echo "Stopped demo bb on port $PORT"
if [ "${1:-}" = "--wipe" ]; then
  sleep 1
  rm -rf "$ROOT" && echo "Deleted $ROOT"
fi
