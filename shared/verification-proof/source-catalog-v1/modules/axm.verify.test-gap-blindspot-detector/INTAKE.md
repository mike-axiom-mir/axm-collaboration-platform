# Local Intake Card — Test Gap and Blind-Spot Detector

- **Module ID:** `axm.verify.test-gap-blindspot-detector`
- **Seed:** 050/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/test_gap_blindspot_detector.py`
- **Primary class:** `TestGapBlindspotDetector`
- **Operation:** `analyze`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Identify untested requirements, missing proof kinds, uncovered risk boundaries, stale fixtures, missing native evidence, and circular proof dependencies.

## Optional upstream organs

- `axm.verify.proof-freshness-expiry-policy`
- `axm.verify.requirement-coverage-mapper`
- `axm.verify.requirement-traceability-graph`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
