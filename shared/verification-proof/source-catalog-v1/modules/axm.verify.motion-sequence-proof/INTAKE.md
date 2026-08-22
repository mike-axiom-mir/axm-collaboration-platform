# Local Intake Card — Motion Sequence Proof

- **Module ID:** `axm.verify.motion-sequence-proof`
- **Seed:** 052/100
- **Family:** 6. Visual, interaction, performance, and native proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/motion_sequence_proof.py`
- **Primary class:** `MotionSequenceProof`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Verify frame order, monotonic timing, continuity declarations, duration and gap ceilings, and native playback evidence.

## Optional upstream organs

- `axm.verify.statistical-tolerance-oracle`
- `axm.verify.visual-state-proof-binder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
