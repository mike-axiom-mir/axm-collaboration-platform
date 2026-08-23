# Consent-scoped Code Recipe Application Planner v1.2

Status: `TEST`

This permissionless adapter joins the existing declarative blueprint, installed
recipe discovery, exact recipe selection, grounded consent, and deterministic
JSON contracts. It emits one inert application plan for an independently
implemented native pure function.

The requester must explicitly map every selected `CC-####` identity to one exact
blueprint step and one supported native operation. v1.2 supports only:

- recipe metadata tagged `filter` → blueprint `SELECT` → `FILTER_VALUES`;
- recipe metadata tagged `map` → blueprint `TRANSFORM` → `MAP_VALUES`.

The mapping is checked mechanically and is never described as semantic fitness,
quality, recommendation, or an authenticated human choice. Selected identities
must be visible in the eligible side of the exact discovery packet. Held,
undiscovered, ambiguous, source-including, or drifted inputs fail closed.

Recipe source remains absent and unapplied. The plan requires independent native
implementation and keeps direct reuse at `RESEARCH_ONLY_HOLD`. Grounded consent
must validate the exact blueprint, evidence, action, resources, lifecycle, and
re-consent scope, but the result remains
`AUTHENTICATED_HUMAN_DECISION_REQUIRED`.

Verification reads only the exact module-local installed Foundry catalog, audit,
and contract through the existing v1.0/v1.1 gates. It does not inspect a target
project or arbitrary workspace content.

The included fixture plans a small game-rule pure function using the metadata of
`CC-0054` (map) and `CC-0055` (filter). It emits no JavaScript, candidate files,
runtime, sandbox action, test result, installation, integration, promotion, or
`CANON` change.

Run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-application-planner-v1.js
```
