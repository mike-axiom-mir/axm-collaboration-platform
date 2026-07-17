#!/usr/bin/env bash
set -u
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "AXM DISTRICT PARTY could not start: Node.js was not found."
  echo "Install Node.js 20 or newer, then run this file again."
  exit 1
fi
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"; then
  echo "AXM DISTRICT PARTY could not start: Node.js 20 or newer is required."
  echo "Detected: $(node --version)"
  exit 1
fi

export PORT=8795

echo "AXM DISTRICT PARTY v0.1.7"
echo "Host launcher: http://127.0.0.1:8795/"
echo "Party A screen: http://127.0.0.1:8795/party-screen.html?party=party_a"
echo "Party B screen: http://127.0.0.1:8795/party-screen.html?party=party_b"
echo "Health: http://127.0.0.1:8795/health"
echo "Status: LOCAL LAN ONLY · no public tunnel"
echo "The server will print a phone LAN URL only if a private address is detected."
echo "Press Ctrl+C to stop."
exec node server/server.js
