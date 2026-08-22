# Session summary

Status: `TEST`

v2.7 adds a distinct-local-root two-phase retention ledger over the v2.6
portable pin-settlement history checkpoint. A valid proposal exact-rebuilds the
complete checkpoint origin, stores the full minimized checkpoint with exclusive
file creation and file `fsync`, and remains a pending observation until an exact
original proposal package receives a separate settlement confirmation.

Fresh reload validates canonical manifest, proposal, settlement, checkpoint,
reference, and digest chains. The settled retention head derives only from
settlements, while audit deliberately selects the latest stored observation
whether pending or settled and binds that status. After the first settlement,
only strict v2.6 forward extensions can be proposed. Replay, rollback, fork,
identity drift, absent, invalid, corrupt, gapped, unexpected, oversized, stale-
lock, overlapping-root, and concurrent-writer cases fail closed.

Two practical continuity cases are now exercised without caller checkpoint
re-presentation: an earlier source copy is classified as strict rollback, and an
absent source namespace is classified as absent. Distinct child processes reload
and audit exact state. Two concurrent writers admit exactly one pending proposal.
A source movement between outside preflight and the in-lock origin rebuild
prevents proposal admission and leaves no manifest.

Two verification corrections remain durable. First, a minimization scan treated
the truthful field name `privateContextEmbedded: false` as retained private
context; the final scan distinguishes forbidden payload keys from explicit
negative truth fields. Second, internal proposal and settlement builders could
have emitted write-completion receipts without a service write; those builders
were removed from the public exports.

All 43 recorded commands passed with 3,480 focused assertions, including all ten
`AGENTS.md` commands. The normalized source snapshot binds 221 inputs. The
deterministic capability comparison moved from 3 required `READY`, 28 required
`UNKNOWN`, and 19 optional `OPTIONAL_UNKNOWN` to all 31 required `READY` with the
same 19 broader optional routes still unknown.

Counterevidence remains decisive. The same synthetic controller owns both local
roots, processes, confirmations, and caller times. Jointly replacing the source
and retention roots produces another exact pair. Local files prove no external
retention, protected monotonic state, rollback prevention, directory-entry or
hardware durability, authenticated identity or human review, global consistency,
provider execution, evaluation, benefit, learning, adoption, merge, or `CANON`.

Browser verification is not applicable to this nonvisual Node.js adapter. Five
closed Draft 2020-12 schemas parse and their runtime structures are exercised;
independent meta-validation remains unrun because no compatible validator was
available and no dependency was installed.
