# Integration Handoff

Candidate branch: `codex/resource-grounded-capability-gate-v0.1`  
Candidate status: `TEST`  
Base commit: `d9066284e45eaedb07d8e7998b7c6a972e67c0c1`

## Safe insertion point

```text
Verified Capability Loop: AWAITING_STEWARD
  -> Resource-Grounded Capability Gate
     -> HOLD
     -> READY_FOR_HUMAN_REVIEW
  -> Mike's existing HOLD / CONTINUE / REJECT decision
```

The gate is a companion receipt, not a replacement state machine. A consumer
must provide the exact upstream cycle, sealed policy, and sealed baseline and
candidate observations. The candidate and baseline digests, workload,
environment, measurement set, measurement definitions, freshness, and policy
ceilings must align.

## What may connect later

- Measurement adapters may translate receipts from Cognitive Resource,
  Resource Pressure Sentinel, Module Footprint Observatory, Sustainability
  Metrology Lab, or a future trusted meter into `axm.resource-observation/v1`.
- Code Capability Fabric may consume the gate receipt before presenting an
  improvement candidate for human review.
- A host trust layer may authenticate observation issuers and verify referenced
  telemetry bytes before calling this comparison module.

Those are separate capabilities. This branch does not claim or implement them.

## Decisions still owned by Mike

1. Whether this companion belongs in the Code Capability Fabric path.
2. Which dimensions are required for each capability family.
3. Which absolute and regression ceilings represent an acceptable envelope.
4. Which observation issuers and evidence stores are trusted.
5. Whether to hold, revise, integrate, merge, promote, or reject this `TEST`
   candidate.

No decision is required merely to preserve the branch and evidence.
