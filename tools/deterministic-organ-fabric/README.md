# Deterministic Organ Fabric

`EXPERIMENTAL` additive factory for pure, bounded JSON-in/JSON-out organs. The normal path is deterministic and needs no AI, network, API key, provider, model, randomness, install, promotion, or Foundation mutation.

CLI:

```text
node tools/deterministic-organ-fabric/cli.js validate --intent <file>
node tools/deterministic-organ-fabric/cli.js generate --intent <file> --output-parent <existing-dir> --archive-root <existing-dir>
node tools/deterministic-organ-fabric/cli.js compare --run <generated-run-dir>
node tools/deterministic-organ-fabric/cli.js archive list|verify|revalidate --archive-root <dir>
node tools/deterministic-organ-fabric/cli.js archive export|import --archive-root <dir> --pack <file>
node tools/deterministic-organ-fabric/cli.js archive stash-export --archive-root <dir> --package-digest <sha256:...> --pack <new-file>
node tools/deterministic-organ-fabric/cli.js archive connection-plan --archive-root <dir> --package-digest <sha256:...>
node tools/deterministic-organ-fabric/cli.js archive connect-mirror --archive-root <dir> --package-digest <sha256:...> --mirror-root <dir> --mirror-archive-root <dir> --acknowledge CONNECT_DORMANT_ORGAN_TO_MIRROR_ARCHIVE
```

Every hard-gate-valid candidate is retained as `VALID_DORMANT_LIBRARY`, `KEEP_WHEN_NO_CURRENT_USE`, `ARCHIVED_NOT_ADMITTED_TO_RUNTIME`, and `DORMANT`. This is the shelf for a capable organ that has no direct use yet. “Valid” means its declared deterministic contract and fixtures passed; usefulness, taste, fun, wisdom, and broader quality remain unresolved human judgments.

Selection is a durable event overlay. It does not mutate the immutable candidate or remove the other dormant candidates. Every candidate stays detached with `installed`, `registered`, `staged`, `promoted`, and `canonChanged` set to `false`.

`stash-export` emits a content-bound `axm.organ-archive-stash-envelope/v1` containing the standalone `organ.js` source under an `organs/*-organ.js` suggested path. It remains a detached handoff and performs no write.

`connect-mirror` is the explicit host-authorized bridge. It is bound to AI Organ Archive `0.9.0` TEST contract digest `sha256:42a91fd899191dfb6ded2f54074d874cbc20c7d7a020c082a252775eaae254da` and the exact passive receiver entry-point bytes. It refuses missing authorization, lineage drift, symlinks, overlap, traversal, or different bytes at the target. With the exact acknowledgement, it places the source, invokes only the trusted archive receiver (never the organ), verifies the predicted content-addressed object and dormant/non-admitted state, and records `axm.organ-archive-connection-receipt/v1` as a durable Fabric event. Repeating the exact connection deduplicates both source and event.

This “connection” is archive plumbing only. `runtimeConnected`, `organLoaded`, `organExecuted`, `runtimeAdmitted`, `installed`, `registered`, `staged`, `promoted`, and `canonChanged` remain `false`. Receiver contract or entry-point changes produce a revalidation refusal until the bridge is deliberately updated.
