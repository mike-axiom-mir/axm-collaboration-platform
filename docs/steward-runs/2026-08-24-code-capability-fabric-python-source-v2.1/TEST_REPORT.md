# Test report

All commands ran from
`D:\AXM_ACTIVE\workshop-code-capability-fabric-python-source-v2.1`.

## Focused Fabric checks

- `node shared/capability-fabric/selftest.js` — PASS, 112 checks.
- `node shared/code-capability-fabric/selftest-code-specialist-build-profile-registry-v1.js` — PASS, 57 checks.
- `node shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js` — PASS, 228 checks.
- Every `shared/code-capability-fabric/selftest*.js` suite — PASS, 30/30 suites.
- Modified JavaScript syntax checks and `git diff --check` — PASS.

## Required AGENTS.md checks

- `node verify.js` — PASS, `0 FAIL · 25 warn`.
- `node hub/hub-selftest.js` — PASS.
- `node hub/route-selftest.js` — PASS.
- `node hub/graft-selftest.js` — PASS.
- `node hub/skin-selftest.js` — PASS.
- `node hub/verify-plus.js` — PASS.
- `node tests/html-script-syntax-test.js` — PASS, 57 PASS / 0 FAIL.
- `node tests/tool-forge-package-test.js` — PASS.
- `node tools/agent-tool-forge/selftest.js` — PASS, 17 PASS / 0 FAIL.
- `node tools/evidence-desk/selftest.js` — PASS, 36 PASS / 0 FAIL.

Generated-view identities:

- City graph: `5438ae3630d45cbfd5e7871c3ecf6980641a7527d3c27c42b51f10a83ec9c5d4`
- Schema registry: `145fa38d16d7dc7e144bfde441c0f44622daa6cde7262eb8c4ad726c50a75766`
- Twin: `de41b28eaa94ec2b05cfa42a076a3ec9b37c6ce007465478e6a45c68bff50d07`

The 25 verifier warnings remain visible; they are pre-existing backlog on the
stacked base and were not converted into passes.

## Not run

- Generated Python candidate source and generated Python selftest.
- Any supplied experimental runtime.
- Browser render/click testing (no visual surface changed).
- Installation, integration, publication, promotion, or CANON action.

