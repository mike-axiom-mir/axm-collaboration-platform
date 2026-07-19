# Visual capability ladder

## PS2 floor — current build

- Local GLB source pool with vehicles, architecture, roads, props, damage parts, foliage, and animated people.
- Seeded recipes, procedural asphalt/concrete/brick wear, editable signs/posters, day/night lighting, shadows, fog, animation, and binary GLTF export.
- One volatile preview; explicit human approval before export; no automatic candidate accumulation.
- Remaining acceptance work: Mike's visual verdict, more coherent road/building placement recipes, collision hulls, LOD generation, UV-density checks, and engine import proof.

## PS3 rung — build after the PS2 gate passes

- Already salvaged as a bounded preview capability: switchable local bloom, vignette, and grain profiles. This closes a viewport-compositing seam only; it does not advance the asset-quality claim.
- PBR material baker for albedo, normal, roughness, metalness, ambient occlusion, and packed channel maps.
- Decal and trim-sheet authoring, weighted normals, mesh simplification with silhouette error bounds, automatic LOD groups, collision proxies, and lightmap UVs.
- Larger skeletal library, animation retargeting, facial bones/blend shapes, cloth/hair cards, vehicle interiors, and modular destruction states.
- Scene validation inside the actual AXM game runtime with frame-time, memory, draw-call, mip, and streaming budgets.

## PS4 rung — build only after PS3 evidence passes

- High-to-low baking, tangent-space verification, virtualized texture pages, material instances, mesh instancing, impostors, and hierarchical LOD.
- Authorable weather layers, vertex blending, photogrammetry cleanup, physically based sky/IBL, reflection probes, volumetrics, particles, and GPU-friendly crowds.
- Platform quality profiles, automated performance captures, accessibility review, and a human art-director gate for every promoted family.

Each rung is additive. A later label is forbidden until live game evidence proves the visual and performance gate; triangle count or file count alone never upgrades the claim.
