#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Gate = require('../../../shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const built = require('./build-current-readiness');
const receipt = readJson('CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json');
const requirements = readJson('CAPABILITY_REQUIREMENTS.json');
const before = readJson('CAPABILITY_INVENTORY_BEFORE.json');
const after = readJson('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = readJson('CAPABILITY_GAP_BEFORE.json');
const gapAfter = readJson('CAPABILITY_GAP_AFTER.json');
const verification = readJson('VERIFICATION_RECEIPT.json');

check(Gate.verify(receipt, built.gateInput).pass, 'current readiness receipt rebuilds exactly from native inputs');
check(receipt.game.gameId === '002-robo-pong' && receipt.game.slot === '002', 'current route selects the campaign next item without starting it');
check(receipt.overall === 'WAITING_FOR_VOLUNTARY_PHONE_OBSERVATION', 'current route remains waiting for voluntary physical-phone evidence');
check(receipt.keys.deviceBehavior.state === 'DEVICE_BEHAVIOR_NOT_RUN', 'current device behavior is NOT_RUN');
check(receipt.keys.humanUsefulness.state === 'HUMAN_USEFULNESS_NOT_RUN', 'current human usefulness is NOT_RUN');
check(receipt.sourceRefs.deviceEvidence === null && receipt.sourceRefs.closureReport === null, 'no absent device or closure receipt is invented');
check(receipt.sourceRefs.humanHandoff === null && receipt.sourceRefs.humanOutcome === null, 'no absent human package or outcome is invented');
check(receipt.truth.combinedEvidencePresent === false && receipt.truth.humanUsefulnessEstablished === false, 'current receipt claims no combined evidence or human usefulness');
check(receipt.nextActions[0] === 'OPTIONALLY_CAPTURE_ONE_VOLUNTARY_PHYSICAL_PHONE_CANDIDATE', 'next action remains optional and human initiated');

check(requirements.requirements.filter((item) => item.required).length === 5, 'five required integration requirements are declared');
check(before.capabilities.some((item) => item.id === 'human.handoff.native-package-verify' && item.status === 'available'), 'existing native human handoff is reused');
check(after.capabilities.some((item) => item.id === 'growth.phone-evidence.two-key-separation' && item.status === 'available'), 'new two-key separation capability is inventoried');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 6, 'before comparison exposes six missing integration capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after comparison closes the required integration contract');
check(gapAfter.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'all required integration requirements are ready');
check(gapAfter.requirements.filter((item) => !item.required).every((item) => item.status === 'DEGRADED'), 'all live evidence outcomes remain degraded rather than fabricated');

const serialized = JSON.stringify(receipt);
check(!/[A-Za-z]:[\\/]/.test(serialized), 'current readiness receipt retains no machine paths');
check(!serialized.includes('notes') && !serialized.includes('userAgent'), 'current readiness receipt retains no raw device notes or user-agent data');
check(receipt.truth.automaticPromotion === false && receipt.truth.automaticCanon === false && receipt.truth.foundationMutation === false, 'readiness grants no promotion, CANON, or Foundation authority');
check(verification.schema === 'axm.phone-grounded-growth-gate-verification-receipt/v1' && verification.status === 'TEST', 'verification receipt identity remains TEST');
check(verification.focused.reduce((sum, item) => sum + item.assertions, 0) === 58, 'verification receipt counts all focused assertions');
check(verification.requiredChecks.length === 10 && verification.requiredChecks.every((item) => item.verdict === 'PASS'), 'verification receipt records all ten required checks passing');
check(verification.broad.state === 'VERIFIED_WITH_LIMITS' && verification.broad.verifyWarnings === 17, 'broad warning state remains visible');
check(verification.visualVerification.state === 'NOT_RUN' && /no browser UI/i.test(verification.visualVerification.reason), 'browser verification is honestly separate and not run');

console.log('\nCurrent phone-to-Grounded-Growth readiness selftest: PASS (' + checks + ' checks)');
