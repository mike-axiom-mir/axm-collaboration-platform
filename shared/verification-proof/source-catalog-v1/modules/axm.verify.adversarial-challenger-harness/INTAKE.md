# Local Intake Card — Adversarial Challenger Harness

- **Module ID:** `axm.verify.adversarial-challenger-harness`
- **Seed:** 094/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/adversarial_challenger_harness.py`
- **Primary class:** `AdversarialChallengerHarness`
- **Operation:** `build_plan`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Generate a bounded deterministic challenge plan containing counterexamples, hostile-input probes, alternative explanations, and falsification questions before approval.

## Optional upstream organs

- `axm.verify.boundary-edge-case-matrix`
- `axm.verify.falsification-condition-recorder`
- `axm.verify.risk-based-test-selector`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
