# Evidence routes

Status: `TEST`

## Cohort representation closure

- Claim: all three cohort modules refuse non-JSON state at canonical and clone
  boundaries.
- Kind/risk: deterministic behavior, medium.
- Pass: 13/13 unsafe fixtures per module refuse and a real build injection per
  module fails before cloning.
- Primary: current cohort builder plus native self-tests.
- Counterevidence: invalid canonical text, silent loss, or an accepted injected
  undefined field.

## Historical product compatibility

- Claim: JSON-safe product receipts retain exact canonical bytes and digests.
- Kind/risk: deterministic behavior and persistence, medium.
- Pass: exact rebuild of the recorded portfolio and current-state receipt;
  detached native verification of the feedback packet; three write/read-back
  canonical journeys.
- Counterevidence: digest or canonical drift.

## Source-identity evolution

- Claim: old verification receipts bind old source, not current source.
- Kind/risk: provenance, medium.
- Pass: preserve the old receipts and explicitly record their expected stale
  state after the three source files change.
- Counterevidence: silently regenerating old dated evidence.

## Human benefit and browser parity

- Claim: none.
- Kind/risk: human meaning and cross-runtime behavior, high/medium.
- Required evidence: explicit human review and live browser execution.
- Verdict: `NOT_RUN`.
