# Local runtime storage

The runtime creates state.json, journal.ndjson, snapshots, adapter fixtures, and application receipts beneath storage/runtime. Demo reset may replace that runtime state but never source files.

Atomic JSON replacement is used for state and adapter documents. The journal is append-only NDJSON with a local SHA-256 hash chain.
