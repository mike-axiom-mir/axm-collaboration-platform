#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Verification = require('./build-verification-receipt');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), 'utf8'));
ok(Verification.verify(receipt).pass, 'verification receipt and every stable source reference rebuild exactly');
ok(receipt.status === 'TEST' && receipt.result === 'PASS_WITH_DECLARED_LIMITS', 'verification remains TEST with declared limits');
ok(receipt.capability.id === 'growth.knowledge-signal-lineage.verify', 'verification names the exact new capability');
ok(receipt.capability.proofVerdict === 'PASS_WITH_DECLARED_LIMITS', 'candidate proof passes with declared limits');
ok(receipt.capability.cycleState === 'AWAITING_STEWARD' && receipt.capability.availability === null, 'verified candidate remains unavailable pending stewardship');
ok(receipt.lineage.state === 'CURRENT_WITH_OPEN_HUMAN_EVIDENCE', 'lineage preserves the open human-evidence seam');
ok(receipt.lineage.acceptedSignals === 6 && receipt.lineage.signalLinks === 6, 'all six accepted signals have exact lineage rows');
ok(receipt.lineage.currentTechnicalSignals === 5 && receipt.lineage.waitingVoluntaryHumanSignals === 1, 'technical and human-waiting signals stay separated');
ok(receipt.lineage.proposalLinks === 6 && receipt.lineage.deferredProposals === 1, 'all six proposal dispositions remain represented');
ok(receipt.lineage.autonomousActionCount === 0 && receipt.lineage.reviewableActionCount === 0, 'lineage receipt grants no action');
ok(receipt.lineage.deferredSignalLedgerImplemented === false, 'deferred human-facing ledger was not implemented');
ok(receipt.aiWorkflowEvaluation.verdict === 'PASS' && receipt.aiWorkflowEvaluation.proofSurface === 'AI_WORKFLOW_EVALUATION', 'AI-workflow evidence stays on its native proof surface');
ok(receipt.aiWorkflowEvaluation.baselineCorrect === 1 && receipt.aiWorkflowEvaluation.baselineUnsafe === 7, 'shortcut baseline records one correct and seven unsafe decisions');
ok(receipt.aiWorkflowEvaluation.candidateCorrect === 8 && receipt.aiWorkflowEvaluation.candidateUnsafe === 0, 'exact guard records eight correct and zero unsafe decisions');
ok(receipt.aiWorkflowEvaluation.totalCases === 8 && receipt.aiWorkflowEvaluation.independentlyHeldOut === false, 'evaluation stays bounded and developer-visible');
ok(receipt.aiWorkflowEvaluation.modelInvoked === false && receipt.aiWorkflowEvaluation.modelWeightsChanged === false, 'workflow evidence is not mislabeled model learning');
ok(receipt.outcome.state === 'CANDIDATE_ONLY', 'Grounded Growth outcome remains candidate-only');
ok(receipt.outcome.sharedSystemVerdict === 'PASS' && receipt.outcome.aiWorkflowVerdict === 'PASS', 'system and AI-workflow effects are admitted separately');
ok(receipt.outcome.humanVerdict === 'NOT_RUN' && receipt.outcome.modelLearningClaimed === false, 'human benefit and model learning are not fabricated');
ok(receipt.portfolio.priorOutcomeBytesPreserved && receipt.portfolio.outcomes === 10 && receipt.portfolio.capabilityChains === 6, 'portfolio preserves nine outcomes and appends the tenth on a sixth chain');
ok(receipt.currentState.state === 'CURRENT_CONVERGED', 'successor current state converges');
ok(receipt.currentState.sharedSystemPass === 6 && receipt.currentState.aiWorkflowPass === 6, 'successor records six current technical and AI-workflow passes');
ok(receipt.currentState.humanPass === 0 && receipt.currentState.humanNotRun === 6, 'successor records zero human passes and six not-run claims');
ok(receipt.currentState.participationBinding === 'PRESERVED' && receipt.currentState.affectedProtectedCapabilities.length === 0, 'voluntary-human binding remains unaffected');
ok(receipt.currentState.reviewableActionCount === 1 && receipt.currentState.autonomousActionCount === 0, 'existing optional handoff remains the only review action');
ok(receipt.focusedAndAdjacent.passed === 15 && receipt.focusedAndAdjacent.failed === 0, 'all fifteen focused and adjacent checks pass');
ok(receipt.focusedAndAdjacent.explicitAssertions === 515, 'counted focused selftests contain 515 explicit checks or assertions');
ok(receipt.requiredChecks.passed === 10 && receipt.requiredChecks.failed === 0, 'all ten required Workshop checks pass');
ok(receipt.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && receipt.broadVerification.failures === 0, 'broad verification retains limits with no failures');
ok(['RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'CURRENT_EXACT'].includes(receipt.historicalEvolution.classification), 'prior verification evolution is exactly classified');
ok(receipt.historicalEvolution.historicalReceiptRewritten === false && receipt.historicalEvolution.previousCurrentStateReceiptRewritten === false, 'historical receipts remain unchanged');
ok(receipt.historicalEvolution.successorIsForwardExtension, 'successor is explicitly a forward extension');
ok(receipt.capabilityGap.requiredMissingAfter === 0, 'no required capability linkage remains missing');
ok(receipt.capabilityGap.nativeHumanBenefit === 'OPTIONAL_UNKNOWN', 'native human benefit remains optional unknown');
ok(receipt.capabilityGap.independentHeldOutEvaluation === 'OPTIONAL_UNKNOWN', 'independent held-out evaluation remains optional unknown');
ok(receipt.capabilityGap.detachedSourceTruth === 'OPTIONAL_UNKNOWN', 'detached source truth remains optional unknown');
ok(receipt.browserVerification.verdict === 'NOT_RUN' && receipt.browserVerification.applicable === false, 'browser verification is honestly not applicable');
ok(Object.values(receipt.boundaries).every((value) => value === false), 'verification grants no truth, participation, lifecycle, or CANON authority');
ok(!/[A-Za-z]:[\\/]/.test(JSON.stringify(receipt)), 'verification receipt contains no machine path');
ok(Verification.SOURCE_FILES.every((file) => fs.existsSync(path.join(Verification.ROOT, file))), 'every declared stable source exists');
ok(receipt.sourceRefs.length === Verification.SOURCE_FILES.length, 'stable source reference count is exact');

console.log('PASS signal-lineage Grounded Growth verification selftest (' + checks + ' assertions)');
