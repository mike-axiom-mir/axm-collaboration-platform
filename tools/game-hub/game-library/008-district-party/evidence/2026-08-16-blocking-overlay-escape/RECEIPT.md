# District Party blocking-overlay Escape receipt

Status: `TEST`

Date: 2026-08-16

## Claim under test

On the production Party A shared screen, Escape provides a reversible local
session layer when a server-authoritative blocking surface is present. The
local layer must not select, start, cancel, save, purchase, equip, resolve, or
pause server-owned state.

## Native journey

The journey ran through the production launcher and production controller at
1280 x 720 with one human seat in an isolated temporary data root.

1. Started a local city session from the launcher and reached the live Party A
   city screen.
2. Pressed Escape with no blocking surface: the city remained live and no
   session layer appeared.
3. Opened the full map and pressed Escape: the map closed directly to the live
   city without opening the session layer, preserving the existing map route.
4. Used the production controller ACTION button beside the Party House mission
   board. The server-authoritative mission board opened with `Supply Sweep`
   selected.
5. Pressed Escape on the Party screen. A local `SESSION MENU` appeared, focus
   moved to `RETURN TO MISSION BOARD`, and the underlying mission board was
   marked `aria-hidden="true"` while remaining in place.
6. Pressed Escape again. The local layer closed, `aria-hidden` was removed, and
   the same mission board and selection were restored.

## Authority evidence

The host state was sampled immediately before the local layer, while it was
open, and after return. The simulation tick advanced normally (`4048`, `4645`,
`5062`), while this authority-bearing subset remained unchanged:

- session status: `running`
- mission status and phase: `board` / `board`
- selected mission index: `0`
- mission control actor: `actor-seat-1`
- actor position: `5780, 4520`
- actor inventory open: `false`
- actor city menu open: `false`
- group-save computer open: `false`
- presentation map-toggle sequence: `0`

The bridge implementation contains no fetch call or `/api/` route. Its own
copy states the exact boundary: no mission, save, purchase, item, result, or
pause authority.

## Screenshot observations

Screenshots were captured from the native in-app browser and inspected during
the run. SHA-256 digests identify the exact ephemeral frames:

| Observation | SHA-256 |
| --- | --- |
| Live city before interaction | `8d329361f3e271433ffeb1f5aff3be97d19b1a2ba4730123c58b4a3ec33d3494` |
| Full map open | `e352efa9b7a929226044037cff35cd4f38b03ac4f2343826bd53982fa9a4e953` |
| Live city after full-map Escape | `9719237b3c93c54a7ea42e24e7561a3bc79b5956f4be6176eb7ce776fe8f0fca` |
| Mission board before local layer | `82b04deb3a4e988c6716e39c70826cbc43e4b71d2efd236e3d3d84a8c7492919` |
| Local session layer over mission board | `bf2f3004a98614f4d8647a7c133412ab7daacdd87fd5d6b84d2527b643f6d387` |
| Mission board restored | `8b9b30c30e0c59fa838cfe4e4ca429794c5dd05335b7d6ffbde22a6239c15a09` |

The bridge frame showed a centered, legible modal with a visible keyboard-focus
ring. DOM snapshots independently confirmed the dialog text, active return
button, underlying `aria-hidden` state, and restored board.

## Verification performed before checkpoint

- `node --test tests/blocking-overlay-escape.test.js` - pass
- `node --test tests/city-map-ui.test.js` - 6 pass, 0 fail
- `node --test tests/static-runtime-contract.test.js tests/shared-hud.test.js` - 12 pass, 0 fail
- `node tests/html-script-syntax-test.js` - 55 pass, 0 fail
- game-library verifier before manifest update - 0 failures, 25 warnings, 19 games

The repository checkpoint is recorded below after it completes.

## Capability boundary

Capability comparison returned `DEGRADED`: the in-app browser and bounded
screenshots were sufficient for the required static transition claims, but no
tool implementing `visual.capture.ephemeral-rolling-buffer/v1` was available.
This receipt makes no animation smoothness, frame cadence, or missed-frame
claim.

## Isolation and cleanup

The host ran only on `127.0.0.1:18958` with a dedicated temporary data root.
No existing District Party `local-data` was used. Browser tabs were closed, the
listener was stopped, and the exact temporary root was permanently removed
after its resolved path was verified beneath the system temp directory.
Ephemeral session and seat credentials are intentionally omitted.

## Limits and preserved uncertainty

The mission board, full map, and no-blocker paths were exercised live. Results,
venue, save-computer, and inventory blockers are covered by structural tests
but were not each opened in this native journey. Phone layout, physical
gamepads, screen readers, LAN clients, disconnect/reconnect, alternate viewport
sizes, and sustained animation behavior remain untested here.

This is `TEST` evidence. It is not a `CANON` decision.

## Repository checkpoint

All required Workshop checks completed with process exit `0`:

- `node verify.js` - 0 fail, 23 warnings
- `node hub/hub-selftest.js` - 0 fail
- `node hub/route-selftest.js` - 0 fail
- `node hub/graft-selftest.js` - 0 fail
- `node hub/skin-selftest.js` - 0 fail
- `node hub/verify-plus.js` - 0 fail; verification spine
  `VERIFIED_WITH_LIMITS`
- `node tests/html-script-syntax-test.js` - 55 pass, 0 fail
- `node tests/tool-forge-package-test.js` - pass; package remained
  `installed: false`
- `node tools/agent-tool-forge/selftest.js` - 17 pass, 0 fail
- `node tools/evidence-desk/selftest.js` - 36 pass, 0 fail

The final District Party package suite passed 225 tests with 0 failures. The
game-library verifier passed all 19 folders with 0 failures and 23 warnings.
