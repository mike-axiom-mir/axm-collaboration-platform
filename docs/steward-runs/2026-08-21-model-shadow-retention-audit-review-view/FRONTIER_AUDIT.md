# Grounded-growth frontier audit for v3.0

Status: `TEST` design freeze

## Observed frontier

v2.9 produces a minimized, self-digested held-retention-audit artifact inside
the generic `axm.review-item/v1` candidate shape. The existing host operations
API can accept that candidate only after its local mutation guard and exact
`x-axm-review: explicit-submit` header. That header is a deliberate local
confirmation boundary, not authenticated actor identity.

The Review Inbox already lists the item, shows its summary and complete action
JSON, and can vote on its exact item digest. The human-facing weakness is
semantic: a held retention audit appears through the same raw JSON inspector and
`APPROVE` vocabulary as every generic review. Its unresolved hold, upstream
classification, exact artifact digest, and lack of execution, adoption,
promotion, merge, or `CANON` authority are present in data but not presented as
a distinct decision context.

A typed server submission endpoint was considered and rejected for this seam.
Exact v2.9 rebuild currently needs caller-presented v2.8 service options,
including a filesystem root. Exposing that through a new browser route without
a host-managed root registry would create an unnecessary caller-directed file
read surface. The generic host route already exists; this seam should not widen
its authority.

## Bounded v3.0 seam

Add a read-only typed renderer to Review Inbox which:

1. recognizes only the exact v2.9 held-audit action and artifact identities;
2. recomputes the artifact's canonical SHA-256 in the browser and binds it to
   both the artifact and Review Inbox item digest;
3. displays the held classification, observation/audit references, retention
   checkpoint, current best action, full digest, and zero-authority boundaries;
4. keeps the generic raw JSON evidence visible rather than replacing it;
5. leaves generic review items unchanged;
6. disables voting while typed verification is pending and whenever a claimed
   held-audit artifact is malformed or digest-mismatched;
7. ignores stale asynchronous verification when selection changes;
8. adds no submit, vote, discussion, route, provider, or filesystem call;
9. remains usable at desktop and narrow mobile viewports; and
10. is verified through focused runtime tests plus live browser selection and
    mismatch journeys.

## Decisive counterevidence

- A typed view is not a live Review Inbox submission.
- Browser digest verification does not authenticate the submitter, reviewer,
  host session, or provenance of the underlying observation.
- `APPROVE` still means approval of the exact Review Inbox artifact only; it
  does not resolve the retention hold or apply an action.
- A synthetic browser harness is not a real human review or usability study.
- Responsive screenshots do not prove assistive-technology compatibility.
- No provider, evaluation, human benefit, learning, adoption, promotion,
  merge, Foundation mutation, or `CANON` occurs.

Mike Tobi / AXM remains the merge and `CANON` gate.
