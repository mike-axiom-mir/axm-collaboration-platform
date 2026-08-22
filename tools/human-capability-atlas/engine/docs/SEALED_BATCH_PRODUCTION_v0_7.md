# Sealed Batch Production — v0.7.0

## Problem

A registry around 1,800 capabilities is too large to treat as one fragile
single-session job. Restarting from zero wastes compute; splitting work manually
creates overlap and gaps; a Git push during a long intake can mix two source
states.

## Chain of custody

```text
Raw registry copy
  -> source_seal.json
  -> sealed normalization / identity analysis
  -> deterministic batch_plan.json
  -> batch_XXXX/batch_receipt.json
  -> production_run_manifest.json
  -> Merge Gate review
```

Every stage references the state before it.

## Source seal

The seal stores each supported source file's relative path, byte length, and raw
SHA-256. Absolute root location and generation timestamp are not part of the
seal hash, so the same read-only copy can be moved without changing identity.

Ingestion can enforce the seal before and after processing. If the source tree
changes during the run, the intake is held.

## Portable record key

Batch allocation uses:

- capability ID;
- capability revision;
- raw source SHA-256;
- source pointer / JSONL line.

Absolute filesystem location is deliberately excluded.

## Semantic normalized hash

A normalized record is sealed semantically. Only `source_location` and
`last_verified_at` are excluded so a read-only registry copy can be relocated or
re-verified without changing its batch identity.

A change to actual capability meaning, revision, source hash, pointer, evidence,
inputs, outputs, risks, relationships, or other normalized semantics changes the
hash and invalidates the old plan.

## Deterministic batches

Records are sorted deterministically and split by requested batch size. The
plan records every member and a batch hash. The full plan has its own hash.

A 1,800-record registry at batch size 100 yields 18 exact batches.

## Worker return

A batch folder contains per-record outputs and `batch_receipt.json`. Output paths
inside the receipt are relative to the batch root, so the completed batch can be
moved between machines/sandboxes and still verified.

The verifier rejects absolute paths and path traversal outside the batch root.

## Finalization

Finalization checks:

- the batch plan itself;
- current normalized source alignment;
- every expected batch receipt;
- every per-record producer receipt;
- Capability Card canonical hashes;
- exact batch membership/order;
- no missing planned records;
- no extra records;
- no duplicated verified record keys;
- clean sealed upstream ingestion.

Only then can the production run become `COMPLETE_VERIFIED`.

`merge_claim` remains false. Merge acceptance belongs to AXM Merge Gate.
