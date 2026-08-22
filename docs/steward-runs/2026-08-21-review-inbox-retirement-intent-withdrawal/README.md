# Review Inbox retirement-intent withdrawal v4.9 evidence

Status: `TEST`

This folder binds product commit
`fa6f8fd94145ad58c6388bb64b62e5d75c19a46e` and tree
`4527ff55d6270fdea33894fc9d4ff2126aad5f2a` to exact parent
`5087e5dc6d7744b9814d6b4697a1ae299e44b773`.

The v4.8 parent had exact interrupted-retirement recovery but exported no
withdrawal method or decision/withdrawal schema and exposed no withdraw CLI or
contract. v4.9 adds a closed host-local request that can append an exact
`WITHDRAW_RETIREMENT_INTENT` decision only for intent-only evidence before a
proceed decision. Withdrawal keeps the intent and decision, does not release or
rewrite `operation.lock`, and can repair ambiguity one exact intent at a time.

Direct retirement and `RESUME_RETIREMENT` now claim the same exclusive
`PROCEED_RETIREMENT` decision before quarantine. A 22-assertion test synchronizes
two real Node processes at the decision create in both winner orders. The winner
is either proceed or withdraw; the losing cooperating caller gets a typed
refusal. The 87-assertion withdrawal suite also covers closed inputs, duplicate
withdrawal, direct-retirement and recovery races, corrupt decisions, owner-byte
preservation, durable-decision observation after later owner change, ambiguity
repair, CLI behavior, and the no-API/browser boundary.

Verification passed 19/19 scoped commands: nine focused commands with 586
assertions and controls, plus all ten commands required by `AGENTS.md`. The
exact archived 102-file product dependency slice replayed all nine focused
commands without tracked-byte changes. Aggregate operations remains a recorded
`FOREIGN_FAILURE` after both product tests pass: its unchanged verification
service and selftest require an intake absent from the parent, product, and
workspace. The aggregate command is not claimed as passing.

The primary evidence commit was then archived with its deterministic JSON
dependency and replayed independently. Its 137-check selftest and 18-event
session seal both passed; the temporary evidence replay root was removed.

The deterministic capability comparison moved from `BLOCKED` to `DEGRADED`:
all six bounded requirements are ready, while authenticated holder liveness,
general retirement cancellation safety, and cross-file atomicity remain open.
The decision file also proves no multi-host/network-filesystem behavior and
does not exclude external writers.

Review Inbox remains `TEST` v1.1. `READY_FOR_HUMAN_REVIEW` in the tools index is
queue readiness, not evidence of actual review or acceptance. No browser-facing
file changed, and no browser render/click test is claimed. No installation,
execution, adoption, learning, human benefit, promotion, merge, Foundation
mutation, or `CANON` decision occurred. Mike Tobi / AXM remains the merge and
`CANON` gate. The excluded package-intake lane was not inspected or modified.
The broad grounded-growth objective remains active.

Run:

```powershell
node docs/steward-runs/2026-08-21-review-inbox-retirement-intent-withdrawal/selftest.js
```
