# User Art v0.2.6 Port Guide

Use this guide when Local Codex's laptop copy contains bug fixes newer than this preserved v0.2.5 base. Back up that project first. Do not replace its full directory with this build.

## Safe copy-first files

These paths are additive and may normally be copied as complete directories/files:

- `assets/source/user_generated/2026-07-19/raw/`
- `assets/generated/user_generated/`
- `assets/selected/characters/axm_generated/`
- `assets/selected/shopkeepers/axm_generated/`
- `assets/selected/vehicles/axm_generated/`
- `assets/selected/buildings/axm_generated/`
- `assets/USER_GENERATED_ASSET_MANIFEST.json`
- `docs/USER_ASSET_PIPELINE.md`
- `docs/previews/user-*.png`
- `tests/user-asset-pass.test.js`

## Merge, do not blindly replace

### `client/game/scenes/CityScene.js`

Bring the new local paths into the existing `loadAssets()` table:

- `modernPlayer1` … `modernPlayer4`
- `resident1` … `resident4` (resident 3 must use `resident_woman_backpack-v2.png`)
- `sportRed`, `sedanSilver`
- `shopkeeperNeutral`, `shopkeeperAxm`
- `buildingCafe`, `buildingCornerShop`, `buildingApartment`, `buildingRow`

Keep Local Codex's polling, controls, camera and bug fixes unchanged.

### `client/game/rendering/entity-renderer.js`

Merge these presentation seams while preserving newer gameplay rendering fixes:

- `drawBuildingOverlay()` and `drawStaticCharacter()`.
- `drawCityArt()` loops for `buildingOverlays` and `staticCharacters`.
- modern vehicle sprite selection with legacy fallback.
- civilian `hashString(npc.id)` identity selection with legacy fallback.
- player modulo identity selection with modern/legacy fallback.

Do not move vehicle occupancy, health, collision or damage logic into the client. This remains presentation only.

### `data/city-art.json`

Merge schema version 2 plus `buildingOverlays` and `staticCharacters`. If Local Codex moved map collision, rerun `tests/user-asset-pass.test.js`; do not keep a landmark whose footprint or approach fails.

### Existing manifests and docs

Merge the `userGeneratedExtension` object into `assets/ASSET_MANIFEST.json`. Append the v0.2.6 section of `ASSET_PROVENANCE.md`; preserve Local Codex's newer provenance entries.

## Verification on the newest laptop copy

Run:

```sh
npm test
npm run test:cli
npm run art:preview
npm run test:browser
```

`test:browser` may honestly report **UNRUN** when Chromium is absent. Then physically verify:

1. P1–P4 show four distinct images; P5–P8 retain distinct seat/name/party markers if enabled.
2. Civilians keep their appearance while moving and while state updates reorder other entities.
3. Both car types rotate in their direction of travel, remain enterable and preserve occupants.
4. Neutral shopkeeper appears in the city shell; AXM shopkeeper appears in the Party House; neither opens a fake store.
5. All four landmark approaches remain walkable and the player cannot walk through the building-backed footprint.
6. No image request leaves the local host.

## Public-release gate

The 2026-07-19 gate is satisfied for inclusion in this AXM public repository and its public-safe packages by Mike's recorded authorization in `assets/AXM_GENERATED_ART_AUTHORIZATION.md`. That authorization is not CC0 and does not grant standalone/general reuse. Preserve the authorization and provenance files whenever these art directories are packaged.
