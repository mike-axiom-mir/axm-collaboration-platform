# Final target drift snapshot

Checked after the technical and sealed-evidence commits at
`2026-08-23T09:24:06.8330673Z`.

- required integrated base: `6e3a014a08acb23614ff3a72eab1ce8d266f1b99`
- source technical commit: `1cc64239b4a88e50c9ac52f95d0a36f9376ccfdb`
- source sealed-evidence commit: `ff592419f6f8f91092d2262eade57696d7c71139`
- observed recovery branch: `codex/workshop-recovery-fabric-integration-20260822`
- observed recovery HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- recovery status entries: 2,476
- tracked changes: 245
- untracked entries: 2,231
- exact dirty-path overlap with the 23 v0.9 implementation/evidence paths: 0
- recovery target contains the required v0.8 base in its ancestry: no
- merge base with the required v0.8 base:
  `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`
- divergence from the required v0.8 base: 7 recovery-only commits and 27
  v0.8-side commits

The recovery checkout remained on the same commit between the first and final
checks, while its large dirty state remained present. Zero exact dirty-path
overlap is useful evidence, but it does not make a direct merge safe.

Verdict: `HOLD`. Do not merge, cherry-pick, overwrite, promote, or canonize in
the observed recovery checkout. Use the guarded review route only after Mike
selects a clean target containing the exact required base.
