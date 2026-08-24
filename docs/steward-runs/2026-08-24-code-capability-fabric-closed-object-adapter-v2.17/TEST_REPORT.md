# Test report — strict closed-object contract adapter v2.17

Status: `TEST`

Technical source commit:
`ddc95e8d21b76d85133e310e8d362ac04d817cba`

Exact parent:
`72d74569ea569f229e8d768ac3a7a62a6ac92ee9`

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/67>

## Focused capability checks

| Check | Result |
| --- | --- |
| Strict closed-object adapter focused proof | `14 PASS` |
| Code Specialist capability builder selftest | `334 PASS` |
| Specialist build-profile registry selftest | `81 PASS` |
| Shared Capability Fabric selftest | `167 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `126 checks PASS` |
| Capability composition package test | `28 checks PASS` |
| Capability Recipe Foundry selftest | `44 checks PASS` |
| Capability Recipe Foundry package test | `47 checks PASS` |
| Exact direct candidate rebuild | `PASS`; package `sha256:99e8bd4ef8537737a1ed57ff8b244de53a9b342957e9f51e819813bf4b2a6a09` |
| Exact specialist candidate rebuild | `PASS`; package `sha256:c2d49c3c805c954a897f876ab62ce0cd036694696a0a0c36bc668a6dad75f92f` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler final read-only check | `PASS`; 304 blocks; graph `78917672a22b45d8e5efbb93980fcf7c75f4df813f684921b9db19c938b38b05` |
| Schema registry final read-only check | `PASS`; 923 entries, 755 unresolved sockets; digest `ee3143745f9861c5bfbaf147a7aa87c9bcb287a25482963d0907fc701b8de25e` |
| Twin final read-only check | `PASS`; 304 blocks; digest `34a655adec94e8d7330a8adcedf633e783d7ad7f78f25ac6f3e637feaa5c6663` |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Technical-delta JavaScript syntax | `13/13 PASS` |
| Technical-delta JSON parse | `23/23 PASS` |
| `git diff --check` | `PASS` |
| Added-line privacy scan | `PASS`; no added credential, token, private machine path, or protected local-state material |

The package test executed all nine emitted fixture selftests only from disjoint
trusted-host temporary copies. The focused adapter proof separately
byte-verified its execution copy before running the exact emitted selftest. The
detached Nursery source and Code Specialist Fabric executed nothing. Temporary
fixture files were removed and raw stdout/stderr was not retained as durable
evidence.

Adapter adversaries cover deterministic rebuilding, immutable configuration,
fresh output, explicit drops and defaults, null-prototype records, undeclared
fields, custom prototypes, accessors without getter invocation, hidden fields,
symbols, own and inherited serialization hooks, exact property ceilings,
input/output byte ceilings, and independence from host `JSON.stringify` and
`Buffer`. Profile and composition adversaries cover exact same-language
selection, duplicate bindings, stale/forged profile and recipe lineage,
cross-profile substitution, incompatible graph contracts, zero partial
candidates, permission/network/lifecycle closure, and historical v1 collision
holds.

## Required `AGENTS.md` checks

All required commands passed from the technical source state:

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

The first required `verify.js` attempt after late Foundry/test updates reported
`9 FAIL · 26 warn`: the tools index and nine City projections were stale. The
official tools index, City graph, schema registry, and twin views were
regenerated, then all ten required checks were rerun. The transient failure is
preserved here and is not relabelled as a product pass.

## Deliberately unrun or unproven

- Browser render/click: `NOT RUN` / not applicable to this nonvisual source,
  schema, and contract change.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved
  local validator dependency was present and none was installed.
- Supplied experimental runtimes: `NOT RUN`.
- Provider and network use: `NOT RUN`.
- General candidate executor: `NOT RUN`; Mike authorization remains absent.
- Install, integrate, publish as a product, promote, merge, or `CANON`:
  `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.
- Hostile Proxy behavior, arbitrary host objects, nested schemas, semantic
  equivalence, browser integration, and general runtime compatibility remain
  `UNKNOWN` or out of scope.

Passing these checks supports only the exact deterministic, structural,
authority, and bounded fixture-behavior claims. The specialist result still
labels runtime behavior `UNKNOWN` and the emitted selftest
`EMITTED_NOT_RUN`; trusted-host execution is separate evidence and grants no
lifecycle authority.
