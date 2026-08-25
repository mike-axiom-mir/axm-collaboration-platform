# Steward receipt — bounded portable FSM definition v2.19

Status: `TEST`

This append-only receipt seals one bounded creation-capability growth rung. It
does not install, integrate, publish a product, promote, merge, or canonize the
result.

## Lineage and review

- Branch: `codex/code-capability-fabric-portable-fsm-v2.19`
- Technical source commit:
  `0a3af63d2e8118a6a66bf1df88afd0c85cf0f0bf`
- Exact parent:
  `c0d57d4ea0403b5d0932e4abf177d207bc87791b`
- Stacked target:
  `codex/code-capability-fabric-bounded-record-query-v2.18`
- Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/69>
- Target review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/68>

Immediately before technical publication, the remote v2.18 branch and PR68
head both matched the exact parent. PR68 was open, draft, and clean/mergeable.
The canonical Workshop checkout was separately observed clean at
`7dd800d09731607b2936b580ab972d8033801736` and remained untouched. Publication
used a separate clean guarded publish worktree.

The read-only deterministic checkpoint bound one commit, 42 paths, and
6,907,844 before/after bytes at digest
`6bbe43d75bc7694930ccbe8b16eed86dcb055385505bd35c4ab8785e95595c2f`;
its independent verification packet passed at digest
`519760131de62c801479396c0cdc096870555b49e904831a2804cd96b165829e`.
The checkpoint's coarse credential scan was disabled only after its first held
packet reported three false-positive `sk-` matches in generated public
metadata. That held packet was preserved outside the repository. The narrower
added-line privacy scan passed; scope, ancestry, byte binding, and path checks
remained active.

## What changed

The Fabric can now deterministically emit one detached, handler-free portable
finite-state-machine definition. The recipe is
`bounded-portable-fsm-definition@0.1.0`; its active source-reviewed builder is
`bounded-portable-fsm-definition-v1`.

The request declares an exact definition id, initial state, closed state rows,
event-to-target transitions, and explicit state, transition, and byte ceilings.
The builder rejects unknown keys, reserved identifiers, duplicate states or
events, missing targets, unreachable states, accessors, symbols, sparse or
decorated arrays, custom prototypes, and measured limit excess. It emits a
frozen `axm.game-fsm/v1` definition plus limits and composition metadata.

The emitted source contains no guards, actions, callbacks, expressions,
dynamic code, provider use, network, filesystem, process, environment, clock,
randomness, installation, integration, publication, promotion, merge, roots,
or `CANON` authority. It identifies the existing `shared/game-fsm` organ as its
runtime composition seam and does not copy or replace that runtime.

One exact profile,
`code-family.bounded-portable-fsm-definition`, binds JavaScript,
`organ.code.application-logic`, the portable-FSM artifact, recipe, builder,
consent subject, zero authority, and evidence route. The build-profile registry
now contains nine exact lanes and the Code Specialist builder reports
implementation version `2.6.0`.

Exact lineage:

- Builder: `sha256:d918384d364b2be00e6523aed02daeb5b418b5a603607c83423d83e3c1f35124`
- Recipe: `sha256:d2e860d8572c5960ee579c25389f02d3277632bbdda4e1c87af1f2a2fdd6398b`
- Recipe catalog: `sha256:7557f514bfb85f987e91c1ad06c5ffb1f69de657f6ddf7372c543e958a232425`
- Specialist profile: `sha256:b813cc4219ca1e337fce4c94f53934694bf3fa4cd425f6e26d63ea78dda0ab0f`
- Build-profile catalog: `sha256:060deca3775d440c4b515a9706fbbad060908b24d20ceb38398a004174da4ffb`
- Direct Fabric candidate: `sha256:b32dc3b086457996265b29a5f438d3d103b03511ea1af3fc6926c82bce18ef55`
- Specialist candidate: `sha256:ef9cb7b6f50ba743b370bdde98b4d3ec9a03ef93d56e0c4df0faba3ed521ba4f`
- Candidate capability source: `sha256:d8c2b00ef650f7b8903444d3b88e68947b7c4ff75d8d78dc7592986e5b1a811f`
- Candidate selftest source: `sha256:bbe6189e00f1119e2d1185e59a3fb158abce34b068c9277293f8c138c27a107e`
- Existing Game FSM runtime, unchanged: `sha256:ef7e30d9f516eff8a3772cb8b48b08a4d97c45dc938ef756a615934675a0bfc6`

The capability-gap comparator moved this exact rung from `BLOCKED` to `READY`
with no missing declared capabilities. This does not claim a finished game,
arbitrary behavior generation, autonomous coding, a general executor, or
universal creation capability.

## Authority, privacy, and resource boundary

The candidate remains `EXPERIMENTAL`, detached, uninstalled, and unexecuted by
the Code Specialist Fabric. It has no provider, network, workspace,
filesystem, environment, process, installation, integration, publication,
promotion, merge, roots, or `CANON` authority. It does not modify Foundation or
Atlas.

The focused proof byte-verified a disjoint candidate copy, ran only its exact
structural selftest in a trusted test host, and separately composed the emitted
definition with the unchanged Game FSM. Durable evidence contains digests,
verdicts, bounded measurements, and public summaries only; temporary fixture
source and raw process output were not retained.

## Four-root evaluation

- Truth: `PASS` for exact bytes, lineage, deterministic rebuilding, declared
  FSM structure, state/transition/byte ceilings, reachability, and tested
  refusals. Hostile Proxy behavior and gameplay quality remain `UNKNOWN`.
- Agency / non-domination: `PASS`; the candidate cannot approve, execute,
  install, integrate, publish, promote, merge, or canonize itself and receives
  no permissions.
- Continuity: `PASS`; the exact v2.18 parent, existing recipe/profile history,
  unchanged Game FSM runtime, generated projections, and recursive 51-entry
  suite remain bound and passing.
- Wisdom over speed: `PASS`; this is one narrow typed definition seam that
  composes with an existing organ, not a duplicate runtime, universal executor,
  hidden learner, or self-promoting system.

These technical passes make the branch reviewable. They do not replace Mike's
final hold, rejection, or merge decision.

## Verification and warnings

All ten required `AGENTS.md` checks passed. Focused results include 38 portable
FSM proof checks, 378 builder assertions, 90 profile assertions, 185 shared
Fabric checks, 15 tool checks, 27 admission checks, 150 package checks, 28
composition checks, 44 Foundry selftest checks, 47 Foundry package checks, and
51/51 recursive Code Capability Fabric entry points.

The trusted runtime trace was byte-stable across repeats:
`locked -> closed -> open -> closed -> locked`; an undeclared `KNOCK` event was
deterministically ignored. This proves only the exact fixture route.

Final `verify.js`: `0 FAIL · 21 warn · spine b618c5762240070c`. The retained
warnings are 20 game-evidence gaps and one legacy `UNDECLARED` manifest-kind
item. An additional full tools-index promotion sweep returned seven existing
product-promotion warnings outside this rung; it also reconciled stale warning
receipts, which reduced the final verifier count from the inherited baseline.
Exact results and unrun surfaces are in `TEST_REPORT.md`.

## Holds and decisions still owned by Mike

- Direct reuse or public copying of research-derived/generated source remains
  `HOLD` until rights are evidenced.
- A repaired disposable general executor remains unauthorized.
- Hostile Proxies, arbitrary host objects, handlers, guards, actions,
  expressions, gameplay quality, visual behavior, provider use, workspace
  execution, installation, integration, product publication, promotion, merge,
  and `CANON` remain separate capabilities or decisions.

The no-surprise review and possible later fast-forward route is recorded in
`INTEGRATION_HANDOFF.md`. Target drift must be checked again at decision time.
