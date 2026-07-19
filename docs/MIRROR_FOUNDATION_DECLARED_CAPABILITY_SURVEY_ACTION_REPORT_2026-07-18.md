# Mirror Foundation declared-capability survey action report

Status: TEST exact declaration compatibility, not CANON.

## Purpose

The Foundation hand planner deliberately left `existingCapabilityMatch` as
`NOT_SEARCHED` and `newOrganNeed` as `UNASSESSED`. Building a new organ before
checking Mirror's existing body would duplicate machinery; assuming an existing
organ fits because its name sounds right would turn story into architecture.

The capability survey inventories every bounded
`capabilities/*.capability.json` declaration. Each declaration binds its own
digest, implementation organ ID, source files and exact source hashes, supported
hand families, input kinds, capability tokens, operating mode, and closed
authority. The survey compares every hand with every declaration. It neither
executes source nor selects the first, most frequent, or only match.

## Current declarations

Two implementation-backed declarations are present:

1. `axm.mirror.declared-capability/typed-trace-independent-exam-intake/v1`
   binds the independent language-exam organ, pack and exam contracts, and its
   focused tests. It declares the permissioned external submission and sealed
   exam-intake surface; outside authorship remains a declaration Mirror cannot
   certify.
2. `axm.mirror.declared-capability/reasoning-experience-negative-observation/v1`
   binds the reasoning-experience organ, receipt contract, and focused tests. It
   declares intake of already-existing real-local episodes and has no event
   induction authority.

Declaration compatibility is exact only when hand family, input kind, and every
required capability token match and all declared source hashes still verify.

## Operational result

The real immutable survey batch is
`foundation-capability-survey-f2be01c35782ac97280552b9`, bound to hand batch
`foundation-development-hands-79f691cb9f67d40ba828a193`.

- declarations inventoried: two;
- verified declarations: two;
- refused declarations: zero;
- declared compatibility witnesses: two;
- hands with at least one witness: two;
- existing capabilities selected: zero;
- operational fits claimed: zero;
- new organs required: zero.

Each current hand has one declared witness. This is evidence that Mirror may be
able to reuse existing machinery, not evidence that either surface satisfies
the full hand in operation. Both results remain
`DECLARED_COMPATIBILITY_WITNESSES_REQUIRE_INDEPENDENT_AFFORDANCE_EXAM`.

## Falsification

Five focused survey tests passed:

1. every hand was compared with every declaration and exact witnesses remained
   unselected;
2. declaration order was invariant, and two exact witnesses remained two
   unselected witnesses rather than a first- or frequency-based choice;
3. a stale implementation-source hash was refused, and a declaration missing
   only `NO_EVENT_INDUCTION` could not near-match;
4. committed survey tampering was refused without erasing the batch; and
5. empty input, policy, contracts, command hooks, and active-runtime exclusion
   remained explicit.

The complete Foundation feedback chain passed 33/33 focused checks. The full
integrated Mirror regression surface passed 186/186, including the live settled
Workshop check.

## Authority and limits

The survey writes only ignored private content-addressed evaluation traces. It
has zero source-execution, capability-selection, operational-fit, readiness,
new-organ-need, implementation-build, evidence-acquisition, training,
permission-grant, runtime-promotion, canon-change, or world-action authority.

The next seam was routed into one independent affordance-exam request per
hand-witness pair. Those requests remain unexecuted and have no fixtures or
expected predicates, so neither reuse nor a new organ is justified.

## Artifact hashes

- `organs/foundation-development-capability-survey-organ.js` —
  `25436123e7ee7d2d6627f005b5c199c76cf1c4020f961c16ec4565ea573d9120`
- `contracts/foundation-development-capability-declaration.schema.json` —
  `62d60bc8eea80edc6d049c391549a712067e3b4e0ced3f7206e887dcdc63c6db`
- `contracts/foundation-development-capability-survey-batch.schema.json` —
  `274c84d26c0c104fc62c548fd5bf14735656fa08c8baa64b24460432dba325e7`
- external-exam capability declaration —
  `189f2fd27596565eefc2845f4c06225f2063344e78fca77024f67a7831b2bb79`
- negative-observation capability declaration —
  `a5643f246d7c039a1a0527f94bc50936e0a94d24e2253d2ac0cafab0ae3065bd`
- `scripts/run-foundation-development-capability-survey.js` —
  `be120520274b483bd07b863860cb4ccf3412f3f7e926a540c66ad3eeb8081bb1`
- `tests/foundation-development-capability-survey-organ.test.js` —
  `bf0d37f9b8915e692402a608c8344ed197e4c06c0a16db799c953fd39b4d8a61`
- `training/TRAINING_POLICY.json` —
  `81b65b609b4c0f5198acb899c7f1e752c28570c725047052588a2cd864037d74`
- private survey batch —
  `cf83eb39547ad854e0f6d091a5f2ef9e6658136e5db1a0e8342583959110c008`
  (13,800 bytes)

Later source edits must supersede these hashes rather than silently inheriting
this result.
