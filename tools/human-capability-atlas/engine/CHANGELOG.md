# Changelog

## 0.11.0 — Evidence Chain Closure and Transactional Intake

This release does not expand the shared Capability Record contract. It hardens
how Module One proves what was built, from which normalized source/evidence,
with which exact implementation, and whether a multi-stage run actually
completed.

### Exact implementation identity

- Added an implementation fingerprint over the installed Module One Python
  source and bundled JSON Schemas that affect runtime behavior.
- Producer receipts, batch plans, batch receipts, public-intake preflights and
  production manifests bind that fingerprint.
- Added `implementation-info` for machine inspection.

The fingerprint is source/schema integrity evidence. It is not a publisher
signature and does not authenticate a human actor.

### Producer artifact closure

Producer receipt format is now `0.2.0`.

Each producer receipt binds the complete deterministic record output set:

- `capability_card.json`
- `learning_atoms.json`
- `course_plan.json`
- `quick_view.md`
- `practical_view.md`
- `deep_view.md`

Verification checks:

- exact artifact membership/order;
- byte size and SHA-256;
- aggregate artifact-set hash;
- receipt self-hash;
- Capability Card canonical hash;
- shared schema/evidence/provenance conformance;
- deterministic regeneration of learning atoms, course plan and all three human
  views from the Capability Card.

A convincing but re-hashed presentation artifact is therefore still rejected
when it does not match deterministic regeneration.

### Crash-safe producer and batch state

- An existing producer receipt is invalidated before rebuilding output.
- `.build_in_progress.json` remains on producer failure.
- An existing batch receipt is invalidated before batch work.
- `.batch_in_progress.json` remains on batch failure.
- A receipt is accepted only when the relevant in-progress marker is absent.

### Complete normalized-source inventory

Added `normalized_inventory.json` and schema version `0.1.0`.

It binds every accepted normalized record before planning with:

- exact normalized file bytes/hash;
- deterministic record key;
- capability ID/revision;
- source hash/pointer/line;
- portable normalized semantic hash;
- exact inventory hash;
- semantic inventory hash.

This closes the gap between accepted-record reports and the complete normalized
source directory.

### Public-intake preflight

Added `public_intake_preflight.json`, format `0.1.0`.

The preflight binds the repository snapshot and all required discovery,
enrichment, identity, graph, role-target, ingestion, gate, snapshot and
normalized-inventory artifacts before a batch plan is accepted.

It contains:

- exact preflight hash;
- semantic preflight hash;
- repository snapshot/dirty-state evidence;
- discovery bundle hash;
- source seal hash;
- normalized exact/semantic inventory hashes;
- enrichment catalog/source-seal hashes;
- target partition/counts;
- blockers/warnings;
- `merge_claim: false`.

New command: `preflight-verify`.

Dirty Git worktrees are held by default. `--allow-dirty` is explicit and still
binds exact file bytes.

### Exact and semantic batch plans

Batch plan format is now `0.2.0`.

Plans contain:

- implementation fingerprint;
- exact plan hash;
- semantic plan hash;
- full upstream ingestion/preflight anchor;
- normalized exact/semantic inventory hashes;
- deterministic record descriptors and batch hashes.

The semantic plan hash excludes relocation/run-time fields where appropriate;
the exact hash preserves the actual frozen run evidence.

### Batch and production evidence

Batch receipt format is now `0.2.0`.

Production manifest format is now `0.2.0`.

- Batch results bind producer receipt hash, artifact-set hash, card hash and run
  ID per record.
- Final manifests bind exact/semantic plan hashes, implementation fingerprint,
  source seal, upstream evidence, batch receipt hashes and exact record
  membership.
- Added `production-chain-verify` to re-check normalized source -> plan ->
  batches -> producer receipts -> production manifest.
- Added transactional `batch-finalize`: old completion evidence is removed
  before work; a finalization marker remains on failure; the written manifest is
  re-read and full-chain verified before the marker is removed.
- `production-verify` and `production-chain-verify` reject an active finalization
  marker.

`COMPLETE_VERIFIED` proves complete evidence-chain coverage. It does not prove
runtime capability behavior and does not grant Merge Gate authority.

### Transactional intake markers

- `.ingest_in_progress.json`
- `.public_intake_in_progress.json`
- `<production_manifest>.in_progress.json`

Earlier completion artifacts are invalidated before a new attempt. Downstream
verification holds when an incomplete marker remains. Internal planning can
ignore its own active preparation marker only during the same controlled
transaction; external verification cannot.

### Read-only repository snapshot

The public preflight records Git commit/branch/dirty metadata when available,
using read-only Git commands. Where Git metadata is unavailable, exact discovery
and source/enrichment byte hashes remain the authority.

### Schema and installation integrity

- Added schemas for repository snapshot, public preflight and normalized
  inventory.
- Root and installed-package schemas are byte-mirrored and schema-validated.
- Atomic writes fsync the file and directory where supported.

### Compatibility

- Module ID remains `axm.module.human_capability_atlas`.
- Module version is `0.11.0`.
- Shared contract remains exactly `axm.capability-interface-contract` `0.1.0`.
- Capability Record export remains `axm.shared-capability-record` `0.1.0`.
- No private shared-contract fork.
- Module-specific receipt/plan/manifest formats moved to `0.2.0`.

## 0.10.0

Added discovery-integrity verification, provider-backed versus dependency
registry roles, proof ceilings, role-aware learning/coverage and deterministic
humanization seeds.

## 0.9.0

Added deterministic provider/module evidence enrichment for the sparse public
capability registry.
