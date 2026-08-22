# Model Shadow local possession checkpoint pairwise transition evidence

Status: `TEST`

This bounded evidence folder covers the v1.8 additive pairwise adapter on branch
`codex/grounded-growth-review-challenge-transition-local-possession-checkpoint-pairwise-transition-v1.8`.

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

Run:

```powershell
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest.js
node docs/steward-runs/2026-08-20-model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/verification-selftest.js
```

This evidence proves only pairwise behavior at the declared `TEST` boundary. It
does not prove live source currentness, global fork exclusion, independent
custody/controllers, authenticated identity, anti-collusion, trusted retention,
provider execution, benefit, learning, promotion, merge or `CANON`.
