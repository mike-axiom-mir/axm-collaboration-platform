# Model Shadow review challenge transition receiver acknowledgement evidence

Status: `TEST`

This bounded evidence package covers v1.1: a caller-supplied policy binds the
exact v1.0 declared-disclosure assessment to two through ten declared Ed25519
receivers, and detached acknowledgements produce an exact threshold-met or
incomplete-threshold witness.

Observed scope:

- exact policy normalization, unique receiver labels and unique Ed25519 keys;
- exact policy, assessment, roster, receiver, time, scope and signature binding;
- zero-or-one valid acknowledgement per enabled declared receiver;
- threshold-met and typed incomplete-threshold classifications;
- explicit `NO_DURABLE_RETENTION_CLAIM` on every acknowledgement;
- a same-process two-key counterexample that meets threshold without receiver
  independence, delivery, read, persistence or retention proof;
- ten-receiver, 256 KiB policy and 48 MiB witness bounds;
- fresh-process rebuild and verification; and
- bounded witnesses with no raw receiver labels, public keys, signatures,
  private keys, transient assessment packages or machine paths.

The capability comparator moves the bounded route from `BLOCKED` to
`DEGRADED`, not complete. A caller-supplied key and valid signature prove a
statement under that key; they do not prove an independently operated receiver,
actual transport, receiver read or application, persisted assessment bytes,
external retention, protected monotonic state, rollback resistance, trusted
time, identity, human review, provider execution, adoption, benefit, learning,
promotion, merge, or `CANON`.

`CHECK_RESULTS.json` records 29 passing commands: 19 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,308 focused assertions. Passing
stdout is not retained. `SOURCE_SNAPSHOT.json` binds 77 normalized source
inputs.

The primary 13-event segment was sealed before an evidence-only README phrase
predicate failed. The unchanged primary seal and a separate three-event sealed
supplement preserve that failure, its correction, and the 65-check evidence
selftest pass.
