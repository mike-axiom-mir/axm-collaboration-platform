# Third-Party Asset License Index

Status: **PASS — official archives acquired, checked, and preserved**  
Checked: 2026-07-13

Only official Kenney sources were used. No mirror, scraped repost, remote asset API, or third visual pack was substituted.

## Kenney RPG Urban Pack 1.0

- Official page: https://kenney.nl/assets/rpg-urban-pack
- Final official archive URL: https://kenney.nl/media/pages/assets/rpg-urban-pack/0a097d1dc7-1677578575/kenney_rpg-urban-pack.zip
- Preserved archive: `assets/third_party/source_zips/kenney_rpg-urban-pack.zip`
- SHA-256: `4541d89d639fc7d1e905dd925e55b1c4977a41d983516228db1d57173bb9afaf`
- Archive size: 306,630 bytes
- Extracted to: `assets/third_party/kenney_rpg_urban/`
- Included license: `assets/third_party/kenney_rpg_urban/License.txt`
- License: Creative Commons Zero 1.0 Universal (CC0-1.0)
- Official page facts verified: 2D pack, 16 × 16 source tiles, CC0.
- Archive integrity (`unzip -t`): **PASS**
- Archive path traversal check: **PASS**
- Runtime selection: **YES — primary visual family**

Source-integrity note: the official page displayed “Files 480×” at inspection time, while the downloaded official archive contains `tile_0000.png` through `tile_0485.png` (486 individual tile PNGs) plus packed tilemap and support files. The archive was not rewritten to force the page count.

## Kenney Pixel Vehicle Pack 1.0

- Official page: https://kenney.nl/assets/pixel-vehicle-pack
- Final official archive URL: https://kenney.nl/media/pages/assets/pixel-vehicle-pack/570a4c9051-1677578609/kenney_pixel-vehicle-pack.zip
- Preserved archive: `assets/third_party/source_zips/kenney_pixel-vehicle-pack.zip`
- SHA-256: `b582163a0f366d8d24821eb763892ac29ff780a011e9b7b42baf86d1f051803f`
- Archive size: 60,319 bytes
- Extracted to: `assets/third_party/kenney_pixel_vehicles/`
- Included license: `assets/third_party/kenney_pixel_vehicles/License.txt`
- License: Creative Commons Zero 1.0 Universal (CC0-1.0)
- Official page facts verified: 2D pack, CC0.
- Archive integrity (`unzip -t`): **PASS**
- Archive path traversal check: **PASS**
- Runtime selection: **NO**
- Selection reason: the pack's principal cars are side-view sprites. Mixing them into the RPG Urban top-down/oblique city would weaken visual coherence. The official source remains preserved for later, deliberate use.

Naming note: the current official page calls this “Pixel Vehicle Pack”; its included historical `License.txt` calls it “Pixel Car Pack.” Both source labels are retained here.

## CC0 handling

The two official asset pages and both included `License.txt` files identify their assets as CC0. Kenney’s official support page also states that game assets on its asset pages are public-domain licensed and that attribution is not required. This project still records Kenney for source transparency. No Kenney logo was selected for runtime use.

CC0 reference: https://creativecommons.org/publicdomain/zero/1.0/

## Runtime boundary

All selected runtime files are local under `assets/selected/`. Gameplay does not need a CDN or a remote asset request. A file being curated under `selected/` is not, by itself, proof that the current renderer actually loads it; runtime use must be confirmed by the game and its browser tests.

Exact file-level mappings, transformations, hashes, crop/scale facts, and intended uses are recorded in `assets/ASSET_MANIFEST.json`.
