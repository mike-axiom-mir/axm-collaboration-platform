# Session summary

Status: `TEST`

## Outcome

Added an additive v1.2 local receiver custody reference adapter. It moves the
Model Shadow frontier from signature-only caller data to an actually exercised
same-host file handoff, receiver read, data-minimized custody write and restart
reload—without expanding those observations into external claims.

## Exact behavior proved

- full v1.0 assessment and v1.1 policy exact rebuild before every side effect;
- exact confirmation, fixed root and filename scope, exclusive create and file
  fsync for sender envelope and receiver custody record;
- sender and receiver receipts bound to exact envelope, payload, assessment,
  policy, custody and acknowledgement digests;
- deterministic Ed25519 custody and acknowledgement signatures with transient
  private keys;
- two receiver child processes producing acknowledgements accepted by v1.1;
- new-process reload verifying custody record, signatures and stored receipt;
- refusal of path traversal, filesystem roots, nested roots, conflicting delivery
  reuse, overwrite, wrong keys, invalid times, tampering, noncanonical JSON and
  oversized input;
- public receipts omit raw labels, keys, signatures, full assessment receipts,
  private keys and machine paths.

## Failures and counterevidence preserved

The first complete focused run reached 111 passing checks before a test expected
`POLICY_INVALID` for a different policy whose digest had been recomputed. The
runtime correctly classified the internally valid but record-mismatched policy
as `POLICY_MISMATCH`; the assertion was corrected and the full suite passed 153
checks.

All receiver processes, keys, roots and timestamps remain controlled by one
synthetic test on one host. Public receipts explicitly keep independent receiver
operation, network/other-host delivery, external retention, retention duration,
durability beyond file fsync, protected monotonic state and rollback prevention
false. The unchanged v1.1 acknowledgements still say
`NO_DURABLE_RETENTION_CLAIM`.

## Authority and status

The adapter is `TEST`, uninstalled, unpromoted and not integrated into a host.
No real receiver identity, human review, provider execution, evaluation, branch
adoption, benefit, learning, promotion, merge, Foundation mutation or `CANON`
decision occurred. Mike Tobi remains the merge and `CANON` gate.

## Verification

`CHECK_RESULTS.json` records 30 passing commands: 20 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,461 focused assertions. The source
snapshot binds 88 normalized inputs. Evidence selftests and a clean detached
replay are separate handoff evidence, not canonization.
