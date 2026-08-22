# SMALL ODDS active RAM handoff

Updated: 2026-08-16 after **Neighborhood Debt Aftermath + hybrid low-poly 3D**.

## Persistent objective

Keep deepening Small Odds and the other AXM Local Game Hub games toward the user's near-term Steam launch and longer-play goal. Milestone 11 is **WORKING**, not CANON, completion, or blockage.

## Workspace truth

- Branch: `local-visual-fabric-20260728`.
- Owned lane: `tools/game-hub/game-library/017-small-odds`.
- The root is a large dirty shared worktree. The complete Small Odds slot is untracked; do not normalize, stage, revert, delete, or absorb foreign work.
- Five root generated registry/index files were already dirty before this pass and remain preserved.

## Current version and implemented frontier

- Game save version: **11**.
- Package: **0.11.0**.
- Manifest: `0.11.0-neighborhood-debt-aftermath-3d-working` / **WORKING**.
- Target session declaration: 55 minutes.

### Debt aftermath

- `STARSPITE_DEBT_ROUTES` defines solidarity, Long Table, and Hushglass responses with distinct gates/effects/markers.
- `replayValidCasinoLoss` verifies the source seed/outcome/table/stake/winning set/insurance/net instead of trusting a loss counter.
- `starspiteDebtProfile` keeps locked/open routes visible and queues distinct unhandled receipts.
- Start and return receipts are `small-odds.debt-aftermath-start/v1` and `small-odds.debt-aftermath-return/v1`.
- Return payment cannot exceed the source loss, resolves once, stays separate from daily storefront income, and cannot mutate Starspite net or RNG.
- Migration creates neutral aftermath state for v1-v10 saves.

### Hybrid low-poly 3D

- `runtime/world-three.js` renders all six places with dependency-free WebGL 1, depth, 480x270 pixelated resolution, 16-step lighting, block-built Pip, and persistent recovery markers.
- `runtime/renderer.js` remains authoritative Canvas interaction art with alpha blending.
- If WebGL initialization fails, the 3D canvas hides and Canvas returns to full opacity.

## Verification truth

- Package: 102/102 tests.
- JSON: 39/39 valid.
- Isolated package verifier: 0 errors.
- Desktop browser: six live scenes, one full loss→route→return→reload cycle, distinct repayment marker, 44px route buttons, no duplicate ids, no unnamed visible buttons, no desktop overflow, empty diagnostic log.
- Root: all 10 required checks exit 0; `verify.js` reports 0 FAIL / 38 warnings.
- Detailed causal and visual receipts: `BUILD_RECEIPT.md`, `MILESTONE_11_NEIGHBORHOOD_DEBT_AFTERMATH_3D.md`, and `evidence/NEIGHBORHOOD_DEBT_AFTERMATH_3D_EVIDENCE_ROUTE.md`.

## Current browser-local QA state

- Lopsided Lane, Day 32 21:00 afterglow.
- 2,066 credits, 100 energy, portal 3/3, storefront rating 12.
- One Long Table recovery completed from a final -1 Starspite receipt; the saved casino net remains -3.
- One replay-valid -2 Truth Coin loss is next and all three routes are open.
- 3D renderer reports `webgl-low-poly`, `480x270`, 16 steps, and durable `repayment-stamp`.

## Honest next routes

1. Add gamepad parity and controller focus evidence; this is a concrete Steam/living-room risk.
2. Deepen one existing location with a 10-15 minute repeatable sub-arc and a visibly changing 3D prop instead of adding a shallow seventh place.
3. Add one bounded production-minded Pip rig/animation seam with provenance, performance budget, and fallback.
4. Create a separate Steam-readiness lane for builds/depots, Cloud, overlay, achievements, store assets/copy, legal/privacy, install/update/uninstall, certification, and release checklists.
5. Run fresh 390x844, context-loss, GPU-matrix, physical controller, screen-reader, and independent 30-60 minute playtests before promoting those claims.

Do not call passing tests CANON. Mike Tobi remains the review, merge, promotion, and release gate.
