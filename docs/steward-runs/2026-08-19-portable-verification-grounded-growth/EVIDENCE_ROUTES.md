# Evidence routes

## `portable-capability-cycle`

- Claim: the detached verifier is an exact, verified candidate capability.
- Kind: static structure plus deterministic behavior.
- Risk: medium.
- Pass condition: the candidate binds exact implementation, contract, schema,
  CLI, tests, evaluation, and prior verification bytes; all candidate sources
  still match; the capability proof binds the aggregate candidate digest.
- Primary surface: exact file inventory plus focused runtime evaluation.
- Counterevidence: a missing or changed source, invalid self-digest, failing
  evaluation, or verification subject mismatch.
- Secondary surface: native Verified Capability Loop verification.

## `shared-system-effect`

- Claim: the guard rejects internally contradictory recomputed receipts beyond
  what self-digest checking can detect.
- Kind: deterministic behavior.
- Risk: medium.
- Pass condition: all eleven frozen cases match expectation and seven
  recomputed contradictions pass digest-only checking but fail the guard.
- Primary surface: focused execution over the frozen case set.
- Counterevidence: any expectation mismatch or authority-inflated portable pass.
- Secondary surface: exact recorded evaluation rebuild.

## `ai-workflow-benefit`

- Claim: the bounded guard improves evidence-routing decisions for an
  AI-assisted stewardship workflow on the declared cases.
- Kind: workflow outcome.
- Risk: medium.
- Pass condition: digest-only checking admits ten cases while the guard makes
  all eleven expected accept/reject/hold decisions and preserves the source
  truth ceiling on all coherent passes.
- Primary surface: representative AI-workflow evaluation.
- Counterevidence: fewer correct decisions, erased source-truth uncertainty, or
  the result being presented as model learning/generalization.
- Secondary surface: native Grounded Growth claim routing and closure.

## `human-benefit`

- Claim: a person benefited from the portable verifier.
- Kind: workflow outcome and human meaning.
- Risk: high.
- Primary surface: a separate voluntary human-native journey.
- Observed evidence: none.
- Verdict: `NOT_RUN`.
- Named seam: `HUMAN_BENEFIT_REQUIRES_NEW_VOLUNTARY_EVENT`.

## `successor-current-state`

- Claim: the ninth outcome extends history without invalidating the existing
  voluntary human handoff.
- Kind: deterministic behavior and participation authorization.
- Risk: high.
- Pass condition: all eight prior outcome bytes remain exact, the new
  capability is not the protected `simulation.run-envelope.verify` chain, the
  handoff stays optional, and no participation or action starts automatically.
- Primary surface: exact portfolio ancestry and current-state rebuild.
- Counterevidence: rewrite/reorder, protected-chain advance, stale review
  candidate, or any autonomous authority.
- Secondary surface: detached successor receipt inspection.
