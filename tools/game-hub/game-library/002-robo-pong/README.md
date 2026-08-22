# AXM Pong: Duet 002

Status: **WORKING TEST** · local browser and Game Night build · physical phone QA pending.

Duet is the 1–2 player half of the AXM Pong pair. It keeps server-authoritative movement and outcomes while combining AXM Aetherglass lighting, three playable arenas, story/co-op rules, a compact local-versus route, and a registered low-poly WebGL relief layer.

The arena plates remain the authored environmental backdrop. A transparent depth-tested WebGL canvas now raises the live paddles, Warden, relay core, boundary rails, and ball into faceted 3D. The shader uses sixteen light steps per color channel, while the original Canvas layer remains the gameplay-readable fallback when WebGL is unavailable.

## Play modes

- **Story / Co-op — 1–2 players.** One ready human receives an AI wingmate; two ready humans share the lower defense. Returns charge the relay, missed light damages the shared core, and sealing a breach opens the next chapter.
- **Duet Versus — 1v1.** Two ready seats defend opposite edges in a first-to-seven match. With one human seat, the second seat remains an adapter opponent for local training.

## Arenas

1. **Cathedral Cross — Seal the Breach.** A restrained square light chamber and the shortest story target.
2. **Shattered Line — The Shattered Line.** A shallow-perspective glass corridor built around a visible fracture.
3. **Relay Protocol — Light the Relay.** A diamond-field finale with the longest charge target and the least core tolerance.

Every arena plate is a real project-local raster asset. Paddles, ball position, collisions, charge, score, pause, map choice, AI control, and outcomes remain live authoritative state rather than being baked into the art.

## Controls

- Phone/touch: **LEFT**, **RIGHT**, and **USE POWER**.
- Shared keyboard: P1 uses **A / D** and **Space**; P2 uses **Left / Right Arrow** and **Enter**.
- Shared-screen Xbox/Brawl gamepads: pad 1 controls P1 and pad 2 controls P2. Left stick or D-pad moves, **A** or right trigger uses power, and **Menu** pauses. Other buttons may remain unused.
- **Escape** pauses or resumes from the shared screen.

Random specials remain available: Mega Shield, Paddle Warp, Slow Field, and Signal Jam.

## Local runtime

The Game Hub manages `runtime/neon-pong-duet-server.cjs` on port `8792`.

Direct local routes:

- Shared screen: `http://127.0.0.1:8792/?room=AXM1&player=screen`
- P1 controller: `http://127.0.0.1:8792/?room=AXM1&player=p1`
- P2 controller: `http://127.0.0.1:8792/?room=AXM1&player=p2`

The older `robo-pong-simple-bat-server.cjs` and `ROBO_PONG_PHASER4_PHONE_CLIENT.html` remain in the package as a rollback/reference checkpoint; the manifest launches the neon Duet runtime.

Run `node neon-duet-selftest.cjs` from this package folder for the story/co-op and 1v1 authoritative-state smoke test.

## Honest verification boundary

Local HTTP, authoritative state, mode/map configuration, sparse gamepad mapping, keyboard/controller delivery, and browser rendering can be tested on this machine. Real Xbox/gamepad feel, same-Wi-Fi latency, vibration, safe-area behavior, reconnect timing, and simultaneous physical-phone input remain a separate device QA gate.
