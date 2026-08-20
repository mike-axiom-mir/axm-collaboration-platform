# Grounded Growth deterministic JSON root cohort

Status: `TEST`

> Descendant-branch evolution note
> (`codex/grounded-growth-json-full-closure-v0.4`): this directory remains the
> sealed three-consumer checkpoint. The completed fifteen-consumer scoped
> rollout is recorded in `../2026-08-20-grounded-growth-json-full-closure/`.

This lane advances the serialization rollout from one permissionless leaf to
the first dependency-root cohort:

```text
grounded-growth-outcomes
  -> grounded-growth-feedback
  -> grounded-growth-current-state
```

`outcomes` is the shared digest root. Migrating it alone would make delegated
stringifiers appear strict while `feedback` and `current-state` could still
drop undefined fields during their own legacy clone step. The three modules
therefore close clone, canonical comparison, and digest seams together.

The receipt schemas and valid historical product receipts remain unchanged.
Older verification receipts that bind the previous source-file digests are
preserved and explicitly classified as stale after source evolution; they are
not rewritten into false history.

Run:

```powershell
node docs/steward-runs/2026-08-20-grounded-growth-json-root-cohort/build-current-root-cohort.js
node docs/steward-runs/2026-08-20-grounded-growth-json-root-cohort/selftest.js
node docs/steward-runs/2026-08-20-grounded-growth-json-root-cohort/run-verification-checks.js --write
node docs/steward-runs/2026-08-20-grounded-growth-json-root-cohort/verification-selftest.js
```

Boundaries:

- three related consumers only; eleven unsafe consumers remain;
- representation closure only, not semantic or beneficiary proof;
- temporary persistence files are removed after bounded read-back checks;
- historical source-identity receipts are preserved, not regenerated;
- browser parity and human review remain `NOT_RUN`;
- no install, promotion, merge, `CANON`, or Foundation authority.
