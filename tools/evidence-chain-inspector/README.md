# AXM Evidence Chain Inspector

Status: TEST. Inspection only.

The Inspector diagnoses `axm.evidence-retention/v1` JSONL segments without
starting the retention service. This matters when an interrupted open segment
fails the service's startup recovery before the Diagnostics API can exist.

It checks:

- every line is a JSON object with the expected envelope fields;
- `previousHash` links to the prior stored event hash;
- `eventHash` equals SHA-256 of the same recursively key-sorted canonical form
  used by the retention service;
- envelope schema, hash format, session consistency, timestamp order and
  evidence class metadata; and
- bounded input size: at most 10 MiB and 5,000 event lines.

## Privacy boundary

Complete event objects must be read in memory to recompute hashes. The emitted
receipt contains no payload, source, event ID, event type, session ID, raw line,
full filesystem path or filename. It reports line numbers, anomaly codes,
digests, counts and safe next actions only.

The Inspector does not discover files implicitly, repair hashes, truncate or
delete segments, recover sessions, start the server, write state, grant
authority, promote findings or change CANON.

## CLI

```powershell
Get-Content -LiteralPath '<segment.jsonl>' -Raw | node tools\evidence-chain-inspector\cli.js --stdin
node tools\evidence-chain-inspector\cli.js --file '<explicit-segment.jsonl>'
```

Exit codes are `0` for `PASS`, `2` for `FAIL`, `3` for `UNKNOWN`, and `1` for
an invocation or resource-limit refusal. The only output is the digest-only
JSON receipt; the explicit file path is never included.

## Checks

```powershell
node tools\evidence-chain-inspector\selftest.js
node tools\evidence-chain-inspector\discovery-seam-review.js
```
