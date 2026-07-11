#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
AXM_PORT=8788 exec node server.js --open=launcher
