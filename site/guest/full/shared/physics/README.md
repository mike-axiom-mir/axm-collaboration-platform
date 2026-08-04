# AXM Physics Core

`axm-physics-core.js` is the first real adapter behind the shared AXM Physics
registry. It is infrastructure, not a separate Hub destination.

Version 0.3.1 provides a deterministic-order 2D prototype solver with:

- fixed-step semi-implicit integration and bounded adaptive substeps;
- dynamic, static and kinematic bodies;
- circle and axis-aligned box shapes;
- gravity, forces, impulses, damping, restitution and friction;
- circle/circle, box/box and circle/box contacts;
- world bounds, sensors, point queries and bounded raycasts;
- collision categories, masks and signed groups;
- sensor/contact `ENTER`, `STAY` and `EXIT` lifecycle events that preserve
  sensor identity through exit;
- contact-aware resting/sleep state with explicit wake on force, impulse,
  material impact or deliberate kinematic support motion; older v0.2 worlds
  inherit the documented defaults;
- explicit dynamic/kinematic velocity control;
- a deterministic spatial-hash broadphase for newly created worlds, with
  all-pairs retained as the explicit reference and the migration path for
  older worlds that have no broadphase metadata;
- an explicit first-step engine migration receipt that records the prior
  version, current version and whether broadphase policy was preserved or
  supplied by the legacy all-pairs default;
- a bounded oversized-body lane that keeps giant static regions from forcing
  unrelated bodies back through all-pairs, plus pair, overflow, cell-entry and
  occupied-cell diagnostics;
- bounded active contact-manifold evidence with stable identity, contact age,
  representative geometry, per-step impulses and cumulative impulses;
- an explicit, default-off accumulated-impulse warm-start option for
  translation-only contacts, with bounded cache scaling, normal-agreement
  invalidation, friction clamping and the ability to subtract an excessive
  cached impulse during the ordinary solver sweep;
- warm-start diagnostics that expose whether the option is enabled, how many
  cached contacts were applied, the applied impulse total and the impulse
  removed again by constraint correction;
- kinetic, potential, total-energy, momentum, penetration, contact, actual
  integration-step and checksum diagnostics;
- additive contact-capacity receipts with detected, retained/stored, truncated,
  limit, status and reason fields (cap remains 2,048);
- additive typed input-normalization receipts for coerce/clamp/fallback events
  without changing permissive defaults;
- additive configuration, definition and identity lineage digests alongside the
  unchanged legacy state checksum;
- bounded replay traces with sampled body states and checksum lineage;
- a shared-engine adapter for `step-2d`, `simulate-2d`, `trace-2d`,
  `validate-2d` and `raycast-2d`.

The versioned evidence layer is intentionally separate from solver policy:

- `PHYSICS_FACT_BASE.md` separates definitions, physical laws, conventions,
  numerical methods, engine policy, verified behavior and validation claims;
- `PHYSICS_SOURCE_REGISTER.json` records source authority, supported claims,
  limitations and the corrected provenance of the 2026-07-19 fact-pack intake;
- `PHYSICS_POLICY_SOURCE_REGISTER.json` independently resolves the policy
  deep-dive's conversation-local citation markers to reusable primary URLs;
- `physics-micro-verification.js` runs bounded exact, invariant, metamorphic,
  lifecycle and robustness checks against the current engine;
- `physics-policy-deep-dive.js` freezes the deeper identity, removal, boundary,
  hashing, capacity, CCD-attribution and validation-capability observations;
- `PHYSICS_POLICY_OBSERVATIONS.md` freezes unresolved behavior seams without
  promoting them into desired behavior;
- `PHYSICS_POLICY_DEEP_DIVE.md` routes each research claim to its native proof
  surface and records supported, failed and unknown conclusions;
- `PHYSICS_POLICY_CONTRACT_PROPOSAL.json` tracks a partially implemented
  evidence contract while leaving unresolved product choices undecided; and
- `PHYSICS_HASH_LINEAGE_PROPOSAL.md` separates implemented additive digests
  from the stronger input/state/predecessor receipts that remain proposed,
  without redefining the legacy checksum.

Run `node shared/physics/physics-micro-verification.js` for the concise receipt
or add `--json` for full measurements. Run
`node shared/physics/physics-policy-deep-dive.js` for the policy-gap receipt. A
passing receipt is bounded software verification, not scientific validation.

The core deliberately does **not** claim scientific validation, continuous
rigid-body rotation, joints, deformables, fluids, 3D physics or deterministic
agreement across different JavaScript engines. It is useful now for games,
interaction prototypes and replayable experiments. Those larger branches need
separate evidence and versioned adapters.

Development is pressure-tested through `physics-canaries.js`,
`physics-adversarial.js`, `physics-repeat-adversarial.js`,
`physics-broadphase-adversarial.js`, `physics-manifold-adversarial.js`,
`physics-warm-start-adversarial.js`, `physics-capacity-receipt-adversarial.js`,
`physics-normalization-receipt-adversarial.js`,
`physics-hash-lineage-adversarial.js`, `inventor-seam.js`,
`inventor-repeat.js`, `inventor-repeat-two.js`, `inventor-repeat-three.js` and
`inventor-repeat-four.js`, plus the observation-only
`physics-micro-verification.js` and `physics-policy-deep-dive.js`. Passes seven
and eight preserve the giant-static
fallback and lost sensor-exit truth as failures, then require expanded
broadphase equivalence and persistent-manifold lineage before promoting the
hash for new worlds. Dense single-cell scenes may still degenerate honestly to
all-pairs work. Passes nine and ten preserve the missing feature contract, the
first behaviorally inert cache prototype and a stale energy measurement as
failures. They promote warm starting only after a global cache prepass passes
default-off compatibility, a named low-iteration stack A/B test, fixed
30/60/120 Hz sensitivity, active separating-contact energy correction and
same-runtime deterministic replay. The favorable percentages belong only to
that declared workload; no universal improvement claim is made. Warm starting
remains disabled unless `constraints.warmStart` is explicitly `true`.

The contact cache is still pair-level and single-point. It does not add
rotation, angular inertia, multi-point manifolds or joints, and feature churn,
abrupt variable-timestep transitions and cross-engine cache equivalence remain
open evidence seams.

Game Forge owns the editable game physics document. This directory owns only
the reusable mechanics. No simulation result is treated as proof, and no game
package is modified automatically.
