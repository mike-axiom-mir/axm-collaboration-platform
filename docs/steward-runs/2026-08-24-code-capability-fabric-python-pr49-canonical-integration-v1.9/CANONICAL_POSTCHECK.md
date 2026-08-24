# Canonical post-integration verification

- Status: `TEST`
- Date: 2026-08-24
- Verified canonical branch: `codex/workshop-active-clean-20260823`
- Verified subject commit: `4081337198c9390b22e582ee6aa7799af33dc9ef`
- Canonical tracked/untracked status entries after verification: 0
- Canonical tree matched `codex/code-capability-fabric-python-pr49-integration-v1.9` exactly.

## Required checks

All ten required `AGENTS.md` commands passed against the canonical checkout:

- `node verify.js`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js`
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js`
- `node tools/evidence-desk/selftest.js`

`verify.js` reported `0 FAIL · 21 warn`. `hub/verify-plus.js` also reported `0 FAIL · 21 warn`, with 6 added, 27 resolved, 1 changed, and 14 unchanged known-open warnings relative to its recorded baseline.

## Generated-view checks

- `node scripts/compile-city-graph.js --check`: PASS at graph digest `857d8c9d8471b523f84afc146fcb5b2d755f9c7d3616a12a5a6db3f86c3541ef`.
- `node scripts/compile-schema-registry.js --check`: PASS at registry digest `4d89c30962a8a68cb1e698fe7239e14987a50bf2395dad23150ef452cce3d8c1`.
- `node scripts/compile-twin-surfaces.js --check`: PASS at twin digest `dfd2bc4a7ec6413e15dfdf7dd855698a5b6c4893abc18a7bfa7b7053aa2cdc69`.

The ignored local bridge-token, test-cache, and Challenge Arena workspace data remained present during this successful canonical verification. Their bytes were not read as City source after the repair.

## Boundaries and final path count

- No GitHub push was performed or required.
- No browser render/click claim was added.
- No Python donor or experimental executor was run.
- No install, provider, network, publication, promotion, learning, Foundation, roots, or `CANON` action occurred.
- This receipt adds one path to the 473 paths recorded through the repair addendum. Final unique changed-path count from selected target base: 474.

