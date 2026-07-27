---
name: corroboration-triangulator
sense: cross-seat-corroboration
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.consensus.claim-corroboration/v1
---

# Corroboration - cross-seat triangulator

Compare sealed same-claim receipts from distinct seats without voting, ranking seats, or choosing a winner.

## Inputs

- claimId
- receiptEnvelopes
- corroborationPolicy

## Procedure

1. Validate bounded sealed receipt envelopes for one claim.
2. Count each distinct seat once and refuse ambiguous same-seat observations.
3. Require one capability family and version.
4. Compare verdict, typed-observation digest, and named seams.
5. Return CONVERGENT, DIVERGENT, INSUFFICIENT, or INCOMPARABLE and take no action.

## Boundaries

- No raw frames, transcripts, readings, or payloads.
- No voting, averaging, seat ranking, or tiebreaking.
- Agreement is evidence, not canon or authority.
- Divergence routes to a human or independent gate.

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
- Module: `corroboration-triangulator.js`
- Specific receipt: `axm.corroboration-record/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `NOT_REQUIRED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
