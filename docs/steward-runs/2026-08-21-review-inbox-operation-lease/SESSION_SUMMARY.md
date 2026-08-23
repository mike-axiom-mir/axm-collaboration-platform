# Session summary

Status: `TEST`

The v4.2 frontier could hold and explicitly recover interrupted signed review
projections, but cooperating Review Inbox writers did not share one operation
boundary. A deterministic barrier reproduction against exact v4.2 service
source ended with one of eight items, losing seven writes under that bounded
interleaving.

v4.3 adds one fixed, exclusive-create, single-host lease across ordinary and
signed Review Inbox mutation paths. Active contention returns a typed busy
result without mutation. Crash residue, invalid evidence, altered tokens, and
missing release evidence remain held. The browser observes this state but cannot
unlock it.

Verification: 66/66 bounded commands, 6,152 focused assertions, 9/9 selected
clean archived product-slice commands, and three retained live screenshot
digests. The clean replay kept all 583 tracked slice files unchanged. Browser
verification found zero warnings/errors and no horizontal overflow at 390×844.
The primary evidence commit independently replayed from a compact exact archive:
its 105-check selftest and 30-event seal both passed.

Still open: cross-file ACID, multi-host/network filesystems, external writers,
safe stale-owner recovery, rollback-resistant storage, real policy and signed
participation, identity, trusted time, accessibility/usability, human benefit,
learning, consequential authority, merge, and `CANON`. Mike Tobi / AXM remains
the merge and `CANON` gate. The broad objective remains active.
