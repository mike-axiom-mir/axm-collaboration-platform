# AXM Game Asset Foundation

This service produces an original, dependency-free urban game-asset family with a **2002-2006 / PS2-era presentation floor**. Anything below that floor is a prototype and must not enter the public game catalog. It does not copy a commercial game's art, map, characters, brands, or textures, and it never turns a technical pass into human art approval.

## What one build produces

- 5 buildings, 5 road/plaza modules, 8 street props, 5 vehicles, and 4 pedestrians: 27 visible assets.
- Three strict descending OBJ LODs and an AABB collision record for every asset.
- PS2-density geometry floors, family budgets, and a 32-material 1024 x 1024 procedural atlas.
- Four drop-in looks (day, dusk, night, rain): 108 renderable asset/style combinations over shared geometry.
- Representative PBR delivery as GLB, PNG channel maps, KTX2 ETC1S, editable recipes, and validation reports.
- Four animated GLBs whose 13-joint skin uses the same detailed LOD0 geometry shown in the visual preview.
- A representative urban-block scene, collision/navigation candidates, 1600 x 1200 contact sheets, a 1600 x 900 composed street scene, and a standalone Canvas 3D viewer.
- A machine-readable pack manifest with budgets, digests, evidence gates, provenance boundaries, and no automatic publishing authority.

The implementation uses Workshop's local Asset Hands and Node built-ins. It downloads nothing and has no required third-party runtime dependency.

## Build a candidate pack

```powershell
node shared/game-asset-foundation/cli.js --out exports/urban-ps2-baseline --zip
```

Use `--full` to PBR-bake every non-character asset. The default representative mode proves one route per static family. The output directory must be new or empty; existing work is never silently replaced.

## Release boundary

`PS2_TECHNICAL_CANDIDATE_PASS` proves that the generated package clears its structural PS2 floor: family coverage, geometry density and budgets, LOD monotonicity, shared materials, representative PBR delivery, visible-mesh rig integrity, collision/navigation candidates, decoded PNG evidence, and local preview construction.

It does **not** prove that players will enjoy it, that the art direction is approved, or that it imports and behaves correctly in a native engine. `ps2VisualApproval`, `ps2PublicReleaseApproved`, and `nativeEngineValidation` stay false until those separate tests pass. See `QUALITY_LADDER.md` for the PS2 release gate and the later PS3/PS4 path.

Run `node shared/game-asset-foundation/selftest.js` for the focused verification suite.
