# Phone-QA review handoff

Status: `TEST`

This milestone closes the contract gap between the existing Browser, LAN &
Hardware QA Lab and the existing exact-digest Review Inbox. It adds no parallel
review store and grants no new proof or promotion authority.

The bounded route is now:

```text
device receipt -> exact inbox item -> latest exact human decision ->
note-free five-field voluntary campaign input
```

The adapter verifies the receipt's native SHA-256 digest, binds game, slot,
completeness, source and false authority flags, reuses the Review Inbox's
durable state, and refuses non-human latest decisions as campaign input. An
approve vote on an incomplete observation maps to `INCOMPLETE`.

The live browser check deliberately used an all-false incomplete fixture. No
physical phone was observed, no actual human review vote was cast, no game
warning was cleared, and no human-usefulness outcome was supplied. The
fixture receipts and raw frame bytes were deleted after compact evidence was
sealed.

Primary checks:

```powershell
node tools/browser-lan-hardware-qa-lab/selftest.js
node shared/operations/wave2-selftest.js
node tools/review-inbox/selftest.js
node shared/voluntary-phone-qa-campaign/selftest.js
node shared/grounded-growth-phone-evidence-gate/selftest.js
node docs/steward-runs/2026-08-20-phone-qa-review-handoff/selftest.js
node docs/steward-runs/2026-08-20-phone-qa-review-handoff/verification-selftest.js
```

This branch remains review material. It is not merged, promoted, or `CANON`.
