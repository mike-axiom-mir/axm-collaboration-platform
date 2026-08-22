#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Lineage = require('../../../shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Build = require('./build-signal-lineage-growth');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recompute(receipt, field) {
  const payload = clone(receipt);
  delete payload[field];
  receipt[field] = Growth.sha256(payload);
  return receipt;
}

const current = Build.checkRecorded();
check(current.gaps.before.overall === 'BLOCKED', 'before gap is blocked');
check(current.gaps.before.missingCapabilities.length === 9, 'before gap names nine required missing capabilities');
check(current.gaps.after.overall === 'DEGRADED', 'after gap remains degraded for optional unknown evidence');
check(current.gaps.after.missingCapabilities.length === 0, 'after gap has no required missing capability');
check(current.gaps.after.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'all required groups are ready');

const native = Lineage.verify(current.lineage, Build.currentInput());
check(native.pass, 'current lineage rebuilds natively');
const portable = Lineage.verifyPortable(current.lineage);
check(portable.pass, 'current lineage passes detached integrity');
check(portable.sourceTruth === 'UNKNOWN' && portable.sourceCurrentness === 'UNKNOWN', 'detached lineage preserves source unknowns');
check(current.lineage.coverage.acceptedSignals === 6 && current.lineage.coverage.signalLinks === 6, 'all six accepted signals are covered');
check(current.lineage.coverage.proposalLinks === 6, 'all six proposals are covered');
check(current.lineage.coverage.currentTechnicalSignals === 5, 'five technical signals bind current evidence');
check(current.lineage.coverage.waitingVoluntaryHumanSignals === 1, 'one signal remains human-evidence waiting');
check(current.lineage.coverage.rejectedOrRedundantProposals === 5 && current.lineage.coverage.deferredProposals === 1, 'five proposals are rejected or redundant and one remains deferred');

const expectedSignalIds = [
  'signal:human-comprehension-comparison',
  'signal:no-new-information-stop',
  'signal:portable-baseline-identity',
  'signal:registered-output-closure',
  'signal:same-cycle-linkage',
  'signal:semantic-first-visual-escalation'
];
check(Growth.stableStringify(current.lineage.signals.map((item) => item.signalId)) === Growth.stableStringify(expectedSignalIds), 'exact six-signal identity set is preserved');
const humanSignal = current.lineage.signals.find((item) => item.signalId === 'signal:human-comprehension-comparison');
check(humanSignal.state === 'WAITING_VOLUNTARY_HUMAN_EVIDENCE', 'human comprehension stays waiting');
check(humanSignal.requiredEvent === 'VOLUNTARY_HUMAN_NATIVE_EVIDENCE', 'human signal requires a voluntary native event');
check(humanSignal.outcomeBindings.length === 0 && humanSignal.humanBenefitClaimed === false, 'human waiting signal binds no fabricated pass');
check(current.lineage.signals.filter((item) => item.state === 'CURRENT_TECHNICAL_EVIDENCE').every((item) => item.evidenceRefs.length > 0), 'every technical signal has current evidence references');
check(current.lineage.signals.flatMap((item) => item.outcomeBindings).every((item) => item.admittedVerdict === 'PASS' && item.beneficiary !== 'HUMAN'), 'outcome bindings are admitted non-human PASS claims');

const ledgerProposal = current.lineage.proposals.find((item) => item.proposalId === 'proposal:signal-link-ledger');
check(ledgerProposal.state === 'DEFERRED_NO_ACTION' && ledgerProposal.implementedByThisReceipt === false, 'deferred human-facing ledger remains unimplemented');
check(current.lineage.proposals.every((item) => item.action === 'NONE' && item.automaticAction === false), 'all proposals remain zero-action');
check(current.lineage.decision.autonomousActionCount === 0 && current.lineage.decision.reviewableActionCount === 0, 'lineage receipt grants no action');

Build.EVIDENCE_SOURCE_DEFS.forEach((definition) => {
  const [relativePath, id] = definition;
  const reference = current.lineage.sourceRefs.evidence.find((item) => item.id === id);
  check(!!reference, 'lineage includes evidence source ' + id);
  check(reference.sha256 === Growth.sha256(fs.readFileSync(path.join(Build.ROOT, relativePath))), 'evidence source is current: ' + id);
});

check(current.cases.cases.length === 8, 'case set has eight declared cases');
check(current.evaluation.baseline.correctDecisions === 1, 'ID-and-count shortcut makes one of eight correct');
check(current.evaluation.baseline.unsupportedOrUnsafeDecisions === 7, 'shortcut admits seven unsupported or unsafe decisions');
check(current.evaluation.outcome.correctDecisions === 8, 'exact lineage guard makes eight of eight correct');
check(current.evaluation.outcome.unsupportedOrUnsafeDecisions === 0, 'exact lineage guard leaves zero unsupported case decisions');
check(current.evaluation.cases.every((item) => item.candidateCorrect), 'every recorded candidate decision matches expectation');
check(current.evaluation.truth.modelInvoked === false && current.evaluation.truth.humanParticipant === false, 'evaluation claims neither model run nor human participation');

check(current.proof.verdict === 'PASS_WITH_DECLARED_LIMITS', 'candidate proof passes with limits');
check(current.proof.checks.nativeExactRebuild && current.proof.checks.detachedIntegrity, 'proof includes native and portable checks');
check(current.proof.authority.availabilityGranted === false && current.proof.authority.humanDecisionMade === false, 'proof grants no availability or human decision');
check(current.cycle.state === 'AWAITING_STEWARD', 'cycle awaits steward');
check(current.cycle.improvementClaim === 'VERIFIED_CANDIDATE_ONLY', 'cycle remains a verified candidate only');
check(current.cycle.stewardDecision === null && current.cycle.availability === null, 'no steward decision or availability exists');
check(current.cycle.candidate.installed === false && current.cycle.candidate.promoted === false && current.cycle.candidate.canon === false, 'candidate remains uninstalled, unpromoted, and non-canon');

const systemClaim = current.outcome.claims.find((item) => item.beneficiary === 'SHARED_SYSTEM');
const aiClaim = current.outcome.claims.find((item) => item.beneficiary === 'AI_WORKFLOW');
const humanClaim = current.outcome.claims.find((item) => item.beneficiary === 'HUMAN');
check(systemClaim.admittedVerdict === 'PASS' && systemClaim.proofSurface === 'FOCUSED_RUNTIME', 'system claim is admitted on focused runtime evidence');
check(aiClaim.admittedVerdict === 'PASS' && aiClaim.proofSurface === 'AI_WORKFLOW_EVALUATION', 'AI-workflow claim is admitted on its native evaluation surface');
check(humanClaim.admittedVerdict === 'NOT_RUN' && humanClaim.routeStatus === 'NOT_PROVEN', 'human benefit remains not run and unproven');
check(current.outcome.state === 'CANDIDATE_ONLY', 'outcome remains candidate only');

const prior = Build.readJson(Build.PRIOR_PORTFOLIO);
check(current.portfolio.summary.outcomeCount === 10, 'portfolio contains ten outcomes');
check(current.portfolio.summary.capabilityCount === 6, 'portfolio contains six capability chains');
check(Growth.stableStringify(current.portfolio.outcomes.slice(0, 9)) === Growth.stableStringify(prior.outcomes), 'all nine earlier outcome bytes are preserved');
check(current.currentState.state === 'CURRENT_CONVERGED', 'successor current state converges');
check(current.currentState.portfolioEvolution.appendedOutcomeCount === 3, 'current state sees three forward appends since the participation base');
check(current.currentState.participationBinding.state === 'PRESERVED', 'participation binding remains preserved');
check(current.currentState.participationBinding.affectedProtectedCapabilityIds.length === 0, 'no protected human capability changed');
check(current.currentState.decision.reviewableActionCount === 1 && current.currentState.decision.autonomousActionCount === 0, 'one optional existing review remains and no autonomous action appears');
check(current.summary.growth.sharedSystemPass === 6 && current.summary.growth.aiWorkflowPass === 6, 'six effective system and AI-workflow passes are visible');
check(current.summary.growth.humanPass === 0 && current.summary.growth.humanNotRun === 6, 'human evidence remains zero pass and six not run');

const incomplete = clone(Build.currentInput());
incomplete.signalLinks.pop();
check(Build.decisionForBuild(incomplete) === 'HOLD_INCOMPLETE_LINEAGE', 'missing signal lineage is held');
const stale = clone(Build.currentInput());
stale.signalLinks[0].outcomeBindings[0].receiptDigest = 'sha256:' + '0'.repeat(64);
check(Build.decisionForBuild(stale) === 'HOLD_STALE_OUTCOME', 'stale outcome binding is held');
const unknownEvidence = clone(Build.currentInput());
unknownEvidence.signalLinks[1].evidenceRefIds = ['missing-source'];
check(Build.decisionForBuild(unknownEvidence) === 'HOLD_UNKNOWN_EVIDENCE', 'unknown evidence source is held');
const fakeHuman = clone(Build.currentInput());
fakeHuman.signalLinks[4].state = 'CURRENT_TECHNICAL_EVIDENCE';
fakeHuman.signalLinks[4].requiredEvent = null;
check(Build.decisionForBuild(fakeHuman) === 'REFUSE_SYNTHETIC_HUMAN_CLOSURE', 'synthetic human technical closure is refused');
const proposalDrift = clone(Build.currentInput());
proposalDrift.proposalLinks[0].state = 'DEFERRED_NO_ACTION';
check(Build.decisionForBuild(proposalDrift) === 'REFUSE_PROPOSAL_STATE_DRIFT', 'rejected proposal state drift is refused');
const sourceDrift = clone(Build.currentInput());
sourceDrift.disposition.acceptedSignals[0].statement += ' changed';
check(Build.decisionForBuild(sourceDrift) === 'HOLD_SOURCE_DRIFT', 'changed disposition behind old digest is held');

const authorityInflation = clone(current.lineage);
authorityInflation.decision.autonomousActionCount = 1;
recompute(authorityInflation, 'receiptDigest');
check(!Lineage.verifyPortable(authorityInflation).pass, 'recomputed autonomous authority inflation is refused');
const proposalAction = clone(current.lineage);
proposalAction.proposals[0].action = 'EXECUTE';
recompute(proposalAction, 'receiptDigest');
check(!Lineage.verifyPortable(proposalAction).pass, 'recomputed rejected-proposal action is refused');

const protectedPrior = current.portfolio.outcomes.filter((item) => item.capabilityId === 'simulation.run-envelope.verify').slice(-1)[0];
const protectedNext = Growth.buildOutcome({
  outcomeId: 'fixture-protected-chain-advance',
  generatedAt: '2026-08-20T00:32:00.000Z',
  cycleReceipt: protectedPrior.cycleReceipt,
  interventionRef: protectedPrior.interventionRef,
  previousOutcomeRef: { id: protectedPrior.outcomeId, schema: protectedPrior.schema, sha256: protectedPrior.receiptDigest },
  noNewInformation: false,
  informationRefs: protectedPrior.informationRefs,
  claims: protectedPrior.claims.map((claim) => ({
    id: claim.id,
    beneficiary: claim.beneficiary,
    statement: claim.statement,
    kind: claim.kind,
    verdict: claim.verdict,
    proofSurface: claim.proofSurface,
    baselineRef: claim.baselineRef,
    outcomeRef: claim.outcomeRef,
    evidenceRefs: claim.evidenceRefs,
    evidenceClosure: claim.evidenceClosure,
    limitations: claim.limitations
  })),
  refresh: { checkedAt: '2026-08-20T00:32:00.000Z', due: false, reason: 'Adversarial protected-chain advance fixture.' }
});
const protectedPortfolio = Growth.buildPortfolio({
  portfolioId: 'fixture-protected-signal-lineage-portfolio',
  generatedAt: '2026-08-20T00:33:00.000Z',
  outcomes: [...current.portfolio.outcomes, protectedNext]
});
const protectedState = Current.build({
  receiptId: 'fixture-protected-signal-lineage-current-state',
  generatedAt: '2026-08-20T00:34:00.000Z',
  participationFrontierReceipt: current.currentStateInput.participationFrontierReceipt,
  participationFrontierInput: current.currentStateInput.participationFrontierInput,
  latestPortfolio: protectedPortfolio
});
check(protectedState.state === 'HOLD_PARTICIPATION_REBIND_REQUIRED', 'protected chain advance forces participation rebind');
check(protectedState.decision.reviewableActionCount === 0, 'protected chain advance removes stale optional review');

assert.throws(() => {
  const skippedPortfolio = Growth.buildPortfolio({
    portfolioId: 'fixture-skipped-ancestry-portfolio',
    generatedAt: '2026-08-20T00:35:00.000Z',
    outcomes: [...current.portfolio.outcomes.slice(1)]
  });
  return Current.build({
    receiptId: 'fixture-skipped-ancestry-current-state',
    generatedAt: '2026-08-20T00:36:00.000Z',
    participationFrontierReceipt: current.currentStateInput.participationFrontierReceipt,
    participationFrontierInput: current.currentStateInput.participationFrontierInput,
    latestPortfolio: skippedPortfolio
  });
}, /previous|ancestry|forward extension|historical|prefix|outcome/i);
checks += 1;

check(current.summary.truth.deferredHumanLedgerImplemented === false, 'summary preserves deferred-ledger boundary');
check(current.summary.truth.modelLearningClaimed === false && current.summary.truth.broadGeneralizationClaimed === false, 'summary claims no model learning or broad generalization');
check(current.summary.truth.installed === false && current.summary.truth.promoted === false && current.summary.truth.canonized === false, 'summary grants no lifecycle authority');

process.stdout.write('PASS Grounded Growth signal-lineage audit selftest (' + checks + ' assertions)\n');
