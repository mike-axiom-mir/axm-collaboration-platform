# AXM BuddyFarm 011 low-poly Three.js pass 01

Date: 2026-08-16  
Status: `TEST`  
Scope: registered AXM BuddyFarm shared farm, farmhouse and full-map view  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

BuddyFarm began this pass as a readable but entirely flat Canvas 2D farm. This
contained presentation pass adds a real local Three.js r160 depth renderer
under the retained semantic/fallback canvas. It renders an isometric faceted
grassland, low-poly house, pond, trees, rocks, fenced fields, furrows, stateful
crops, cast shadows, two Buddy figures, a furnished farmhouse, and a cellar.

The server-owned farm remains authoritative. The new renderer consumes
snapshots and never writes state, changes movement or work rules, changes save
shape, chooses actions, changes seats, or touches the Foundation. Full-map mode
deliberately restores the original semantic Canvas at full opacity; missing
WebGL or a failed Three.js import leaves the same Canvas fallback visible.

All geometry and color are produced deterministically from local source. No
remote URL, downloaded model, image, texture, font, audio, unseeded randomness,
or runtime internet access was added. Three.js r160 is served only from the
Workshop-retained MIT-licensed source recorded in `THIRD_PARTY_SOFTWARE.md`.

## Fresh Browser proof

Captures are fresh 1265 × 720 Chromium screenshots from the isolated
`127.0.0.1:18801/games/011/` runtime. Port 18801 kept this QA session separate
from the registered port 8801 runtime.

| Evidence | Observation |
| --- | --- |
| `baseline/01-farm-entry.png` | Untouched flat Canvas entry: tiled grass board, rectangular house and sprite placeholders. |
| `baseline/02-full-map.png` | Untouched 12 × 8 blank-world overview and fog grid. |
| `after/01-farm-entry-three.png` | First mounted Three.js exterior iteration. |
| `after/02-work-tilled-plot.png` | CUA `F` prepared authoritative cell `18,14`; server message confirmed the work. |
| `after/03-moved-to-house.png` | CUA `D`, `W`, `W`, `W` moved Mike from `18,13` to `19,10` with `steps: 4`. |
| `after/04-house-interior.png` | Semantic held Action crossed into the furnished low-poly farmhouse. |
| `after/05-house-movement.png` | CUA `A` moved Mike inside the farmhouse to `5,8`. |
| `after/06-full-map-overlay.png` | Full-map button restored the original semantic overview at opacity 1 with `aria-pressed=true`. |
| `after/07-map-recovery-three.png` | Closing the map restored `three-r160-low-poly` with `threeStatus=ready`. |
| `after/08-final-farm-frame.png` | Final clean exterior after roof winding and semantic-overlay artifact corrections. |
| `after/09-planted-watered-crop.png` | CUA farming prepared, planted and watered cell `18,14`; one seed was consumed. |
| `after/10-live-frame-a.png` | Live frame SHA-256 `4a60d865b3273556f76811b1609fc929820d595b98a43468a6cf5b900ab789ad`. |
| `after/11-live-frame-b.png` | Live frame 720 ms later, distinct SHA-256 `9b370f9fde98a93aee808fe4a7512e5c540f978309578a90422adfc6eb8f5591`. |

Three screenshots sampled at 0, 360 and 720 ms had three distinct SHA-256
digests, proving a live changing renderer. The active Browser capability does
not expose an ephemeral rolling-frame buffer, so exact cadence and dropped
frames remain an optional gap recorded in `CAPABILITY_RECEIPT.json`.

Browser DOM evidence reported two stacked canvases, depth renderer
`three-r160-low-poly`, root `threeStatus=ready`, semantic opacity 0 in normal
3D play, and semantic opacity 1 in full-map mode. An isolated evaluation realm
did not consistently expose page globals, so the receipt relies on DOM datasets,
screenshots and authoritative API state rather than claiming that diagnostic.

## Interaction and authority proof

- Keyboard work prepared cell `18,14`; later keyboard work planted a
  `buddy-carrot` and set `watered: true` while seeds changed from 12 to 11.
- Keyboard movement changed Mike from `18,13` to `19,10`, then moved him inside
  the farmhouse; server `steps` advanced.
- The Browser CUA exposes keypress but not separate keydown/keyup methods, so
  the 320 ms travel hold was sent through the game's existing semantic
  `/api/action` contract. Physical held-key travel is not claimed by this pass.
- Farm → house and house → farm transitions both returned `ok: true` and the
  correct server-owned scene.
- Full-map open/close kept the overlay escapable and restored the 3D renderer.

## Source integrity

The whole 011 package was already modified in a very dirty shared workspace.
Foreign changes were not reset, reformatted, or claimed. Start hashes were
captured before this lane edited the following pre-existing files.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/index.html` | `12cb66930c8b6f19e7aa3436ecc09c076b11a592bb20b7c2f99e5ce05fb8c1ed` | `3ae2b04d2f956999374ad6a0261753bea8db4d6ed98e917936b09186645080e6` |
| `runtime/styles.css` | `2b98ae6a73f6943a14a757ddcc250dd63b49c49f0d1f56fa0fd9e9ef118f2311` | `f880b183260cec08cbb71d621229ee96091237e927a44ba74dc27069dffee5be` |
| `runtime/app.js` | `f29c2e4d7bf63d58dffe8ff95cbdb6e1f4975100aa1fa787d2ffa860a0258133` | `c4bc05b9a926d7019a6a7cb23ecef4db3e434c6637a33bb734a6e8bbd73d5f15` |
| `runtime/server.js` | `0ec5f1ff0797f861ec012bf6bf08913c3cf61ab77e118ed452438b0db16e4d36` | `cf9ee94c5273b2050239c0283dbd880cb0d4ca9da7a5a912d66f190ebf93701e` |
| `game.manifest.json` | `9a35f298684ec57899c3bf0cc5404f9e956666f9eebf9ce67dd128833de1dca9` | `e6b25549f8eef6435962a0e6ba47b472f351d712f1b05440f5685ff2f9b79578` |
| `ASSET_PROVENANCE.md` | `3c37f9591cc00a4e537f0edff6aa203efee2dad8aba248547458cf5c258f85bd` | `c9905005f6b64e5065df414c9af03fef4df53ce9a5661c07dce20ea2f98a7442` |
| `runtime/buddyfarm-three.js` | absent | `ad00c09b437adfe537db896661aef00d00f1e2c4a7bc5956dd6ed6b3e480c569` |
| `tests/buddyfarm-three-selftest.js` | absent | `5b31a63a6274479c3513f8259e10be77d484426b3c2f6473e39bf50cb6e1d495` |
| `THIRD_PARTY_SOFTWARE.md` | absent | `a8de4ede3bb62911bc68d8667ac2fde39016885b1821a385a072cc3de693f09f` |

Scoped `git diff --check` passed. Git emitted only existing LF-to-CRLF
working-copy warnings.

## Verification

- `node --check runtime/buddyfarm-three.js`: pass
- `node --check runtime/app.js`: pass
- `node --check runtime/server.js`: pass
- `node tests/buddyfarm-three-selftest.js`: pass
- `node tests/buddyfarm-selftest.js`: pass
- Manifest JSON and all 20 required package paths: pass
- Browser exterior, farm work, movement, farmhouse, map overlay, close recovery,
  planted/watered crop and repeated-live-frame checks: pass

All ten required Workshop checks passed after the change on 2026-08-16:

- `node verify.js` (`0 FAIL`, existing warnings retained)
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Known non-failing repository warnings remain: 42 current verifier warnings,
legacy `UNDECLARED` tool kinds, a stale `tools-index.json`, and
verification-spine `VERIFIED_WITH_LIMITS` warnings. Passing tests do not
canonize this pass.

## Still unrun / not claimed

- Physical held-key, controller, touch, phone-controller and simultaneous
  three-player visual QA
- Live cellar transition and cellar movement in the Browser
- Full 96-chunk exploration and visual continuity outside the starter district
- Real LAN, television-distance, accessibility and audio QA
- Steam packaging, overlay, launch options, controller glyphs and Steam Deck QA
- GPU compatibility matrix, sustained performance, thermal and long-run soak
- Exact frame cadence and dropped-frame measurement

This is a tested visual increment, not Steam acceptance and not canonization.
