#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
STUDIO="$ROOT/OPEN_STUDIO.html"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$STUDIO" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then open "$STUDIO"
else printf '%s\n' "Open this file in a browser: $STUDIO"
fi
