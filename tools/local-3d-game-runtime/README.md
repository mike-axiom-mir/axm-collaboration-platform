# Local 3D Game Runtime

An experimental, dependency-independent AXM gameplay runtime. It is the first P0 vertical slice in the next-50-modules roadmap.

## What is real in v0.1

- AXM-owned WebGL2 shaders and renderer; no Three.js or runtime package dependency.
- GLB 2.0 parsing for the proof fixtures, including embedded images, digest-bound same-origin pack textures, texture transforms, materials, nodes, skins, and LINEAR/STEP animation sampling.
- A fixed 60 Hz deterministic game state with start, pause, resume, reset, objectives, and a completion outcome.
- Keyboard navigation, pointer orbit, zoom, sprint, day/night presentation, and visible frame evidence.
- Dependency-free Performance, PS2 baseline, and PS3 lighting-preview profiles covering pixel density, fog, exposure, highlight rolloff, vignette, and deterministic grain. These affect presentation only and never certify source-asset quality.
- Exact SHA-256 identities for five local PS2 Asset Forge fixtures: storefront, animated person, modular building, hatchback, and foliage.
- A digest-bound P0 production-cell contract connects the outputs and open gates from modules #1–#10 without promoting candidates into the permanent library.

## Honest limits

This is a navigation and integration slice, not yet a full game engine. There is no full 3D collision/physics, persistence, multiplayer, automatic publishing, automatic library promotion, or PS3-quality asset claim. A profile named PS3 Preview is only a bounded renderer experiment. Those remain separate roadmap gates.

## Run and verify

Serve the Workshop root through the local Hub server, then open `/tools/local-3d-game-runtime/index.html`.

```powershell
node "C:\axm workshop\tools\local-3d-game-runtime\selftest.js"
```
