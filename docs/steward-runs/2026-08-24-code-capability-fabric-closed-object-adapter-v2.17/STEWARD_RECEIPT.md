# Steward receipt — strict closed-object contract adapter v2.17

Status: `TEST`

This append-only receipt seals one bounded creation-capability growth rung. The
run began on 2026-08-24 and closed on 2026-08-25 Europe/Amsterdam time. It does
not install, integrate, publish a product, promote, merge, or canonize the
result.

## Lineage and review

- Branch: `codex/code-capability-fabric-closed-object-adapter-v2.17`
- Technical source commit:
  `ddc95e8d21b76d85133e310e8d362ac04d817cba`
- Exact parent:
  `72d74569ea569f229e8d768ac3a7a62a6ac92ee9`
- Stacked target:
  `codex/code-capability-fabric-bounded-javascript-transform-v2.16`
- Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/67>
- Target review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/66>

At technical publication, the remote v2.16 branch and PR66 head both matched
the exact parent. PR66 was open, draft, and clean/mergeable. The canonical
Workshop checkout was separately observed clean at
`7dd800d09731607b2936b580ab972d8033801736` and remained untouched.
Publication used the separate clean guarded worktree under
`D:\AXM_ACTIVE\publish`.

## What changed

The Fabric can now deterministically emit one detached strict adapter from one
declared closed flat primitive object contract to another. Its configuration
requires explicit map/rename/default/drop rules: every source property must be
mapped or dropped, every target property must be mapped, defaults must satisfy
the target property, and only widening structural compatibility is accepted.
Successful output proves the declared target shape, not domain meaning.

The new active builder is `closed-object-contract-adapter-v2`; the recipe is
`closed-object-contract-adapter@0.2.0`. The runtime accepts only ordinary plain
or null-prototype records with own enumerable primitive data properties. It
refuses arrays, null, custom prototypes, symbols, hidden fields, accessors
without invoking getters, undeclared fields, unsupported values, excess
properties, and independently measured input/output byte excess. It does not
delegate record measurement to `JSON.stringify` or `Buffer` and contains no
filesystem, process, network, provider, environment, clock, randomness,
dynamic-code, or lifecycle surface.

Active example ceilings are 16 properties, 2048 input bytes, and 256 output
bytes. A focused trusted-test host executes the exact emitted selftest only
from a byte-verified temporary copy disjoint from detached source.

One exact profile,
`code-family.closed-object-contract-adapter`, binds JavaScript,
`organ.code.application-logic`, the `javascript-contract-adapter` artifact,
the recipe, builder, consent subject, zero authority, and evidence route. The
profile registry now allows multiple abilities for the same specialist and
language only when mode, recipe, builder, artifact, and profile bindings are
all exact and distinct. Duplicate exact bindings and cross-profile
substitutions fail closed.

Historical `closed-object-contract-adapter-v1` remains byte-identical inactive
review material:

- Proposal: `sha256:65a4fbfab2452f0e2c6a8fbff0f873f2b58f6b6cb7f0f533cbe1a260f9f151d1`
- Builder: `sha256:52cd33877d3791af9b1a1e795945a9d4eeafaa835fa774926b1adc037f32fa43`

It was not rewritten or silently activated. Admission replay is now a typed
`RECIPE_ID_ALREADY_ACTIVE` no-effect hold and projects no replacement recipe,
catalog, registry, or activation.

Exact v2 lineage:

- Builder: `sha256:2b60372be00c2393b09a5f5d6543faf46c7a5064d6482036ecccc95e8317af23`
- Recipe: `sha256:6b324dfba5162dd6a588803d2539fa6cf16013b580569d8f99d51d5f1895eef8`
- Recipe catalog: `sha256:d080e6b7ad16637e6019459930f0ebf6095f3dced3dfa7547781613bcbcc9b5f`
- Specialist profile: `sha256:12e9198ecb5ea08ad06e6d54a2d0f634c8e640483608f60fee54d054e60fd555`
- Build-profile catalog: `sha256:e674676e558508d10658c2b8cfa0965a060c59fb25fecac5b48f82142a1bfa32`
- Direct Fabric candidate: `sha256:99e8bd4ef8537737a1ed57ff8b244de53a9b342957e9f51e819813bf4b2a6a09`
- Specialist candidate: `sha256:c2d49c3c805c954a897f876ab62ce0cd036694696a0a0c36bc668a6dad75f92f`

The capability-gap comparator moved this exact rung from `BLOCKED` with four
missing capabilities to `READY` with none missing. It does not claim a general
adapter, nested schema transformation, arbitrary JavaScript, or universal code
creation capability.

## Authority, privacy, and resource boundary

The candidate remains `EXPERIMENTAL`, detached, uninstalled, and unexecuted by
the Code Specialist Fabric. It has no provider, network, workspace,
filesystem, environment, process, installation, integration, publication,
promotion, merge, or `CANON` authority. It does not modify Foundation or Atlas.

Durable evidence contains digests, verdicts, bounded measurements, and public
test summaries only. Temporary fixture source and process output were not
retained as durable private evidence. The trusted fixture route does not
authorize the general repaired executor.

## Four-root evaluation

- Truth: `PASS` for exact bytes, lineage, deterministic rebuilding, the closed
  record and mapping rules, active resource ceilings, and tested refusals.
  Hostile Proxy behavior and domain semantics remain `UNKNOWN`.
- Agency / non-domination: `PASS`; the adapter cannot approve, execute,
  install, integrate, publish, promote, merge, or canonize itself and receives
  no permissions.
- Continuity: `PASS`; the exact v2.16 parent, historical v1 evidence, strict v2
  builder/recipe/profile/candidate lineage, projections, and deterministic
  rebuilds are bound and checked.
- Wisdom over speed: `PASS`; the rung hardens the existing adapter thesis,
  preserves the weaker historical proposal, and adds one narrow reusable seam
  rather than an arbitrary executor.

These technical passes make the branch reviewable. They do not replace Mike's
final hold, rejection, or merge decision.

## Verification and warnings

All ten required `AGENTS.md` checks passed. Focused results include 14 strict
adapter checks, 334 builder assertions, 81 profile assertions, 167 shared
Fabric checks, 15 tool checks, 27 admission checks, 126 package checks, 28
composition checks, 44 Foundry selftest checks, 47 Foundry package checks, and
51/51 recursive Code Capability Fabric entry points.

Final `verify.js`: `0 FAIL · 25 warn · spine b618c5762240070c`. The inherited
warnings remain visible: 20 game-evidence gaps, one legacy `UNDECLARED`
manifest-kind item, and four promotion-claim reverification warnings. An
earlier final-state attempt honestly failed with `9 FAIL · 26 warn` because the
tools index and nine City projections were stale after late source changes;
the declared projections were regenerated and the entire required suite was
rerun to the passing final result. Exact results and unrun surfaces are in
`TEST_REPORT.md`.

## Holds and decisions still owned by Mike

- Direct reuse or public copying of research-derived/generated source remains
  `HOLD` until rights are evidenced.
- A repaired disposable general executor remains unauthorized.
- Hostile Proxies, arbitrary host objects, nested schemas, domain semantics,
  general JavaScript, provider use, workspace execution, installation,
  integration, product publication, promotion, merge, and `CANON` remain
  separate capabilities or decisions.

The no-surprise review and possible later fast-forward route is recorded in
`INTEGRATION_HANDOFF.md`. Target drift must be checked again at decision time.
