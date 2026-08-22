# Local-possession two-phase settlement ledger evidence

Status: `TEST`

This folder covers v2.0 on branch `codex/grounded-growth-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-v2.0`.

- `CAPABILITY_*` preserves the deterministic BLOCKED-before / DEGRADED-after comparison.
- `SOURCE_SNAPSHOT.json` binds normalized module and lineage sources.
- `CHECK_RESULTS.json` retains bounded command outcomes, assertion counts, diagnostics, and a canonical digest without passing stdout.
- `EVIDENCE_ROUTES.md` maps claims to native proof and counterevidence.
- The sealed session files retain durable decisions and failed/corrected checkpoints without raw logs or temporary fixtures.

```powershell
node docs/steward-runs/2026-08-21-model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/verification-selftest.js
```

The evidence proves only the declared caller-owned `TEST` behavior. Mike Tobi remains the merge/CANON gate.
