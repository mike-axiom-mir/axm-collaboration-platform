# Evidence routes

Status: `TEST`

## `safe_representation_compatibility`

- Kind: deterministic behavior, medium risk.
- Pass: existing JSON-safe frontier rebuilds to the exact recorded digest and
  canonical text.
- Primary: native builder plus recorded receipt replay.
- Counterevidence: any safe fixture, receipt digest, or canonical byte changes.
- Verdict: recorded by `CURRENT_MIGRATION_PILOT.json`.

## `unsafe_state_refusal`

- Kind: deterministic behavior, medium risk.
- Pass: all thirteen declared non-JSON fixtures throw before a digest or write.
- Primary: native module self-test and current exposure probe.
- Counterevidence: invalid canonical text or silent field loss.
- Verdict: recorded by `CURRENT_MIGRATION_PILOT.json`.

## `persistence_roundtrip`

- Kind: persistence, medium risk.
- Pass: canonical text parses before write, a temporary-file read parses, and
  read-back re-canonicalization is byte-identical.
- Primary: fresh temporary file created and removed by the builder.
- Counterevidence: parse failure, digest mismatch, or canonical drift.
- Verdict: recorded by `CURRENT_MIGRATION_PILOT.json`.

## `human_benefit`

- Kind: meaning/quality, high risk.
- Pass: explicit human use and judgment.
- Primary: human review, not technical tests.
- Counterevidence: no human participation.
- Verdict: `NOT_RUN`; no benefit claim is made.

## `browser_parity`

- Kind: cross-runtime behavior, medium risk.
- Pass: the migrated consumer runs equivalently in a declared browser path.
- Primary: live browser execution.
- Counterevidence: Node-only proof.
- Verdict: `NOT_RUN`; this consumer is currently a Node module.
