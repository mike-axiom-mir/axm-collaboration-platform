# Action Report: Physics Micro Verification

Date: 2026-07-19  
Status: COMPLETE — observation-only integration  
Target: `shared/physics/axm-physics-core.js` v0.3.1

## Outcome

The two supplied archives were integrity-checked, their v0.2.2 findings were
re-audited against the local v0.3.1 core, primary-source metadata was checked,
and a bounded executable verification layer was added. Solver behavior,
defaults, serialization and the legacy checksum were not changed.

The micro suite reports `PASS_WITH_OBSERVATIONS`: 24 pass, 0 fail and 12
explicit observations across 36 checks. It stays within 2,980 body-steps,
including one declared 66-body, one-step capacity exception.

## Input provenance

| Archive | SHA-256 | Internal manifest |
| --- | --- | --- |
| `AXM_PHYSICS_CORE_FACT_PACK_v0_1_2026-07-19.zip` | `453655F576EABF2A9B0ACA6E829D7B5F52E864F2550E20159F45EBE609E26442` | 3/3 payload hashes matched |
| `AXM_PHYSICS_CORE_LIGHTWEIGHT_ADDENDUM_v0_2_2026-07-19.zip` | `68D1974E1A6E19E1420DDEBE73F675100C5A724D89B687DD4B25BD4C2E44CD78` | 4/4 payload hashes matched |

Both archives contain text/JSON evidence only. Both target v0.2.2, while the
local engine is v0.3.1; old intake instructions were therefore not executed as
a patch or downgrade.

The supplied S10 metadata joined the title “Concepts of Model Verification and
Validation” to OSTI record 901974. That record is actually “Verification and
validation benchmarks”; the intended-title record is 835920. The local source
register preserves and corrects this discrepancy rather than silently carrying
it forward.

## Added evidence

- `shared/physics/physics-micro-verification.js`: executable exact, invariant,
  metamorphic, lifecycle, robustness and capacity probes.
- `shared/physics/PHYSICS_SOURCE_REGISTER.json`: sources, authority classes,
  supported claims, limits and corrected provenance.
- `shared/physics/PHYSICS_FACT_BASE.md`: versioned fact/policy/verification
  boundary.
- `shared/physics/PHYSICS_POLICY_OBSERVATIONS.md`: unresolved behavior seams and
  promotion gate.
- `shared/physics/PHYSICS_HASH_LINEAGE_PROPOSAL.md`: additive receipt design;
  proposal only.
- `shared/physics/PHYSICS_MICRO_VERIFICATION_REPORT.json`: compact reproducible
  receipt.

The physics README, self-test and Discovery seam review are wired to keep this
evidence executable and prevent it from being mistaken for a behavior release.

## Highest-value observations

1. Exact-touch behavior remains pair-specific: circle/circle and box/box reject
   exact tangency; circle/box reports it.
2. A bijective body-ID rename can change a low-iteration stack because IDs
   influence sequential solver order.
3. Removing one body clears all contact lineage; an unrelated surviving contact
   emits a fresh `ENTER` next step.
4. The legacy checksum is a narrow state hash and ignores configuration,
   shapes, materials, filters, pending force and bounds.
5. Contact/manifold evidence caps at 2,048 without a truncation diagnostic.
6. Input normalization is silent, and filter bit support stops at bit 30.

These are evidence-backed design seams, not authorized fixes.

## Verification commands

```text
node shared/physics/physics-micro-verification.js
node shared/physics/selftest.js
node shared/physics/discovery-seam-review.js
node shared/physics/physics-adversarial.js
node shared/physics/physics-repeat-adversarial.js
node shared/physics/physics-broadphase-adversarial.js
node shared/physics/physics-manifold-adversarial.js
node shared/physics/physics-warm-start-adversarial.js
node verify.js
```

Final results are recorded after the integration run below. A passing suite is
software verification within these cases; it is not experimental validation of
real-world physics.

## Compatibility and rollback

- Core version remains 0.3.1.
- Warm start remains explicit and default-off.
- New worlds retain spatial hash; migrated legacy worlds retain documented
  all-pairs provenance.
- No Git or GitHub operation was performed.

Rollback is additive: remove the six evidence artifacts and revert only their
small README/self-test/Discovery references. Do not replace or downgrade the
v0.3.1 solver.

## Test receipt

- Micro verification: 24 pass, 0 fail, 12 observations; budget pass.
- Physics core self-test: pass.
- Physics adversarial: 4 pass, 0 fail, 1 timing observation.
- Repeat adversarial: 4 pass, 0 fail.
- Broadphase adversarial: 3 pass, 0 fail.
- Manifold adversarial: 4 pass, 0 fail.
- Warm-start adversarial: 6 pass, 0 fail.
- Discovery seam review: 27 verified, 0 open.
- Workshop verifier: 0 fail, 30 pre-existing repository warnings; no physics
  failure was reported.
