# Grounded Growth Feedback

Status: `TEST`

This leaf adapter turns a natively verified Grounded Growth outcome or
portfolio into digest-bound, Grounded Evolution Intelligence-compatible
evidence records and open improvement-need candidates.

It is deliberately smaller than an evolution engine. It creates no evolution
direction, modifies no registry, executes no work, and grants no install,
promotion, merge, CANON, Foundation, or model-training authority. The output is
an attention packet for steward review.

Ordering is conservative. `EVIDENCE_HOLD`, `REGRESSION_HOLD`,
`REFRESH_REQUIRED`, and `CYCLE_HOLD` produce repair/refresh/lifecycle needs
before any beneficiary test. `NO_NEW_INFORMATION` produces no new need and a
portfolio follows each capability's effective substantive outcome.

Optional route state is a digest-bound caller declaration. The adapter does not
fetch or authenticate that referenced artifact. `READY_FOR_VOLUNTARY_INPUT`
maps only to `WAIT_FOR_EVIDENCE`; completion and withdrawal remain equally
valid. A route declared satisfied while its source outcome still asks for proof
creates a refresh need rather than silently declaring success.

Deduplication is exact: the deterministic need identity, or an explicit
digest-bound coverage link to an existing GEI need, can suppress repeated work.
Closed or resolved coverage that conflicts with a still-open verified outcome
is preserved as a conflict and re-open candidate instead of being erased.

The focused compatibility check uses the two exact GEI v0.1.0 schema snapshots
under `schema-snapshots/gei-v0.1.0/`. `SOURCE.json` records their canonical
SHA-256 digests and candidate source paths. Keeping the schema fixtures with the
adapter makes a clean checkout testable without installing or partially
promoting the much larger experimental GEI tool candidate.

Run focused checks with:

```powershell
node shared/grounded-growth-feedback/selftest.js
```
