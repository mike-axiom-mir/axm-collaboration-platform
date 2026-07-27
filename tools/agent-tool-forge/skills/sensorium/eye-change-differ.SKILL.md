---
name: eye-change-differ
sense: comparative-sight
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: visual.diff.between-stills/v1
---

# Eye 3 - before/after change differ

Compare two attributable typed observations of the same target at different times and report exactly what changed without inferring why.

## Inputs

- claim
- targetId
- beforeObservation
- afterObservation
- expectedChange
- refutingChange

## Procedure

1. Require two attributable typed observations of the same target with ordered timestamps.
2. Require the same fact identifiers at both times, using present=false for known absence.
3. Classify each fact as SAME, CHANGED, APPEARED, or DISAPPEARED.
4. Treat an optional structural-hash delta as corroborating evidence only.
5. Judge only the named expected or refuting change and seal value digests without raw values.

## Boundaries

- Does not capture or interpret an image.
- Does not infer the cause of a change.
- Does not compare different targets or incomplete fact dimensions.
- Does not treat one observation as a change.
- Does not retain supplied fact values or inherit host authority.

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
- Module: `eye-change-differ.js`
- Specific receipt: `axm.visual-change-observation/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `NOT_REQUIRED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
