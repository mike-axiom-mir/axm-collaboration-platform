# Model Shadow review challenge transition ledger evidence

Status: `TEST`

This bounded evidence package covers v0.8: one caller-owned local ledger can
serialize exact v0.7 forward transitions by matching the current derived head
and exclusively creating the next sequence entry.

Observed scope:

- forward-only append with explicit confirmation;
- immutable log-id/genesis manifest;
- contiguous filename sequence and entry digest chain;
- stale-head refusal after a local advance;
- one winner for two concurrently presented sibling extensions;
- fresh-process local reload and caller-package exact rebuild;
- corruption and missing-manifest fail-closed behavior;
- no persisted raw public key, signature, rebuild package, private context,
  model output, or machine path;
- executable independent-root and deletion/reinitialization counterexamples.

The capability comparator moves the bounded route from `BLOCKED` to
`DEGRADED`, not complete. The new leaf proves neither a globally consistent
log nor external retention, protected monotonic state, rollback resistance,
authenticated host authorization, controller independence, actual human
review, provider execution, evaluation, benefit, learning, promotion, merge,
or `CANON` status.

`CHECK_RESULTS.json` is the compact command receipt. It retains commands, exit
codes, verdicts, focused assertion totals and bounded failure diagnostics, not
passing stdout. `SOURCE_SNAPSHOT.json` binds normalized source bytes.

