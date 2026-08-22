# Evidence routes — Grounded Growth signal lineage

Status: `TEST`

## `signal-lineage-exists`

- Claim: a reusable pure signal-lineage verifier exists.
- Kind: existence and static structure.
- Risk: low.
- Pass condition: the module, contract, schema, README, and selftest exist and
  parse; the contract declares no permissions or write surface.
- Primary surface: direct files plus JavaScript and JSON parsing.
- Counterevidence: missing file, invalid syntax, permission, or write route.
- Verdict: `PASS` after focused verification.

## `all-research-dispositions-covered`

- Claim: every one of the six accepted signals and six rejected/deferred
  proposals has exactly one current lineage row.
- Kind: deterministic behavior and static identity.
- Risk: medium.
- Pass condition: native rebuild binds the exact disposition digest, refuses
  missing or duplicate rows, and reports 6/6 signal plus 6/6 proposal coverage.
- Primary surface: native build and adversarial selftest.
- Counterevidence: omission, duplicate identity, altered disposition digest,
  or count-only acceptance.
- Secondary surface: detached coverage-coherence verification.
- Verdict: pending recorded current receipt.

## `technical-links-are-current`

- Claim: five technical signals bind exact current source bytes and, where
  applicable, admitted current portfolio claims.
- Kind: deterministic behavior and provenance.
- Risk: high.
- Pass condition: native rebuild verifies the portfolio, exact outcome and
  claim digests, and current file digests for every declared technical source.
- Primary surface: native exact rebuild against filesystem bytes.
- Counterevidence: missing source, changed digest, stale outcome, unknown
  claim, non-admitted verdict, or source-only detached receipt.
- Secondary surface: focused source selftests named by the lineage receipt.
- Verdict: pending current build and checkpoint.

## `human-unknown-remains-human-unknown`

- Claim: the human-comprehension signal remains waiting for voluntary
  human-native evidence and is not converted into technical closure.
- Kind: authorization, human outcome, and meaning.
- Risk: high.
- Pass condition: the row remains
  `WAITING_VOLUNTARY_HUMAN_EVIDENCE`, requires
  `VOLUNTARY_HUMAN_NATIVE_EVIDENCE`, binds no human `PASS`, and starts no
  participation.
- Primary surface: receipt invariants and negative tests.
- Counterevidence: synthetic human pass, readiness treated as benefit, or an
  automatic participation request.
- Secondary surface: current participation-frontier receipt.
- Verdict: `PASS` for boundary preservation; human benefit itself remains
  `UNKNOWN` / `NOT_RUN`.

## `proposals-remain-non-actions`

- Claim: five rejected/redundant proposals and one deferred proposal remain
  explicit zero-action states.
- Kind: authorization and deterministic behavior.
- Risk: high.
- Pass condition: all six rows have `action: NONE`, no automatic action, and
  the deferred human-facing signal ledger remains unimplemented.
- Primary surface: native receipt plus recomputed-tamper tests.
- Counterevidence: execute/install/promote/build action or a claim that this
  derived audit is the deferred human-facing ledger.
- Secondary surface: module contract permission and refusal inspection.
- Verdict: pending current receipt.

## `bounded-ai-workflow-effect`

- Claim: exact signal lineage makes fewer unsupported stewardship decisions
  than an ID-and-status-only shortcut on the declared case set.
- Kind: learning-improvement-adjacent workflow outcome.
- Risk: high.
- Pass condition: every frozen case reaches its expected admit, hold, or refuse
  decision, with a declared baseline and no hidden case removal.
- Primary surface: deterministic AI-workflow evaluation.
- Counterevidence: candidate mismatch, skipped case, changed expected answer,
  or authority inflation.
- Secondary surface: adversarial selftest and exact recorded rebuild.
- Verdict: pending. Even a pass is bounded workflow evidence, not model
  learning, changed weights, intelligence, or broad generalization.

## `human-benefit`

- Claim: a person makes better decisions or understands the research lineage
  more clearly.
- Kind: human workflow outcome and meaning.
- Risk: high.
- Pass condition: separate voluntary representative human comparison with
  explicit scoped judgment and current closure.
- Primary surface: voluntary human-native observation or judgment.
- Counterevidence: withdrawal, confusion, worse decisions, or no participant.
- Verdict: `NOT_RUN`.

## `portable-source-truth`

- Claim: a detached lineage receipt authenticates its referenced source files.
- Kind: provenance.
- Risk: high.
- Pass condition: unavailable without the native source graph.
- Primary surface: native exact rebuild only.
- Counterevidence: coherent forged references that pass detached integrity.
- Verdict: `UNKNOWN`; detached mode is integrity-only.
