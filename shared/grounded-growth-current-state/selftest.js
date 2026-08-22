#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Current = require('./grounded-growth-current-state');
const DetachedCli = require('./verify-current-state');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const ParticipationCurrent = require('../../docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier');
const EvolutionCurrent = require('../../docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth');

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigest(value) {
  const result = clone(value);
  delete result.receiptDigest;
  result.receiptDigest = Current.sha256(result);
  return result;
}

function currentInput() {
  return {
    receiptId: 'fixture-grounded-growth-current-state',
    generatedAt: '2026-08-19T20:45:00.000Z',
    participationFrontierReceipt: ParticipationCurrent.current(),
    participationFrontierInput: ParticipationCurrent.currentInput(),
    latestPortfolio: EvolutionCurrent.build().portfolio
  };
}

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-current-state-receipt.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
ok(schema.$id === Current.RECEIPT_SCHEMA, 'schema identity matches implementation');
ok(contract.status === 'TEST' && contract.permissions.length === 0, 'contract is TEST and permissionless');
ok(contract.boundaries.refuses.includes('review-readiness-as-human-benefit'), 'contract refuses readiness as human benefit');
ok(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
ok(Current.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Current.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;

const input = currentInput();
const unsafeInput = currentInput();
unsafeInput.participationFrontierReceipt.lost = undefined;
assert.throws(() => Current.build(unsafeInput), /unsupported undefined/i);
checks += 1;
const receipt = Current.build(input);
ok(Current.verify(receipt, input).pass, 'current receipt verifies by exact rebuild');
const detached = Current.inspectDetached(receipt);
ok(detached.pass, 'current receipt passes detached integrity inspection');
ok(detached.verdict === 'PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN', 'detached verdict preserves its claim ceiling');
ok(detached.sourceVerification.nativeRebuild === 'NOT_RUN', 'detached inspection does not imply a native rebuild');
ok(detached.sourceVerification.sourceTruth === 'UNKNOWN' && detached.sourceVerification.sourceCurrentness === 'UNKNOWN', 'detached inspection leaves source truth and currentness unknown');
ok(Object.values(detached.authority).every((value) => value === false), 'detached inspection grants no authority');
ok(receipt.state === 'CURRENT_CONVERGED', 'later unrelated technical outcome converges safely');
ok(receipt.portfolioEvolution.baseOutcomeCount === 7 && receipt.portfolioEvolution.currentOutcomeCount === 8, 'seven-outcome source extends to eight outcomes');
ok(receipt.portfolioEvolution.appendedOutcomeCount === 1, 'exactly one later outcome is appended');
ok(receipt.portfolioEvolution.historicalOutcomeBytesPreserved, 'historical outcome bytes are preserved');
ok(receipt.portfolioEvolution.capabilityCountBefore === 4 && receipt.portfolioEvolution.capabilityCountCurrent === 4, 'later outcome preserves four capability identities');
ok(receipt.participationBinding.state === 'PRESERVED', 'unaffected voluntary handoff remains preserved');
ok(receipt.participationBinding.optionalReviewCandidates === 1, 'one optional review candidate remains visible');
ok(receipt.participationBinding.humanEvidencePresent === false, 'review readiness does not become human evidence');
ok(receipt.currentEvidence.sharedSystemPass === 4, 'four effective shared-system passes remain visible');
ok(receipt.currentEvidence.aiWorkflowPass === 4, 'four effective AI-workflow passes remain visible');
ok(receipt.currentEvidence.humanPass === 0 && receipt.currentEvidence.humanNotRun === 4, 'human evidence remains zero pass and four not-run');
ok(receipt.currentEvidence.unresolvedEvidence.includes('HUMAN_BENEFIT_NATIVE_EVIDENCE'), 'generic human-benefit evidence need remains visible');
ok(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 1, 'convergence creates no autonomous action');
ok(receipt.decision.currentBestAction === 'REVIEW_OPTIONAL_RESEARCH_HUMAN_HANDOFF_OR_WAIT', 'existing optional human decision remains intact');
ok(receipt.truth.reviewIsParticipation === false && receipt.truth.readinessIsHumanEvidence === false, 'participation boundaries remain explicit');
ok(receipt.truth.aiWorkflowPassIsHumanBenefit === false && receipt.truth.humanBenefitClaimed === false, 'AI evidence is not relabeled as human benefit');
ok(receipt.truth.automaticCanon === false && receipt.truth.foundationMutation === false, 'no CANON or Foundation authority appears');

const protectedAdvanceInput = currentInput();
const protectedPrevious = protectedAdvanceInput.latestPortfolio.outcomes
  .filter((outcome) => outcome.capabilityId === 'simulation.run-envelope.verify')
  .slice(-1)[0];
const protectedNoNew = Growth.buildOutcome({
  outcomeId: 'fixture-protected-capability-no-new',
  generatedAt: '2026-08-19T20:46:00.000Z',
  cycleReceipt: protectedPrevious.cycleReceipt,
  previousOutcomeRef: {
    id: protectedPrevious.outcomeId,
    schema: protectedPrevious.schema,
    sha256: protectedPrevious.receiptDigest
  },
  noNewInformation: true,
  refresh: {
    checkedAt: '2026-08-19T20:46:00.000Z',
    due: false,
    reason: 'Synthetic TEST-only protected-chain rebind fixture.'
  }
});
protectedAdvanceInput.latestPortfolio = Growth.buildPortfolio({
  portfolioId: 'fixture-protected-capability-advance',
  generatedAt: '2026-08-19T20:46:01.000Z',
  outcomes: [...protectedAdvanceInput.latestPortfolio.outcomes, protectedNoNew]
});
protectedAdvanceInput.generatedAt = '2026-08-19T20:46:02.000Z';
const protectedHold = Current.build(protectedAdvanceInput);
ok(protectedHold.state === 'HOLD_PARTICIPATION_REBIND_REQUIRED', 'protected capability advance creates a rebind hold');
ok(protectedHold.participationBinding.state === 'REQUIRES_REBIND', 'protected handoff is not presented as current');
ok(protectedHold.decision.reviewableActionCount === 0, 'stale review candidate is removed while rebind is required');
ok(protectedHold.decision.currentBestAction === 'HOLD_FOR_PARTICIPATION_REBIND', 'rebind hold becomes the only current action');

const base = input.participationFrontierInput.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio;
const same = Current.compareExtension(base, base, ['simulation.run-envelope.verify']);
ok(same.state === 'NO_NEW_INFORMATION' && same.appendedOutcomeCount === 0, 'identical portfolio is explicit no-new-information');
const syntheticExtension = Current.compareExtension(
  { outcomes: [{ outcomeId: 'a', capabilityId: 'protected' }] },
  { outcomes: [{ outcomeId: 'a', capabilityId: 'protected' }, { outcomeId: 'b', capabilityId: 'protected' }] },
  ['protected']
);
ok(syntheticExtension.affectedProtectedCapabilities[0] === 'protected', 'a protected chain advance is detected for rebind');
assert.throws(() => Current.compareExtension({ outcomes: [{ outcomeId: 'a' }] }, { outcomes: [] }, []), /remove historical outcomes/);
checks += 1;
assert.throws(() => Current.compareExtension({ outcomes: [{ outcomeId: 'a' }] }, { outcomes: [{ outcomeId: 'changed' }] }, []), /rewrites or reorders/);
checks += 1;

const invalidFrontierInput = currentInput();
invalidFrontierInput.participationFrontierReceipt.counts.reviewCandidates = 99;
assert.throws(() => Current.build(invalidFrontierInput), /participation frontier invalid/);
checks += 1;

const invalidPortfolioInput = currentInput();
invalidPortfolioInput.latestPortfolio.summary.outcomeCount = 99;
assert.throws(() => Current.build(invalidPortfolioInput), /latest portfolio invalid/);
checks += 1;

assert.throws(() => Current.compareExtension(
  { outcomes: [{ outcomeId: 'a' }, { outcomeId: 'b' }] },
  { outcomes: [{ outcomeId: 'b' }, { outcomeId: 'a' }] },
  []
), /rewrites or reorders historical outcome index 0/);
checks += 1;

const tamperedReceipt = clone(receipt);
tamperedReceipt.currentEvidence.humanPass = 1;
ok(!Current.verify(tamperedReceipt, input).pass, 'receipt cannot be edited into a human pass');
const rawDetachedTamper = Current.inspectDetached(tamperedReceipt);
ok(!rawDetachedTamper.pass && rawDetachedTamper.checks.selfDigest === 'FAIL', 'raw detached tampering fails its self-digest');
const tamperedDecision = clone(receipt);
tamperedDecision.decision.autonomousActionCount = 1;
ok(!Current.verify(tamperedDecision, input).pass, 'receipt cannot manufacture autonomous authority');
const staleDigest = clone(receipt);
staleDigest.receiptDigest = 'sha256:' + '0'.repeat(64);
ok(!Current.verify(staleDigest, input).pass, 'receipt digest tampering is refused');

const recomputedHumanCount = clone(receipt);
recomputedHumanCount.currentEvidence.humanPass = 1;
const recomputedHumanCountCheck = Current.inspectDetached(redigest(recomputedHumanCount));
ok(!recomputedHumanCountCheck.pass && recomputedHumanCountCheck.checks.internalCoherence === 'FAIL', 'recomputed human-pass count inflation fails internal coherence');

const recomputedHumanPresence = clone(receipt);
recomputedHumanPresence.participationBinding.humanEvidencePresent = true;
const recomputedHumanPresenceCheck = Current.inspectDetached(redigest(recomputedHumanPresence));
ok(!recomputedHumanPresenceCheck.pass && recomputedHumanPresenceCheck.issues.some((item) => item.code === 'PARTICIPATION_HUMAN_EVIDENCE_MISMATCH'), 'recomputed human-evidence presence inflation fails coherence');

const autonomous = clone(receipt);
autonomous.decision.autonomousActionCount = 1;
const autonomousCheck = Current.inspectDetached(redigest(autonomous));
ok(!autonomousCheck.pass && autonomousCheck.issues.some((item) => item.code === 'AUTONOMOUS_ACTION_REFUSED'), 'recomputed autonomous authority is refused');

const canon = clone(receipt);
canon.truth.automaticCanon = true;
const canonCheck = Current.inspectDetached(redigest(canon));
ok(!canonCheck.pass && canonCheck.issues.some((item) => item.code === 'BOUNDARY_MUST_REMAIN_FALSE'), 'recomputed automatic CANON authority is refused');

const badRebind = clone(receipt);
badRebind.state = 'HOLD_PARTICIPATION_REBIND_REQUIRED';
badRebind.participationBinding.state = 'REQUIRES_REBIND';
badRebind.participationBinding.optionalReviewCandidates = 0;
badRebind.decision.reviewableActionCount = 0;
badRebind.decision.currentBestAction = 'HOLD_FOR_PARTICIPATION_REBIND';
const badRebindCheck = Current.inspectDetached(redigest(badRebind));
ok(!badRebindCheck.pass && badRebindCheck.issues.some((item) => item.code === 'REBIND_REQUIRES_AFFECTED_CAPABILITY'), 'rebind cannot be declared without an affected protected capability');

const badCount = clone(receipt);
badCount.portfolioEvolution.currentOutcomeCount += 1;
const badCountCheck = Current.inspectDetached(redigest(badCount));
ok(!badCountCheck.pass && badCountCheck.issues.some((item) => item.code === 'OUTCOME_COUNT_MISMATCH'), 'recomputed outcome-count mismatch is refused');

const badReference = clone(receipt);
badReference.sourceRefs.latestPortfolio.sha256 = 'not-a-digest';
const badReferenceCheck = Current.inspectDetached(redigest(badReference));
ok(!badReferenceCheck.pass && badReferenceCheck.checks.structure === 'FAIL', 'invalid detached source reference digest is refused');

const unknownTop = clone(receipt);
unknownTop.uncontracted = true;
ok(!Current.inspectDetached(redigest(unknownTop)).pass, 'unknown top-level fields are refused');
const unknownNested = clone(receipt);
unknownNested.decision.uncontracted = true;
ok(!Current.inspectDetached(redigest(unknownNested)).pass, 'unknown nested fields are refused');

const forgedSources = clone(receipt);
forgedSources.sourceRefs.participationFrontier.sha256 = 'sha256:' + '1'.repeat(64);
forgedSources.sourceRefs.participationPortfolio.sha256 = 'sha256:' + '2'.repeat(64);
forgedSources.sourceRefs.latestPortfolio.sha256 = 'sha256:' + '3'.repeat(64);
const forgedSourcesCheck = Current.inspectDetached(redigest(forgedSources));
ok(forgedSourcesCheck.pass, 'syntactically valid recomputed source references remain portable-integrity valid');
ok(forgedSourcesCheck.sourceVerification.sourceTruth === 'UNKNOWN', 'portable inspection does not mistake forged source references for source truth');

const validCli = DetachedCli.run([path.join(__dirname, '../../docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json')]);
ok(validCli.exitCode === 0 && validCli.output.verdict === 'PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN', 'read-only CLI reports bounded success for the recorded receipt');
const missingCli = DetachedCli.run([path.join(__dirname, 'missing-receipt.json')]);
ok(missingCli.exitCode === 1 && missingCli.output.verdict === 'PORTABLE_INPUT_ERROR', 'read-only CLI reports missing input without creating it');
const usageCli = DetachedCli.run([]);
ok(usageCli.exitCode === 2 && usageCli.output.verdict === 'USAGE_ERROR', 'read-only CLI distinguishes usage errors');

console.log('PASS grounded growth current state selftest (' + checks + ' assertions)');
