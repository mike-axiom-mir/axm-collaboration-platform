# Model Shadow local possession checkpoint witness steward run

Status: `TEST`

This folder preserves bounded review evidence for the additive v1.5 pure
checkpoint-witness adapter stacked on v1.4 local possession continuity.

Authoritative contents:

- `CAPABILITY_REQUIREMENTS.json`, inventories and comparator reports describe the
  before/after capability route;
- `SOURCE_SNAPSHOT.json` binds normalized source inputs;
- `CHECK_RESULTS.json` retains commands, phases, exit codes and assertion counts
  without retaining passing stdout;
- `EVIDENCE_ROUTES.md` matches each claim to its native proof surface and keeps
  authority and external claims open;
- `SESSION_SEGMENT.jsonl` and its seal preserve ordered durable events;
- `SESSION_SUMMARY.md`, `SESSION_INDEX.json` and `CURATION_RECEIPT.json` are
  derived handoff views and retention receipts;
- `selftest.js` and `verification-selftest.js` verify the bundled evidence.

The evidence proves exact v1.4 checkpoint adaptation, detached Ed25519 threshold
verification, checkpoint modification detection against the original witness,
and witnessed v1.4 continuity decisions. It proves no host-trusted policy,
policy-replacement prevention, independent signer, authenticated human, network,
other host, external witness/checkpoint retention, trusted time, protected
monotonic state, rollback prevention, provider execution, outcome, learning,
promotion, merge or `CANON`.

No incoming specialist ZIP package was inspected, executed or modified.
