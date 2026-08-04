# Module Footprint & Storage Pressure Observatory test report

Status: `PASS` for 35 focused fixture and live Workshop checks. Integrated
module remains `TEST`; no cleanup authority was added.

## Focused proof

- The original module-footprint map remains compatible and metadata-only.
- Two explicit roots are counted without exposing their absolute paths.
- Symlinks are listed and never followed.
- Eight operational retention classes are deterministic and
  `UNCLASSIFIED` remains protected by default.
- Same-size candidates require equal SHA-256 before becoming an exact
  duplicate group.
- Cluster-rounded allocated bytes are labeled an estimate, not exact sparse
  or compressed allocation.
- Separately timed snapshots produce a growth delta; a first run remains
  `BASELINE_ONLY`.
- Fixture receipts before and after the scan match; the core contains no
  delete, truncate, rename, or link operation.

## Live D baseline

Measured 2026-07-31 over the active Workshop and branched Mirror roots:

- 138,499 files, 13,999 directories;
- 13,750,743,404 logical bytes;
- 14,109,597,696 cluster-rounded estimated allocated bytes;
- 358,854,292 bytes of estimated allocation overhead;
- 5,234 files in the selected session, telemetry, and temporary scope;
- 4,140 same-size candidates hashed, totaling 100,205,810 bytes;
- 266 exact duplicate groups and 502 redundant logical paths;
- 10,281,414 proven redundant physical bytes in the selected scope;
- zero read issues, zero skipped-by-limit files, and complete selected-scope
  hash coverage;
- whole-root duplicate coverage remains explicitly false.

The unbounded all-class pass exceeded the one-hour interactive safety window
and produced no report. Its orphaned process was identified and stopped. That
result is recorded as an operating constraint, not disguised as proof.

The baseline selected no keep/delete path and performed no deletion,
hardlinking, compression, packaging, permission change, promotion, or CANON
change.
