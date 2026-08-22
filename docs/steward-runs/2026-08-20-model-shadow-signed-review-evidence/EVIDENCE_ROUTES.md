# Model Shadow signed review evidence routes

Status: `TEST`

| Atomic claim | Kind / risk | Pass condition | Native evidence | Counterevidence | Verdict |
|---|---|---|---|---|---|
| The v1.0 reviewed handoff is exact | Deterministic behavior / medium | Native rebuild matches the exact supplied handoff | Upstream verifier plus focused fixture | Any content or digest mismatch | PASS |
| Detached signatures bind the exact review artifacts | Authorization-adjacent deterministic behavior / high | Ed25519 verification succeeds only for the exact handoff, proposal, plan, review evidence, retained approval, policy, and challenge | Focused positive and tamper/refusal cases; schema and source inspection | A changed binding still verifies | PASS in synthetic TEST fixtures |
| The receipt proves policy-listed signing-key possession | Authorization / high | A valid detached signature verifies against an enabled key in the exact policy | Node crypto verification plus key-fingerprint receipt | Invalid, unlisted, duplicate, expired, or non-Ed25519 key passes | PASS in synthetic TEST fixtures |
| The caller policy is a trusted host root | Authorization / high | An independently provisioned host trust root validates the policy | Independent host identity/permission boundary | Policy is merely caller supplied | UNKNOWN / NOT_RUN |
| The signer is the real human represented by the label | Authorization / high | Independent identity binding plus allowed/denied identity attempts | External identity provider or Mike-controlled trust ceremony | Generated fixture key or caller assertion | UNKNOWN / NOT_RUN |
| The challenge is single-use | Persistence / high | A fresh-process ledger accepts once and refuses replay | Persistent nonce ledger plus restart/replay test | Stateless re-verification succeeds repeatedly | UNKNOWN / NOT_BUILT |
| Signature evidence authorizes execution | Authorization / high | Separate explicit execution permission and host confirmation exist | Independent permission check | Signature receipt alone | FAIL by design; authority remains NONE |
| Human benefit or learning occurred | Quality / learning / high | Held-out native human outcome and held-out learning evaluation exist | Voluntary human route plus held-out evaluation | Technical signature tests only | UNKNOWN / NOT_RUN |

No browser UI was added. Browser render/click evidence is not applicable to this leaf.
