#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "AXM Living Globe vNext v0.10 — Shared Island Brief"
echo "Open http://127.0.0.1:8765/"
echo "Press Ctrl+C to stop."
python3 -m http.server 8765 --bind 127.0.0.1
