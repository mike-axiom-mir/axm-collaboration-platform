# Local Intake Card — Stateful Model-Based Test Runner

- **Module ID:** `axm.verify.stateful-model-based-runner`
- **Seed:** 033/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/stateful_model_based_runner.py`
- **Primary class:** `StatefulModelBasedRunner`
- **Operation:** `run`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Generate bounded state-machine paths and compare implementation observations with model transitions.

## Optional upstream organs

- `axm.verify.invariant-oracle`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
