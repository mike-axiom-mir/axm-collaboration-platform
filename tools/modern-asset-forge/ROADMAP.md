# Modern Asset Forge phased roadmap

## Phase 0 — complete

- Preserve and hash the PS2 Asset Forge.
- Audit current modular hands separately from native substrate availability.
- Define portable source, job, asset, capability, evidence, and receipt contracts.
- Establish canonical GLB, KTX2/Basis, meshopt, WebGL2 baseline, optional WebGPU, and `.blend` authoring truth policies.
- Define four workload modes without claiming unavailable system telemetry.

## Phase 1 — compressed diagnostic loop proven, canonical run blocked

The machine has now proven GLB inspection, Khronos validation, meshopt encoding, bounded ETC1S/BasisLZ encoding, deterministic `KHR_texture_basisu` binding, independent KTX validation, matching local browser decoders, and a live compressed WebGL2 render. The proof remains diagnostic because its source was an existing GLB, the optimizer CLI is not yet substrate-locked, and human taste approval is deliberately separate.

Phase 1 becomes end-to-end READY only after all of these conditions are met:

1. A reviewed, exact Blender substrate passes a live version probe and creates a real GLB from preserved `.blend` source.
2. The Khronos glTF Validator passes that exact exported artifact with resource validation enabled.
3. A reviewed glTF Transform or gltfpack build produces meshopt delivery without dropping required application data.
4. Declared textures are encoded and bound into the GLB through `KHR_texture_basisu`, not merely written beside it.
5. Khronos KTX tools independently pass every emitted KTX2 with glTF restrictions enabled.
6. Matching browser KTX2 and meshopt decoder runtimes load the optimized artifact through WebGL2.
7. Runtime metrics and live visual evidence pass; human visual review is explicitly recorded.

No requirement is weakened when one of these is unavailable.

## Later phases — not started

- Phase 2: lawful source connectors, beginning with an official API path and explicit human-approved intake. No scraping.
- Phase 3: LOD/HLOD, instancing, visibility-aligned chunks, culling evidence, and scene-scale benchmarks.
- Phase 4: expanded animation, morph targets, root-motion and in-place policies, retarget sidecars, additive layers.
- Phase 5: selective USD/USDZ archive and large-scene interchange, never mandatory for small runtime assets.

Whole-library download remains outside every automatic path.
