# AXM Physics Core

`axm-physics-core.js` is the first real adapter behind the shared AXM Physics
registry. It is infrastructure, not a separate Hub destination.

Version 0.2.2 provides a deterministic-order 2D prototype solver with:

- fixed-step semi-implicit integration and bounded adaptive substeps;
- dynamic, static and kinematic bodies;
- circle and axis-aligned box shapes;
- gravity, forces, impulses, damping, restitution and friction;
- circle/circle, box/box and circle/box contacts;
- world bounds, sensors, point queries and bounded raycasts;
- collision categories, masks and signed groups;
- sensor/contact `ENTER`, `STAY` and `EXIT` lifecycle events;
- contact-aware resting/sleep state with explicit wake on force, impulse,
  material impact or deliberate kinematic support motion; older v0.2 worlds
  inherit the documented defaults;
- explicit dynamic/kinematic velocity control;
- an opt-in deterministic spatial-hash broadphase whose contact sets and full
  step checksums are compared against the all-pairs reference before use;
- kinetic, potential, total-energy, momentum, penetration, contact, actual
  integration-step and checksum diagnostics;
- bounded replay traces with sampled body states and checksum lineage;
- a shared-engine adapter for `step-2d`, `simulate-2d`, `trace-2d`,
  `validate-2d` and `raycast-2d`.

The core deliberately does **not** claim scientific validation, continuous
rigid-body rotation, joints, deformables, fluids, 3D physics or deterministic
agreement across different JavaScript engines. It is useful now for games,
interaction prototypes and replayable experiments. Those larger branches need
separate evidence and versioned adapters.

Development is pressure-tested through `physics-canaries.js`,
`physics-adversarial.js`, `physics-repeat-adversarial.js`, `inventor-seam.js`,
`inventor-repeat.js` and `inventor-repeat-two.js`. The sixth preserved pass
implements separate kinematic/dynamic wake gates and a bounded broadphase
equivalence corpus. Spatial hash remains opt-in until filters, sensors, giant
statics, mixed size ratios and dense pathological cells also pass. Rotational
constraints remain a separate proposal, not a completed capability.

Game Forge owns the editable game physics document. This directory owns only
the reusable mechanics. No simulation result is treated as proof, and no game
package is modified automatically.
