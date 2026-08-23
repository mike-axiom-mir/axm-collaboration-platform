# Canonical target drift before evidence closeout

The canonical recovery checkout remained read-only.

Observed target:

- branch: `codex/workshop-recovery-fabric-integration-20260822`
- HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- status entries: 2436
- tracked entries: 245 modified, 0 added, 0 deleted, 0 renamed, 0 unmerged
- untracked entries: 2191
- path-free status digest:
  `e848b15fad27d194adc968e7b18597bd30a594851d84a471eb95640bac336332`

Compared with technical source commit
`6fb342894d98c3f606d79a9f48225c658a0dfab4`:

- merge base: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`
- target-only commits: 7
- source-only commits: 16
- commit-object merge-tree exit: 0
- synthetic tree: `badade4377a5bb77c6a7821149c3c7e3e4f45a11`

The clean object-level merge-tree is not permission to modify the dirty target
checkout. Recovery activity expanded substantially since the earlier 507-entry
snapshot. Integration is held until Mike selects a settled target and the
target is rechecked.

Portable review route after a settled target is selected:

```powershell
git status --short
git rev-parse HEAD
git worktree add ../workshop-shadow-integration-review -b codex/code-capability-fabric-shadow-integration <selected-target-commit>
git -C ../workshop-shadow-integration-review cherry-pick 6fb342894d98c3f606d79a9f48225c658a0dfab4
```

Do not run this against the busy canonical checkout and do not merge without
Mike's decision.

