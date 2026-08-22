# Model Shadow local receiver custody evidence

Status: `TEST`

This bounded evidence package covers v1.2: an explicit local sender writes and
fsyncs an exact assessment envelope; receiver child processes read it, verify
the full transient v1.0/v1.1 packages, and persist receiver-signed data-minimized
custody records in separate local roots; new processes reload those records.

Observed scope:

- exact envelope, sender receipt, custody record, receiver receipt and reload
  receipt rebuild;
- exact confirmation before each write;
- immutable digest-named outbox and custody files with exclusive create and file
  fsync before success;
- sender and receiver receipts tied to exact envelope and payload digests;
- transient matching Ed25519 private keys with no key persistence;
- two receiver child processes producing a met unchanged v1.1 threshold;
- new process reload of signed custody records and stored assessment receipts;
- path, root, nesting, overwrite, conflict, key, time, tamper, canonical JSON and
  48 MiB refusal boundaries; and
- public receipts containing digests rather than raw labels, keys, signatures,
  assessment receipts, private keys or machine paths.

The capability comparator moves this bounded local route from `BLOCKED` to
`DEGRADED`, not complete. Same-host child processes and caller-owned roots do not
prove independently operated receivers, network or other-host delivery,
independent external retention, retention duration, durability beyond reported
file fsync, protected monotonic state, rollback resistance, host authentication,
real receiver identity, trusted time, human review, provider execution,
adoption, benefit, learning, promotion, merge, or `CANON`.

`CHECK_RESULTS.json` records 30 passing commands: 20 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,461 focused assertions. Passing stdout
is not retained. `SOURCE_SNAPSHOT.json` binds 88 normalized source inputs.
