# Evidence Routes

## 1. A feedback packet only derives from verified Grounded Growth

- Claim kind: deterministic behavior and authorization boundary
- Primary evidence: native `verifyOutcome` / `verifyPortfolio` call in
  `shared/grounded-growth-feedback/grounded-growth-feedback.js`
- Verifier: feedback selftest tampered-source fixture
- Result: PASS
- Limit: verifies receipt content and derivation, not external facts beyond the
  receipt's admitted claims

## 2. Output is GEI-compatible

- Claim kind: static structure
- Primary evidence: native GEI `evidence_record.schema.json` and
  `improvement_need.schema.json`
- Verifier: schema-guided validation in the 33-check feedback selftest
- Adjacent verifier: Grounded Evolution Intelligence platform selftest
- Result: PASS

## 3. Holds precede beneficiary testing

- Claim kind: deterministic behavior
- Primary evidence: `requestsForOutcome`
- Fixtures: `EVIDENCE_HOLD`, `REGRESSION_HOLD`, `REFRESH_REQUIRED`, and
  `CYCLE_HOLD`
- Result: PASS; each emits only its first repair, refresh, or lifecycle need
- Limit: this adapter proposes attention only and does not execute the repair

## 4. No-new outcomes do not manufacture repeated work

- Claim kind: deterministic behavior and longitudinal state
- Primary evidence: effective outcome lookup through
  `portfolio.latest[].effectiveOutcomeId`
- Fixtures: standalone `NO_NEW_INFORMATION` and a two-generation portfolio
- Result: PASS; standalone no-new emits nothing and the portfolio counts the
  effective substantive outcome once

## 5. Deduplication is explicit and conflicts remain visible

- Claim kind: deterministic behavior and provenance
- Primary evidence: deterministic need identity plus digest-bound
  `coverageLinks`
- Fixtures: exact active need, explicit semantic coverage, and
  `VERIFIED_RESOLVED` contradiction
- Result: PASS; active coverage suppresses duplication while contradictory
  closed coverage creates a `CONFLICTED` re-open candidate
- Limit: similarity alone is never accepted as proof of coverage

## 6. Voluntary human evidence remains voluntary

- Claim kind: authorization, human agency, workflow outcome
- Primary evidence: exact route state
  `READY_FOR_VOLUNTARY_INPUT` bound to the Human Bridge readiness receipt
- Verifier: focused response and language assertions
- Current result: exactly one candidate with only `WAIT_FOR_EVIDENCE`
- Limit: the referenced route is a caller declaration. The adapter does not
  authenticate a person or claim participation occurred.

## 7. Technical disposition is bounded

- Claim kind: authorization and decision provenance
- Primary evidence: `current-feedback-readiness-receipt.json`
- Decision: `WAIT_FOR_EVIDENCE`
- Reviewer: `KEEL_CODEX_TECHNICAL_STEWARD`
- Authority: attention routing only
- Explicitly absent: human acceptance, evolution direction, registry write,
  execution, merge, promotion, CANON, Foundation mutation

## 8. Repository-level compatibility

- Claim kind: static and deterministic integration
- Primary evidence: ten required commands in `verification-receipt.json`
- Result: all ten exit 0; main verifier carries 17 existing evidence warnings;
  verification spine is `VERIFIED_WITH_LIMITS`
- Browser route: NOT RUN and not claimed because this leaf has no UI, render,
  click, motion, or live interaction behavior

## Open evidence seam

No live voluntary human session, native evaluation, or final human judgment was
created. Human benefit therefore remains NOT PROVEN regardless of the adapter's
test result.
