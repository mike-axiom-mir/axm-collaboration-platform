# Grounded-growth frontier audit for v2.9

Status: `TEST` design freeze

## Observed frontier

v2.8 can retain and fresh-process reload a held rollback, absence, replacement,
identity, or invalid-source audit after the compared roots disappear. No current
module consumes its observation protocol. A held record therefore remains
durable but undiscoverable to the Workshop's existing human review queue.

The Review Inbox already accepts generic exact-digest candidates through
`POST /api/reviews`, guarded by the host mutation boundary and the explicit
`x-axm-review: explicit-submit` header. The v0.1 Model Shadow Challenger Gate
already demonstrates a data-only projection into that generic candidate shape,
but its protocol accepts challenger plans rather than v2.8 retention-audit
observations.

Directly invoking `shared/operations/review-service.js` from a new adapter would
bypass the host mutation and explicit-header boundary. Modifying the shared
Review Inbox is unnecessary. The cheapest honest route is a leaf data adapter
that emits a compatible request and verifies a caller-presented receiver result.

## Bounded v2.9 seam

Add a data-only held-observation review-request bridge which:

1. exact-reloads one persisted v2.8 observation and accepts only its held
   classification;
2. derives a minimized self-digested review artifact exposing the audit
   classification, hold decision, exact references, and negative authority
   boundaries without copying the complete v2.7 audit or any path;
3. embeds that exact artifact in an `axm.review-item/v1`-compatible candidate;
4. declares the existing host-authorized submission route while performing no
   submission or other state write itself;
5. builds a pending handoff only when the initial Review Inbox item and a
   separately reloaded receiver item match exactly, remain `PENDING`, and have
   zero votes and zero discussion;
6. exact-rebuilds both request and handoff from caller packages and fails closed
   on tampering, non-held observations, time errors, receiver drift, review
   state movement, or resource-bound violations.

## Decisive counterevidence

- A compatible request is not proof that the host authorized or performed a
  submission.
- A synthetic direct-service compatibility test is not the live API entrypoint.
- A reloaded Review Inbox item proves current local receiver state, not file
  `fsync`, directory-entry or hardware durability, corruption resistance,
  independent operation, or retention duration.
- `PENDING` proves no vote, review, approval, authenticated identity, or actual
  human participation.
- Review approval, if it later occurs, would not by itself resolve the held
  observation, authorize execution or adoption, promote, merge, or canonize.
- The bridge invokes no provider, experiment, evaluation, or learning process.

Mike Tobi / AXM remains the merge and `CANON` gate.
