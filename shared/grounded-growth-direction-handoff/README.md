# Grounded Growth Direction Handoff

Status: `TEST`

Clone, canonical comparison, and digest preparation use the shared strict
`deterministic-json-core`. Existing JSON-safe handoff bytes remain unchanged;
unsupported JSON state is refused before proposal mapping or digest binding.

This leaf closes one contract gap between verified Grounded Growth feedback and
Grounded Evolution Intelligence. It converts feedback needs into digest-bound,
GEI-compatible direction drafts without accepting or executing them.

The mapping is deliberately conservative:

- a need with one compatible response becomes a `HYPOTHESIS`, `PENDING`,
  `NOT_STARTED` direction;
- a need with several compatible responses stays held until an explicit,
  digest-bound proposal selection is supplied;
- the adapter never authenticates the person or process behind that selection;
- `WAIT_FOR_EVIDENCE` creates no work steps and preserves voluntary completion
  or withdrawal;
- every action direction keeps baseline/challenger proof, AI-workflow benefit,
  and voluntary human benefit as separate evidence routes.

The transparent priority score is advisory only. It reuses severity, reach and
confidence from the verified need, applies declared per-action cost/risk
constants, and cannot promote, install, merge, write, execute or change CANON.
No model-weight learning is claimed.

Run focused checks with:

```powershell
node shared/grounded-growth-direction-handoff/selftest.js
```
