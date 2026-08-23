# Integration handoff

Status: `TEST` / direct integration `HOLD`

Mike remains the final merge gate. This handoff is a review route, not approval,
promotion, or `CANON`.

## Source and target assumptions

- source branch: `codex/code-capability-fabric-bounded-intent-v0.8`
- required target base:
  `248c0b446d610eb18e708fa1a7561052a54b2fc3`
- technical commit: `97475f0d28c824f09a2d2bfd16f856517e83a0e0`
- sealed-evidence commit: `ba54bad1d0f77e1043491832f24f1bb59e3a630e`
- target must be clean and contain the required base
- source commits must be present in the local object database or fetched from a
  reviewed bundle/ref
- integration must happen in a new sibling review worktree, never in a busy
  canonical checkout

The current recovery checkout does not meet these assumptions. See
`TARGET_DRIFT_FINAL.md`.

## Changed paths

The technical commit changes only:

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/README-bounded-creation-program-planner-v1.md`
- `shared/code-capability-fabric/bounded-creation-program-planner-v1.js`
- `shared/code-capability-fabric/bounded-creation-program-request.schema.json`
- `shared/code-capability-fabric/bounded-creation-program.schema.json`
- `shared/code-capability-fabric/module-bounded-creation-program-planner-v1.contract.json`
- `shared/code-capability-fabric/selftest-bounded-creation-program-planner-v1.js`

The evidence commit adds the append-only receipt set under this steward-run
directory. It changes no runtime or governance surface.

## Verified source result

- 52/52 new adversarial planner cases passed
- all 21 Fabric selftest scripts passed
- 5 direct continuity scripts passed
- all 10 required `AGENTS.md` commands passed
- `verify.js`: exit 0, 0 failures, 22 warnings
- `hub/verify-plus.js`: exit 0, 0 failures, 22 warnings
- browser render/click: N/A; no visual surface changed
- generated candidates, providers, domain runtimes, sandbox execution, model
  training, and hardware actuation: not run

The 22 retained warnings are 17 physical-phone QA notices, 4 promotion
reverification notices, and 1 stale tools-index notice.

## Exact guarded review route

Run this only from the clean Mike-selected target checkout. Any failed guard is
a `HOLD`; do not work around it by force, stash, reset, or path overwrite.

```powershell
$requiredBase = '248c0b446d610eb18e708fa1a7561052a54b2fc3'
$technicalCommit = '97475f0d28c824f09a2d2bfd16f856517e83a0e0'
$evidenceCommit = 'ba54bad1d0f77e1043491832f24f1bb59e3a630e'
$reviewBranch = 'codex/review-code-capability-fabric-bounded-intent-v0.8'
$reviewWorktree = '..\workshop-fabric-bounded-intent-review-v0.8'

$dirtyState = @(git status --porcelain=v1 --untracked-files=all)
if ($dirtyState.Count -ne 0) { throw 'HOLD: selected target is not clean' }

git merge-base --is-ancestor $requiredBase HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: selected target lacks required v0.7 base' }

git cat-file -e "$technicalCommit`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: technical commit is unavailable' }
git cat-file -e "$evidenceCommit`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: evidence commit is unavailable' }

git diff --check "$requiredBase..$evidenceCommit"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: source diff check failed' }
if (Test-Path -LiteralPath $reviewWorktree) { throw 'HOLD: review path exists' }
git show-ref --verify --quiet "refs/heads/$reviewBranch"
if ($LASTEXITCODE -eq 0) { throw 'HOLD: review branch exists' }

git worktree add $reviewWorktree -b $reviewBranch HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: review worktree creation failed' }
git -C $reviewWorktree cherry-pick $technicalCommit $evidenceCommit
if ($LASTEXITCODE -ne 0) { throw 'HOLD: cherry-pick needs human review' }

git -C $reviewWorktree diff --check HEAD~2..HEAD
git -C $reviewWorktree status --short --branch
```

Then rerun every required `AGENTS.md` check plus the v0.8 planner selftest in
the review worktree. Compare the two commits and test evidence there. Mike may
accept, repair, or reject the review branch. Integration into the selected
target is a later explicit Mike action.

Immediately before that decision, repeat the clean-state and
`merge-base --is-ancestor` guards because this handoff cannot freeze the target.
