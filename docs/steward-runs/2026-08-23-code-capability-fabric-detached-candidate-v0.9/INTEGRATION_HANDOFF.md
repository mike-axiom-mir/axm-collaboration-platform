# Integration handoff

Status: `TEST` / direct integration `HOLD`

Mike remains the final merge gate. This is a guarded review route, not approval,
installation, promotion, or `CANON`.

## Source and target assumptions

- source branch: `codex/code-capability-fabric-detached-candidate-v0.9`
- required target base:
  `6e3a014a08acb23614ff3a72eab1ce8d266f1b99`
- technical commit: `1cc64239b4a88e50c9ac52f95d0a36f9376ccfdb`
- sealed-evidence commit: `ff592419f6f8f91092d2262eade57696d7c71139`
- target must be clean and contain the required v0.8 base
- source commits must be present in the local object database or fetched from a
  reviewed bundle/ref
- integration review must happen in a new sibling worktree, never in a busy
  canonical checkout

The current recovery checkout does not meet these assumptions. See
`TARGET_DRIFT_FINAL.md`.

## Changed paths

The technical commit changes only:

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/README-semantic-candidate-materializer-v1.md`
- `shared/code-capability-fabric/semantic-candidate-materializer-v1.js`
- `shared/code-capability-fabric/selftest-semantic-candidate-materializer-v1.js`
- `shared/code-capability-fabric/module-semantic-candidate-materializer-v1.contract.json`
- `shared/code-capability-fabric/human-decision-trust-policy.schema.json`
- `shared/code-capability-fabric/semantic-candidate-materialization-subject.schema.json`
- `shared/code-capability-fabric/authenticated-human-decision.schema.json`
- `shared/code-capability-fabric/human-decision-revocation-snapshot.schema.json`
- `shared/code-capability-fabric/authenticated-human-decision-evaluation.schema.json`
- `shared/code-capability-fabric/human-decision-replay-reservation.schema.json`
- `shared/code-capability-fabric/semantic-candidate-materialization-receipt.schema.json`

The evidence commit adds the append-only receipt set under this steward-run
directory. It changes no runtime or governance surface.

## Verified source result

- 80/80 new adversarial materializer cases passed
- all 22 Fabric selftest scripts passed
- deterministic JSON and Detached Candidate Nursery checks passed
- ten direct organ-continuity scripts passed
- all ten required `AGENTS.md` commands passed
- `verify.js`: exit 0, exactly 22 retained warnings
- browser render/click: N/A; no visual surface changed
- candidate execution, runtime behavior, AI challenger materialization,
  installation, integration, learning, training, physical actuation, promotion,
  and `CANON`: not run

The 22 retained warnings are 17 physical-phone QA notices, four promotion
reverification notices, and one stale tools-index notice.

## Exact guarded review route

Run this only from a clean Mike-selected target checkout. Any failed guard is a
`HOLD`; do not work around it with force, stash, reset, or path overwrite.

```powershell
$requiredBase = '6e3a014a08acb23614ff3a72eab1ce8d266f1b99'
$technicalCommit = '1cc64239b4a88e50c9ac52f95d0a36f9376ccfdb'
$evidenceCommit = 'ff592419f6f8f91092d2262eade57696d7c71139'
$reviewBranch = 'codex/review-code-capability-fabric-detached-candidate-v0.9'
$reviewWorktree = '..\workshop-fabric-detached-candidate-review-v0.9'

$dirtyState = @(git status --porcelain=v1 --untracked-files=all)
if ($dirtyState.Count -ne 0) { throw 'HOLD: selected target is not clean' }

git merge-base --is-ancestor $requiredBase HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: selected target lacks required v0.8 base' }

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

Then rerun every required `AGENTS.md` check, every Fabric selftest, and the v0.9
materializer selftest in the review worktree. Compare the source commits and
sealed evidence there. Mike may accept, repair, or reject the review branch.
Integration into the selected target is a later explicit Mike action.

Immediately before that decision, repeat the clean-state and
`merge-base --is-ancestor` guards because this handoff cannot freeze the target.
