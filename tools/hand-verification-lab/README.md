# AXM Hand Verification Lab

This local TEST module closes the planning seam between a DRAFT missing-hand
specification and implementation verification. It consumes
`axm.missing-hand-specification/v1` from Hand Specification Foundry and emits:

- `axm.hand-verification-plan/v1`, a deterministic ten-family test matrix; and
- `axm.hand-verification-receipt/v1`, an operator evidence record.

The required families cover contract/schema identity, positive behavior,
malformed input refusal, permission and consent refusal, side-effect
confinement, resource budgets, failure recovery, major-version compatibility,
evidence completeness, and promotion/CANON authority holds.

## Honest evidence boundary

The Lab does not run the planned tests. A requested `PASS` counts only when the
operator records both a stable evidence pointer and a concrete observation;
otherwise it is downgraded to `UNKNOWN`. One required `FAIL` makes the overall
receipt `FAIL`; missing, unknown or not-run cases keep it `UNKNOWN`.

Even when all ten cases contain recorded pass evidence, the receipt says
`evidenceAuthority: DECLARED_BY_OPERATOR`, `independentVerification: false` and
`runtimeProven: false`. A native verifier and the named human promotion gate
remain separate work.

The browser module uses no network, persistent storage, background process or
implicit write. JSON files are created only through explicit download buttons.
It cannot install a hand, grant permission, promote a release or change CANON.

## Checks

```powershell
node tools\hand-verification-lab\selftest.js
node tools\hand-verification-lab\discovery-seam-review.js
```
