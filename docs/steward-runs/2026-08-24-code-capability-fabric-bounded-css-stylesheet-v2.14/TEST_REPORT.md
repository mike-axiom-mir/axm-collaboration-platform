# Test report — bounded CSS token stylesheet v2.14

Status: `TEST`

Technical source commit:
`420bdc3dbcd159d6445b8cfea7c963ce729c5e38`

Exact parent:
`b9955f285ad7500a8693267bff64463b8e3248e7`

## Focused capability checks

| Check | Result |
| --- | --- |
| CSS specialist capability builder selftest | `257 PASS` |
| Specialist build-profile registry selftest | `62 PASS` |
| Shared Capability Fabric selftest | `131 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `114 checks PASS` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler read-only check | `PASS`; graph `9c1d31143a872d94f1d213ca52aa002a0d1e5f06da94e94d2f91268fa96941c0` |
| Schema registry read-only check | `PASS`; 923 identities, 755 unresolved sockets; digest `e288a5a112212ab654464cb86b3538db27bdbd0072cfc38a6358826511a14b77` |
| Twin read-only check | `PASS`; 304 blocks; digest `e5c95cbf2602e0362fbd946efbe40f5084ae7fceccee352c941b0b463864121e` |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Changed JavaScript syntax | `8/8 PASS` |
| Changed JSON parse | `22/22 PASS` |
| `git diff --check` | `PASS`; two informational LF/CRLF checkout notices |
| Added-line privacy scan | `PASS`; no new credential, token, private path, or protected local-state material |

The generated tools index contains ten pre-existing strings matching the
conservative token-shape pattern. Their values and hashes are identical to the
parent commit; this rung added no token-shaped string.

The package test executed all eight emitted fixture selftests, including the
new CSS fixture, from disjoint trusted-host temporary copies. The detached
Nursery source was not executed. This narrowly scoped test harness is not the
unauthorized general executor and grants no lifecycle authority.

## Required `AGENTS.md` checks

All required commands passed from the v2.14 Workshop worktree:

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

Notable exact results:

- `verify.js`: `0 FAIL · 25 warn · spine b618c5762240070c`.
- The one temporary stale-tools-index warning introduced during development was
  repaired before the final run. The remaining 25 warnings are the visible
  inherited baseline: 20 game-evidence gaps, one legacy `UNDECLARED` item, and
  four promotion-claim reverification warnings.
- `verify-plus.js`: `VERIFIED_WITH_LIMITS`; Foundation `PASS=2 WARNING=1`,
  game `PASS=2 WARNING=1`, module `PASS=3`.
- HTML script syntax: `57 PASS · 0 FAIL`.
- Agent Tool Forge: `17 PASS · 0 FAIL`.
- Evidence Desk: `36 PASS · 0 FAIL`.

## Deliberately unrun or unproven

- Browser render/click: `NOT RUN / N/A` for the code and static-data change.
  Therefore cascade behavior, browser compatibility, accessibility effect,
  motion timing, and visual quality remain `UNKNOWN`.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved local
  validator dependency was present and none was installed.
- Supplied experimental runtimes: `NOT RUN`.
- Provider and network use: `NOT RUN`.
- General candidate executor: `NOT RUN`; Mike authorization remains absent.
- Install, integrate, publish as a product, promote, merge, or `CANON`: `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.

Passing these checks supports the bounded static and trusted-fixture claims only.
It does not prove live CSS behavior or authorize any lifecycle transition.
