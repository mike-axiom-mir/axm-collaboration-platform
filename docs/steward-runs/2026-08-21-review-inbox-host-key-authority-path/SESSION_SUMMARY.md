# Review Inbox host-key authority path v4.1 session summary

Status: `TEST` · merge and `CANON` gate: Mike Tobi / AXM

The bounded advance adds a separate host-configured Ed25519 key-possession authority view to Review Inbox. Signed submissions bind exact normalized candidates; signed votes bind exact current item routes, artifact digests, verdicts, notes, and explanation flags. Current signed submission evidence is required before a signed vote can mutate the ordinary review record. Replay, policy mismatch, policy expiry, principal duplication, submitter/reviewer collision, storage corruption, item drift, and signature tamper hold authority closed.

Legacy attributed votes remain compatible but count as zero authenticated seats. The UI separately displays legacy `APPROVED · AUTHORITY HELD` and `APPROVED · HOST KEY`. No consumer applies the new authority result.

Verification recorded 61/61 passing commands and 5798 focused assertions, including all ten AGENTS checks. The source snapshot binds 345 normalized inputs. Live read-only browser checks retain seven frame commitments and no screenshot bytes. Commit `8ce0e4fd` then passed all recorded commands and the evidence selftest from detached HEAD with a clean tree; the append-only continuation preserves two failed separate-worktree checkout attempts and their exact cleanup.

Open seams remain: real policy installation and signed review, named identity, actual human participation, independent controllers, trusted time, atomic and protected persistence, external custody, reconciliation, consequential authority, benefit, learning, independent schema meta-validation, assistive technology, and usability. Passing tests do not make this branch `CANON`.
