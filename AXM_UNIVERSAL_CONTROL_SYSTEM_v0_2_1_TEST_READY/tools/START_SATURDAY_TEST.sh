#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
printf '%s\n' 'Starting AXM Universal Controls v0.2.1 Saturday test...'
printf '%s\n' 'Open http://127.0.0.1:8787/host on this computer.'
exec node server/reference-server.cjs
