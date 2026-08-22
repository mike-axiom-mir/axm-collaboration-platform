# Changelog

## 0.7.0 — Module 1 deferred-materialization adapter

- Preserved the complete v0.6 body and all earlier regressions.
- Ingested the user-supplied stable Module 1 handoff as a source artifact.
- Added exact Module 1 v0.10.0 identity, package, contract and schema profile.
- Added package-admission versus corpus-materialization state separation.
- Added role-based intake manifest v2 and preflight v3 with explicit `DEFERRED` checks.
- Added nested ZIP hash/path verification for payload and handoff bundles.
- Added semantic-digest collision handling to avoid timestamp-driven false conflicts.
- Added Module 1 truth namespace, proof ceiling and composite evidence policies.
- Added receipt-history preservation guidance without claiming Module 1 receipts are append-only.
- Corrected visual-only 342/689 counts and `CONFIRMED` token assumptions.
- Added 11 adapter tests; complete suite now passes 41/41.
- Did not verify the real final Module 1 ZIP, execute a real registry run, merge, or canonize anything.
