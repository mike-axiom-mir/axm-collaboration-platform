# Steward receipt — bounded record query specialist v2.18

Status: `TEST`

This append-only receipt seals one bounded creation-capability growth rung. It
does not install, integrate, publish a product, promote, merge, or canonize the
result.

## Lineage and review

- Branch: `codex/code-capability-fabric-bounded-record-query-v2.18`
- Technical source commit:
  `092a201aef235e60d0c2ec36621fe003cde6fa3b`
- Exact parent:
  `1e0a81d94d658a96e0889529af66ebeb38e0e95c`
- Stacked target:
  `codex/code-capability-fabric-closed-object-adapter-v2.17`
- Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/68>
- Target review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/67>

Immediately before technical publication, the remote v2.17 branch and PR67
head both matched the exact parent. PR67 was open, draft, and clean/mergeable.
The canonical Workshop checkout was separately observed clean at
`7dd800d09731607b2936b580ab972d8033801736` and remained untouched. Publication
used a separate clean guarded publish worktree.

## What changed

The Fabric can now deterministically emit one detached JavaScript function for
a strict bounded query over a collection of closed flat records. The recipe is
`bounded-record-query@0.1.0`; its active source-reviewed builder is
`bounded-record-query-v1`.

The input schema declares only STRING, INTEGER, and BOOLEAN fields. Queries use
a bounded list of `AND` predicates, explicit stable ASC/DESC multi-key ordering,
an explicit unique projection, and an exact result limit. Equal sort keys retain
their original input index. String ordering is explicitly JavaScript UTF-16
code-unit order. The result reports scanned, matched, returned, and truncated
counts.

The builder refuses undeclared configuration, unsupported field/operator
combinations, duplicate fields, duplicate projection, unsafe integer
configuration, excess predicates/sort keys/fields/records, sparse or custom
arrays, non-closed records, accessors, symbols, hidden properties, custom
prototypes, unsupported values, and measured input/output byte excess. It does
not provide SQL, an expression evaluator, callbacks, regex, joins, grouping,
aggregation, floating point, provider calls, network, filesystem, process,
environment, clock, randomness, dynamic code, or lifecycle operations.

One exact profile,
`code-family.bounded-record-query`, binds JavaScript,
`organ.code.application-logic`, the `javascript-record-query` artifact, recipe,
builder, consent subject, zero authority, and evidence route. The build-profile
registry now contains eight exact lanes and the capability builder reports
implementation version `2.5.0`.

Exact lineage:

- Builder: `sha256:501e7ac2c984beec72a99dddfb576cd0d6b2899787d4a19881a59613e0f2b973`
- Recipe: `sha256:6e947f83cdd83775d1182165fc67f8797c56497875de94d31054febff318f69a`
- Recipe catalog: `sha256:d4055fc19f95122e4d4ec21fa445203a0c9e64681ba91c4fc69736dd3ada35c3`
- Specialist profile: `sha256:2eaf846070b5673852a8af204c38c61adcce7804de41f4f6acefaddb678d1cc3`
- Build-profile catalog: `sha256:abf75103ecf04050efc312b87fee62877a882083af2692edd890f59ba9d76d96`
- Direct Fabric candidate: `sha256:9b46531cd71772e04033c80c8164578809a89fbe8d64d7ae2eba805459b67e90`
- Specialist candidate: `sha256:036835752d624d6ac5ae9cdef842b934c75c9ef67dc05e833325a7f8f449fa97`

The capability-gap comparator moved this exact rung from `BLOCKED` with three
missing capabilities to `READY` with none missing. This does not claim a
general query engine, arbitrary JavaScript, autonomous coding, or universal
creation capability.

## Authority, privacy, and resource boundary

The candidate remains `EXPERIMENTAL`, detached, uninstalled, and unexecuted by
the Code Specialist Fabric. It has no provider, network, workspace,
filesystem, environment, process, installation, integration, publication,
promotion, merge, roots, or `CANON` authority. It does not modify Foundation or
Atlas.

Durable evidence contains digests, verdicts, bounded measurements, and public
test summaries only. Temporary fixture source and process output were not
retained as durable private evidence. The trusted fixture route does not
authorize the general repaired executor.

## Four-root evaluation

- Truth: `PASS` for exact bytes, lineage, deterministic rebuilding, declared
  query semantics, stable tie behavior, resource ceilings, and tested
  refusals. Hostile Proxy and domain semantics remain `UNKNOWN`.
- Agency / non-domination: `PASS`; the candidate cannot approve, execute,
  install, integrate, publish, promote, merge, or canonize itself and receives
  no permissions.
- Continuity: `PASS`; the exact v2.17 parent and the existing ten-recipe Fabric,
  eight specialist profiles, generated projections, and recursive 51-entry
  suite remain bound and passing.
- Wisdom over speed: `PASS`; this is one narrow typed application-logic seam,
  not a universal executor, hidden learner, or self-promoting system.

These technical passes make the branch reviewable. They do not replace Mike's
final hold, rejection, or merge decision.

## Verification and warnings

All ten required `AGENTS.md` checks passed. Focused results include 19 strict
record-query checks, 359 builder assertions, 86 profile assertions, 176 shared
Fabric checks, 15 tool checks, 27 admission checks, 138 package checks, 28
composition checks, 44 Foundry selftest checks, 47 Foundry package checks, and
51/51 recursive Code Capability Fabric entry points.

Final `verify.js`: `0 FAIL · 25 warn · spine b618c5762240070c`. The inherited
warnings remain visible: 20 game-evidence gaps, one legacy `UNDECLARED`
manifest-kind item, and four promotion-claim reverification warnings. Exact
results and unrun surfaces are in `TEST_REPORT.md`.

## Holds and decisions still owned by Mike

- Direct reuse or public copying of research-derived/generated source remains
  `HOLD` until rights are evidenced.
- A repaired disposable general executor remains unauthorized.
- Hostile Proxies, arbitrary host objects, nested schemas, SQL or expression
  semantics, provider use, workspace execution, installation, integration,
  product publication, promotion, merge, and `CANON` remain separate
  capabilities or decisions.

The no-surprise review and possible later fast-forward route is recorded in
`INTEGRATION_HANDOFF.md`. Target drift must be checked again at decision time.
