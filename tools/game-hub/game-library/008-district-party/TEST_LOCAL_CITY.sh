#!/usr/bin/env bash
set -eu
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20 or newer is required."; exit 1; fi
npm test
npm run test:cli
npm run test:browser
