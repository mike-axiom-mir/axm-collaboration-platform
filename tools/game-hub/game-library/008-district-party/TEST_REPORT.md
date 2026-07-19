# Test Report — AXM District Party v0.2.7 Interactable Asset Pass

Date: 2026-07-19
Environment: Linux container, Node.js 24.14.0, no physical phones/displays, no private-LAN hardware test, no Windows host and no installed Playwright Chromium executable.

## Commands and checks actually run

| Command/check | Actual result |
| --- | --- |
| `unzip -tq upload/AXM_DISTRICT_PARTY_INTERACTABLE_ALPHA_PACK_2026-07-19.zip` | **PASS — no archive error.** |
| ZIP entry path/type inspection before extraction | **PASS — 175 regular relative entries; no symlink, absolute path or parent traversal.** |
| Safe extraction to isolated intake directory | **PASS.** |
| Inventory of `individual_assets/**/*.png` | **PASS — 158 PNGs, seven categories.** |
| ImageMagick RGBA/alpha audit over all 158 individual PNGs | **PARTIAL — 158/158 decode as RGBA; 157/158 contain alpha 0 and 255. `phones_cards_keys_005.png` is a 15×11 partial-alpha fragment.** |
| Visual inspection of seven generated category contact sheets and selected individual candidates | **PARTIAL — usable parcels/props identified; fragment, checker contamination, speckles and alpha holes held back.** |
| `node --test tests/interactable-asset-pass.test.js tests/city-art-pass.test.js tests/user-asset-pass.test.js` | **PASS — 13/13; 0 failures.** |
| Raw `node --check` against browser ES-module files in a CommonJS package | **NOT APPLICABLE CHECKER MISMATCH — Node rejected `import`/`export`; no gameplay failure was claimed.** |
| Browser-module parse harness with imports/exports adapted exactly as the existing renderer test harness does | **PASS.** |
| Project JSON parser | **PASS — 118 JSON files parsed.** |
| `npm test` | **PASS — 176/176; 0 failures; 206.524 seconds.** |
| `npm run test:cli` | **PASS — health, four controllers, authoritative input, 96 chunks, three interactable assets, both user manifests, 28 prop overlays, wrong-room rejection, session end and PID cleanup.** |
| `npm run art:preview` | **PASS — nine PNG scenes generated from the actual Canvas renderer.** |
| Visual inspection of `docs/previews/courier-interactable-art-pass.png` | **PASS — package variants, carried parcel and yard props readable at runtime scale.** |
| Visual inspection of `docs/previews/tilburg-centre-art-pass.png` | **PASS — ATM/vending reserved labels and plaza dressing readable.** |
| Visual inspection of `docs/previews/party-house-art-pass.png` | **PASS — safe is visible and labelled reserved without becoming an ACTION target.** |
| `npm run map:preview` | **PASS — compact and full-map PNGs generated.** |
| `npm run test:browser` | **UNRUN — Playwright package exists, but Chromium executable is absent; no large browser download attempted.** |
| Focused port kit overlaid on a fresh preserved v0.2.6 copy; `node --test tests/interactable-asset-pass.test.js` | **PASS — 6/6; 0 failures.** |
| Same fresh overlay copy; complete `npm test` | **PASS — 176/176; 0 failures; 217.385 seconds.** |
| Same fresh overlay copy; `npm run test:cli` | **PASS — all new/static/authority gates plus clean shutdown.** |

## Interactable-asset gates

- **PASS:** exact source ZIP size and SHA-256 match `assets/INTERACTABLE_ASSET_MANIFEST.json`.
- **PASS:** all 14 selected runtime hashes match the manifest.
- **PASS:** all 14 runtime PNGs are 8-bit, non-interlaced RGBA with real alpha-0 and alpha-255 pixels.
- **PASS:** rejected phone fragment and checker-contaminated card are not loaded.
- **PASS:** all 28 prop IDs are unique and inside the 12,288×8,192 city bounds.
- **PASS:** exactly 25 placements are `visual-only`; exactly three are `reserved`.
- **PASS:** every prop asset key resolves to a curated runtime file.
- **PASS:** package selection is stable for a given host-owned ID and uses a restricted crate/box pool for Supply Sweep.
- **PASS:** renderer source contains no package state mutation.
- **PASS:** every new runtime URL is local and relative.
- **PASS:** live host returns HTTP 200 for parcel, vending, bench and manifest routes.

## Regression gates retained

- **PASS:** Party A/Party B mapping and eight selected-seat initialization.
- **PASS:** four distinct controller identities and optional adapter/Host-AI separation.
- **PASS:** central friendly-fire and safe-zone damage rules.
- **PASS:** inventory, equipment, finite ammo and automatic bag-ammo replacement.
- **PASS:** nine fixed-roster group saves and missing-seat Host AI restoration.
- **PASS:** vehicles, occupants, passenger fire, destruction/ejection and host respawn.
- **PASS:** NPC justice, rivals, mission director and 16 mission layouts.
- **PASS:** sparse 1v1, asymmetric 2v3 and all-AI eight-seat simulations.
- **PASS:** Party House regeneration and unsplit shared HUD/camera contract.

## Packaging gates

- **PASS — full candidate ZIP:** 1,067 entries; compressed-data test clean; every path relative; no symlink; runtime save JSON, PID, `__pycache__` and `.DS_Store` entries excluded.
- **PASS — focused port candidate ZIP:** 67 entries; compressed-data test clean; every path relative; no symlink.
- **PASS — candidate clean extraction:** full and focused extracted trees are byte-identical to their source directories.
- **PASS — extracted full candidate:** focused interactable suite 6/6 and CLI lifecycle/static HTTP gates pass with clean PID shutdown.
- **PASS — focused overlay behavior:** the source kit was overlaid on untouched v0.2.6 and passed 176/176 plus CLI; the candidate port ZIP is byte-identical to that source kit.
- After this result text and build-manifest status are synchronized, final archives are rebuilt and the compressed-data, safe-path and byte-comparison gates rerun. No gameplay code changes occur after the 176/176 overlay run.

## Device truth

- Physical phone QR join: **UNTESTED**
- Four simultaneous physical phones: **UNTESTED**
- Eight simultaneous physical seats: **UNTESTED**
- Two physical party displays: **UNTESTED**
- Windows batch/firewall behavior: **UNTESTED**
- Private-LAN reachability: **UNTESTED**
- Actual Chromium composition in this environment: **UNRUN**

Canvas preview generation proves the real renderer can compose the accepted local images. It does not substitute for a browser or physical shared-screen playtest.
