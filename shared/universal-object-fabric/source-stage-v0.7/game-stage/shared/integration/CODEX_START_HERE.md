# CODEX START HERE — AXM Universal Object Fabric v0.5

Use the existing outputs first. Do **not** regenerate all geometry just to place an object in a game.

## Fixed intake order

1. Read `universal_archive/INDUSTRY_ADAPTER_REGISTRY.json`.
2. Pick an object in `universal_archive/UNIVERSAL_OBJECT_CATALOG.json` or open `universal_archive/AXM_UNIVERSAL_OBJECT_BROWSER.html`.
3. Read that object's `UNIVERSAL_OBJECT_MANIFEST.json`.
4. For a game, follow `industry_outputs.game` to `game_binding.json`.
5. Follow its `runtime_manifest` into `deployments/AXM_8_GAMES_SHARED_GEOMETRY/`.
6. Load LOD0 first; add LOD switching only when the game needs it.
7. Use the separate collision manifest. Do not convert the visual mesh into an assumed collider.
8. Apply semantic materials from `material_reality.json` only as starter presentation values.
9. Build movement from `assembly_contract.json`; clamp every joint to its declared limits.
10. Never treat URDF, manufacturing intent, architecture placement or OpenUSD preview as certified output.

## Lowest-compute game route

```text
UNIVERSAL_OBJECT_MANIFEST.json
  -> outputs/game_binding.json
  -> v0.4 game/runtime_manifest.json
  -> game/LOD0 GLB + separate collision + sockets
```

## Add a new v0.4 asset safely

Run the scaffold command. It creates a fixed-root contract and a separate review-notes file. It deliberately invents no moving parts.

```bash
python universal_fabric/axm_universal_fabric.py scaffold \
  --asset-id AXM-NEW-ASSET-001 \
  --asset-version 0.4.0 \
  --output universal_fabric/contracts/AXM-NEW-ASSET-001.object.json
```

Then review the contract manually before adding joints, material meanings, clearances or industry claims.

## Stop conditions

Stop and report instead of guessing when:

- the runtime manifest, source hash or referenced file is missing;
- a joint points to a missing assembly group;
- a material profile is unknown;
- an adapter is marked `HOLD`, `CONCEPT-HOLD`, `INTENT`, or `PREVIEW` and the requested use exceeds that boundary;
- physical production, structural use, robot control or legal compliance is requested without specialist evidence.
