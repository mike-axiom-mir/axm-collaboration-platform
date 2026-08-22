# Model Shadow Retention Audit Review Request v2.9

Status: `TEST` · installed: `false` · promoted: `false`

v2.9 is a data-only bridge from one exact persisted **held** v2.8 retention-
audit observation to the Workshop's existing exact-digest Review Inbox shape.
It exact-reloads the observation, derives a minimized self-digested artifact,
and embeds that artifact in the candidate action a reviewer can inspect.

```text
exact persisted held v2.8 observation
  -> minimized exact-digest review artifact
  -> Review Inbox-compatible candidate
  -> explicit host-authorized submission remains required
initial pending item + exact caller-presented receiver reload
  -> pending-review handoff with no review or action authority
```

The request declares `POST /api/reviews` and the existing
`x-axm-review: explicit-submit` header, but the module does not invoke that route,
import ReviewService, write Review Inbox state, or open a network connection.
This preserves the host mutation boundary. A focused compatibility harness sends
the candidate to a synthetic ReviewService root and reloads it from a separate
process; the public handoff still says that independent process provenance and
receiver persistence are not proven by caller-presented copies.

Non-held observations, altered v2.8 receipts, artifact or candidate drift,
incorrect times, non-pending items, votes, discussion, expiry, and initial/reload
mismatch fail closed. Public artifacts omit configured paths, complete v2.8
observations, complete v2.7 audits, input packages, votes, notes, identities, raw
model output, and private context.

`PENDING` proves no human review, authenticated actor, vote, approval, or hold
resolution. Even a later Review Inbox approval would not by itself authorize
execution, adoption, promotion, merge, Foundation mutation, or `CANON`. The
module invokes no provider, experiment, evaluation, or learning process.

Run:

```powershell
node shared/model-shadow-retention-audit-review-request/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
