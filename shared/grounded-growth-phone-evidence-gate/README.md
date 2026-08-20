# Grounded Growth phone-evidence gate

Status: `TEST`

This dependency-free, read-only adapter connects the voluntary physical-phone
campaign to Grounded Growth without turning device behavior into a human-value
claim.

It keeps two independent keys:

1. **Device behavior** requires the exact complete QA Lab receipt, an explicit
   accepted campaign review bound to its digest, and a later passing Game Hub
   verifier report in which the selected game's physical-phone warning is gone.
2. **Human usefulness** requires an independently valid Grounded Growth human
   handoff package for the same declared capability, claim, scope, and
   game-manifest surface. The existing handoff verifier rebuilds its protocol,
   live session evidence, explicit judgment, local source declaration, closure,
   v2 bridge, and outcome together. A standalone outcome receipt is not enough.

Only both keys produce `TWO_KEY_EVIDENCE_PRESENT`. That state is evidence for
explicit steward review; it does not modify a game, clear a warning, update the
Grounded Growth portfolio, install, promote, merge, or create `CANON`.

Run the focused suite with:

```powershell
node shared/grounded-growth-phone-evidence-gate/selftest.js
```
