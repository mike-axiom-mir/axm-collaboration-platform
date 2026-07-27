# Evidence ledger

Status: v0.1 acceptance gate passed on 2026-07-19 through the local Hub server.

- 78 automated checks pass against the exact storefront GLB.
- All 3,496 triangles retain primary UV0; 266 repeating/out-of-range source triangles remain explicitly reported.
- UV1 authors 3,496 deterministic isolated charts with zero overlap and zero out-of-range islands across 28 material/primitive contracts.
- At 1024² with 4 px base padding, mip 3 retains 0.5 px. Receipt: `601087FBCF58A955D9FDD9B189CF68BFFFB5E6CD355BF2332CB69948172FDB82`.
- A live alternate 2048² / 8 px profile remains 10/10 PASS and gives 1.0 px at mip 3. Receipt: `22618D13B446A7E2127D6C3F637B426AE758F7776B56176E579D36C507038EA3`.
- The live UI shows both UV0 and UV1 layouts, the full density range (291–18,618 px/unit at 1024²), conservative 13.7% atlas utilization, and the required human checker/light-bake gate.
- Desktop and 780 × 900 layouts remain readable; browser console reported zero errors/warnings.

Boundary: one-triangle-per-chart is deliberately safe but inefficient. Future chart merging should improve utilization without weakening overlap, padding, or source-attribute evidence.
