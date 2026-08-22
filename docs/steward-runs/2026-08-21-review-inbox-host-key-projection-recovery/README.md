# Review Inbox host-key projection recovery v4.2 evidence

Status: `TEST` · branch material only · merge and `CANON` gate: Mike Tobi / AXM

This folder binds the bounded advance from v4.1 host-key authority to an
intent-first, explicitly recoverable ordinary Review Inbox projection. Signed
submission and vote intents are written before their ordinary projection;
interrupted projections stay held and recover only through an exact-confirmed
host-local method.

The result does not prove cross-file atomicity, multi-process serialization,
protected or monotonic storage, rollback prevention, external custody, a real
host policy, real-world identity, actual human participation, trusted time,
reconciliation, execution, adoption, promotion, merge, Foundation mutation,
human benefit, learning, or `CANON`.

Evidence surfaces:

- `CHECK_RESULTS.json`: 62 focused and required commands, all passing, with
  5,945 focused assertions.
- `VISUAL_RECEIPT.json`: seven curated CURRENT, RECOVERY_REQUIRED, HELD,
  desktop, narrow, and exact-item observations; no screenshot files retained.
- `CAPABILITY_GAP_BEFORE.json` / `CAPABILITY_GAP_AFTER.json`: deterministic
  bounded comparison; every required v4.2 capability is ready and optional
  real-world capabilities remain open.
- `EVIDENCE_ROUTES.json`: seven claim-specific proof and counterevidence routes.
- `SOURCE_SNAPSHOT.json`: normalized source commitments produced after the
  product commit.
- `SESSION_SEGMENT.seal.json`, continuation seal, and `CURATION_RECEIPT.json`:
  append-only semantic events plus bounded retention and replay receipts.

Reproduce product verification:

```powershell
node docs/steward-runs/2026-08-21-review-inbox-host-key-projection-recovery/run-verification-checks.js
```

Rebuild capability comparison:

```powershell
node docs/steward-runs/2026-08-21-review-inbox-host-key-projection-recovery/build-capability-reports.js <capability-gap-skill>/scripts/compare_capabilities.py
```

Passing tests do not make this `CANON`. Mike Tobi / AXM remains the merge and
canonization gate.
