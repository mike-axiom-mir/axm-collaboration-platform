# Model Shadow Continuity stewardship run

Status: `TEST`

This milestone turns the deterministic model-shadow idea into one bounded,
provider-neutral technical organ. It does not build a hidden model clone or
pretend to inspect model internals. It compares two caller-declared structured
snapshots only when task, context, seat identity, provenance, and time sequence
are valid.

The observer now distinguishes:

- `STRUCTURED_TRACE_MATCH` from raw-output equality;
- structured drift from a changed task, context, or model identity;
- ordinary review drift from permission expansion, new authority requests, or
  loss of an affirmed constraint;
- a planning projection from an executed simulation or submitted review.

Raw model output and private context are represented by exact references only.
The output includes a Baseline Simulation Lab input-shaped projection and a
note-free projection accepted by the existing Review Inbox contract in
temporary compatibility evidence. Neither handoff is executed automatically.

The capability-gap comparator moves every required route from missing to
`READY`. Live provider transport, actual human review, held-out human benefit,
and model-learning improvement remain `UNKNOWN` / `NOT_RUN`.

Primary checks:

```powershell
node shared/model-shadow-continuity/selftest.js
node shared/baseline-simulation-lab/selftest.js
node shared/research-contribution-intake/selftest.js
node shared/verification-snapshot-continuity/selftest.js
node tools/repair-resilience-library/components/ai-tool-contract-drift-detector/selftest.js
node shared/grounded-growth-challenger-lab/selftest.js
node tools/review-inbox/selftest.js
```

This branch is review material. It is not merged, promoted, or `CANON`.

