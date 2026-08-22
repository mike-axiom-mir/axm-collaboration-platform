# Local-possession checkpoint transition ledger evidence

Status: `TEST`

This folder covers the additive v1.9 stateful seam on branch `codex/grounded-growth-review-challenge-transition-local-possession-checkpoint-transition-ledger-v1.9`.

- `CAPABILITY_*` files preserve the deterministic before/after capability audit.
- `SOURCE_SNAPSHOT.json` binds normalized module and lineage sources.
- `CHECK_RESULTS.json` retains command, phase, exit code, assertion count, verdict, bounded failure diagnostic, and a canonical result digest without retaining passing stdout.
- `EVIDENCE_ROUTES.md` maps each bounded claim to its native verifier and counterevidence.
- The sealed session files preserve durable decisions and corrections without raw logs or temporary fixtures.

Run:

```powershell
node docs/steward-runs/2026-08-21-model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/verification-selftest.js
```

This evidence proves only the declared local `TEST` behavior. It does not prove atomic source binding, global consistency, external retention, protected monotonicity, rollback prevention, authenticated authority/identity, independent custody/controllers, provider execution, real review, benefit, learning, adoption, promotion, merge, or `CANON`.
