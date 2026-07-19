# Mirror Foundation Service-Plane Readiness Affordance Extension

Status: TEST

Date: 2026-07-18

Only Mike may accept this result as CANON. This report records a tested research
result and does not claim release, installation, readiness, or autonomous
authority.

## Outcome

Mirror's Readiness Probe Affordance Planner now recognizes a third reusable,
requirement-agnostic provider declaration shape:

- exact unique membership in an `axm.foundation-service-plane/v1` contract
  under the Workshop `shared` root.

The current immutable batch proposes five `AVAILABLE`-at-most structural-probe
inputs for attributed human review and holds one requirement:

| requirement | result | exact evidence |
| --- | --- | --- |
| `publish-library` | module review packet | manifest-bound module and declared entry |
| `identity` | foundation-service review packet | unique member of `shared/services/service-contract.json` |
| `module-installer` | module review packet | manifest-bound module and declared entry |
| `asset-hands` | shared-service review packet | exact `axm.shared-service-contract/v1` |
| `review-inbox` | module review packet | manifest-bound module and declared entry |
| `shared-physics` | `HOLD_NO_EXACT_PROVIDER_DECLARATION` | one consumer binding, no machine-readable provider declaration |

No human review, sealed recipe, candidate, live probe, Workshop write, install,
start, repair, permission grant, training admission, world action, runtime
promotion, identity change, CANON change, or `READY` claim occurred.

## What worked and what did not

The first exact-declaration affordance milestone correctly handled manifest-bound
modules and standalone typed shared-service contracts. It proposed four packets
and held two requirements. That trace remains immutable evidence at
`reasoning-readiness-probe-affordances-85ee00df0282dbdf5b56`.

The earlier `identity` hold was wrong. The planner scanned only files named
`service.contract.json`, so it did not inspect the existing
`shared/services/service-contract.json`. That contract uses a distinct typed
registry shape, lists `identity` exactly, and is cross-checked against the ten
permanent implementation definitions by the Workshop's own selftest and
discovery seam. The failure was detector incompleteness, not an identity
ambiguity. This report supersedes only that conclusion; it does not erase the
old batch.

The physics evidence is different. Spatial Studio consumes
`service:shared-physics/axm-physics-2d`; the adapter declares
`axm-physics-2d`, capabilities, and registration behavior in JavaScript; the
core and Workshop physics seams pass. But no exact provider contract binds the
outer `shared-physics` requirement to that adapter. Parsing source resemblance
as declaration authority would weaken the rule that human-sounding or
implementation-shaped evidence cannot silently decide readiness. Physics
therefore remains held.

## Implemented organ shape

The affordance inventory now accepts the two exact filenames used by the
observed contract families and distinguishes their schemas. A foundation plane
is eligible only when it has:

- exact schema `axm.foundation-service-plane/v1`;
- a non-empty purpose;
- non-empty string rules;
- non-empty, normalized string service IDs;
- no duplicate service IDs;
- exact requirement-ID membership;
- a bounded regular path under the real non-symbolic `shared` root; and
- exactly one provider across all admitted declaration shapes.

Eligible evidence produces only a
`DECLARED_FOUNDATION_SERVICE_AVAILABLE` suggestion with a `files:read` request,
`AVAILABLE` ceiling, `UNKNOWN` failure state, and explicit human-review gate.
Membership does not prove runtime health, semantic fitness, installation
fitness, permission grant, or `READY`.

The review-bound candidate DSL and builder learned the same generic probe kind.
Its disposable fixtures cover positive membership, absent target, missing
membership, duplicate membership, malformed JSON, out-of-root boundary, and
invalid time. Every failure remains `UNKNOWN`. Automatic practice still submits
no reviewed recipes and therefore builds nothing.

## Current evidence

Affordance batch:

- ID: `reasoning-readiness-probe-affordances-bbe006d90ee1ca9ca765`
- batch digest: `aa536df6955825d4d2c5c7da341111601c01b7be26ee5cd5e8ba295dea9d5573`
- inputs digest: `bbe006d90ee1ca9ca76552f16775c89882c3c8a8f43caca0a0a4974cbae5f83b`
- service inventory digest: `0e97fd8f9738158dd4927d600eeb7c2f0fb76f849a24839d5fd5e67987323969`
- ignored batch file SHA-256: `6fac6f578b760da9544bebd85c503937563646210174b66fddc889973dc68817`
- 33,256 bytes
- 6/6 Reasoning Foundation decisions matched
- 6/6 name-inference candidates rejected
- 6/6 false-`READY` candidates rejected
- 5 review packets, 1 no-provider hold, 0 ambiguity holds

Empty reviewed-candidate batch:

- ID: `reasoning-readiness-probe-candidates-a681a429673b038143e4`
- batch digest: `e951fdfc85bab37f563fd40e1ae1d140aa858033871641aa6cbe76e1215112f7`
- inputs digest: `a681a429673b038143e4e76c63c580af2238921de104b6f473b23eb97501d7b3`
- ignored batch file SHA-256: `0d732bd098979c4cd79de2c62e035e1d9e62a765e555c9eb9ad8f6fbd251065a`
- 4,777 bytes
- zero recipes, candidates, generated files, fixtures, installs, live probes,
  Workshop writes, training receipts, or world actions

Automatic practice:

- report: `curriculum-20260718144751277-fbff4f434c1c`
- ignored report SHA-256: `feeb3ed5547268d275eb15f5e9ebcdce139777754b8b93a77eff8397a3bcb1fc`
- 13,995 bytes
- same 5/1 affordance result and empty candidate result

Live TEST canary:

- runtime PID `28440`, started `2026-07-18T14:47:47.632Z`, loopback port `8818`
- session `session-c5f64a55ade4c6beea80ff47`, closed after the canary
- affordance endpoint HTTP 200, five packets and one hold
- `identity` suggested `DECLARED_FOUNDATION_SERVICE_AVAILABLE` at
  `shared/services/service-contract.json`
- `shared-physics` retained zero provider declarations and one consumer binding
- nonhuman review attempt HTTP 403
- empty builder HTTP 200 with zero candidates, live probes, or Workshop changes
- active runtime reports `learnedWeights: false`

## Verification

- Mirror core: 113/113 passing.
- One preceding full run reached 112/113 because Windows returned `EPERM` while
  an unrelated metamorphic test renamed its disposable temp stage. The exact
  metamorphic file then passed 4/4 and the full suite passed 113/113 on rerun.
- Learning Forge: 99/99 passing.
- Native Learning Shell: an initial 5/6 run exposed the stale 4-packet/2-hold
  expectation; after updating the integration assertion and summary field, 6/6
  passed.
- Foundation services selftest: PASS.
- Foundation services discovery seam: 16/16 PASS.
- Physics selftest: PASS.
- Physics discovery seam: 17/17 verified, 0 open.
- Mirror Doctor: Structure PASS, runtime PID 28440.
- PowerShell blocked the `npm.ps1` wrapper under the host execution policy;
  the exact test commands were rerun directly through `node --test`.
- 211 tracked/research JSON documents parsed successfully.
- `git diff --check` reported no whitespace errors; only expected LF-to-CRLF
  working-copy warnings were emitted.

## Known limits and next gate

- A foundation service-plane declaration establishes representation, not live
  health. An attributed human review and an independently reviewed live probe
  remain separate gates.
- The Workshop's current Technical Glasses snapshot still reports these
  requirements as `UNKNOWN`; no readiness observation was mutated.
- `shared-physics` needs a machine-readable provider declaration or an equally
  exact reusable adapter registry contract before this organ can propose its
  structural probe. Source-code parsing alone is intentionally insufficient.
- Learned weights cannot modify this contract family, roots, permissions,
  evidence, review gates, or release gates.
- The work remains TEST and not CANON.
