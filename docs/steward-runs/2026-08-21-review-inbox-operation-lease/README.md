# Review Inbox operation lease v4.3 evidence

Status: `TEST`

This evidence folder binds the bounded v4.3 seam at product commit
`3b8730c522c7441eb7b17d10c4fed0e9ca2c39da` and tree
`788be63cd49c73abbf3e7480e539d9769863e896`.

The seam serializes cooperating single-host Review Inbox mutations behind one
exclusive-create lease. Active contention fails closed. Missing, malformed,
altered, or crash-residue owner evidence stays held. No process-liveness
inference, automatic theft, browser unlock, execution, adoption, promotion,
merge, Foundation mutation, or `CANON` authority was added.

The baseline v4.2 race reproduction lost seven of eight synchronized writes.
The v4.3 concurrency suite preserved all eight, and the selected clean product
slice replay passed 9/9 commands without changing its 583 tracked files. The
broader scoped verification passed 66/66 commands and 6,152 focused assertions.
The primary evidence commit also passed its 105-check selftest and seal replay
from an exact compact archive.

Mike Tobi / AXM remains the merge and `CANON` gate. Incoming
`AXM_MIRROR_SHADOW_SPECIALIST` ZIP packages were not inspected or modified.
The broad grounded-growth objective remains active.
