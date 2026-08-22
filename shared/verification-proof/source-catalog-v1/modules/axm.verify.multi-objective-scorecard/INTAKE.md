# Local Intake Card — Multi-Objective Evidence Scorecard

- **Module ID:** `axm.verify.multi-objective-scorecard`
- **Seed:** 089/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/multi_objective_scorecard.py`
- **Primary class:** `MultiObjectiveEvidenceScorecard`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Present correctness, safety, performance, usability, cost, privacy, and uncertainty as separate evidence dimensions without an aggregate score.

## Optional upstream organs

- `axm.verify.evidence-sufficiency-policy`
- `axm.verify.metric-gaming-warning`
- `axm.verify.verdict-state-normalizer`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
