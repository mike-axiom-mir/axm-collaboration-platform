# Grok Stewardship Receipt — 2026-07-24

Seat: separate physics stewardship agent in `C:\axm workshop`.  
Scope constraint honored: **only `shared/physics/**` was inspected for edit intent and only `shared/physics/**` was edited.** World Tile Foundry and all foreign trees remained read-only. No network, dependency installs, subagents, commits, pushes, package files, manifests outside this directory, state/logs/exports, desktop files, GitHub or persistent services were used.

Engine version remains `axm-physics-2d` **v0.3.1**. Solver behavior, touch policy, removal semantics, ID reuse, filter width, dimensions, solver method and scientific-validation claims were not altered.

## Three sequential passes

### 1. CONTACT CAPACITY RECEIPT — COMPLETE

**Outcome:** Additive diagnostics expose capacity accounting without raising the 2,048 cap or changing collision ordering/response.

**Implementation:**
- `CONTACT_CAPACITY = 2048` constant
- `contactCapacityReceipt(detected, stored)`
- Step records unique contacts before `slice`, then stores at most 2,048
- Diagnostics fields: `detectedUniqueContacts`, `contactsStored`, `contactsTruncated`, `contactCapacityLimit`, `contactCapacity`

**Receipt shape (`axm.physics-contact-capacity/v1`):**
- `detected`, `retained`/`stored`, `truncated`, `limit`
- `status`: `WITHIN_CAPACITY` | `TRUNCATED`
- `reason`: `WITHIN_CONFIGURED_LIMIT` | `ACTIVE_CONTACT_EVIDENCE_CAP`
- `prioritization`: `FIRST_DETECTED_UNIQUE_KEYS` (documents current slice order; not a new policy choice)

**Focused test:** `physics-capacity-receipt-adversarial.js`  
**Result:** `{"pass":2,"fail":0}`
- `capacity-receipt-below-cap` PASS
- `capacity-receipt-over-cap` PASS (2145 detected → 2048 stored → 97 truncated)

**Observation tie-in:**
- micro `contact-capacity-visibility` remains OBSERVATION with receipt present (`CAP_2048_WITH_EXPLICIT_CAPACITY_RECEIPT`)
- policy `capacity-receipt-gap` promoted to **PASS**

### 2. INPUT NORMALIZATION RECEIPT — COMPLETE

**Outcome:** Typed bounded evidence for existing coerce/clamp/fallback; permissive defaults unchanged.

**Implementation:**
- `number` / `text` / `vec` / `makeBody` / `createWorld` / `addBody` collect events only when inputs are provided or actively normalized
- Bounded receipt (`limit: 64`) on world: `normalizationReceipt`
- `addBody` also returns `normalizationReceipt`
- Event fields: `field`, `reason`, `input` (safely serializable `{kind,value}`), `result`
- Reasons include `CLAMP_MIN`, `CLAMP_MAX`, `NON_FINITE_FALLBACK`, `COERCED_NUMBER`, `ENUM_FALLBACK`, `STRICT_TRUE_ONLY`, `TRUNCATE_STRING`, `GENERATED_ID`

**Focused test:** `physics-normalization-receipt-adversarial.js`  
**Result:** `{"pass":2,"fail":0}`
- `normalization-behavior-unchanged` PASS (golden permissive outcomes)
- `normalization-receipt-evidence` PASS

**Observation tie-in:**
- micro `silent-normalization-map` remains OBSERVATION; `normalizationEventsExposed: true`
- micro truth: `normalizationDiagnosticsImplemented: true`
- strict rejection **not** implemented (explicit remaining product choice)

### 3. ADDITIVE HASH LINEAGE — COMPLETE

**Outcome:** Clearly separate digests; legacy `checksum(world)` algorithm and field preserved byte-for-byte in contract.

**Implementation (additive APIs + diagnostics):**
- `configurationHash(world)` — domain `axm.physics/configuration/v1` (schema, engine, gravity, timestep/solver/substeps, sleep, broadphase, constraints, bounds)
- `definitionHash(world)` — domain `axm.physics/definition/v1` (sorted body shapes, mass, materials, filters)
- `identityHash(world)` — domain `axm.physics/identity/v1` (sorted body id/type/enabled/sensor/allowSleep)
- `lineageHashes(world)` → `{schema:'axm.physics-lineage-hashes/v1',...}`
- Diagnostics also expose flat `configurationHash`, `definitionHash`, `identityHash`, nested `lineage`, and unchanged `checksum`

**Focused test:** `physics-hash-lineage-adversarial.js`  
**Result:** `{"pass":3,"fail":0}`
- `lineage-hash-stability` PASS
- `lineage-hash-field-sensitivity` PASS (config/definition/identity/position map)
- `lineage-legacy-checksum-preserved` PASS

**Observation tie-in:**
- micro `legacy-checksum-sensitivity-map` remains OBSERVATION (legacy scope unchanged)
- policy `signed-zero-authoritative-hash-gap` remains OBSERVATION (signed-zero authoritative state hash still absent)

## Files touched (only under `shared/physics/`)

| Path | Role |
| --- | --- |
| `axm-physics-core.js` | Capacity receipt, normalization receipt, lineage digests |
| `physics-capacity-receipt-adversarial.js` | New focused gate (pass 1) |
| `physics-normalization-receipt-adversarial.js` | New focused gate (pass 2) |
| `physics-hash-lineage-adversarial.js` | New focused gate (pass 3) |
| `physics-micro-verification.js` | Observation measurements + truth flags |
| `physics-policy-deep-dive.js` | `capacity-receipt-gap` → PASS |
| `selftest.js` | Policy summary 2 PASS / 7 OBSERVATION |
| `discovery-seam-review.js` | Matching policy summary expectations |
| `README.md` | Document additive diagnostics and focused gates |
| `PHYSICS_POLICY_OBSERVATIONS.md` | Update seams now partially closed |
| `PHYSICS_FACT_BASE.md` | Align truncation/normalization/hash statements with runtime truth |
| `GROK_STEWARDSHIP_RECEIPT_2026-07-24.md` | This receipt |

## Exact verification results

| Command | Result |
| --- | --- |
| `node shared/physics/physics-capacity-receipt-adversarial.js` | PASS 2/0 |
| `node shared/physics/physics-normalization-receipt-adversarial.js` | PASS 2/0 |
| `node shared/physics/physics-hash-lineage-adversarial.js` | PASS 3/0 |
| `node shared/physics/selftest.js` | **PASS** |
| `node shared/physics/physics-micro-verification.js` | 24 PASS / 0 FAIL / 12 OBSERVATION, budget pass |
| `node shared/physics/physics-policy-deep-dive.js` | 2 PASS / 0 FAIL / 7 OBSERVATION |
| `node shared/physics/discovery-seam-review.js` | **31 VERIFIED · 0 OPEN** |
| `node shared/physics/physics-manifold-adversarial.js` | PASS 4/0 (includes 2048 bound) |
| `node shared/physics/physics-canaries.js` | PASS 7/0 |

Baseline preserved green after additive work:
- selftest PASS
- micro 24 / 0 / 12
- policy 2 / 0 / 7 (capacity gap closed; remaining open seams stay observations)
- discovery 31 VERIFIED

## Compatibility

- Additive fields/APIs only; no removal of legacy surfaces
- Contact cap still 2048; collision order/response unchanged
- Normalization still permissive (no strict rejection mode)
- Legacy `checksum` not redefined
- Version remains `0.3.1`
- No touch-policy, solver-scheduling, removal, ID-reuse, filter-width, dimension, solver-method or scientific-validation claim changes
- No unbounded telemetry (capacity is fixed-size; normalization events capped at 64)

## Remaining gaps

1. Contact prioritization under truncation is still first-detected unique keys (documented, not redesigned).
2. Strict normalization rejection mode is not implemented.
3. Authoritative signed-zero / full numeric-state hash is still open (`signed-zero-authoritative-hash-gap`).
4. Full input-trace hash and predecessor-bound lineage hash from the proposal are not implemented (only configuration/definition/identity digests).
5. Open policy seams remain: exact touch, ID-order scheduling, removal terminal reason, generation/epoch, query boundaries, CCD attribution, rotation/joints validation capability.

## Explicit scope statement

**Only files under `shared/physics` were edited in this stewardship run.** No other workshop tree, tool, registry, package manifest, state file, export, desktop file, GitHub artifact or service configuration was modified.

## Independent manager acceptance

Codex reran JavaScript syntax checks, all three focused gates, the complete
adversarial set, canaries, micro verification, policy deep-dive, discovery seam
and `selftest.js`; all passed. The audit found and corrected stale proposal/deep-
dive labels that still described capacity receipts and all hash evidence as
unimplemented. No solver behavior or legacy checksum field was changed by that
documentation reconciliation.
