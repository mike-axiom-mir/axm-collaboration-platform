# Transition-history reconciliation review request v4.0

Status: `TEST` · installed: `false` · promoted: `false`

This explicitly invoked, data-only bridge turns one exact-rebuilt v3.9
`COMPLETE_HISTORY_DIVERGES` receipt into a minimized exact-digest Review Inbox
candidate. The artifact preserves both complete-history commitment references,
both current snapshot references and counts, the common normalized prefix length,
and the earliest divergent proposal or settlement event.

```text
v3.9 caller package + exact divergent receipt
  -> exact rebuild from both explicit v3.7 roots
  -> minimized self-digested reconciliation-review artifact
  -> Review Inbox-compatible candidate
  -> explicit host-authorized submission still required
```

The request declares `POST /api/reviews` and
`x-axm-review: explicit-submit`; it does not call that route, import the Review
Inbox service, write state, or open a network connection. Matching histories,
prefix relations, identity holds, observation holds, stale roots, altered
receipts, and digest or authority inflation fail closed.

The artifact omits the full v3.9 receipt, complete stored histories, configured
paths, raw stored artifacts, model output, and private context. Review approval
would approve only the exact artifact. It would not authenticate a steward,
reconcile either history, resolve the divergence, or grant execution, adoption,
promotion, merge, Foundation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
