# Mirror Content-Bound Language Cycle — Action Report

Date: 2026-07-19  
Status: TEST  
Canon acceptance: not requested and not granted

## Outcome

New private language cycles now bind their complete preserved result content to
a SHA-256 result digest. Their cycle ID is derived from both the already sealed
input digest and the new result digest. The committed Seam judgement names the
same result digest, and exact reuse refuses ambiguous duplicate outcomes that
claim identical inputs.

This repairs a local integrity seam. It does not make the learned challenger a
runtime model, make repeated local regression evidence independent, or turn a
local hash into an external trust anchor.

## Seam found

The earlier cycle identity was derived only from the corpus, split, and
implementation input digest. Artifact bytes and split inputs were verified,
but a later edit to non-input fields in `cycle.json`—for example a challenger
metric, promotion state, or claim boundary—did not change the input-derived
cycle ID. `seam-report.json` was bound to the cycle ID, but its summary or
judgement could also be altered without an independent report reconstruction.

That was too weak for a self-growing learner: preserved outcomes must be
distinguishable from preserved inputs.

## What changed

- `training/learning-cycle.js` now calculates `resultDigest` over the full cycle
  with only `cycleId` and `resultDigest` normalized out of the digest basis.
- New cycle identity is derived from both `inputsDigest` and `resultDigest`.
- Exact reuse searches verified history by the complete input digest. More than
  one preserved cycle claiming the same inputs forces an explicit divergence
  hold rather than first-file selection.
- `kernel/seam-cell.js` can bind a report subject to a 64-hex content digest and
  reconstruct a report's ordering, summary, boundary, and report ID to verify
  internal integrity.
- A new cycle's Seam report must bind the exact cycle result digest. When the
  recorded Seam source hash matches the current source, the judgement is also
  recomputed from the cycle and compared exactly.
- The learning-cycle contract now requires `resultDigest` for new contract-valid
  cycles.
- The Seam-report contract now declares subject `id`, `kind`, and the optional
  64-hex content digest used by result-bound subjects.
- Legacy input-bound cycles remain readable for immutable split lineage. They
  are deliberately not relabelled as content-sealed.

## Preserved red evidence

The first focused execution passed six existing tests and failed exactly three
new expectations:

- the cycle had no result digest;
- altered non-input result content did not refuse reuse;
- an altered Seam summary did not refuse reuse.

After the repair, the focused language-cycle, native-language, and Seam suite
passed 24/24. Added adversarial coverage also proves legacy readability and
forces a hold when a valid legacy-shaped record and a sealed record claim the
same inputs.

## Exact private cycle evidence

- Cycle: `cycle-9ca9c0b111cf49383b42`
- Input digest: `8bd9a4902c7a0e08a8800ce9d4b5b4c11dc2d67761c09248e410af8e419709fa`
- Result digest: `5dff60aa47bd0aec8540a020294d1727b190d08576e5aa9d30168a955f5bd7d1`
- Seam report: `seams-42d1b821e43eb7ea13eb6a33`
- Historical cycles inspected before creation: 11
- Preserved training runs after creation: 12
- Historically assigned source groups: 13
- Training tokens: 6,826
- Approved training episodes: 8
- Validation-only candidates: 20
- Behavior canaries: 6/6 pass
- Frozen baseline local-regression perplexity: 208.7821933251885
- Challenger local-regression perplexity: 105.45302550887615
- Relative reduction: 49.49137001131706%
- Exact second execution: REUSED
- Promotion: `HOLD_REPAIR`
- Remaining seam: `training-corpus-small`
- Runtime pointer changes: 0

The model metric is intentionally unchanged from the preceding cycle. This
work improves the identity and verification of the preserved result, not the
learned weights or the breadth of their evidence.

## Foundation revalidation

The changed public learning source, Seam Cell, contract, tests, and policy
correctly produced an intermediate Foundation snapshot with one direct
Workshop-transfer regression. Nothing repaired or averaged it away. A fresh
exact-hand-bound read-only exam then preserved 49/49 contract boundaries and
38/38 routes with zero authority seams, zero Workshop JavaScript executions,
and zero repairs selected.

The settled Foundation state is:

- subject digest: `0159ea2523be5c5c3d0d688e99e92968f7e22a6e57f0f4ff9051716d8d374f39`;
- 465 public source files, 3,385,526 bytes, and 14 roots;
- 267 JavaScript files syntax-checked and 194 JSON files parsed;
- 127 contract schemas checked;
- 39/39 active organs have static test reachability;
- Workshop exam: `workshop-transfer-regression-exam-252c4d582775d05d716a2207`;
- settled snapshot: `foundation-development-73c68c730760ef515bd6d982`;
- nine observed passing dimensions, two external evidence holds, and zero
  direct or longitudinal regressions;
- no composite intelligence score and no growth grade.

## Verification

- Focused language-cycle, native-language, and Seam tests: 24/24 pass.
- Full repository: 280/280 pass with `npm.cmd test`.
- Mirror Doctor: PASS.
- Exact real cycle rerun: REUSED.
- Active runtime PID remained 496; it was not restarted and learned runtime
  weights remain disabled.

PowerShell refused the `npm.ps1` wrapper under the host execution policy. The
installed `npm.cmd` entry point ran the same dependency-free repository test
script; no system policy was changed.

## Known limits

- A local content seal detects ordinary mutation and ambiguous duplicate
  outcomes. It cannot prevent an actor from deleting or consistently rewriting
  all local history without an external anchor.
- Legacy cycles remain useful input-lineage evidence but lack the new full-result
  seal.
- The validation and local-regression groups remain repeatedly observed local
  evidence, not an outside-authored independent exam.
- The corpus remains below the 50,000-token broad-language evidence gate.
- No learned language weights entered the active runtime.
- Only Mike may accept CANON.

## Claim ceiling

`NEW_LANGUAGE_CYCLE_RESULTS_CONTENT_BOUND_LOCAL_INTEGRITY_ONLY`

This is TEST evidence for local result identity, Seam binding, and deterministic
reuse. It is not proof of broad language generalization, independent
validation, runtime readiness, intelligence, safety, consciousness, or CANON.
