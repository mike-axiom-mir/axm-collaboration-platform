# Model Shadow retention-audit review outcome

Status: `TEST` · installed: `false` · promoted: `false`

This data-only leaf continues the v2.9 retention-audit Review Inbox handoff after
its pristine `PENDING` state:

```text
exact-rebuild v2.9 request and pending handoff
  + later persisted exact-artifact Review Inbox item
  -> APPROVED | HOLD | REJECTED outcome observation
  -> retention hold still unresolved
```

The leaf binds immutable Review Inbox identity, route, artifact, action, seats,
creation time, and expiry across the transition. It accepts one to ten persisted
votes, requires every vote to bind the exact artifact digest, treats actor names
case-insensitively for seat independence, and rejects state/vote contradictions.
An `APPROVED` outcome requires the configured number of distinct approvals and
at least one seat declared as `human`.

The output retains actor digests, actor kinds, verdicts, exact artifact digests,
and timestamps. It does not retain raw actor strings, vote notes, discussion,
complete Review Inbox items, complete request/handoff packages, configured
filesystem paths, raw model output, or private context.

The minimized receipt can validate its own closed shape and self-digest, but it
cannot prove by itself that an actor digest was derived from a particular raw
actor string. That provenance requires `verifyOutcome` to exact-rebuild from the
caller-presented Review Inbox item.

`actorKind: human` is only caller-presented Review Inbox data. It proves neither
authenticated identity nor actual human participation. `APPROVED` approves the
exact artifact only; it does not resolve the retention hold, choose remediation,
authorize execution or adoption, invoke a provider, perform an evaluation, show
human benefit or learning, install, promote, merge, mutate the Foundation, or
grant `CANON`.

The runtime imports no ReviewService, operations API, filesystem, network, or
process module and writes no durable output. Exact v2.9 rebuild invokes the
inherited v2.8 verifier, which may exclusive-create, file-sync, and remove its
declared transient operation lock. A fresh-process test proves rebuild from the
same caller-owned roots, not independent custody, external persistence,
file-`fsync`, hardware durability, or trusted time.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
