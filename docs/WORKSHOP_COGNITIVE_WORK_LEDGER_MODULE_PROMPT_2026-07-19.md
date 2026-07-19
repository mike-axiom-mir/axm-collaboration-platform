# Paste-ready Workshop prompt: Cognitive Work Ledger and Resource Stewardship

```text
/goal Inspect the current AXM Workshop first, then extend the correct existing
module if this capability already exists; do not create a duplicate because of
name differences. If no exact owner exists, build a reusable local-first module
named Cognitive Work Ledger & Resource Stewardship under the most appropriate
AI Team / observability parent and wire it through the Workshop's normal
manifest, contract, provider-declaration, Hands, Technical Glasses, verification,
rollback, documentation, and inventory routes.

PURPOSE

Create the machine-grounded producer side of cognitive-work metrology. It must
capture what a bounded AI work run consumed and what verified state transition
it produced, so later evidence can relate task shape, tokens, time, compute,
hardware, money, energy, carbon, and human-attention costs without pretending
that tokens are universal compute, that cost is intelligence, or that one fast
or impressive run predicts the future.

This module produces evidence. It does not choose the cheapest model, fastest
model, hardware, budget, permission, training data, release, canon, or action.
Optimization must remain a later separately permissioned decision whose first
constraint is satisfying the task's evidence, safety, values, privacy, and
verification needs.

SEARCH AND ROUTING FIRST

1. Inventory existing modules, shared services, provider declarations, Hands,
   and tests for telemetry, token accounting, cost, hardware profiles, energy,
   carbon, run receipts, benchmarks, predictions, or calibration.
2. If an exact capability exists, extend it through its declared contract.
3. If capabilities are split, compose them with typed Hands; do not copy their
   implementation into this module.
4. Record every reused provider and every genuinely missing provider relation.
   A selector, filename, name resemblance, or consumer demand is not provider
   identity.

MACHINE RECEIPT CONTRACT

Export an exact JSON object compatible with:

  axm.mirror.cognitive-work-observation-draft/v1

Required top-level fields, with no extra fields:

  schema
  source
  objective
  workShape
  execution
  outcome
  costObservation
  permission

Match the authoritative Mirror contract
`contracts/cognitive-work-observation-draft.schema.json` by copied schema digest
or a declared versioned provider binding, never by an absolute Mirror path.
Expose a typed output kind such as COGNITIVE_WORK_OBSERVATION_DRAFT and declare
the exact compatibility relation.

The receipt must bind, using machine identifiers and content digests rather
than free prose:

- source system, source record, source-record digest, collection method,
  authorship state, and measurement-definition digest;
- objective kind and objective digest;
- privacy-safe starting-state and ending-state digests;
- operation kinds, domain kinds, requested output kinds, risk tier, and
  required verification kinds;
- pre-existing implementation state: NONE, PARTIAL, SUBSTANTIAL, or UNKNOWN;
- model-profile, toolchain, environment, and hardware-profile digests;
- the provider's exact token-meter definition ID and COMPLETE, PARTIAL, or
  UNKNOWN coverage;
- input, cached-input, output, reasoning, and total tokens only when that meter
  actually exposes them; do not infer a provider-independent sum;
- the compute-meter definition ID and COMPLETE, PARTIAL, or UNKNOWN coverage;
- CPU core-milliseconds, accelerator-milliseconds, peak memory bytes, and
  provider compute units in micros only when directly exposed by that exact
  meter definition; provider units are not silently relabelled as FLOPs;
- wall and tool time;
- files examined/changed, lines added/removed, and tool calls when observable;
- tests executed/passed/failed/not run and a verification digest;
- VERIFIED_COMPLETE, VERIFIED_PARTIAL, KNOWN_FAIL, or HOLD outcome;
- EXPERIMENTAL, TEST, WORKING, KNOWN_FAIL, or NEEDS_REVIEW status;
- cost basis MEASURED, BILLED, PROFILE_ESTIMATED, or UNKNOWN;
- bound cost-profile digest, currency, money micros, energy mWh, and carbon mg
  only where supported by that basis;
- explicit intake-permission status and permission-basis digest.

Do not store prompts, responses, conversation prose, hidden reasoning,
scratchpads, secrets, tokens/keys, private memories, usernames, device serials,
MAC addresses, or content snapshots in the receipt. State snapshots may be
privacy-safe inventories/digests; their private source data stays outside
commits and exports.

EVIDENCE CLASSES AND HOLDS

- DIRECT_MACHINE_METER is distinct from IMPORTED_ATTESTATION and
  MANUAL_DECLARATION.
- Incomplete observations are valid append-only evidence but must carry exact
  missing-field reasons and remain ineligible for predictive profiling.
- UNKNOWN cost carries no inferred values.
- PROFILE_ESTIMATED cost never becomes MEASURED or BILLED through wording.
- Preserve failed, partial, cancelled, held, and pre-existing-work runs. Never
  build a success-only ledger or silently erase superseded receipts.
- Treat the reported `328993 tokens / 1226 seconds` Workshop run as a useful
  imported incomplete example only unless its original source record, meter
  definition, start/end state, model, toolchain, environment, hardware,
  verification, permission, and cost lineage can actually be bound. It must not
  seed a forecast by itself.

APPEND-ONLY STORAGE AND HANDS

Use content-addressed immutable private runtime storage with deterministic
serialization, atomic commit, identical-winner reuse, divergent-collision
refusal, source seals, and explicit archive lineage. Keep it ignored by Git.

Build or connect modular Hands for:

1. explicit run-receipt capture;
2. provider-specific token/timing telemetry adaptation;
3. privacy-safe model/tool/environment/hardware profile sealing;
4. billed/measured/estimated cost-profile binding with version/effective-period
   lineage and no silent price refresh;
5. exact Mirror-draft export;
6. separately sealed pre-outcome resource-prediction receipts for future
   calibration;
7. held-out prediction/outcome matching and calibration evidence;
8. append-only hot-digest/cold-detail archive or compaction, preserving full
   recovery and lineage.

Hands must be reusable typed interfaces, not direct cross-module file imports.
Provider-specific adapters must remain replaceable. Missing telemetry must hold
rather than fabricate values.

DESCRIPTION, PREDICTION, AND CALIBRATION ARE SEPARATE

- Group observations only when objective kind, pre-existing implementation
  state, work shape, meter-definition digest/ID, model profile, toolchain,
  environment, and hardware profile are exactly comparable.
- Preserve distinct starting-state digests within the cohort.
- Minimum, median, maximum, percentiles, trends, or dashboards are descriptive
  statistics, not a future guarantee or an “80% accurate” claim.
- A future interval must be sealed before its held-out outcome, bind its target
  coverage and cohort/profile version, and remain immutable afterward.
- Report empirical held-out coverage, sample size, misses, drift, and the exact
  calibration method. Do not claim 80% until independent pre-outcome held-out
  evidence earns it.
- Calibration failure must remain visible and must not lower the target,
  discard outliers, change cohorts after seeing outcomes, or rewrite history.
- Do not collapse money, energy, carbon, elapsed time, human attention,
  verification cost, privacy, or risk into one composite score. Keep a cost
  vector with explicit unknowns and separately declared decision weights.

TESTS AND ADVERSARIAL EXAMS

Add deterministic tests for at least:

- order invariance and mutation detachment;
- exact schema and extra-field refusal;
- one sample, fewer than five samples, and fewer than three starting states;
- incomplete, imported, manual, unknown-permission, and forbidden receipts;
- model, toolchain, environment, hardware, meter definition, work-shape, risk,
  and pre-existing-state cohort mismatches;
- failures/holds remaining counted and success-only filtering being refused;
- PROFILE_ESTIMATED cost excluded from directly observed cost;
- currency mismatch, price-profile drift, stale profiles, and missing energy or
  carbon data;
- token components whose provider definition does not equal a naive sum;
- post-outcome prediction forgery, prediction mutation, calibration cherry
  picking, outlier removal, and target-coverage relabeling;
- hidden reasoning, prompt/response text, secret, identity, path traversal,
  symlink, oversized input, accessor/proxy, prototype-pollution, tamper, and
  divergent content-address collisions;
- concurrent identical append, archive recovery, and source-lineage checks;
- no automatic model/hardware/budget/permission/training/release/canon/action;
- zero required third-party installs and no outside-network dependency.

DELIVERY STANDARD

- Follow Workshop roots: truth before story, agency/non-domination, continuity
  and lineage, wisdom over speed, and no fake done.
- Keep status TEST until Mike explicitly accepts CANON.
- Do not modify the Mirror repository from this Workshop task.
- Run the focused tests, Workshop full tests, inventory/doctor/Technical Glasses,
  and any declared module self-test. Preserve failures with reasons.
- Report exact changed files, reused providers, new Hands, tests run and not run,
  source/contract digests, known limits, rollback path, private-state exclusions,
  and any missing provider relations.
- End with a paste-ready Mirror handoff containing the module ID, contract path
  and digest, provider-declaration path and digest, output kind, hand IDs, test
  evidence, and the explicit strongest claim ceiling.

STRONGEST CLAIM CEILING

At completion this module may claim only:

TEST_MACHINE_BOUND_COGNITIVE_WORK_RECEIPT_AND_RESOURCE_METROLOGY_PRODUCER

It may not claim calibrated forecasting until enough independently sealed
pre-outcome held-out predictions have been evaluated, and it may never claim
intelligence measurement, universal token-to-compute conversion, cheapest-path
authority, or automatic selection authority.
```
