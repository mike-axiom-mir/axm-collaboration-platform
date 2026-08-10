# Deterministic PR Base Refresh

This shared module binds a stale checkpointed review branch to one exact newer
`main` commit. Planning may fetch immutable Git objects and create unreachable
merge-analysis objects, but it does not move refs or edit the worktree.

Application requires an exact confirmation and creates one local, non-rewriting
merge commit with fixed identity and a timestamp derived from its parents. It never pushes, edits a pull request, writes
`main`, force-updates history, promotes, changes roots, or changes CANON.
