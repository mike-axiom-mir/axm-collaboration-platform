# Evidence Matrix

| Atomic claim | Evidence used | Result | Limit |
|---|---|---|---|
| PR49 head is exact | GitHub PR metadata plus fetched `origin/pr-49` | PASS at `6132a8d0c15604ffb0360d2e2abe0a3485217a16` | Says nothing about runtime safety |
| Donor ZIP matches its checkpoint | Git blob bytes and SHA-256 | PASS at `8b4d20cdd97960a2c552d130d37ea81d04e05e77b3388822a67b53cac3b90a6f` | Integrity is not trust or rights |
| Archive is internally intact | ZIP CRC plus 167 internal SHA-256 entries | PASS | Does not prove semantic correctness |
| Archive entry paths are statically portable | Canonical in-memory entry-name scan | PASS | Runtime-generated paths remain separate |
| Included documents are structurally readable | JSON/TOML parsers | PASS | Schema conformance was not claimed |
| Included Python has parseable syntax | Python AST parse of 107 files | PASS | Files were not imported, compiled, or run |
| No obvious embedded credential pattern | Bounded text-pattern scan | PASS | Not a complete secret or privacy audit |
| Runtime is permissionless | Source and manifest review | FAIL for active wiring | It declares writes, analyzers, sandbox tests, and subprocess surfaces |
| Runtime is Windows-ready | Source review of `resource`, `preexec_fn`, and path handling | UNKNOWN / HOLD | No Windows donor execution occurred |
| Runtime preserves private evidence boundaries | Receipt-field source review | HOLD | Raw stdout/stderr and machine locations are retained |
| Direct reuse is authorized | PR/archive rights inventory | HOLD | No sufficient license or rights grant found |
| Existing Workshop Fabric remains continuous | 29 Fabric selftests plus focused continuity suites | PASS | Proves current reviewed branch only |
| Full required Workshop verification passes | Ten `AGENTS.md` commands | PASS with 21 warnings | No browser or Python donor runtime evidence |
| Donor is installed or active | Registry/catalog/worktree diff | FALSE | Intake is detached data only |
| CANON changed | Git diff and lifecycle review | FALSE | Mike remains merge gate |
