# Post-integration canonical local-state repair

- Status: `TEST`
- Date: 2026-08-24
- Repair commit: `2f52dd7dc8373c4c0d246638f9ee1fea50244d33`
- Parent integration receipt commit: `459ba18ddb737174d2283c8bab5ab0967918d15a`
- Target branch for the repair fast-forward: `codex/workshop-active-clean-20260823`
- Target head re-observed: `459ba18ddb737174d2283c8bab5ab0967918d15a`
- Target tracked/untracked status entries: 0
- Target Git index lock present: false

## Observation

After the first exact fast-forward, the canonical Git tree matched the integration branch and the focused Fabric suites passed, but canonical-local `node verify.js` reported 9 City generated-view failures. The same commit in the clean integration worktree reported `0 FAIL · 25 warn`.

Read-only comparison isolated two modules whose ignored local state was entering the City source digest:

- `ai-habitat`: one local bridge-token file under its runtime state.
- `challenge-arena`: one test-cache file plus 60 local workspace/demo records.

No token content was read, retained, copied, deleted, or committed. No Challenge Arena local record was changed or removed.

## Repair

`shared/city-graph/city-map-host.js` now excludes explicitly local/cache directories (`.pytest_cache`, `__pycache__`, and `workspace`) and secret/log filenames (`bridge-token.txt`, `bridge_token.txt`, `bridge.log`, and `workshop.log`) from source discovery.

`shared/city-graph/selftest.js` now proves that those local artifacts cannot change the City semantic digest. The generated City, schema-registry, and twin views were rebuilt from the repaired compiler.

- City graph digest: `857d8c9d8471b523f84afc146fcb5b2d755f9c7d3616a12a5a6db3f86c3541ef`.
- Schema registry digest: `4d89c30962a8a68cb1e698fe7239e14987a50bf2395dad23150ef452cce3d8c1`.
- Twin digest: `dfd2bc4a7ec6413e15dfdf7dd855698a5b6c4893abc18a7bfa7b7053aa2cdc69`.

## Verification on the repair branch

- `node shared/city-graph/selftest.js`: PASS, 33 assertions.
- `node shared/city-gates/selftest.js`: PASS, 14 assertions.
- `node shared/capability-fabric/selftest.js`: PASS, 92 checks.
- `node shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js`: PASS, 193 checks.
- `node scripts/compile-city-graph.js --check`: PASS.
- `node scripts/compile-schema-registry.js --check`: PASS.
- `node scripts/compile-twin-surfaces.js --check`: PASS.
- `node verify.js`: `0 FAIL · 25 warn`.
- `git diff --check`: PASS.

## Changed-path addendum

The earlier `CHANGED_PATHS.txt` remains append-only and records the first 470 integration paths. This repair adds exactly three final target-relative paths:

- `shared/city-graph/city-map-host.js`
- `shared/city-graph/selftest.js`
- `docs/steward-runs/2026-08-24-code-capability-fabric-python-pr49-canonical-integration-v1.9/POST_INTEGRATION_LOCAL_STATE_REPAIR.md`

The regenerated view paths were already present in the original 470-path inventory. Final unique changed-path count from the selected target base after this addendum: 473.

## Boundaries

- Browser render/click verification remains unrun for this integration; no visual claim is added.
- Python donor execution remains unrun and unauthorized.
- No provider, network, installation, publication, promotion, learning, Foundation, roots, or `CANON` action occurred.
- Existing ignored local data remains in place.

Exact guarded repair integration from the already-integrated canonical checkout:

```powershell
$axmExpectedBranch = 'codex/workshop-active-clean-20260823'
$axmExpectedHead = '459ba18ddb737174d2283c8bab5ab0967918d15a'
if ((git branch --show-current) -ne $axmExpectedBranch) { throw 'unexpected canonical branch' }
if ((git rev-parse HEAD) -ne $axmExpectedHead) { throw 'canonical target drifted' }
if (git status --porcelain) { throw 'canonical checkout is dirty' }
git merge --ff-only codex/code-capability-fabric-python-pr49-integration-v1.9
```

