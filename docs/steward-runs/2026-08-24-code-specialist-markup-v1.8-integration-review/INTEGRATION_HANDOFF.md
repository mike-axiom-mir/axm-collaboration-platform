# Integration Handoff

## Reviewed source and target

- Review branch: `codex/code-specialist-markup-v1.8-integration-review`
- Technical merge: `bfdaaabadf597ae487c824d3e62f6ef311acc940`
- Target assumption: `codex/workshop-active-clean-20260823` at
  `4aa2097aa1145109a801ae76d3ee9ce7d1bb7a57`
- The target is the first parent and direct ancestor of the technical merge.
- Technical payload: 435 paths; path-set SHA-256
  `69a241e29c21bc5c0dc26b99294d285aca96048c54c7064da9c0f559d45dfc28`.

## Safe Mike-controlled action

The evidence-closure source and final target re-check will be recorded in
`TARGET_DRIFT_ADDENDUM.md`. If that addendum still reports the target clean and
unchanged, review in a fresh detached worktree before any canonical update:

```powershell
$expectedTarget = "4aa2097aa1145109a801ae76d3ee9ce7d1bb7a57"
$sourceCommit = "<evidence-closure commit from TARGET_DRIFT_ADDENDUM.md>"
$targetCommit = git -C $targetRepo rev-parse HEAD
$targetState = @(git -C $targetRepo status --porcelain)
if ($targetState.Count -ne 0) { throw "Target is busy; stop." }
if ($targetCommit -ne $expectedTarget) { throw "Target drifted; repeat review." }
git -C $targetRepo worktree add --detach $reviewPath $expectedTarget
git -C $reviewPath merge --ff-only $sourceCommit
```

Rerun the listed focused suites and all required checks in that detached review
tree. Mike may then choose an explicit fast-forward of the canonical branch.
No installation, adapter activation, publication, promotion, or CANON action is
included in this handoff.

