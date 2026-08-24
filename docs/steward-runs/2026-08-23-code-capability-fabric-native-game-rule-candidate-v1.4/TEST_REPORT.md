# Test Report — Native Game-Rule Candidate v1.4

Status: `TEST`

## Focused and continuity checks

- `node shared/code-capability-fabric/selftest-native-game-rule-candidate-generator-v1.js`
  — PASS, 77 checks.
- `node shared/code-capability-fabric/selftest-code-recipe-application-planner-v1.js`
  — PASS, 87 checks.
- Every `shared/code-capability-fabric/selftest*.js`
  — PASS, 26 of 26 suites.

The new suite covers deterministic rebuilds, exact installed Atlas lineage,
closed schemas, strict emitted records, byte lengths and digests, source
absence, permission/network/lifecycle drift, stale consent, resource drift,
version and request ambiguity, Windows path/UNC/ADS/reserved-name/case aliases,
malformed bundle records, re-digested truth inflation, and output/file budgets.

`adapter.js` received a parse-only `vm.Script` syntax check and was never
invoked. Candidate tests remained `UNRUN`.

## Required AGENTS.md checks

All ten required commands exited `0`:

```text
node verify.js
node hub/hub-selftest.js
node hub/route-selftest.js
node hub/graft-selftest.js
node hub/skin-selftest.js
node hub/verify-plus.js
node tests/html-script-syntax-test.js
node tests/tool-forge-package-test.js
node tools/agent-tool-forge/selftest.js
node tools/evidence-desk/selftest.js
```

`verify.js`: `0 FAIL · 22 warn · spine b618c5762240070c`.

The 22 warnings are visible repository baseline warnings and were not repaired
or suppressed in this bounded lane.

## Unrun

- Candidate runtime and generated candidate tests: not run.
- Detached Candidate Nursery materialization: not implemented or run for this
  recipe.
- Disposable sandbox execution: not authorized or run for this candidate.
- Browser render/click: N/A because no visual surface changed; no visual claim
  is made.
- Installation, integration, publication, learning, promotion, and `CANON`:
  not run and not authorized.
