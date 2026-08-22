# District Party 008 low-poly Three pass 01

Date: 2026-08-16  
Status: `TEST`  
Scope: registered District Party shared-screen package  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

District Party's existing top-down Canvas game now has a separate Three.js
r160 WebGL presentation layer. It renders a low-poly city relief with faceted
mass blocks, camera-local map geometry, a perspective ground grid, party actor
markers, vehicle markers, lights, fog, shadows, particles, and low-segment
roofs. The authoritative 2D city renderer stays in place at 34% opacity so its
mission, collision, interaction, and navigation cues remain readable.

The new canvas declares `data-authority="presentation-only"`. Opening the full
Tilburg map hides the 3D relief and restores the 2D map to full opacity and
normal blending. WebGL failure also restores the original 2D composition.

This pass did not change collision, movement authority, missions, economy,
damage, saves, controller tokens, AI, vehicle rules, or world serialization.
The server change exposes one exact local route for the Workshop's retained
Three.js file.

No raster art was downloaded or generated. See `ASSET_LICENSES_3D.md`.

## Browser proof

All captures are 1280x720 Chromium screenshots against an isolated managed
one-seat runtime. The package's persistent Party A receiver loaded the same
shared-screen client referenced by the slot 008 manifest.

| Evidence | Observation |
| --- | --- |
| `01-before-party-screen.png` | Original shared screen: one opaque top-down 2D Canvas and no renderer tag. |
| `02-after-party-screen-3d-first.png` | First real WebGL mount, rejected because its depth was too subtle. |
| `03-after-party-screen-3d-tuned.png` | Brighter camera-local relief, still rejected as too sparse. |
| `04-after-party-screen-3d-local-relief.png` | Preserved load-in frame before authoritative world data completed. |
| `05-after-party-screen-3d-local-relief-loaded.png` | Loaded relief, rejected because the authored start chunk exposed too little geometry. |
| `06-after-party-screen-3d-massing.png` | Preserved incomplete massing-load attempt; not accepted. |
| `07-after-party-screen-3d-clean.png` | First accepted low-poly massing composition. |
| `08-after-full-map-readable.png` | Full map proof: depth opacity 0, city opacity 1, normal blend. |
| `11-after-controller-move.png` | Token-bound controller began moving the authoritative actor. |
| `12-after-controller-move-distance.png` | Actor moved from `(5780, 4520)` to about `(5795, 4505)` while two canvases and `three-r160` remained live. |
| `13-after-party-screen-3d-final.png` | Final 34% semantic overlay: 44 massing blocks, camera-local relief, one actor marker, ten vehicle markers, two canvases, no fallback. |
| `14-after-live-final-a.png` | Final live frame A, SHA-256 `b05d9d2031275b4bccc557da19fda4c6741fa55ad378497a30978c510f4d9dd1`. |
| `15-after-live-final-b.png` | Same route 900 ms later, distinct SHA-256 `b5342a96e6ae136b80fdd7e791c5ab122af56bc0156af6606fe5ac3dd0c815ac`. |
| `16-after-full-map-final.png` | Final full-map composition with the 3D relief deliberately hidden. |

Fresh final-route diagnostics reported two canvases,
`data-renderer="three-r160"`, `data-scene3d="district-party-city"`,
`data-depth-ready="true"`, and no browser console logs.

Repeated screenshots and distinct hashes prove live visual change. Exact frame
cadence remains unknown because the active Browser capability exposes no
ephemeral rolling-frame buffer. `CAPABILITY_RECEIPT.json` records the required
3D/control route as `READY` and cadence measurement as an `OPTIONAL_GAP`.

## Source integrity

The entire 008 directory was already modified in a very dirty shared
workspace. Foreign changes were not reset, reformatted, or claimed. These
hashes describe the lane state seen by this pass; `CityScene.js` was inspected
before editing but its start hash was not captured, so that cell remains
explicitly unknown.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `client/game/game.html` | `e1aeac65f8f7951c822c8b6bbe5ca337aa2c11c5c93a91cc3ccea1435fb7556f` | `03cb87a2ede554e5ccca861dbd06a8368b3e4e884ccb54879e9b6a57df78d9bf` |
| `client/game/game.css` | `a4b3583baef99cc34e70b94ef2512b7bdb2dac4d27c6b9bc7c1bd7b6fc290e6b` | `db87e64dcc98695c6e2777ddd6cd19347d701081000bf45670910a28c034917c` |
| `client/game/scenes/CityScene.js` | not recorded | `d377eebe24f9a80b9dff55fe1920f9f8a431c338631bd5ec0ed649aa055fa0be` |
| `server/server.js` | `7f81bc87f21d7f8d8654cf1576e5722a06cdbeda42120e5b98088860e44057d0` | `fe7334614e4302e9091c6f4331b04b95bf83082898128c5eebfab85aafa183a8` |
| `game.manifest.json` | `18515b98ea58934f669e50455533975907896269e0815b676b42cfa04a84a383` | `0d2c539df6eb40230702f19bcdcd750b5754ea85b180f409c2d311b6a7464c10` |
| `client/game/rendering/district-depth-stage.js` | absent | `c7f516d4650f8dee9fd95c679ede37270a984783bc5b1e190ccf983cb1158411` |
| `ASSET_LICENSES_3D.md` | absent | `bb0b822a2d47f3c303269950afd1ce758318055808e6927224166461c1b69f57` |
| `tests/low-poly-depth-pass.test.js` | absent | `adcdf8872269cce3a91706015b0ed36603435db2b13748fbd27d3b49f7511755` |

Scoped `git diff --check` passed. Git emitted only existing LF-to-CRLF
working-copy warnings.

## Verification

Focused and package checks passed:

- ESM syntax checks for `district-depth-stage.js` and `CityScene.js`
- `node --check server/server.js`
- manifest JSON parse
- `node --test tests/low-poly-depth-pass.test.js`: `2 PASS`, `0 FAIL`
- `npm test`: `224 PASS`, `0 FAIL`
- CLI lifecycle smoke on isolated port 18896: four players, four controller
  links, host input/state, 23 NPCs, ten vehicles, local assets, 96 chunks,
  wrong-room rejection, clean end, and PID cleanup all passed

The first CLI invocation on its default port 8796 failed because that port is
owned by the currently active Lumenwake 006 runtime. That process was left
untouched; the same check passed on the isolated port above.

All ten required Workshop checks passed on 2026-08-16:

- `node verify.js`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Known non-failing repository warnings remain: 61 legacy `UNDECLARED` tool
kinds, a stale `tools-index.json`, and `verify-plus` reported
`VERIFIED_WITH_LIMITS` with two warning claims.

## Still unrun / not claimed

- Package-local Playwright smoke: `UNRUN` because that package is unavailable;
  live Browser QA above was run separately
- The outer `/games/008/` GameHub proxy path was not separately launched in
  this pass; the registered package receiver/client was
- Physical phone, four/eight simultaneous controller, two-display, real LAN,
  and television-distance QA
- Steam packaging, launch options, overlay, controller glyphs, and Deck QA
- GPU compatibility, sustained performance, thermal, and long-run soak tests
- Exact animation cadence, dropped-frame measurement, accessibility, and audio

This is a tested public-test visual increment, not Steam acceptance and not
canonization.
