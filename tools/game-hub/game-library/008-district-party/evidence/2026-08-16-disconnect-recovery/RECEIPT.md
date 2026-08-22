# District Party disconnect-recovery receipt

Date: 2026-08-16  
Package: `008-district-party`  
Status: `WORKING` within the bounded `TEST` scope below; not `CANON`  
Authority: evidence for Mike Tobi / AXM review; no promotion or canonization performed

## Outcome

The runtime-issued P2 Human phone-controller page now fails closed when its link is lost and recovers on the same page when transport returns. During the live check, the authoritative game server retained the session, neutralized held input after the existing 600 ms timeout, marked the actor disconnected after the existing 5 s timeout, and accepted a fresh authoritative inventory open/close action after reconnection.

This receipt closes the software disconnect-recovery seam only for the tested desktop-browser route. Physical phone/touch behavior remains pending.

## Bounded live scope

- Browser backend: browser-primary interactive session.
- Viewport: 1280x720, device-pixel ratio 1.25; the controller rendered at its desktop maximum width.
- Route: real managed District server, runtime-issued P2 Human controller URL, and a fault proxy placed between that controller page and the server.
- Transition: live -> transport cut -> lost/disabled -> transport restored -> live, without page reload or session replacement.
- Recovery proof: the Inventory control opened and then closed the authoritative inventory after reconnection.
- Excluded: physical phone hardware, touch-event behavior, QR scanning, shared-screen behavior, server-process restart recovery, and multi-device venue testing.

Repeated screenshots were sufficient for the discrete state transitions. No rolling video was recorded. Browser console history was not captured, so this receipt does not claim a console-clean run.

## Live observations

### Connected baseline

- Identity: P2 Nova, `PARTY A · SEAT_2`.
- Status: `LOCAL LINK · LIVE` with the live treatment.
- All eight controller buttons and both virtual sticks were enabled, except the correctly hidden inventory-navigation controls while inventory was closed.
- Stable frame digest: `78cd691efa662c6a8e27c5fb78f5412fef5e530b61fdc0fcb2581d8c67693399`.

### Transport cut

- Status changed to `LOCAL LINK · LOST · RETRYING` with the lost treatment.
- The body entered `link-lost`; all eight controller buttons were disabled.
- Both virtual sticks reported `aria-disabled=true`; their visible copy changed to `MOVEMENT PAUSED` and `AIM PAUSED`.
- The early and settled lost frames matched: `a3a5bd4159fdf3ed304c0858f3c31071d00ef09dd854544900b4cf5f8fcc67df`.
- After more than 5 seconds, server state retained the same session and running room, kept the P2 actor at `(5820, 4520)`, closed inventory, and reported the actor disconnected.

### Transport restored

- The same page returned to `LOCAL LINK · LIVE`; buttons and sticks were restored.
- The settled connected frame returned to the baseline digest: `78cd691efa662c6a8e27c5fb78f5412fef5e530b61fdc0fcb2581d8c67693399`.
- Clicking Inventory opened authoritative state (`open · 7/18`, `BAG 1 EMPTY`); the visible inventory-navigation controls were enabled and the movement/aim sticks were disabled contextually.
- Inventory-open frame digest: `7959d9816fa90e151cc5baf635894be5ae63c1e8aa0a4cbacc2b38363c23f1e5`.
- Clicking Inventory again closed it. In the final combined-state rerun, server state still used the original session and room, reported P2 connected, retained position `(5820, 4520)`, and had accepted fresh input through sequence 1250.

The complete browser sequence was repeated after a concurrent contributor added offline keyboard/pulse guards to `controller.js`. The final combined bytes reproduced all three frame digests and the same authoritative disconnect/recovery behavior.

## Automated evidence

- Focused disconnect suite: `node --test tests/disconnect-recovery.test.js` -> 2 passed, 0 failed.
- Concurrent input-neutralization regression: `node --test tests/disconnect-recovery-input-neutralization.test.js` -> 1 passed, 0 failed.
- Controller and authority subset: four-controller, twin-stick, inventory integration, static runtime contract, and blocking-overlay escape suites -> 32 passed, 0 failed.
- District package after the concurrent guard landed: `npm test` -> 228 passed, 0 failed.
- Workshop HTML script syntax check -> 55 passed, 0 failed.
- All ten AGENTS.md required commands exited 0: `verify.js`, the Hub, route, graft, skin, and verify-plus checks, the HTML and Tool Forge package checks, and the Agent Tool Forge and Evidence Desk selftests.
- Deliberate broad readiness checkpoint: `node shared/readiness/selftest.js` -> PASS (218 tools, 1907 capabilities).
- Workshop verifier checkpoint: 0 FAIL, 15 warnings, spine `b618c5762240070c`; all 15 remaining warnings are physical-phone evidence gaps.

The focused integration test uses the real `server/server.js`, a runtime-issued controller token/path, and a cuttable loopback proxy. It asserts input neutralization after 600 ms, authoritative disconnect after 5 s, session continuity, and acceptance of fresh movement after recovery.

## Files in this lane

- `client/controller/controller.html`: accessible live-region connection label.
- `client/controller/controller.css`: explicit lost state and disabled affordances.
- `client/controller/controller.js`: fail-closed link state, disabled inputs, retry polling, automatic same-page recovery, and preserved concurrent offline keyboard/pulse guards.
- `tests/disconnect-recovery-browser-harness.js`: real-server fault-proxy harness.
- `tests/disconnect-recovery-input-neutralization.test.js`: concurrent additive guard regression, discovered and preserved during the final checkpoint.
- `tests/disconnect-recovery.test.js`: source contract and end-to-end authority assertions.
- `game.manifest.json`: bounded verification claim and evidence paths.
- This receipt.

The server timeout constants and player-system/input-router authority behavior were inspected and exercised but not changed. Existing server, world, asset, and unrelated package work was preserved. The concurrent guard/test addition was not overwritten or silently claimed as lane-owned work.

## Cleanup and remaining boundaries

- The browser tab was closed and screenshot buffers were nulled.
- The harness shut down normally with exit code 0; its proxy and origin ports had no remaining listeners.
- No temporary runtime files were retained.
- No commit, push, promotion, or canonization was performed.
- Physical phone/touch QA remains `pending`; it must not be inferred from this desktop-browser evidence.
