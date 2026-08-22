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
ok(receipt.capability.id === 'growth.current-state.detached-integrity.verify', 'verification names the exact new capability');
ok(receipt.capability.proofVerdict === 'PASS_WITH_DECLARED_LIMITS', 'candidate proof passes with limits');
ok(receipt.capability.cycleState === 'AWAITING_STEWARD' && receipt.capability.availability === null, 'verified capability remains unavailable pending stewardship');
ok(receipt.outcome.state === 'CANDIDATE_ONLY', 'Grounded Growth outcome remains candidate-only');
ok(receipt.outcome.sharedSystemVerdict === 'PASS' && receipt.outcome.aiWorkflowVerdict === 'PASS', 'system and AI-workflow evidence are admitted separately');
ok(receipt.outcome.humanVerdict === 'NOT_RUN' && receipt.outcome.modelLearningClaimed === false, 'human benefit and model learning are not fabricated');
ok(receipt.portfolio.priorOutcomeBytesPreserved && receipt.portfolio.outcomes === 9 && receipt.portfolio.capabilityChains === 5, 'portfolio preserves eight outcomes and appends the ninth on a fifth chain');
ok(receipt.currentState.state === 'CURRENT_CONVERGED', 'successor current state converges');
ok(receipt.currentState.sharedSystemPass === 5 && receipt.currentState.aiWorkflowPass === 5, 'successor records five current technical and AI-workflow passes');
ok(receipt.currentState.humanPass === 0 && receipt.currentState.humanNotRun === 5, 'successor records zero human passes and five not-run claims');
ok(receipt.currentState.participationBinding === 'PRESERVED' && receipt.currentState.affectedProtectedCapabilities.length === 0, 'voluntary-human binding remains unaffected');
ok(receipt.currentState.reviewableActionCount === 1 && receipt.currentState.autonomousActionCount === 0, 'one optional review remains with zero autonomous action');
ok(receipt.focusedAndAdjacent.passed === 8 && receipt.focusedAndAdjacent.failed === 0, 'all current focused and adjacent checks pass');
ok(receipt.focusedAndAdjacent.explicitAssertions === 295, 'focused and adjacent checks contain 295 assertions');
ok(receipt.requiredChecks.passed === 10 && receipt.requiredChecks.failed === 0, 'all ten required Workshop checks pass');
ok(receipt.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && receipt.broadVerification.failures === 0, 'broad verification retains limits with no failures');
ok(['RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'CURRENT_EXACT'].includes(receipt.historicalEvolution.classification), 'prior portability receipt evolution is exactly classified');
ok(receipt.historicalEvolution.historicalReceiptRewritten === false && receipt.historicalEvolution.previousCurrentStateReceiptRewritten === false, 'historical receipts remain unchanged');
ok(receipt.historicalEvolution.successorIsForwardExtension, 'successor is explicitly a forward extension');
ok(receipt.capabilityGap.requiredMissingAfter === 0, 'no required capability linkage remains missing');
ok(receipt.capabilityGap.nativeHumanBenefit === 'OPTIONAL_UNKNOWN' && receipt.capabilityGap.detachedSourceTruth === 'OPTIONAL_UNKNOWN', 'human benefit and detached source truth remain optional unknowns');
ok(receipt.browserVerification.verdict === 'NOT_RUN' && receipt.browserVerification.applicable === false, 'browser verification is honestly not applicable');
ok(Object.values(receipt.boundaries).every((value) => value === false), 'verification grants no truth, participation, lifecycle, or CANON authority');
ok(!/[A-Za-z]:[\\/]/.test(JSON.stringify(receipt)), 'verification receipt contains no machine path');
ok(Verification.SOURCE_FILES.every((file) => fs.existsSync(path.join(Verification.ROOT, file))), 'every declared stable source exists');
ok(receipt.sourceRefs.length === Verification.SOURCE_FILES.length, 'stable source reference count is exact');

console.log('PASS portable verification Grounded Growth verification selftest (' + checks + ' assertions)');
