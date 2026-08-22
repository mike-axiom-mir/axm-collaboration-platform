# Simulation/Living Systems — Runs 03–102 local intake

This lane preserves and independently validates the supplied upload-safe archive, then exposes its useful static design evidence to the Workshop's game-organism pipeline. The source remains a working candidate: not an executable simulation runtime, not integrated into authoritative world state, not released, and not CANON.

## What is working

- The original ZIP is retained byte-for-byte under `source/`.
- ZIP paths, duplicate names, CRCs, extracted-tree parity, and all 30,625 manifest-listed SHA-256 digests validate.
- All 30,372 JSON documents and 5,000 records across 50 JSONL files parse.
- The corpus contains 100 module blueprints across 10 families, with 400 planned operations, 366 required provider edges, 128 optional hooks, and no required-interface cycle.
- Each module retains 100 steward overlays for Runs 03–102, 90 profiles for Runs 13–102, and 100 run-specific refusal fixtures.
- `shared/game-organism/sim-living-evidence.js` composes the source registry into a candidate-only game evidence organ.
- `game-wiring.js` maps all 100 modules into Game Capability Atlas planning leads and a directly importable DRAFT Game Forge project.
- All 100 blueprints are preserved as evidence-bearing candidate artifacts in a frozen, restorable Experiment World checkpoint.
- Two 50-operation living-world preview batches pass the live multiworld receiver normalizer. No world ID or revision is supplied and `apply` is never called.
- Verification Spine receives 100 passing static-transport claims and 100 `MISSING_VALIDATOR` runtime claims, so the aggregate verdict honestly remains `HELD`.

## Useful game-design coverage

The ten families cover simulation identity and state; entities and agents; ecology; economy; society; traffic and infrastructure; weather and hazards; missions and emergence; replay and verification; and multiworld orchestration. Family routes point to existing Workshop world, game, state, experiment, and verification seams, but do not silently register or execute the source modules.

The generated Game Forge candidate is `evidence/game-forge-project.json`. It
uses Game Forge's existing portable project schema and can be inspected through
the tool's explicit **Import project** action. The other generated handoffs are
under `evidence/` with a digest-bearing summary in
`evidence/game-wiring-receipt.json`.

## Holds and limits

- The source contains contracts, schemas, profiles, overlays, and negative fixtures—not module implementation code. All 100 final handoffs score implementation, runtime testing, integration, release, and CANON as zero.
- Per-module manifest summaries stop at Run 72 and `steward_index.json` summaries stop at Run 42, while hash-verified artifacts and final handoffs continue through Run 102. Both summary-index lags remain explicit holds.
- The historical completeness report describes a prior checkpoint and carries a digest different from both the supplied repack and the root repack manifest's source-archive digest.
- There are zero exact source module or operation ID matches in the current live Workshop registries; bounded adapters are required.
- No behavioral correctness, representative performance, scientific validity, traffic/disaster safety, authoritative-world migration, gameplay quality, publication, or release claim is made.

## Verify

```powershell
node shared/game-organism/source-evidence/sim-living-run102/game-wiring-selftest.js

The full source corpus, intake driver, and supplier intake self-test remain in
the local intake archive. The Workshop retains only the bounded static
registry, derived wiring artifacts, and trusted wiring self-test here.
node shared/game-organism/sim-living-evidence-selftest.js
npm.cmd run test:game-organism
```

Evidence is under `evidence/`. Mike remains the human integration, CANON, publication, and release gate.
