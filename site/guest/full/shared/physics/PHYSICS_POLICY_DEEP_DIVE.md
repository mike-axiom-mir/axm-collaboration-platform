# AXM Physics Policy and Determinism Deep-Dive Intake

Target: `axm-physics-2d` v0.3.1  
Status: `PASS_WITH_OPEN_POLICY`  
Solver-behavior changes: none  
Additive evidence changes: contact-capacity receipts, normalization receipts and
separated configuration/definition/identity digests were added on 2026-07-24.

The supplied research was useful, but its citation markers were internal to the
research conversation. Every adopted claim was therefore rerouted to a reusable
primary URL in [`PHYSICS_POLICY_SOURCE_REGISTER.json`](./PHYSICS_POLICY_SOURCE_REGISTER.json)
and checked against the current executable core.

## Evidence routes

| Claim ID | Atomic claim | Native evidence | Counterevidence | Verdict | AXM disposition |
| --- | --- | --- | --- | --- | --- |
| `solver-order` | Constraint order can affect a sequential solver, and engine determinism depends on a declared schedule. | Box2D D1/D2/D4, Rapier D5; local `id-renaming-order-sensitivity`. | Renaming all semantic IDs maps back to identical state without another schedule key. | `PASS` | Adopt separation of identity and schedule as a proposal; no implementation yet. |
| `unrelated-create-remove` | Adding and removing an unrelated body before stepping does not perturb the bounded AXM fixture. | `physics-policy-deep-dive.js`. | Body, contact or checksum difference. | `PASS` | Permanent canary; does not erase the separate active-contact removal failure. |
| `identity-generation` | Reusable identifiers need generation/epoch lineage to prevent impersonation. | Box2D D1 and Rapier D8; local ID-reuse observation. | A current generation/epoch field prevents continuity across reuse. | `FAIL` | Required in proposal contract; absent in v0.3.1. |
| `removal-cause` | Removal should terminate the removed pair with a causal reason while preserving unrelated lineage. | Box2D D1, Rapier D7; local `remove-body-lifecycle`. | Explicit `ended_by_removal` plus unaffected `STAY`. | `FAIL` | Required in proposal contract; current behavior clears all silently. |
| `boundary-matrix` | Collision and query boundary semantics need an explicit cross-API matrix. | Box2D D3, Rapier D6; local exact-touch/query matrices. | One published rule already covers pair, tangency and initial-overlap cases. | `FAIL` | Matrix shape adopted; canonical exact-touch rule remains deliberately `UNDECIDED`. |
| `robust-predicate-applicability` | Shewchuk's adaptive predicates can be directly applied to all current AXM shape tests. | D12 plus local collision code inspection. | A mapped predicate and oracle exists for circle/circle, box/box and circle/box. | `UNKNOWN` | Research spike only. D12 proves orientation/incircle robustness, not a drop-in repair for every AXM predicate. |
| `authoritative-hash` | A complete numeric state hash must preserve distinctions plain canonical JSON loses. | RFC 8785 D11; local signed-zero checksum probe. | `+0` and `-0` produce distinct authoritative state receipts. | `FAIL` | Additive configuration, definition and identity digests now exist, but input-trace, predecessor-bound lineage and signed-zero authoritative state hashing remain proposed. The legacy checksum is preserved. |
| `capacity-receipt` | Bounded results must expose detected, retained, truncated, reason and prioritization. | Box2D D1; local 2,145-pair/2,048-record probe and `physics-capacity-receipt-adversarial.js`. | Complete deterministic overflow receipt exists. | `PASS` | `axm.physics-contact-capacity/v1` reports detected, retained/stored, truncated, limit, status, reason and the current `FIRST_DETECTED_UNIQUE_KEYS` policy. A different retention priority remains an open product decision. |
| `ccd-attribution` | TOI CCD, predictive/speculative contacts and substep mitigation are different evidence classes. | Box2D D1, Rapier D9/D10; local tunnelling map. | Diagnostics already name the prevention method. | `FAIL` | Method taxonomy adopted as proposal; v0.3.1 remains `substep_mitigation`, not genuine CCD. |
| `double-pendulum-fixture` | The uncertainty-bearing double-pendulum source is applicable to v0.3.1 validation. | D15 and local API inspection. | Rotation, angular velocity and joint APIs exist. | `FAIL` | Do not add this fixture to the current validation suite. Revisit only after a versioned rotation/joint capability. |

`PASS` means the narrow claim was supported. `FAIL` means the desired policy is
not currently satisfied. `UNKNOWN` preserves a source-to-implementation gap;
it is not permission to guess.

## Adopted proposal surface

The machine-readable proposal is
[`PHYSICS_POLICY_CONTRACT_PROPOSAL.json`](./PHYSICS_POLICY_CONTRACT_PROPOSAL.json).
It defines the shape of future decisions without choosing unresolved product
semantics or mutating serialized worlds:

- identity uses entity ID plus generation/epoch; solver schedule is separate;
- lifecycle ends carry a causal reason and preserve unrelated continuity;
- boundary classification and solver tolerances are separate contract layers;
- configuration, definition and identity now have separate additive digests;
  input trace, authoritative numeric state and predecessor-bound lineage remain
  proposal work;
- contact capacity now reports explicit overflow accounting; other bounded
  surfaces still need their own evidence when introduced;
- tunnel-prevention evidence names `toi_ccd`, `predictive_speculative` or
  `substep_mitigation`; and
- software-verification fixtures remain separate from experimental validation.

## Decisions still requiring a steward

1. Whether exact tangency counts as collision contact for each supported pair.
2. Whether point/ray APIs expose explicit `solid` and `boundary` modes or retain
   current defaults under a versioned compatibility mode.
3. The stable solver schedule key and migration from semantic-ID ordering.
4. Whether the current deterministic `FIRST_DETECTED_UNIQUE_KEYS` retention
   priority should become the stable contract or be replaced under a versioned
   migration.
5. The authoritative state encoding and cryptographic hash algorithm.

These are product and compatibility decisions. Primary-source prior art can
bound them, but cannot choose them for AXM.
