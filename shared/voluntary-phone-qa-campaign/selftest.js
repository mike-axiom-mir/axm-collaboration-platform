#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Campaign = require('./voluntary-phone-qa-campaign');

const workshop = path.resolve(__dirname, '../..');
const schema = require('./voluntary-phone-qa-campaign.schema.json');
const contract = require('./module.contract.json');

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

function checkThrows(fn, pattern, label) {
  assert.throws(fn, pattern, label);
  checks += 1;
  console.log('PASS ' + label);
}

function currentInput() {
  return {
    campaignId: 'current-voluntary-phone-qa-campaign-20260819',
    generatedAt: '2026-08-19T15:02:00.000Z',
    seamReport: read('exports/game-night-seam-report.json'),
    qaLabManifest: read('tools/browser-lan-hardware-qa-lab/manifest.json'),
    qaLabContract: read('tools/browser-lan-hardware-qa-lab/module.contract.json'),
    maxGamesPerSession: 3,
    candidateReviews: []
  };
}

function review(gameId, decision, suffix) {
  return {
    gameId,
    candidateDigest: String(suffix || '1').repeat(64),
    decision,
    reviewedAt: '2026-08-19T15:01:00.000Z',
    voluntaryHumanReview: true
  };
}

const input = currentInput();
const receipt = Campaign.buildCampaign(input);

check(schema.$id === Campaign.CAMPAIGN_SCHEMA, 'schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST with zero permissions');
check(contract.boundaries.writes.length === 0, 'module performs no writes');
check(contract.boundaries.refuses.includes('candidate-review-as-warning-closure') && contract.boundaries.refuses.includes('forced-session-completion'), 'contract preserves warning and human-choice boundaries');
check(Campaign.verifyCampaign(receipt, input).pass, 'current campaign verifies by exact rebuild');
check(Campaign.stableStringify(receipt) === Campaign.stableStringify(Campaign.buildCampaign(currentInput())), 'current campaign build is deterministic');
check(receipt.sourceRefs.seamReport.warningCount === 17 && receipt.sourceRefs.seamReport.failCount === 0, 'campaign binds the passing report with seventeen warnings');
check(receipt.sourceRefs.qaLab.id === 'browser-lan-hardware-qa-lab' && receipt.sourceRefs.qaLab.status === 'TEST', 'campaign binds the exact TEST capture hand');
check(receipt.games.length === 17 && receipt.summary.physicalPhoneWarnings === 17, 'campaign contains all seventeen phone-warning games');
check(receipt.games.map((game) => game.slot).join(',') === '002,003,004,005,006,007,008,009,010,011,012,015,016,017,018,019,021', 'campaign queue is deterministic slot order');
check(!Campaign.stableStringify(receipt).includes('D:\\') && !Campaign.stableStringify(receipt).includes('C:\\'), 'campaign output retains no Windows machine path');
check(!Object.hasOwn(receipt.games[0], 'manifest') && !Object.hasOwn(receipt.sourceRefs.seamReport, 'scope'), 'campaign redacts source manifest and scope paths');
check(receipt.policy.maxGamesPerSession === 3 && receipt.sessions.length === 6, 'seventeen games are divided into six bounded sessions');
check(receipt.sessions.every((session) => session.gameIds.length >= 1 && session.gameIds.length <= 3), 'every session respects the three-game ceiling');
check(receipt.sessions.flatMap((session) => session.gameIds).join(',') === receipt.games.map((game) => game.gameId).join(','), 'sessions cover each warning game exactly once');
check(receipt.checklist.length === 6 && receipt.checklist.map((item) => item.id).join(',') === Campaign.CHECKLIST.map((item) => item.id).join(','), 'campaign preserves the exact six-observation checklist');
check(receipt.games.every((game) => game.state === 'PENDING_VOLUNTARY_OBSERVATION'), 'every current game remains pending voluntary observation');
check(receipt.summary.reviewRecords === 0 && receipt.summary.pendingVoluntaryObservation === 17, 'current campaign records zero reviews and seventeen pending observations');
check(receipt.nextAction.nextGameId === '002-robo-pong' && receipt.nextAction.state === 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE', 'current next game is deterministic and optional');
check(receipt.sourceRefs.qaLab.relativeRoute === 'tools/browser-lan-hardware-qa-lab/index.html', 'campaign points to the existing relative Lab route');
check(receipt.games.every((game) => game.warningOpen && !game.manifestMutationAuthorized), 'all warnings remain open with no manifest mutation authority');
check(receipt.policy.candidateReviewClosesWarning === false && receipt.policy.campaignCompletionClosesWarning === false, 'candidate and campaign completion cannot clear warnings');
check(receipt.sessions.every((session) => session.stopOrSkipAllowed && !session.automatic), 'every session preserves stop and skip agency');
check(receipt.truth.physicalHardwareProven === false && receipt.truth.humanUsefulnessEstablished === false, 'current campaign claims no hardware proof or human usefulness');
check(receipt.truth.automaticParticipation === false && receipt.truth.automaticWrite === false && receipt.truth.automaticCanon === false, 'campaign grants no automatic participation, write, or CANON authority');

const tooSmall = currentInput();
tooSmall.maxGamesPerSession = 0;
checkThrows(() => Campaign.buildCampaign(tooSmall), /integer from 1 to 5/, 'zero-sized sessions are refused');
const tooLarge = currentInput();
tooLarge.maxGamesPerSession = 6;
checkThrows(() => Campaign.buildCampaign(tooLarge), /integer from 1 to 5/, 'unbounded session sizing is refused');
const warningCountTamper = currentInput();
warningCountTamper.seamReport.warningCount = 16;
checkThrows(() => Campaign.buildCampaign(warningCountTamper), /warning count mismatch/, 'warning-count tampering is refused');
const failingReport = currentInput();
failingReport.seamReport.pass = false;
failingReport.seamReport.failCount = 1;
checkThrows(() => Campaign.buildCampaign(failingReport), /must pass with zero failures/, 'a failing seam report cannot become a human campaign');
const maliciousGame = currentInput();
maliciousGame.seamReport.games[0].game = '../../002-robo-pong';
checkThrows(() => Campaign.buildCampaign(maliciousGame), /cannot persist a machine path|not bounded/, 'unbounded game identifiers are refused');
const manifestStatus = currentInput();
manifestStatus.qaLabManifest.status = 'WORKING';
checkThrows(() => Campaign.buildCampaign(manifestStatus), /identity or status mismatch/, 'capture hand status drift is refused');
const permissionDrift = currentInput();
permissionDrift.qaLabContract.permissions = [];
checkThrows(() => Campaign.buildCampaign(permissionDrift), /permissions differ/, 'capture hand permission drift is refused');
const refusalDrift = currentInput();
refusalDrift.qaLabContract.boundaries.refuses = refusalDrift.qaLabContract.boundaries.refuses.filter((item) => item !== 'manifest-warning-mutation');
checkThrows(() => Campaign.buildCampaign(refusalDrift), /missing refusal/, 'capture hand warning-mutation refusal is required');
const unknownReview = currentInput();
unknownReview.candidateReviews = [review('020-not-in-queue', 'INCOMPLETE', '2')];
checkThrows(() => Campaign.buildCampaign(unknownReview), /outside the current warning queue/, 'reviews outside the current queue are refused');
const duplicateReview = currentInput();
duplicateReview.candidateReviews = [review('002-robo-pong', 'INCOMPLETE', '3'), review('002-robo-pong', 'REJECT', '4')];
checkThrows(() => Campaign.buildCampaign(duplicateReview), /repeat game id/, 'duplicate game reviews are refused');
const badDigest = currentInput();
badDigest.candidateReviews = [review('002-robo-pong', 'INCOMPLETE', 'x')];
checkThrows(() => Campaign.buildCampaign(badDigest), /must be SHA-256/, 'malformed candidate digests are refused');
const involuntary = currentInput();
involuntary.candidateReviews = [review('002-robo-pong', 'INCOMPLETE', '5')];
involuntary.candidateReviews[0].voluntaryHumanReview = false;
checkThrows(() => Campaign.buildCampaign(involuntary), /must declare voluntary human review/, 'non-voluntary review input is refused');

const acceptedInput = currentInput();
acceptedInput.candidateReviews = [review('002-robo-pong', 'ACCEPT_FOR_SEPARATE_GAME_REVIEW', 'a')];
const accepted = Campaign.buildCampaign(acceptedInput);
check(accepted.games[0].state === 'REVIEW_ACCEPTED_WARNING_STILL_OPEN', 'accepted candidate remains explicitly warning-open');
check(accepted.games[0].candidateDigest === 'sha256:' + 'a'.repeat(64), 'candidate digest is normalized and retained without notes');
check(accepted.summary.acceptedForSeparateGameReview === 1 && accepted.summary.warningsStillOpen === 17, 'accepted review advances campaign progress without clearing a warning');
check(accepted.truth.physicalHardwareProven === false && accepted.truth.humanIdentityAuthenticated === false, 'review input does not authenticate identity or prove hardware');
const rejectedInput = currentInput();
rejectedInput.candidateReviews = [review('002-robo-pong', 'REJECT', 'b')];
check(Campaign.buildCampaign(rejectedInput).games[0].state === 'REVIEW_REJECTED_RETRY_OPTIONAL', 'rejected observation becomes an optional retry');
const incompleteInput = currentInput();
incompleteInput.candidateReviews = [review('002-robo-pong', 'INCOMPLETE', 'c')];
check(Campaign.buildCampaign(incompleteInput).games[0].state === 'INCOMPLETE_RETRY_OPTIONAL', 'incomplete observation becomes an optional retry');

const allAcceptedInput = currentInput();
allAcceptedInput.candidateReviews = receipt.games.map((game, index) => review(game.gameId, 'ACCEPT_FOR_SEPARATE_GAME_REVIEW', (index % 10).toString()));
const allAccepted = Campaign.buildCampaign(allAcceptedInput);
check(allAccepted.nextAction.state === 'CAMPAIGN_REVIEW_COMPLETE_WARNINGS_STILL_OPEN' && allAccepted.nextAction.nextGameId === null, 'complete campaign routes to separate per-game warning review');
check(allAccepted.summary.warningsStillOpen === 17 && allAccepted.truth.warningCleared === false, 'even complete reviewed coverage clears no verifier warning');

const receiptTamper = clone(receipt);
receiptTamper.truth.warningCleared = true;
check(!Campaign.verifyCampaign(receiptTamper, input).pass, 'campaign receipt cannot be silently changed into warning closure');
const extraInput = currentInput();
extraInput.autoRun = true;
checkThrows(() => Campaign.buildCampaign(extraInput), /unknown fields/, 'unknown authority-bearing input fields are refused');

console.log('Voluntary Phone QA Campaign selftest passed: ' + checks + ' checks.');

