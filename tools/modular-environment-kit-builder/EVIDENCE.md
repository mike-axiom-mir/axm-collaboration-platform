# Evidence ledger

Status: accepted for its stated technical boundary on 2026-07-19.

## Automated evidence

- `node selftest.js` passes 146 checks.
- Twenty exact existing GLB source parts are digest-bound and re-inspected; all 20 have finite bounds, a ground-plane source pivot inside those bounds, and fit the shared 1×1 cell envelope.
- Ten deterministic 12×8 layouts have ten unique road signatures and reference 1,004 source instances without creating 1,004 new assets.
- Every placement uses integer XZ, Y=0, unit scale, 90° rotation, and `manualOffset: false`.
- Independent verification finds zero connector mismatches and zero grid gaps in all ten layouts.
- Three assembly families explicitly name floors, four facades, roofs, doors, interior sockets, prop sockets, variants, and intact/damaged pairs.
- Variant reuse is measured at 98.9%.
- Negative routes block a one-off 0.1-cell placement fix, a removed connector, and self-approved visual coherence.
- Deterministic receipt: `B7B2FC2C63231291BF26A9BC7D8159A0DFF2B1A08EE3C765F94FE9C39BBEFDC3`.

## Live browser evidence

- PASS 10/10 kit checks; source inventory PASS 20/20.
- Every live route—North Avenue, Civic Cross, Courtyard Ring, Twin Boulevards, Market Grid, Waterfront Branches, Arcade Court, T Junction, Zigzag Ward, and Old Town—reports 0 mismatches and 0 gaps.
- Top-down canvas review shows distinct, readable street networks, consistent building setbacks, shared facade rhythm, ground cells, and sparse prop markers. This is a live coherence review, not permanent human approval.
- At 780 x 900 the top region collapses to one 734.8px column with no horizontal overflow (`scrollWidth` 765). The console log is empty.

## Honest boundary

The ten layouts are reference assemblies and previews, not retained generated assets. Connector math cannot approve district silhouette, facade rhythm, prop density, or damage readability; the machine bundle keeps human approval false.
