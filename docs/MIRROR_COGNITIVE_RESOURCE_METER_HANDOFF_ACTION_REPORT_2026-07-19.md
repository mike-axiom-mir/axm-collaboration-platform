# Mirror cognitive-resource-meter handoff action report — 2026-07-19

Status: TEST

Claim ceiling:
`TEST_BOUND_READ_ONLY_WORKSHOP_COGNITIVE_RESOURCE_DRAFT_OBSERVER_NO_AUTOMATIC_INTAKE_OR_EVIDENCE_AUTHORITY`

## Result

Mirror now has a bounded, explicit, read-only doorway for the Workshop
`cognitive-resource-meter`. The doorway verifies the TEST module declaration,
the provider catalog, all eight modular hand declarations, every automatic
authority boundary, and the exact bytes of the two shared draft contracts. It
does not load or execute Workshop JavaScript.

The first real handoff assessment is:

- assessment ID:
  `cognitive-resource-meter-handoff-3567d8d1cae8f1887e1f1178`;
- assessment digest:
  `f902ad7e63e183c185232c049d06eccabbcc0b76648ba124b2ba814b77f095d4`;
- state: `DECLARED_TEST_PROVIDER_NO_EXPORTED_DRAFTS`;
- declared providers: 5;
- declared hands: 8;
- exact byte-identical Workshop/Mirror draft contracts: 2;
- exported drafts observed: 0;
- observations admitted: 0;
- economics profiles admitted: 0.

This proves that the producer declaration and handoff route are inspectable. It
does not prove that a cognitive-work measurement or rate profile has been
produced. The empty export directory remains an honest evidence gap.

## Boundary implemented

The reader inventories only immediate real `.json` files beneath
`exports/cognitive-resource-meter`, with a ceiling of 128 files and 1 MiB per
file. It separately hashes up to 64 opaque ZIP bundles, capped at 50 MiB each
and 256 MiB in total, without opening or admitting them. It reads declarations,
draft exports and bundle metadata twice; a changed second view refuses the
mixed snapshot. Symlinks, nested entries, traversal, contract drift, missing
refusal claims, automatic provider capture, automatic hand authority and
provider catalog authority fail closed. Required hands and outputs remain
mandatory while new zero-authority hands, outputs and permissions are preserved
as visible additive declarations rather than breaking the adapter.

For the two bound schemas, Mirror runs only its own pure deterministic draft
normalizers. The private handoff assessment stores the relative export path,
byte count, byte hash, schema, output kind, permission state, normalized digest
and bounded refusal reason. It deliberately does not store the draft body.

An exact normalized draft with `permission.status: ALLOWED` becomes only
`EXPLICIT_INTAKE_CANDIDATE_REQUIRES_STEWARD_REVIEW`. Unknown or forbidden
permission holds. Malformed and undeclared schemas remain visible refusals.
None of those states calls the existing observation or economics-profile
intake organs.

## Verification

- Workshop shared cognitive-resource focused selftest: 60 PASS, 0 FAIL. The
  suite grew from the handed-off 50 cases after it caught and repaired a stale
  exact-three-provider assumption against the additive five-provider catalog.
- Workshop discovery-seam review: PASS; 8 hands, 2 digest-bound contracts,
  zero automatic authority.
- Mirror focused adversarial tests: 13 PASS, 0 FAIL.
- Mirror full repository tests: 319 PASS, 0 FAIL.
- Mirror Doctor after implementation: structural PASS; 489 public files, 282
  JavaScript files checked, 203 JSON files parsed, and 44/44 active organs with
  static test reachability.
- Runtime PID 496 was not restarted or modified.

Adversarial coverage includes contract byte drift, missing refusal boundaries,
provider automatic capture, declaration traversal, unexpected/nested exports,
unknown permission, malformed drafts, unknown schemas, input order, disabled
policy, absent Workshop and absent module.

## Files changed

- `adapters/workshop/cognitive-resource-meter-reader.js`
- `organs/cognitive-resource-meter-handoff-organ.js`
- `scripts/observe-cognitive-resource-meter-handoff.js`
- `contracts/cognitive-resource-meter-workshop-observation.schema.json`
- `contracts/cognitive-resource-meter-handoff-assessment.schema.json`
- `tests/cognitive-resource-meter-handoff.test.js`
- `training/TRAINING_POLICY.json`
- `package.json`
- `README.md`
- `MODEL_BOM.json`
- `STATUS.json`
- `scripts/mirror-doctor.js`
- this report and its public audit record

## Known limits

- No real Workshop cognitive-resource draft existed at observation time.
- A declared provider identity and a normalized draft are not certified
  authorship or measured truth.
- Price freshness remains declared, not externally certified.
- No universal token-to-compute mapping exists.
- Nonlinear billing, measured/billed cost and calibrated cost accuracy remain
  unsupported.
- No ranking, optimization, provider/model/hardware/plan selection, budget
  allocation, permission grant, training, runtime promotion, CANON change or
  world action is authorized.

The handoff is TEST research evidence. Only Mike may accept CANON.
