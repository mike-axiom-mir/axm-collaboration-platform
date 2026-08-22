# Human-benefit readiness evidence routes

Status: `TEST`

## Atomic claims

### protocol-contract

- Claim: a beneficiary claim can be translated into a predeclared, bounded
  human comparison before responses exist.
- Kind: static structure and deterministic behavior.
- Pass condition: exact protocol fields, task coverage, fairness policy,
  success rule, privacy boundary and digests verify; malformed variants fail.
- Primary surface: parsed schemas and focused runtime assertions.
- Counterevidence: a protocol can change the pass rule after a session or omit
  a condition, task, or retention boundary.
- Observed evidence: 46 focused engine checks, exact current-protocol rebuild,
  answer-leak check and parsed schemas pass.
- Verdict: `PASS` for the protocol machinery.

### voluntary-human-session

- Claim: a human observation receipt is admitted only after explicit local
  opt-in and completion confirmation, while withdrawal produces no retained
  observations.
- Kind: deterministic consent boundary plus future human interaction journey.
- Pass condition: focused negative tests refuse missing or mismatched consent;
  a withdrawn receipt contains no observations; a real human still must choose
  to participate.
- Primary surface: focused runtime now; representative human journey later.
- Counterevidence: responses survive withdrawal, identity text is retained, or
  an automated fixture is accepted as a live human session.
- Observed evidence: focused consent and withdrawal tests pass; the external
  response runner refuses repository-local private input and forbidden fields;
  the optional TTY runner refuses piped or automated input.
- Verdict: `PASS` for the consent boundary; real participation remains
  `NOT_RUN`.

### reconstructable-evaluation

- Claim: exact protocol and session ancestry reconstruct the same bounded
  aggregate signal without silently converting it into human judgment.
- Kind: deterministic behavior.
- Pass condition: aggregate metrics and state rebuild identically; missing,
  duplicate, mixed-mode, unbalanced, tampered, or underpowered inputs hold.
- Primary surface: focused runtime with positive and negative fixtures.
- Counterevidence: changed source receipts keep validating or a numeric signal
  becomes a final human-benefit verdict automatically.
- Observed evidence: positive, underpowered, duplicate, tamper, chronology and
  mixed-authority fixtures pass 46 focused checks; current readiness rebuilds
  from exact source hashes.
- Verdict: `PASS` for deterministic reconstruction with synthetic fixtures.

### explicit-human-judgment

- Claim: a final human-benefit decision remains a declared human act tied to
  the exact evaluation, not a test-derived or model-derived conclusion.
- Kind: taste, meaning, and local steward judgment.
- Pass condition: a real appointed human reviews the evaluation and explicitly
  records a decision; the software only validates and binds that declaration.
- Primary surface: human judgment.
- Counterevidence: the module emits a live PASS without a human-entered
  attestation, or accepts a synthetic fixture as live evidence.
- Verdict: `NOT_RUN`; no human decision will be manufactured in this increment.

### current-human-benefit

- Claim: the Evidence Retention source-closure repair helps Mike or humans more
  broadly.
- Kind: workflow outcome.
- Pass condition: the scoped human comparison is completed and its explicit
  judgment is admitted through current evidence closure.
- Primary surface: representative user journey or human observation.
- Counterevidence: worse decisions, added burden, withdrawal, or an unsure or
  negative human judgment.
- Verdict: `NOT_RUN`.

## Overall route

The capability to collect, reconstruct and explicitly judge the scoped human
evidence moved from `BLOCKED` to `READY`. That is readiness only. It does not
change the current Grounded Growth outcome, which remains `CANDIDATE_ONLY` with
human benefit `NOT_RUN` / `NOT_PROVEN`.
