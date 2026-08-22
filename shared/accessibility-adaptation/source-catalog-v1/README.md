# AXM Accessibility & Adaptive Interfaces — curated 100-packet intake

This is the deduplicated local-intake portion of
`AXM_ACCESSIBILITY_ADAPTIVE_INTERFACES_100_CORE_RUNS_FINAL_POLISHED_LOCAL_INTAKE.zip`.

## Accepted

- 100 disabled accessibility and adaptive-interface packets in ten families.
- Eight reviewed-stage package maps.
- 412 retained source files, all with distinct SHA-256 content hashes.
- The packet index, source validator, and every declared packet digest pass.

The packets are useful specifications and planning inputs. They are not proof
of real accessibility effect, assistive-technology compatibility, production
readiness, or standards conformance. Every source packet says `DISABLED` and
`NOT_PROVEN` at intake.

## Integrated use

AXM Accessibility Adaptation Lab exposes the complete packet catalog, bounded
goal-to-module planning, and an explicit local preview for six low-risk display
preferences. Preview settings affect only the lab and are stored only in the
browser. No diagnosis, global platform mutation, automatic activation, or
conformance claim is performed.

## Excluded from the platform intake

- Nested checkpoint and local-intake ZIPs.
- 26 packaged Python bytecode files.
- Repeated deep-run lineage and generated runtime artifacts.
- 23 redundant file copies across 13 exact-content duplicate groups, totaling
  29,437,145 bytes.

The original archive is unchanged and remains the rollback source.

## Verify

```powershell
node shared/accessibility-adaptation/source-catalog-v1/intake-selftest.js
python -B shared/accessibility-adaptation/source-catalog-v1/validate_intake.py
```
