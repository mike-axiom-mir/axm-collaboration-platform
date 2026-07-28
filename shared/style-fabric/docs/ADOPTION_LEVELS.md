# Adoption Levels

Current AXM games do not yet have skin hooks. Connect them progressively rather than claiming universal runtime support immediately.

| Level | Game change | What users can reskin |
| --- | --- | --- |
| 0 | Add theme tokens/post-processing adapter | Palette, glow, contrast, broad UI/world finish |
| 1 | Route presentation assets through registered slots | Backgrounds, tiles, sprites, icons, panels |
| 2 | Add semantic entity and environment slots | Players, enemies, props, terrain, rewards, VFX |
| 3 | Add animation/rig/anchor profiles | Full character and equipment appearance |
| 4 | Add renderer-specific material and geometry adapters | PBR, advanced VFX, meshes, per-instance materials |

Every game keeps an Original Appearance fallback. Missing or incompatible skin content inherits that original instead of rendering blank.

New games should start with:

1. `game-skin-contract.json`
2. a small adapter implementing describe/apply/rollback;
3. an original-appearance fallback;
4. a specimen scene;
5. conformance tests that prove no authoritative writes.

“Any style” means any style that the game’s renderer and declared slots can express. A 2D game can become paper, pixel, neon, painted, matte, metallic-emulated, cartoon, or many other looks. It cannot become true 3D unless a 3D-capable adapter and assets exist.
