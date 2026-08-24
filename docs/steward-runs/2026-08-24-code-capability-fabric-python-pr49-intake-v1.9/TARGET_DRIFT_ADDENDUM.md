# Target Drift Addendum

Status: `HOLD`

Date: 2026-08-24

This append-only addendum records the final canonical-target recheck after the
Python intake receipt was committed.

## Exact observations

- Source intake commit:
  `ae11e7e3b28b450eca61e14b23f411b8007d5531`
- Canonical target branch:
  `codex/workshop-active-clean-20260823`
- Canonical target commit:
  `5495eb2e7f13689ce3a066d4b8e46e90948c695d`
- Canonical target worktree status: clean.
- The source and target are worktrees of the same Git repository; the source
  branch is already visible to the canonical checkout without a push.
- Target drift since the prior Fabric review base is one commit:
  `Harden reviewed object adapter candidate`.

## Read-only merge simulation

The exact simulation was:

```powershell
git merge-tree --write-tree --name-only 5495eb2e7f13689ce3a066d4b8e46e90948c695d ae11e7e3b28b450eca61e14b23f411b8007d5531
```

Result: conflict (`exit 1`) on 14 paths:

```text
docs/generated/LEGO_CITY_BEGINNER_MAP.md
docs/generated/LEGO_CITY_MAP.md
registry/generated/city-authority-map.json
registry/generated/city-capabilities.jsonl
registry/generated/city-dependencies.json
registry/generated/city-graph.json
registry/generated/city-graph.receipt.json
registry/generated/city-modules.json
registry/generated/city-proof-map.json
registry/generated/city-schemas.json
registry/generated/city-twins.json
registry/generated/city-unresolved-edges.json
shared/capability-fabric/builder-registry.js
tools-index.json
```

The sole authored conflict is
`shared/capability-fabric/builder-registry.js`. The other conflicts are derived
City views or the generated tools index and must be regenerated from the
reviewed combined authored source rather than chosen wholesale from either
branch.

## Exact safe later-integration action

Do not merge in the canonical checkout. When Mike selects this intake for the
next combined language-body review:

1. Create a new clean review worktree and branch from exact target
   `5495eb2e7f13689ce3a066d4b8e46e90948c695d`.
2. Merge exact source `ae11e7e3b28b450eca61e14b23f411b8007d5531`
   with `--no-ff --no-commit`.
3. Reconcile the authored builder registry so the target's hardened object
   adapter state and the source's reviewed active builders are both preserved.
   The Python donor itself stays detached and absent from the active registry.
4. Regenerate the City graph, schema registry, twin surfaces, beginner maps,
   and tools index from the combined authored state.
5. Run the complete focused Fabric continuity suite and all ten `AGENTS.md`
   commands before committing the integration review.
6. Stop for Mike review. Do not install, promote, publish, or CANON.

Because more language donors are expected, this reconciliation is intentionally
deferred rather than repeated for each incoming PR.
