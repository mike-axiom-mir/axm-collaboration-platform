# Evidence route

Run: `code-capability-fabric-code-taxonomy-router-v1.5`

## Claim 1 — The taxonomy and router exist with closed typed boundaries

- Kind: existence and static structure
- Risk: medium
- Pass condition: catalog, request, observation, profile, plan, module contract,
  implementation, and focused selftest are present; JSON parses; public schema
  identities match; unknown top-level fields are closed.
- Primary surface: direct file inspection and focused schema assertions.
- Counterevidence: missing file, parse failure, identity drift, or open root object.
- Observed evidence: focused selftest checks all five schema identities and
  closed roots; all authored JSON parses.
- Verdict: `PASS`

## Claim 2 — Identical structured inputs produce an exact deterministic plan

- Kind: deterministic behavior
- Risk: medium
- Pass condition: repeated planning produces canonically identical output and
  exact-input deterministic rebuild accepts it.
- Primary surface: focused executed assertions.
- Counterevidence: output drift, unstable ordering, digest mismatch, or rebuild
  rejection.
- Observed evidence: the 143-check `selftest-code-specialization-router-v1.js` passes repeated
  generation, exact final-byte measurement, and mutated-plan rejection.
- Verdict: `PASS`

## Claim 3 — Code kinds remain multi-axis and ambiguity fails closed

- Kind: deterministic behavior and truth boundary
- Risk: high
- Pass condition: HTML, CSS, JavaScript, JSON/schema, and test fixtures route to
  their declared specialist lanes; `.m`, `.pl`, and `.v` remain ambiguous
  without an exact compatible declaration; unknown languages and frameworks
  become typed holds or gaps.
- Primary surface: focused adversarial execution.
- Secondary surface: catalog and emitted-plan inspection.
- Counterevidence: silent choice, semantic-proof claim from a path, or hidden
  unsupported framework.
- Observed evidence: focused ambiguity, declaration conflict, unknown-language,
  and missing-framework cases pass.
- Verdict: `PASS`

## Claim 4 — Roots, freshness, authority, and Windows paths stop unsafe routing

- Kind: authorization and static boundary
- Risk: high
- Pass condition: root HOLD precedes classification; stale/future observations,
  digest drift, permissions, network, physical actuation, traversal, drive, UNC,
  ADS, reserved names, Unicode aliases, case collisions, and dependency cycles
  fail closed.
- Primary surface: focused adversarial execution.
- Secondary surface: source and module-contract inspection.
- Counterevidence: a specialist lane emitted after a blocking root/freshness
  failure or an accepted path/authority alias.
- Observed evidence: all named focused cases pass.
- Verdict: `PASS`

## Claim 5 — Existing organs are reused without granting them authority

- Kind: lineage and authorization
- Risk: high
- Pass condition: every method reference resolves to the existing Workshop
  Specialist Library with an exact digest; missing contracts route to the
  existing Hand Specification Foundry; lanes grant no files, process, provider,
  network, merge, or lifecycle authority.
- Primary surface: exact reference assertions and Hand Foundry parser test.
- Secondary surface: module contract inspection.
- Counterevidence: invented mask, digest mismatch, automatic checkout, write,
  permission, or competing gap intake.
- Observed evidence: existing mask digests and Hand Foundry intake both pass;
  all lane authority arrays are empty.
- Verdict: `PASS`

## Claim 6 — Specialized knowledge has not been loaded or learned

- Kind: learning-improvement boundary
- Risk: high
- Pass condition: all knowledge lanes are `REFERENCE_ONLY_EMPTY`, contain no
  lesson reference, and truth states knowledge loading and persistent learning
  are false.
- Primary surface: emitted-plan assertions.
- Secondary surface: catalog knowledge policy and module contract.
- Counterevidence: admitted lesson, raw source/prompt/output retention, running
  attempt mutation, hidden learning, or self-promotion.
- Observed evidence: focused positive and tamper cases pass; catalog forbids raw
  source, prompts, stdout/stderr, private content, and hidden reasoning.
- Verdict: `PASS`

## Claim 7 — Fabric continuity and Workshop repository checks still pass

- Kind: deterministic regression evidence
- Risk: high
- Pass condition: every Fabric selftest and all ten checks required by
  `AGENTS.md` exit zero; warnings remain visible.
- Primary surface: executed test processes.
- Counterevidence: any non-zero exit or concealed warning.
- Observed evidence: 27/27 Fabric selftests pass; ten required checks pass;
  `verify.js` reports `0 FAIL · 22 warn · spine b618c5762240070c`.
- Verdict: `PASS_WITH_VISIBLE_WARNINGS`

## Claim 8 — Visual or interaction behavior improved

- Kind: visual appearance and interaction journey
- Risk: medium
- Pass condition: actual render/click evidence.
- Primary surface: browser render and interaction.
- Observed evidence: none; no visual surface changed.
- Verdict: `NOT_APPLICABLE`

## Claim 9 — Integration into the canonical checkout occurred

- Kind: authorization and repository state
- Risk: high
- Pass condition: explicit Mike-approved integration plus target receipt.
- Primary surface: source and target Git receipts.
- Observed evidence: no integration was attempted.
- Verdict: `NOT_RUN`
