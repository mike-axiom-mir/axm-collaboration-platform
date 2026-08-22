# MIRRORSHIFT kinetic identity contract

Schema: `axm.vehicle-animation-pose/v1`

V18 adds a presentation-only kinetic rig for every frozen driver identity. The rigs continuously articulate the existing equal-spec machines without adding authority state, physics branches, hit boxes, timing advantages, or network traffic.

## Authored rigs

- Mike / Maker GT — `maker-piston-rig`: rear ratchet pistons and a driven crown gear.
- Axiom/Mir / Axiom Arc — `axiom-twin-rig`: counter-orbit fins and dual phase nodes.
- Codex / Prompt Runner — `codex-stack-rig`: compile-stack fins and an active route aperture.
- Mirror / Prism Wraith — `mirror-prism-rig`: paired phase plates and a central echo prism.

Every rig shares the same bounded pose vocabulary: idle ride, speed-responsive suspension, steering roll, braking load, drift lean, boost squat, impact reaction, wheel steer/spin, and one identity phase. `vehicleAnimationPose` is deterministic for the same presentation inputs and never mutates its racer argument or game state. It returns `changesPerformance: false`.

Reduced motion scales ride, roll, load transfer, and impact amplitudes to 12%, freezes wheel spin, and fixes the identity phase at its legible midpoint. Steering orientation remains readable because it reflects an existing input rather than adding ambient motion.

## Verification contract

- `tests/kinetic-rig.test.js` evaluates 108,000 poses across all four identities, all responsive states, off-road vibration, reduced motion, finite-value and amplitude bounds, identity uniqueness, frozen mechanics, and authority immutability.
- `window.__MIRRORSHIFT_KINETIC__` and `data-kinetic-*` expose bounded live diagnostics for the P1 presentation: selected identity/rig, active kinetic state, reduced-motion status, pose-frame count, and observed lift/roll maxima.
- Existing render-stage telemetry measures the added Canvas work inside the actor stage. A live browser traversal must show the rig in motion-state transitions and confirm warning/error-free rendering.

This local pass advances procedural animation breadth and character readability. It does not prove high-cadence motion quality or performance on representative hardware, physical-phone behavior, human attachment, voice breadth, human mix quality, or steward approval.
