# Voluntary-choice deterministic JSON migration pilot

Status: `TEST`

This lane migrates exactly one permissionless Grounded Growth leaf from a
legacy canonicalizer to the existing `deterministic-json-core`. Candidate
selection was based on the secured tree: the voluntary-choice frontier has
zero external code references, while other exposed consumers feed shared
runtime or governance paths.

The receipt schema and every valid historical output remain unchanged. The
behavioral delta is intentionally limited to non-JSON-representable state:
undefined values, sparse arrays, non-finite numbers, bigint, symbols,
functions, non-plain objects, and cycles now fail before cloning, digesting,
or persistence can silently lose them.

Run:

```powershell
node docs/steward-runs/2026-08-20-voluntary-choice-json-migration-pilot/build-current-migration-pilot.js
node docs/steward-runs/2026-08-20-voluntary-choice-json-migration-pilot/selftest.js
node docs/steward-runs/2026-08-20-voluntary-choice-json-migration-pilot/run-verification-checks.js --write
node docs/steward-runs/2026-08-20-voluntary-choice-json-migration-pilot/verification-selftest.js
```

Boundaries:

- one consumer only; the other fourteen remain unchanged and exposed;
- representation closure only, not schema or semantic proof;
- temporary persistence probe only; no product data is written;
- no browser, human-comprehension, or human-benefit test;
- no install, promotion, merge, `CANON`, or Foundation authority;
- no model reasoning, learning, or shadow-clone equivalence claim.
