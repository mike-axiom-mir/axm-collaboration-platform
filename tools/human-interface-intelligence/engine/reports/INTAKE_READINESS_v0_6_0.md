# Module 2 v0.6.0 Intake Readiness

**Status: READY FOR BOUNDED LOCAL INTAKE; EXECUTION REMAINS DISABLED UNTIL LOCAL AUTHORITY ENABLES IT.**

## Ready

- Module code compiles and all 108 automated tests pass.
- The independent shared contract remains version `0.1.0` and the five locked dependency files match exactly.
- All ten shared fixtures pass the deterministic cross-module consistency gate.
- Recommendation, receipt, assurance, audit, signal-lab, and anchor reports validate against their current schemas.
- Invalid contexts, unsafe patterns, offline conflicts, duplicate registry IDs, duplicate JSON keys, non-finite JSON numbers, mismatched receipts, archive traversal, symbolic links, and bounded archive resource failures have negative coverage.
- The test suite is portable and does not rely on a separately mounted historic anchor.

## Conditional

- The latest real Module 1 stable anchor must be checked during local intake.
- Eight shared-fixture recommendations have Recommendation Assurance `REVIEW` findings. Those are implementation-readiness signals, not gate failures.
- Module 3 should treat assurance and shadow outputs as advisory evidence only.

## Blocked on purpose

- The historic Module 1 anchor remains blocked before record consumption.
- No recommendation or robustness probe is generated from that blocked anchor.
- Local execution, registry mutation, canon changes, and signal persistence are not authorized by this package.

## Intake command order

```bash
python VERIFY_BUNDLE.py
python -m axm_hii.cli verify-lock
python -m axm_hii.cli registry-check
python -m axm_hii.cli paired-gate <latest-handoff.json> --anchor <latest-module-one-anchor.zip>
python -m axm_hii.cli intake-audit <latest-handoff.json> --anchor <latest-module-one-anchor.zip>
```
