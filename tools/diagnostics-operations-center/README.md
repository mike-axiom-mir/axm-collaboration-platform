# AXM Diagnostics & Operations Center v0.3

Diagnostics is an observational Workshop product. It composes independent service probes into `axm.diagnostics-snapshot/v2`, exposes the state and coverage of every probe, offers a fixed catalog of bounded log sources, validates reviewed Windows offline-first evidence packets, and creates explicitly requested diagnostic reports with persistent SHA-256 lineage.

## Windows offline-first gate

The gate is a thin native adapter derived from the useful part of the V106 local/offline deployment intake. It expects four independently reviewable inputs: Windows network evidence, a runtime manifest plus byte-verification receipt, a candidate receipt, and a lifecycle receipt. A physical proof requires disabled hardware adapters, no default routes, no non-loopback addresses, no DNS or proxy, a measured zero-request lifecycle trace, a non-synthetic bundled runtime, loopback readiness, and an owned stop that releases the port.

`scripts/collect-windows-offline-evidence.ps1` creates a read-only precondition snapshot. It deliberately records the lifecycle request count as unmeasured, so the collector alone can never pass the physical proof gate. Previewing a packet writes nothing. Recording requires explicit intent and retains only the packet digest and normalized gate result, not raw adapter or connection evidence.

## Truth boundary

- One failed probe becomes `UNAVAILABLE`; other probes still return.
- Optional adapters that are absent become `NOT_CONFIGURED`, not fake failures and not fake passes.
- The complete snapshot is `DEGRADED`, `PARTIAL`, or `HEALTHY` from visible probe evidence.
- Log source paths are fixed server-side and never returned to the browser.
- Log envelopes are bounded to 200,000 bytes and include a digest of exactly the returned bytes.
- Structured sensitive fields and common token patterns are redacted before return. This is best-effort protection, not certification that arbitrary logs are secret-free.
- Reports contain diagnostic status, not log tails or secret values.
- Every explicit report has a sidecar receipt and an entry in bounded persistent export lineage.
- Synthetic evidence may pass structural validation but can never become physical proof.
- The offline gate never disables adapters, installs a runtime, grants public support, publishes, or promotes.
- Reading snapshots, source catalogs, logs, or export lineage does not grant authority or repair anything.

Diagnostics never repairs, restarts, executes arbitrary work, exports automatically, approves a module, or promotes CANON. The module remains `TEST`; Mike remains the human review and promotion gate.

## Verification

```powershell
node tools/diagnostics-operations-center/selftest.js
node tools/diagnostics-operations-center/discovery-seam-review.js
node shared/operations/selftest.js
```
