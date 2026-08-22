# BuddyFarm dedicated-controller disconnect recovery — TEST receipt

- Status: `TEST`; this is evidence material, not promotion or canonization.
- Date: 2026-08-16 (Europe/Amsterdam).
- Visual backend: `BROWSER_PRIMARY`; no fallback was needed.
- Viewport: 1280×720 landscape at device pixel ratio 1.25.
- Route: production P2 controller, `/controller.html?room=AXM1&player=p2`, served through a leaf-only HTTP fault proxy.
- Launch roster: two human seats — Mike and Nova.

## Exact runtime under observation

- `runtime/controller.html` SHA-256: `B4656715D50C39FF4795BBADDC15F3A8E135B8E331513C03B7323C38D81DEC25`
- `runtime/server.js` SHA-256: `82ACC104B6E8696B72C3F1789A93A5F960238026741E16F3247E38024152CE05`
- `runtime/game-core.js` SHA-256: `4422E5002460F9CAC131FE29D7B7F75B00490359AFBB5A51921E75FDF1C13D28`
- `runtime/world-adapter.js` SHA-256: `1BF31ABC1B3DD8418FF76BD42F5D09A39C9AEB524C2904C65DD91076BBC0EB2B`
- `runtime/app.js` SHA-256: `8438376726B5507481FAC989268074E36518AED9C7C1D15ACE895FE22F474B7B`
- `tests/disconnect-recovery-browser-harness.js` SHA-256: `D858FE83CB6277E612146288E97F8374E0CC2E123E42F77B76BFC7569C027D0B`
- `tests/disconnect-recovery.test.js` SHA-256: `A3155116603D5CDA8ECEAD5C2AACC5A8558B0A0897606C4762A561D2F283F0A6`

The runtime and test hashes stayed unchanged from the pre-browser checkpoint through the recovered action.

## Claim and prediction

Claim: after an already-linked BuddyFarm controller loses HTTP transport, it visibly fails closed, the managed-server shared farm remains intact, restoring transport automatically relinks the same open page, and a fresh action advances authoritative state.

Expected evidence: `LINK LIVE` changes to `LINK LOST · RETRYING`; all six controls disable; the proxy rejects traffic while the untouched origin retains P2's exact revision and position; restoration returns the live label and all controls without reload; a post-recovery move increments server revision, position, steps and walk sequence. Silent loss, enabled offline controls, changed origin state, a stuck loss label, or a missing recovered move would refute the claim.

## Observed sequence

1. P2 rendered as `Nova` with `P2 · HUMAN · LINK LIVE`, a green link dot, farm/day status, and all six touch controls enabled.
2. A live `Move right` input reached the authoritative origin: revision `1`, P2 position `(20,13)`, steps `1`, walk sequence `1`, direction `right`.
3. The fault proxy severed active and new traffic. The production controller changed to `P2 · LINK LOST · RETRYING`, showed `LINK LOST · RETRYING · Failed to fetch`, changed to the red-dot state, and disabled all six controls.
4. A direct request through the proxy failed. The untouched origin remained at revision `1`, position `(20,13)`, steps `1`, and walk sequence `1`.
5. Restoring the proxy returned the same open page to `P2 · HUMAN · LINK LIVE` with all six controls enabled; no reload or manual reconnect action was used.
6. A recovered `Move down` input reached the origin: revision `2`, P2 position `(20,14)`, steps `2`, walk sequence `2`, direction `down`.

The final browser diagnostic log was empty.

## Repeated visual evidence

- Initial connected frame: `FA518238B93AD6059DE9429C6260800674B10FC9E9483730E1EF43A7345DAECC`
- Settled frame after the baseline move: `565A97E9168A60FECF2C324A93F0801FE78843112C285787E809BB0BACCAA1A5`
- Link-lost frame: `7CF964C2B04F9E454945F3120520178C25C16EBA7407861621059A582C2791A3`
- Automatically recovered frame: `565A97E9168A60FECF2C324A93F0801FE78843112C285787E809BB0BACCAA1A5`
- Recovered-action settled frame: `565A97E9168A60FECF2C324A93F0801FE78843112C285787E809BB0BACCAA1A5`

The recovered and settled pre-cut frames are byte-identical because movement changes server world coordinates without changing the controller chrome. These are bounded repeated screenshots, not rolling capture; they support settled-state and transition claims only. Raw screenshot buffers were released after fingerprinting, and no capture files or recordings were created.

## Automated corroboration

- `node --test tests/disconnect-recovery.test.js`: 2/2 passed.
- The integration test launches the exact production server with two human seats behind the same fault proxy, exercises a baseline action, proves origin state continuity during the cut, restores transport, and verifies a fresh authoritative action.
- The pre-change package baseline passed the BuddyFarm playtest-recovery and low-poly Three.js selftests plus all 7 universal-gamepad tests.
- The final package checkpoint passed both named selftests plus 9/9 Node tests (2 disconnect-recovery and 7 universal-gamepad tests).
- All ten repository-required commands exited 0. Notable exact totals were 55/55 HTML syntax checks, 17/17 Agent Tool Forge checks, and 36/36 Evidence Desk checks.
- `shared/readiness/selftest.js` passed with 218 tools and 1,907 capabilities.
- Final verifier checkpoint: `0 FAIL · 19 warn · spine b618c5762240070c`. BuddyFarm's only remaining verifier warning is physical-phone QA.

## Verdict and boundaries

- Verdict: `PASS` for the named 1280×720 desktop P2 dedicated-controller HTTP transport scope.
- BuddyFarm actions are discrete POSTs, not held-input samples. No stale-input TTL is claimed or needed; offline controls are disabled and failed actions are caught.
- The managed-server shared farm persisted across the proxy interruption. This receipt does not claim persistence across server-process restart.
- Not run: physical-phone hardware, real Wi-Fi/LAN interruption, portrait layout, physical gamepad hardware, OS network-adapter interruption, shared-screen recovery, or server restart.
- Physical-phone QA and physical-gamepad QA remain pending and are not implied by this receipt.

## Cleanup

The browser tab was closed after the evidence loop, screenshot buffers were released, the harness exited normally, and neither proxy nor origin port remained listening. No temporary recording paths were created.
