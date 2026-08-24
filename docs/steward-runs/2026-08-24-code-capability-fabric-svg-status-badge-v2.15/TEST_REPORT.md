# Test report — strict SVG status badge specialist v2.15

Status: `TEST`

Technical source commit:
`52de17f30cbf429c926af48b4604dd2a0102e52e`

Exact parent:
`211fa5e0b1e8f3d54b5e772e8c9c049162fc3cab`

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/65>

## Focused capability checks

| Check | Result |
| --- | --- |
| SVG Code Specialist capability builder selftest | `287 PASS` |
| Specialist build-profile registry selftest | `69 PASS` |
| Shared Capability Fabric selftest | `144 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `114 checks PASS` |
| Trusted VM static fixture parity | `PASS`; package `sha256:f57f674a066ecf7cfabb2285d44e4b4676b9fbb3c1f516ee851d6d8505d3bec9` |
| Static SVG XML parse | `PASS`; exact namespace, role, and view box |
| Exact specialist candidate rebuild | `PASS`; package `sha256:25f1152849791c0d3ba8df8c9fb61690f3a4050c77177ad56ce74ff15bbb79a7` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler read-only check | `PASS`; graph `fb8e46a891987ed90452cce3180ef8a7f14cd97fdd870b9c50dc9d4186df172d` |
| Schema registry read-only check | `PASS`; 923 identities, 755 unresolved sockets; digest `be27216293cf4e99f9d5454b473286d0b947a020489b5fcf3f03563bc72bcecc` |
| Twin read-only check | `PASS`; 304 blocks; digest `be76f5c403acf836622dafcdad6682a440c21a94ff811fe40f961e2b0e6fe43b` |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Technical-delta JavaScript syntax | `6/6 PASS` |
| Technical-delta JSON parse | `19/19 PASS` |
| `git diff --check` | `PASS`; two informational LF/CRLF checkout notices on the technical delta |
| Added-line privacy scan | `PASS`; no new credential, token, private path, or protected local-state material |

The package test executed all eight emitted fixture selftests, including the
hardened SVG fixture, only from disjoint trusted-host temporary copies. The
detached Nursery source executed nothing. The SVG selftest specifically refused
an inherited serialization hook, XML-invalid text, an over-budget multibyte
input, and an over-budget escaped output. During development, the trusted VM
fixture also exposed and caused repair of an undeclared `Buffer` dependency in
the emitted byte counter.

These fixture executions are narrow trusted tests. They do not authorize the
general candidate executor or prove browser behavior.

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
- The 25 warnings equal the exact v2.14 parent baseline and remain visible:
  20 game-evidence gaps, one legacy `UNDECLARED` manifest-kind item, and four
  promotion-claim reverification warnings.
- `verify-plus.js`: `VERIFIED_WITH_LIMITS`; Foundation `PASS=2 WARNING=1`,
  game `PASS=2 WARNING=1`, module `PASS=3`.
- HTML script syntax: `57 PASS · 0 FAIL`.
- Agent Tool Forge: `17 PASS · 0 FAIL`.
- Evidence Desk: `36 PASS · 0 FAIL`.

## Deliberately unrun or unproven

- Browser render/click: `NOT RUN`. Static fixture parity and XML parsing are not
  browser evidence, so appearance, accessibility behavior, responsive layout,
  and visual quality remain `UNKNOWN`.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved local
  validator dependency was present and none was installed.
- Supplied experimental runtimes: `NOT RUN`.
- Provider and network use: `NOT RUN`.
- General candidate executor: `NOT RUN`; Mike authorization remains absent.
- Install, integrate, publish as a product, promote, merge, or `CANON`: `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.

Passing these checks supports only the exact deterministic/static claims and
the bounded emitted-selftest behavior. It does not authorize any lifecycle
transition or claim that general SVG creation is implemented.
