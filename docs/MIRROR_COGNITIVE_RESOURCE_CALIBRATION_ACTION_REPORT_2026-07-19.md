# Mirror Cognitive Resource Calibration Action Report — 2026-07-19

Status: TEST

Claim ceiling:

`TEST_LOCAL_PRE_OUTCOME_RESOURCE_INTERVAL_SEAL_AND_ALL_COHORT_EMPIRICAL_COVERAGE_EXTERNAL_TIME_AND_INDEPENDENCE_UNCERTIFIED_NO_CALIBRATED_FORECAST_OR_SELECTION_AUTHORITY`

## Why this organ exists

The cognitive-work metrology organ can describe completed exact-cohort work,
but a description made after seeing outcomes cannot test whether Mirror's
resource expectations are trustworthy. This separate organ freezes bounded
expectations before an exact matching outcome exists in Mirror's local
observation inventory, then later counts every eligible hit and miss.

The separation is intentional: outcome measurement cannot silently rewrite a
prediction, and a prediction cannot rewrite the observation ledger.

## Machine ground added

- A strict prediction-draft contract binds source identity, digest-linked
  per-source sequence, objective, starting state, comparison key, method and
  method digest, supporting descriptive profile, target coverage, permission,
  and resource intervals.
- Total tokens and wall time are mandatory. CPU core-time, accelerator time,
  peak memory, and provider-defined compute units may be predicted only as
  separate meter-bound dimensions. They are never relabeled universal FLOPs.
- Money, energy, or carbon intervals require an exact cost-profile binding;
  money also requires one currency.
- The sealed prediction stores the complete content-digested observation
  inventory visible before sealing. An exact target already present is refused.
- Historical resource profiles are verified from their sealed source snapshot,
  so later append-only observations do not invalidate an honest earlier profile.
- Private stewardship uses immutable content-addressed directories and refuses
  divergent target duplicates, broken source chains, tampered files, symlinks,
  and unexpected visible entries. Exact replay reuses the existing record.
- A report includes every prediction under one exact calibration key. It keeps
  evaluated hits and misses, pending outcomes, ambiguous matches, missing
  metrics, ineligible outcomes, and cost-binding mismatches visible.

## Evidence threshold and boundary

Twenty evaluated predictions across at least five distinct starting states are
required before the report may say empirical local-order coverage was observed.
Smaller sets remain `HOLD_INSUFFICIENT_EVALUATED_PREDICTIONS`.

The threshold does not create a calibration claim. Mirror's local append order
does not independently certify external time, outside authorship, task closure,
or distribution independence. Therefore `calibrationClaim` and `accuracyClaim`
remain `null` even when an observed coverage number exists.

The synthetic discrimination exam sealed 21 predictions, evaluated 20 across
five starting states, preserved one pending prediction, and counted 16 overall
hits plus four misses as 8000 basis points. This is test-fixture evidence only;
it is not a real 80% performance claim.

## Authority preserved closed

Neither prediction nor report can optimize cost, select a model or hardware,
allocate a budget, grant permission, admit training data, promote runtime or
canon, or act in the world. No runtime route imports this organ.

## Files changed

New implementation, contracts, commands, tests, and audit material:

- `kernel/cognitive-resource-calibration-cell.js`
- `organs/cognitive-resource-calibration-stewardship-organ.js`
- `contracts/cognitive-resource-prediction-draft.schema.json`
- `contracts/cognitive-resource-prediction.schema.json`
- `contracts/cognitive-resource-calibration-report.schema.json`
- `scripts/seal-cognitive-resource-prediction.js`
- `scripts/evaluate-cognitive-resource-calibration.js`
- `tests/cognitive-resource-calibration.test.js`
- `docs/MIRROR_COGNITIVE_RESOURCE_CALIBRATION_ACTION_REPORT_2026-07-19.md`
- `exports/action-reports/MIRROR_COGNITIVE_RESOURCE_CALIBRATION_AUDIT_2026-07-19.json`

Integrated declarations and diagnostics:

- `organs/cognitive-resource-stewardship-organ.js`
- `training/TRAINING_POLICY.json`
- `package.json`
- `scripts/mirror-doctor.js`
- `README.md`
- `MODEL_BOM.json`
- `STATUS.json`

## Verification

- Focused cognitive metrology and calibration tests: 17 passed, 0 failed.
- Calibration-specific tests: 7 passed, 0 failed.
- Full repository suite: 229 passed, 0 failed.
- Mirror structure doctor: PASS.

No real observation, profile, prediction, or calibration report was written by
this work; tests used disposable temporary directories. The active runtime was
not restarted. No Git stage, commit, branch, push, or pull request action was
taken.

## Known limits

- Local append order is not an external timestamp or independent authorship
  certificate.
- Pending outcomes are excluded from the numerical denominator but remain
  visible; v1 has no independently certified task-closure horizon.
- The organ evaluates declared intervals; it does not yet learn or choose an
  interval-generation method.
- Exact cohorts intentionally do not generalize across model, toolchain,
  environment, hardware, meter definition, work shape, cost profile, or
  currency.
- Twenty synthetic examples prove only that the instrument counts correctly.
  Zero real prediction outcomes have been evaluated.

Only Mike may accept CANON.
