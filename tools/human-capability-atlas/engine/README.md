# AXM Human Capability Atlas v0.11.0

**Evidence Chain Closure / Transactional Intake release**

Module One translates source capability declarations into human-readable,
teachable and searchable Capability Records while preserving source identity,
provenance, uncertainty and conflict.

v0.11 focuses on one question:

> Can local AXM prove that a large interrupted intake used the intended source,
> implementation and evidence, generated the expected deterministic artifacts,
> covered every planned record, and did not inherit stale completion claims?

## Stable boundary

- Module ID: `axm.module.human_capability_atlas`
- Module version: `0.11.0`
- Shared contract: `axm.capability-interface-contract`
- Supported shared-contract version: exactly `0.1.0`
- Capability Record export: `axm.shared-capability-record` `0.1.0`
- Merge authority: **none**

Module One still does not emit Module Two interface recommendations.

## One-command public-registry preparation

Use a read-only copy of the current AXM repository and a fresh output directory
outside that repository:

```bash
python -m axm_capability_atlas.cli discovery-verify   /path/to/read-only/axm-repository-copy   --output discovery_integrity_report.json

python -m axm_capability_atlas.cli axm-public-intake   /path/to/read-only/axm-repository-copy   --output /path/to/fresh/atlas-intake   --batch-size 100
```

Do not start mass production unless:

```text
AXM_PUBLIC_INTAKE_SUMMARY.json -> READY_FOR_BATCH_PRODUCTION
```

A successful preparation writes, among other artifacts:

```text
capability_registry_source_seal.json
normalized_sources/
normalized_inventory.json
analysis/discovery_integrity_report.json
analysis/enrichment_catalog.json
analysis/identity_report.json
analysis/capability_graph.json
reports/enrichment_report.json
reports/human_capability_targets.json
reports/dependency_reference_targets.json
reports/registry_role_review_targets.json
registry_snapshot.json
public_intake_preflight.json
batch_plan.json
```

## Verify before production

```bash
python -m axm_capability_atlas.cli preflight-verify   /path/to/fresh/atlas-intake   --repository-root /path/to/read-only/axm-repository-copy

python -m axm_capability_atlas.cli batch-plan-verify   /path/to/fresh/atlas-intake/batch_plan.json   /path/to/fresh/atlas-intake
```

The public preflight binds the repository snapshot plus all required generated
intake artifacts. A dirty Git worktree is a hold by default. `--allow-dirty` is
an explicit exception; exact file hashes remain binding.

## Deterministic batch production

```bash
python -m axm_capability_atlas.cli batch-build   /path/to/fresh/atlas-intake/batch_plan.json   /path/to/fresh/atlas-intake   batch_0001   --output /path/to/atlas-batches

python -m axm_capability_atlas.cli batch-verify   /path/to/fresh/atlas-intake/batch_plan.json   /path/to/fresh/atlas-intake   batch_0001   --output /path/to/atlas-batches
```

Repeat only the batches defined by the plan. Resume is receipt-verified; an
existing folder is never trusted merely because it exists.

## Transactional finalization

```bash
python -m axm_capability_atlas.cli batch-finalize   /path/to/fresh/atlas-intake/batch_plan.json   /path/to/fresh/atlas-intake   --output-root /path/to/atlas-batches   --manifest /path/to/production_run_manifest.json

python -m axm_capability_atlas.cli production-verify   /path/to/production_run_manifest.json

python -m axm_capability_atlas.cli production-chain-verify   /path/to/production_run_manifest.json   /path/to/fresh/atlas-intake/batch_plan.json   /path/to/fresh/atlas-intake   --output-root /path/to/atlas-batches
```

Finalization removes an older manifest before starting. If finalization fails,
an in-progress marker remains and the old completion claim cannot survive.

## What a producer receipt proves

Producer receipt `0.2.0` binds:

- exact normalized source bytes and portable semantic hash;
- exact Module One implementation/schema fingerprint;
- Capability Card canonical hash;
- every deterministic derived artifact and its bytes/hash;
- deterministic regeneration of learning atoms, course plan and human views;
- schema, stable evidence and provenance validation results;
- actual producer run ID/time;
- receipt self-hash.

It proves that this Module One implementation produced and verified that artifact
set from the identified normalized source.

It does **not** prove that the declared capability successfully executed in the
world.

## Exact versus semantic hashes

v0.11 deliberately carries both:

- **exact hashes** for the frozen run bytes, paths and evidence;
- **semantic hashes** that remove relocation/verification-time fields where
  appropriate.

Fresh equivalent intakes can therefore share semantic plan/preflight/inventory
identity while retaining different exact run evidence.

## Incomplete-run markers

The following markers mean the corresponding operation is not complete:

```text
.ingest_in_progress.json
.public_intake_in_progress.json
.build_in_progress.json
.batch_in_progress.json
<production_manifest>.in_progress.json
```

A marker is evidence of an interrupted/failed transaction, not a file to ignore.

## Implementation fingerprint

```bash
python -m axm_capability_atlas.cli implementation-info
```

The fingerprint covers installed Python source and bundled schemas that affect
Module One behavior. It excludes docs, tests, caches and machine paths.

It is integrity evidence, not a digital signature. v0.11 also does not claim
bit-for-bit equivalence across arbitrary Python/jsonschema runtime versions;
receiving systems revalidate the complete artifact chain under their own bound
Module One installation.

## Current verification before freezing

- 135 pytest tests passed.
- 0 failed.
- 0 skipped.
- all bundled schemas are valid and byte-mirrored between source/install trees;
- compileall passed;
- adversarial tests cover receipt/artifact rehashing, source/preflight drift,
  interrupted producer/batch/ingest/public-intake/finalization transactions,
  manifest/plan substitution and post-finalization artifact tampering.

The exact frozen ZIP is independently retested before inclusion in the final
local-intake bundle.

## Honest boundary

The complete real current AXM registry has **not** been run through v0.11 in this
environment. The actual provider-backed/dependency split and real usable
Capability Coverage remain local-intake outputs.

Module Two, Module Three and local Merge Gate have not accepted this release.
