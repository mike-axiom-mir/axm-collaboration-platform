#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if [ -f bridge/axm-bridge.js ]; then
  (cd bridge && node axm-bridge.js) &
fi
AXM_PORT=8788 exec node server.js --open=launcher
