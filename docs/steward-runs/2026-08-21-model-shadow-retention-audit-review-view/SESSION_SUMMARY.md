# Model Shadow retention-audit Review Inbox view v3.0

Status: `TEST`

## Bounded result

v3.0 adds a typed read-only decision context to Review Inbox for the exact v2.9
held-retention-audit action and artifact. The browser re-encodes the artifact
with the Workshop deterministic JSON core, recomputes SHA-256 with Web Crypto,
and requires the result to match both the artifact self-digest and Review Inbox
item digest. Only then does the typed context become vote-ready.

The context shows the held v2.7 classification, current best action, bounded
observation/audit/checkpoint references, full reviewed digest, and the explicit
authority boundary: the retention hold remains unresolved, and exact-artifact
approval grants no execution, adoption, provider, evaluation, permission,
promotion, merge, Foundation, or `CANON` authority. Raw exact-item JSON remains
visible underneath. Generic Review Inbox items retain their existing behavior.

Malformed shape, altered payload, mismatched digest, oversized input, or any
inflated action/truth authority renders `INTEGRITY HOLD` and keeps the vote
disabled. A selection revision gate ignores late asynchronous verification
results after the user selects another item. The renderer opens no API,
filesystem, process, provider, or service route; Review Inbox still has exactly
one pre-existing vote POST seam.

## Exact evidence

- Before implementation: 3 required routes `READY`, 17 required routes
  `BLOCKED`, and 7 broader routes `OPTIONAL_UNKNOWN`.
- After implementation: all 20 bounded required routes `READY`; the 7 broader
  routes remain `OPTIONAL_UNKNOWN`, so the result is `DEGRADED`, not complete.
- Focused renderer: 176 assertions across exact v2.9 compatibility, malformed
  shapes, authority inflation, digest drift, oversized input, safe escaping,
  and generic non-disruption.
- Recorded verification: 48/48 commands passed, including 38 focused/inherited
  commands, all ten AGENTS checks, and 4062 focused assertions.
- Source snapshot: 251 normalized current and inherited inputs.
- Browser evidence: at 1440×1000 exact selection reached `VERIFIED`; mismatch
  reached `HOLD` with voting disabled; generic selection stayed untyped; five
  rapid exact→mismatch cycles ended with one hold and no stale verified panel.
- Narrow evidence: at 390×844 the facts were one column, the vote panel was
  static, full digests wrapped, and document scroll width equaled client width.
- Session evidence: 34 ordered `TEST` events are retained in a byte-counted
  SHA-256 sealed JSONL segment without raw command logs or browser telemetry.

The visual harness exposed three synthetic items through GET and returned 405
for POST. The browser tab was closed, its viewport override reset, its temporary
ReviewService state removed, and nine temporary screenshot/DOM buffers cleared
after the semantic receipt was written. Screenshot bytes are not retained; the
receipt retains measurements and transient-frame digests plus a replayable
harness. A full-page baseline capture stitched sticky regions, so that frame was
explicitly excluded from settled-layout acceptance; DOM cardinality and normal
viewport captures were used instead.

## Counterevidence and open boundaries

The canonical tools-index generator was trialed after the Review Inbox manifest
change. It exposed broad unrelated index churn and invalidation of historical
self-test receipts. Because `tools-index.json` was clean before that trial, only
the generated rewrite was reverted. Direct v0.3 contract evidence is included;
a coordinated global tools-index refresh remains open.

The harness is not live host submission, authenticated identity, actual human
review, a vote, a decision, approval, or retention-hold resolution. DOM/ARIA
inspection is not an assistive-technology audit, and synthetic layout checks do
not prove usability or human benefit. No provider was invoked and no evaluation,
learning, adoption, promotion, merge, Foundation mutation, or `CANON` occurred.

Mike Tobi / AXM remains the merge and `CANON` gate.
