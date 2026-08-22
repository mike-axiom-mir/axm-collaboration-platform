#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Campaign = require('../../../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');

const workshop = path.resolve(__dirname, '../../..');

function readLocal(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function readWorkshop(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

const input = {
  campaignId: 'current-voluntary-phone-qa-campaign-20260819',
  generatedAt: '2026-08-19T15:02:00.000Z',
  seamReport: readWorkshop('exports/game-night-seam-report.json'),
  qaLabManifest: readWorkshop('tools/browser-lan-hardware-qa-lab/manifest.json'),
  qaLabContract: readWorkshop('tools/browser-lan-hardware-qa-lab/module.contract.json'),
  maxGamesPerSession: 3,
  candidateReviews: []
};

const receipt = readLocal('CURRENT_PHONE_QA_CAMPAIGN.json');
const requirements = readLocal('CAPABILITY_REQUIREMENTS.json');
const before = readLocal('CAPABILITY_INVENTORY_BEFORE.json');
const after = readLocal('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = readLocal('CAPABILITY_GAP_BEFORE.json');
const gapAfter = readLocal('CAPABILITY_GAP_AFTER.json');
const contract = readWorkshop('shared/voluntary-phone-qa-campaign/module.contract.json');
const handoff = fs.readFileSync(path.join(__dirname, 'PHYSICAL_PHONE_QA_HANDOFF.md'), 'utf8');
const expected = Campaign.buildCampaign(input);

check(Campaign.verifyCampaign(receipt, input).pass, 'recorded current campaign verifies by exact rebuild');
check(Campaign.stableStringify(receipt) === Campaign.stableStringify(expected), 'recorded campaign exactly equals a fresh build');
check(receipt.status === 'TEST', 'campaign remains TEST');
check(receipt.sourceRefs.seamReport.sha256 === Campaign.sha256(input.seamReport), 'campaign binds the exact current warning report');
check(receipt.sourceRefs.qaLab.manifestSha256 === Campaign.sha256(input.qaLabManifest), 'campaign binds the exact current QA Lab manifest');
check(receipt.sourceRefs.qaLab.contractSha256 === Campaign.sha256(input.qaLabContract), 'campaign binds the exact current QA Lab contract');
check(receipt.summary.verifierGames === 19 && receipt.summary.physicalPhoneWarnings === 17, 'campaign records nineteen games and seventeen phone warnings');
check(receipt.summary.reviewRecords === 0 && receipt.summary.acceptedForSeparateGameReview === 0, 'campaign records zero candidate reviews or acceptances');
check(receipt.summary.pendingVoluntaryObservation === 17 && receipt.summary.warningsStillOpen === 17, 'all seventeen observations and warnings remain open');
check(receipt.sessions.length === 6 && receipt.sessions.at(-1).gameIds.length === 2, 'campaign creates five three-game sessions and one two-game session');
check(receipt.sessions.every((session) => session.stopOrSkipAllowed && session.state === 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE'), 'every current session remains optional and stoppable');
check(receipt.nextAction.nextGameId === '002-robo-pong' && receipt.nextAction.automatic === false, 'next item is deterministic but never automatic');
check(receipt.policy.rawNotesRetained === false && receipt.policy.machinePathsRetained === false, 'campaign retains neither raw notes nor machine paths');
check(receipt.policy.candidateReviewClosesWarning === false && receipt.policy.campaignCompletionClosesWarning === false, 'campaign progress cannot clear warnings');
check(receipt.truth.physicalHardwareProven === false && receipt.truth.humanUsefulnessEstablished === false, 'no physical proof or human usefulness is claimed');
check(receipt.truth.manifestMutated === false && receipt.truth.canonicalStateTouched === false, 'no manifest or canonical state is touched');

const ids = receipt.games.map((game) => game.gameId);
check(new Set(ids).size === 17, 'campaign contains seventeen unique game ids');
check(receipt.sessions.flatMap((session) => session.gameIds).join(',') === ids.join(','), 'session order exactly covers the campaign queue');
check(receipt.games.every((game) => game.warningOpen && game.completionRequires === 'SEPARATE_PER_GAME_MANIFEST_EVIDENCE_GATE'), 'every game retains a separate warning-closure gate');
check(!Campaign.stableStringify(receipt).match(/\b[A-Z]:[\\/]/), 'persisted campaign contains no absolute Windows path');

check(handoff.includes('17') && handoff.includes('six checklist items'), 'human handoff names the exact queue and checklist');
check(handoff.includes('ChatGPT mobile remote-control connection') && handoff.includes('does not by itself count'), 'handoff distinguishes remote control from physical game QA');
check(handoff.includes('tools/browser-lan-hardware-qa-lab/index.html'), 'handoff points to the existing trusted relative Lab route');
const sessionHandoff = handoff.split('## Current next item')[0];
check(ids.every((gameId) => sessionHandoff.split('`' + gameId + '`').length === 2), 'handoff session lists contain each pending game exactly once');
check(!handoff.match(/\b[A-Z]:[\\/]/), 'handoff contains no absolute machine path');
check(handoff.includes('Stopping or skipping is valid') && handoff.includes('No session starts automatically'), 'handoff preserves voluntary stopping');

check(requirements.requirements.filter((item) => item.required).length === 4, 'requirements define four required proof groups');
check(requirements.requirements.filter((item) => item.required).flatMap((item) => item.capabilities).length === 8, 'requirements define eight required campaign capabilities');
check(!before.capabilities.some((item) => item.id === 'qa.phone-campaign.sanitized-queue'), 'before inventory lacks the campaign queue adapter');
check(contract.provides.filter((id) => id.startsWith('qa.phone-campaign.')).every((id) => after.capabilities.some((item) => item.id === id && item.status === 'available')), 'after inventory contains every declared campaign capability');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 8, 'independent before comparison is BLOCKED with eight missing capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'independent after comparison is READY with no required capability missing');
check(gapAfter.requirements.find((item) => item.id === 'candidate-observation-received').status === 'DEGRADED', 'optional candidate receipt remains degraded');
check(gapAfter.requirements.find((item) => item.id === 'candidate-review-accepted').status === 'DEGRADED', 'optional candidate review remains degraded');
check(gapAfter.requirements.find((item) => item.id === 'physical-phone-evidence-verified').status === 'DEGRADED', 'optional physical-phone evidence remains degraded');
check(gapAfter.requirements.find((item) => item.id === 'game-warning-closed').status === 'DEGRADED', 'optional warning closure remains degraded');
check(contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'campaign module has no permissions or writes');

const names = fs.readdirSync(__dirname);
check(!names.some((name) => /CANDIDATE|PHYSICAL_PHONE_(PASS|EVIDENCE)|HUMAN_RESPONSE/.test(name)), 'audit persists no candidate, hardware-pass, or human-response artifact');

if (names.includes('VERIFICATION_RECEIPT.json')) {
  const verification = readLocal('VERIFICATION_RECEIPT.json');
  check(verification.schema === 'axm.voluntary-phone-qa-campaign-verification-receipt/v1' && verification.status === 'TEST', 'verification receipt identity remains TEST');
  check(verification.focused.explicitAssertions === 90 && verification.focused.commands[0].assertions === 47 && verification.focused.commands[1].assertions === 43, 'verification receipt records all focused assertions');
  check(verification.adjacent.explicitAssertions === 146 && verification.adjacent.commandLevelPasses === 1, 'verification receipt records adjacent checks');
  check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0 && verification.broadVerification.failures === 0 && verification.broadVerification.holds === 0, 'verification receipt records required and broad results without hidden failure');
  check(verification.sources.every((source) => {
    const digest = 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(path.join(workshop, source.path))).digest('hex');
    return digest === source.sha256;
  }), 'every verification source digest matches current bytes');
}

console.log('Current Voluntary Phone QA Campaign audit selftest passed: ' + checks + ' checks.');
