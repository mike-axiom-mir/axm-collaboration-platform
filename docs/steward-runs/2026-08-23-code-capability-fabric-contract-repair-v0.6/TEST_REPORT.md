# Test report

Status: `PASS` for the implemented TEST capability.

## Focused verification

- 19 Code Capability Fabric selftest scripts: PASS.
- New pure planner: 20 cases PASS.
- Existing Workshop shadow host: 14 cases PASS.
- New contract-repair host: 17 cases PASS.
- Disposable-candidate sandbox, Workshop-shadow wrapper, Four Roots Adventure package (70 assertions), and trailer journey (40 frames, 5 zones, 228 actions): PASS.
- Final continuity set: 25 scripts PASS after serial supersession.

One non-admissible parallel run collided in shared ignored fixture roots because two steward test sweeps overlapped. It produced `ENOTEMPTY` and a missing fixture receipt. After all selftest processes exited, both affected suites were rerun serially and passed 14/14 and 17/17. The parallel result is preserved here as a test-orchestration error, not erased or treated as a product regression.

## Required AGENTS.md verification

All ten commands exited 0:

- `node verify.js` — PASS; 22 warning lines, 0 failure lines.
- `node hub/hub-selftest.js` — PASS.
- `node hub/route-selftest.js` — PASS.
- `node hub/graft-selftest.js` — PASS.
- `node hub/skin-selftest.js` — PASS.
- `node hub/verify-plus.js` — PASS.
- `node tests/html-script-syntax-test.js` — PASS; 55 HTML files.
- `node tests/tool-forge-package-test.js` — PASS; package remains `installed: false`.
- `node tools/agent-tool-forge/selftest.js` — PASS; 17 cases.
- `node tools/evidence-desk/selftest.js` — PASS; 36 cases.

The 22 `verify.js` warning lines are Workshop-wide baseline debt and remain visible. They include the prehub, repair-resilience-library, and stale tools-index warning groups. This run did not claim to repair them.

## Static and privacy checks

- `git diff --check`: PASS; only Git LF-to-CRLF checkout notices were emitted while staging.
- Changed JavaScript syntax checks: PASS.
- Changed JSON parse checks: PASS.
- Sensitive machine-path/token scan across changed paths: 0 matches.
- AJV is not installed; closed schemas are accompanied by strict programmatic normalization and adversarial tests. No AJV validation claim is made.

## Deliberately not run

The four candidate-specific commands in the live packet remain exactly `NOT_RUN`. No candidate source was executed. This is distinct from running the trusted implementation selftests above.
