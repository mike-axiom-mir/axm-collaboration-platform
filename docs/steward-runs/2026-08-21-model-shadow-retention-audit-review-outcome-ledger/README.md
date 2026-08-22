# Model Shadow retention-audit review-outcome ledger v3.2 evidence

Status: `TEST`

This folder records the bounded capability and evidence case for the additive
v3.2 local continuity ledger. It freezes the v3.1 frontier, compares declared
capabilities, records deterministic command outcomes, binds normalized source
bytes, and seals compact ordered session events.

The ledger exact-rebuilds the complete v3.1 caller package before persisting
only its minimized output. Records retain pseudonymous vote evidence and omit
raw actors, vote notes, discussion, configured paths, Review Inbox items, and
complete caller packages. `APPROVED`, `HOLD`, and `REJECTED` remain observations;
all leave the retention hold unresolved.

The strongest persistence claim is fresh-process exact local reload after the
upstream observation root is unavailable. The evidence also preserves the
counterexample: a controller that recomputes every local byte can construct
another internally exact history and can reuse the configured manifest identity.
This is not independent custody, protected monotonic storage, authenticated
history, or hardware durability.

`CHECK_RESULTS.json` retains one bounded row per command, its exit code, focused
assertion count, and canonical digest. Raw stdout, actor strings, vote notes,
caller packages, configured paths, temporary ledgers, and polling are not
retained.

No browser evidence is claimed because v3.2 adds no browser surface. No
independent Draft 2020-12 validator is installed; schema evidence is limited to
runtime validation and static closure/constant checks.

Mike Tobi / AXM remains the merge and `CANON` gate.
