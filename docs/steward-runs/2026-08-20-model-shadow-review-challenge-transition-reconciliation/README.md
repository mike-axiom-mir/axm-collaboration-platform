# Model Shadow review challenge transition reconciliation evidence

Status: `TEST`

This bounded evidence package covers v0.9: two complete v0.8 local histories
and every transient exact-rebuild package are verified in memory before their
entry-digest sequences are compared.

Observed scope:

- exact manifest, entry, transition-package, digest-chain, and head rebuild;
- bounded presentation receipts with no embedded raw key or signature;
- exact replay and both exact-prefix directions;
- typed sibling fork at the first or a later presented sequence;
- typed entry-id equivocation and alternate-record detection;
- typed log-id and genesis drift;
- 4096-entry and 16 MiB canonical-input bounds;
- fresh-process rebuild of both presentations and reconciliation receipt;
- an independently valid third history that remains invisible when withheld.

The capability comparator moves the bounded route from `BLOCKED` to
`DEGRADED`, not complete. Pairwise reconciliation proves neither compelled
disclosure nor a globally consistent log, external retention, protected
monotonic state, rollback resistance, authenticated host authorization,
controller independence, actual human review, provider execution, evaluation,
benefit, learning, promotion, merge, or `CANON` status.

`CHECK_RESULTS.json` retains the exact commands, phases, exit codes, verdicts,
focused assertion count, and bounded failure diagnostics—not passing stdout.
`SOURCE_SNAPSHOT.json` binds normalized source bytes.

