# Grounded-growth frontier audit — Review Inbox archival-intent reason privacy v5.3

Status: `TEST`

The exact v5.2 replay shows that its v1 intent, v2 result, and host-local CLI JSON retain a synthetic raw reason, labeled credential value, and machine path. No raw fixture state or CLI output was retained in evidence; the receipt records only typed observations and digests.

v5.3 publishes a v2 intent with a SHA-256 commitment to the exact raw reason. New durable intent and v3 result objects omit the raw reason. Recognized credential/path patterns produce a bounded diagnostic-redaction summary; input unchanged by that policy produces a fixed withheld marker. Exact retry recomputes the reason digest and summary. Corrupt digest or non-idempotent summary evidence holds before archive mutation.

Existing v1 raw-reason intents remain exact-readable and retryable. Authorization status types them as `LEGACY_AUTHORIZED_RAW_REASON`, reports exact raw-reason persistence, and never rewrites or deletes the file. Historical intent/v1, status/v1, and result/v2 schema files remain unchanged; new semantics use explicit v2/v2/v3 files.

The redactor covers labeled credentials, recognizable token fingerprints, private-key blocks, configured roots, and residual absolute paths. It does not prove absence of arbitrary, encoded, or novel secrets. CLI arguments, process inspection, terminal software, and shell history are outside the emitted-JSON claim. A reason digest is neither actor authentication nor protected storage.

All 22 scoped commands pass: twelve focused commands with 1,230 assertions or controls and the ten required AGENTS.md checks. A clean dependency-slice replay passes all focused commands without tracked-byte mutation. The current Review Inbox promotion selftest digest passes and tools-index says READY_FOR_HUMAN_REVIEW; twelve other promotion selftests remain nonpassing. Aggregate test:operations remains FOREIGN_FAILURE at the unchanged absent curated verification intake.

No browser-facing file changed and no browser render/click test is claimed. No authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or CANON evidence is claimed. Mike Tobi / AXM remains the merge and CANON gate, and the broad grounded-growth objective remains active.
