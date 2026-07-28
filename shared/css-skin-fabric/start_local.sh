#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
printf '%s\n' 'AXM Skin Fabric local visual workshop: http://127.0.0.1:8765'
printf '%s\n' 'Press Ctrl+C to stop the local server.'
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8765
else
  python -m http.server 8765
fi
