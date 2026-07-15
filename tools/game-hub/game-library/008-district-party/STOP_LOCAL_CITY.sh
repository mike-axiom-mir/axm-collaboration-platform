#!/usr/bin/env bash
set -u
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.axm-district-party.pid"
if [ ! -f "$PID_FILE" ]; then echo "No AXM District Party PID file was found. It may already be stopped."; exit 0; fi
PID="$(tr -cd '0-9' < "$PID_FILE")"
if [ -z "$PID" ]; then echo "The PID file is invalid; no process was stopped."; exit 1; fi
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running. Removing the stale local PID file."
  rm -f "$PID_FILE"
  exit 0
fi
COMMAND="$(ps -p "$PID" -o args= 2>/dev/null || true)"
case "$COMMAND" in
  *server/server.js*|*server\\server.js*) ;;
  *) echo "Refusing to stop PID $PID because it is not the AXM District Party server."; exit 1 ;;
esac
kill "$PID"
echo "Stopped AXM District Party process $PID."
rm -f "$PID_FILE"
