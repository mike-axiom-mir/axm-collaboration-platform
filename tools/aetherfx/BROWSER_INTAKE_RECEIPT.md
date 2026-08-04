# AetherFX live browser intake receipt

Date: 2026-07-28  
Status: `PASS — bounded Workshop intake observation`  
Visual backend: `BROWSER_PRIMARY — Codex in-app browser`  
Route: `http://127.0.0.1:43173/OPEN_STUDIO.html` from the capsule's contained local server

## Claim 1 — the integrated Studio renders as a usable desktop surface

- Viewport: 1600 × 1000
- Baseline: the bundled Studio exposed the 64-module library, live Command Dashboard preview, simple controls, integrity signal, toolbar, and three-column workspace.
- Observed: panels were visible and aligned; the central preview rendered; the library and inspector used bounded internal scrolling; no blank or blocked surface appeared.
- Console warnings/errors: 0
- Verdict: `PASS`

## Claim 2 — guided creation remains visible and reversible

- Action: opened `Guide`, then selected `Build guided foundation` with the default Command Dashboard choices.
- Expected: an inspectable guided-creation dialog closes into an ordinary editable recipe and records recovery state.
- Observed: the dialog showed outcome, mood, energy, device, and protection controls; build closed it; the Studio reported `Rollback snapshot saved locally`; the active recipe stayed editable. The temporary recipe was reset to the original 11-layer default after the check.
- Verdict: `PASS`

## Claim 3 — photosensitive-safe state reaches the rendered stage

- Action: enabled the visible `Photosensitive safe` control once, then disabled it after observation.
- Expected: the control visibly changes and the live stage receives its protective class.
- Observed: the switch changed visibly and the stage class changed from `axm-stage quality-high` to `axm-stage quality-high is-photosensitive-safe`. No sweep or shimmer instances were active in that recipe, so their computed animation suppression was not re-proven by this bounded observation; that behavior remains covered by the 36-test integrated suite and packaged upstream Chromium proof.
- Verdict: `PASS` for state routing; `UNKNOWN` for live computed sweep/shimmer suppression in this exact recipe.

## Claim 4 — the integrated Studio remains contained on a phone viewport

- Viewport: 412 × 915
- Observed metrics: document width 397 px; horizontal overflow 0 px; stage width 375 px; stage height 500 px; visible dialogs 0.
- Observed pixels: preview cards stacked into one column, the chart stayed inside its surface, the library followed the preview, and toolbar overflow moved into the compact control.
- Console warnings/errors after all interactions: 0
- Verdict: `PASS`

## Closure

- Motion cadence: not claimed; repeated screenshots were used instead of a rolling capture.
- Buffer digest: not applicable; no recording or filesystem screenshot buffer was created.
- Temporary paths deleted: none created.
- Browser tab finalized: yes.
- Temporary viewport reset: yes.
- Test recipe/protection state restored: yes.
- Contained local server stopped: yes, exact PID 16084.
- Remaining human gate: visual taste, target-engine rendering, and canon approval.
