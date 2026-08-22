# Grounded growth evidence routes

## `gap.beneficiary-outcome-contract`

- Claim: the Workshop lacked one portable contract separating system effect,
  human benefit and AI-workflow benefit.
- Kind: static structure / contract.
- Risk: medium.
- Pass condition: current contracts expose the lifecycle and intervention data
  but no beneficiary-specific evidence gate or outcome receipt.
- Primary surface: current module contracts and deterministic capability
  comparator.
- Counterevidence: an existing current receipt with exact human and AI outcome
  evidence routes.
- Observed evidence: `capability-gap.before.json` is `BLOCKED` on human outcome,
  AI-workflow outcome and digest receipt capabilities.
- Verdict: `PASS`.
- Named seam: capability availability -> beneficiary outcome.

## `adapter.evidence-routing-behavior`

- Claim: the new adapter refuses evidence substitution and broken ancestry.
- Kind: deterministic behavior.
- Risk: medium.
- Pass condition: wrong human/AI proof surfaces, held or unrelated closure,
  duplicate claims, tampering and mismatched parents all hold or fail.
- Primary surface: focused runtime selftest.
- Counterevidence: any invalid route admitted as beneficiary `PASS` or any
  broken chain accepted.
- Observed evidence: 31 focused checks pass.
- Verdict: `PASS`.
- Named seam: supplied evidence receipt -> admitted outcome claim.

## `current.system-effect`

- Claim: the source-closure candidate detects missing or byte-changed registered
  evidence instead of leaving it current.
- Kind: deterministic behavior.
- Risk: medium.
- Pass condition: current files stay `CURRENT`; changed, missing and wrong-type
  files become held states.
- Primary surface: Evidence Retention focused runtime suite and exact capability
  cycle receipt.
- Counterevidence: a mutated registered source reported `CURRENT`, or an
  unchanged source held.
- Observed evidence: source-closure suite passes; current receipt is
  digest-reproducible.
- Verdict: `PASS` for the bounded candidate behavior.
- Named seam: registered evidence identity -> later evidence availability.

## `current.ai-workflow-benefit`

- Claim: the repaired closure improves the bounded evidence-dependent steward
  decision workflow.
- Kind: workflow outcome.
- Risk: medium.
- Pass condition: all six held-out workflow cases make the expected decision and
  unsupported `CONTINUE` decisions fall without blocking unchanged evidence.
- Primary surface: `ai-workflow-evaluation.js` fresh execution.
- Counterevidence: any missing/changed/wrong-type case continues, or any current
  case holds.
- Observed evidence: baseline 2/6 correct and 4 unsupported continues; candidate
  6/6 correct and 0 unsupported continues.
- Verdict: `PASS` for this deterministic AI-assisted workflow.
- Named seam: evidence closure -> AI-assisted steward decision.
- Limitation: no model was invoked; this does not prove model intelligence,
  weights, broad generalization or provider behavior.

## `current.human-benefit`

- Claim: a human reviewer notices stale evidence sooner and makes fewer mistaken
  acceptance decisions.
- Kind: representative user journey / quality.
- Risk: high because it concerns human comprehension and decisions.
- Pass condition: a real human comparison records review time, mistaken
  acceptance, reference errors, comprehension and dissent preservation.
- Primary surface: representative human review journey.
- Counterevidence: slower or less accurate review, worse free-text
  comprehension, hidden dissent or added maintenance burden.
- Observed evidence: no human journey has been run.
- Verdict: `UNKNOWN`.
- Named seam: system hold signal -> human understanding and judgment.

## `current.workshop-growth`

- Claim: the repaired capability is available Workshop growth.
- Kind: lifecycle / authorization.
- Risk: high.
- Pass condition: valid capability cycle, explicit human `CONTINUE`, and a
  separate governed availability receipt for the exact candidate digest.
- Primary surface: Verified Capability Loop receipt.
- Counterevidence: `AWAITING_STEWARD`, digest drift, rejection, hold or absent
  availability authority.
- Observed evidence: linked cycle remains `AWAITING_STEWARD`; grounded outcome is
  `CANDIDATE_ONLY`.
- Verdict: `FAIL` as a current availability claim; candidate behavior remains
  tested.
- Named seam: verified candidate -> governed Workshop availability.

## `longitudinal.performance-and-cost`

- Claim: the ongoing grounded-growth layer improves review efficiency without
  harmful storage, CPU or attention cost.
- Kind: performance / resource safety / human quality.
- Risk: medium.
- Pass condition: named workload, duration, resource telemetry, retained-state
  growth and human attention comparison remain within declared budgets.
- Primary surface: measured workload plus human review evidence.
- Counterevidence: rising review backlog, repeated no-new-information runs,
  unbounded receipts, material CPU pressure or worse comprehension.
- Observed evidence: not measured.
- Verdict: `UNKNOWN`.
- Named seam: repeated growth observations -> sustainable operation.
