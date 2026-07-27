# AXM Verification Spine v2

The Verification Spine keeps one Main Verifier while allowing every field to
bring its own honest exam. Existing specialist verifiers remain authoritative
for their native claims. The Spine normalizes their receipts, applies a target
profile, names cross-field conflicts and preserves bounded failure lessons.

## Shape

1. `registry.json` discovers independent category packs and target profiles.
2. Specialist verifiers emit `axm.verification-receipt/v2` receipts.
3. `verification-spine.js` validates receipts and resolves them without one
   universal score.
4. `workspace-runner.js` adapts the current core, module, Game Night, editable
   checks and Failure Memory into the shared receipt contract.
5. `hub/verify-plus.js` writes `exports/verification-spine-report.json`.

## Verdicts

- `VERIFIED`: every required native claim passed.
- `VERIFIED_WITH_LIMITS`: only named warnings or optional gaps remain.
- `HUMAN_REVIEW`: the native proof surface is steward judgment.
- `HELD`: evidence is missing, invalid or contradictory.
- `FAILED`: a required non-conflicted claim failed.

Conflicting evidence is held, never averaged. A valid 4K asset can conflict
with a low-VRAM game target without either specialist verifier becoming wrong.

## Failure Memory

Failure lessons live in `verify.config.json` under
`verificationSpine.failureMemory`. A lesson begins as `candidate`, then a
steward may promote it to `active`, `monitor`, `manual-review` or `retired`.
Every revision appends provenance. Active automated lessons require a bounded
editable check. Manual visual, physical-device, taste and meaning checks remain
human-review evidence instead of fake automation.

The memory stores a compact source summary, receipt/digest references, evidence
route and minimal check. Raw logs, recordings and repeated retries are not the
memory authority.

## Add a category or profile

Add one JSON pack beneath `category-packs/` or `profiles/`, then register its
relative path in `registry.json`. The loader rejects path escapes, schema drift,
duplicate identities and ID mismatches.

## Run

```powershell
node shared/verification-spine/selftest.js
node hub/verify-plus.js
```

The latest bounded browser evidence is recorded in `LIVE_QA_RECEIPT.md`; raw
screenshots or video are not retained.
