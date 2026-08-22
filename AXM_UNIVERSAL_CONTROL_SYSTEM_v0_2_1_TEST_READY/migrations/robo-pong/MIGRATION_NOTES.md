# Robo Pong migration bridge

## Why this is a bridge, not a rewrite

The current server already owns game truth, accepts local phone input, exposes keyboard fallback, and has working `left`, `right`, and `power` behavior. Those pieces are preserved.

The patch adds a second input boundary:

```text
POST /axm/input?player=p1
```

That route accepts semantic AXM input frames. The bridge translates:

- `MOVE.x < -0.18` → current `left = true`
- `MOVE.x > 0.18` → current `right = true`
- rising edge of `PRIMARY_ACTION` → current `usePower(player)`
- `PAUSE` or `OPEN_MENU` → current pause toggle

The old `/input` route remains during proof and rollback.

## Install into a copy first

Copy these files into `games/002-robo-pong/runtime/`:

```text
legacy-robo-pong-bridge.cjs
robo-pong-semantic-phone.html
```

Apply `neon-pong-duet-server.patch` to the server file in a test branch or extracted copy. Do not edit the only working copy.

Open:

```text
http://PC-LAN-IP:8792/semantic-controller?player=p1
```

## Proof gate before replacing the old client

Measure and record:

- hold-left and hold-right reliability;
- stick center stability;
- release after browser blur;
- reconnect after Wi-Fi interruption;
- special action fires once per press;
- no accidental simultaneous left/right;
- frame and network impact;
- rollback by returning to the original `/input` client.

Only after this passes should the new semantic controller become the default Robo Pong link.
