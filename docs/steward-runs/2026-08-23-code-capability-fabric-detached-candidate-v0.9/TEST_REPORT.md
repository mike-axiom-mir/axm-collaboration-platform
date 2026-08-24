# v0.9 test report

Status: `PASS` for the bounded `TEST` materializer.

## Focused verification

- New semantic candidate materializer: 80/80 adversarial cases passed.
- Existing semantic candidate generator: 104/104 passed.
- Existing slow creation pilot: 40/40 passed.
- Existing human candidate selection binder: 35/35 passed.
- Existing bounded-intent planner: 52/52 passed.
- Existing Code Capability readiness: 46/46 passed.
- Every `shared/code-capability-fabric/selftest*.js` script: 22/22 passed.
- Deterministic JSON core and Detached Candidate Nursery: passed, including 19
  Nursery checks.
- Ten direct organ-continuity scripts passed across Code Recipe Foundry, Review
  Inbox, Evidence Desk, Hand Specification Foundry, Hand Forge Bridge, and their
  discovery seams.

The new suite covers closed schemas, deterministic preparation, exact-byte
binding, separate Ed25519 decision and revocation keys, wrong keys, forged and
drifted subjects, stale/future decisions, HOLD/REJECT, every supported
revocation class, permission and lifecycle expansion, real detached writes,
readback, Nursery inspection, byte tampering, resource totals, path-free
receipts, self-consistent re-digested contradictions, replay after discard or
failure, existing roots, fault cleanup, missing ledgers, root-name drift,
protected-root overlap, dot aliases, and Windows junction boundaries.

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

`verify.js` exited zero and retained exactly 22 warning lines: 17 pending
physical-phone game checks, four promotion claims needing current selftest
evidence, and one stale generated tools index. These are the pre-existing
baseline and were not repaired or hidden by this run.

## Separate or unrun surfaces

- Browser render/click: N/A because no visual surface changed.
- AI challenger materialization: refused and not run.
- Candidate code execution: not run; generated candidate code was never
  imported.
- Runtime, visual, accessibility, quality, persistence, and transport behavior:
  not run or claimed.
- Natural-person identity, informed understanding, independently trusted time,
  and global replay protection: not proven.
- Sandbox, installation, integration, publication, learning, training, physical
  actuation, promotion, and `CANON`: not run.

The trusted repository selftests created disposable temporary fixtures to test
the host materializer. They did not execute uploaded or generated candidate
runtimes.
