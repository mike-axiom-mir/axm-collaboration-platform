# Integration handoff

Status: `TEST` branch ready for review; not merged, promoted, or canonized.

## Source

- Branch: `codex/code-capability-fabric-code-family-extension-base-v2.0`
- Selected base: `7dd800d09731607b2936b580ab972d8033801736`
- Implementation commit: `7979a6f8b8814fa572240598a02d2a33d27056b8`
- Tracked generated-view seal commit: `1433ef0651a744e4734d6f903977aa489ec0d3ab`
- Receipt commit: the later branch head reported in the steward closeout; it
  adds only this append-only evidence directory.

## Target assumption

The intended target remains branch `codex/workshop-active-clean-20260823` at
`7dd800d09731607b2936b580ab972d8033801736`. This assumption must be rechecked
immediately before integration. A different head, branch, dirty checkout, or
index lock means stop and review the drift.

## Review route

Review the complete branch diff from the selected base, especially:

- the build-profile schemas, catalog, registry, and module contract;
- the v1.9 builder/request/result lineage and consent changes;
- both focused adversarial suites;
- deterministic generated City/schema/twin updates; and
- this steward-run evidence.

From the canonical Workshop checkout, the safe integration action is:

```powershell
$expectedTargetBranch = 'codex/workshop-active-clean-20260823'
$expectedTargetHead = '7dd800d09731607b2936b580ab972d8033801736'
$sourceBranch = 'codex/code-capability-fabric-code-family-extension-base-v2.0'
if ((git branch --show-current) -ne $expectedTargetBranch) { throw 'unexpected target branch' }
if ((git rev-parse HEAD) -ne $expectedTargetHead) { throw 'target drifted; review again' }
if (git status --porcelain) { throw 'target checkout is dirty' }
if (Test-Path -LiteralPath '.git/index.lock') { throw 'target index is locked' }
git log --oneline "$expectedTargetHead..$sourceBranch"
git diff --check "$expectedTargetHead..$sourceBranch"
git merge --ff-only $sourceBranch
```

The command is a recommendation for Mike's explicit review action, not an
authorization for this steward task to merge. If target drift is observed,
rebase or rebuild on a new review branch and rerun the full checks; do not
overwrite the busy checkout.
