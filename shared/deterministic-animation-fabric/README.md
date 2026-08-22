# AXM Deterministic Animation Fabric

Status: **TEST**. This subsystem is candidate material; it is not installed,
promoted, canonical, or aesthetically approved.

The fabric turns modular data-only motion graphs into repeatable animation
assets. It complements the existing game animation state spine, procedural
motion presets, pixel animation workshop, rigged GLTF hand, and film timeline.
It does not silently rename any of those contracts.

## What it adds

- Integer time ticks with an exact ticks-per-frame relationship.
- Fixed-point values at precision `1,000,000`; multiply, interpolation and
  remapping use integer/BigInt arithmetic instead of elapsed-frame integration.
- Acyclic composable nodes: constant, keyframes, triangle/saw/square wave,
  seeded held noise, add, multiply, clamp, remap and absolute value.
- Reusable block definitions and namespaced instances. Built-ins cover an
  oscillator, seeded noise and an envelope; recipes can declare more without
  executable code.
- Bounded clip compositions with up to 32 embedded recipe sources and 128
  explicitly ordered layers. Each layer declares its active trim window,
  source-in tick, positive rational playback rate, clamp/loop/ping-pong time
  domain, property filter, retargeting prefix, blend mode and fixed-point
  weight.
- Deterministic `replace`, `add` and `multiply` layer blending. A composition
  remains stateless and can be sampled at arbitrary output ticks in any order.
- Stateless arbitrary-tick sampling, bounded exact baking, canonical recipe and
  bake digests, timed events, CSS keyframes, and SVG filmstrip proofs.
- Exact-frame SVG sprite atlases with an `axm.sprite-atlas/v1` manifest for
  small and medium animation assets. The atlas is bounded to 256 frames and
  16,777,216 logical pixels.
- A declared adapter from `axm.procedural-motion/v1`. Named source easing is
  recorded as a loss when it is normalized to fixed-point smoothstep.

## Minimal use

```js
const Fabric = require("./shared/deterministic-animation-fabric");

const recipe = Fabric.createCandidateRecipe({
  id: "future-project-motion",
  seed: "project-seed-7",
  frames_per_second: 30,
  frame_count: 60,
  width: 96,
  height: 96,
});

const compiled = Fabric.compileRecipe(recipe);
const frame17 = Fabric.sampleCompiled(compiled, 17000);
const baked = Fabric.bake(compiled);
const css = Fabric.renderCssKeyframes(baked);
const filmstrip = Fabric.renderFilmstripSvg(baked, recipe.presentation);
const receipt = Fabric.verify(recipe);

const composition = Fabric.createCandidateComposition({
  id: "future-project-layered-motion",
  seed: "project-seed-7",
  frames_per_second: 30,
  frame_count: 60,
  width: 96,
  height: 96,
});
const composed = Fabric.compileComposition(composition);
const composedBake = Fabric.bakeComposition(composed);
const atlasSvg = Fabric.renderSpriteAtlasSvg(composedBake, {
  frame_width: 96,
  frame_height: 96,
});
const atlasManifest = Fabric.createSpriteAtlasManifest(composedBake, {
  name: "Future Project Motion",
  image: "future-project-motion-atlas.svg",
  frame_width: 96,
  frame_height: 96,
});
```

The baked `samples_i` values are integers. Divide them by each track's
`precision` only at a renderer boundary. This keeps the reusable artifact exact
while CSS, SVG, game-engine, DOM, canvas, shader, and DCC adapters remain free to
choose their native numeric representation.

For a separate human playback, editing, accessibility, or aesthetic-review
surface, use [HUMAN_SENSORY_HANDOFF.md](HUMAN_SENSORY_HANDOFF.md). It records
the exact eight-artifact Asset Hand package, the output-to-edit schema mapping,
safe composition round trips, and the live temporal evidence that is still
missing. The handoff does not authorize edits to another surface or convert a
technical pass into human approval.

## Determinism boundary

The selftest proves equal recipe or composition data produces the same compiled
digest, baked integer samples, CSS, SVG and digest in repeated calls and a
fresh Node process. It exercises rational half-speed mapping, ping-pong layers,
fixed-point additive blending, exact atlas frame coverage and arbitrary sample
order.

It does **not** prove identical rasterization across browsers/GPUs, final media
encoding, deformation quality, good motion taste, or parity with a future engine
adapter. Embedded source events are not silently time-remapped; composition
events must be authored explicitly. Those boundaries require their own runtime,
semantic and visual evidence. Human visual review remains required.

Run:

```powershell
node shared/deterministic-animation-fabric/selftest.js
node shared/deterministic-animation-fabric/human-sensory-handoff-selftest.js
node shared/asset-hands/deterministic-animation-fabric-selftest.js
```
