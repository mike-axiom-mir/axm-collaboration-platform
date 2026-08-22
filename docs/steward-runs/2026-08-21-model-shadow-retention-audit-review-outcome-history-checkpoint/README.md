# Model Shadow review-outcome history checkpoint v3.3 evidence

Status: `TEST`

This folder records the bounded capability and evidence case for a caller-
portable full-history checkpoint above the v3.2 local review-outcome ledger. It
freezes the frontier, compares declared capabilities, records deterministic
command outcomes, binds normalized source bytes, and seals compact ordered
session events.

The checkpoint retains manifest/snapshot bindings plus every ordered record and
outcome reference, record time, and minimized classification. It omits complete
v3.2 records and v3.1 outcomes, raw actors, actor digests, votes, notes,
discussion, configured paths, model output, and private context.

The strongest continuity claim is conditional: if the original checkpoint is
presented later, a whole-ledger rewrite is detected relative to it. The retained
counterexample is equally important: a caller can replace or withhold both the
checkpoint and ledger and present another internally exact pair. Nothing here
proves checkpoint retention, authenticated origin, external custody, protected
monotonic storage, or original history.

`CHECK_RESULTS.json` retains one bounded row per command, exit code, focused
assertion count, and canonical digest. Raw stdout, synthetic ledgers, outcome
packages, actor strings, configured paths, and unchanged polling are not
retained.

No browser evidence is claimed because v3.3 adds no browser surface. No
independent Draft 2020-12 validator is installed; schema evidence is limited to
runtime validation and static closure/constant checks.

Mike Tobi / AXM remains the merge and `CANON` gate.
