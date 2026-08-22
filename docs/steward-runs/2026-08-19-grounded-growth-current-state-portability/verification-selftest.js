#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Verification = require('./build-verification-receipt');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), 'utf8'));
ok(Verification.verify(receipt).pass, 'verification receipt and every declared stable source rebuild exactly');
ok(receipt.status === 'TEST' && receipt.result === 'PASS_WITH_DECLARED_LIMITS', 'result remains TEST with declared limits');
ok(receipt.increment.currentStateReceiptUnchanged, 'portable hardening preserves the exact current-state behavior receipt');
ok(receipt.increment.cases === 11 && receipt.increment.casesMatchingExpectation === 11, 'all eleven adversarial expectations pass');
ok(receipt.increment.recomputedTamperCaughtBeyondDigest === 7, 'seven recomputed contradictions are caught beyond digest checking');
ok(receipt.increment.coherentPortablePassesHeldForSourceTruth === 3, 'all three coherent portable passes hold for source truth');
ok(receipt.increment.sourceTruthWithoutSources === 'UNKNOWN', 'source truth remains unknown without native sources');
ok(receipt.increment.humanPass === 0 && receipt.increment.humanNotRun === 1, 'technical evidence is not relabeled as human benefit');
ok(receipt.focusedAndAdjacent.passed === 7 && receipt.focusedAndAdjacent.failed === 0, 'all focused and adjacent current checks pass');
ok(receipt.focusedAndAdjacent.explicitAssertions === 190, 'focused and adjacent checks contain 190 explicit assertions');
ok(receipt.requiredChecks.passed === 10 && receipt.requiredChecks.failed === 0, 'all ten required Workshop checks pass');
ok(receipt.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && receipt.broadVerification.failures === 0, 'broad verification has no failure and retains limits');
ok(receipt.historicalReceipts.convergence.decision.classification === 'LATER_PORTABILITY_HARDENING_SOURCE_EVOLUTION', 'prior convergence receipt evolution is classified');
ok(receipt.historicalReceipts.convergence.decision.historicalReceiptRewritten === false, 'prior convergence verification remains unchanged');
ok(receipt.historicalReceipts.verificationEvolution.classification === 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'mutable broad-view drift is classified exactly');
ok(receipt.historicalReceipts.verificationEvolution.historicalReceiptRewritten === false, 'verification-evolution history remains unchanged');
ok(receipt.capabilityGap.requiredMissingAfter === 0, 'no required portable capability remains missing');
ok(receipt.capabilityGap.detachedSourceTruth === 'OPTIONAL_UNKNOWN' && receipt.capabilityGap.nativeHumanBenefit === 'OPTIONAL_UNKNOWN', 'source truth and human evidence remain explicit optional unknowns');
ok(receipt.browserVerification.verdict === 'NOT_RUN' && receipt.browserVerification.applicable === false, 'browser verification is honestly not applicable');
ok(Object.values(receipt.boundaries).every((value) => value === false), 'verification grants no truth, action, promotion, merge, CANON, or Foundation authority');
ok(!/[A-Za-z]:[\\/]/.test(JSON.stringify(receipt)), 'verification receipt contains no machine path');
ok(Verification.SOURCE_FILES.every((file) => fs.existsSync(path.join(Verification.ROOT, file))), 'every stable source reference exists');
ok(receipt.sourceRefs.length === Verification.SOURCE_FILES.length, 'stable source reference count is exact');

console.log('PASS grounded growth current-state portability verification selftest (' + checks + ' assertions)');
