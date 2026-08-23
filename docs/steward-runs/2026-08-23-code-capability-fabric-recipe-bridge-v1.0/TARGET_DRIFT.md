# Target drift snapshot after technical commit

Checked at `2026-08-23T10:50:06.6716409Z`.

- required integrated base: `ee92c1d8704642eb9b3058493f67404c3bf01100`
- source technical commit: `04a3d97f682aebf579429dae344d01c38566d793`
- observed canonical path: `D:\AXM_ACTIVE\workshop`
- observed canonical branch:
  `codex/workshop-recovery-fabric-integration-20260822`
- observed canonical HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- canonical status entries: 2,491
- tracked changes: 245
- untracked entries: 2,246
- exact dirty-path overlap with the 12 technical paths: 0
- canonical contains required base: no
- merge base: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- divergence: required-base side 32 commits; canonical side 0 commits

The canonical recovery checkout is an ancestor of, not a clean target at, the
required integrated base. Zero exact path overlap is useful evidence but does
not make a 32-commit integration safe.

Verdict: `HOLD`. Do not merge, cherry-pick, overwrite, stash, reset, promote,
or canonize in the observed canonical checkout. Review the bounded branch in a
new clean worktree after Mike selects a target containing the exact required
base.
