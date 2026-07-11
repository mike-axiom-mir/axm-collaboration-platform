#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
AXM_PORT=8790 exec node server.js --open=hub
