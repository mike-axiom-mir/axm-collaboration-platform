# Integration Handoff

## Exact source and target assumption

- Source branch: `codex/code-capability-fabric-schema-specialist-candidate-v1.7`
- Technical source: `2a07ae6044cea00e8054888cfe00e805f6cef6d9`
- Assumed target branch: `codex/workshop-active-clean-20260823`
- Rechecked target: `e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037`
- Target state at the technical checkpoint: clean.
- The target is a direct ancestor of the source through join commit
  `cf80edcd3cea16d0167bdec46cc3281eb84d5600`; no conflict is expected for the
  recorded source/target pair.

## Safe review action

Do not merge in the canonical checkout. Re-check the exact target and create a
separate clean review worktree:

```powershell
$expectedTarget = "e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037"
$sourceCommit = "2a07ae6044cea00e8054888cfe00e805f6cef6d9"
$targetCommit = git -C $targetRepo rev-parse HEAD
$targetState = @(git -C $targetRepo status --porcelain)
if ($targetState.Count -ne 0) { throw "Target is busy; do not integrate here." }
if ($targetCommit -ne $expectedTarget) { throw "Target drifted; repeat merge-tree review." }
git -C $targetRepo worktree add -b codex/code-specialist-capability-v1.7-integration-review $reviewPath $targetCommit
git -C $reviewPath merge --no-ff --no-commit $sourceCommit
```

Review the complete diff and the path inventory, rerun the 29 Fabric tests,
focused Capability/Organ/City/schema tests, and all ten required `AGENTS.md`
commands. Mike then decides whether to commit the integration merge. Candidate
execution, installation, promotion, publication, and CANON are not part of this
integration action.

The evidence-closure commit and a final target re-check will be recorded in a
separate addendum so the verified technical commit remains exact.

