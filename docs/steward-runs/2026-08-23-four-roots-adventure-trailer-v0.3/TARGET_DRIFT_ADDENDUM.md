# Final canonical-target drift addendum

Status: `TEST` handoff evidence only

This read-only addendum was recorded after the main steward evidence commit. It grants no merge, overwrite, promotion, publication, or CANON authority.

- Feature tip checked: `bf22c2d5339cf20b7f8976a445ddb3619ad1b086`.
- Re-observed canonical branch: `codex/workshop-recovery-fabric-integration-20260822`.
- Re-observed canonical HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`.
- Canonical checkout was busy with twelve unrelated Foundation Planet paths:
  - `worlds/foundation-planet/README.md`
  - `worlds/foundation-planet/app.mjs`
  - `worlds/foundation-planet/core/basin-routing.mjs`
  - `worlds/foundation-planet/core/experience-protocol.mjs`
  - `worlds/foundation-planet/core/floodplain-thermal.mjs`
  - `worlds/foundation-planet/core/ocean-mouth-thermal.mjs`
  - `worlds/foundation-planet/core/river-thermal.mjs`
  - `worlds/foundation-planet/core/system-audit.mjs`
  - `worlds/foundation-planet/docs/FOUNDATION_CONTRACT.md`
  - `worlds/foundation-planet/index.html`
  - `worlds/foundation-planet/selftest.js`
  - `worlds/foundation-planet/world.manifest.json`
- Merge base: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`.
- Target and feature had 7 and 11 unique commits respectively.
- A read-only `git merge-tree --write-tree --messages` simulation produced tree `4e125d14101448f1db18ce8540532009731ebe36` with exit code 0 and no reported textual conflict.

This proves only that those exact commits have a structurally mergeable Git tree. It does not test the combined runtime and cannot override or preserve uncommitted canonical work. Do not integrate in that busy checkout.

At review time, create a new clean worktree from the then-current Mike-selected target, re-check target branch/HEAD/status, and stage the complete branch with:

```powershell
git merge --no-ff --no-commit codex/four-roots-adventure-trailer-v0.3
```

Review the full prerequisite Fabric/Four Roots lineage, rerun the receipt checks and live playback, and let Mike choose either a reviewed merge commit or `git merge --abort`.
