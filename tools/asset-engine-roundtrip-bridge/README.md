# Asset ↔ Engine Round-trip Bridge

P0 module #2. This module compiles an immutable GLB source into a versioned engine asset contract, then verifies the source descriptor and engine payload as separate inputs.

The proof covers exact source identity, bytes, coordinate system, units, hierarchy, transforms, pivots, bounds, meshes, accessors, PBR materials, embedded images, rigs, animations, and extension declarations. Unsupported runtime features enter an explicit loss registry and block a clean pass.

The bridge never edits the GLB. A technical parity pass is not visual approval and does not promote an asset.

```powershell
node "C:\axm workshop\tools\asset-engine-roundtrip-bridge\selftest.js"
```
