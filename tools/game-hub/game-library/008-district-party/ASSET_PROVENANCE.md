# Asset Provenance — AXM District Party

Status: **PASS for acquisition, licensing evidence, archive checks, curated local selection, and static runtime-path integration**  
Browser visual rendering: **UNRUN — Playwright Chromium executable unavailable**  
Physical-device rendering: **UNTESTED**

## Source decision

The prototype uses **Kenney RPG Urban Pack 1.0** as its sole curated runtime visual family. Its small pixel scale, characters, city props, vehicle tiles, and packed 16 × 16 tilemap form one coherent source.

The official **Kenney Pixel Vehicle Pack 1.0** was also downloaded and preserved because it was requested as a candidate source. It was not placed in the curated runtime set: its side-view vehicle presentation does not match the RPG Urban top-down/oblique city closely enough. No third pack was introduced to hide that mismatch.

| Pack | Official page | License | Archive check | Runtime selection |
|---|---|---|---|---|
| Kenney RPG Urban Pack 1.0 | https://kenney.nl/assets/rpg-urban-pack | CC0-1.0 | PASS | YES — primary family |
| Kenney Pixel Vehicle Pack 1.0 | https://kenney.nl/assets/pixel-vehicle-pack | CC0-1.0 | PASS | NO — preserved source only |

The included license files are preserved inside both extracted pack directories, and both original source ZIPs are retained under `assets/third_party/source_zips/`. Exact URLs, archive hashes, sizes, and inventory facts are in `assets/third_party/LICENSE_INDEX.md` and `assets/ASSET_MANIFEST.json`.

## Curated runtime files

### Urban tile source

- `assets/selected/tiles/kenney_rpg_urban_tilemap_packed_16px.png`
- Original: `Tilemap/tilemap_packed.png`
- Transform: unchanged copy with an explicit local runtime name.
- Size: 432 × 288 pixels; 27 × 18 grid of 16 × 16 frames.
- Colour/crop/scale changes: none.
- Intended use: local city map rendering or map authoring while only addressing tile indices actually used by the map.

### Actor sheets

The following six sheets were assembled from official RPG Urban 16 × 16 tiles. Each output is 64 × 48 pixels: four facing columns (`left`, `down`, `up`, `right`) by three source animation rows. No pixel was scaled, cropped, or recoloured.

- `assets/selected/characters/player_01_urban.png`
- `assets/selected/characters/player_02_urban.png`
- `assets/selected/characters/player_03_urban.png`
- `assets/selected/characters/player_04_urban.png`
- `assets/selected/characters/npc_01_urban.png`
- `assets/selected/characters/npc_02_urban.png`

The exact 12 source tile paths for every sheet are listed in the JSON manifest. Intended use: four visually distinct player actors and two civilian/NPC variants. Game-side party markers and names remain necessary for identity clarity.

### Vehicle presentation variants

Twelve RPG Urban vehicle images were curated in yellow, green, and red. Some source vehicles span adjacent 16 × 16 tiles, so their pieces were joined without scaling or recolouring. Outputs are 16 × 16, 32 × 16, 16 × 32, or 32 × 32 with source transparency preserved.

- `assets/selected/vehicles/urban_car_yellow_wide_a.png`
- `assets/selected/vehicles/urban_car_yellow_wide_b.png`
- `assets/selected/vehicles/urban_car_yellow_narrow_a.png`
- `assets/selected/vehicles/urban_car_yellow_narrow_b.png`
- `assets/selected/vehicles/urban_car_green_wide_a.png`
- `assets/selected/vehicles/urban_car_green_wide_b.png`
- `assets/selected/vehicles/urban_car_green_narrow_a.png`
- `assets/selected/vehicles/urban_car_green_narrow_b.png`
- `assets/selected/vehicles/urban_car_red_wide_a.png`
- `assets/selected/vehicles/urban_car_red_wide_b.png`
- `assets/selected/vehicles/urban_car_red_narrow_a.png`
- `assets/selected/vehicles/urban_car_red_narrow_b.png`

The neutral `wide/narrow` and `a/b` names are intentional. The asset curation step does not claim a gameplay direction mapping that has not been verified in the city renderer. Exact source-tile assembly is recorded per file in the JSON manifest.

### Props

These official RPG Urban tiles were copied unchanged and renamed for readable runtime use:

- `assets/selected/props/package_box.png` — Courier Chaos package marker.
- `assets/selected/props/road_barrier_red_white.png` — depot/street boundary.
- `assets/selected/props/street_lamp.png` — street decoration.
- `assets/selected/props/hydrant_green.png` — street decoration.
- `assets/selected/props/tree_green_small.png` — park/sidewalk decoration.
- `assets/selected/props/bush_green_small.png` — park/sidewalk decoration.

No crop, scale, recolour, or atlas combination was applied to these six props.

## What was not used

- No copyrighted commercial-game assets, logos, maps, sprites, brands, audio, dialogue, or extracted proprietary material.
- No unofficial mirror.
- No remote QR or image API.
- No Kenney logo in the curated runtime set.
- No audio source was added.
- No hidden third art pack was mixed in.
- No AI-generated bitmap was added by this asset task.

## Verification performed

- Official pages opened and their CC0 declarations checked: **PASS**.
- Final direct URLs returned ZIP content: **PASS**.
- Both archives downloaded: **PASS**.
- SHA-256 recorded: **PASS**.
- `unzip -t` on both archives: **PASS**.
- Absolute/parent-path archive entry scan: **PASS**.
- Included `License.txt` files read after extraction: **PASS**.
- Selected PNG dimensions inspected: **PASS**.
- Curated character, vehicle, and prop contact sheets visually inspected: **PASS**.
- Static renderer references and local files for 10 selected assets: **PASS** — four player sheets, two NPC sheets, two RPG Urban vehicles, package, and tree.
- Remaining 15 curated files: **NOT LOADED by v0.1** — the source tile atlas, ten additional vehicle variants, and four additional props remain curated for later map/visual work.
- Automated browser visual rendering: **UNRUN** because the installed Playwright package has no Chromium executable; no large browser download was attempted.
- Physical-device/gameplay rendering: **UNTESTED**.

Static path integration proves that the renderer requests local files and that the host serves them; it does not prove visual correctness in a browser. The city geometry itself is drawn from structured map data with Canvas shapes, so the selected tile atlas is not loaded in v0.1.
