# Model Shadow local possession continuity steward run

Status: `TEST`

This folder preserves bounded review evidence for the additive v1.4 read-only
local possession continuity reference stacked on v1.3.

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

The evidence proves strict response-slot identity, bounded v1.3 inventory,
read-only snapshots and caller checkpoints, fresh-process comparison, and
deletion/replacement detection relative to an exact presented checkpoint. It
proves no independent checkpoint retention or operator, authenticated host or
party, trusted time, network, other host, protected monotonic state, rollback
prevention, human review, provider execution, outcome, learning, promotion,
merge or `CANON`.

No incoming specialist ZIP package was inspected, executed or modified.
