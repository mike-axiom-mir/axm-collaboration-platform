#!/bin/sh
# AXM workshop + bridge, one command, two separate processes.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js required: https://nodejs.org"; exit 1; }
if [ -f bridge/axm-bridge.js ]; then
  if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "[bridge] starting with no keys set yet (health works; AI calls return honest no-key errors)"
  else
    echo "[bridge] starting (the only key holder)"
  fi
  node bridge/axm-bridge.js &
  BRIDGE=$!
  trap "kill $BRIDGE 2>/dev/null" EXIT
else
  echo "[bridge] skipped (bridge folder missing) - workshop runs fine without it"
fi
(sleep 1; xdg-open http://127.0.0.1:8788 2>/dev/null || open http://127.0.0.1:8788) &
node server.js
