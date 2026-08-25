# Test report — bounded portable FSM definition v2.19

Status: `TEST`

Technical source commit:
`0a3af63d2e8118a6a66bf1df88afd0c85cf0f0bf`

Exact parent:
`c0d57d4ea0403b5d0932e4abf177d207bc87791b`

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/69>

## Focused capability checks

| Check | Result |
| --- | --- |
| Bounded portable-FSM focused proof | `38 checks PASS` |
| Code Specialist capability builder selftest | `378 PASS` |
| Specialist build-profile registry selftest | `90 PASS` |
| Shared Capability Fabric selftest | `185 checks PASS` |
| Capability Fabric tool selftest | `15 checks PASS` |
| Capability recipe admission selftest | `27 checks PASS` |
| Capability Fabric package test | `150 checks PASS` |
| Prior bounded-record-query focused proof | `19 checks PASS` |
| Capability composition package test | `28 checks PASS` |
| Capability Recipe Foundry selftest | `44 checks PASS` |
| Capability Recipe Foundry package test | `47 checks PASS` |
| Existing Game FSM selftest | `PASS`; five-state fixture |
| Exact direct candidate rebuild | `PASS`; package `sha256:b32dc3b086457996265b29a5f438d3d103b03511ea1af3fc6926c82bce18ef55` |
| Exact specialist candidate rebuild | `PASS`; package `sha256:ef9cb7b6f50ba743b370bdde98b4d3ec9a03ef93d56e0c4df0faba3ed521ba4f` |
| Recursive Code Capability Fabric selftests | `51/51 entry points PASS` |
| City compiler final read-only check | `PASS`; 304 blocks; graph `9c61e304d602b161741148c9c808df4153fd2cf125cd95f4d0966d9cf0640edd` |
| Schema registry final read-only check | `PASS`; 923 entries, 755 unresolved sockets; digest `7fe47cc3809c62a1724de9040e518654c5d72d8b7e1102b9340fd4c18f8e238d` |
| Twin final read-only check | `PASS`; 304 blocks; digest `3ba9d6710af16745311da503285f88bf1800535f2dd63c29db1932b39f3e729c` |
| Tools-index structural projection | `PASS`; 238 tools, 2,276 capabilities |
| City map gate test | `33 assertions PASS` |
| Shared City graph selftest | `33 assertions PASS` |
| Technical-delta JavaScript syntax | `PASS` |
| Technical-delta JSON/JSONL parse | `PASS` |
| `git diff --check` | `PASS` |
| Added-line privacy scan | `PASS`; no added credential, protected local-state path, private user path, or active-worktree path |
| Capability-gap comparator selftest | `PASS` |
| Exact after-gap comparison | `READY`; zero missing capabilities inside the declared rung |
| Deterministic PR scope checkpoint | `PASS`; digest `6bbe43d75bc7694930ccbe8b16eed86dcb055385505bd35c4ab8785e95595c2f` |

The package test ran emitted fixture selftests only from disjoint trusted-host
temporary copies. The focused portable-FSM proof byte-verified its execution
copy before running the exact emitted structural selftest. It then used the
unchanged existing Game FSM runtime to trace `UNLOCK`, `OPEN`, `CLOSE`, and
`LOCK`, repeated the trace byte-identically, verified deterministic ignore
behavior for undeclared `KNOCK`, and bound runtime evidence to the definition
digest. The detached Nursery source and Code Specialist Fabric executed
nothing. Temporary fixture files were removed and raw stdout/stderr was not
retained as durable evidence.

Portable-FSM adversaries cover malformed outer parameters, symbols, custom
prototypes, accessors, sparse and decorated arrays, unknown keys, reserved ids,
duplicate states and events, missing targets, unreachable states, unsafe or
excess limits, and byte overflow. Profile and composition tests retain the
existing ambiguity, lineage, permission, network, lifecycle, and historical
collision refusals.

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

- `verify.js`: `0 FAIL · 21 warn · spine b618c5762240070c`.
- The 21 retained warnings are 20 current game-evidence gaps and one legacy
  `UNDECLARED` manifest-kind item.
- Warning delta against the opening observation: six added, 27 resolved, one
  changed, and 14 unchanged. This change includes reconciliation of existing
  product verification receipts and is not a claim that this rung fixed those
  products.
- `verify-plus.js`: `VERIFIED_WITH_LIMITS`; Foundation `PASS=2 WARNING=1`,
  game `PASS=2 WARNING=1`, module `PASS=3`.
- HTML script syntax: `57 PASS · 0 FAIL`.
- Agent Tool Forge: `17 PASS · 0 FAIL`.
- Evidence Desk: `36 PASS · 0 FAIL`.

## Non-product warnings and corrected harness invocations

- `node scripts/generate-tools-index.js --verify --workers=2` returned exit 1
  with `130 PASS · 7 not PASS · scope FULL`. The seven names were
  `ai-habitat`, `grounded-evolution-intelligence`, `human-capability-atlas`,
  `human-interface-intelligence`, `universal-object-fabric`,
  `visual-mirror-platform-clone`, and `visual-mold-foundry`. These are existing
  promotion-claim selftests outside the portable-FSM rung, not failures in its
  focused or required suites.
- The capability-gap skill was first invoked with the obsolete filename
  `selftest_compare_capabilities.py`, which does not exist. The correct command,
  `compare_capabilities.py --self-test`, passed, and the exact before/after
  comparison remained `READY`.
- The first deterministic checkpoint was preserved as `HELD` outside the
  repository after its coarse secret pattern falsely matched ordinary `sk-`
  text in three generated public metadata files. The scope checkpoint was
  rerun with only that coarse scan disabled and passed; the dedicated narrower
  added-line privacy scan remained passing.

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
- Hostile Proxy behavior, arbitrary host objects, guards, actions, callbacks,
  expressions, gameplay quality, visual/runtime integration, browser
  compatibility, and general runtime compatibility remain `UNKNOWN` or out of
  scope.

Passing these checks supports only the exact deterministic, structural,
authority, bounded-resource, composition, and fixture-behavior claims. The
specialist result still labels general runtime behavior `UNKNOWN`; trusted-host
fixture execution is separate evidence and grants no lifecycle authority.
