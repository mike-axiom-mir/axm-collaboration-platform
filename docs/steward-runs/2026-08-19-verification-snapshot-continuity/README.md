# Verification snapshot continuity steward run

Status: `TEST`

Eight current Workshop verification receipts reference the same generated
`exports/verification-spine-report.json`. Regenerating that report changed its
bytes and made exact receipt rebuilds look stale even when their other tracked
sources still matched.

This additive audit uses the permissionless verification-snapshot-continuity
leaf to classify each affected receipt. It preserves four distinct truths:

- an exact current source set;
- drift limited to the recognized mutable derived view;
- tracked-source drift that requires review but is not automatically a defect;
- a hold when integrity or source evidence is incomplete.

The existing installer digest-state rule was useful precedent, and existing
receipt/source digests are reused. No existing module covered multi-source
historical receipts plus a recognized mutable derived report, so a new pure leaf
was the smallest bounded adapter. Historical receipt files are not rewritten.

The portfolio observes the current broad report but does not rerun it or claim
that broad verification, browser behavior, human benefit, promotion, merge,
Foundation state, or `CANON` passed.

