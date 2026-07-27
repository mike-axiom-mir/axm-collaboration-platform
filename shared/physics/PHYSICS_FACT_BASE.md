# AXM Physics Fact Base

Status: evidence register for `axm-physics-2d` v0.3.1, dated 2026-07-19.

This document separates physical definitions, mathematical laws, numerical
methods, engine policies, verified software behavior and validation claims. It
does not turn a passing simulation test into proof that a physical model is
valid for a real-world use.

## Truth classes

| Class | Meaning here | May establish |
| --- | --- | --- |
| `FACT_DEFINITION` | A quantity, unit or term fixed by a cited authority | Vocabulary and dimensions |
| `PHYSICAL_LAW` | A scoped physical relation | An analytic oracle when its assumptions hold |
| `CONVENTION` | A chosen frame, sign or unit convention | How inputs and outputs are interpreted |
| `EMPIRICAL_PAIR_DATA` | Measured material-pair data | Nothing until a dataset and uncertainty are supplied |
| `NUMERICAL_METHOD` | A discrete approximation | The recurrence the implementation should follow |
| `ENGINE_POLICY` | A product choice, not a law of nature | A versioned software contract |
| `VERIFIED_BEHAVIOR` | Behavior reproduced by an executable oracle or invariant | Agreement with that bounded check |
| `VALIDATED_PHYSICS` | Agreement with relevant physical observations and uncertainty | Fitness only for the declared intended use |
| `KNOWN_LIMIT` | A bounded absence, approximation or unresolved decision | A guard against overclaiming |

The source metadata and claim boundaries are in
[`PHYSICS_SOURCE_REGISTER.json`](./PHYSICS_SOURCE_REGISTER.json). The supplied
fact packs targeted v0.2.2; every local behavior statement below was checked
again against v0.3.1.

## Quantities, units and frame

- Positions and shape extents are interpreted as metres when a consumer uses
  the SI profile; velocity is metres per second, acceleration is metres per
  second squared, mass is kilograms, force is newtons, impulse is newton
  seconds, momentum is kilogram metres per second and energy is joules. These
  are conventions because the engine does not attach runtime unit metadata.
- The default game frame is `+x` right and `+y` down. Its default gravity is
  `(0, 9.81)`. A consumer may supply a different gravity vector and coordinate
  frame, but must keep all quantities internally consistent.
- The conventional standard acceleration of free fall is 9.80665 m/s^2 (S2).
  The engine's 9.81 value is a rounded legacy game default, not a measurement
  of local gravity.
- JavaScript `Number` follows IEEE 754 binary64 semantics (S8). AXM additionally
  rounds post-step positions and velocities to nine decimal places. Same-input
  replay is therefore claimed only in one declared JavaScript runtime unless
  cross-runtime evidence is produced.

## Physical relations used as bounded oracles

These relations apply only under their named assumptions.

- Constant-mass translation: net force equals mass times acceleration,
  `F = m a` (S3).
- Impulse and momentum: `J = delta p`; for a constant mass,
  `delta v = J / m` (S4).
- An isolated collision should conserve total linear momentum. Restitution is
  an engine/material-pair model of relative normal separation speed, not a
  universal material constant (S4, S5).
- Translational kinetic energy is `0.5 m |v|^2`. Under a uniform supplied
  gravity vector, AXM reports potential energy using
  `-m (g dot x) gravityScale`. Numerical drift is expected from discrete time
  integration; timestep refinement is evidence about convergence, not physical
  validation.
- Coulomb-style friction bounds the tangent impulse by `|J_t| <= mu J_n`.
  AXM chooses `mu = sqrt(mu_a mu_b)` as an engine mixing policy (S5), not as a
  law of nature.

No empirical material-pair dataset is bundled. Default friction and restitution
values are gameplay parameters and must not be presented as measured data.

## Numerical method and current policy

- Dynamic translation uses fixed-step semi-implicit Euler. For constant
  acceleration and step `h`, the exact discrete oracle after `N` steps is
  `v_N = v_0 + N a h` and
  `x_N = x_0 + N h v_0 + a h^2 N(N+1)/2`.
- A requested step is clamped to 0.001 through 0.1 seconds. The configured
  fixed step has the same range; solver iterations are 1 through 32.
- Adaptive subdivision is bounded to 1 through 16 substeps using predicted
  travel and the smallest active feature. This reduces tunnelling in some
  cases but is not continuous collision detection.
- Linear damping uses the first-order multiplier `max(0, 1 - c h)`. Its result
  is timestep-sensitive (S5).
- Collision response uses sequential impulses, minimum restitution, geometric
  mean friction and positional correction. Optional accumulated-impulse warm
  starting is disabled unless `constraints.warmStart === true` (S5-S7).
- The promoted spatial hash and the retained all-pairs reference are required
  to agree on bounded equivalence suites. Dense scenes may still approach
  all-pairs work.
- Active contact and manifold evidence is capped at 2,048 records. Diagnostics
  expose detected, retained/stored, truncated, limit, status and reason through
  the additive contact-capacity receipt.
- Sleep is a performance/state policy. It is not a physical rest law (S5).

## Verified behavior

The executable micro suite currently reports 24 passes, zero failures and 12
observations. Its aggregate workload is 2,980 body-steps, including one
explicit 66-body, one-step capacity case. Covered claims include:

- exact semi-implicit constant-acceleration, force/mass and impulse/mass
  recurrences;
- declared damping, force clearing and body-type state contracts;
- isolated inelastic momentum/restitution behavior;
- decreasing smooth-motion and uniform-gravity error under timestep refinement;
- sensor non-interference and contact/sensor `ENTER`, `STAY`, `EXIT` lifecycle;
- force, impulse and kinematic-support wake behavior;
- collision-filter truth table, normal reversal, finite contact points and
  non-pulling/friction-bounded impulses;
- insertion-order, frame-transform, broadphase and serialization relations;
- fixed-seed finite-state, non-negative-penetration and unit-normal invariants.

Run `node shared/physics/physics-micro-verification.js` for the readable receipt
or add `--json` for full measurements. The compact checked-in receipt is
[`PHYSICS_MICRO_VERIFICATION_REPORT.json`](./PHYSICS_MICRO_VERIFICATION_REPORT.json).

## Observed policy seams

The suite also freezes observations that are not promoted to desired behavior:

- exact tangency is excluded for circle/circle and box/box, but included for
  circle/box;
- a bijective rename of body IDs can change a low-iteration stacked result
  because IDs participate in sequential solver ordering;
- removing one body clears all active contact lineage, so an unrelated surviving
  pair re-enters on the next step;
- removed IDs may be reused with fresh lineage;
- query boundary/origin-inside behavior differs by query and shape;
- boundary responses are recorded with zero normals and are boundary events,
  not unit-normal physical manifolds;
- nine-decimal `Math.round` quantization is asymmetric at negative half steps;
- the legacy checksum is a narrow state hash, not a configuration or provenance
  hash; additive configuration/definition/identity lineage digests sit beside it;
- normalization remains permissive while emitting bounded typed receipts;
  2,048-record truncation is reported through the contact-capacity receipt;
- collision category/mask support is limited to bits 0 through 30.

See [`PHYSICS_POLICY_OBSERVATIONS.md`](./PHYSICS_POLICY_OBSERVATIONS.md) for the
decision record. No seam was repaired in this evidence pass.

## Credibility boundary

Verification asks whether the implementation follows its declared equations
and policies. Validation asks whether the model represents physical reality
well enough for an intended use, with relevant observations, metrics and
uncertainty (S9, S10). This core has bounded software-verification evidence; it
does not have experimental validation evidence.

Known out-of-scope branches include continuous rigid-body rotation, angular
inertia, joints, deformables, fluids, 3D mechanics, general CCD and deterministic
equivalence across JavaScript engines. The current solver is suitable for
replayable game and interaction prototypes within tested bounds, not safety,
mission, engineering-design or scientific prediction work.
