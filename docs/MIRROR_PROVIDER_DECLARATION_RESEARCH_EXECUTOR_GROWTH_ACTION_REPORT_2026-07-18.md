# Mirror Provider Declaration Research Executor Growth Action Report

Status: TEST  
Date: 2026-07-18  
Acceptance: not CANON; only Mike may accept CANON

## Outcome

Mirror now has a small hardcoded organ pair for the next provider-declaration
research frontier:

- an attributed HUMAN review bridge that binds `APPROVE_DISPOSABLE_EXECUTOR`
  or `HOLD` to the exact immutable research-exam ID and digest;
- a review-bound builder that can generate only
  `DECLARATION_RELATION_FIXTURE_EXECUTOR_V1` under ignored private Mirror state;
- one common typed architecture-projection interface, so later architecture
  candidates can be compared without adding requirement-specific evaluator
  code;
- all ten case families from the earlier immutable exam, authored by the
  builder rather than by a future architecture candidate;
- an independent Reasoning Foundation path that rejects both review bypass and
  the false claim that passing the executor's own synthetic fixtures proves an
  architecture fits.

The organ is deliberately not a provider builder. It cannot select or evaluate
a real provider architecture, infer provider identity, write a provider or
declaration, touch Workshop, run live, install, grant permission, enter
training, claim availability or readiness, or promote itself.

## Review and admission boundary

The review bridge accepts an authenticated attributed `HUMAN` actor and the
current exam ID. Mirror supplies the current exam digest, reviewer identity
from the session, review time, recipe ID and digest, and a separately
recomputed admission assessment. An approval must exactly equal the fixed
executor specification:

- kind: `DECLARATION_RELATION_FIXTURE_EXECUTOR_V1`;
- input: `axm.mirror.provider-declaration-architecture-projection/v1`;
- root: `IGNORED_PRIVATE_STATE`;
- architecture selection: `NONE`;
- future candidate fixture authoring: `false`;
- live execution approval: `false`;
- case IDs: the exact ten IDs already frozen in the source exam.

`HOLD` requires `executor: null`. Unknown critical fields, nonhuman review,
digest drift, an exam not in the current batch, open-ended executor kinds, and
changed case families are refused.

Mike did not supply a specific executor review in this milestone. No approval
was attributed to him or inferred from the request to give Mirror a needed
organ.

## Disposable instrument

An admitted approval can produce exactly five deterministic files:

1. `executor.js` — the fixed relation evaluator;
2. `contract.json` — its authority and positive-state ceiling;
3. `candidate-projection.schema.json` — the common typed projection;
4. `fixture-manifest.json` — the ten pre-candidate cases and expected states;
5. `test.js` — a child-process fixture runner.

The evaluator checks the exact requirement and consumer bindings, provider
identity, selector coverage, unique provider count, declaration-to-provider
binding, implementation existence and content digest, root and symbolic-link
boundaries, and permission-declaration coverage. It also preserves the two
temporal cases for later repaired and regression batches. Its strongest
positive state is `STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST`, and every result
explicitly says architecture fit and readiness were not established.

The ten fixture families are:

- `COMPLETE_EXACT_RELATION`;
- `PROVIDER_IDENTITY_MISSING`;
- `DEMANDED_SELECTOR_COVERAGE_MISSING`;
- `IMPLEMENTATION_TARGET_MISSING`;
- `IMPLEMENTATION_CONTENT_BINDING_MISMATCH`;
- `OUTSIDE_ROOT_OR_SYMBOLIC_TARGET`;
- `DUPLICATE_OR_COMPETING_PROVIDER`;
- `PERMISSION_DECLARATION_MISSING`;
- `REPAIRED_DECLARATION_REMOVES_NEXT_GAP`;
- `EXISTING_DECLARATION_REGRESSION`.

For a selector-free exam, the selector-coverage case remains visibly
`NOT_APPLICABLE` instead of being silently counted as a pass.

## Synthetic verification

The isolated organ suite passed 3/3 tests. It demonstrated:

- approval and HOLD sealing with exact digest binding;
- nonhuman, unknown-field, missing-field, and open-ended executor refusal;
- one approved synthetic recipe producing five files and ten passing cases;
- the positive-state ceiling without architecture-fit or readiness claims;
- selector-free `NOT_APPLICABLE` handling;
- HOLD and empty paths producing zero candidate files;
- recipe and generated-byte tamper refusal;
- unchanged synthetic Workshop fixture bytes.

The approval actor in these temporary fixtures is explicitly
`mike-test-steward`; it is synthetic test provenance, not a real Mike approval.
Temporary candidate directories were removed by the test cleanup.

## Automatic practice evidence

Automatic practice always supplied `recipes: []`.

- batch:
  `reasoning-provider-declaration-research-executors-1e60cff3224c9e09dd7a`;
- batch digest:
  `bc60ad80968a4edad2c4f8a9c55162fcdb1db87e316d9fc6402f7d43a579a0d9`;
- inputs digest:
  `1e60cff3224c9e09dd7aa5d26f3deb4877b6e8c81b64e1cea7810079cdcbf2b1`;
- source research-exam batch:
  `reasoning-provider-declaration-research-exams-dc71114538351f6a4d04`;
- batch file SHA-256:
  `dede1448d216484091d609efe58f145941eefafe03b1809892d43532db0473e6`;
- batch file bytes: `6996`;
- state: `NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED`;
- reviewed recipes, candidates, candidate files, fixture cases, architectures
  selected/evaluated, provider candidates, declarations, live experiments,
  Workshop writes, training receipts, and world actions: all `0`.

The integrated Workshop practice report is
`curriculum-20260718161349732-c7f43fd7ca13`, SHA-256
`05a28b693bd04fff0d36d26638376f0cf45db3e1b0779ae0b4fdc1c516fba8a1`,
`17401` bytes. It reused the same empty executor batch and recorded no training
admission.

## Live runtime canary

Mirror was restarted with the new organs loaded:

- PID: `31312`;
- started: `2026-07-18T16:14:18.539Z`;
- port: `8818`;
- learned weights: `false`;
- architecture-selection authority: `false`;
- live-architecture-evaluation authority: `false`.

Canary session `session-74be3033c852b5a64938056e` used actor
`codex-live-canary` with kind `MACHINE`. It queried the current `shared-physics`
exam, then attempted to submit `HOLD` to the HUMAN review endpoint. The endpoint
correctly returned HTTP `403`; no review or recipe was sealed. The same session
submitted the builder's empty recipe request and received
`NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED` with zero candidates, files,
architecture selections/evaluations, providers, Workshop writes, or training
receipts. The session was closed; live health then reported zero open sessions.

This canary intentionally proves that Mirror cannot manufacture a HUMAN
decision. A real HOLD or approval remains available only after a human actually
supplies it.

## Regressions

- Mirror Core: 120/120 pass;
- Mirror Learning Forge: 99/99 pass;
- AXM Native Learning Shell: 6/6 pass;
- focused executor suite: 3/3 pass;
- runtime HOLD/empty integration: PASS within Core;
- automatic Workshop practice integration: PASS within Core;
- Mirror Doctor: PASS;
- tracked-visible JSON: 167/167 parse;
- Workshop foundation-services selftest: PASS;
- Workshop physics selftest: PASS.

## Failed evidence preserved

- The first isolated fixture launch failed with Windows `spawnSync ... ENOENT`
  because the temporary stage/candidate path exceeded the process-launch path
  limit. No fixture result was claimed. Stage, session, and candidate directory
  names were shortened while keeping IDs and digests in receipts; the complete
  suite then passed.
- `npm test` through PowerShell's `npm.ps1` was blocked by the host execution
  policy. `npm.cmd test` ran the identical package test command and passed
  120/120.
- The first live token lookup checked the nonexistent
  `state/mirror.token`; no HTTP request was made. Source inspection identified
  the configured `state/runtime-token.txt` path, whose value remained hidden,
  and the canary then ran.
- The first all-JSON pass used PowerShell `ConvertFrom-Json`, which refused the
  Forge package lock because of a deserializer property-name limitation. This
  was not treated as malformed JSON; Node's strict `JSON.parse` then verified
  all 167 tracked-visible JSON files.

## Known limits and next gate

- No real provider architecture candidate exists.
- No real architecture was evaluated, ranked, selected, or installed.
- Passing synthetic executor fixtures proves the research instrument's
  discrimination only.
- The source `shared-physics` gap remains unresolved and every architecture
  hypothesis remains `UNTESTED`.
- A future real experiment needs an attributed human executor review, a
  separately proposed architecture projection with source lineage, independent
  evidence for its provider/declaration/implementation relations, and a later
  release gate. The builder itself cannot originate that candidate.
- Only Mike may accept CANON.

Machine-readable evidence is in
`exports/action-reports/MIRROR_PROVIDER_DECLARATION_RESEARCH_EXECUTOR_GROWTH_AUDIT_2026-07-18.json`.
