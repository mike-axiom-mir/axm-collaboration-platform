# Mirror cognitive-work metrology action report — 2026-07-19

Status: **TEST**. Mike has not accepted this as CANON.

## Outcome

Mirror now has a deterministic, dependency-free cognitive-work metrology cell
and a private append-only stewardship organ. They can seal machine-only work
observations, refuse malformed or forged claims, group only exact comparable
work, and produce bounded descriptive resource profiles. They do not forecast,
optimize cost, choose a model or hardware, allocate a budget, grant permission,
admit training data, promote runtime or canon, or act in the world.

The accompanying Workshop prompt specifies the producer-side module and modular
Hands needed for future receipt capture, hardware/cost lineage, pre-outcome
prediction sealing, held-out calibration, and archival continuity.

## Why this is a separate organ

Token totals are provider-defined accounting units, not universal compute.
Elapsed time also changes with the model, tools, environment, hardware,
caching, pre-existing implementation, and verification burden. A reusable
organ is warranted because those relations need a stable machine contract and
repeatable falsification rather than a new informal calculation in every chat.

Producer and examiner remain separate:

- the Workshop module may measure and export a draft;
- Mirror independently normalizes, seals, verifies, stores, and profiles it;
- neither side may certify its own efficiency or turn a receipt into authority.

## Implemented machine boundary

`kernel/cognitive-work-metrology-cell.js` defines:

- `axm.mirror.cognitive-work-observation-draft/v1`;
- `axm.mirror.cognitive-work-observation/v1`;
- `axm.mirror.cognitive-resource-profile/v1`;
- exact object fields and bounded machine identifiers/tokens;
- key-safe deterministic JSON normalization and digesting;
- source, meter, objective, start/end state, model, toolchain, environment,
  hardware, work-shape, pre-existing-state, timing, verification, outcome,
  cost, and permission lineage;
- provider-defined CPU core-time, accelerator time, peak memory, or compute-unit
  observations with exact compute-meter lineage and no universal FLOP inference;
- explicit eligibility issues for incomplete evidence;
- exact cohort keys that include meter-definition content, model, tools,
  environment, hardware, work shape, and pre-existing implementation state;
- minimum five eligible observations and three distinct starting states before
  a descriptive profile leaves the insufficient-observation hold;
- preserved complete, partial, failed, and held outcome counts;
- minimum, median, and maximum token/time descriptions;
- measured/billed cost separation from profile-estimated and unknown cost;
- exact cost-profile and currency coherence before money, energy, or carbon
  observations are aggregated;
- null calibration coverage and accuracy claims in v1.

Observation verification reconstructs the sealed result from its typed draft.
Changing an assessment or authority and recomputing the outer digest therefore
does not make the forgery valid.

## Private stewardship surface

`organs/cognitive-resource-stewardship-organ.js` provides explicit intake and
profiling under ignored `state/` roots. It uses immutable content-addressed
directories, atomic bounded commit, identical-winner reuse, divergent collision
refusal, strict directory inventory, real-file checks, and full source receipt
verification.

Commands:

```text
npm run record:cognitive-work -- <draft.json>
npm run profile:cognitive-work -- <comparison-key>
```

There is no runtime route and no automatic capture. Intake is permitted by the
explicit bounded training-policy field
`cognitiveWorkObservationIntakeEnabled`; the observations and profiles remain
evaluation evidence and never enter training.

## The reported Workshop run

The reported `328,993 tokens / 1,226 seconds` run is useful evidence that a
receipt source should exist, but it was not ingested as an operational Mirror
observation. The supplied summary does not bind the original source record,
meter-definition content, starting and ending states, model profile,
toolchain, environment, hardware, compute meter, verification digest, cost profile, and
permission receipt required for resource-profile eligibility.

An adversarial test represents that shape as an imported incomplete
attestation. Mirror preserves it as a hold with exact missing reasons, gives it
zero eligible observations, and emits no token range or forecast claim. This
prevents one unusually productive run from becoming a false general law.

## Tests and falsification

Focused metrology suite: **10/10 pass**.

Full repository suite through `npm.cmd test`: **222/222 pass**.

Covered behavior includes:

- deterministic order normalization and post-seal mutation detachment;
- reconstruction refusal of a forged, self-digested eligibility assessment;
- incomplete imported 328,993-token example held outside profiling;
- minimum cohort and distinct-start thresholds;
- failures and holds preserved in descriptive outcomes;
- mismatched pre-existing state, meter definition, environment, and hardware
  excluded from the exact cohort;
- unknown compute coverage cannot carry inferred compute values, and compute
  descriptions stay bound to their provider meter definition;
- profile-estimated costs excluded from direct cost;
- different measured/billed cost profiles held rather than merged;
- policy-disabled intake refusal, append-only reuse, disk tamper refusal, and
  unexpected visible state entry refusal;
- strict contracts, package commands, BOM/policy/doctor declarations, and
  absence from the active runtime.

The first attempted `npm test` did not start tests because the host PowerShell
policy refused `npm.ps1`. The equivalent package script was then run through
`npm.cmd test` and passed 222/222. This was an invocation-environment refusal,
not a test failure.

`node scripts/mirror-doctor.js` passed structure checks. `git diff --check`
reported only existing Windows LF-to-CRLF conversion warnings and no whitespace
errors.

## Files changed for this organ

New:

- `kernel/cognitive-work-metrology-cell.js`
- `organs/cognitive-resource-stewardship-organ.js`
- `contracts/cognitive-work-observation-draft.schema.json`
- `contracts/cognitive-work-observation.schema.json`
- `contracts/cognitive-resource-profile.schema.json`
- `scripts/record-cognitive-work-observation.js`
- `scripts/profile-cognitive-work-observations.js`
- `tests/cognitive-work-metrology.test.js`
- `docs/WORKSHOP_COGNITIVE_WORK_LEDGER_MODULE_PROMPT_2026-07-19.md`
- this report and its public audit.

Updated:

- `training/TRAINING_POLICY.json`
- `package.json`
- `scripts/mirror-doctor.js`
- `organs/foundation-development-observatory-organ.js`
- `MODEL_BOM.json`
- `README.md`
- `STATUS.json`

No Git stage, commit, branch, push, or pull request was created. The active
runtime was not restarted or promoted.

## Known limits and next evidence

- V1 describes comparable observations; it does not implement or claim a
  calibrated forecast.
- An “80%” claim requires independently sealed predictions made before held-out
  outcomes, a declared coverage method, adequate sample size, miss retention,
  and drift checks. None exist yet.
- No real provider token or compute meter, hardware energy meter, billing
  source, carbon profile, or Workshop producer module has been connected to Mirror.
- No real cognitive-work observation was written to private state during this
  implementation; tests used isolated temporary directories.
- Money, energy, carbon, time, human attention, verification, privacy, and risk
  must remain a vector. V1 stores only the receipt fields currently contracted;
  it has no composite cost score.
- Exact model/tool/environment/hardware cohorts may remain sparse. A future
  relaxation requires independent evidence and a new version, not silent
  grouping.
- The Foundation observatory can record that these source files now exist, but
  that is source continuity, not evidence that cost estimation works in the
  real world.

## Strongest claim ceiling

`TEST_MACHINE_BOUND_COGNITIVE_WORK_OBSERVATION_AND_EXACT_COHORT_DESCRIPTIVE_RESOURCE_PROFILE_NO_CALIBRATED_FORECAST_OR_SELECTION_AUTHORITY`
