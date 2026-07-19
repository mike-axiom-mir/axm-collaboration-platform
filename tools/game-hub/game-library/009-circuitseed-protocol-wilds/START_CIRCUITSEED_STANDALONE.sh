#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
HOST=127.0.0.1 PORT=8799 exec node server/server.js
