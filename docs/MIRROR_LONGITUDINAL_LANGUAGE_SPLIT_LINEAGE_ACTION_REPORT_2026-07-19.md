# Mirror Longitudinal Language Split Lineage — Action Report

Date: 2026-07-19  
Status: TEST  
Canon acceptance: not requested and not granted

## Outcome

Mirror's automatic private language cycles can no longer silently move a source
group between training, validation, and local-regression roles as the corpus
grows. The first role observed for every group is preserved across later
automatic cycles. New groups enter training only. Creating a fresh evaluation
generation requires a separate explicit evidence route.

This closes a latent future leak; it does not make the repeatedly inspected
local validation or regression partitions independent.

## Seam found

The earlier deterministic splitter recalculated all roles from the complete
current group set. Adding one new document could therefore change the relative
hash ordering and move an old validation or test group into training. No such
move had occurred in preserved operational history, but the mechanism allowed
one in a future cycle.

The first focused implementation run preserved three visible development
failures: the lineage was written to the corpus snapshot but omitted from the
cycle's public corpus view, and historical reconstruction changed array order,
which changed an otherwise identical cycle ID. Both causes were repaired and
the focused suite then passed 19/19.

## What changed

- Added `contracts/language-evaluation-split-lineage.schema.json`.
- Extended the learning-cycle contract with a required split-lineage record.
- Content-verifies every visible historical cycle directory, cycle ID, input
  digest, artifact path, byte count, and SHA-256 before trusting its roles.
- Refuses partial cycles, symlinks, unexpected visible run entries, artifact
  mutation, split overlap, historical role conflict, and absent historical
  validation or test groups.
- Preserves the original deterministic group order so an identical cycle is
  exactly reused rather than rewritten under a new identity.
- Added a sixth behavior canary for longitudinal evaluation-role isolation.
- Strengthened the Seam Cell: missing lineage or any evaluation-role move is a
  critical hold.
- Updated public policy, README, status, and model BOM truth boundaries.

## Exact evidence

- Current private cycle: `cycle-cb788d57fdd5a14b47b5`
- Input digest: `cb788d57fdd5a14b47b5cc773d3247feb2ca9a1f3153fa763e5fdfe34047393f`
- Historical cycles inspected before the new cycle: 10
- Historically assigned groups in the current corpus: 13
- Historical role conflicts: 0
- Evaluation groups moved to training: 0
- Training groups moved to evaluation: 0
- Newly observed groups in this cycle: 0
- Behavior canaries: 6/6 pass
- Exact second execution: REUSED
- Promotion state: `HOLD_REPAIR`
- Remaining seam: `training-corpus-small` at 6,826 tokens
- Runtime pointer changes: 0

The model metrics are intentionally unchanged: validation-only selection still
chooses `hierarchical-context-o3-a1`; local-regression perplexity remains
105.4530 versus the frozen baseline 208.7822. Split integrity changes the
trustworthiness of future evaluation lineage, not the learned weights or their
measured result.

## Foundation revalidation

Changing public learning and policy source correctly invalidated the prior
Foundation subject. The first observation exposed one Workshop-transfer
regression because the old exam did not bind the new body. A fresh bounded,
read-only exam then preserved 49/49 typed contract boundaries and 38/38 exact
routes with zero authority seams and zero Workshop JavaScript executions.

The settled current Foundation state is:

- public subject: 465 files, 3,376,622 bytes, 14 roots;
- body integrity: 267 JavaScript and 194 JSON files parsed;
- active-organ static test reachability: 39/39;
- snapshot: `foundation-development-7a8f0d288345f8a077a9f63e`;
- nine observed passing dimensions;
- two open evidence gates;
- zero direct or longitudinal regressions;
- no composite intelligence score or growth grade.

## Verification

- Focused language-cycle, native-language, and Seam tests: 19/19 pass.
- Full repository: 275/275 pass with `npm.cmd test`.
- Mirror Doctor: PASS.
- Runtime PID remained 496; learned runtime weights remain disabled.

PowerShell refused the `npm.ps1` wrapper under the host execution policy. The
installed `npm.cmd` entry point ran the identical repository test script and
passed; no system policy was changed.

## Known limits

- The local validation and regression groups were authored and observed inside
  Mirror's development process; immutable roles do not certify independence.
- New groups entering training only prevents automatic leakage but cannot
  generate a new external exam.
- A separate route is still required to accept a permissioned, content-sealed,
  outside-authored full language exam.
- The training corpus remains below the 50,000-token broad-language evidence
  gate.
- The active runtime still loads no learned language weights.
- Only Mike may accept CANON.

## Claim ceiling

`AUTOMATIC_LONGITUDINAL_EVALUATION_ROLE_MIGRATION_REFUSED`

This is TEST evidence for evaluation lineage integrity, not broad language
generalization, independent validation, runtime readiness, intelligence,
safety, consciousness, or CANON.
