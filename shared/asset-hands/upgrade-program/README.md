# Asset Hands fifty-upgrade program

Status: **all fifty implementation contracts are executable; production
acceptance remains evidence-gated**.

This folder turns the fifty-item discovery roadmap into reusable build
material rather than a prose wishlist.

- `program.json` is the ordered dependency graph, acceptance contract and
  stable capability namespace for all 50 upgrades.
- `upgrade-registry.js` exposes those upgrades as a separate modular extension
  registry. The existing 34 creation-provider list remains unchanged.
- `planUpgradeHands()` composes multi-capability requests into a deterministic,
  dependency-ordered route instead of requiring one oversized provider.
- `upgrade-request.schema.json` routes capability + Target Canvas + output +
  constraint + operation + installed substrate requirements before execution.
- `upgrade-result.schema.json` makes `MISSING_HAND`, `UNSUPPORTED_CANVAS`,
  `MISSING_SUBSTRATE` and `REVIEW_REQUIRED` visible. It never selects a lossy
  fallback.
- `auditUpgradeHands()` returns one visible evidence status for each of the 50,
  including exact missing substrates, pass conditions and counterevidence.
- `foundation-index.js` exposes the 25 implementation modules used by the 50
  extension descriptors.
- `wave1-selftest.js` through `wave4-selftest.js` exercise the foundation,
  adapters and validators, creation depth, and advanced 3D/audio/video waves.
- `upgrade-registry-selftest.js` proves all 50 descriptors are mapped, canvas
  constraints affect pre-generation arguments, routing is deterministic, and
  unsupported or externally blocked requests fail honestly.
- `../substrate-pack/` pins thirteen external components with exact sizes,
  SHA-256 digests, licence-review state, safe local staging and live probes.
- `externalSubstrateInventory()` and the installed-substrate diagnosis/plan
  APIs replace caller assertions with server-observed capability state.
- The live validator and Godot executors bind fresh official-process reports
  to exact runtime and artifact digests without retaining local paths or
  temporary candidate files.

The implementation covers every upgrade contract and has executable test paths
for all fifty. This is deliberately different from claiming all fifty are
production-accepted: `MISSING` and `PARTIAL` in `program.json` remain the truth
where a native engine, independent standards validator, physical sample,
audible/visual review, or human authority receipt is absent. `READY` is
reserved for the declared native proof surface.

Integration is additive and backward-compatible:

- `asset-hands.js` preserves the original 34 providers, adds the independently
  admitted raster compositor as provider 35, and exposes
  `listUpgradeHands()`, `diagnoseUpgrade()`, `planUpgradeHands()`,
  `auditUpgradeHands()` and `invokeUpgrade()`.
- `upgrade-client.js` gives browser modules the same read-only catalog,
  diagnosis, composition-plan and audit surfaces through the local Workshop
  service. Execution remains on the installed runtime boundary.
- Asset Fabric v0.10 preserves capability routes and receipts without treating
  them as either approval seat.
- Studio v2.6 preserves canvas, recipe, provenance and capability receipts in
  an explicit, type-safe handoff. It does not auto-apply upgrade output.

Run the complete focused suite with:

```powershell
npm run test:asset-hands-upgrades
```

After an explicit local pack install, run the real external corpus with:

```powershell
npm run test:substrates-live -- --root C:\AXM_MIRROR_LOCAL\substrates\p0-v1
```
