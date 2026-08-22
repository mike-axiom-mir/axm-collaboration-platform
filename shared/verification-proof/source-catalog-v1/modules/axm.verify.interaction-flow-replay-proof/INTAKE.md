# Local Intake Card — Interaction Flow Replay Proof

- **Module ID:** `axm.verify.interaction-flow-replay-proof`
- **Seed:** 053/100
- **Family:** 6. Visual, interaction, performance, and native proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/interaction_flow_replay_proof.py`
- **Primary class:** `InteractionFlowReplayProof`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Verify supplied interaction replay observations against ordered state, output, error, and recovery expectations.

## Optional upstream organs

- `axm.verify.seeded-randomness-controller`
- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
