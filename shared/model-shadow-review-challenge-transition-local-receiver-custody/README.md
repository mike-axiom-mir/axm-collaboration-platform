# Model Shadow local receiver custody reference

Status: `TEST`

This uninstalled and unpromoted v1.2 reference adapter follows the v1.1
declared receiver acknowledgement witness. It exercises the next proof surface
that can be tested honestly on one machine:

```text
exact v1.0 assessment + exact v1.1 receiver policy
  -> explicit sender write to a caller-owned local outbox + file fsync
  -> separate receiver process reads and exact-rebuilds the envelope
  -> receiver persists the data-minimized v1.0 assessment receipt and signed
     custody record in a different caller-owned local root + file fsync
  -> fresh process reloads the record, verifies its signature and stored digest
  -> v1.1 acknowledgements can meet their declared threshold
```

The adapter has real local filesystem side effects only after exact confirmation
phrases. It refuses filesystem roots, missing roots, nested/equal transport and
custody roots, symbolic links, traversal names, overwrites, conflicting reuse of
one delivery identity, altered packages, wrong receiver keys, invalid times,
oversized inputs, and corrupt reload state. Files have fixed digest-derived names,
writes are exclusive-create, and each reported successful file is fsynced.

The outbound envelope necessarily carries the full transient exact-rebuild
package, including upstream signatures and public keys. The caller owns its
cleanup. The custody record does **not** retain that input or any private key; it
retains the data-minimized assessment receipt, the v1.1 acknowledgement, and a
receiver-signed custody statement. Public sender, receiver, and reload receipts
contain bounded digests and truth flags rather than raw receiver labels, keys,
signatures, assessment receipts, or machine paths.

This reference proves only the behavior actually exercised: same-host local-file
handoff, receiver read, data-minimized receipt persistence, file fsync completion,
signature verification, and reload. Separate child processes remain controlled
by one self-test and do not establish independently operated receivers, another
host, network delivery, external retention, retention duration, protected
monotonic state, deletion or rollback resistance, host authentication, human
review, provider execution, adoption, benefit, learning, promotion, merge, or
`CANON`.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-receiver-custody/selftest.js
```
