# Holodeck Kernel

Status: `TEST` foundation, not canonical and not promoted.

The Node and browser kernels load `tools/deterministic-json-core`. Exported
serialization and cloning refuse unsupported or lossy JSON state; the legacy
`stableValue` normalizer remains available for existing world-normalization
callers.

Holodeck is a substrate-independent world compiler. A canonical world document carries identity, coordinates, entities, appearance data, state, interactions, sensory descriptions, narrative purpose, and truth boundaries. The compiler turns that meaning into a renderer-neutral deck plan. Screen, VR, fabrication, robotics, and future physical-space systems are adapters; none owns the world.

Version zero deliberately uses primitive graphics. Its proof target is the shared data spine:

1. validate `axm.holodeck-world/v1`;
2. normalize set-like world data deterministically;
3. compile `axm.holodeck-deck-plan/v1` without renderer objects;
4. dispatch the same `axm.holodeck-intent/v1` for humans and machines;
5. expose `axm.holodeck-sensor-frame/v1` from structured state;
6. create explicit, world-bound local snapshots;
7. project the plan through the replaceable Screen Deck adapter.

Run the kernel proof:

```powershell
node shared/holodeck/selftest.js
```

Open the first deck through the Workshop server:

```text
http://127.0.0.1:8788/tools/holodeck-screen-deck/index.html
```

The browser surface exposes `window.AXMHolodeckDeck.observe()` and `window.AXMHolodeckDeck.dispatch(intent)`. Those calls use the same dispatcher as keyboard and touch controls. They grant no extra authority.

## Truth boundary

This is an interactive screen simulation. It is not a VR or AR runtime, volumetric hologram, haptic environment, scientific world simulator, autonomous reality manipulator, or physical matter-control system. The structured sensory frame reports simulation state and proximity; it does not pretend to be camera vision.
