# Grounded-growth frontier audit for v3.1

Status: `TEST` design freeze

## Observed frontier

v2.9 exact-rebuilds one held retention-audit observation into a minimized Review
Inbox candidate and a pristine `PENDING` receiver handoff. v3.0 makes that exact
artifact legible and fails closed on browser digest mismatch. Neither seam can
represent what the Review Inbox later records after exact-digest votes.

The existing Model Shadow Challenger Gate has a narrower precedent: it consumes
an `APPROVED` Review Inbox item, binds the exact plan digest, requires distinct
declared seats, hashes actor identifiers, omits notes and discussion, and still
refuses authenticated-human or execution claims. The retention-audit chain has
no equivalent post-`PENDING` adapter.

A live host endpoint or direct ReviewService import is not required here. Both
would widen authority while still failing to authenticate actors. The cheapest
honest route is a data-only leaf that exact-rebuilds the v2.9 request and pending
handoff, then validates one caller-presented persisted Review Inbox item.

## Bounded v3.1 seam

Add `shared/model-shadow-retention-audit-review-outcome` which:

1. exact-rebuilds the complete v2.9 request and pristine pending handoff;
2. binds immutable Review Inbox identity, route, artifact, action, seat, creation,
   and expiry fields across the transition;
3. accepts only `APPROVED`, `HOLD`, or `REJECTED` post-pending states;
4. validates one to ten exact-digest votes with case-insensitive distinct actors;
5. requires a declared-human approval seat for `APPROVED`, while explicitly
   refusing actor authentication or actual-human inference;
6. rejects state/vote contradictions and conflicting votes on an approval;
7. emits pseudonymous vote evidence without raw actors, notes, discussion,
   filesystem paths, complete request packages, or private/model content;
8. exposes the held classification and best action without copying the complete
   retained observation or audit;
9. self-digests and exact-rebuilds one minimized outcome artifact;
10. adds no service, filesystem, network, provider, process, vote, or decision
    call and leaves source and Review Inbox state unchanged;
11. keeps the retention hold unresolved and grants no remediation, execution,
    adoption, promotion, merge, Foundation, or `CANON` authority; and
12. is exercised through approved, held, rejected, corrupt, bounded, and fresh-
    process fixtures.

## Decisive counterevidence

- A caller-presented Review Inbox item is not a live host observation.
- `actorKind: human` is a declaration, not authenticated identity or proof that
  a human participated.
- Standalone validation can prove the pseudonymous artifact is internally
  consistent, but only exact rebuild from the caller package proves an
  `actorDigest` was derived from that package's raw actor string.
- `APPROVED` approves only the exact artifact; it is not a retention-hold
  resolution or remediation decision.
- A fresh process reading the same caller-owned roots is not independent custody,
  external persistence, file-`fsync`, or hardware durability proof.
- Synthetic votes are not real review, benefit, learning, or adoption evidence.
- No provider, evaluation, execution, promotion, merge, Foundation mutation, or
  `CANON` occurs.

Mike Tobi / AXM remains the merge and `CANON` gate.
