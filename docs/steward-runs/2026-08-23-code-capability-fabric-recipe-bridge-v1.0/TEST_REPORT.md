# Recipe bridge v1.0 test report

Status: `PASS` for the bounded `TEST` implementation.

## Focused verification

- Code Recipe Foundry → Fabric bridge: 68/68 adversarial checks passed.
- Existing semantic candidate generator: 104/104 checks passed.
- Existing consent-bound semantic materializer: 80/80 checks passed.
- Every `shared/code-capability-fabric/selftest*.js` script: 23/23 passed.
- Code Recipe Foundry: 61/61 checks passed.
- Code Recipe Foundry discovery seam: passed.

The focused suite covers deterministic ordering, duplicate/missing identity,
catalog and audit digest drift, audit mapping mismatch, structure holds,
unsupported or absent verifiers, packet and snippet byte drift, embedded-request
lineage, resource ceilings, four-root HOLD/FAIL, rights and truth inflation,
unknown fields, Windows/path aliases, semantic lineage, Review Card sources,
and unchanged generated module-bundle bytes.

## Required AGENTS.md checks

All ten commands passed after the final implementation edit:

1. `node verify.js`
2. `node hub/hub-selftest.js`
3. `node hub/route-selftest.js`
4. `node hub/graft-selftest.js`
5. `node hub/skin-selftest.js`
6. `node hub/verify-plus.js`
7. `node tests/html-script-syntax-test.js`
8. `node tests/tool-forge-package-test.js`
9. `node tools/agent-tool-forge/selftest.js`
10. `node tools/evidence-desk/selftest.js`

`verify.js` and `hub/verify-plus.js` each exited 0 with `0 FAIL · 22 warn` and
spine `b618c5762240070c`. The retained warnings are 17 pending physical-phone
QA notices, four promotion claims needing current selftest evidence, and one
stale generated tools-index notice.

## Separate or unrun surfaces

- Browser render/click: N/A; no visual surface changed.
- Recipe snippet, provider, Mirror, RepairBuddy, candidate, or sandbox execution:
  not run.
- Source/license verification and direct-reuse decision: not run or claimed.
- Installation, integration, learning, publication, promotion, and `CANON`: not
  run.

Trusted repository selftests are implementation evidence. They are not
execution of uploaded, catalog, or generated candidate runtimes.
