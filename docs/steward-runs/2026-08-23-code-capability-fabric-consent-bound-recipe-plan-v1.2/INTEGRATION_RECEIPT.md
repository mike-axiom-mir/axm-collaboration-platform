# Integration Receipt — Consent-Bound Recipe Planning v1.2

Status: `TEST` — ready for Mike review, not merged into the canonical checkout

## Immutable handoff points

- Selected clean target branch:
  `codex/workshop-code-capability-fabric-v1.1-integration-20260823`
- Required target base:
  `bedd499795f7fe7591fad109e52aef50479f82fb`
- Source/evidence commit:
  `af8f61c97a65f5ed47c7762de1967ece3525b68d`
- Reviewable integration branch:
  `codex/workshop-code-capability-fabric-v1.2-integration-20260823`
- Relationship: two commits, strict descendant of the required target base.

## Changed paths

Fabric paths:

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/README-code-recipe-application-planner-v1.md`
- `shared/code-capability-fabric/code-recipe-application-planner-v1.js`
- `shared/code-capability-fabric/code-recipe-application-request.schema.json`
- `shared/code-capability-fabric/code-recipe-application-plan.schema.json`
- `shared/code-capability-fabric/module-code-recipe-application-planner-v1.contract.json`
- `shared/code-capability-fabric/selftest-code-recipe-application-planner-v1.js`

Append-only steward evidence paths under
`docs/steward-runs/2026-08-23-code-capability-fabric-consent-bound-recipe-plan-v1.2/`:

- `CAPABILITY_DECISION.md`
- `EVIDENCE_ROUTE.json`
- `FOUR_ROOT_GATE.json`
- `RETENTION_RECEIPT.md`
- `STEWARD_RUN_RECEIPT.md`
- `TEST_REPORT.md`
- `capability-gap-report.json`
- `capability-inventory.json`
- `capability-requirements.json`
- `events.jsonl`
- `events.seal.json`
- `INTEGRATION_RECEIPT.md`

No existing Foundry catalog, Foundation, Code Mirror, RepairBuddy, candidate,
game, or `CANON` path changes in this delta.

## Verification on the integration branch

- 25 of 25 Fabric selftest scripts passed.
- v1.2 focused suite passed 87 checks.
- Code Recipe Foundry passed 61 checks.
- Code Recipe Foundry discovery seam passed.
- All ten `AGENTS.md` commands passed.
- `verify.js` exited zero with 22 warning lines.
- JavaScript syntax and diff whitespace checks passed.
- Browser render/click: N/A and not run because no visual surface changed.
- No experimental runtime, generated candidate, or supplied package executed.

The warnings are the clean integration-target baseline and remain unresolved;
they were not converted into passes or repaired outside this bounded scope.

## Target drift audit

Read-only audit at `2026-08-23T14:24:54+02:00`:

- canonical checkout branch:
  `codex/workshop-recovery-fabric-integration-20260822`;
- canonical checkout HEAD:
  `dadd8a9f87c2cf70a7c444244483ee853276e745`;
- canonical checkout dirty entries: `2506`;
- selected v1.1 target branch still resolves exactly to the required base;
- v1.2 delta before this receipt: `18` paths;
- exact case-insensitive overlap with canonical dirty file paths: `0`.

Zero exact path overlap is useful review evidence, but it does not make a
2,506-entry dirty checkout safe to mutate. The canonical checkout was not
switched, merged, reset, cleaned, overwritten, promoted, or canonized.

## Exact safe review and integration route

First inspect the immutable delta without changing a checkout:

```powershell
$axmRepo = 'D:\AXM_ACTIVE\workshop'
$expectedBase = 'bedd499795f7fe7591fad109e52aef50479f82fb'
$integrationBranch = 'codex/workshop-code-capability-fabric-v1.2-integration-20260823'
git -C $axmRepo log --oneline --decorate "$expectedBase..$integrationBranch"
git -C $axmRepo diff --stat "$expectedBase..$integrationBranch"
git -C $axmRepo diff "$expectedBase..$integrationBranch" -- shared/code-capability-fabric docs/steward-runs/2026-08-23-code-capability-fabric-consent-bound-recipe-plan-v1.2
```

Only after Mike approves the review, create a separate clean target worktree,
re-check exact base and cleanliness, then fast-forward:

```powershell
$axmRepo = 'D:\AXM_ACTIVE\workshop'
$reviewWorktree = 'D:\AXM_ACTIVE\workshop-code-capability-fabric-v1.2-review'
$targetBranch = 'codex/workshop-code-capability-fabric-v1.1-integration-20260823'
$expectedBase = 'bedd499795f7fe7591fad109e52aef50479f82fb'
$integrationBranch = 'codex/workshop-code-capability-fabric-v1.2-integration-20260823'
git -C $axmRepo worktree add $reviewWorktree $targetBranch
if ((git -C $reviewWorktree rev-parse HEAD) -ne $expectedBase) { throw 'Target drifted; stop and review again.' }
if (git -C $reviewWorktree status --porcelain) { throw 'Target is dirty; stop without merging.' }
git -C $reviewWorktree merge --ff-only $integrationBranch
```

Rerun the receipt's checks in that clean target worktree before any later route
to the canonical recovery branch. Fast-forwarding this review target is still
not `CANON`; Mike remains the final merge gate.
