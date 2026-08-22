# Acceptance Criterion Compiler

Detached AXM Verification & Proof organ for seed 005.

It converts a human goal plus explicitly supplied criteria into a deterministic acceptance contract. It does not infer criteria from prose, execute checks, or decide acceptance.

## Truth boundaries

- The original human goal is preserved verbatim.
- Criteria must explicitly name machine, human, or composite check paths.
- Tolerances, evidence requirements, and refusal conditions stay visible.
- Freeform-only goals are refused rather than silently converted into guessed tests.

Status: TEST-HOLD, detached, v0.1.0.
