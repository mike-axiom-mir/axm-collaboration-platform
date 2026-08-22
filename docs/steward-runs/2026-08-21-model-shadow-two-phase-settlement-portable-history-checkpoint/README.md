# Portable settlement-history checkpoint evidence

Status: `TEST`

This folder covers v2.1 on branch `codex/grounded-growth-two-phase-settlement-portable-history-checkpoint-v2.1`.

- `CAPABILITY_*` preserves the deterministic UNKNOWN-before / DEGRADED-after comparison.
- `SOURCE_SNAPSHOT.json` binds normalized module and lineage sources.
- `CHECK_RESULTS.json` retains bounded command outcomes, assertion counts, diagnostics, and a canonical digest without passing stdout.
- `EVIDENCE_ROUTES.md` routes claims to static, deterministic, fresh-process, persistence-comparison, and counterexample evidence.
- The sealed session files retain durable decisions and staged corrections without raw logs or temporary roots.

```powershell
node docs/steward-runs/2026-08-21-model-shadow-two-phase-settlement-portable-history-checkpoint/selftest.js
node docs/steward-runs/2026-08-21-model-shadow-two-phase-settlement-portable-history-checkpoint/verification-selftest.js
```

The evidence proves only caller-presented relative history accountability. It proves no retention or rollback prevention. Mike Tobi remains the merge/CANON gate.
