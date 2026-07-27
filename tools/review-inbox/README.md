# AXM Review & Promotion Inbox

Review Inbox is the Workshop's shared human review surface. It deliberately presents two evidence domains without merging their authority:

- **Structural module evidence** comes from `shared/readiness/readiness-observer.js`. A candidate has a current manifest, contract and promotion self-test receipt ready for Mike to inspect. It is read-only here and has no vote action.
- **Exact-digest review items** are durable records in `state/review-inbox`. Attributed seats may approve, hold or reject the exact SHA-256 digest shown in the record.

Structural readiness is not digest approval, promotion, CANON status, runtime proof or acceptance of a Workshop need. A structural candidate never enters the exact-digest queue automatically. If the shared tools index is stale, invalid or unavailable, the Inbox shows the hold and displays no structural candidates.

Exact-digest approval also does not apply an action. Every consuming service must verify the approved digest again and enforce its own permission and confirmation gate.

## Evidence

```powershell
node tools/review-inbox/selftest.js
node tools/review-inbox/discovery-seam-review.js
node shared/readiness/readiness-observer-selftest.js
```

The live route is `/tools/review-inbox/index.html`; its data comes from `GET /api/reviews`.
