# Mirror typed-handoff graph growth action report

Date: 2026-07-18  
Status: **WORKING / TEST / NEEDS_REVIEW**  
Canon: **no** - only Mike may accept CANON.

This report supersedes
`MIRROR_TYPED_CONTRACT_CURRICULUM_GROWTH_ACTION_REPORT_2026-07-18.md` as the
current-state account. The contract-curriculum report, its three live input
snapshots, its known-fail v1 lineage, and all earlier evidence remain preserved.

## Outcome

Mirror now has another small hard-coded organ earned by a specific missing
capability: the Reasoning Handoff Graph Organ v1. It can discover exact typed
interoperability between local Workshop modules and automatically originate all
non-cyclic one-hop and depth-two route proposals. No module ID, interface type,
edge, route, or composition is compiled into the organ.

The current 39 eligible contracts expose 25 exact cross-module edges. From
those edges, the organ generated 25 direct routes and 19 depth-two routes. For
every route it also generated an incompatible downstream consumer. The native
Reasoning Foundation selected the exact route over the mismatch in 44/44 full
sessions. Route-selection mismatches: zero. Training receipts: zero. Workshop
module executions: zero.

This closes a real candidate-origination seam. The general Reasoning Foundation
can compare bounded candidates but deliberately cannot invent arbitrary domain
solutions. The new organ supplies only one narrow proposal class from typed
contract structure, while the existing Principle and Seam cells retain their
gates. As new compatible contract interfaces appear, the graph and route set
can grow without a Mirror lesson, module list, route list, or code edit.

## Why this relation was selected

The preceding contract-curriculum milestone exposed 342 current refusal
strings. Expanding training to every refusal looked like growth but was
rejected: all of those exams collapse to the same structural prohibition
lesson and would mostly multiply correlated support.

The same contracts contain a genuinely different relation:

- 89 emitted-interface entries across 83 unique types;
- 91 accepted-interface entries across 65 unique types;
- 25 exact cross-module edges across 16 currently matched types;
- 19 non-cyclic two-hop compositions.

That graph adds exact compatibility, negative discrimination, and bounded
composition. It therefore earned a separate organ instead of more copies of
`respect-explicit-prohibition`.

## Architecture and authority separation

Candidate generation and compatibility judgement are separate.

The Contract Handoff Compatibility Cell:

- reads only producer `handoffs.emits[]`, consumer `handoffs.accepts[]`, exact
  contract digests, and the proposed interface identifier;
- returns `PASS` only when the same exact string is in both typed arrays;
- has no candidate-generation, training, tool, network, world, contract-write,
  permission, semantic-truth, runtime, canon, or identity authority;
- hashes the complete machine receipt;
- does not use module-name meaning, goal words, human wording, or learned
  weights.

The Handoff Graph Organ:

- safely discovers valid local `axm.module-contract/v1` files under the
  Workshop `tools` root;
- refuses symbolic links, unsafe paths, invalid JSON, schema/ID mismatch,
  untyped or duplicated interface identifiers, more than 64 contracts, more
  than 256 edges, more than 256 routes, and depth beyond two;
- builds every cross-module exact edge;
- builds every direct edge and every non-cyclic two-edge chain;
- pairs each route with a deterministic consumer that does not accept the
  terminal type;
- supplies both candidates and the independent compatibility receipts to the
  Reasoning Foundation;
- stores full machine state, human rendering, Principle trace, independent Seam
  review, session digest, and file hash under ignored private state;
- opens a Frontier assessment on a route-selection mismatch;
- never admits a match or mismatch to training and never invokes a module.

The authenticated route endpoint returns up to eight shortest exact proposals.
It does not rank semantic suitability, infer an unstated human goal, or grant
permission to execute.

## What worked

- The organ found the real 25-edge graph with no module or type list.
- Direct and depth-two compositions were generated rather than enumerated.
- All 44 deliberately incompatible consumers received independent `FAIL`
  receipts.
- The Reasoning Foundation selected 44/44 compatible routes even when the
  incompatible candidate was supplied first.
- Every compatible path had a `PASS` verifier receipt; every decoy had a `FAIL`
  receipt and was ineligible.
- All sessions remained proposal-only with zero independent authority seams.
- Adding one typed acceptance in an isolated fixture produced a new edge, new
  route, and new immutable batch without changing organ code; the prior batch
  stayed preserved.
- An unknown module and a depth limit too shallow for a real chain returned
  explicit holds rather than fabricated routes.
- Re-running unchanged real contracts reused the exact batch and sessions.
- Automatic runtime practice and a fresh seven-stage Learning Shell session
  reused the same graph batch.
- The live authenticated endpoint returned a two-hop proposal with exact
  compatibility receipt lineage and then closed with zero memory writes.

## What did not work during development

Strengthening the batch verifier initially caused a focused failure on an
otherwise valid stored batch. The verifier compared the JSON insertion order of
`expectedDecision` instead of its canonical machine value; stable serialization
had reordered the same keys. The check was repaired to compare canonical stable
objects, then the organ, tamper, runtime, Workshop, Shell, and full regression
suites were rerun successfully.

This was a verifier defect, not a route-selection success. It is recorded here
rather than omitted. No production route mismatch was observed.

## Current immutable batch

Batch: `reasoning-handoff-graph-e892a17be6dd49a06248`

- schema: `axm.mirror.reasoning-handoff-route-batch/v1`;
- inputs digest:
  `e892a17be6dd49a062483d8848eff6ebe4e735479cfbf7feab3f34a6ecd7fc6e`;
- batch digest:
  `212b43aa1264301d17ccc88ff05db8c065c5fa2adabff3c7024692e2a9040160`;
- batch file SHA-256:
  `d6f334af9396d80eb019bf8db0b77cd1221d40dada136d81e1ac1d356c9d8dff`;
- batch bytes: 225,655;
- discovered/eligible/excluded contracts: 40/39/1;
- unique emitted/accepted types: 83/65;
- exact cross-module edges: 25;
- direct/depth-two routes: 25/19;
- maximum composition depth: 2;
- exact routes selected: 44/44;
- incompatible decoys rejected: 44/44;
- route-selection mismatches: 0;
- edge compatibility receipts: 25;
- generated mismatch receipts: 44;
- full Reasoning Foundation sessions and matching file hashes: 44/44;
- full session bytes: 1,055,494;
- training receipts: 0;
- semantic consolidations: 0;
- world actions: 0;
- Frontier state: `NO_UNEXPECTED_SEAM`.

Source and schema hashes:

- `organs/reasoning-handoff-graph-organ.js`:
  `3c05a599722782742ab1e5b704cb34f604d3ed859631c0f9e71a6298d2341c1c`;
- `kernel/contract-handoff-cell.js`:
  `d26f93031130946ffbc55c7fd2dc8811698ae3419d7a60e8dd256727c5dd0bf9`;
- compatibility schema:
  `6ac932f6796d08f9f022837d81fe6627e7be7257c3f95326da093fda961301c4`;
- request schema:
  `005c90fab2a9d1537d059c5d22d6370ab0a586e4aa184e197c7d934214718255`;
- response schema:
  `bd3529b70d0ba3560ffa63c8bb01cad7945a34880fde5e5f1cbbed14cc6f3368`;
- batch schema:
  `f49a37a8ec21260d94b9c4924037237a7fb07278d4cd08320d16c696faedf46a`.

## Live automatic runtime proof

The exact old loopback process was verified as `node runtime/server.js` and
safely replaced from PID 26448 with PID 31044. Automatic report
`curriculum-20260718114816904-20f455cad919` records:

- handoff batch `reasoning-handoff-graph-e892a17be6dd49a06248`;
- 39 eligible contracts and 25 exact edges;
- 25 direct and 19 composed routes;
- 44 exact routes selected, zero route mismatch;
- zero handoff training receipts and zero world actions;
- contract curriculum still 39/39 with 8/8 held-out transfer;
- reasoning cycle still `reasoning-skill-307f60e944693d127e4a`;
- 85/85 metamorphic invariants;
- `lastError=null` and `learnedWeights=false`.

The report file SHA-256 is
`38bea1c687678bc5fc2b6b14259d71b3a3b8dbd07b79de9b67beb699cd2fbd38`.
Token learning remains separately `HOLD_REPAIR` because its 6,826-token corpus
is below the 50,000-token broad-language evidence gate.

## Live authenticated route proof

Inside explicit session `session-8430ce26a247eebf1040770f`, the route request
asked for `ui-ux-builder` to `game-hub` at maximum depth two. Response digest
`f8f5535dcb8d722761714c65e8dbcc66eaf5baaed6bb5df7604877634a77c060`
returned one route:

```text
ui-ux-builder
  -- axm.uiux-workspace/v1 --> studio
  -- axm.game-asset/v1 -----> game-hub
```

- route ID: `handoff-route-e0cf356968da139de124`;
- reasoning session: `reasoning-4fbe298973e22117271d3a3e`;
- state: `REVIEWABLE_PROPOSAL_NOT_EXECUTED`;
- source batch reused: true;
- active runtime changed: false;
- world, tool, training, permission, semantic, canon, and identity authority:
  false;
- session closed: true;
- memory writes: 0.

## Fresh Learning Shell proof

Shell session `learning-shell-mrqb0e44-5c0e7401` completed all seven stages and
recorded:

- graph batch reused: true;
- eligible contracts / exact edges: 39/25;
- direct / composed routes: 25/19;
- exact routes / incompatible decoys: 44/44;
- route mismatch / training receipts / world actions: 0/0/0;
- private reasoning cycle reused and remained `PROPOSE_HUMAN_REVIEW`;
- token cycle reused and remained `HOLD_REPAIR`;
- runtime pointer changed: false.

Its session file SHA-256 is
`7df48f37ecc32b072aef1541bf46b92878d55dd4badd6cdd54b8862f6caab6b3`.

## Verification

- Handoff Compatibility Cell and Handoff Graph focused tests: 4/4;
- focused runtime, BOM, organ, Workshop, and Shell integration: PASS;
- Mirror core full suite: 94/94;
- Mirror Learning Forge full suite: 99/99;
- AXM Native Learning Shell full suite: 6/6;
- current route-session hashes: 44/44;
- compatibility and decoy receipt verification: 69/69;
- deterministic unchanged-batch reuse: PASS;
- changed-contract new-batch growth: PASS;
- structural batch tamper after recomputed outer digest: REFUSED;
- individual session tamper: REFUSED;
- live automatic wake: PASS;
- live authenticated route and explicit close: PASS;
- final public health: PID 31044, current handoff batch present, no last error,
  learned weights absent, and zero route mismatches, training receipts, or world
  actions;
- fresh seven-stage Shell route: PASS;
- Forge build integrity: 148/148 files, local/default-deny boundaries intact;
- Mirror Doctor: PASS;
- Node JSON parse sweep: 823/823 documents;
- `git diff --check`: PASS;
- sampled graph batch, graph session, runtime token, and Shell session ignore
  checks: 4/4;
- outside-network use by tests or training: none;
- routed Workshop modules invoked: none;

The paired machine audit records these results and the content hashes.

## Changed surfaces

This milestone adds the Contract Handoff Compatibility Cell, Handoff Graph
Organ, four schemas, a direct runner, an authenticated route endpoint, automatic
Workshop and Learning Shell integration, runtime health counters, API and
training-policy boundaries, Model BOM and Doctor coverage, module contract and
manifest declarations, focused and integration tests, status and documentation,
this report, and the paired machine audit.

Private graph batches, sessions, runtime logs, tokens, datasets, learned models,
checkpoints, and Shell sessions remain ignored local state. No file was staged
or committed.

## Known limits and next evidence gate

- Exact interface equality is necessary for these routes but not sufficient for
  semantic suitability, successful execution, availability, or human intent.
- The organ does not yet reason over `consumes`, permissions, write boundaries,
  runtime health, costs, quality, or recovery requirements.
- Exact equality is deliberately strict; compatible aliases, schema evolution,
  adapters, subtyping, and migrations are not inferred.
- Composition stops at depth two and excludes cycles. Longer valid workflows
  are not proposed.
- Multiple compatible routes are ordered by depth and stable route ID, not by a
  learned or evidence-backed goal-specific utility function.
- Generated incompatible consumers are structural counterexamples, not actual
  failed module invocations.
- Local module contracts are attributed declarations. Their exact bytes are
  evidence of what they declare, not proof that implementations honor them.
- The real batch found no route-selection mismatch, so a genuine negative graph
  failure and repair route remain unproven.
- No handoff trace trains the private strategy model. This milestone grows a
  hard-coded proposal organ, not learned open-ended planning.
- The learned strategy model remains private and inactive.
- No CANON, general planning, general reasoning, general AI, consciousness,
  safety proof, or self-directed authority is claimed.

The next honest gate is a typed relation that joins compatibility with one
additional independently checkable constraint—permission, required input,
runtime availability, or recovery—without inferring semantics from names. A
repeated real route failure could also earn a narrow adapter or migration exam.
Neither route may authorize code installation or module execution by itself.
