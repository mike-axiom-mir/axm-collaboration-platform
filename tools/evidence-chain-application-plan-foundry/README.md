# AXM Evidence Chain Application Plan Foundry

`TEST` · plan-only · local-first · no permissions

This Foundry closes the planning contract after a structural recovery candidate has passed the Evidence Chain Candidate Review Gate. It consumes:

1. the preserved broken source JSONL;
2. the reviewed candidate JSONL;
3. `axm.evidence-chain-recovery-review/v1`;
4. `axm.evidence-chain-recovery-review-decision/v1`.

The core independently re-inspects both JSONL inputs, recomputes their non-hash semantic digests, binds the decision to the exact assessment, and requires four explicit acknowledgements. It emits a 15-minute `axm.evidence-chain-recovery-application-plan/v1` with eight fixed rollback-first phases and stop conditions.

## Honest boundary

The plan is non-executable. It contains no target path, shell command, payload, raw source line, file name, reviewer identity, or free-form note. It does not read a live target, create a backup, stage bytes, ask Recovery Center for a preview, check `recovery.apply`, apply the candidate, or perform rollback.

The handoff explicitly reports:

```text
targetServiceCompatibility: ADAPTER_REQUIRED
missingCapability: capability.apply.evidence-chain-reviewed-recovery/v1
```

That missing executable adapter remains a separate high-risk build and governance decision.

## Verification

```powershell
node tools/evidence-chain-application-plan-foundry/selftest.js
node tools/evidence-chain-application-plan-foundry/discovery-seam-review.js
```

The self-test creates current-format retention evidence, runs the Inspector, Recovery Foundry, and Review Gate, then verifies planning, expiry, privacy, deterministic output, acknowledgement refusal, decision tampering, semantic tampering, candidate-chain corruption, authority-claim rejection, and dependency delivery.
