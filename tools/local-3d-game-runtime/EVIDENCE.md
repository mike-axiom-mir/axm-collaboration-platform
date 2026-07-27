# Evidence ledger

Status: P0 integration and first-polish gate passed on 2026-07-19 through `/tools/local-3d-game-runtime/index.html`.

## Automated evidence

- `node selftest.js` passes 59 checks.
- The runtime re-parses and digest-checks five GLBs plus three same-origin external texture payloads.
- External pack textures require a declared digest; cross-origin texture URIs are refused.
- The P0 cell contract contains ten unique ranked module identities and keeps `libraryPromotion: off`.
- Deterministic replay, animation sampling, normalized 64-matrix skin palette, objective completion, and pause-freeze checks remain passing.

## Live browser evidence

- The playable frame visibly contains the textured storefront, animated pedestrian, modular commercial building, hatchback, foliage, player, and three beacons.
- Five exact local assets load successfully; the three pack assets report `0 embedded · 1 digest-bound local texture` rather than being mislabeled embedded.
- Ready workload is 53 draw calls and 11,566 triangles.
- Start plus eight quick W taps moved the player from Z +8.000000 to +6.240000; phase stayed playing. Pause froze the runtime at tick 81.
- Ten of ten P0 modules are visible in the production-cell panel as live, verified, candidate, gating, kit, or current-machine-profile states.
- Production-cell SHA-256: `7A53715B795D778898B6B4A1AA0ACB70F30338A1F28041BFAE426453AAED169F`.
- At 780 x 900 the runtime and two-column command panel have no horizontal overflow (`scrollWidth` 765); all ten cell entries remain present. Console log is empty.

## Connected receipts and boundaries

The cell exposes the accepted receipts from the round-trip bridge, material baker, optimizer, UV studio, LOD builder, technical-art validator, retargeting studio, modular kit, and integrated performance profile. Connection is not promotion: material, topology, UV, LOD, collision, pivot, and visual approvals remain open where their owning module says so.

Full 3D collision/physics remains roadmap module #17. Persistence, multiplayer, automatic publishing, and automatic library promotion are not implemented, and the current PS2-rung scene is not presented as PS3 quality.
