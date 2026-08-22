# Review Inbox host-key authority path v4.1 evidence

Status: `TEST` · branch material only · merge and `CANON` gate: Mike Tobi / AXM

This folder binds the bounded advance from caller-labelled Review Inbox votes to
a separate host-configured Ed25519 key-possession authority view. It preserves
legacy review behavior while preventing legacy `APPROVED` from standing in for
host-key authority.

The path verifies exact signed submission and vote envelopes, policy roles and
kinds, active windows, replay refusal, declared-principal seat uniqueness,
optional submitter/reviewer separation, signed-submission prerequisite, and
fresh-process revalidation. Missing or replaced policy, corrupt ledger, expired
or altered evidence, and item drift all hold authority closed.

The result proves configured-key possession only. It does not prove named
identity, actual human participation, independent controllers, trusted time,
atomic or protected persistence, external custody, reconciliation, execution,
adoption, promotion, merge, Foundation mutation, human benefit, learning, or
`CANON`.

Evidence surfaces:

- `CHECK_RESULTS.json`: complete focused inheritance plus all ten AGENTS checks.
- `SOURCE_SNAPSHOT.json`: normalized source commitments.
- `CAPABILITY_GAP_BEFORE.json` / `CAPABILITY_GAP_AFTER.json`: deterministic
  bounded capability comparison; optional real-world capabilities remain open.
- `EVIDENCE_ROUTES.json`: six claim-specific proof and counterevidence routes.
- `VISUAL_RECEIPT.json`: seven curated desktop/narrow frame commitments; raw
  screenshot buffers and browser telemetry were not retained.
- `SESSION_SEGMENT.seal.json`, `SESSION_SEGMENT_ADDENDUM.seal.json`, and
  `CURATION_RECEIPT.json`: ordered append-only semantic history, including
  failed detached-checkout diagnostics, exact cleanup, and clean replay.

Reproduce product verification:

```powershell
node docs/steward-runs/2026-08-21-review-inbox-host-key-authority-path/run-verification-checks.js
```

Rebuild derived evidence:

```powershell
node docs/steward-runs/2026-08-21-review-inbox-host-key-authority-path/build-static-evidence.js
node docs/steward-runs/2026-08-21-review-inbox-host-key-authority-path/build-capability-reports.js <capability-gap-skill>/scripts/compare_capabilities.py
node docs/steward-runs/2026-08-21-review-inbox-host-key-authority-path/build-source-snapshot.js
```

Passing tests do not make this `CANON`. Mike Tobi / AXM remains the merge and
canonization gate.
