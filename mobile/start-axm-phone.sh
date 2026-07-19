#!/data/data/com.termux/files/usr/bin/bash
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
RUNTIME="$ROOT/state/mobile-host"
LOGS="$ROOT/logs/mobile-host"
URL="http://127.0.0.1:8788/hub/index.html?device=phone"
mkdir -p "$RUNTIME" "$LOGS"

running() {
  [ -f "$RUNTIME/$1.pid" ] || return 1
  pid="$(cat "$RUNTIME/$1.pid" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

start_one() {
  name="$1"; log="$2"; shift 2
  if running "$name"; then return 0; fi
  rm -f "$RUNTIME/$name.pid"
  (
    cd "$ROOT"
    nohup "$@" >> "$LOGS/$log" 2>&1 &
    echo $! > "$RUNTIME/$name.pid"
  )
}

stop_one() {
  name="$1"
  if running "$name"; then
    pid="$(cat "$RUNTIME/$name.pid")"
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$RUNTIME/$name.pid"
}

status() {
  printf 'AXM phone host\n'
  for service in hub bridge game-hub; do
    if running "$service"; then printf '  %-10s ON  pid %s\n' "$service" "$(cat "$RUNTIME/$service.pid")";
    else printf '  %-10s OFF\n' "$service"; fi
  done
  printf '  Hub: %s\n' "$URL"
}

case "${1:-run}" in
  stop)
    stop_one game-hub; stop_one bridge; stop_one hub
    echo 'AXM phone host stopped.'
    exit 0
    ;;
  restart)
    bash "$0" stop
    ;;
  status)
    status
    exit 0
    ;;
  run|start) ;;
  *)
    echo "Usage: bash $0 [run|status|stop|restart]"
    exit 2
    ;;
esac

command -v node >/dev/null 2>&1 || {
  echo 'Node.js is required. In Termux run: pkg update && pkg install nodejs'
  exit 1
}

start_one bridge bridge.log env AXM_BRIDGE_PORT=8787 node bridge/axm-bridge.js
start_one game-hub game-hub.log env AXM_GAME_HUB_HOST=0.0.0.0 AXM_GAME_HUB_PORT=8789 node tools/game-hub/game-hub-server.js
start_one hub hub.log env AXM_HOST=127.0.0.1 AXM_PORT=8788 AXM_NO_BROWSER=1 node server.js --open=none

ready=0
i=0
while [ "$i" -lt 40 ]; do
  if node -e "require('http').get('$URL',r=>{r.resume();process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))" >/dev/null 2>&1; then ready=1; break; fi
  i=$((i+1)); sleep 0.25
done

status
if [ "$ready" -ne 1 ]; then
  echo "Hub did not answer yet. Read $LOGS/hub.log"
  exit 1
fi
if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "$URL" >/dev/null 2>&1 || true
elif command -v am >/dev/null 2>&1; then am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 || true
fi
echo 'AXM is running on this phone. Android may pause it if battery optimisation kills Termux.'
