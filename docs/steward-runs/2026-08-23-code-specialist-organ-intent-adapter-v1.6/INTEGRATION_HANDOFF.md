# Integration Handoff

## Source and assumptions

- Source branch: `codex/code-capability-fabric-code-specialist-organ-intent-adapter-v1.6`
- Technical source commit: `8b2fbc3f9f0911fe8c9cdbf05a111b4439198489`
- Source lineage join: `36235effcfec4d11923d8a87a12eeb76cc552c1b`
- Join parents: canonical selection
  `0f54e9db45679a2f5405e393a1236ebcaf75a4fa` and reviewed v1.5
  `76abb8c6532fef4e0af2f0851d4559b1dee275d1`.
- Assumed target branch: `codex/workshop-active-clean-20260823`.

## Target drift observed before sealing

The target advanced during this run to
`74cdd057b258a49a1bafce6c2ad295e87bdd5215` and was busy with 21 uncommitted
Capability Fabric paths. None of those uncommitted paths overlapped the source
payload at this observation, but a busy checkout is not an integration target.

The source and target now diverge from merge base
`0f54e9db45679a2f5405e393a1236ebcaf75a4fa`. A read-only merge-tree check found
no committed source-source collisions; it found expected conflicts in 13
generated index/City paths because both branches regenerated them from different
source sets. Those generated files must be rebuilt from the combined tree, not
resolved by choosing an older side.

## Exact safe review route

Do not run these commands in the busy canonical checkout. After its work is
committed or moved and Mike selects the new exact target commit, create a clean
review worktree and re-check drift:

```powershell
$targetCommit = git -C $targetRepo rev-parse HEAD
git -C $targetRepo status --short
git -C $targetRepo worktree add -b codex/code-specialist-organ-intent-v1.6-integration-review $reviewPath $targetCommit
git -C $reviewPath merge --no-ff --no-commit 8b2fbc3f9f0911fe8c9cdbf05a111b4439198489
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

The final source tip will include this receipt after its evidence-only commit;
use that final tip instead of the technical commit if Mike wants the steward-run
evidence in the integration review. Re-check target drift again immediately
before that review action.

