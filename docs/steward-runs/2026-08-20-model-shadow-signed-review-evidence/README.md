# Model Shadow signed review evidence stewardship run

Status: `TEST`

This bounded seam adds detached Ed25519 integrity evidence after the v1.0 Model
Shadow Challenger Gate. A signature must bind the exact reviewed handoff,
proposal, Challenger Lab plan, Review Inbox evidence, retained approval
timestamp, caller key policy, and caller challenge.

The leaf proves only that a listed key signed those exact bytes. The policy is
forced to declare `CALLER_SUPPLIED_UNAUTHENTICATED`. No host trust root, real
identity binding, actual human participation, replay ledger, provider run,
challenger evaluation, human benefit, or learning was created or observed.

The branch milestone changes only:

- `shared/model-shadow-signed-review-evidence/`
- `docs/steward-runs/2026-08-20-model-shadow-signed-review-evidence/`

It does not modify Review Inbox, the v1.0 challenger gate, Foundation, a
registry, current state, or the specialist ZIP intake lane.
