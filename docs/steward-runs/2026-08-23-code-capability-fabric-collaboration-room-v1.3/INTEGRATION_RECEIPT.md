# Integration Receipt — Fabric Collaboration Room v1.3

Status: `TEST` — ready for Mike review, not merged into the canonical checkout

## Immutable handoff points

- Selected clean target branch:
  `codex/workshop-code-capability-fabric-v1.2-integration-20260823`
- Required target base:
  `0f37245d9e6b446b69eb4c9debe5fc29254153ed`
- Source/evidence commit:
  `74960b9b6625f7df82f1b374750870fe708eb7d2`
- Technical commit:
  `eb6ed6bdced1b5165946bc7aa3ced586384d54c1`
- Reviewable integration branch:
  `codex/workshop-code-capability-fabric-collaboration-room-v1.3-integration-20260823`
- Relationship: two source commits, strict descendant of the required target
  base; this receipt is an additional documentation-only integration commit.

## Changed paths

New leaf tool paths under `tools/fabric-collaboration-room/`:

- `README.md`
- `app.js`
- `collaboration-decision-draft.schema.json`
- `collaboration-room-core.js`
- `index.html`
- `manifest.json`
- `module.contract.json`
- `selftest.js`
- `styles.css`

Append-only evidence paths under
`docs/steward-runs/2026-08-23-code-capability-fabric-collaboration-room-v1.3/`:

- `EVIDENCE_ROUTE.json`
- `FOUR_ROOT_GATE.json`
- `RETENTION_RECEIPT.md`
- `STEWARD_RUN_RECEIPT.md`
- `TEST_REPORT.md`
- `VISUAL_TEST_RECEIPT.md`
- `events.jsonl`
- `events.seal.json`
- `INTEGRATION_RECEIPT.md`

No existing Review Inbox, Fabric, Foundry, Mirror, Evidence Desk, Foundation,
candidate, game or `CANON` source path changes in this delta.

## Verification

- Collaboration Room: 68 focused checks passed.
- Review Inbox: 23 assertions passed.
- Review Inbox discovery seam: 14 controls passed.
- Fabric continuity: all 25 scripts passed.
- All ten `AGENTS.md` commands passed.
- `verify.js`: exit 0 with 22 warning lines.
- `verify-plus`: `VERIFIED_WITH_LIMITS`.
- Real browser: desktop and 390 × 844 visual/click journeys passed with no
  browser console errors or horizontal overflow.

Live AI/Mirror presence, authenticated identity, provider transport, candidate
execution and installation were not run and remain unproven.

## Target drift audit

Read-only audit at `2026-08-23T15:57:59+02:00`:

- canonical checkout branch:
  `codex/workshop-recovery-fabric-integration-20260822`;
- canonical checkout HEAD:
  `dadd8a9f87c2cf70a7c444244483ee853276e745`;
- canonical checkout dirty entries: `2518`;
- selected v1.2 target branch still resolves exactly to the required base;
- source/evidence delta before this receipt: `17` paths;
- exact case-insensitive overlap with canonical dirty file paths: `0`.

Every existing Review Inbox file is independently dirty in the canonical
checkout, which is why this branch uses a new leaf tool and links to the Inbox
without editing it. Zero exact overlap does not make a 2,518-entry dirty
checkout safe to mutate. The canonical checkout was not switched, merged,
reset, cleaned, overwritten, promoted or canonized.

## Exact safe review and integration route

Read-only review:

```powershell
$axmRepo = 'D:\AXM_ACTIVE\workshop'
$expectedBase = '0f37245d9e6b446b69eb4c9debe5fc29254153ed'
$integrationBranch = 'codex/workshop-code-capability-fabric-collaboration-room-v1.3-integration-20260823'
git -C $axmRepo log --oneline --decorate "$expectedBase..$integrationBranch"
git -C $axmRepo diff --stat "$expectedBase..$integrationBranch"
git -C $axmRepo diff "$expectedBase..$integrationBranch" -- tools/fabric-collaboration-room docs/steward-runs/2026-08-23-code-capability-fabric-collaboration-room-v1.3
```

Only after Mike approves, create a separate clean target worktree, re-check
exact base and cleanliness, then fast-forward:

```powershell
$axmRepo = 'D:\AXM_ACTIVE\workshop'
$reviewWorktree = 'D:\AXM_ACTIVE\workshop-fabric-collaboration-room-v1.3-review'
$targetBranch = 'codex/workshop-code-capability-fabric-v1.2-integration-20260823'
$expectedBase = '0f37245d9e6b446b69eb4c9debe5fc29254153ed'
$integrationBranch = 'codex/workshop-code-capability-fabric-collaboration-room-v1.3-integration-20260823'
git -C $axmRepo worktree add $reviewWorktree $targetBranch
if ((git -C $reviewWorktree rev-parse HEAD) -ne $expectedBase) { throw 'Target drifted; stop and review again.' }
if (git -C $reviewWorktree status --porcelain) { throw 'Target is dirty; stop without merging.' }
git -C $reviewWorktree merge --ff-only $integrationBranch
```

Rerun the receipt's checks in that clean target worktree. This remains `TEST`;
Mike and the four roots remain the integration and merge gate.
