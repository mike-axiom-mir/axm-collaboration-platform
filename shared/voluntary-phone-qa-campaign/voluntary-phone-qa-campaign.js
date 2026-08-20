'use strict';

const crypto = require('crypto');

const CAMPAIGN_SCHEMA = 'axm.voluntary-phone-qa-campaign/v1';
const VERSION = '0.1.0';
const PHONE_WARNING = 'physical phone qa is pending';
const REVIEW_DECISIONS = [
  'ACCEPT_FOR_SEPARATE_GAME_REVIEW',
  'REJECT',
  'INCOMPLETE'
];
const CHECKLIST = [
  { id: 'PHYSICAL_PHONE_VISIBLE', claim: 'A separate physical phone is visibly present.' },
  { id: 'CONTROLLER_JOINED', claim: 'The phone controller joined the selected game.' },
  { id: 'SEAT_IDENTITY_MATCHED', claim: 'The visible seat identity matched the intended seat.' },
  { id: 'ACTION_REACHED_SHARED_SCREEN', claim: 'A phone action visibly changed the shared game screen.' },
  { id: 'DISCONNECT_OBSERVED', claim: 'A deliberate link interruption was observed.' },
  { id: 'SAME_CONTROLLER_RECOVERED', claim: 'The same controller recovered after the interruption.' }
];

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach((key) => { result[key] = stableValue(value[key]); });
    return result;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function requiredText(value, label, maximum = 180) {
  const result = String(value == null ? '' : value).trim();
  if (!result || result.length > maximum) throw new Error(label + ' must contain 1-' + maximum + ' characters');
  if (/^[A-Za-z]:[\\/]|^\//.test(result)) throw new Error(label + ' cannot persist a machine path');
  return result;
}

function timestamp(value, label) {
  const result = requiredText(value, label, 80);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function validateSeamReport(report) {
  if (!report || report.schema !== 'axm.game-package-verification/v1') throw new Error('seam report schema mismatch');
  if (!Array.isArray(report.games)) throw new Error('seam report games are required');
  if (report.pass !== true || report.failCount !== 0) throw new Error('seam report must pass with zero failures before planning human evidence');
  timestamp(report.checkedAt, 'seam report checkedAt');
  let warningCount = 0;
  const seen = new Set();
  report.games.forEach((game, index) => {
    if (!game || typeof game !== 'object') throw new Error('seam report game ' + index + ' must be an object');
    const gameId = requiredText(game.game, 'seam report game id', 100);
    const slot = requiredText(game.slot, 'seam report slot', 3);
    if (!/^\d{3}-[a-z0-9][a-z0-9-]{0,95}$/.test(gameId)) throw new Error('seam report game id is not bounded: ' + gameId);
    if (!/^\d{3}$/.test(slot) || gameId.slice(0, 3) !== slot) throw new Error('seam report slot does not match game id: ' + gameId);
    if (seen.has(gameId)) throw new Error('seam report repeats game id: ' + gameId);
    seen.add(gameId);
    if (!Array.isArray(game.errors) || !Array.isArray(game.warnings)) throw new Error('seam report game errors and warnings must be arrays');
    if (game.errors.length) throw new Error('seam report game contains a failure: ' + gameId);
    warningCount += game.warnings.length;
  });
  if (report.warningCount !== warningCount) throw new Error('seam report warning count mismatch');
}

function validateQaLab(manifest, contract) {
  if (!manifest || manifest.id !== 'browser-lan-hardware-qa-lab' || manifest.status !== 'TEST') throw new Error('QA Lab manifest identity or status mismatch');
  if (manifest.version !== 'v0.2' || manifest.entry !== 'index.html' || manifest.contract !== 'module.contract.json') throw new Error('QA Lab manifest route mismatch');
  if (!Array.isArray(manifest.permissions) || stableStringify(manifest.permissions) !== stableStringify(['qa.run'])) throw new Error('QA Lab manifest permission mismatch');
  if (!Array.isArray(manifest.produces) || !manifest.produces.includes('axm.device-qa-evidence/v1')) throw new Error('QA Lab device evidence handoff missing');
  if (!Array.isArray(manifest.actions) || !manifest.actions.includes('record physical-phone observation candidates')) throw new Error('QA Lab candidate capture action missing');
  if (!contract || contract.schema !== 'axm.module-contract/v1' || contract.id !== manifest.id || contract.version !== manifest.version) throw new Error('QA Lab contract identity mismatch');
  if (stableStringify(contract.permissions) !== stableStringify(manifest.permissions)) throw new Error('QA Lab manifest and contract permissions differ');
  if (!contract.boundaries || stableStringify(contract.boundaries.writes) !== stableStringify(['state/browser-lan-hardware-qa'])) throw new Error('QA Lab state boundary mismatch');
  for (const refusal of ['self-attested-physical-proof', 'manifest-warning-mutation']) {
    if (!contract.boundaries.refuses.includes(refusal)) throw new Error('QA Lab missing refusal: ' + refusal);
  }
}

function normalizeReviews(reviews, pendingIds) {
  if (!Array.isArray(reviews)) throw new Error('candidateReviews must be an array');
  const seen = new Set();
  return reviews.map((review, index) => {
    exactKeys(review, ['gameId', 'candidateDigest', 'decision', 'reviewedAt', 'voluntaryHumanReview'], 'candidate review ' + index);
    const gameId = requiredText(review.gameId, 'candidate review gameId', 100);
    if (!pendingIds.has(gameId)) throw new Error('candidate review targets a game outside the current warning queue: ' + gameId);
    if (seen.has(gameId)) throw new Error('candidate reviews repeat game id: ' + gameId);
    seen.add(gameId);
    const rawDigest = requiredText(review.candidateDigest, 'candidate review digest', 71).replace(/^sha256:/, '');
    if (!/^[a-f0-9]{64}$/.test(rawDigest)) throw new Error('candidate review digest must be SHA-256');
    if (!REVIEW_DECISIONS.includes(review.decision)) throw new Error('candidate review decision is unsupported');
    if (review.voluntaryHumanReview !== true) throw new Error('candidate review must declare voluntary human review');
    return {
      gameId,
      candidateDigest: 'sha256:' + rawDigest,
      decision: review.decision,
      reviewedAt: timestamp(review.reviewedAt, 'candidate review reviewedAt'),
      voluntaryHumanReview: true
    };
  }).sort((a, b) => a.gameId.localeCompare(b.gameId));
}

function stateFor(review) {
  if (!review) return 'PENDING_VOLUNTARY_OBSERVATION';
  if (review.decision === 'ACCEPT_FOR_SEPARATE_GAME_REVIEW') return 'REVIEW_ACCEPTED_WARNING_STILL_OPEN';
  if (review.decision === 'REJECT') return 'REVIEW_REJECTED_RETRY_OPTIONAL';
  return 'INCOMPLETE_RETRY_OPTIONAL';
}

function buildSessions(games, maximum) {
  const sessions = [];
  for (let index = 0; index < games.length; index += maximum) {
    const items = games.slice(index, index + maximum);
    sessions.push({
      sessionNumber: sessions.length + 1,
      gameIds: items.map((game) => game.gameId),
      acceptedReviewCount: items.filter((game) => game.state === 'REVIEW_ACCEPTED_WARNING_STILL_OPEN').length,
      remainingReviewCount: items.filter((game) => game.state !== 'REVIEW_ACCEPTED_WARNING_STILL_OPEN').length,
      state: items.every((game) => game.state === 'REVIEW_ACCEPTED_WARNING_STILL_OPEN') ? 'REVIEW_COMPLETE_WARNINGS_STILL_OPEN' : 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE',
      stopOrSkipAllowed: true,
      automatic: false
    });
  }
  return sessions;
}

function buildCampaign(input) {
  exactKeys(input, ['campaignId', 'generatedAt', 'seamReport', 'qaLabManifest', 'qaLabContract', 'maxGamesPerSession', 'candidateReviews'], 'campaign input');
  const seamReport = clone(input.seamReport);
  const manifest = clone(input.qaLabManifest);
  const contract = clone(input.qaLabContract);
  validateSeamReport(seamReport);
  validateQaLab(manifest, contract);
  if (!Number.isInteger(input.maxGamesPerSession) || input.maxGamesPerSession < 1 || input.maxGamesPerSession > 5) {
    throw new Error('maxGamesPerSession must be an integer from 1 to 5');
  }
  const warningGames = seamReport.games.filter((game) => game.warnings.includes(PHONE_WARNING)).map((game) => ({
    gameId: game.game,
    slot: game.slot
  })).sort((a, b) => a.slot.localeCompare(b.slot) || a.gameId.localeCompare(b.gameId));
  const pendingIds = new Set(warningGames.map((game) => game.gameId));
  const reviews = normalizeReviews(input.candidateReviews, pendingIds);
  const reviewsByGame = new Map(reviews.map((review) => [review.gameId, review]));
  const games = warningGames.map((game) => {
    const review = reviewsByGame.get(game.gameId) || null;
    return {
      gameId: game.gameId,
      slot: game.slot,
      state: stateFor(review),
      candidateDigest: review ? review.candidateDigest : null,
      reviewDecision: review ? review.decision : null,
      reviewedAt: review ? review.reviewedAt : null,
      warning: PHONE_WARNING,
      warningOpen: true,
      manifestMutationAuthorized: false,
      completionRequires: 'SEPARATE_PER_GAME_MANIFEST_EVIDENCE_GATE'
    };
  });
  const accepted = games.filter((game) => game.state === 'REVIEW_ACCEPTED_WARNING_STILL_OPEN').length;
  const rejected = games.filter((game) => game.state === 'REVIEW_REJECTED_RETRY_OPTIONAL').length;
  const incomplete = games.filter((game) => game.state === 'INCOMPLETE_RETRY_OPTIONAL').length;
  const pending = games.filter((game) => game.state === 'PENDING_VOLUNTARY_OBSERVATION').length;
  const sessions = buildSessions(games, input.maxGamesPerSession);
  const next = games.find((game) => game.state === 'PENDING_VOLUNTARY_OBSERVATION') ||
    games.find((game) => game.state === 'INCOMPLETE_RETRY_OPTIONAL') ||
    games.find((game) => game.state === 'REVIEW_REJECTED_RETRY_OPTIONAL') || null;

  const receipt = {
    schema: CAMPAIGN_SCHEMA,
    version: VERSION,
    campaignId: requiredText(input.campaignId, 'campaignId'),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    sourceRefs: {
      seamReport: {
        schema: seamReport.schema,
        checkedAt: seamReport.checkedAt,
        sha256: sha256(seamReport),
        pass: seamReport.pass,
        failCount: seamReport.failCount,
        warningCount: seamReport.warningCount
      },
      qaLab: {
        id: manifest.id,
        version: manifest.version,
        status: manifest.status,
        manifestSha256: sha256(manifest),
        contractSha256: sha256(contract),
        captureSchema: 'axm.device-qa-evidence/v1',
        relativeRoute: 'tools/browser-lan-hardware-qa-lab/index.html'
      }
    },
    policy: {
      maxGamesPerSession: input.maxGamesPerSession,
      voluntaryParticipationOnly: true,
      stopOrSkipAllowed: true,
      rawNotesRetained: false,
      machinePathsRetained: false,
      candidateReviewClosesWarning: false,
      campaignCompletionClosesWarning: false
    },
    checklist: clone(CHECKLIST),
    games,
    sessions,
    summary: {
      verifierGames: seamReport.games.length,
      physicalPhoneWarnings: games.length,
      reviewRecords: reviews.length,
      acceptedForSeparateGameReview: accepted,
      rejected,
      incomplete,
      pendingVoluntaryObservation: pending,
      sessionCount: sessions.length,
      warningsStillOpen: games.length
    },
    nextAction: {
      state: next ? 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE' : 'CAMPAIGN_REVIEW_COMPLETE_WARNINGS_STILL_OPEN',
      nextGameId: next ? next.gameId : null,
      route: next ? 'OPEN_QA_LAB_AND_CAPTURE_ONE_CANDIDATE' : 'SEPARATE_PER_GAME_MANIFEST_EVIDENCE_REVIEW',
      requiredEvent: next ? 'INDEPENDENT_VOLUNTARY_PHYSICAL_PHONE_SESSION' : 'EXPLICIT_PER_GAME_WARNING_CLOSURE_REVIEW',
      automatic: false
    },
    truth: {
      currentReportPassed: true,
      warningQueueSanitized: true,
      reviewRecordsSupplied: reviews.length,
      humanIdentityAuthenticated: false,
      physicalHardwareProven: false,
      humanUsefulnessEstablished: false,
      manifestMutated: false,
      warningCleared: false,
      canonicalStateTouched: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    campaignDigest: null
  };
  const payload = clone(receipt);
  delete payload.campaignDigest;
  receipt.campaignDigest = sha256(payload);
  return receipt;
}

function verifyCampaign(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== CAMPAIGN_SCHEMA || receipt.version !== VERSION) throw new Error('campaign identity mismatch');
    const rebuilt = buildCampaign(input);
    if (stableStringify(receipt) !== stableStringify(rebuilt)) throw new Error('campaign content or digest mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  CAMPAIGN_SCHEMA,
  VERSION,
  PHONE_WARNING,
  REVIEW_DECISIONS,
  CHECKLIST,
  stableStringify,
  sha256,
  buildCampaign,
  verifyCampaign
};

