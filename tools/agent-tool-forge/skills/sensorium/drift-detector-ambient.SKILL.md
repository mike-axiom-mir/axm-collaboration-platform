---
name: drift-detector-ambient
sense: self-drift
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.behavior.drift/v1
---

# Drift - same-seat baseline

Compare bounded typed receipt features only with the same seat's reviewed baseline.

## Inputs

- seat
- baseline
- receipts

## Procedure

1. Form a bounded same-seat feature baseline.
2. Require reviewed baseline identity.
3. Compare declared axes.
4. Route possible drift for review.
5. Take no direct action.

## Boundaries

- No cross-identity comparison.
- No punishment or routing change.
- No hidden transcript or reasoning capture.

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
- Module: `drift-detector-ambient.js`
- Specific receipt: `axm.drift-detector/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `NOT_REQUIRED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
