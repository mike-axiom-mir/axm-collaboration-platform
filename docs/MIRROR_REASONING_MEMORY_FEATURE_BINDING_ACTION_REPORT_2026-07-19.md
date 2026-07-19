# Mirror Reasoning Memory Feature Binding Action Report - 2026-07-19

Status: TEST

Claim ceiling:

`TEST_PRIVATE_DATA_DERIVED_EXACT_CONTRAST_TESTED_STRUCTURAL_MEMORY_APPLICABILITY_BINDING_AND_GUIDANCE_V2_LOCAL_FROZEN_INSTRUMENT_PASS_REAL_LOCAL_EVALUATOR_DIVERSITY_AND_OUTSIDE_INDEPENDENCE_HOLD_NO_SEMANTIC_TRUTH_EVIDENCE_DECISION_PERMISSION_TRAINING_RUNTIME_CANON_TOOL_OR_WORLD_AUTHORITY`

## Gap found

Reasoning Memory Guidance v1 used a hardcoded table to map known strategy tags
to structural features. If none of those features were present, its query could
fall back to the tag alone. That made the vocabulary small and inspectable, but
it did not prove that a remembered strategy applied to the current machine
state. The v1 result and source seal remain preserved in the earlier action
report and public audit as a superseded `KNOWN_FAIL` seam.

## New organ

Reasoning Memory Feature Binding v1 derives applicability from data instead of
a per-strategy code table. For each requested strategy tag it:

- verifies and access-scopes every reasoning-experience receipt;
- applies the existing training-eligibility gate;
- separates non-synthetic tagged receipts, non-tagged contrast receipts, and
  synthetic tagged receipts;
- requires at least two tagged source groups and two tagged evaluators;
- requires at least two contrast source groups and two contrast evaluators;
- finds positive structural features present in every tagged receipt and no
  contrast receipt;
- excludes descriptor families and negative/absent feature values; and
- binds only when exactly one eligible feature remains.

No contrast, insufficient diversity, zero candidates, multiple candidates, or
synthetic-only evidence produces an explicit hold. Tag-only retrieval is always
false. A binding is an exact retrieval scope, not semantic meaning, causal
proof, truth, probability, outcome success, or a decision.

The current 66-receipt inventory assessed seven strategy tags. One met the
complete boundary:

`respect-explicit-prohibition -> candidate-prohibition:present`

Six remain held. In particular, `ask-blocking-unknown` remains held because its
two real-local receipts share one evaluator. The current immutable audit is:

- batch: `reasoning-memory-feature-bindings-cc1f13cd4113aa634055fd19`
- digest: `e0580127186bbfb2acb45770d75d645faea81843da2545e9442d2d5d69dbce3d`
- result: 1 exact binding, 6 visible holds, 0 tag-only retrievals

## Guidance v2 integration

Guidance v2 deletes the hardcoded mapping. It builds and verifies a feature
binding batch for the requested strategy tags. It calls Reasoning Memory Context
only when every tag on a path has an exact binding and the bound feature is
present in the current problem. The query always contains that feature; an
empty feature query is impossible. Unbound, ambiguous, under-diverse,
synthetic-only, and current-feature-mismatched paths receive zero adjustment.

Existing deterministic evidence, permission, prohibition, verification, and
eligibility gates remain prior. Even exactly bound memory can adjust only an
already eligible path by the existing maximum of `+12` or `-12`.

## Falsification evidence

The focused 21-test suite passed. It includes:

- an unseen strategy tag, absent from code, deriving
  `contradiction:present` from two tagged and two contrast groups/evaluators;
- tag recurrence with no contrast holding rather than retrieving by tag;
- two exclusive positive features holding as ambiguous;
- current-feature mismatch staying neutral;
- input-order invariance and duplicate receipt handling;
- empty strategy input returning a neutral batch;
- recomputed-digest authority and binding tampering refusal;
- contradiction, counterevidence, missing-permission, and self-training
  canaries; and
- the original frozen five-case guidance exam.

The frozen exam remains 5/5 with two locally authored contract-boundary
improvements and all three permission, access-scope, and input-order canaries.
Its new immutable result is:

- result: `reasoning-memory-guidance-exam-729a931fbe65f1fd3e36a671`
- digest: `711717cdc3a939971184d83d266d808c341da379033376df28fe624d675072b9`
- promotion: `HOLD_REAL_LOCAL_EVALUATOR_DIVERSITY_AND_OUTSIDE_INDEPENDENT_EXAM`

The result identity explicitly binds Guidance v2 and Feature Binding v1. The
pack's original Guidance v1 authorship remains visible, so a later organ version
cannot silently inherit this result.

The full repository gate passed 329/329 before the final documentation seal.

## Foundation observation

The post-build observatory discovered 493 bounded public files, parsed 285
JavaScript and 204 JSON files, and found static test reachability for all 45
active organs. Public-body structural integrity passed. Eight behavioral
dimensions remained observed passing and the two pre-existing evidence gates
remained open.

Snapshot `foundation-development-98e7998e0a4535920c6f3d5d` did not settle as
a passing longitudinal snapshot. The Workshop transfer source advanced to
`5f5cce640ec6e7bb428ac12d93f061b9834a8eb5cff959cb0c3cae1e88000ff9`,
which has no matching transfer regression exam. All 27 comparison records refer
to that single `DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH` dimension; they are
not 27 distinct failures in this organ. The hold was preserved.

## Files changed

- `organs/reasoning-memory-feature-binding-organ.js`
- `organs/reasoning-memory-guidance-organ.js`
- `organs/reasoning-memory-guidance-exam-organ.js`
- `organs/reasoning-memory-context-organ.js`
- `contracts/reasoning-memory-feature-binding-batch.schema.json`
- `contracts/reasoning-memory-guidance.schema.json`
- `scripts/run-reasoning-memory-feature-bindings.js`
- `tests/reasoning-memory-feature-binding-organ.test.js`
- `tests/reasoning-memory-guidance-organ.test.js`
- `package.json`, `training/TRAINING_POLICY.json`, `README.md`,
  `MODEL_BOM.json`, `STATUS.json`, and `scripts/mirror-doctor.js`
- this action report and its public audit

Immutable binding and exam traces were appended under `state/`; no earlier
result was replaced.

## Known limits

- One exact structural correlation is not learned language or semantic concept
  understanding.
- Exact contrast exclusion in the present inventory is not causal proof and
  can be invalidated by future evidence.
- The only current exact binding is supported by contract-derived examples,
  not real-world outcome success.
- The real-local blocking-unknown strategy still lacks evaluator diversity.
- The frozen pack is locally authored, not outside-independent.
- The `12`-point adjustment remains an instrument constant, not calibrated
  confidence or probability.
- The runtime server does not expose or activate reasoning memory.
- No Git action or runtime restart was performed.

Only Mike may accept CANON.
