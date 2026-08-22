# AXM Compact Defense Turret

- Asset ID: `AXM-TURRET-001`
- Version: `0.4.0`
- Family: `turret-prop`
- Build profile: `full`
- Validation status: **WARN**
- License: `LicenseRef-AXM-Private-Working`

The canonical source is `source/recipe.json`. Derived meshes can always be regenerated.

## Game outputs

- `game/AXM-TURRET-001.glb` — LOD0 in **metres**, +Y up, +Z forward
- `game/lod/` — lower-complexity GLBs when enabled
- `game/collision/` — simple component collision GLB
- `game/sockets.json` — converted gameplay attachment positions

## Manufacturing outputs

Full builds add a millimetre-based 3MF assembly and local, grounded, deduplicated STL parts. Quantities and placement transforms are stored separately.

Physical manufacture remains subject to slicer, material, tolerance, orientation, support, and human review.
