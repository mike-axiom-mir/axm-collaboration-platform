# Final canonical-target drift addendum

Status: `TEST` handoff evidence only

This read-only addendum was recorded after the main steward evidence commit. It grants no merge, overwrite, installation, promotion, publication, or CANON authority.

- Feature tip checked: `66f0171ce4ea348008a1e23381c4915381fb0f39`.
- Re-observed canonical branch: `codex/workshop-recovery-fabric-integration-20260822`.
- Re-observed canonical HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`.
- Canonical checkout status: busy with 507 relative-path entries: 241 modified and 266 untracked; zero detected deletions, renames, copies, or unmerged entries.
- The complete ordered porcelain status view at observation time had SHA-256 `015d674a08309dbbd9a6e4918739cbfc7b1bb0900926df5fd9a40a07d08dc32b`. It was not retained verbatim because it is moving restoration state, not this branch's evidence.
- Merge base: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`.
- Target and feature had 7 and 14 unique commits respectively.
- A read-only `git merge-tree --write-tree --messages` simulation produced tree `afd25c17451d738b4c449aec07e8a8f60500473a` with exit code 0 and no reported textual conflict.

This proves only that those exact committed tips have a structurally mergeable Git tree. It does not test the combined runtime and cannot include, override, preserve, or approve the 507 uncommitted restoration entries. Do not integrate in that busy checkout.

At review time, create a new clean worktree from the then-current Mike-selected target, re-check target branch, HEAD, status, and merge-tree result, and stage the complete branch with:

```powershell
git merge --no-ff --no-commit codex/four-roots-adventure-gameplay-trailer-v0.4
```

Review the full prerequisite Fabric/Four Roots lineage, the 35 technical paths in `CHANGED_PATHS.txt`, and the complete branch diff. Rerun the receipt checks and live playback. Mike may then choose a reviewed merge commit or `git merge --abort`.

