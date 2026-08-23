# Code Capability Fabric recipe-discovery steward-run receipt

Status: `TEST`

Source branch: `codex/code-capability-fabric-recipe-discovery-v1.1`

Clean base: `adced3cb807dc530de95c2177faeffafc5f34141`

Bounded technical commit: `268b6d44b95801db39889fbf724652b467c6d306`

PR46 donor observed head: `08eff74b35a3ac19e76093bd53116038063199a5`

## Outcome

The Fabric now has a permissionless metadata-discovery rung over the exact
installed 1,000-entry Code Recipe Foundry catalog. A closed, byte-bounded
request binds purpose, query criteria, catalog, syntax audit, Foundry contract,
resource envelope, four ordered root decisions, and zero authority.

The deterministic evidence packet:

- scans exactly the installed 1,000-record catalog;
- returns eligible and structurally held matches separately;
- emits recipe metadata plus exact snippet SHA-256 and byte length, never
  snippet source;
- preserves parse-only, unsupported-context, and unavailable-verifier states;
- uses binary mechanical ordering, not locale order, popularity, semantic
  inference, recommendation, or quality rank;
- always emits `selection: null`;
- keeps reuse rights at `RESEARCH_ONLY_HOLD` and direct reuse false;
- reports zero processes, network, cost, writes, candidate generation, install,
  integration, promotion, or `CANON` effect.

Using a discovered identity requires a new exact v1.0 recipe-selection request.
Discovery cannot create or approve that request.

## Donor decision

GitHub PR46 was statically inspected as data and was not checked out, executed,
installed, fetched into this branch, or merged. Its bounded metadata-query,
held-result separation, and snippet-omission ideas were useful. The donor code
itself remains a direct-reuse hold because rights are unresolved and its local
contracts were weaker than the installed-lineage bridge.

The local implementation independently adapts the idea and adds exact installed
catalog/audit/contract verification, four-root request evidence, closed records,
binary ordering, resource measurements, deterministic installed-byte rebuild,
an explicit selection gap, and an explicit direct-reuse hold.

## Changed technical paths

The bounded technical commit changed 12 paths with 1,279 insertions:

- `shared/code-capability-fabric/code-recipe-discovery-v1.js`
- `shared/code-capability-fabric/code-recipe-discovery-request.schema.json`
- `shared/code-capability-fabric/code-recipe-discovery-evidence-packet.schema.json`
- `shared/code-capability-fabric/module-code-recipe-discovery-v1.contract.json`
- `shared/code-capability-fabric/selftest-code-recipe-discovery-v1.js`
- `shared/code-capability-fabric/README-code-recipe-discovery-v1.md`
- `shared/code-capability-fabric/README.md`
- this run's donor review, capability decision, requirements, inventory, and
  generated capability-gap report under
  `docs/steward-runs/2026-08-23-code-capability-fabric-recipe-discovery-v1.1/`.

Code Recipe Foundry, Code Mirror, RepairBuddy, Foundation, and `CANON` source
paths were not modified.

## Capability gap

The standard capability comparator reports the required bounded-discovery
requirement `READY`. Its overall label is `DEGRADED` only because optional
automatic semantic selection is unavailable. That optional gap is intentional
and was not implemented: mechanical evidence must not silently become a
meaning-bearing choice or an authority grant.

## Verification

All checks ran in
`D:\AXM_ACTIVE\workshop-code-capability-fabric-v1.0-integration` on the source
branch after the final technical edits:

- JSON parsing: 6 new JSON records passed;
- Node syntax: implementation and focused selftest passed;
- new discovery focused suite: 73 checks passed;
- all 24 Code Capability Fabric selftest scripts passed;
- existing exact recipe bridge: 68 checks passed;
- Code Recipe Foundry: 61 checks passed;
- Code Recipe Foundry discovery seam passed;
- all ten required `AGENTS.md` commands exited 0;
- `verify.js`: `0 FAIL · 22 warn`, spine `b618c5762240070c`;
- `hub/verify-plus.js`: `0 FAIL · 22 warn`, same spine;
- HTML script syntax: 55 pass, 0 fail;
- Agent Tool Forge: 17 pass, 0 fail;
- Evidence Desk: 36 pass, 0 fail.

The 22 verifier warnings remain visible. They concern pre-existing reverification
and stale-index surfaces and were not repaired by this bounded run.

## Unrun and unproven

- Browser render/click: N/A; no visual surface changed.
- PR46 test suite: not run; donor source was not executed.
- recipe snippets and experimental runtimes: not run.
- provider, AI, Code Mirror, RepairBuddy, sandbox, generated candidate, install,
  publication, promotion, learning, and physical actuation paths: not run.
- recipe quality, semantic fitness, source claims, reuse rights, runtime behavior,
  correctness, security, and safety remain unproven by metadata discovery.

## Authority and deferred decisions

This run authorizes no execution or lifecycle action. Mike's source-reuse-rights
decision and any future disposable-executor authorization remain deferred.
Passing tests makes this capability `TEST`, not `CANON`. The four roots remain
the technical gate and Mike remains the final merge gate.

## Workspace and handoff state

The busy canonical checkout `D:\AXM_ACTIVE\workshop` was read only. At the
closeout observation it was on
`codex/workshop-recovery-fabric-integration-20260822` at
`dadd8a9f87c2cf70a7c444244483ee853276e745` with 2,499 status entries. Its head
was an ancestor of this run's clean base, and the bounded target paths had no
dirty entries, but no merge is safe while that checkout remains busy.

The reviewed source is intended for exact fast-forward onto a new clean branch
named `codex/workshop-code-capability-fabric-v1.1-integration-20260823`. A
separate integration receipt must record the final source tip, target drift
recheck, and guarded Mike review command.

## Evidence curation

- session ID: `2026-08-23-code-capability-fabric-recipe-discovery-v1.1`
- sealed segment: `events.jsonl`
- structural seal: `events.seal.json`
- seal digest: `8ca5edf1c061c7a09c5fed6e6037e11261bfd925318753b8c99d079d26834490`
- durable events preserved: 9
- telemetry aggregation: command summaries only; repeated raw PASS lines were
  not retained in the repository
- temporary material deleted: none created by this run
- explicit retention exceptions: none
- derived views updated: capability inventory, capability-gap report, donor
  review, capability decision, and this receipt
- unclassified items and review deadline: none
- authority used: Mike's explicit request to take the PR46 contribution if
  useful and continue the bounded Fabric steward run
