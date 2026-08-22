# Falsification and Counterevidence Recorder

Detached AXM Verification & Proof organ for seed 006.

It records, before testing, what observations would disprove or weaken a claim. Records are append-only and caller-attested; the module does not pretend it independently observed the test state.

## Truth boundaries

- Only `PRE_TEST` conditions with caller-attested `NOT_RUN` state are accepted.
- Disproof and weakening remain distinct.
- Duplicate condition IDs are refused.
- Conditions are not automatically treated as observed counterevidence.

Status: TEST-HOLD, detached, v0.1.0.
