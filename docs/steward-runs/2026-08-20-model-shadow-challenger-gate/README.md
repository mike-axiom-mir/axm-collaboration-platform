# Model Shadow Challenger Gate stewardship run

Status: `TEST`

This milestone closes the contract gap between the structured Model Shadow
Continuity receipt and the existing Grounded Growth Challenger Lab.

Only a valid `DRIFT_DETECTED` observation with distinct digest-bound output
artifacts and an existing verified non-`WAIT_FOR_EVIDENCE` direction can create
a challenger plan. The plan must retain design-visible technical evidence, a
held-out AI-workflow case, and a held-out regression case.

The plan is projected to the existing Review Inbox by exact digest. A reviewed
handoff requires the declared approval count and at least one seat labelled
`human`, but the receipt states that Review Inbox does not authenticate the
actor and therefore does not prove actual human participation.

Matching traces, invalid comparisons, critical authority drift, and identical
output artifacts stay held and create no plan. Review approval does not execute
the plan, evaluate it, adopt it, prove learning, or establish human benefit.

The capability comparator moves every required route from `BLOCKED` to
`READY`. Actual human review, live shadow execution, a current evaluation, and
held-out human benefit remain `OPTIONAL_UNKNOWN` / `NOT_RUN`.

No UI was added, so browser render/click verification is not applicable to this
data-only leaf. Mike remains the merge and `CANON` gate.

Primary focused checks:

```powershell
node shared/model-shadow-challenger-gate/selftest.js
node shared/model-shadow-continuity/selftest.js
node shared/grounded-growth-direction-handoff/selftest.js
node shared/grounded-growth-challenger-lab/selftest.js
node tools/review-inbox/selftest.js
node shared/grounded-growth-outcomes/selftest.js
node shared/grounded-growth-feedback/selftest.js
node tools/deterministic-json-core/selftest.js
```
