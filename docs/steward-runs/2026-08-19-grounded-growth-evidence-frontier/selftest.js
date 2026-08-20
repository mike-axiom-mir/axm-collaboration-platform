#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Frontier = require('../../../shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate');
const build = require('./build-current-evidence-frontier');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

const receipt = read('CURRENT_EVIDENCE_FRONTIER_RECEIPT.json');
const gapBefore = read('CAPABILITY_GAP_BEFORE.json');
const gapAfter = read('CAPABILITY_GAP_AFTER.json');

check(Frontier.verifyEvidenceFrontier(receipt, build.evidenceInput).pass, 'current integrated receipt verifies from exact source inputs');
check(receipt.schema === Frontier.EVIDENCE_FRONTIER_SCHEMA && receipt.status === 'TEST', 'current receipt remains a TEST evidence-frontier receipt');
check(receipt.sourceRefs.frontier.sha256 === build.evidenceInput.frontierReceipt.frontierDigest, 'current receipt binds the exact original frontier');
check(receipt.sourceRefs.phoneEvidenceGate.sha256 === build.evidenceInput.phoneEvidenceGate.receiptDigest, 'current receipt binds the exact phone evidence gate');
check(receipt.counts.portfolioCapabilityChains === 4 && receipt.counts.portfolioCapabilityChainsAdded === 0, 'current portfolio remains exactly four capability chains');
check(receipt.counts.supplementalPhoneEvidenceRoutes === 1 && receipt.lanes.length === 4, 'current frontier exposes one supplemental fourth lane');
check(receipt.lanes[3].gameId === '002-robo-pong', 'supplemental lane identifies the exact current campaign game');
check(receipt.lanes[3].state === 'WAITING_FOR_VOLUNTARY_PHONE_OBSERVATION', 'supplemental lane reports the exact current evidence state');
check(receipt.counts.phoneDeviceBehaviorPass === 0 && receipt.counts.phoneHumanUsefulnessPass === 0, 'neither current phone evidence key is passed');
check(receipt.counts.phoneTwoKeyEvidencePresent === 0, 'combined phone evidence remains absent');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'integrated current decision grants no action');
check(receipt.truth.supplementalRouteAddedToPortfolio === false, 'supplemental evidence is not portfolio membership');
check(receipt.truth.phoneTwoKeyEvidenceIsSharedGrowthProof === false, 'phone two-key evidence is not broad shared-growth proof');
check(receipt.truth.automaticParticipation === false && receipt.truth.automaticCanon === false, 'participation and CANON remain human-governed');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 7, 'before comparison records the seven-part integration gap');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after comparison satisfies every required integration capability');
check(gapAfter.requirements.filter((item) => !item.required && item.status === 'DEGRADED').length === 3, 'three live optional evidence outcomes remain honestly degraded');

const verification = read('VERIFICATION_RECEIPT.json');
check(verification.schema === 'axm.grounded-growth-evidence-frontier-verification-receipt/v1' && verification.status === 'TEST', 'verification receipt identity remains TEST');
check(verification.focused.explicitAssertions === 82 && verification.focused.commands[0].assertions === 56 && verification.focused.commands[1].assertions === 26, 'verification receipt records all focused assertions');
check(verification.adjacent.explicitAssertions === 223 && verification.totalExplicitAssertions === 305, 'verification receipt records adjacent and total assertions');
check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0, 'all required Workshop checks are recorded as passed');
check(verification.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.failures === 0 && verification.broadVerification.holds === 0, 'broad result preserves limits without hidden failure');
check(verification.currentState.receiptDigest === receipt.evidenceFrontierDigest, 'verification receipt binds the exact integrated frontier');
check(verification.browserVerification.verdict === 'NOT_RUN' && verification.boundaries.browserClaimed === false, 'no browser result is claimed for the non-UI increment');
check(verification.boundaries.originalFrontierReceiptStillVerifies === true && verification.boundaries.canonicalStateTouched === false, 'backward compatibility and no-CANON boundary are recorded');
check(verification.sources.length > 0
  && new Set(verification.sources.map((source) => source.path)).size === verification.sources.length
  && verification.sources.every((source) => /^sha256:[a-f0-9]{64}$/.test(source.sha256))
  && Frontier.verifyEvidenceFrontier(receipt, build.evidenceInput).pass,
'historical v0.2 source digests remain well-formed while the evidence-frontier receipt still exact-rebuild verifies under v0.3');

console.log('Grounded Growth evidence-frontier audit selftest passed: ' + checks + ' checks.');
