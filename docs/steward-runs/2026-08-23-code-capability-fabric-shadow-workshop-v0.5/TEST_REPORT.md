# Test report

Final result: `PASS` with warnings retained.

## Focused continuity matrix

All 23 final focused suites passed:

- all 18 `shared/code-capability-fabric/selftest*.js` suites
- Sandbox Session-1: 27 PASS, 0 FAIL
- Disposable Candidate Sandbox: 11 cases
- Workshop Shadow planner: 11 cases
- Workshop Shadow host: 14 cases
- Four Roots Adventure package: 70 assertions
- Four Roots gameplay trailer: 40 frames, 5 zones, 228 actions

One intermediate run failed because changing the existing Sandbox manifest
changed the exact ancestor digest of the first game candidate. The change was
not accepted. The Sandbox manifest, contract, and selftest were restored to
their original bytes; Workshop Shadow received a separate `TEST` tool identity;
the immutable ancestor suite then passed.

## Required AGENTS checks

All ten required commands exited 0:

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

`verify.js` reported `0 FAIL · 22 warn`. The historical intake baseline was 41
warnings, but that number was not reproduced in this source state. This run did
not attempt a general warning repair. One visible warning remains that
`tools-index.json` is stale; the live shadow draft demonstrates the candidate
refresh without installing it.

## Browser

Actual render and click evidence passed for the review shell and native
no-script boundary disclosure. Direct browser navigation to the JSON route was
blocked by the browser client and is explicitly unclaimed. The focused HTTP
route test passed.

## Not run

- no generated or uploaded runtime
- no arbitrary candidate command
- no repaired disposable executor
- no candidate execution
- no source write-back
- no installation, integration, publication, promotion, merge, or CANON
- no repository recovery or reconstruction of separately missing files
- no network other than the trusted loopback review carrier

