# v0.8 test report

Status: `PASS` for the bounded `TEST` planner.

## Focused verification

- New bounded creation program planner: 52/52 adversarial cases passed.
- Every `shared/code-capability-fabric/selftest*.js` script: 21/21 passed.
- Direct organ continuity: 5/5 passed:
  - deterministic-json-core;
  - Hand Specification Foundry;
  - Hand Specification Foundry discovery seam;
  - Hand Forge Bridge;
  - Review Inbox.

The focused suite covers deterministic input reordering, artifact DAGs,
dependency cycles, arbitrary domains, missing and ambiguous routes, provider and
schema drift, forged route digests, permission/network/resource intersections,
root holds, tier escalation, reuse-rights holds, physical actuation, explicit AI
identity, human taste, privacy, byte budgets, strict output validation, and
self-consistent re-digested contradictions.

## Required AGENTS.md checks

All ten commands passed:

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

`verify.js` and `hub/verify-plus.js` each reported 0 failures and retained 22
warning lines: 17 pending physical-phone game checks, four promotion claims
needing current selftest evidence, and one stale generated tools index.

## Separate or unrun surfaces

- Browser render/click: N/A because no visual surface changed.
- Provider execution: not run.
- Candidate or artifact generation: not run.
- Domain verifiers, games, media renderers, sandbox, training, or hardware: not
  run.
- Authenticated human decisions: not run or fabricated.
- Installation, integration, publication, promotion, and `CANON`: not run.

The trusted repository selftests are implementation verification. They are not
execution of uploaded or generated candidate runtimes.
