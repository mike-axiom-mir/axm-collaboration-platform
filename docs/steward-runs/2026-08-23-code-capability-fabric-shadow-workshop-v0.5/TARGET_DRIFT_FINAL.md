# Final canonical target drift recheck

Rechecked after the technical and sealed-evidence commits. The canonical
recovery checkout remained read-only.

Target observation:

- branch: `codex/workshop-recovery-fabric-integration-20260822`
- HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- status entries: 2437
- tracked: 245 modified, 0 added, 0 deleted, 0 renamed, 0 unmerged
- untracked: 2192
- path-free status digest:
  `944de77cf02bb06935fd0e9951b516c3d556bb28816b3317746e0a7c7944c7ac`

The target gained one untracked entry during closeout while HEAD stayed fixed.
That is direct evidence that the recovery checkout is still moving and must not
be used as an integration worktree.

Evidence-tip comparison:

- evidence tip: `090b062361baa19cbfadcd91cbf33f2cf436619d`
- merge base: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`
- target-only/source-only commits: 7 / 17
- object-level merge-tree exit: 0
- synthetic tree: `6d34faa5c0f7eb832abac223acd9b7fdc99918f3`

Technical-commit comparison:

- technical commit: `6fb342894d98c3f606d79a9f48225c658a0dfab4`
- object-level merge-tree exit: 0
- synthetic tree: `badade4377a5bb77c6a7821149c3c7e3e4f45a11`

The merge-tree results prove only commit-object compatibility with the current
target HEAD. They do not account for the 2437 uncommitted entries and do not
authorize merge or overwrite.

## Exact safe handoff after Mike selects a settled target

Run from the canonical repository only after its recovery work is committed or
otherwise settled:

```powershell
if (git status --porcelain) { throw 'Canonical target is not clean; do not integrate.' }
$SelectedTarget = git rev-parse HEAD
git worktree add ../workshop-shadow-integration-review -b codex/code-capability-fabric-shadow-integration $SelectedTarget
git -C ../workshop-shadow-integration-review cherry-pick 6fb342894d98c3f606d79a9f48225c658a0dfab4 090b062361baa19cbfadcd91cbf33f2cf436619d
```

Then rerun the required and focused checks in the new review worktree. Mike
reviews that diff and decides whether to merge. The shadow service cannot
perform this handoff itself.

