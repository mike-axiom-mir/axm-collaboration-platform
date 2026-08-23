# Receipt serialization closure audit

Status: `TEST`

> Descendant-branch evolution note (`codex/grounded-growth-json-pilot-v0.2`):
> the `CURRENT_*` artifacts in this directory are the sealed pre-migration
> baseline. Their exact rebuild is expected to fail after the voluntary-choice
> pilot changes one source and one observed behavior. Current post-migration
> evidence lives in `../2026-08-20-voluntary-choice-json-migration-pilot/`;
> this directory is not silently rewritten to erase the before state.

This lane turns a real Grounded Growth receipt replay failure into a bounded capability decision. It does not create another serializer. It reuses the previously published, canonical-text-identical `tools/deterministic-json-core` candidate and tests it against current consumer exposure plus held-out JSON-closure fixtures. Source identity normalizes UTF-8 text to LF so a normal Windows checkout cannot invalidate evidence solely by changing line endings.

Current result: the existing strict core refuses every unsafe held-out fixture and exactly roundtrips every safe fixture. Fifteen current Grounded Growth modules still either emit invalid canonical text or silently lose an undefined property. That supports migration review; it does not authorize consumer edits.

Run:

```powershell
node docs/steward-runs/2026-08-20-receipt-serialization-closure/build-current-serialization-closure.js --write
node docs/steward-runs/2026-08-20-receipt-serialization-closure/build-current-serialization-closure.js
node docs/steward-runs/2026-08-20-receipt-serialization-closure/selftest.js
node docs/steward-runs/2026-08-20-receipt-serialization-closure/run-verification-checks.js --write
node docs/steward-runs/2026-08-20-receipt-serialization-closure/verification-selftest.js
```

Boundaries:

- representation closure only;
- no schema, semantics, authenticity, human-benefit, or hidden-reasoning proof;
- no consumer migration, install, promotion, merge, CANON, or Foundation authority;
- browser parity and clean-checkout migration remain `NOT_RUN`;
- the proposed deterministic continuity mirror remains `DIRECTION_ONLY_WAIT_FOR_PLATFORM_CANDIDATE`.
