# Integration Handoff

## Exact source and target assumption

- Source branch:
  `codex/code-capability-fabric-markup-specialist-candidate-v1.8`
- Technical source: `8349261328b47121c8dd937c9b55daa23f4c6a6a`
- Assumed target branch: `codex/workshop-active-clean-20260823`
- Assumed target commit:
  `e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037`
- The target is an ancestor of the technical source through the existing v1.7
  lineage join.
- Exact technical payload: 427 paths; UTF-8 LF path-set SHA-256
  `21484edf9705b1fbb03d7f93863c739a78ee88a0ff8f1abe5f8d42c17fd2e5da`.

## Safe review action

Do not merge in the canonical checkout. Re-check the exact target and create a
separate clean review worktree:

```powershell
$expectedTarget = "e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037"
$sourceCommit = "<evidence-closure commit from TARGET_DRIFT_ADDENDUM.md>"
$targetCommit = git -C $targetRepo rev-parse HEAD
$targetState = @(git -C $targetRepo status --porcelain)
if ($targetState.Count -ne 0) { throw "Target is busy; do not integrate here." }
if ($targetCommit -ne $expectedTarget) { throw "Target drifted; repeat merge-tree review." }
git -C $targetRepo worktree add -b codex/code-specialist-markup-v1.8-integration-review $reviewPath $targetCommit
git -C $reviewPath merge --no-ff --no-commit $sourceCommit
```

Review the complete 427-path inventory, rerun the 29 Fabric tests, focused
Capability/Organ/City/schema tests, an actual browser/accessibility journey if
visual claims are desired, and all ten required `AGENTS.md` commands. Mike then
decides whether to commit the integration merge.

Candidate execution, installation, publication, promotion, and CANON are not
part of this review action. The exact evidence-closure source and final target
re-check are appended separately so this sealed technical receipt is not
rewritten.

