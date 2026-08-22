# Hearthgate: Two Sides — low-poly visual pass 01

Status: `WORKING` visual increment on a `TEST` package. This is not `CANON`.

## What changed

- Added flat-shaded octahedron and pyramid meshes to the dependency-free WebGL renderer.
- Rebuilt the WebGL warden family with faceted heads, crests, limbs, weapons, and contact shadows.
- Gave Raider, Skitter, Brute, Relic, Hexer, and Warlord models distinct low-poly silhouettes and props.
- Added faceted details to Forge, Market, and Alchemist buildings while preserving the existing Ballista profile.
- Lowered only the authoritative Canvas actor-body accents to 44% opacity so WebGL bodies remain visible; tactical rings, labels, health, aim, and interaction marks remain legible.
- Added live model-profile, draw-call, triangle, frame, and motion diagnostics.

## Live browser observations

- Route: `http://127.0.0.1:8121/?qa=oath`
- Viewport: 1280 × 720.
- Four-threat formation: `webgl-low-poly`, `faceted-models-v1`, 60 draw calls, 674 submitted triangles.
- Frame counter advanced from 7923 to 7988 during a bounded 420 ms observation.
- Reduced Motion changed the renderer diagnostic from `animated-drift-bob` to `reduced-static` without removing geometry.
- High Contrast and Reduced Motion remained simultaneously active with the same 60-draw / 674-triangle threat scene.
- Built Ballista state rendered 43 draw calls / 480 triangles and retained authoritative build data.
- Browser console/log inspection was empty for the checked states.

## Checks

- `npm test`: PASS — core deterministic selftest, six-minute semantic playtest, 3D selftest, and server HTTP test.
- All ten required Workshop checks: PASS (exit 0).
- `node verify.js`: 0 FAIL / 38 pre-existing warnings.
- Browser screenshots: manually inspected after capture; no blank scene, clipping, error overlay, or missing WebGL layer observed.

## Boundaries

- No physical gamepad or phone-controller hardware was available in this pass.
- Compact-viewport recheck remains pending from the prior Oathbound evidence.
- Steam packaging, human balance, long-session performance, and Mike Tobi review remain unrun.
- Passing checks do not canonize the package.

