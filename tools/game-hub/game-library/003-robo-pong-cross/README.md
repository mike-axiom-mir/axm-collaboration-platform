# AXM Pong: Cross 003

Status: **WORKING TEST** · local browser and Game Night build · physical 3/4-phone QA pending.

Cross is the 3–4 player half of the AXM Pong pair. It uses one server-authoritative four-edge arena, real shared-screen presentation, controller-only phone routes, three arena maps, and separate competitive and cooperative rules.

## Play modes

- **Cross Versus — 3–4 players.** Each ready seat guards one edge. Missing the ball costs a life; an eliminated or unused edge seals into a bounce wall until one light remains.
- **Relay Co-op — 3–4 players.** Different teammates must touch the light to arm the relay. An armed strike against the central Warden damages it; a missed team edge damages the shared core. In a three-seat session the unused fourth edge becomes the Warden side.

## Arenas

1. **Cathedral Cross — Seal the Breach.** Square, dark, and immediately readable for competitive play.
2. **Shattered Line — Hold the Fracture.** A perspective corridor with a smaller, faster central prism.
3. **Relay Protocol — Break the Warden.** A diamond light chamber with the largest Warden core and strongest relay focus.

Each arena uses a generated project-local raster plate behind live paddles, balls, trails, lives, relay state, Warden state, and outcomes. The Aetherglass Lighting Director receives explicit match events for finite pulses; it never controls gameplay or permissions.

## Controls

- Phone/touch: two edge-relative movement buttons and **USE POWER**.
- Shared keyboard: P1 **A / D**, P2 **J / L**, P3 **W / S**, P4 **Up / Down Arrow**.
- Number keys **1–4** trigger the corresponding player's power when that seat is human.
- **Escape** pauses or resumes from the shared screen.

The controller-only phone layout preserves the cached shell and avoids rendering a duplicate full arena.

## Human, adapter, and Host AI seats

Cross keeps all three seat types distinct. Human controllers and explicit external adapters both submit allowlisted movement/power intentions through `cross-seat-authority-v1`; game-local `ai` paddles alone use the built-in server driver. The three-seat co-op Warden is therefore Host AI, while an unconnected adapter remains still instead of being silently automated.

The host-local `/api/host/bootstrap` route issues runtime controller links and private adapter bindings. Adapter observations are token-bound projections of the shared arena and that seat's HUD, never the raw input buffers, capability tokens, random state, or client-authored outcomes. See `AI_NATIVE_SEAT_CONTRACT.md` for the exact packet, observation, and evidence boundary.

## Local runtime

The Game Hub manages `runtime/neon-pong-cross-server.cjs` on port `8793`.

Direct local routes:

- Shared screen: `http://127.0.0.1:8793/?room=AXM1&player=screen`
- Controller: `http://127.0.0.1:8793/?room=AXM1&player=p1` (replace `p1` with `p2`, `p3`, or `p4`)

The older `robo-pong-cross-server.cjs` and `robo-pong-cross-client.html` remain as a rollback/reference checkpoint; the manifest launches the neon Cross runtime.

Run `node neon-cross-selftest.cjs` from this package folder for the 3-player co-op, 3-player versus, and 4-player versus authoritative-state smoke test.

## Controller disconnect recovery

Every accepted human input renews a bounded server-side lease. The controller shell sends a 750 ms heartbeat, while the server clears held movement and marks the seat disconnected after 2.5 seconds without input traffic. A later valid packet reconnects the same seat and resumes control without resetting the authoritative match.

`neon-cross-selftest.cjs` runs this lifecycle with a short test lease: it proves that a vanished controller cannot leave a ghost movement behind and that the same seat can reconnect while the match tick and phase continue. This is code-level disconnect recovery evidence; simultaneous physical-phone and same-Wi-Fi QA remain pending separately.

## Honest verification boundary

Local HTTP, authoritative state, three/four-seat configuration, map/mode behavior, keyboard/controller delivery, pause, and browser rendering can be tested on this machine. Simultaneous physical-device input, vibration, same-Wi-Fi recovery, and installable-shell behavior remain separate phone QA.
