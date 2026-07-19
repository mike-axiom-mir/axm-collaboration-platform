# Mirror cognitive-resource economics action report — 2026-07-19

Status: **TEST**. Mike has not accepted this as CANON.

## Outcome

Mirror now has a deterministic resource-economics cell and a private
content-addressed stewardship organ. They can seal one versioned linear rate
profile and derive separate money, energy, and carbon intervals from either an
exact sealed cognitive-work observation or a sealed pre-outcome resource
prediction.

This closes the narrow bridge from observed or predicted resource quantities
to inspectable cost evidence. It does not turn tokens into universal compute,
certify prices, implement nonlinear billing, claim measured or billed cost,
calibrate cost accuracy, rank candidates, optimize, choose a model or hardware,
allocate a budget, train, promote, or act.

No real economics profile or cost estimate was written. Tests used isolated
temporary state and synthetic fixtures.

## Machine boundary

`kernel/cognitive-resource-economics-cell.js` defines:

- `axm.mirror.cognitive-resource-economics-profile-draft/v1`;
- `axm.mirror.cognitive-resource-economics-profile/v1`;
- `axm.mirror.cognitive-resource-cost-estimate/v1`;
- three separate accounting modes: provider token billing, provider compute
  units, and local hardware time;
- exact source-record, rate-schedule, freshness, permission, currency,
  model/hardware, and meter-definition bindings;
- non-overlapping rate components for money micros, energy mWh, and carbon mg;
- refusal to combine total-token rates with token-component rates;
- refusal of cross-mode metrics, duplicate components, unsafe integers,
  malformed objects, and money rates without currency;
- explicit holds for incomplete profiles, permission, meter coverage,
  unavailable prediction metrics, and model/hardware/meter mismatches;
- BigInt-backed safe-integer floor/ceiling interval propagation so fractional
  rate products remain visibly bounded rather than rounded into false precision;
- inherited resource target coverage as lineage only, while cost coverage and
  accuracy claims remain null;
- reconstruction verification that defeats outer-digest forgery;
- zero direct-cost admission, optimization, ranking, selection, budget,
  permission, training, runtime, canon, or world authority.

The three accounting modes are not combined because they may describe
overlapping economic views. A provider token bill is not hardware compute; a
provider compute unit is not a FLOP; local CPU/GPU time is not a provider token
tariff. Comparisons can be made later only after the task/evidence requirements
and exact accounting basis are held constant.

## Private stewardship and commands

`organs/cognitive-resource-economics-stewardship-organ.js` stores profiles and
estimates beneath ignored private state with deterministic serialization,
bounded atomic commit, identical content-addressed reuse, divergent-collision
refusal, strict directory inventory, source/profile reconstruction, real-file
checks, symlink refusal, and tamper detection.

Commands:

```text
npm run seal:cognitive-resource-economics-profile -- <profile-draft.json>
npm run estimate:cognitive-resource-cost -- <observation|prediction> <source-id> <economics-profile-id>
```

The organ is explicitly enabled by a bounded training-policy field, but its
records are evaluation evidence only and never enter training. It has no active
runtime route. The active runtime was not restarted.

## Workshop handoff

`docs/WORKSHOP_COGNITIVE_RESOURCE_ECONOMICS_MODULE_PROMPT_2026-07-19.md`
contains the producer-side prompt. It tells the Workshop to reuse the current
Cognitive Work Ledger owner where possible and build modular Hands for exact
run receipts, provider token/compute telemetry, privacy-safe model/hardware
profiles, versioned billing or hardware-rate schedules, exact Mirror draft
exports, and append-only archival continuity.

The Workshop producer may emit evidence. Mirror independently seals and derives
the interval. Neither side certifies its own efficiency or receives selection
authority.

## Tests and falsification

Focused economics suite: **10/10 pass**.

Combined cognitive metrology, calibration, economics, and model-boundary
suite: **29/29 pass**.

Full repository suite: **261/261 pass**.

The tests cover deterministic normalization, mutation detachment, strict
schemas, extra-field refusal, direct and declared source classes,
historical/unknown freshness, permission holds, exact token/model bindings,
hardware/meter mismatches, partial meters, total-plus-component double-count
refusal, cross-mode metric refusal, separate money/energy/carbon totals,
safe fractional rounding intervals, pre-outcome resource intervals, 80% target
lineage without cost-accuracy relabelling, unavailable prediction components,
self-digested forgery, append-only reuse, disk tampering, commands, policy,
BOM/status declarations, runtime exclusion, and Foundation static reachability.

Mirror Doctor passes with a bounded public inventory of 458 files across 14
roots. Public-body integrity parses 262 JavaScript and 192 JSON files, checks
125 contract schemas, and finds static test reachability for all 38 active
organs with zero structural holds and zero source executions.

The final public subject is content-bound by inventory digest
`486fddcb3d048488bb23c1978bf545974da2bf695c97624bed89bfc864b9bff6`
and body-integrity digest
`6ba50e8440c13a36a6f11131be4d7b08672aa67b40bfc05352f27529fd7d7f3a`.
Foundation initially exposed the expected stale Workshop-transfer exam after
the public subject changed. A fresh exact-hand-bound read-only revalidation
then passed 11/11 checks over 49 eligible contracts and 38 exact routes with
zero authority seams. The settled snapshot
`foundation-development-8df9f8de20325324bf50f940` records nine passing
dimensions, two open evidence gates, and zero direct or longitudinal
regressions. The intermediate regression snapshot remains preserved.

`git diff --check` reports no whitespace errors; Windows line-ending warnings
remain informational. No Git stage, commit, branch, push, or pull request was
created.

## Files changed for this organ

New:

- `kernel/cognitive-resource-economics-cell.js`
- `organs/cognitive-resource-economics-stewardship-organ.js`
- `contracts/cognitive-resource-economics-profile-draft.schema.json`
- `contracts/cognitive-resource-economics-profile.schema.json`
- `contracts/cognitive-resource-cost-estimate.schema.json`
- `scripts/seal-cognitive-resource-economics-profile.js`
- `scripts/estimate-cognitive-resource-cost.js`
- `tests/cognitive-resource-economics.test.js`
- `docs/WORKSHOP_COGNITIVE_RESOURCE_ECONOMICS_MODULE_PROMPT_2026-07-19.md`
- this report and its public audit.

Updated:

- `training/TRAINING_POLICY.json`
- `package.json`
- `scripts/mirror-doctor.js`
- `MODEL_BOM.json`
- `README.md`
- `STATUS.json`
- `tests/model-bom.test.js`

## Known limits

- The accounting profile is linear. It does not model tiers, minimum charges,
  reservations, taxes, credits, concurrency, idle power, utilization,
  depreciation, or time-varying grid intensity.
- Freshness and authorship are declared, not externally certified. There is no
  automatic network price refresh.
- Provider token components may not equal total tokens; each profile must use
  the exact provider meter definition and choose total or components.
- Pre-outcome prediction v1 contains total tokens but not input/output token
  component intervals. Component-tariff prediction therefore holds until those
  quantities are independently predicted in a future contract version.
- The exact linear transformation can be correct while its rate profile is
  stale or inaccurate. Accordingly cost coverage and accuracy remain null.
- “Better solution” selection is deliberately not implemented. A future
  decision organ must first hold task quality, evidence, safety, privacy,
  reversibility, and permission constant, preserve the full cost vector and
  unknowns, and earn its own independent comparison evidence.

## Strongest claim ceiling

`TEST_EXACT_PROFILE_BOUND_LINEAR_RESOURCE_COST_INTERVALS_PRICE_FRESHNESS_NONLINEAR_BILLING_AND_ACCURACY_UNCERTIFIED_NO_COST_OPTIMIZATION_OR_SELECTION_AUTHORITY`
