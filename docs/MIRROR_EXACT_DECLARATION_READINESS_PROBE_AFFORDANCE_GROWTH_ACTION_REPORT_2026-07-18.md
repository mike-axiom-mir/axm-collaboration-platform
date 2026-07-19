# Mirror exact-declaration readiness-probe affordance growth action report

Status: TEST  
Date: 2026-07-18  
CANON authority: Mike only; no CANON acceptance is claimed.

## Outcome

Mirror now has a small hard-coded organ for a repeated gap instead of six
requirement-specific probes. The organ discovers reusable structural
affordances from current verified readiness hands and read-only Workshop
declarations. It may propose an exact probe input to an attributed human
reviewer; it cannot review, seal, build, run, install, repair, grant, train, or
promote anything.

The current immutable batch assessed six hands and produced:

- three exact manifest-bound module review packets;
- one exact typed shared-service review packet;
- two explicit no-provider holds;
- zero human reviews, sealed recipes, candidates, live probes, Workshop writes,
  permission grants, training receipts, or world actions.

Every positive structural observation remains capped at `AVAILABLE`. Nothing in
this work establishes `READY`.

## What the source trace found

Workshop's Technical Glasses readiness table has no declaration for the six
current requirements, so each falls to `UNKNOWN` with “No live readiness source
declared.” This is a declaration gap, not evidence that six services failed.

Four requirements expose one repeatable provider shape:

1. A module provider is eligible only when the existing manifest-bound handoff
   graph already verifies the exact manifest and `axm.module-contract/v1` IDs,
   exact declared contract path, content digests, and permission-declaration
   coverage, and the manifest's declared entry is a real regular file.
2. A shared-service provider is eligible only when one bounded, non-symbolic
   `shared/**/service.contract.json` has schema
   `axm.shared-service-contract/v1`, the exact requirement ID, and the required
   structural fields.

A consumer string is not a provider declaration. A matching folder or filename
is not a provider declaration. More than one exact provider is an ambiguity,
not a reason to choose silently.

## Current six-hand result

| Requirement | Classification | Review input or hold | Why |
| --- | --- | --- | --- |
| `publish-library` | `PROPOSE_EXACT_BOUND_MODULE_AFFORDANCE` | `DECLARED_MODULE_AVAILABLE tools/publish-library/manifest.json` | Exact manifest, module contract, entry, IDs, digests, and permission declarations bind. |
| `module-installer` | `PROPOSE_EXACT_BOUND_MODULE_AFFORDANCE` | `DECLARED_MODULE_AVAILABLE tools/module-installer/manifest.json` | Same reusable module rule; no requirement-specific code. |
| `review-inbox` | `PROPOSE_EXACT_BOUND_MODULE_AFFORDANCE` | `DECLARED_MODULE_AVAILABLE tools/review-inbox/manifest.json` | Same reusable module rule; no requirement-specific code. |
| `asset-hands` | `PROPOSE_EXACT_SHARED_SERVICE_AFFORDANCE` | `DECLARED_SHARED_SERVICE_AVAILABLE shared/asset-hands/service.contract.json` | One exact typed shared-service provider declaration exists. |
| `shared-physics` | `HOLD_NO_EXACT_PROVIDER_DECLARATION` | no probe suggested | Spatial Studio consumes `service:shared-physics/axm-physics-2d`, and implementation/self-tests exist, but no exact typed provider declaration binds the requirement. Consumption and source naming do not prove provision. |
| `identity` | `HOLD_NO_EXACT_PROVIDER_DECLARATION` | no probe suggested | Multiple identity-related sources exist, but no single exact provider declaration establishes the readiness subject. |

The holds are useful output. They identify the next evidence needed without
inventing semantic authority. A future exact provider contract automatically
changes the next content-addressed assessment; no requirement ID is hard-coded
in the organ.

## The new organ

`organs/reasoning-readiness-probe-affordance-organ.js`:

- consumes the current verified Readiness Hand and manifest-bound Handoff Graph
  batches;
- scans only bounded regular `service.contract.json` declarations under the
  read-only Workshop `shared` root;
- binds manifest, contract, entry, service inventory, source, hand, and graph
  digests into immutable ignored-state evidence;
- uses the deterministic Reasoning Foundation and independent Seam Cell to
  choose the review-packet or hold path;
- rejects generated name-inference and false-`READY` candidates for every hand;
- appends a new immutable batch when relevant declaration bytes or the service
  inventory change;
- exposes `POST /axm/v1/growth/readiness-probe-affordances` inside an explicit
  authenticated session;
- supplies machine evidence and a human-readable interpretation as two views of
  one trace.

The endpoint returns review packets and holds only. It does not invoke the
human review bridge.

## Structural probe DSL growth

The existing reviewed recipe cell and disposable candidate builder now accept
two generic kinds in addition to `FILE_EXISTS` and `DIRECTORY_EXISTS`:

- `DECLARED_MODULE_AVAILABLE` parses the reviewed manifest, requires the exact
  requirement ID, resolves the declared contract and entry without traversal or
  symbolic links, requires an exact `axm.module-contract/v1` ID, and verifies
  every contract permission is declared by manifest `uses`;
- `DECLARED_SHARED_SERVICE_AVAILABLE` parses the reviewed contract and requires
  the exact `axm.shared-service-contract/v1` ID and bounded structural fields.

Both produce content-bound evidence references. Missing, malformed,
ID-mismatched, wrong-type, symbolic, out-of-root, oversized, or unreadable
evidence returns `UNKNOWN`. A structurally valid declaration returns only
`AVAILABLE`, with runtime health and semantic fitness explicitly unproven.

These kinds still require an exact current-hand-bound attributed `HUMAN` review
before deterministic candidate bytes can be built. Automatic practice submits
`recipes: []`.

## Reasoning Foundation discrimination

For all six current hands, the authority-closed Reasoning Foundation selected
the evidence-matching review-packet or hold action. It rejected both of these
decoys for every hand:

- infer a provider from a folder, filename, or consumer string;
- claim `READY` from structural declaration evidence.

Result: 6/6 decisions matched, 6/6 name-inference candidates rejected, and 6/6
false-`READY` candidates rejected. These evaluation traces did not enter
training.

## Immutable current evidence

- affordance batch:
  `reasoning-readiness-probe-affordances-85ee00df0282dbdf5b56`;
- batch digest:
  `2032476ebe2986fa7c1dab77e10c41768cce1cd52cd0be159c0041e6fb81f8e0`;
- inputs digest:
  `85ee00df0282dbdf5b560b87cbfb9922d89df0a1a72505652ce3b761d4f1490d`;
- service inventory digest:
  `d71fcd13f55f3608952e92f2b6023ca92806ca9ca926451d7fbbd74afe50bedf`;
- source hand batch:
  `reasoning-readiness-hands-41460a1609d15d43cae9` /
  `b02b2ab40ad6cc1afb3f50ec5b42c9e8555fc16cc915bace3e8db0749b7c1fca`;
- source handoff graph:
  `reasoning-handoff-graph-627524b8983dd7079ff2` /
  `eeea5caea9177f16cc3063509279906fe26a3b5d0558838d8e7c39de46d73398`;
- ignored batch file SHA-256:
  `4fa780aa753873f06e644acfbdda193675cbe54714b76db13e4d082849ba0322`;
- ignored batch bytes: 31,219.

Source lineage includes the organ, Reasoning Foundation, Seam Cell,
Contract Manifest Binding Cell, hand planner, handoff graph, and all three new
API schemas. Exact hashes are preserved in the machine audit.

The updated automatic empty candidate batch is:

- `reasoning-readiness-probe-candidates-d95d906b3ad6460b6af1`;
- batch digest
  `78417ee4fd90e36f65070d54e62e6a038077afc78cab577cdae588c05f3892c3`;
- zero reviewed recipes, candidates, generated files, fixture suites, installs,
  live probes, Workshop changes, training receipts, or world actions.

## Automatic practice

Automatic Workshop practice now runs the affordance organ after current hand
planning and before the empty reviewed-candidate builder input. The current
report is:

- `curriculum-20260718143248675-e41551723760`;
- SHA-256
  `bd41002ec7dfb9b99905add03df3cbc4876527da4063c40fbbc6f943dabf7fa0`;
- 13,947 bytes.

It records four review packets, two holds, no automatic human review, and no
candidate construction. The same organ is wired into the Native Learning Shell;
its results remain evaluation provenance and do not train the private
challenger.

## Verification

Focused evidence completed before the final full regression:

- isolated affordance planner tests: unique exact module, unique exact shared
  service, consumer-only hold, name-decoy hold, ambiguity hold, source drift
  supersession, and trace tamper refusal;
- disposable builder tests: unseen file, directory, module, and shared-service
  kinds; positive, missing, type/declaration mismatch, malformed declaration,
  boundary, and invalid-time behavior;
- runtime contract: affordance endpoint to explicit human review to disposable
  typed candidate fixtures, with zero live execution or Workshop change;
- automatic curriculum: 4/2 review-packet/hold split and empty candidate input;
- Native Learning Shell: the same 4/2 assessment, no review/build/live action.

Final verification:

- Mirror core: 113/113 tests passed;
- Learning Forge: 99/99 tests passed;
- Native Learning Shell: 6/6 tests passed;
- Mirror Doctor: `Structure: PASS`;
- 210 repository JSON files parsed with Node;
- `git diff --check`: no whitespace errors; only expected LF/CRLF warnings;
- ignored-state checks passed for the affordance batch, automatic report, and
  empty builder batch;
- live runtime PID `28348`, started `2026-07-18T14:32:45.212Z`, exposed the new
  organ with learned weights false;
- live TEST-session canary
  `session-275797c64fe658174e0c7f78` returned four review packets and two holds,
  with no review, recipe, candidate, live probe, Workshop change, or runtime
  change;
- the nonhuman review canary returned HTTP 403;
- the live empty builder call reused
  `reasoning-readiness-probe-candidates-d95d906b3ad6460b6af1` with all action
  counts zero.

## Preserved observations and limits

- The first real affordance-batch publication hit a Windows `EPERM` during the
  final same-volume directory rename. The complete ignored-state stage was
  preserved; after confirming the destination was absent and the source was
  inside the intended state root, it was moved to the exact content-addressed
  destination and independently verified. Later derivations reused it. This is
  an observed Windows publication hiccup, not erased evidence.
- `shared-physics` remains held even though its implementation and self-tests
  are substantial. This organ deliberately requires a provider declaration;
  adding such a Workshop contract is outside this Mirror change.
- `identity` remains held because choosing among identity sources would be a
  semantic authority decision, not structural discovery.
- Structural availability is weaker than health, semantic fitness, permission,
  installation fitness, and `READY`.
- No current recommendation has been reviewed by Mike. No generated candidate
  for a current Workshop hand has been built or run live.
- Learned weights remain inactive. The organ is deterministic code; it reduces
  repeated hard-coding but is not general intelligence or autonomous
  self-modification.

Machine audit:
`exports/action-reports/MIRROR_EXACT_DECLARATION_READINESS_PROBE_AFFORDANCE_GROWTH_AUDIT_2026-07-18.json`.
