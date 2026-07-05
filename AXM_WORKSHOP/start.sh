#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js required: https://nodejs.org"; exit 1; }
(sleep 1; xdg-open http://127.0.0.1:8788 2>/dev/null || open http://127.0.0.1:8788) &
node server.js
