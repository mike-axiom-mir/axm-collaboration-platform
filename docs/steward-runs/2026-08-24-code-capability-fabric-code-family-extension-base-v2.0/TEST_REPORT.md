# Test report

Status: `TEST`

## Focused results

- `selftest-code-specialist-build-profile-registry-v1.js`: 53 PASS, 0 FAIL.
- `selftest-code-specialist-capability-builder-v1.js`: 202 PASS, 0 FAIL.
- All `shared/code-capability-fabric/selftest*.js`: 30 files PASS, 0 failed.
- JSON parse for all added/changed profile, request, result, and module-contract records: PASS.
- `git diff --check`: PASS.

Adversarial coverage includes unknown modes and languages, Python recipe gaps,
language/specialist mismatch, specialist and recipe digest drift, forged recipe
catalog digest, inactive and ambiguous versions, duplicate modes and bindings,
profile/catalog digest drift, permission/network/execution/install/`CANON`
expansion, Tier-1 profile and profile-catalog consent drift, recipe substitution,
candidate tampering, resource ceilings, Windows drive/UNC/ADS/reserved-name/
case aliases, and unsupported-lane fallback.

## Required AGENTS checks

All 10 required commands passed:

1. `node verify.js` — `0 FAIL · 25 warn`.
2. `node hub/hub-selftest.js` — PASS.
3. `node hub/route-selftest.js` — PASS.
4. `node hub/graft-selftest.js` — PASS.
5. `node hub/skin-selftest.js` — PASS.
6. `node hub/verify-plus.js` — PASS.
7. `node tests/html-script-syntax-test.js` — 57 PASS, 0 FAIL.
8. `node tests/tool-forge-package-test.js` — PASS; transient package cleaned; installed false.
9. `node tools/agent-tool-forge/selftest.js` — 17 PASS, 0 FAIL.
10. `node tools/evidence-desk/selftest.js` — 36 PASS, 0 FAIL.

The first pre-rebuild `verify.js` run reported `10 FAIL · 25 warn`, all ten
failures being deterministic City/schema generated-view drift caused by adding
the new contracts. After an explicit rebuild, a post-implementation-commit
check exposed nine City views compiled while the new shared module was still
untracked. Rebuilding at the tracked source boundary and committing those
views produced the final clean result above.

Final generated identities:

- City graph: `0054f181f124c60789e7c11e9afb781d6e0182281cdc81ab9fd5b163484c2715`.
- Schema registry: `ed3a68b5537b79ce5ca33988c7bd432c6bdb2007b89ef7feafdd1d1a5c84f9ac`.
- Twin surfaces: `9d3641645a259661652b53f23496eb6c2d3e13cb40c8352e170573fe797df22c`.

## Warnings and unrun work

The 25 known-open warnings are preserved: 20 game QA/recovery/overlay items,
one legacy manifest-kind backlog item, and four promotion claims needing
reverification. They were visible in both the first and final verifier runs of
this steward branch; this bounded run did not attempt to repair them.

- Browser render/click: N/A; no visual surface changed.
- New-family/Python candidate generation: unrun and unavailable because no
  exact admitted recipe exists.
- Supplied Python experimental runtime: unrun and unauthorized.
- Generated candidate/selftest execution: unrun in this steward run.
- Installation, integration, publication, promotion, lesson admission,
  physical actuation, Foundation mutation, roots mutation, and `CANON`: unrun.
- Optional third-party Python `jsonschema` validation was unavailable locally;
  repository JSON parsing, schema compilation/indexing, and focused contract
  tests passed without installing a dependency.
