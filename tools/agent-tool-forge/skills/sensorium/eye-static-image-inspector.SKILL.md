---
name: eye-static-image-inspector
sense: static-sight
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: visual.inspect.static/v1
---

# Eye 1 - supplied image

Wrap a host-supplied static-image observation without claiming capture or motion proof.

## Inputs

- claim
- targetId
- hostObservation
- expectedFacts
- refutingFacts

## Procedure

1. Require an attributable host-supplied static observation.
2. Compare typed visible and absent facts with the bounded claim.
3. Return UNKNOWN for motion, timing, or live-state claims.
4. Seal a digest and retain no image bytes.

## Boundaries

- Does not capture an image.
- Does not infer motion from one image.
- Does not inherit host authority.

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

- Route: `HOST_MEDIATED`
- Module: `host-mediated-static-eye.js`
- Specific receipt: `axm.static-eye-observation/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `HOST_MEDIATED`
- Adapter: `DEGRADED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
