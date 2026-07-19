# AXM Evidence Retention Spine

This service keeps the Workshop's machine-readable memory useful as the body grows.

Its rule is:

> Append truth. Seal sessions. Summarize repetition. Preserve evidence of compaction.

## What it does

- Consequential events such as permission changes, consent, refusals, votes, promotion, repair, release, restore and failure remain exact.
- Meaningful work events remain exact inside a hash-chained session segment.
- Repeated telemetry such as indexing, polling, status samples and heartbeats becomes a counted rollup with first/last timestamps and sample digests.
- Existing JSONL files are registered with their byte size, line count and SHA-256 digest. They are not rewritten or deleted.
- Closing the server seals the current segment and writes a summary manifest with the segment SHA-256 and last event-chain hash.
- Interrupted open segments are verified and sealed as recovered evidence at the next start.
- Technical Glasses reads the retained-evidence state so a new AI task can see what evidence exists without crawling every historical line.

Mirror's learning journal is not migrated by this version. The policy records that boundary explicitly.

## Machine routes

- `GET /api/evidence-retention` returns the current session, sealed-session totals, legacy sources, telemetry rollups, classifications and a package-retention preview.
- `POST /api/evidence-retention/seal` seals the active session. It requires `x-axm-evidence: explicit-seal`.
- Existing diagnostic log routes combine sealed legacy tails, recent exact events and telemetry rollups.

## Package retention

The package plan is deliberately preview-only. It recommends a latest unpacked copy plus daily, weekly, monthly and pinned ZIP tiers, but this first version never deletes an existing artifact. Deletion needs a separate explicit, reviewed action after restore behavior is proven from ZIP-only packages.

## Verification

Run:

```text
node shared/evidence-retention/selftest.js
```

The selftest proves legacy preservation, telemetry rollup, exact-event retention, session sealing, hash evidence, machine-readable tails and non-destructive package planning.
