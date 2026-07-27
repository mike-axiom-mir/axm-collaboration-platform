---
name: time-sense-ttl-verifier
sense: time
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.time.ttl/v1
---

# Time - TTL verifier

Stamp evidence age and refuse malformed, future, untimed, or stale facts as current.

## Inputs

- fact
- observedAt
- ttlMs
- at
- decisionTtlMs

## Procedure

1. Validate the observation timestamp.
2. Assign bounded TTL by volatility.
3. Calculate age at intended use.
4. Return LIVE, STALE, UNTIMED, INVALID_TIMESTAMP, or FUTURE.
5. Inherit the shortest TTL.

## Boundaries

- Freshness is not truth.
- Does not re-observe.
- Does not authorize action.

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
- Module: `time-sense-ttl-verifier.js`
- Specific receipt: `axm.time-sense-ttl/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `NOT_REQUIRED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
