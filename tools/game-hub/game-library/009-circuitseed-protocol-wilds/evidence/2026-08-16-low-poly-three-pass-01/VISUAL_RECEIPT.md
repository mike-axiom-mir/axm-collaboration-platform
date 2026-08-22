# Circuitseed Protocol Wilds 009 low-poly Three pass 01

Date: 2026-08-16  
Status: `TEST`  
Scope: registered Circuitseed shared-screen package  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

Circuitseed's existing top-down Canvas journey now has a separate Three.js
r160 WebGL presentation layer. It renders a faceted hex terrain, low-segment
machine flora, route relief, landmarks, resources, player rigs, weather
particles, lights, fog, shadows, and a low-poly title seed sculpture. The
authoritative 2D renderer remains at 28% opacity with screen blending so
mission labels, interactions, pulses, and navigation cues remain readable.

The new canvas declares `data-authority="presentation-only"`. WebGL loss or
initialization failure removes the depth-ready class and restores the original
2D composition. This pass did not change movement authority, missions,
encounters, economy, saves, controller tokens, Circuitkin rules, observations,
or world serialization.

The server exposes one exact local route for the Workshop's retained Three.js
source. Nothing is fetched from a CDN or the internet. No raster art, texture,
font, audio, or model was downloaded or generated.

## Browser proof

All captures are fresh 1280x720 Chromium screenshots against an isolated
runtime on `127.0.0.1:18899` with a separate temporary data root.

| Evidence | Observation |
| --- | --- |
| `baseline/01-title.png` | Untouched title: procedural 2D Canvas/CSS composition and no 3D relief. |
| `baseline/02-world-entry.png` | Untouched world: opaque top-down 2D Canvas. |
| `after/01-title-iteration-a.png` | First WebGL title mount, preserved but rejected because the seed overlapped the wordmark. |
| `after/02-world-iteration-a.png` | First field relief, preserved before semantic-overlay tuning. |
| `after/03-title-final.png` | Accepted right-side low-poly title sculpture with readable wordmark and actions. |
| `after/04-world-entry-final.png` | Accepted Lumen Yard entry: 251 relief tiles, 74 machine-flora rigs, landmarks, resources, one player rig, HUD, and minimap. |
| `after/05-world-after-movement.png` | Keyboard movement changed coordinates from `0330 · 0360` to `0330 · 0349` and completed `move 1/1` while the 3D stage remained live. |
| `after/06-scan-interaction.png` | Pointer-triggered scan retained visible concentric feedback over the 3D player rig. |
| `after/07-menu-overlay.png` | Journey menu remained readable over the live field. |
| `after/08-world-resumed.png` | Resume restored the world with `depthReady=true`, `mode=world`, and no browser logs. |
| `after/09-live-frame-a.png` | Final live frame, SHA-256 `d7b5a8ab61ea63df2c1572101b6d1f203cc7299cf99a35ac36de46ad82379661`. |
| `after/10-live-frame-b.png` | Same route 900 ms later, distinct SHA-256 `96b0ff5e0f5c494d9d46b617319d6e2520aff087331f792e229dc1db83c5c5be`. |

Fresh diagnostics reported `data-renderer="three-r160"`,
`data-scene3d="protocol-wilds"`, `data-depth-ready="true"`,
`data-authority="presentation-only"`, 251 relief tiles, 74 flora rigs, and no
browser console logs. Distinct live-frame hashes prove visible animation.
Exact frame cadence remains unknown because the active Browser capability
exposes no ephemeral rolling-frame buffer; `CAPABILITY_RECEIPT.json` records
that as an `OPTIONAL_GAP`.

## Source integrity

The entire 009 directory was already modified in a very dirty shared
workspace. Foreign changes were not reset, reformatted, or claimed. Start
hashes were captured before this lane edited every pre-existing file below.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `client/index.html` | `0e7f331ae1e99519db840b1b86477d8865c5d8ab31bf6f2951f4b70b76cb3ea7` | `ff866880f09fc600b907c9a62dc398a6a4f9c83c7f2e0105c3c9f3552f886ab1` |
| `client/styles.css` | `9fce3c166e6f125d21d66b46988eb76f844445e2abd1edd5c2b0d4a192247fc7` | `bab6cb1d9572b088fbf85799f5a92aa2e2c8fcb115b73eca7b4e0f3d8351752` |
| `client/app.js` | `91c24ac58db122f4a85cf2adde74a49a25dd5147096baf7517ef6138fd849c72` | `855cdd3d4901bc8bea87c6c7ac751e042761708482be65f96ada33b4e83e7c6d` |
| `server/server.js` | `965f9c58b5855e13ceed487241c3f641b9ac1f942b921bc0c68287befda240e6` | `77b1dfc162eaa8795177a8d8668c038196b27e47eca090f52f777bd4d11dda77` |
| `game.manifest.json` | `ea8d1a43b4a409b84dd38ab0c19986fd75cb0728296475b595909371e01307e1` | `7bedc72c130a9a82cbdc56dcdc5af49f6e6f0592f6a103b7401c8c88483f17ea` |
| `assets/ASSET_MANIFEST.json` | `20d6afe50a95535ec056447a08db5ebd2e4fc0a368fcb6d91e4748b1a82f055` | `471aa00dc0a6dab298906ef44f4fdffbc498b5e5495200863c6ffb178b36e46b` |
| `THIRD_PARTY_SOFTWARE.md` | `d7a7a79c33bd35d9fc6eae7be0bc2864db86df462ee0ea1fc89216c13a89fe78` | `214f5702984dd6f1edd93bf3b0d372fba05a02165112b495a090065402ae174b` |
| `client/circuitseed-three.mjs` | absent | `f016b3558e9b44504839133c001dcdbd6933cb4a2164235f4420daf4bacbb8ee` |
| `tests/three-visual-contract.test.js` | absent | `6064a28306f983ca4eb9f267e38ebbf4002a1162db19ecb13c85ac5ecb6a54d3` |

Scoped `git diff --check` passed. Git emitted only existing LF-to-CRLF
working-copy warnings.

## Verification

- `node --check client/circuitseed-three.mjs`: pass
- `node --test tests/three-visual-contract.test.js`: `1 PASS`, `0 FAIL`
- `npm test`: `51 PASS`, `0 FAIL`, plus CLI lifecycle, actual GameHub lifecycle, and package verifier pass
- Browser title, entry, keyboard movement, scan, menu, resume, and repeated-live-frame checks: pass

All ten required Workshop checks passed on 2026-08-16:

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

Known non-failing repository warnings remain: legacy `UNDECLARED` tool kinds,
a stale `tools-index.json`, and verification-spine `VERIFIED_WITH_LIMITS`
warnings. Passing tests do not canonize this pass.

## Still unrun / not claimed

- Physical phone, simultaneous multi-controller, two-display, real LAN, and television-distance QA
- Steam packaging, launch options, overlay, controller glyphs, and Deck QA
- GPU compatibility matrix, sustained performance, thermal, and long-run soak tests
- Exact animation cadence, dropped-frame measurement, full accessibility audit, and audio QA
- Full campaign, every region palette/weather combination, and every 1–8-seat presentation state in a live browser

This is a tested visual increment, not Steam acceptance and not canonization.
