# Mirror Manifest-Bound Handoff Growth Action Report

Date: 2026-07-18  
Status: WORKING / TEST / NEEDS_REVIEW  
CANON: no; only Mike may accept CANON

## Outcome

Mirror's first typed Handoff Graph Organ found a real counterexample to its own
admission rule. It treated a file named `module.contract.json` as route evidence
even when the module manifest did not declare that file as its contract.

The v1 source and batch remain preserved as `KNOWN_FAIL`. V2 now admits a
contract only after an independent cell verifies all of the following:

- manifest and contract module IDs match;
- the content-digested manifest explicitly resolves to that exact contract
  path inside the module directory;
- the contract and manifest SHA-256 digests are present in the receipt;
- every value in contract `permissions[]` is declared in manifest `uses[]`.

Only then may the existing exact handoff cell join producer
`handoffs.emits[]` to consumer `handoffs.accepts[]`. A declaration does not
grant permission. Runtime readiness remains `UNKNOWN_NOT_PROBED`. Routes remain
review-only proposals and are never executed or admitted to training.

## Why this relation was selected

The previous report named required input, permission, runtime readiness, or
recovery as possible next constraints. The current contracts were audited
before choosing one.

`consumes[]` was rejected as an all-required-input rule. Only 10 of the 25 v1
edges used a handoff type also listed in the consumer's `consumes[]`; the field
mixes typed artifacts, services, identities, files, hosts, and future inputs.
Treating every entry as simultaneously required would invent semantics.

Runtime readiness was also not inferred. A fresh Workshop Technical Glasses
compile reported most relevant readiness sources as `UNKNOWN` and explicitly
requires missing state to remain unknown. Its current source fingerprint was
`ab03fee549a8240f43ee8ee34822078b6180471ada1539c19e069453fb88aa63`;
it observed 61 modules, 33 declared contracts, and 33 passing declared
contracts.

Manifest-to-contract binding was selected because Workshop's executable
contract verifier already defines this independent relation: the manifest must
declare the contract, IDs must match, and contract permissions must occur in
manifest `uses[]`. Mirror reimplements the narrow check locally and binds the
two source hashes; it does not import Workshop prose or grant the declarations.

## Preserved v1 failure

The raw filename scan found 39 non-template contract files, but only 33 were
manifest-declared. These six files were unbound:

- `ai-task-talk`;
- `body-pulse`;
- `claude-connector`;
- `mirror-learning-shell`;
- `shell-guardian`;
- `workshop-packager`.

Four v1 edges depended on those files:

- `body-pulse -> governed-evolution-lab`;
- `learning-lab -> mirror-learning-shell`;
- `workshop-direction -> body-pulse`;
- `workshop-packager -> marketplace-deployment`.

Those four direct routes plus three depth-two compositions contaminated seven
of the 44 v1 route proposals. V1 batch
`reasoning-handoff-graph-e892a17be6dd49a06248` and the unchanged source now at
`organs/reasoning-handoff-graph-organ-v1-known-fail.js` remain evidence. The
preserved source SHA-256 is
`3c05a599722782742ab1e5b704cb34f604d3ed859631c0f9e71a6298d2341c1c`.
No old trace was deleted or rewritten.

## V2 architecture

The new Contract Manifest Binding Cell is deterministic and candidate-free. It
returns a complete PASS or FAIL receipt with both input records, three boolean
checks, missing permission declarations, a digest, and an all-false authority
map. Its boundary states that declaration is not permission grant or runtime
readiness.

The v2 graph discovery route:

1. refuses symbolic links, unsafe paths, invalid JSON, ID mismatch, undeclared
   conventional contract files, and missing permission declarations;
2. preserves every refusal in the batch instead of silently dropping it;
3. admits only PASS binding receipts;
4. builds every exact cross-module edge over admitted contracts;
5. composes every non-cyclic direct and depth-two route;
6. generates a structural decoy that keeps the typed route but removes the
   terminal manifest binding;
7. runs the valid route and decoy through the full Reasoning Foundation;
8. verifies each session independently and writes only ignored private traces.

The content-addressed batch input now includes an eight-file source lineage:
the current organ, preserved v1 organ, both independent cells, request schema,
binding schema, response schema, and batch schema. A source change therefore
creates a new batch ID instead of reusing stale evidence.

## Current batch

Batch: `reasoning-handoff-graph-627524b8983dd7079ff2`

- inputs digest:
  `627524b8983dd7079ff2c07a6ad853e7087b1ba215bda3997f4fe20fe4b36866`;
- batch digest:
  `eeea5caea9177f16cc3063509279906fe26a3b5d0558838d8e7c39de46d73398`;
- batch file SHA-256:
  `d8c4dec8504a5dd70efb399773be14b712636b0f8a399e72f17fb387e0ca91bd`;
- batch file bytes: 302,784;
- discovered contract records: 40, including the template record;
- eligible manifest-bound contracts: 33;
- failed manifest bindings: 6;
- excluded template records: 1;
- unique emitted types: 76;
- unique accepted types: 62;
- exact cross-module edges: 21;
- direct routes: 21;
- non-cyclic depth-two routes: 16;
- manifest-bound routes selected: 37/37;
- generated unbound decoys rejected: 37/37;
- route mismatches: 0;
- training receipts: 0;
- module executions and world actions: 0;
- Frontier state: `NO_UNEXPECTED_SEAM`.

The batch contains 37 complete Reasoning Foundation sessions totaling
1,079,020 bytes. The verifier checks 21 exact handoff receipts, 33 passing
binding receipts, six actual failed binding receipts, and 37 generated failed
binding receipts: 97 receipt objects in total.

Current source lineage SHA-256 values:

- v2 organ:
  `6f0cd8a31182b04ded9532f64f92ee573760509b905ab2c373659e1dd43717bf`;
- preserved v1 organ:
  `3c05a599722782742ab1e5b704cb34f604d3ed859631c0f9e71a6298d2341c1c`;
- exact handoff cell:
  `d26f93031130946ffbc55c7fd2dc8811698ae3419d7a60e8dd256727c5dd0bf9`;
- manifest binding cell:
  `8daaca4e1c8aca9453d6403e5ccbf890bb16299b31195505455a1c4e49071ded`;
- binding schema:
  `446638725892a8d149f117133a0300f8358db525baf571c45aa0d5b9326a17cb`;
- request schema:
  `005c90fab2a9d1537d059c5d22d6370ab0a586e4aa184e197c7d934214718255`;
- v2 response schema:
  `6dd1e06d56075d602fee22e0d897af4be555731364578bb77cafd89eeadb85fb`;
- v2 batch schema:
  `cf5d8bb5e8690b9c109d12b1efc7ca0d029bfdc57f5d7aebddfaf6a8ff084d2d`.

## Automatic runtime evidence

The verified v1-loaded loopback process at PID 31044 was stopped and replaced
by PID 14284 running the v2 source. Public health reports:

- organ `axm.mirror.organ/reasoning-handoff-graph-v2`;
- cell `axm.mirror.cell/contract-manifest-binding-v1`;
- learned weights absent;
- current v2 batch, 33 bindings passed, six failed, 21 edges, 37 routes;
- zero route mismatch, training receipt, or world action;
- no automatic-practice error.

Automatic report `curriculum-20260718121724692-d42a71c4c250` has SHA-256
`c32da761b0a14242edb9d6b2615dc24b628d2945c0d07823c630e9e4aa45743e`
and 9,780 bytes.

One explicit authenticated session produced both outcomes:

- session: `session-e6c26da8fc4e69f508bf1aab`;
- valid request: `ui-ux-builder -> studio -> game-hub`;
- typed interfaces: `axm.uiux-workspace/v1 -> axm.game-asset/v1`;
- response:
  `PROPOSED_MANIFEST_BOUND_EXACT_TYPED_ROUTES`;
- response digest:
  `80c4c4c6cce2dde023c6db228f8946e4ff9e0161c6dd99554417b8e86b057ceb`;
- manifest binding receipts on proposal: 3;
- runtime readiness: `UNKNOWN_NOT_PROBED`;
- negative request: `body-pulse -> governed-evolution-lab`;
- negative response: `HOLD_UNBOUND_MODULE_CONTRACT` with zero proposals;
- active runtime changed: false for both;
- session explicitly closed.

## Learning Shell evidence

Fresh Shell session `learning-shell-mrqc1xdf-f4dd8ba0` completed all seven
stages and reused the v2 graph batch. Its training artifact reports 33 passing
bindings, six failed bindings, six undeclared contract files, 21 edges, 37
selected routes, 37 rejected unbound decoys, zero mismatches, zero graph
training receipts, and zero world actions.

- session file SHA-256:
  `9bc473e968bc1d47c25b973b1dccffafefbdd2c3931c53e1a244bd1fac2cdcdd`;
- session file bytes: 8,124;
- training artifact SHA-256:
  `3320a99b110863df675f09923bf34ff15f5dfe7ce19d2d16287a7267a79dd814`;
- training artifact bytes: 800,298;
- private reasoning cycle remained `PROPOSE_HUMAN_REVIEW` and inactive;
- token-language track remained `HOLD_REPAIR` for its pre-existing small
  corpus seam.

## Development failures preserved

- V1's filename-based admission bug is the central `KNOWN_FAIL` described
  above. Its source, batch, and contaminated route evidence remain preserved.
- An intermediate v2 batch `reasoning-handoff-graph-f3767ffc80bbd5e1e345`
  correctly filtered manifest bindings but did not bind implementation source
  hashes. It remains ignored private state and was superseded before automatic
  integration by the source-bound batch `627524...`.
- The first post-run Shell evidence extraction called `readArtifact` with a
  session ID instead of the documented session object and raised a `TypeError`.
  The underlying session was inspected and found COMPLETE with all seven
  stages. Extraction was rerun with the correct object; no result was hidden or
  reclassified.

## Verification

- Handoff and manifest-binding focused tests: 6/6;
- focused runtime and Model BOM integration: 4/4;
- focused automatic Workshop integration: 1/1;
- focused Shell integration: 4/4;
- Mirror core full suite: 96/96;
- Mirror Learning Forge full suite: 99/99;
- AXM Native Learning Shell full suite: 6/6;
- Forge build integrity: 148 files, local/default-deny boundaries intact;
- route session hashes: 37/37;
- independent receipt verification: 97 objects;
- deterministic unchanged-batch reuse: PASS;
- new typed interface creates a new immutable batch: PASS;
- orphan contract enters preserved v1 but is refused by v2: PASS;
- recomputed-outer-digest structural tamper: REFUSED;
- individual session tamper: REFUSED;
- live automatic wake, valid proposal, orphan hold, explicit close: PASS;
- final Mirror Doctor: PASS at PID 14284 with learned weights absent;
- final Node JSON sweep: 912/912 documents parsed;
- `git diff --check`: PASS;
- sampled v2 batch, route session, runtime token, runtime log, automatic
  report, and Shell session ignore checks: 6/6;
- final Technical Glasses recompile: unchanged source fingerprint, 33/33
  declared contracts passing, missing readiness still UNKNOWN;
- final live health: v2 batch present, no last error, zero mismatches,
  training receipts, or world actions;
- outside-network use by tests or training: none;
- routed Workshop modules invoked: none.

The paired machine audit records these results and their exact machine fields.

## Changed surfaces

This milestone preserves v1 under a known-fail filename and adds the Contract
Manifest Binding Cell, binding schema, v2 batch and response schemas, source-
bound Handoff Graph v2, automatic Workshop and Shell fields, runtime health
counters, live hold behavior, policy and Model BOM declarations, Doctor
coverage, focused and integration tests, status, documentation, this report,
and the paired machine audit.

Private graph batches, sessions, runtime logs, tokens, datasets, learned models,
checkpoints, Workshop reports, and Shell sessions remain ignored local state.
No file was staged or committed.

## Known limits and next evidence gate

- Manifest declaration proves neither implementation conformance nor actual
  permission grant.
- Manifest `uses[]` covering contract `permissions[]` proves declaration
  consistency only; it does not prove current human approval.
- Runtime readiness is not available for most dependencies and stays UNKNOWN.
- Exact handoff equality remains necessary but insufficient for semantic goal
  suitability, quality, cost, recovery, availability, or successful execution.
- `consumes[]` is not interpreted as an all-required-input list because current
  evidence does not support that meaning.
- Composition remains bounded to depth two and excludes cycles.
- Route ordering is deterministic by depth and route ID, not learned goal-
  specific utility.
- Generated unbound decoys are structural counterexamples, not failed module
  executions.
- No graph trace trains the private strategy model.
- No real route was executed, so a real runtime failure-and-repair receipt is
  still missing.
- No CANON, general planning, general reasoning, consciousness, safety proof,
  or self-directed authority is claimed.

The next honest gate is a typed, independently sourced readiness receipt for a
specific route dependency, with UNKNOWN preserved when no probe exists. It may
filter or hold a proposal but may not start a service, grant a permission, or
execute a module. A repeated real failure could instead earn a narrow adapter
exam. Neither route is justified by names or narrative prose alone.
