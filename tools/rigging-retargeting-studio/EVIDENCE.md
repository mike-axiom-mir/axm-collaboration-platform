# Evidence ledger

Status: accepted for its stated technical boundary on 2026-07-19.

## Automated evidence

- `node selftest.js` passes 47 checks.
- Exact source: animated pedestrian SHA-256 `B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63`, 1,355,364 bytes.
- All 31 source joints map one-to-one to unique canonical roles; missing mapping is a blocking negative test.
- All 22 source clips are represented for both tall/narrow and compact/broad targets (44 measured target clips).
- 8,354 weighted vertices independently retain normalized four-weight sums.
- Rest-pose changes for all 31 joints, foot IK targets, knee poles, hinge constraints, and three gameplay sockets are explicit.
- Repeat construction yields the same receipt `99E8FBA66D9F72F9DE2E3B089A11D99307013B632B94B0BF4C5F953AF7E50284`.
- The independent verifier blocks a missing joint mapping, negative measurement, or self-approved deformation claim.

## Live browser evidence

- PASS 11/11 independent checks; 31/31 mapped; 22 clips available.
- The target rig-space heights are visibly and numerically distinct: tall 1.076× source; compact 0.963× source.
- The default walk probe reports 0.94 cm/s tall and 0.77 cm/s compact contact slide; the run route reports 2.75 cm/s and 2.25 cm/s. Copied joint rotations measure 0.000° angular error.
- The canvas animates source, tall, and compact bodies together with one shared screen scale, so the proportion difference is not normalized away.
- At 780 x 900 the page collapses to a single 734.8px column with no horizontal overflow (`scrollWidth` 765). The console log is empty.

## Honest boundary

Contact and rotation measurements are technical evidence, not deformation approval. Extreme poses, foot contact quality, joint collapse, and silhouette readability remain explicitly unapproved human-review claims.
