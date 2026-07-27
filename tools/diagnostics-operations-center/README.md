# AXM Diagnostics & Operations Center v0.2

Diagnostics is an observational Workshop product. It composes independent service probes into `axm.diagnostics-snapshot/v2`, exposes the state and coverage of every probe, offers a fixed catalog of bounded log sources, and creates explicitly requested diagnostic reports with persistent SHA-256 lineage.

## Truth boundary

- One failed probe becomes `UNAVAILABLE`; other probes still return.
- Optional adapters that are absent become `NOT_CONFIGURED`, not fake failures and not fake passes.
- The complete snapshot is `DEGRADED`, `PARTIAL`, or `HEALTHY` from visible probe evidence.
- Log source paths are fixed server-side and never returned to the browser.
- Log envelopes are bounded to 200,000 bytes and include a digest of exactly the returned bytes.
- Structured sensitive fields and common token patterns are redacted before return. This is best-effort protection, not certification that arbitrary logs are secret-free.
- Reports contain diagnostic status, not log tails or secret values.
- Every explicit report has a sidecar receipt and an entry in bounded persistent export lineage.
- Reading snapshots, source catalogs, logs, or export lineage does not grant authority or repair anything.

Diagnostics never repairs, restarts, executes arbitrary work, exports automatically, approves a module, or promotes CANON. The module remains `TEST`; Mike remains the human review and promotion gate.

## Verification

```powershell
node tools/diagnostics-operations-center/selftest.js
node tools/diagnostics-operations-center/discovery-seam-review.js
node shared/operations/selftest.js
```
