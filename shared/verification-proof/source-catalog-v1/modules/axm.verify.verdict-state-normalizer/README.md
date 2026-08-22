# Verdict State Normalizer

Detached AXM Verification & Proof organ for seed 004.

It preserves the seven distinct verification states:

`PASS`, `FAIL`, `UNKNOWN`, `NOT_RUN`, `CONFLICTED`, `STALE`, and `HUMAN_REVIEW`.

External labels are translated only through an explicit profile map. Unmapped labels become `UNKNOWN` with the raw value preserved and review required. The module never converts states to a percentage, average, boolean, or release decision.

Status: TEST-HOLD, detached, v0.1.0.
