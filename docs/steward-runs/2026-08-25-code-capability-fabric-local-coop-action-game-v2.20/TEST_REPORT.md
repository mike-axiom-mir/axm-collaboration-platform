# Test report — deterministic local co-op action game v2.20

Status: `TEST`

Technical source commit:
`71d2ad2dfc421cd3c315d1b279ff207bf3b03941`

Exact parent:
`a34c6881aa793250fb970b33e7dc554f4ea20ff3`

## Focused capability checks

| Check | Result |
| --- | --- |
| Existing deterministic game generator | `12/12 PASS` |
| New Twin Reactor co-op recipe | `17/17 PASS` |
| Disposable candidate Sandbox | `12/12 PASS` |
| Exact repeated co-op generation | `PASS`; packet `sha256:e2a9b257857fa140caa0ec8294ce3fe1a1b0c60f27080e9fc35fd2bd975c3287` |
| Legacy one-player packet continuity | `PASS`; unchanged `sha256:3f2548636dc9f6b5836d55faa6fc1569706536595361ac43bf2c19bb12df140d` |
| Static Sandbox iteration | `PASS`; iteration `sha256:9092510930947d5445e549a077aa8ea158ee689a6e37ad4db0092176e43c3628` |
| Candidate resources | `11 files · 62,723 source bytes · 2 seats · 0 candidate processes` |
| Pure two-seat simulation | `PASS`; movement, attack, dash/cooldown, revive/countertests, shared loss/victory, pause/reset, replay, entity cap |
| Actual browser journey | `PASS`; render, click, P1 keys, P2 keys, attack, dash, pause/resume, restart, reload |
| Desktop render | `PASS`; selected screenshot retained |
| Narrow 480×900 render | `PASS`; two bounded viewport slices retained |
| Recursive Code Capability Fabric selftests | `52/52 entry points PASS` |
| Capability-gap comparator selftest | previously read and used exactly; after report `READY` |
| JavaScript syntax for changed source | `PASS` |
| Changed JSON parsing | `PASS` |
| `git diff --check` | `PASS`; line-ending conversion warnings only |
| Added-line privacy scan | `PASS` |

The generator did not execute candidate code. The focused co-op proof executed
only the byte-verified generated pure engine inside a trusted test VM. The live
journey separately served the exact immutable Sandbox iteration through the
existing loopback host and controlled it in the in-app browser. The static host
launched zero candidate processes.

The browser journey observed:

- start: `RUNNING`, wave 1, reactor 100, P1 `360,272`, P2 `600,272`;
- P1 move: P1 `360→363`, P2 unchanged;
- P2 move: P2 `600→597`, P1 unchanged;
- P1 dash: `363→394`; P2 dash: `597→566`;
- distinct P1 and P2 attack status;
- pause retained the same state across a 500 ms wait;
- resume restored `RUNNING`; and
- restart/reload returned `READY`, reactor 100, original positions, zero enemies.

Two earlier preview revisions exposed and helped repair browser-adapter timing:
one tick-per-animation-callback raced under the host clock, and the first cadence
accumulator still permitted catch-up bursts. The final adapter advances at most
one 12 Hz game tick per callback and applies one exact action step on keydown.
The three obsolete raw Sandbox revisions and two misleading temporary captures
were removed after their typed findings were retained. The final r4 session and
four selected screenshots remain.

## Required `AGENTS.md` checks

All ten required commands passed from the final technical source state:

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
- Warnings: 20 retained game-evidence gaps, one legacy `UNDECLARED` manifest
  kind, and four unrelated existing promotion claims needing current selftest
  reverification (`adapter-translation-garden`, `memory-continuity-garden`,
  `prehub`, `repair-resilience-library`).
- Warning delta against v2.19: `+4`; no warning was hidden or relabelled.
- `verify-plus.js`: game `PASS=2 WARNING=1`; module `PASS=3`.
- HTML script syntax: `57 PASS · 0 FAIL`.
- Agent Tool Forge: `17 PASS · 0 FAIL`.
- Evidence Desk: `36 PASS · 0 FAIL`.
- City graph: `2a5f89736935a74c5611f5afa61b62c2660816fd6424429046301b1a85da218a`.
- Schema registry: `aa5379f56cd801c69150d73353240d62f09823180f329d3aad3b0da7ed5b25d0`;
  923 identities and 755 unresolved sockets retained.
- Twin surfaces: `c90d0836345b69d0cb9852b7ceeace175f278cc69ab42b66c6668ff2062a59fe`;
  304 blocks.

## Deliberately unrun, limited, or unproven

- Ephemeral rolling-buffer capture: `UNAVAILABLE`; frame-perfect cadence,
  transient flicker absence, and performance timing remain `LIMITED`.
- Two physical human players, controllers, touch play, real phone, multiple
  browsers, online co-op, disconnect recovery, and persistence: `NOT RUN`.
- Long-form gameplay balance, entertainment quality, and human taste: `UNKNOWN`.
- Partner revive and final victory in the visible browser: `NOT FORCED`; both
  passed exact pure-engine traces without adding a hidden browser scenario.
- Independent JSON Schema 2020-12 meta-validation: `NOT RUN`; no approved local
  validator dependency was added.
- General candidate executor, arbitrary generated code, provider use, external
  network, supplied experimental runtimes: `NOT RUN`.
- Install, integrate, publish, promote, merge, or `CANON`: `NOT RUN`.
- Direct reuse/public-copying rights: `HOLD` pending Mike's decision.

Passing evidence supports this exact detached co-op recipe and its two-shape
Sandbox validator. It does not make the Fabric a universal game generator or
turn the candidate into an installed Workshop product.
