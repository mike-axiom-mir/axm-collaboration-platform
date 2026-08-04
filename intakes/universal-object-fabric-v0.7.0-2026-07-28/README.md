# AXM Universal Object Fabric v0.7.0 — Workshop intake

Status: **TEST / PASS-WITH-DECLARED-WARN**

This lane preserves the accepted Axiom/Mir handoff and exposes its game-safe surface to the Workshop without writing into an active game.

## Wired surfaces

- `source/` keeps the exact accepted 29,415,606-byte ZIP and its acceptance/index receipts.
- `game-stage/` contains all ten catalog-resolved assets, Runtime Capsules, visual-skin bindings, previews, schemas, and Three.js/Godot helpers.
- `../../tools/universal-object-fabric/` provides the Workshop browser and exact resolver service.

Start with `game-stage/STAGE_RESOLUTION_MAP.json`. Resolve every object by exact `asset_id + asset_version`; never infer an overlay folder or socket transform.

## Boundaries

- The stage is `STAGED-NOT-INTEGRATED`; no active game was modified.
- Energy Core keeps its declared connectivity WARN.
- Manufacturing and robotics remain held.
- Three.js and Godot source helpers are present, but receiving-game runtime, physics, gameplay, performance, and visual acceptance are not claimed.
- Godot remains source-tested only because no Godot runtime was available for this intake.

## Verification

```bash
node tools/universal-object-fabric/selftest.js
node scripts/generate-tools-index.js
node scripts/generate-public-discovery.js
```

The source package gate must report all 3,343 checksum rows covered. The staged self-test must report 10 exact identities, 668 staged checksums, and zero STL/3MF files.
