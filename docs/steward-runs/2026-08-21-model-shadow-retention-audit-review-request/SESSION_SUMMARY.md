# Model Shadow retention-audit review request v2.9

Status: `TEST` · installed: `false` · promoted: `false`

## Bounded result

v2.9 adds a data-only bridge from one exact persisted **held** v2.8
retention-audit observation to a minimized self-digested Review Inbox candidate.
The candidate embeds the exact artifact it asks a reviewer to inspect and
declares the existing `POST /api/reviews` plus
`x-axm-review: explicit-submit` host boundary. The runtime does not call that
route, import ReviewService, open a network connection, or write Review Inbox
state.

The focused harness demonstrated compatibility with the existing ReviewService
in a bounded synthetic root. A separate Node.js process reloaded the same
pristine `PENDING` item. This is transport evidence for the local test, not
proof that the host authorized a real submission, that the receiver is
independently operated, or that caller-presented handoff data proves
persistence.

Requests refuse non-held, missing, altered, sequence-mismatched, early, or
oversized observation packages. Handoffs refuse receiver mismatch, approval,
votes, discussion, expiry, altered action data, early time, or request drift.
The public request and handoff omit configured paths, complete v2.8
observations, complete v2.7 audits, audit inputs, votes, notes, identities, raw
model output, and private context.

## Exact evidence

- Before implementation: 2 required routes `READY`, 16 required routes
  `BLOCKED`, and 8 broader routes `OPTIONAL_UNKNOWN`.
- After implementation: all 18 bounded required routes `READY`; the 8 broader
  routes remain `OPTIONAL_UNKNOWN`, so the result is `DEGRADED`, not complete.
- Verification: 45/45 recorded commands passed, including 35 focused/inherited
  commands, all ten required AGENTS checks, and 3869 focused assertions.
- Source snapshot: 239 normalized current and inherited inputs.
- Session evidence: 34 ordered `TEST` events retained in a byte-counted SHA-256
  sealed JSONL segment; raw command logs were not retained.

The request and handoff builders left durable source, retention, observation,
and synthetic Review Inbox bytes unchanged around their builds. The inherited
v2.8 verifier may still exclusive-create, file-sync, and remove its fixed
transient operation lock; this is declared rather than hidden.

## Counterevidence and open boundaries

ReviewService currently writes JSON through a temporary file and rename, but
its utility source provides no file-`fsync` evidence and falls back on unreadable
JSON. Therefore this work does not claim corruption resistance, directory-entry
or hardware durability, protected state, external custody, or retention
duration.

`PENDING` proves no vote, authenticated actor, actual human review, decision,
approval, or hold resolution. Even a future approval would not by itself
authorize execution, adoption, promotion, merge, Foundation mutation, or
`CANON`. No provider was invoked and no evaluation, human benefit, or learning
was shown. Independent Draft 2020-12 meta-validation remains unrun because no
compatible validator was available and no dependency was installed.

Browser render/click verification is not applicable to this nonvisual Node.js
adapter. Mike Tobi / AXM remains the merge and `CANON` gate.
