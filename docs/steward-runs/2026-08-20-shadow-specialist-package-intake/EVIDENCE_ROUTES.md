# Evidence routes

| Claim | Evidence surface | Result | Limit |
| --- | --- | --- | --- |
| Supplied archive identity | OS byte count and SHA-256 | Exact digests retained in `STATIC_ARCHIVE_RECEIPT.json` | Original ZIP bytes are external and are not committed |
| Archive structural safety | Static ZIP central-directory inspection | No traversal, duplicate, symlink/special, oversized, or suspicious-ratio entries | File behavior was not executed |
| Package manifest integrity | Independent file hashing and manifest-digest rebuild | v0.1: 54/54; v0.2: 103/103; zero mismatches | Author, source repository, and test executor are not authenticated |
| Revision continuity | Exact manifest and ZIP predecessor binding | v0.2 binds the supplied v0.1 manifest and ZIP | Does not prove semantic correctness |
| JavaScript syntax | `node --check` parser-only pass | 25/25 files parse | Modules and tests were not loaded or run |
| Runtime readiness | Static code and contract inspection | `QUARANTINED_NOT_INSTALLABLE` | A repaired future candidate could be reassessed |
| Research value | Existing native Research Contribution Intake exact rebuild | `READY_FOR_BASELINE_SIMULATION_PLANNING` | Planning is not execution, learning, benefit, or adoption |
| Contributor independence | User declaration plus package revision relationship | Not established; identity partial and prior-output exposure full | Agreement or recurrence has no truth weight |
| Current OpenAI SDK compatibility | Package-declared source crosscheck only | `UNKNOWN` / held | No live SDK package or provider run was performed |
| Authority | Decision and assessment truth fields | No install, build, provider call, promotion, merge, Foundation write, or CANON | Mike remains the external gate |
