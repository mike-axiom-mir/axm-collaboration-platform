# AXM PS2 Asset Forge v0.2

This module is the replacement for the rejected software-triangle asset baseline. It is a real local WebGL/GLTF authoring surface: source meshes are loaded as GLB, materials and textures render in 3D, rigged people animate, generated surface maps and editable signs are composed into the scene, and an approved result exports as binary GLTF.

## What the numbers mean

The catalog contains **291 reusable CC0 source GLBs** from five independently attributed packs. They are not 291 generated candidates. The unused 145-piece gray-box Prototype Kit was deliberately removed because source volume is not quality. Models, previews, textures, and license files together occupy about **14.3 MB**. The curated pool includes vehicles, roads, buildings, props, damage parts, vegetation, storefront pieces, and four animated pedestrians.

The forge keeps exactly one generated preview in memory. Forging again replaces it. It does not save variants, add them to the Library, or promote them automatically. A human approval action is required before GLB export becomes available.

## Local render polish

The viewport now has three explicit renderer profiles: **PS2 Native** (the default), **PS3 Preview**, and **PS3 High Preview**. The two preview profiles add a local r160-compatible bright pass, separable bloom, subtle vignette, and bounded film grain. They do not rewrite source materials, add another light rig, change recipes, or affect exported GLBs.

This layer salvages the useful post-processing ideas from the staged `intakes/ps3-graphics-organ-v0.1` package. The original archive and byte-identical source remain preserved as provenance. Its CDN loader, Three.js r128 compatibility code, duplicate renderer/lighting setup, global material upgrader, generic normal-map mutation, and blockout demo are not runtime dependencies of this Forge.

## Run

From the Workshop root:

```powershell
node tools/ps2-asset-forge/server.js
```

Open `http://localhost:8902/`. When the main Workshop server is running, the module is discoverable from the Hub under **Create → PS2 Asset Forge** through its manifest.

Run focused verification:

```powershell
node tools/ps2-asset-forge/scripts/build-catalog.js
node tools/ps2-asset-forge/selftest.js
```

## Current quality claim

Technical capability is proven for local composition, seeded surfaces, texture embedding, source provenance, skinned animation, recipe handoff, and binary GLTF export. The included street and storefront images demonstrate a credible PS2-era direction, but they remain human-unapproved benchmark evidence. This module does not claim PS3 or PS4 quality.

The PS3-named renderer profiles are comparison tools, not a rung promotion. A nicer post stack cannot compensate for missing PS3-grade meshes, UVs, PBR maps, LODs, collision, animation breadth, or game-runtime performance evidence.

The old generated pack in `exports/game-assets/urban-ps2-baseline-20260719` remains rejected visual evidence and is not a promoted source for this forge.
