# User Asset Pipeline — v0.2.6

Status: **IMPLEMENTED LOCALLY · RAW INPUTS PRESERVED · RUNTIME ALPHA VERIFIED**

## Purpose

This pass turns Mike's two supplied art batches into a bounded, offline runtime set without pretending that a visible checkerboard is transparency. It does not change simulation authority, collision, combat, vehicles, seat identity or save data.

## Processing method

1. Copy all 15 supplied PNGs unchanged into dated `assets/source/user_generated/.../raw/` folders.
2. Hash the raw copies before runtime curation.
3. Use background-only image editing to retain the subject while replacing the baked checkerboard/background with a controlled chroma field.
4. Run the local alpha helper on that field.
5. Visually inspect contact sheets.
6. Split the four-player roster into four separate identities.
7. Rotate both vehicles into the renderer's zero-radian orientation (front points right).
8. Trim, centre, pad and downscale the runtime selection.
9. Retain the original Kenney assets as load-safe fallbacks.

Representative edit prompt family:

> Preserve the supplied subject and its design. Remove only the existing checkerboard/background and place the isolated subject on a single flat chroma background. Do not add labels, shadows, new objects or alter the subject.

Mode: built-in image editing followed by local chroma removal and deterministic runtime normalization. The original source was always retained separately.

## Runtime selection

- 4 playable AXM identities
- 4 ordinary residents
- 2 vehicle presentations
- 2 shopkeeper previews
- 4 Tilburg-style landmark buildings

Two supplied multi-building sheets remain staged only. One flawed resident matte remains retained for audit but is excluded from every runtime path; `resident_woman_backpack-v2.png` is the accepted asset.

## Authority and placement rules

- Building overlays are visual. Their recorded footprints sit on existing host collision and their approaches are collision-clear.
- Shopkeepers are visual previews marked `interaction: not-implemented`.
- Civilian identity is selected by stable NPC-ID hash, not array order.
- Slots 5–8 safely cycle the four current player images while retaining unique server seat IDs, numbers, names and party outlines.
- No browser client decides collision, vehicle health, NPC identity, shop transactions or inventory state.

## Licensing boundary

Mike identified this batch as AXM project art generated under his direction in his ChatGPT platform workspace. On 2026-07-19 he authorized its inclusion and redistribution inside this public AXM repository and its public-safe packages. It is intentionally not described as CC0 and no standalone/general reuse license is implied. See `assets/AXM_GENERATED_ART_AUTHORIZATION.md`.

Machine-readable details: `assets/USER_GENERATED_ASSET_MANIFEST.json`.
