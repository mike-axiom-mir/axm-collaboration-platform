# Relaybound low-poly visual pass 01

Status: `WORKING` browser repair evidence inside a game package that remains
`TEST`. This receipt is not `CANON` and does not promote the game.

Date: 2026-08-16  
Game: slot `004` · Relaybound `0.4.0-echo-chamber`  
Route exercised: `http://127.0.0.1:8124/?player=screen`

## Bounded visual change

- Restored Kenney Modular Dungeon Kit's official CC0
  `Models/GLB format/Textures/colormap.png` atlas.
- Changed static serving order so a real packaged file wins over the emergency
  1x1 fallback, with an explicit `x-axm-asset-authority` response header.
- Added a versioned Three.js texture URL so an obsolete cached fallback cannot
  survive a local game update.
- Applied nearest-filtered palette texture sampling, flat faceted shading,
  muted mesh-specific stone tints, and rough low-metal materials to the
  existing 3D dungeon assets.
- Added live canvas diagnostics for render backend, loaded asset count, draw
  calls, triangle count, and frame count.
- Added `tests/visual-assets.test.js` and package-required paths for the atlas
  and its verification test.

No gameplay rules, seat semantics, character meshes, or Foundation files were
changed by this visual pass.

## Source authority

- Kenney asset page:
  `https://www.kenney.nl/assets/modular-dungeon-kit`
- Official archive used:
  `https://www.kenney.nl/media/pages/assets/modular-dungeon-kit/7bed87605b-1771926065/kenney_modular-dungeon-kit_1.0.zip`
- Packaged atlas: `runtime/assets/world/Textures/colormap.png`
- Atlas bytes: `28309`
- Atlas SHA-256:
  `FC9E729B10296CCCC9466ECBB4DAC7EA0575E2A0798A72ED94D41B0B8A73D824`
- License: CC0; the archive license matches
  `runtime/assets/world/KENNEY_LICENSE.txt`.

## Browser observations

Baseline browser observation reproduced five identical
`THREE.GLTFLoader: Couldn't load texture Textures/colormap.png` errors and the
pale dungeon fallback appearance.

Final cache-safe reload produced zero new console messages. Live canvas
diagnostics reported:

| State | Backend | Style | Assets | Draw calls | Triangles |
| --- | --- | --- | ---: | ---: | ---: |
| Ready / first chamber load | `three-webgl` | `nearest-palette-flat` | 8 | 53 | 67,670 |
| Echo Chamber, six Echoes | `three-webgl` | `nearest-palette-flat` | 8 | 65 | 73,230 |

The browser was driven through the visible Ready gate, then the test-only API
advanced the same live server session from the first chamber to the upgrade
relay and Echo Chamber. The final state reported `combat`, stage `2`, relay
count `1`, and six live Echoes.

## Screenshot inventory

All captures are 1280×720 PNGs from the in-app browser.

| File | SHA-256 | Meaning |
| --- | --- | --- |
| `baseline/01-ready-missing-texture.png` | `ADA2E63AA8A9443C1820728EC21822E8A0AA4FEAA589C108ABDCEA45A096DE20` | Ready gate before repair |
| `baseline/02-combat-pale-room.png` | `09AC04644BA399E7C0FE35E2CAE26FA7D7733E8B4148622CF6ADF6ADB10CD02B` | First chamber with pale fallback surfaces |
| `final/01-ready-colored-dungeon.png` | `F1F767F79944D5CEAE4083982AB098F6F13DD0000E233277B0100254B2944D24` | Ready gate with restored palette behind overlay |
| `final/02-combat-colored-dungeon.png` | `BBD68D07A34DF6F9D8A9D3DBAE4B0D4291E9CD2305A664FF7D51F92F364A6CBA` | Repaired first chamber during down/revive pressure |
| `final/03-echo-chamber-colored-dungeon.png` | `E4CA4D1F3EAEC38E18131943DF037621FF61A25FC8A8AD2861C3B9C4AFA2870B` | Repaired Echo Chamber after the role relay |

## Focused verification

All passed after the final source edit:

- `node tools/game-hub/game-library/004-relaybound/tests/visual-assets.test.js`
- `node tools/game-hub/game-library/004-relaybound/tests/partner-choice-http.test.js`
- `node tools/game-hub/game-library/004-relaybound/tests/movement-pressure-http.test.js`
- `node tools/game-hub/game-library/004-relaybound/tests/echo-chamber-http.test.js`

The visual-assets test verifies the PNG signature, exact atlas byte count and
hash, all eight world GLB atlas references, server serving order, browser cache
key, HTTP MIME type, response authority, cache policy, delivered byte count,
and delivered hash.

## Workshop verification

All required checks passed at this checkpoint:

- `node verify.js` — `0 FAIL · 38 warn`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` — `55 PASS · 0 FAIL`
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` — `17 PASS · 0 FAIL`
- `node tools/evidence-desk/selftest.js` — `36 PASS · 0 FAIL`

## Final source hashes

| File | SHA-256 |
| --- | --- |
| `runtime/relaybound-server.cjs` | `4D97B6C591AFAF9DA7C54A4023E6FA40456FA14CC6D2A625DB76A1C65C9BBA54` |
| `runtime/relaybound-client.html` | `8C94739D1494A3918ED0E92E647301E6BFEED5E679BA54827BDD4022DCBC5428` |
| `game.manifest.json` | `972C098228E5C6A93453B0C9B6D3349A2C26900503486268AD7CFF41BA4AD603` |
| `README.md` | `C851990C626D1D5B789BCEE6CA47EC801C5A0B62926CB0E5BF67A59A3FF1ABC7` |
| `ASSET_LICENSES.md` | `14AF10C1FC76ABE57513FB4AD12F90FA7FAEFC69EE5D2B7E3FA8A112D67498F9` |
| `tests/visual-assets.test.js` | `49B60E4DF3F0F840F7483677D67CEBBA49145C6C6EBABB6E661CB15A1E86F9FA` |

The pre-pass hashes captured before text edits were:

- server: `115B22CFC7C3D65D3B277FC87BB085D955B455ECFBC4130F8297AA7FDBDF7E04`
- client: `493FCA6A339A9092E7B5B282FF6E1A9A487BD7234A9B4D6843056E99D2D2345A`
- README: `34CBDD371A8329064690CB7B93F75379AAE8311F5590C463E0D6C89AFDFE3CE8`
- asset license record:
  `FED030FF39B7C7B1390927E639C421AACAE00DB3A24D5F5687A22DC4972DDDAC`

## Honest boundaries

- No physical phone or physical gamepad was available for this pass.
- No full human two-player balance/play-feel session was performed.
- Steam packaging, Steam Input, target-PC performance, and release deployment
  were not exercised.
- Screenshot evidence proves the stated 1280×720 browser states only; it does
  not prove every camera angle or full eight-minute route.
- The package remains `TEST`; Mike Tobi remains the review and merge gate.
