---
name: interoception-capacity-gauge
sense: interoception
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.interoception.own-capacity/v1
---

# Interoception - own-capacity gauge

Classify a seat's own host-supplied capacity headroom and recommend timely compaction or handoff without acting.

## Inputs

- seatId
- thresholdPolicy
- observedAt
- ttlMs

## Procedure

1. Request bounded fill-level signals for the invoking seat from an injected host adapter.
2. Refuse cross-seat, missing, invalid, or over-budget readings as UNKNOWN.
3. Compute the minimum declared headroom and classify AMPLE, TIGHTENING, or NEAR_LIMIT.
4. Recommend continue, compact soon, or seal handoff now.
5. Seal the reading and take no direct action.

## Boundaries

- No context content inspection or summarization.
- No estimation of another seat's capacity.
- No hardware-body substitution for cognitive capacity.
- No automatic compaction, truncation, or handoff.
- Missing host metrics remain an explicit UNKNOWN hold.

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
- Module: `interoception-capacity-gauge.js`
- Specific receipt: `axm.interoception-record/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `MISSING_ADAPTER`
- Proof: `CONTRACT_PASS`
- Authority: `NO_LEASE`
