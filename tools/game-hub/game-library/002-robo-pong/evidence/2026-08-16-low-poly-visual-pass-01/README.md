# AXM Pong: Duet — low-poly visual pass 01

Status: `WORKING TEST`. This pass is not `CANON`.

## Improvement

The active neon runtime previously used authored raster perspective plates plus a native 2D Canvas. This pass preserves those plates and the authoritative Canvas while adding a transparent, depth-tested WebGL relief layer registered to live server state.

The layer renders raised boundary rails, a faceted relay core, extruded Warden and player paddles, low-poly end caps, and a two-piece octahedron ball. Fragment colors are quantized to sixteen steps per channel. If WebGL is unavailable, the existing Canvas remains visible and the runtime reports `canvas-fallback`.

## Browser observations

- Route: `http://127.0.0.1:8122/?room=AXM1&player=screen`
- Viewport: 1280 × 720.
- Co-op: `duet-relief-v1`, 23 draw calls, 236 submitted triangles.
- Versus: `duet-relief-v1`, 18 draw calls, 184 submitted triangles.
- Frame counter advanced from 666 to 692 during a bounded 420 ms co-op observation.
- Both modes reported `hybrid-webgl-canvas`, `webgl-low-poly`, and `paletteSteps=16`.
- Browser logs were empty in ready and running states.
- Captures were visually inspected after saving; the faceted ball, paddle top/side planes, rails, labels, launch panel, and mission bar remained visible and unclipped.

## Checks

- `node --check runtime/neon-pong-duet-depth.js`: PASS.
- `node neon-duet-selftest.cjs`: PASS.
- All ten required Workshop checks: PASS (exit 0).
- `node verify.js`: 0 FAIL / 38 warnings.

## Boundaries

- Physical phone and gamepad QA remains pending.
- Reduced Motion is code- and selftest-covered through the renderer's media-query seam, but this browser binding did not expose a media-emulation control for a live screenshot.
- Long-session performance, Steam packaging, human feel/balance, and Mike Tobi review remain pending.

