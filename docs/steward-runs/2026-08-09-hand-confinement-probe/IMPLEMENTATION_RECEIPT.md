# Hand confinement substrate probe — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL · DEGRADED / HOLD**

## Outcome

The Game Production Runner now has an explicit, read-only-in-authority process
confinement diagnostic. It launches disposable local child processes under the
runtime's permission flag, observes six atomic capabilities, closes its local
listener, removes its temporary root, and returns a canonical sealed receipt.

The local Node `24.17.0` observation is intentionally not a success claim:

- permission API availability: `PASS`;
- filesystem read denial: `PASS`;
- filesystem write denial: `PASS`;
- child-process denial: `PASS`;
- worker-thread denial: `PASS`;
- local-loopback network denial: `FAIL` — the connection was allowed.

The aggregate receipt is therefore `DEGRADED`; trusted process-Hand activation
is `HOLD`, untrusted code is `REFUSED`, and execution authority remains false.
No production Hand was moved out of process or activated by this slice.

## Safety and truth boundaries

- Probing requires `--explicit-probe`; inspection does not start it.
- Probe children receive an environment with all `NODE_*` variables removed.
- The only network target is an ephemeral parent-owned listener on
  `127.0.0.1`; no external traffic is requested.
- Recursive cleanup first proves that the target is beneath the operating
  system temporary directory and has the exact probe prefix.
- Receipts disclose runtime identity and check results, not machine paths.
- Node permission mode is classified only as accidental-capability containment,
  never as malicious-code isolation.

## Evidence ceiling

The probe is useful because it converts a vague sandbox assumption into an
atomic, repeatable refusal. It does not prove native-addon, WASI, FFI,
inspector, external-network, separate-user, escape-resistance, or OS sandbox
claims. A production process host remains a separate missing Hand and must not
be activated until an isolation substrate passes every required denial plus a
separate explicit authority gate.

## Verification

Focused evidence:

- `node shared/game-production-runner/selftest.js` — PASS, 118 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 58 checks, including
  a separate CLI process and exit-code boundary.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 20
  checks.
- Capability requirements versus inventory — reproducible `BLOCKED`; missing
  `confinement.network.deny` and `sandbox.hand-process.malicious-code`.
- JavaScript syntax, JSON parsing, deterministic receipt digest, resource
  cleanup, and machine-path scans — PASS.

Required Workshop checks:

- `node verify.js` — PASS, 0 failures and 38 existing warnings.
- Route, graft, skin, verify-plus, HTML script syntax, tool packaging, Agent
  Tool Forge, and Evidence Desk — PASS.
- Hub self-test — FOREIGN FAILURE, the same three branch-baseline assertions:
  radio source-map completeness, isolated incremental measurement reuse, and
  responsive command-bar polish. This slice does not edit Hub files.

## Runtime reference

The Node 24 permission documentation lists filesystem, child-process, worker,
WASI, and addon controls but not network permission, and explicitly describes
the model as a seat belt rather than protection from malicious code:
https://nodejs.org/download/release/v24.0.1/docs/api/permissions.html
