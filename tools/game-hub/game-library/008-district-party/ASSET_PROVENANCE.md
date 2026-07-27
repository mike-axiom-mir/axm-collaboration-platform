# Asset Provenance — AXM District Party

Status: **PASS for acquisition, licensing evidence, archive checks, curated local selection, and static runtime-path integration**  
Browser visual rendering: **PASS — live in-app browser at 1870 × 1037; human visual approval remains required**  
Physical-device rendering: **UNTESTED**

## Source decision

The prototype retains **Kenney RPG Urban Pack 1.0** as its licensed CC0 fallback and small-prop family. v0.2.6 adds a separate user-supplied, AI-assisted AXM visual layer for playable actors, civilians, two vehicle presentations, two shopkeeper previews and four Tilburg-style landmarks. v0.2.7 preserves a second 158-PNG user-supplied interactable-art archive and promotes only 14 inspected candidates. The new assets do not replace collision, physics or host authority.

The official **Kenney Pixel Vehicle Pack 1.0** was also downloaded and preserved because it was requested as a candidate source. It was not placed in the curated runtime set: its side-view vehicle presentation does not match the RPG Urban top-down/oblique city closely enough. No third pack was introduced to hide that mismatch.

| Pack | Official page | License | Archive check | Runtime selection |
|---|---|---|---|---|
| Kenney RPG Urban Pack 1.0 | https://kenney.nl/assets/rpg-urban-pack | CC0-1.0 | PASS | YES — primary family |
| Kenney Pixel Vehicle Pack 1.0 | https://kenney.nl/assets/pixel-vehicle-pack | CC0-1.0 | PASS | NO — preserved source only |
| User-supplied AXM/Tilburg batch | Supplied in this build session | Public license pending review | 15 originals hashed and preserved | YES — 16 curated runtime outputs |
| User-supplied interactable alpha pack | Supplied in this build session | AXM responsible-use draft; not legally reviewed | 158 candidates preserved in exact source ZIP | YES — 14 inspected unchanged copies |

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
- No unrecorded AI-generated bitmap was added. The v0.2.6 AXM batch is explicitly separated, hashed and documented as user supplied.

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
- Remaining 15 curated files: **NOT LOADED by v0.2** — the source tile atlas, ten additional vehicle variants, and four additional props remain curated for later map/visual work.
- Packaged Playwright test: **UNRUN** because the package environment has no Playwright Chromium executable; no large browser download was attempted.
- Live in-app browser visual rendering: **PASS** at 1870 × 1037 with the real local server, streamed chunks and repeated gameplay frames; this does not replace human visual approval.
- Physical-device/gameplay rendering: **UNTESTED**.

Static path integration proves that the renderer requests local files and that the host serves them; it does not prove visual correctness in a browser. The city geometry itself is drawn from camera-local structured map chunks with Canvas shapes, so the selected tile atlas is not loaded in v0.2.

## v0.2 geodata boundary

The Tilburg ground geometry is data rather than a third art pack. It comes from the official PDOK BGT OGC API under CC0-1.0 and is documented separately in `GEODATA_PROVENANCE.md` and `data/tilburg-source-index.json`. No Google map imagery or labels were copied. The Kenney art selection and hashes above are unchanged from v0.1.7.

## v0.2.1 artistic city pass

New third-party art: **NONE.** `data/city-art.json` contains original AXM palette overrides, district wayfinding, ground motifs, crosswalks and overview lines. The runtime renderer procedurally creates roof variation, ground texture, road markings, water marks and rail sleepers from local geometry; these are code-generated presentation, not downloaded artwork.

The three v0.2.1 files in `docs/previews/` were rendered from the actual game code and retained only as QA evidence. They combine the documented BGT-derived geometry, original AXM procedural presentation and the same already-recorded Kenney assets used at runtime. No new license or external source is introduced.

## v0.3.0 Streetscape Foundation repair

New third-party or user-supplied bitmap art: **NONE.** The repair changes Canvas code and `data/city-art.json` presentation parameters only. Curbs, paving joints, source-aligned lane dashes, connected roof fills, ridges, rooftop units, skylights, street-lamp symbols, park canopies, water glints and rail sleepers are original deterministic Canvas primitives clipped to the recorded BGT material masks. Existing local image assets and their provenance records are unchanged.

## v0.4.0 authored-city alpha

New third-party or user-supplied art: **NONE.** Map 2 is an original deterministic Canvas and JSON presentation with a new independent layout at the same 12,288 x 8,192 target size. The clean master raster and 96 tiles are generated locally from that map package. They do not add a new source or license claim.

Poly Haven, ambientCG and Artaley3D are deferred candidate search locations only. No file was downloaded from them in this pass. Each future selection requires its own source URL, author, exact license evidence, download hash, transform record and runtime role; no blanket CC0 claim is made here.

## v0.2.2 open-interior floor treatment

New third-party art: **NONE.** The empty-shell floors, grid lines, perimeter colors, thresholds, labels and two venue wayfinders are original Canvas/JSON presentation authored for AXM District Party. `docs/previews/open-venue-shells.png` is QA evidence generated by the actual bundled renderer and is not loaded during gameplay. The future casino remains **NOT IMPLEMENTED**, so no casino artwork or external symbol set is included.

## v0.2.3 minimap and full-map treatment

New third-party art: **NONE.** Both map views are drawn locally by `client/game/ui/city-map.js` from the retained structured map, original AXM city-art overview and authoritative runtime markers. `docs/previews/city-minimap-ui.png` and `docs/previews/city-full-map-ui.png` are QA evidence generated from that same bundled drawing code and are not loaded during gameplay. No external map tiles, imagery, icon pack or online map service is used.

## v0.2.4 group-save computer treatment

No external art was downloaded or added for the group-save update. The Party House terminal is drawn at runtime from original Canvas rectangles, glow and text; the nine-slot overlay is original HTML/CSS. Its structured location is gameplay data, not a third-party asset. Existing Kenney and PDOK provenance remains unchanged.

## v0.2.5 mission-route treatment

New third-party art: **NONE.** The active dispatch rectangle, delivery-zone outlines, route labels and route-deck UI text are original code-drawn Canvas/HTML/CSS presentation. Mission coordinates are authored AXM gameplay anchors on the existing Tilburg-derived map. The update reuses the already documented package, rival and player visuals and introduces no new bitmap, font, audio, map tile or external service.

## v0.2.6 user-supplied visual pass

Fifteen raw PNG inputs supplied by Mike were copied unchanged into `assets/source/user_generated/2026-07-19/raw/` before processing. Their exact SHA-256 hashes are retained in `assets/USER_GENERATED_ASSET_MANIFEST.json`.

The baked checkerboard backgrounds were not true transparency. A background-only visual edit placed each subject against a controlled chroma field, after which the local alpha helper removed the field. Runtime derivatives were trimmed, centred, padded and downscaled to 256×256 for characters/shopkeepers, 256×128 for vehicles, or 512×512 for buildings. Vehicle art was rotated so zero-radian movement points right. The four-player sheet was split into four identities. Subject recolouring was not requested. One first-pass resident matte affected subject colour and is explicitly rejected; the renderer loads `resident_woman_backpack-v2.png`.

Runtime use:

- Four AXM player identities cycle safely across seats 1–8; party markers and seat numbers remain authoritative identity cues.
- Four resident images are selected by a stable hash of NPC ID, so state-array ordering cannot swap civilian appearances.
- The red sports presentation is used for `district-runner`; the silver sedan presentation is used for the other current vehicle kind. Kenney vehicles remain local fallbacks.
- Four building overlays align to already-existing collision footprints and expose open approach points. They add no collision themselves.
- The neutral shopkeeper is a visual-only city-shop preview. The AXM-styled shopkeeper is a visual-only Party House preview. Both explicitly state that stock is later; no fake shop transaction exists.

Two multi-building source sheets are preserved but not loaded. They need a later deliberate crop, style and collision-placement pass. The darker sheet is intentionally excluded from the current daytime Tilburg family.

License boundary: these files were supplied for this AXM prototype, but no public redistribution license was independently verified or assigned in this session. Do not label them CC0. Review and document permission before a public repository release. Full transforms, hashes, roles and rejection notes are in `assets/USER_GENERATED_ASSET_MANIFEST.json`; the processing method is in `docs/USER_ASSET_PIPELINE.md`.

## v0.2.7 interactable alpha-pack curation

New third-party source: **NONE.** Mike supplied `AXM_DISTRICT_PARTY_INTERACTABLE_ALPHA_PACK_2026-07-19.zip` as AI-assisted AXM test art made through his own chats. The unchanged 17,467,852-byte archive is preserved under `assets/source/user_generated/interactable_alpha_pack_2026-07-19/` with SHA-256 `fccbbd80502197dad83043773215d22710ab4e16a087996a8624284bf3963372`.

The pack contains 158 individual PNG candidates across seven categories. Archive testing and safe-path inspection passed. All 158 decode as RGBA; 157 have both fully transparent and fully opaque pixels. Visual inspection still found a partial-alpha phone fragment, checker contamination, speckles and alpha holes. Therefore, the source pack remains an intake archive rather than a runtime directory.

Fourteen unchanged PNG copies were promoted into `assets/selected/interactables/axm_generated/`: five parcels/crates and nine city-prop presentations. The only transform is a descriptive runtime filename. No subject pixels were recoloured, cropped, scaled or regenerated during this pass. Scaling occurs only at Canvas draw time.

Runtime use:

- Courier and supply packages choose a stable visual from the authoritative package ID and kind.
- Twenty-five city placements are explicitly visual-only.
- An ATM, vending machine and Party House safe are visibly labelled `RESERVED`; their interactions are not implemented.
- Breakable windows/doors remain source-only because no host-owned breakable state exists.
- The renderer changes no collision, package state, mission reward or authority rule.

License boundary: these files are not described as CC0 or open source. The working local identifier is `AXM-RESPONSIBLE-USE-ASSET-DRAFT-0.1`, status **NOT LEGALLY REVIEWED**. Public redistribution requires an explicit final permission decision. Exact per-file paths, dimensions, hashes, use and quarantine notes are in `assets/INTERACTABLE_ASSET_MANIFEST.json`; the readable implementation boundary is in `docs/INTERACTABLE_ASSET_PASS.md`.
