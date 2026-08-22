# Session summary

Status: `TEST`

v2.5 adds an explicitly invoked local two-phase settlement ledger above the
portable v2.4 checkpoint-pin transition. A proposal must exact-rebuild an
eligible v2.4 successor transition and match the current settled pin. It is
exclusive-created as one trailing pending record and does not advance the pin
head. A separate settlement call must present the exact original proposal
package and the explicit unauthenticated settlement confirmation before the
local derived head advances.

The fixed namespace stores a canonical self-digested manifest plus contiguous
proposal and settlement receipts. Normal operations use one exclusive transient
lock; receipt files are exclusive-created, file-fsynced, and reloaded in fresh
processes. The focused suite also exercises concurrent writers, stale locks,
digest and namespace corruption, noncanonical and oversized files, sequence
gaps, linked roots and directories, time ordering, and bounded cleanup.

Counterevidence is part of the result. Two independent roots can settle
different valid successor pins. Deleting the namespace allows sequence one to
reopen with another successor. A crash-stale lock requires caller-owned
recovery. File `fsync` does not prove directory-entry, hardware, power-loss,
remote, or long-horizon durability. The local files prove no external retention,
protected monotonic state, rollback prevention, authenticated host or human,
global consistency, or real-world identity.

All 41 recorded commands passed with 3,089 focused assertions, including all ten
`AGENTS.md` commands. Public receipts contain references and digests rather than
the upstream rebuild packages, raw keys, signatures, private keys, configured
paths, model output, or private context. The module performs no network call,
signing, provider execution, evaluation, permission change, adoption,
promotion, merge, or `CANON`.

Browser verification is not applicable to this nonvisual local Node.js adapter.
