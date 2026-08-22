# AXM Pong: Cross — low-poly visual pass 01

Status: `TEST · WORKING LOCAL GAME NIGHT BUILD`. This pass is not `CANON`.

## Improvement

The active runtime previously combined authored perspective plates with Canvas-only live geometry. This pass preserves the plates, labels, server authority, phone/controller seams, and fallback Canvas while adding a transparent registered WebGL relief canvas.

The new layer raises all four independently oriented paddles, colored square frame rails, the rotating central prism, and every active ball into faceted low-poly forms. The fragment output is quantized to sixteen light steps per color channel. Competitive and co-op state use the same renderer; the three-seat co-op Host Warden remains visible as the fourth defended edge.

## Browser observations

- Route: `http://127.0.0.1:8123/?room=AXM1&player=screen`
- Viewport: 1280 × 720.
- Four-seat versus: `cross-relief-v1`, 31 draw calls, 320 submitted triangles.
- Three-seat co-op plus Host Warden: 29 draw calls, 304 submitted triangles.
- Frame counter advanced from 273 to 295 during a bounded 420 ms versus observation.
- Both modes reported `hybrid-webgl-canvas`, `webgl-low-poly`, and `paletteSteps=16`.
- Browser logs were empty in the captured ready and running states.
- Saved screenshots were visually inspected; the four orientations, prism top/side planes, ball core, labels, overlays, and mission bar remained visible and unclipped.

## Checks

- `node --check runtime/neon-pong-cross-depth.js`: PASS.
- `node neon-cross-selftest.cjs`: PASS.
- All ten required Workshop checks: PASS (exit 0).
- `node verify.js`: 0 FAIL / 38 warnings.

## Boundaries

- Physical phone and gamepad QA remains pending; prior simulated gamepad evidence is not promoted to hardware evidence.
- Reduced Motion is code- and selftest-covered via the renderer media-query seam, but the browser binding exposed no media-emulation control for a live capture.
- Long-session performance, Steam packaging, human feel/balance, and Mike Tobi review remain pending.

