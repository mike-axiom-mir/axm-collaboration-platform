# Recipe discovery v1.1 integration receipt

Status: `TEST`

Integrated at: `2026-08-23T11:47:16.0363795Z`

## Exact route

- previous clean integration branch:
  `codex/workshop-code-capability-fabric-v1.0-integration-20260823`
- exact previous checkpoint:
  `adced3cb807dc530de95c2177faeffafc5f34141`
- source branch: `codex/code-capability-fabric-recipe-discovery-v1.1`
- exact reviewed source tip:
  `f2e9b10e16a1225ac5da96a3fd6909f80ec0aeca`
- bounded technical commit:
  `268b6d44b95801db39889fbf724652b467c6d306`
- new clean integration branch:
  `codex/workshop-code-capability-fabric-v1.1-integration-20260823`
- integration worktree:
  `D:\AXM_ACTIVE\workshop-code-capability-fabric-v1.0-integration`
- integration method: exact Git fast-forward from the preserved v1.0 checkpoint
  to the reviewed source tip

The source and integration refs matched exactly before this receipt was added.
The previous v1.0 checkpoint was not rewritten. The busy canonical checkout was
not switched, stashed, reset, overwritten, or merged.

## Integrated paths

The exact v1.0-checkpoint-to-source diff contains 15 paths:

- seven Fabric paths: implementation, two schemas, module contract, focused
  selftest, focused README, and the Fabric index README;
- eight append-only run-evidence paths under
  `docs/steward-runs/2026-08-23-code-capability-fabric-recipe-discovery-v1.1/`.

Code Recipe Foundry, Code Mirror, RepairBuddy, Foundation, and `CANON` source
paths are unchanged.

## Integrated capability and holds

The Fabric can now discover exact installed Foundry recipes by bounded metadata
and return separate eligible and held evidence without source snippets. It
cannot choose a recipe, infer semantic fitness, authorize direct reuse, execute
source, call a provider, generate or install a candidate, integrate itself,
promote, or change `CANON`.

PR46 remained donor data. No PR46 runtime or selftest was executed and no donor
commit was merged. Its useful idea was independently adapted behind the stricter
installed-lineage and four-root contracts.

## Verification on the integration branch

After the fast-forward:

- all 24 Code Capability Fabric selftest scripts passed;
- the new discovery suite passed 73 checks;
- Code Recipe Foundry passed 61 checks and its discovery seam passed;
- all ten required `AGENTS.md` commands exited 0;
- `verify.js` and `hub/verify-plus.js`: `0 FAIL · 22 warn`, spine
  `b618c5762240070c`;
- HTML script syntax: 55 pass, 0 fail;
- Agent Tool Forge: 17 pass, 0 fail;
- Evidence Desk: 36 pass, 0 fail.

Browser render/click was N/A because no visual surface changed. No recipe,
provider, PR donor, Code Mirror, RepairBuddy, sandbox, candidate, or experimental
runtime was executed.

## Canonical target drift recheck

At `2026-08-23T11:47:16.0363795Z` the canonical checkout was:

- path: `D:\AXM_ACTIVE\workshop`
- branch: `codex/workshop-recovery-fabric-integration-20260822`
- head: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- status entries: 2,501
- dirty entries under this Fabric/evidence scope: 0
- relationship: canonical head is an ancestor of the v1.1 integration tip
- canonical-head-to-source delta: 302 paths

The ancestry permits a future fast-forward, but 2,501 concurrent status entries
make a merge into that checkout unsafe now. The canonical checkout therefore
remains untouched.

## Exact Mike review and guarded integration route

Review the bounded v1.1 delta without changing the canonical checkout:

```powershell
git -C D:\AXM_ACTIVE\workshop diff --stat adced3cb807dc530de95c2177faeffafc5f34141 f2e9b10e16a1225ac5da96a3fd6909f80ec0aeca
git -C D:\AXM_ACTIVE\workshop diff adced3cb807dc530de95c2177faeffafc5f34141 f2e9b10e16a1225ac5da96a3fd6909f80ec0aeca -- shared/code-capability-fabric docs/steward-runs/2026-08-23-code-capability-fabric-recipe-discovery-v1.1
```

Only after the canonical recovery work is clean and Mike selects this target,
recheck ancestry and status, then fast-forward exactly:

```powershell
git -C D:\AXM_ACTIVE\workshop merge-base --is-ancestor HEAD codex/workshop-code-capability-fabric-v1.1-integration-20260823
git -C D:\AXM_ACTIVE\workshop status --short
git -C D:\AXM_ACTIVE\workshop merge --ff-only codex/workshop-code-capability-fabric-v1.1-integration-20260823
```

The first command must exit 0 and the second must print nothing. If either
condition changes, stop and review the new drift instead of merging.

This integration branch is a clean local Workshop review target under `TEST`.
It is not canonical installation, promotion, publication, or `CANON`. Mike
remains the final merge gate.
