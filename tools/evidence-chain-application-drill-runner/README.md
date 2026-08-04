# AXM Evidence Chain Application Drill Runner

`TEST` · actual owned-sandbox filesystem drill · no live permission

This module converts an unexpired `axm.evidence-chain-recovery-application-plan/v1` into a real apply-and-rollback drill without touching live evidence state.

The browser surface prepares a digest-bound drill request. The Node executor performs the actual filesystem work only inside an explicitly supplied root that:

- is absolute;
- does not already exist;
- has a basename beginning `axm-evidence-chain-drill-`;
- has an existing canonical, non-symlink parent.

Inside that new root the executor writes fixed fixture names, creates a safety copy, stages the candidate, performs an atomic sandbox swap, independently inspects the applied bytes, restores the exact broken source bytes, verifies rollback lineage, and deletes the entire owned root before returning.

## Honest limit

Plan phase 5—fresh permissioned Recovery Center preview—is deliberately not exercised. Phase 6 is a sandbox simulation, not a trusted service call. A passing receipt is therefore `PASS_WITH_LIMITS`; it does not close `capability.apply.evidence-chain-reviewed-recovery/v1`.

No receipt contains payloads, source fields, raw JSONL, paths, file names, or identities.

## Node API

```js
const Runner = require('./sandbox-drill-executor');
const receipt = await Runner.execute({
  source,
  candidate,
  plan,
  sandboxRoot,
  confirmPlanId: plan.planId,
  acknowledgeSandboxOnly: true,
  acknowledgeEphemeralCleanup: true
});
```

## CLI

```powershell
node tools/evidence-chain-application-drill-runner/cli.js --source broken.jsonl --candidate candidate.jsonl --plan plan.json --sandbox-root C:\tmp\axm-evidence-chain-drill-review --confirm PLAN_ID --sandbox-only --cleanup
```

The CLI prints a digest-only receipt to stdout and never writes a receipt automatically.

## Verification

```powershell
node tools/evidence-chain-application-drill-runner/selftest.js
node tools/evidence-chain-application-drill-runner/discovery-seam-review.js
```
