# Integration Handoff

## Source and assumptions

- Source branch: `codex/code-capability-fabric-code-specialist-organ-intent-adapter-v1.6`
- Technical source commit: `8b2fbc3f9f0911fe8c9cdbf05a111b4439198489`
- Exact verified source commit for integration review:
  `48959aa5e091d8a8b928487ce1a223011f365ad6`
- Source lineage join: `36235effcfec4d11923d8a87a12eeb76cc552c1b`
- Join parents: canonical selection
  `0f54e9db45679a2f5405e393a1236ebcaf75a4fa` and reviewed v1.5
  `76abb8c6532fef4e0af2f0851d4559b1dee275d1`.
- Assumed target branch: `codex/workshop-active-clean-20260823`.

## Target drift observed before sealing

The target first advanced during this run to
`74cdd057b258a49a1bafce6c2ad295e87bdd5215` and was busy with 21 uncommitted
Capability Fabric paths. None of those uncommitted paths overlapped the source
payload at this observation, but a busy checkout is not an integration target.

The final re-check found that work committed, the checkout clean, and the target
advanced again to `e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037`. The exact final
observation and merge-tree result are sealed in `TARGET_DRIFT_ADDENDUM.md`.

The source and target now diverge from merge base
`0f54e9db45679a2f5405e393a1236ebcaf75a4fa`. A read-only merge-tree check found
no committed source-source collisions; it found expected conflicts in 13
generated index/City paths because both branches regenerated them from different
source sets. Those generated files must be rebuilt from the combined tree, not
resolved by choosing an older side.

## Exact safe review route

Do not run these commands in the canonical checkout. If the clean target still
equals the final observed commit and Mike selects it, create a clean review
worktree and re-check drift:

```powershell
$expectedTarget = "e20e6d4ad9efbbfe3ba0c6c4d720ef5cae1e0037"
$sourceCommit = "48959aa5e091d8a8b928487ce1a223011f365ad6"
$targetCommit = git -C $targetRepo rev-parse HEAD
$targetState = @(git -C $targetRepo status --porcelain)
if ($targetState.Count -ne 0) { throw "Target is busy; do not integrate here." }
if ($targetCommit -ne $expectedTarget) { throw "Target drifted; repeat merge-tree review." }
git -C $targetRepo worktree add -b codex/code-specialist-organ-intent-v1.6-integration-review $reviewPath $targetCommit
git -C $reviewPath merge --no-ff --no-commit $sourceCommit
```

If the merge reports only generated index/City conflicts, regenerate them from
the combined non-generated source instead of selecting either stale generated
side:

```powershell
node scripts/generate-tools-index.js
node scripts/compile-city-graph.js --write
node scripts/compile-schema-registry.js --write
node scripts/compile-twin-surfaces.js --write
git add -- tools-index.json docs/generated registry/generated
```

Any conflict outside those generated paths is new drift: stop and review it.
Then review `git diff --cached`, run the focused Fabric/Organ/Game/City checks
and every required `AGENTS.md` command, and let Mike decide whether to commit the
integration merge. Do not promote or CANON as part of this route.

The exact verified source commit already includes this steward-run receipt.
Re-check target drift again immediately before the review action.
