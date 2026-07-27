# Verification Spine v2 live QA receipt

Date: 2026-07-22  
Route: `http://127.0.0.1:8788/tools/verifier/index.html`

## Category judgement surface

- Claim: every registered category is visible with its current receipt state and its native baseline exam.
- Surface: Verifier v2, normal desktop viewport.
- Baseline: the first live render exposed an empty category strip because the browser adapter read obsolete registry field names.
- Repair: the adapter now reads `registry.categories` and `registry.profiles`, then loads every referenced category pack.
- Settled observation: 8 category cards, 8 expandable baseline exams, 6 target profiles and no horizontal overflow.
- Verdict: PASS after one named `VISUAL_SEAM` repair.

## Failure-memory lifecycle

- Claim: a failure can become a candidate and later an active regression without losing its original observation.
- Action: entered a phone-reconnect observation, category `game`, profile `game-night`, high risk, bounded `file-exists` check; added it as a candidate; reopened it; supplied a revision reason; promoted it to active.
- Settled observation: the card moved from candidate to active, revision count became 1, and the original source field remained disabled/preserved.
- Reload observation: because the config was not downloaded/replaced during QA, the temporary browser candidate disappeared on reload as designed.
- Verdict: PASS.

## Responsive layout

- Claim: the judgement and failure-memory surfaces remain usable at a 390 x 844 mobile viewport.
- Observation: category and form grids collapsed to one column; `documentElement.scrollWidth` remained below `window.innerWidth`; no horizontal overflow was present.
- Verdict: PASS.

## Evidence retention

- Raw video: not captured; motion evidence was not required for these static and bounded state transitions.
- Screenshots: observed ephemerally through the live browser verifier and not written into the Workshop.
- Temporary local capture paths: none.
- Temporary QA server: exact process stopped after inspection.
- Cleanup complete: yes.
