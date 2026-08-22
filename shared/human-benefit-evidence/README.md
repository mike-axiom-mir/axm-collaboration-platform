# AXM Human Benefit Evidence

Status: `TEST`

Representation boundary: v0.2 uses the shared strict deterministic JSON core.
Safe JSON keeps the existing canonical bytes; unsupported, cyclic, sparse, or
otherwise non-JSON state is refused instead of being dropped or rewritten.

This leaf module makes one missing step possible without pretending it already
happened:

```text
predeclared human-benefit claim
  -> blinded baseline/candidate protocol
  -> voluntary structured observation
  -> minimal digest-bound session receipt
  -> deterministic aggregate signal
  -> explicit claim-scoped human judgment
```

The aggregate signal is not the judgment. Accuracy, unsupported decisions,
time, confusion, self-reported effect and burden can inform a human, but the
module always leaves `humanBenefitVerdict: NOT_RUN` until a separate declared
human judgment is entered.

## Agency and privacy boundary

- participation is voluntary opt-in;
- a completed session needs a second completion confirmation;
- withdrawal produces a receipt with no participant reference, observations or
  participant judgment;
- only structured responses are retained—no raw identity, free text, audio,
  video, screen recording or network transport;
- `participantRef` and `judgeRef` are caller-supplied SHA-256 pseudonymous
  references, not authenticated identities;
- the module cannot prove a person actually entered a declared live response.
  Source authentication and the final governance decision stay external.

## Scope boundary

A one-person protocol can establish only a named local steward's experience.
It cannot become a claim about everyone. A declared cohort protocol requires at
least two completed, unique participant references, and its scope statement
must still name the actual cohort.

Synthetic fixtures are useful for testing the machinery but always remain
`SYNTHETIC`, `usableAsLiveEvidence: false`, and non-authoritative.

The current steward-run includes an optional terminal presenter. It shows only
the answer-free participant packet, times structured choices, permits
withdrawal at every trial and emits a receipt to standard output. It does not
run automatically or write the receipt.

This module does not recruit people, write sessions, connect to the network,
authenticate a human, update Grounded Growth Outcomes, install, promote,
publish, change CANON or mutate Foundation.

Run:

```powershell
node shared/human-benefit-evidence/selftest.js
```
