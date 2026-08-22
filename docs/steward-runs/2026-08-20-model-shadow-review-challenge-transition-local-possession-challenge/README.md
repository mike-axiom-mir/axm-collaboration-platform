# Model Shadow local possession challenge steward run

Status: `TEST`

This folder preserves bounded review evidence for the additive v1.3 local
possession challenge reference stacked on v1.2 local receiver custody.

Authoritative contents:

- `CAPABILITY_REQUIREMENTS.json`, inventories and comparator reports describe the
  before/after capability route;
- `SOURCE_SNAPSHOT.json` binds normalized source inputs;
- `CHECK_RESULTS.json` retains commands, phases, exit codes and assertion counts
  without retaining passing stdout;
- `EVIDENCE_ROUTES.md` matches each claim to its native proof surface and keeps
  external claims open;
- `SESSION_SEGMENT.jsonl` and its seal preserve ordered durable events;
- `SESSION_SUMMARY.md`, `SESSION_INDEX.json` and `CURATION_RECEIPT.json` are
  derived handoff views and retention receipts;
- `selftest.js` and `verification-selftest.js` verify the bundled evidence.

The evidence proves a signed local nonce challenge, exact custody reread,
receiver-signed response file, bounded repeat refusal while that file exists, and
fresh-process reload. It proves no independent operator, trusted time, network,
other host, external retention, retention duration, durability beyond reported
file fsync, protected monotonic state, rollback resistance, human review,
provider execution, outcome, learning, promotion, merge or `CANON`.

No incoming specialist ZIP package was inspected, executed or modified.
