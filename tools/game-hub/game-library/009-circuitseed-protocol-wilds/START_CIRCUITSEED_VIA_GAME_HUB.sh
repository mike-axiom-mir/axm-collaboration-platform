#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
exec node scripts/start-via-game-hub.js
