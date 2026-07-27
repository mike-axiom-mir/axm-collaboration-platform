---
name: eye-live-visual-verifier
sense: live-sight
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: visual.capture.ephemeral-rolling-buffer/v1
---

# Eye 2 - live visual verifier

Observe a bounded live visual window, seal a digest, and release every raw frame.

## Inputs

- claim
- captureTarget
- expectedChange
- refutingChange
- frameBudget

## Procedure

1. Name one claim and target.
2. Open a bounded rolling buffer through an injected capture adapter.
3. Observe a time-ordered sequence.
4. Seal a typed digest.
5. Release all frames before return.

## Boundaries

- No automatic capture.
- No click or write authority.
- No raw video archive.

## Release before the next step

**Ephemeral by default.** EPHEMERAL BY DEFAULT. Raw sense material is released at the next step. Only a bounded typed receipt survives.

- Raw material: sense-specific bounded input
- Release boundary: before the typed observation is returned
- Survives: specific receipt plus axm.sensorium-receipt/v1 envelope
- Raw retained after step: zero
- Accumulation across uses: flat and zero after every release boundary
- Receipt cap: newest 20 per sense
- Deletion scope: only material created by the exact sense use, by exact id or path; never a wildcard or recursive sweep

## Runtime contract

- Route: `EXECUTABLE`
- Module: `../ai-native-hands/ephemeral-vision-hand.js`
- Specific receipt: `axm.ephemeral-visual-receipt/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `DEGRADED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
