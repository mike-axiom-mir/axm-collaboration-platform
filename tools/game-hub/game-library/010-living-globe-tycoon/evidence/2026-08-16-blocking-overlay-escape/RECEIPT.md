# Living Globe Tycoon blocking-overlay Escape receipt

Date: 2026-08-16  
Status: `TEST`  
Scope: slot 010 production walkable route and separate rules-lab route at 1280x720  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

The production walkable route now gives each visible blocking surface one
bounded Escape path:

- Escape at the semantic entry dialog enters the live world, matching its
  focused entry button.
- Escape closes the Palace dialog, clears its human-input suppression state,
  and restores focus to the Palace toggle.
- Escape closes the full-screen Island Brief and restores focus to the Brief
  toggle.
- Escape while the walkable world has no blocker is inert.
- The separate rules lab has no visible blocking overlay; focused Escape is
  inert and leaves its explicit turn and revision at `0`.

The entry action still begins the browser-local walkable experience. Reading
or closing the Palace and Brief does not issue a proposal, approval, edict,
mission contribution, turn advance, or other deliberate strategic action.
The living globe continues its normal browser-local ecology, timers and native
observation revisions while those surfaces are open; this receipt does not
claim that revisions, receipts, simulation frames, or timers freeze.

## Claim routing

| Atomic claim | Native proof surface | Result |
| --- | --- | --- |
| Entry dialog dismisses with one focused Escape | Chromium keyboard input, accessibility tree, DOM state and before/after pixels | Pass |
| Palace dialog closes and returns focus | Chromium keyboard input, focused-element state, dialog ARIA state and pixels | Pass |
| Island Brief closes and returns focus | Chromium keyboard input, focused-element state, dialog ARIA state and pixels | Pass |
| Escape is inert when no walkable blocker is present | Chromium keyboard input, DOM state and live-world pixels | Pass |
| Rules lab has no blocker and focused Escape advances no turn | Chromium accessibility tree, DOM state and before/after pixels | Pass; turn `0`, revision `0`, zero visible dialogs |
| Static Escape contracts stay wired without strategic authority calls | Dependency-free source test plus HTML script syntax test | Pass |
| Animation cadence is smooth or frame-perfect | Requires rolling frame evidence | Not claimed |

## Native browser observations

Backend: `BROWSER_PRIMARY`, local Chromium against an isolated production
server at `127.0.0.1:18960`. All screenshots were captured at 1280x720,
inspected live, and released after verification; this receipt retains their
SHA-256 identities rather than the pixel files.

| Route and state | Screenshot SHA-256 | Observation |
| --- | --- | --- |
| Walkable entry dialog | `04f6ec481cafac380e68032584adf55238231c4aa5578b0f9276e0470ade15b2` | Named modal dialog; entry button focused and visibly outlined. |
| Walkable world after entry Escape | `fa1216c5d6d62948985e44ac5930d3b46c7a71326d48956244739f0adfb41d5a` | Entry hidden; 3D world and HUD visible. |
| Palace open | `c5016baf14e9a34b6a28cefda46b1ee196224e28c6e7544ff7ffd3cfc9c5cbbb` | Named dialog open; Close focused; human input suppression active. |
| Palace after Escape | `1e5873e9ca04484765b42583e092f76095acaad22a81c361e8ed8f0e3dce5d83` | Dialog hidden; suppression cleared; Palace toggle focused. |
| Island Brief open | `6cbe613d02a38d66588f0f77e270b6e4dec7a8a2bd843bbe488b27ba85089b9b` | Full-screen named dialog open; Close Brief focused. |
| Island Brief after Escape | `5d323f7f755619cb306aed2d079208f586c2c32aa638a5095095be840c0d809b` | Brief hidden; live world restored; Brief toggle focused. |
| Walkable world after no-blocker Escape | `a41590806be6008f06bb8d2b51358d8536eb708714721f08d4834d399384bd35` | Entry, Palace and Brief all remain hidden. |
| Rules lab before Escape | `61bdf4a41fa0b28af6f64bbfe3842678b5376e7deddb1bcdc132f238ea688b89` | Readable stewardship workspace; no visible dialog. |
| Rules lab after focused Escape | `3713b918754b219eeafc3cd308c90d2e7b617fe19a3c6d5cf06780b1f12edf1f` | Same workspace; Next Turn remains focused; turn `0`, revision `0`, zero visible dialogs. |

During the controlled Palace transition, Year 1 / Q1 / spring, treasury `¤0`,
public books, and the active mission identity/progress stayed unchanged while
the native observation revision moved from 9 to 11. During the Brief
transition, Year 1 / Q1 / spring stayed unchanged while its displayed revision
moved from 29 to 34. The active mission remained `Island Supper Service` at
`0/2`; its real-time timer progressed naturally. These moving revisions and
timers are preserved as evidence of the existing living-world boundary, not
normalized away.

## Capability gate

The capability comparator returned `DEGRADED`:

- Required `blocking-overlay-transition`: ready through live screenshots,
  accessibility/DOM inspection and native keyboard input.
- Optional `animation-cadence`: unavailable because the active Browser
  capability exposes no `visual.capture.ephemeral-rolling-buffer/v1` buffer.

Therefore no frame cadence, dropped-frame, or motion-smoothness claim is made.
The exact temporary comparator directory under the Windows temp root was
validated, removed, and confirmed absent after use. Both browser tabs were
closed, screenshot buffers were released, the isolated server was stopped,
and port 18960 had zero listeners.

## Focused verification

- Living Globe honest exam: `103 PASS`, `0 FAIL`
- Game Hub wrapper self-test: pass
- `tests/blocking-overlay-escape.test.js`: pass
- `tests/html-script-syntax-test.js`: `55 PASS`, `0 FAIL`
- Production browser entry, Palace, Brief, no-blocker and rules-lab journeys:
  pass within the scope above

The post-seal game-library verifier reported `0 failure(s) · 20 warning(s) ·
19 game folder(s) checked`. Slot 010 retained only its separate pending
disconnect-recovery warning. The overall warning count also changed through
concurrent work elsewhere, so this lane claims only the slot 010
blocking-overlay closure.

All ten required Workshop checks exited successfully after the manifest and
receipt were added:

- `node verify.js` (`0 FAIL`, 20 extant warnings)
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Passing tests do not canonize the change.

## Source boundaries

The slot 010 package was already modified in a very dirty shared workspace.
Foreign changes were neither reset nor reformatted. This lane reread its source
seams before and after editing and changed only the Escape path, its focused
test, this receipt, and the manifest evidence pointer.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/game/index.html` | `6e542b13b68d0f21a3efa11d361c17d6517f962dd235e91e63fbd27e43b90255` | `0c7444c065e2021d14763da6dbdde22a369112b5c733bd5b2c4d95b79d9fc1ec` |
| `runtime/game/core/steward-panel.js` | `049097dababedd677465d394d552b593ad43981b63c6f6bc3a0d22673c96b1ed` | `c739ef1a12e1d1b6949258bd77ba56e90b152eb140523277013ed3bb70c7e5cd` |
| `runtime/game/core/steward-infographics.js` | `a08375d5a4c5aca3fab3aa144d195243efa6ec03d2d8d8a0a4817c1b7e7ba451` | `76b36f414f01a36c259c812ec4fb9b7e2f513d9d515be8e1779d4bee9afb9a68` |
| `tests/blocking-overlay-escape.test.js` | absent | `8ae720f588f1bb7b50adf82bf7aa6b953847288d8552f6e914cb66127ab11a4d` |

## Still unrun / not claimed

- Physical touch, phone, gamepad, screen-reader, alternate viewport, LAN and
  television-distance QA
- Pointer-lock behavior on every browser/OS combination
- The test-only `?exam` full-screen route and forced long-run outcome states
- Sustained motion, frame cadence, dropped frames, GPU/thermal performance and
  long-run soak behavior
- Disconnect recovery, which remains a separate pending game-night seam

This is a bounded `TEST` result, not Steam acceptance and not canonization.
