# Test report — bounded JavaScript string-record transform v2.16

Status: `TEST`

Technical source commit:
`6287aadea5a2ab2a3f9af6d19adcfc96dd6544ad`

Exact parent:
`934be41cb21af5cdb561366e04050e727b691fb1`

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/66>

## Focused capability checks

| Check | Result |
| --- | --- |
| JavaScript Code Specialist capability builder selftest | `310 PASS` |
| Specialist build-profile registry selftest | `75 PASS` |
| Shared Capability Fabric selftest | `152 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `114 checks PASS` |
| Capability composition package test | `28 checks PASS` |
| Exact specialist candidate rebuild | `PASS`; package `sha256:bbed3ab51fa1885a277cb4081c4f0097c1772edbbf18b95151a0c72a1cd2096f` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler read-only check | `PASS`; 304 blocks; graph `f6a1171eecadc1df049b553896aeba04651043b1f5dd1653c4847a1af09410ce` |
| Schema registry read-only check | `PASS`; 923 entries, 755 unresolved sockets; digest `70e335ade962b36721db43feedaba488ea2e9fe711549fcc217fba32852b265c` |
| Twin read-only check | `PASS`; 304 blocks; digest `cf2d7ccf5b9338cf71cb7ed294c857571c9af86a35461242df056c1cc3351d8d` |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Technical-delta JavaScript syntax | `6/6 PASS` |
| Technical-delta JSON parse | `19/19 PASS` |
| `git diff --check` | `PASS` |
| Added-line privacy scan | `PASS`; no new credential, token, private path, or protected local-state material |

The package test executed all eight emitted fixture selftests, including the
hardened JavaScript transform, only from disjoint trusted-host temporary
copies. The composition package test likewise executed the transform and
review-node selftests from explicit trusted temporary copies. The detached
Nursery source executed nothing.

The transform selftest covers arrays and null, custom prototypes, symbols,
accessors without getter invocation, non-enumerable or unsafe fields,
non-string and overlength values, key-count and byte ceilings, deterministic
fallback, output-byte enforcement, fresh output, and frozen configuration.
These are narrow trusted fixture executions. They do not authorize the general
candidate executor or prove behavior in arbitrary JavaScript hosts.

## Required `AGENTS.md` checks

All required commands passed:

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
- The 25 inherited warnings remain visible: 20 game-evidence gaps, one legacy
  `UNDECLARED` manifest-kind item, and four promotion-claim reverification
  warnings.
- `verify-plus.js`: `VERIFIED_WITH_LIMITS`; Foundation `PASS=2 WARNING=1`,
  game `PASS=2 WARNING=1`, module `PASS=3`.
- HTML script syntax: `57 PASS · 0 FAIL`.
- Agent Tool Forge: `17 PASS · 0 FAIL`.
- Evidence Desk: `36 PASS · 0 FAIL`.

The final `verify.js` run initially found nine stale generated City views after
a documentation edit. The official views were regenerated, then the required
check was rerun to the passing result above. The transient mismatch is not
relabelled as a product defect.

## Deliberately unrun or unproven

- Browser render/click: `NOT RUN` / not applicable to this nonvisual source and
  contract change.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved local
  validator dependency was present and none was installed.
- Supplied experimental runtimes: `NOT RUN`.
- Provider and network use: `NOT RUN`.
- General candidate executor: `NOT RUN`; Mike authorization remains absent.
- Install, integrate, publish as a product, promote, merge, or `CANON`: `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.
- Arbitrary JavaScript, browser integration, hostile proxy behavior, and
  general runtime compatibility remain `UNKNOWN`.

Passing these checks supports only the exact deterministic/static claims and
the bounded emitted-selftest behavior. Specialist Fabric evidence still labels
runtime behavior `UNKNOWN` and selftest state `EMITTED_NOT_RUN`; the trusted
package harness result is retained as separate evidence. No lifecycle authority
is implied.
