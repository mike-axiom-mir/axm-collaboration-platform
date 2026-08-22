# Casino 007 low-poly Three pass 01

Date: 2026-08-16  
Status: `WORKING`  
Scope: registered GameHub Casino Alpha route only  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

The registered `007-casino-alpha` host and controller routes now mount a real
Three.js r160 WebGL scene behind the existing semantic UI. The host district is
a low-poly tabletop with a perspective grid, pylons, party towers, player
markers, cabinet geometry, lighting, fog, shadows, and moving debris. The
controller has a style-aware low-poly cabinet character and stage behind the
existing readable reels, wallet, jackpot, cabinet selector, and controls.

This pass did not change Casino outcome generation, ledger rules, economy,
seat authorization, persistence, spin settlement, or GameHub result return.
The server changes only expose the new render module and the Workshop's shared
Three.js runtime.

No downloaded or generated art was introduced. See `ASSET_LICENSES.md`.

## Browser proof

All captures are Chromium screenshots at 1265x712 from a 1280x720 Browser
viewport against an isolated Casino state file outside the repository.

| Evidence | Observation |
| --- | --- |
| `01-before-setup.png` | Original setup route before the visual pass. |
| `02-before-host-district.png` | Original host district: semantic DOM/CSS layout, no canvas. |
| `03-before-controller-cabinet.png` | Original controller cabinet: semantic DOM/CSS robot, no canvas. |
| `04-after-host-district-3d.png` | Fresh host route with one canvas, `data-renderer="three-r160"`, and `data-scene3d="casino-district"`. |
| `05-after-controller-cabinet-3d.png` | First correction target: real 3D mounted, but the head was too dark/hidden. Preserved as failed evidence. |
| `06-after-controller-cabinet-framed.png` | Framing correction. |
| `07-after-controller-cabinet-polished.png` | Brighter cabinet correction. |
| `08-after-controller-cabinet-faceted.png` | Accepted LUX-5 framing with a faceted low-poly head and one persistent canvas. |
| `09-after-graftgarden-3d.png` | Live cabinet switch to Graftgarden changed the render style and title while canvas count stayed one. |
| `12-spin-midpoint-fixed.png` | Keyboard-triggered spin midpoint: `spinning=true`, button `REELS SPINNING...`. |
| `13-spin-settled-fixed.png` | Same viewport after settlement: draw 433 to 508, wallet 249 to 248, `spinning=false`, one canvas. |
| `14-after-host-followup-a.png` | Host follow-up frame, one canvas. SHA-256 `cd5c3ee15abd3338e654b395ca7bf9a135ff5fcd602f684d481268a247dd0ba1`. |
| `15-after-host-followup-b.png` | Same route 900 ms later, still one canvas and a distinct image hash: `534a7b357648b5f0c00f56d9ba5792bfd9eacb28785a6c01b85740c4c0bc4cbf`. |
| `16-after-gamehub-play-intent.png` | Fresh manifest launch intent redirected to the occupied controller seat and mounted one `three-r160` `low-poly-cabinet` scene. |

Fresh host, controller, and direct-entry diagnostic logs contained no browser
warnings. The existing 900 ms application polling did not multiply canvases.

Repeated screenshots and distinct hashes prove live scene change. Exact frame
cadence remains unknown because the active Browser capability exposes no
ephemeral rolling-frame buffer. `CAPABILITY_RECEIPT.json` records the required
visual route as `READY` and this cadence measurement as an `OPTIONAL_GAP`.

## Source integrity

The Casino directory was already modified before this pass, inside a very
dirty shared workspace. These start hashes were recorded before editing, and
foreign changes were neither reset nor reformatted.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `alpha/client/index.html` | `82e95e27a0c0406e898f8da6bb43335594e30e7f583ccfeee336fedb92397e36` | `0648bb32853bb873378099c8ba4e97a9289626b01722830516eb9edf10233d98` |
| `alpha/client/styles.css` | `60c97f54142a775deb756d28429ee6cff82f1eb9d33e275c62a9133165a139be` | `e5cfb37b1bc75aa9af578ad05639ebc4d2df1f11a8d97d97040c8f33ed40562c` |
| `alpha/runtime/casino-server.cjs` | `49aaf4a6960375d88f3767e85b3b8ae8e43c74de7092b578db31ed7c270d6629` | `d679cba9f04e0ce77569e99a239c6ca21ba546ee2272d28977b90058ccf5e010` |
| `game.manifest.json` | `8ae38da8bdba79407e2c1466db57bf8fea218aa6e61ace94b60e1406dec3d464` | `6a0fa64765057fc47272d3a7035538548aff1f75a11930048905c17eb9d4211b` |
| `alpha/README.md` | `203368a158b9fafbdf9e4d6b3fed8203e3f598778f5ca4c39f7deafdcc962ba92` | `8dd7eb07298b5c82049b5ab8296da0db5c046286efa0f91fa4f102e8f7d14c82` |
| `alpha/client/casino-three.js` | absent | `f08556fa196afe149ca5fa934c35179dd99e8c1b2dd5807cc6d3e3ac543498ce` |
| `ASSET_LICENSES.md` | absent | `715d9c1fe80f74a9c552dad4318fd0d3320f2aa3fccc8264ea009a8c512527c8` |

Scoped `git diff --check` passed. Git emitted only the repository's existing
LF-to-CRLF working-copy warnings.

## Verification

Focused checks passed:

- `node --check alpha/client/casino-three.js`
- `node --check alpha/runtime/casino-server.cjs`
- manifest JSON parse
- `node alpha/tests/run-all.js`: all eight Casino suites passed; the core suite
  covered 20 contracts and the LUX math suite covered 15 checks

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

- Physical phone, gamepad, eight-seat, and real LAN-device QA
- Steam packaging, launch options, overlay, controller glyphs, and Deck QA
- GPU compatibility, sustained performance, thermal, and long-run soak tests
- Exact animation cadence or dropped-frame measurement
- Final art direction, accessibility, recorded audio, and mobile/PWA QA

This is a tested visual increment, not Steam acceptance and not canonization.
