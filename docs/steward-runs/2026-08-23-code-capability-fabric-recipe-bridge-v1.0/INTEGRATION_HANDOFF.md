# Integration handoff

Status: `TEST` / direct integration `HOLD`

Mike remains the final merge gate. This handoff is a review route, not approval,
promotion, or `CANON`.

## Source and target assumptions

- source worktree:
  `D:\AXM_ACTIVE\workshop-code-capability-fabric-v0.9-integration`
- source branch: `codex/code-capability-fabric-recipe-bridge-v1.0`
- required target base:
  `ee92c1d8704642eb9b3058493f67404c3bf01100`
- technical commit: `04a3d97f682aebf579429dae344d01c38566d793`
- sealed-evidence commit: `394d88f57c2d7e2ed188740141cffe1cec861ae9`
- target must be clean and contain the required base
- source commits must be present in the local object database or fetched from a
  reviewed ref/bundle
- integration must happen in a new sibling review worktree, never in the busy
  canonical checkout

The current canonical recovery checkout fails the clean-state and ancestry
assumptions. See `TARGET_DRIFT_FINAL.md`.

## Changed implementation paths

The technical commit changes only these 12 paths:

- `shared/code-capability-fabric/README-code-recipe-fabric-bridge-v1.md`
- `shared/code-capability-fabric/README-semantic-candidate-generator-v1.md`
- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/code-recipe-fabric-bridge-v1.js`
- `shared/code-capability-fabric/code-recipe-selection-packet.schema.json`
- `shared/code-capability-fabric/code-recipe-selection-request.schema.json`
- `shared/code-capability-fabric/module-code-recipe-fabric-bridge-v1.contract.json`
- `shared/code-capability-fabric/module-semantic-candidate-generator-v1.contract.json`
- `shared/code-capability-fabric/selftest-code-recipe-fabric-bridge-v1.js`
- `shared/code-capability-fabric/selftest-semantic-candidate-generator-v1.js`
- `shared/code-capability-fabric/semantic-candidate-generator-v1.js`
- `shared/code-capability-fabric/semantic-generation-request.schema.json`

The evidence commit adds only the append-only receipt set under this steward-run
directory. Code Recipe Foundry catalog bytes, Mirror, RepairBuddy, Foundation,
registries, and executors are unchanged.

## Verified source result

- 68/68 new bridge adversarial checks passed
- 104/104 semantic generator checks passed
- 80/80 semantic materializer checks passed
- all 23 Fabric selftest scripts passed
- Code Recipe Foundry 61/61 plus discovery seam passed
- all ten required `AGENTS.md` commands passed
- `verify.js`: exit 0, 0 failures, 22 warnings
- `hub/verify-plus.js`: exit 0, 0 failures, 22 warnings
- browser render/click: N/A; no visual surface changed
- snippet/provider/Mirror/RepairBuddy/candidate/sandbox execution: not run
- install, integration, learning, promotion, and `CANON`: not run

The 22 retained warnings are 17 pending physical-phone QA notices, four
promotion claims needing current selftest evidence, and one stale generated
tools-index notice.

## Exact guarded review route

Run this only after `D:\AXM_ACTIVE\workshop` is the clean Mike-selected target
and contains the required integrated base. If run against its currently
recorded state, the first guard intentionally stops. Any failed guard is a
`HOLD`; do not force, stash, reset, or overwrite around it.

```powershell
$targetRepo = 'D:\AXM_ACTIVE\workshop'
$requiredBase = 'ee92c1d8704642eb9b3058493f67404c3bf01100'
$technicalCommit = '04a3d97f682aebf579429dae344d01c38566d793'
$evidenceCommit = '394d88f57c2d7e2ed188740141cffe1cec861ae9'
$reviewBranch = 'codex/review-code-capability-fabric-recipe-bridge-v1.0'
$reviewWorktree = 'D:\AXM_ACTIVE\workshop-code-recipe-bridge-v1.0-review'

$dirtyState = @(git -C $targetRepo status --porcelain=v1 --untracked-files=all)
if ($dirtyState.Count -ne 0) { throw 'HOLD: selected target is not clean' }

git -C $targetRepo merge-base --is-ancestor $requiredBase HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: selected target lacks required v0.9 integrated base' }

git -C $targetRepo cat-file -e "$technicalCommit`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: technical commit is unavailable' }
git -C $targetRepo cat-file -e "$evidenceCommit`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: evidence commit is unavailable' }

git -C $targetRepo diff --check "$requiredBase..$evidenceCommit"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: source diff check failed' }
if (Test-Path -LiteralPath $reviewWorktree) { throw 'HOLD: review path exists' }
git -C $targetRepo show-ref --verify --quiet "refs/heads/$reviewBranch"
if ($LASTEXITCODE -eq 0) { throw 'HOLD: review branch exists' }

git -C $targetRepo worktree add $reviewWorktree -b $reviewBranch HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: review worktree creation failed' }
git -C $reviewWorktree cherry-pick $technicalCommit $evidenceCommit
if ($LASTEXITCODE -ne 0) { throw 'HOLD: cherry-pick needs human review' }

git -C $reviewWorktree diff --check HEAD~2..HEAD
git -C $reviewWorktree status --short --branch
```

Then rerun the ten required checks plus:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-fabric-bridge-v1.js
node shared/code-capability-fabric/selftest-semantic-candidate-generator-v1.js
node shared/code-capability-fabric/selftest-semantic-candidate-materializer-v1.js
node tools/code-recipe-foundry/selftest.js
node tools/code-recipe-foundry/discovery-seam-review.js
```

Review the two commits and preserved limitations there. Mike may accept,
request repair, or reject the review branch. Integration into the selected
target is a later explicit Mike action. Immediately before that decision,
repeat the clean-state and ancestry guards because this handoff cannot freeze
the target.
