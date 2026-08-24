# Python PR49 Intake Integration Handoff

## Current review state

- Source branch:
  `codex/code-capability-fabric-python-pr49-intake-v1.9`
- Source Fabric parent:
  `84aa4e2d3899806e2469fec174d84274ad45dd7a`
- PR49 source head:
  `6132a8d0c15604ffb0360d2e2abe0a3485217a16`
- Transplanted payload head:
  `dbea6c187ed8e2a76f4284561c26ae1b9c2d35f5`
- Intended canonical review target:
  `codex/workshop-active-clean-20260823`
- Canonical target observed before final recheck:
  `5495eb2e7f13689ce3a066d4b8e46e90948c695d`

## What this branch adds

The branch adds only PR49's 16 new detached donor paths under
`experimental/capability-bodies/python/` plus this append-only steward receipt.
It does not add an active builder, recipe, provider, permission, executor,
installation, promotion, or CANON change.

## Safe review action

Do not merge PR49's remote branch directly into the current Fabric or canonical
Workshop; its old history creates unrelated conflicts. Review this bounded
intake branch instead:

```powershell
git diff --stat 5495eb2e7f13689ce3a066d4b8e46e90948c695d...codex/code-capability-fabric-python-pr49-intake-v1.9
git diff --name-status 5495eb2e7f13689ce3a066d4b8e46e90948c695d...codex/code-capability-fabric-python-pr49-intake-v1.9
git merge-tree --write-tree 5495eb2e7f13689ce3a066d4b8e46e90948c695d codex/code-capability-fabric-python-pr49-intake-v1.9
```

Run these commands from the canonical Workshop checkout after verifying its
branch and cleanliness. The last command is a read-only merge simulation. A real merge is authorized
only after Mike selects a clean target and reviews any drift/conflicts. No
merge, push, overwrite, promotion, or CANON action was performed here.

## Later active-wiring route

When the remaining language donors arrive, create a new branch from the
Mike-selected integrated Fabric target. First admit only a small pure/static
Python contract and provider descriptor. Keep the archive runtime inert until
rights are resolved and a separately repaired executor is explicitly
authorized and verified.
