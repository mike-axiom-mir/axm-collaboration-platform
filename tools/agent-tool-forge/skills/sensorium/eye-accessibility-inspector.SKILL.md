---
name: eye-accessibility-inspector
sense: accessible-sight
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: visual.inspect.accessibility/v1
---

# Eye 4 - accessibility floor inspector

Measure bounded live or supplied presentation properties against the AXM accessibility floor and flag violations without restyling or claiming a full audit.

## Inputs

- claim
- targetId
- measuredProperties
- floorPolicy
- observedAt

## Procedure

1. Read bounded supplied measurements or request them from an injected exact-target computed-style adapter.
2. Reuse Visual Kernel contrast math and apply the declared floor: 4.5:1 normal text, 3:1 large text and UI components, 44px targets, critical text at least 10px, and a visible equal for sound signals.
3. Attach the measured number to every PASS, FAIL, or UNKNOWN rule result.
4. Return UNKNOWN for missing or invalid property groups; partial input is never a silent PASS.
5. Seal typed measurements, release the supplied set, and take no direct action.

## Boundaries

- Does not restyle, repair, or auto-adjust a surface.
- Does not read text content, content meaning, or judge taste.
- Does not claim WCAG certification or a full accessibility audit.
- Does not retain raw pixels or the supplied property set.
- A missing per-use adapter, incomplete element coverage, gradients, background images, transparency, or ancestor opacity remain explicit UNKNOWN results.

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
- Module: `eye-accessibility-inspector.js`
- Specific receipt: `axm.visual-accessibility-observation/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `AVAILABLE`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
