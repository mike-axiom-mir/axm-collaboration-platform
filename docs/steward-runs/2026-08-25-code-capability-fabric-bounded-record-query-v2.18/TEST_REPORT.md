# Test report — bounded record query specialist v2.18

Status: `TEST`

Technical source commit:
`092a201aef235e60d0c2ec36621fe003cde6fa3b`

Exact parent:
`1e0a81d94d658a96e0889529af66ebeb38e0e95c`

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/68>

## Focused capability checks

| Check | Result |
| --- | --- |
| Bounded record-query focused proof | `19 checks PASS` |
| Code Specialist capability builder selftest | `359 PASS` |
| Specialist build-profile registry selftest | `86 PASS` |
| Shared Capability Fabric selftest | `176 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `138 checks PASS` |
| Capability composition package test | `28 checks PASS` |
| Capability Recipe Foundry selftest | `44 checks PASS` |
| Capability Recipe Foundry package test | `47 checks PASS` |
| Exact direct candidate rebuild | `PASS`; package `sha256:9b46531cd71772e04033c80c8164578809a89fbe8d64d7ae2eba805459b67e90` |
| Exact specialist candidate rebuild | `PASS`; package `sha256:036835752d624d6ac5ae9cdef842b934c75c9ef67dc05e833325a7f8f449fa97` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler final read-only check | `PASS`; 304 blocks; graph `32cacbc7260f311a92e2808599da30b56e5838444e514ff484eb7956c0b45b0c` |
| Schema registry final read-only check | `PASS`; 923 entries, 755 unresolved sockets; digest `54e6ad59cbe5cc7d2082bb30188c9cbcce65217d1d73204e24f64bcc4d681cce` |
| Twin final read-only check | `PASS`; 304 blocks; digest `35534b1c1651bb8d055f1a52230f0893fb43400b4f2eec6daf7043b6a202de8a` |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Technical-delta JavaScript syntax | `9/9 PASS` |
| Technical-delta JSON/JSONL parse | `23/23 PASS` |
| `git diff --check` | `PASS` |
| Added-line privacy scan | `PASS`; no added credential, protected local-state path, private user path, or active-worktree path |
| Capability-gap comparator selftest | `PASS` |
| Exact after-gap comparison | `READY`; zero missing capabilities inside the declared rung |

The package test ran all ten emitted fixture selftests only from disjoint
trusted-host temporary copies. The focused record-query proof separately
byte-verified its execution copy before running the exact emitted selftest. The
detached Nursery source and Code Specialist Fabric executed nothing. Temporary
fixture files were removed and raw stdout/stderr was not retained as durable
evidence.

Record-query adversaries cover exact lineage, deterministic direct and
specialist rebuilding, source-reviewed builder activation, zero authority,
static forbidden surfaces, stable multi-key ordering and original-index ties,
ASC/DESC behavior, typed EQ/NE/LT/LTE/GT/GTE predicates, exact projection and
limit behavior, output-byte overflow, sparse/custom arrays, duplicate
projection, unsafe integers, excess predicates, and outer accessors. Profile
and composition tests retain the existing ambiguity, lineage, permission,
network, lifecycle, and historical-collision refusals.

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

## Deliberately unrun or unproven

- Browser render/click: `NOT RUN` / not applicable to this nonvisual source,
  schema, contract, and generated-candidate change.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved
  local validator dependency was installed for this rung.
- Supplied experimental runtimes: `NOT RUN`.
- Provider and network use: `NOT RUN`.
- General candidate executor: `NOT RUN`; Mike authorization remains absent.
- Install, integrate, publish as a product, promote, merge, or `CANON`:
  `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.
- Hostile Proxy behavior, arbitrary host objects, nested schemas, SQL or
  expression semantics, callbacks, regex, joins, grouping, aggregation,
  floating point, domain semantics, browser integration, and general runtime
  compatibility remain `UNKNOWN` or out of scope.

Passing these checks supports only the exact deterministic, structural,
authority, bounded-resource, and fixture-behavior claims. The specialist result
still labels runtime behavior `UNKNOWN` and the emitted selftest
`EMITTED_NOT_RUN`; trusted-host fixture execution is separate evidence and
grants no lifecycle authority.
