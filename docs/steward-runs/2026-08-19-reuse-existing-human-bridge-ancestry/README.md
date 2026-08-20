# Reuse-existing human bridge ancestry

Status: `TEST`

This additive steward lane closes the exact technical gap found by the prior
human-readiness coverage run. The four current capability chains already had
voluntary, answer-free protocols, but the v1 Grounded human bridge could bind
only `cycle.candidate.artifactRef`. Two current cycles correctly use
`REUSE_EXISTING` and carry their surface at
`cycle.gap.existingCapabilityRef`.

The new v2 bridge leaf derives one mutually exclusive ancestry mode and emits a
native intervention-link receipt:

- two current routes resolve as `CANDIDATE`;
- two current routes resolve as `REUSE_EXISTING`;
- all four exact links verify against the current cycle and protocol;
- a reused capability is never rewritten as a candidate.

The v1 bridge, its schemas, contract, and sealed readiness receipts remain
unchanged. This later receipt supersedes only the earlier finding that two
routes lacked exact bridge ancestry support.

## Human boundary

No person was prompted or observed. No LIVE session, evaluation, explicit
human judgment, bridge bundle, Grounded Growth refresh, human benefit, cohort
claim, promotion, or CANON decision was produced. Synthetic fixtures test the
contract and always map to `UNKNOWN`.

## Exact checks

```text
node shared/grounded-growth-human-bridge-v2/selftest.js
node docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness.js --check-recorded
node docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/selftest.js
```

## Sealed handoff

- `VERIFICATION_RECEIPT.json` records 98 focused, 192 adjacent, and 10/10
  required checks.
- `session.jsonl` preserves the ordered durable events.
- `session.seal.json` binds that segment by SHA-256.
- `SESSION_SUMMARY.md` states the result, boundaries, and remaining human seam.
- `CURATION_RECEIPT.json` records retention and temporary-fixture handling.
