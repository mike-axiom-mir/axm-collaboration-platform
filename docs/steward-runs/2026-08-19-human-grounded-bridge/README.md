# Human-to-grounded bridge — grounded growth increment 3

Date: 2026-08-19

Working identity: Keel (Codex substrate)

Status: `TEST`

Persistent stewardship goal: active

## Outcome first

AXM now has a non-authoritative leaf bridge between native Human Benefit
Evidence and Grounded Growth Outcomes. The bridge contract moved from
`BLOCKED` to `READY` with no missing normalized capabilities.

The complete result stays `DEGRADED`, deliberately: no real voluntary human
session, native live evaluation or final human judgment occurred. The existing
Grounded Growth receipt therefore remains unchanged:

- outcome state: `CANDIDATE_ONLY`;
- human claim: `NOT_RUN` / `NOT_PROVEN`;
- human benefit: not established;
- capability cycle: `AWAITING_STEWARD`.

## Trust seam closed

Before this increment, Grounded Growth checked proof-surface labels, references
and closure, while Human Benefit Evidence checked whether a judgment was truly
native `LIVE` or a `SYNTHETIC` fixture. Nothing forced those two checks to occur
together. A correctly named reference could therefore cross the generic
Grounded boundary without its native receipt content being inspected.

`shared/grounded-growth-human-bridge` now requires all of the following before
mapping a human `PASS` or `FAIL`:

1. a deterministic Verified Capability Loop receipt;
2. a natively valid Human Benefit evaluation and final judgment;
3. `LIVE`, `HUMAN_ENTERED`, claim-scoped human judgment fields;
4. exact agreement among claim, capability, target scope and scope statement;
5. an explicit relation between the evaluated candidate surface and the exact
   capability candidate;
6. a scope-specific external source-trust reference;
7. a deterministic closure receipt covering the native receipts, comparison
   artifacts, capability ancestry, candidate-surface relation and source trust;
8. valid chronology.

Any invalid, synthetic, relabeled, scope-mismatched, unrelated, incomplete,
held or tampered path maps to `UNKNOWN`. Focused fixtures prove that a native
synthetic `PASS` cannot create `HUMAN_GROWTH_ONLY`, even when its fixture
capability is otherwise marked available.

## Closure honesty

The bridge builds and verifies its own closure receipt. Grounded
`coveredDigests` are derived from that exact receipt's source list, preventing
an unrelated receipt reference from being paired with a caller-written digest
list.

This is not a claim that the bridge authenticated external files or a person's
identity. It re-verifies the native cycle, evaluation and judgment content it
receives. External artifact state and source trust stay explicit caller or host
responsibilities.

## Current readiness

`current-bridge-readiness-receipt.json` binds the current cycle, live protocol,
prior Grounded outcome and new bridge implementation. Its state is
`WAITING_FOR_LIVE_HUMAN_EVIDENCE` because evaluation, judgment, source trust and
closure were not supplied.

No current bridge bundle was fabricated. The existing optional human route
remains voluntary and manual; this increment did not run it.

## Verification

- Grounded Growth Human Bridge: 33 focused checks pass.
- Adjacent evidence, lifecycle, growth and human modules: 125 focused checks
  pass.
- Human runner boundary: 5 checks pass after providing its required disposable
  test root.
- Current Grounded outcome and current bridge-readiness exact checks pass.
- All ten required Workshop checks pass.
- Broad result: `VERIFIED_WITH_LIMITS`, 0 failures, 17 existing warnings,
  6 receipts and 9 atomic claims.
- Browser render/click: `NOT_RUN`; no browser-facing UI changed.
- Positive live-human bridge path: `NOT_RUN`; no real human evidence exists.

## File map

- Shared TEST implementation: `shared/grounded-growth-human-bridge/`
- Capability comparison: `requirements.json`, `capabilities.before.json`,
  `capability-gap.before.json`, `capabilities.after.json`,
  `capability-gap.after.json`
- Exact current truth: `current-bridge-readiness.js`,
  `current-bridge-readiness-receipt.json`
- Evidence routing: `EVIDENCE_ROUTES.md`
- Verification truth: `verification-receipt.json`
- Retention boundary: `CURATION_RECEIPT.md`

No module was registered, installed, promoted, published, pushed, committed or
made CANON. No Foundation or existing shared module was modified.
