# Model Shadow local possession checkpoint separation evidence

Status: `TEST`

This bounded evidence folder covers the v1.7 additive separation adapter on
branch
`codex/grounded-growth-review-challenge-transition-local-possession-checkpoint-separation-v1.7`.

Key artifacts:

- `CAPABILITY_REQUIREMENTS.json`, `CAPABILITY_INVENTORY_*.json` and
  `CAPABILITY_GAP_*.json` preserve the deterministic before/after comparison.
- `SOURCE_SNAPSHOT.json` binds normalized module and lineage sources.
- `CHECK_RESULTS.json` preserves bounded command outcomes and the canonical
  result digest without retaining passing stdout.
- `EVIDENCE_ROUTES.md` maps each claim to its native proof surface and names
  counterevidence.
- `SESSION_SEGMENT.jsonl`, its structural seal, `SESSION_SUMMARY.md`,
  `SESSION_INDEX.json` and `CURATION_RECEIPT.json` preserve the session without
  raw logs or temporary fixtures.

Run the evidence checks:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-local-possession-checkpoint-separation/selftest.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-local-possession-checkpoint-separation/verification-selftest.js
```

This evidence proves only observable cross-layer non-overlap at the declared
`TEST` boundary. It does not prove independent custody/controllers,
authenticated identity, anti-collusion, host trust, policy replacement
prevention, external retention, provider execution, benefit, learning,
promotion, merge or `CANON`.
