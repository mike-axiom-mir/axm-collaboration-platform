---
name: touch-environment-probe
sense: touch
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.environment.touch/v1
---

# Touch - environment probe

Probe only named OS, path, separator, and tool assumptions without installing or repairing.

## Inputs

- os
- separator
- paths
- tools

## Procedure

1. Read declared assumptions.
2. Probe only exact named items.
3. Diff assumed and actual.
4. Return mismatches or unknown holds.
5. Release probe material.

## Boundaries

- No home-directory enumeration.
- No install or repair.
- No wildcard path.

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
- Module: `touch-environment-probe.js`
- Specific receipt: `axm.touch-environment-probe/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `AVAILABLE`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
