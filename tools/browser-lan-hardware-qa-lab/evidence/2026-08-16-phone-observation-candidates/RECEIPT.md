# Physical-phone observation candidate route

Date: 2026-08-16  
Module: `browser-lan-hardware-qa-lab`  
Status: `TEST`; not `CANON`  
Authority: evidence for Mike Tobi / AXM review; no game verification, promotion, or canonization performed

## Outcome

The Browser, LAN & Hardware QA Lab can now turn the Workshop verifier's physical-phone warning list into bounded, per-game candidate receipts. A candidate records six explicit human observations, browser-exposed device facts, loopback latency samples, review notes, and a digest.

This route does not prove that a physical phone exists. It does not alter game manifests or clear verifier warnings. Every candidate is stamped `CANDIDATE_REQUIRES_HUMAN_REVIEW`, `physicalHardwareProven: false`, `manifestMutated: false`, and `externalReviewRequired: true`.

## Lane and custody

- Lane-owned: `tools/browser-lan-hardware-qa-lab/index.html`, `style.css`, `app.js`, `selftest.js`, and this receipt.
- Shared seam: `shared/operations/qa-lab-service.js`; re-read before and after the additive change.
- Preserved foreign baseline: the module manifest, module contract, game manifests, verifier logic, generated reports, and unrelated Workshop changes.
- No game package was modified.

## Behavior added

- The UI reads only the fixed `/exports/game-night-seam-report.json` route and lists games whose exact warning is `physical phone qa is pending`.
- The form never auto-checks any declaration.
- The six declarations cover a visibly separate phone, controller join, seat identity, shared-screen action, deliberate disconnect, and same-controller recovery.
- Missing game selection fails visibly before any write.
- The service accepts only bounded game identifiers and matching three-digit slots.
- Notes are trimmed and capped at 1,000 characters.
- Complete status requires all six declarations; incomplete and failed observations remain preservable.
- Candidate audit metadata contains only bounded status fields, not review notes or raw actions.

## Focused verification

- `node tools/browser-lan-hardware-qa-lab/selftest.js` -> PASS, 21 evidence groups.
- `node shared/operations/wave2-selftest.js` -> PASS, 38 checks.
- `node -c tools/browser-lan-hardware-qa-lab/app.js` -> PASS.
- `node -c shared/operations/qa-lab-service.js` -> PASS.
- Focused `git diff --check` -> PASS; line-ending notices only.

The selftest covers the fixed pending-report route, UI bindings, exact six-field handoff, service normalization, complete-candidate truth flags, candidate counts, game-id path-escape refusal, and slot/game mismatch refusal.

## Live browser verification

Visual backend: `BROWSER_PRIMARY`  
Viewport: 1280x720, device-pixel ratio 1.25  
Surface: trusted loopback Workshop server and the live QA Lab route

1. The page loaded all 15 current physical-phone gaps, exposed all six checkboxes with accessible labels, and stated that the capture is candidate evidence only.
2. The initial live frame exposed centered checkbox/label layout that was difficult to scan. A tool-local stylesheet corrected it to compact left-aligned rows.
3. Final aligned baseline digest: `7da460301a1e462e66efb93eb7c5cee032ecf9aca22d9dfdfe8dd9c1fa7816f9`.
4. Clicking capture without a game produced the visible warning `Choose a pending game before capturing a phone observation.` and wrote nothing.
5. An intentionally incomplete route-exercise candidate for `008-district-party` was captured with every declaration false and notes stating that no physical phone or game interaction was observed.
6. The UI read back one device receipt and one phone candidate. The persisted candidate remained `complete: false`, required external review, claimed neither hardware proof nor manifest mutation, and its recomputed digest matched `ee3f8d17f8e619ccc13869bd4fcde9709dad338f57e06d0b63115c1a1c7e135d`.
7. Receipt-panel frame digest: `25259670427a8eda9e33ab02b09a0cb7d528622ebbc71f3b11c361ac0e06a3bb`.

Repeated screenshots were sufficient for the discrete load, guard, layout correction, and saved-result states. No rolling video was recorded. Browser console history was not captured, so this receipt does not claim a console-clean run. A physical phone, touch input, QR join, shared-screen game action, and real disconnect/recovery remain unobserved.

## Broad Workshop checkpoint

All ten commands required by `AGENTS.md` exited 0:

- `node verify.js`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` -> 55 PASS, 0 FAIL
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` -> 17 PASS, 0 FAIL
- `node tools/evidence-desk/selftest.js` -> 36 PASS, 0 FAIL

Deliberate readiness checkpoint: `node shared/readiness/selftest.js` -> PASS (218 tools, 1907 capabilities).

The verifier remains honestly unchanged at 0 FAIL and 15 warnings. All 15 warnings are physical-phone QA gaps; candidate receipts do not close them.

## Cleanup and remaining boundaries

- Screenshot buffers were nulled and the browser tab was closed; no screenshot file was retained.
- Both loopback test servers were stopped and their ports released.
- The intentionally incomplete candidate remains only in ignored local QA state as labeled negative `TEST` evidence and must not be committed or treated as a pass.
- One isolated production-session directory remains under the operating-system temp root because the host denied recursive cleanup; it contains no accepted hardware claim.
- No commit, push, install, promotion, manifest verification, or canonization was performed.
- Actual physical-phone review remains the next necessary human step.
