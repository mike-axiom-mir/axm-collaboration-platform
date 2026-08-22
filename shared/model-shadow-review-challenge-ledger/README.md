# Model Shadow review challenge ledger

Status: `TEST`

This branch artifact is not installed or promoted. Calling the library and
providing its exact confirmation phrase do not constitute a host-authorized
trusted entry point. Any later host integration must supply and independently
verify its own permission and authorization boundary.

This stateful leaf follows the Model Shadow signed review evidence leaf. It
exact-rebuilds one signed-review receipt and consumes that receipt's challenge
once in one caller-scoped ledger.

```text
exact signed-review receipt + explicit confirmation + existing state root
  -> exclusive-create <challenge-sha256>.json
  -> file fsync
  -> caller-ledger replay refusal while state is preserved
  -> no execution authority
```

Each challenge uses one append-only entry file. Filesystem `wx` creation makes
concurrent processes contend on the exact challenge digest: one can create the
entry and later attempts are refused. A partial, corrupt, symlinked, or
boundary-invalid entry fails closed and requires steward repair; it is never
treated as an unused challenge.

An immutable, file-synced `ledger.json` manifest binds the caller's ledger id to
the state root on first use. A conflicting id or corrupt manifest fails closed.

The boundary is local, not global, and it depends on preserving the ledger
state. The same challenge can be consumed in a different state root; deleting
or rolling back the caller-owned namespace can also reopen it. This leaf does
not claim protected storage. The caller-supplied ledger id and state root
authenticate no host, policy authority, actor, or human. File `fsync` success
does not prove durability beyond the operating system and storage guarantees.
Consuming a challenge grants no experiment execution, evaluation, adoption,
promotion, merge, Foundation mutation, or `CANON` authority.

The persisted receipt contains digests and bounded references, not raw actor
strings, vote notes, public keys, signatures, private keys, private context, or
model output.

Run:

```powershell
node shared/model-shadow-review-challenge-ledger/selftest.js
```
