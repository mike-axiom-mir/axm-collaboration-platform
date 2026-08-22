'use strict';

const crypto = require('crypto');
const Campaign = require('../voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Handoff = require('../grounded-growth-human-handoff/grounded-growth-human-handoff');

const RECEIPT_SCHEMA = 'axm.grounded-growth-phone-evidence-gate/v1';
const VERSION = '0.1.0';
const PHONE_WARNING = Campaign.PHONE_WARNING;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const TARGET_SCOPES = ['NAMED_LOCAL_STEWARD', 'DECLARED_COHORT'];
const OBSERVATION_KEYS = [
  'physicalPhonePresent',
  'controllerJoined',
  'seatIdentityMatched',
  'actionObservedOnSharedScreen',
  'disconnectObserved',
  'recoveredAfterDisconnect'
];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

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
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function nativeJsonDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function requiredText(value, label, maximum = 240) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result || result.length > maximum) throw new Error(label + ' must contain 1-' + maximum + ' characters');
  if (/^[A-Za-z]:[\\/]|^\//.test(result)) throw new Error(label + ' cannot persist a machine path');
  return result;
}

function timestamp(value, label) {
  const result = requiredText(value, label, 80);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return new Date(result).toISOString();
}

function reference(id, schema, digest) {
  const normalized = String(digest || '').toLowerCase();
  if (!DIGEST.test(normalized)) throw new Error('reference digest must be SHA-256');
  return {
    id: requiredText(id, 'reference id', 180),
    schema: requiredText(schema, 'reference schema', 180),
    sha256: normalized
  };
}

function sameReference(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function verifyCampaign(campaign) {
  if (!campaign || campaign.schema !== Campaign.CAMPAIGN_SCHEMA || campaign.version !== Campaign.VERSION || campaign.status !== 'TEST') {
    throw new Error('campaign identity mismatch');
  }
  const payload = clone(campaign);
  delete payload.campaignDigest;
  if (campaign.campaignDigest !== Campaign.sha256(payload)) throw new Error('campaign digest mismatch');
  if (!Array.isArray(campaign.games) || !campaign.games.length) throw new Error('campaign games are required');
  if (new Set(campaign.games.map((game) => game.gameId)).size !== campaign.games.length) throw new Error('campaign game ids must be unique');
  const counts = {
    accepted: campaign.games.filter((game) => game.reviewDecision === 'ACCEPT_FOR_SEPARATE_GAME_REVIEW').length,
    rejected: campaign.games.filter((game) => game.reviewDecision === 'REJECT').length,
    incomplete: campaign.games.filter((game) => game.reviewDecision === 'INCOMPLETE').length,
    pending: campaign.games.filter((game) => game.reviewDecision == null).length
  };
  if (!campaign.summary
    || campaign.summary.physicalPhoneWarnings !== campaign.games.length
    || campaign.summary.warningsStillOpen !== campaign.games.filter((game) => game.warningOpen === true).length
    || campaign.summary.acceptedForSeparateGameReview !== counts.accepted
    || campaign.summary.rejected !== counts.rejected
    || campaign.summary.incomplete !== counts.incomplete
    || campaign.summary.pendingVoluntaryObservation !== counts.pending) {
    throw new Error('campaign summary mismatch');
  }
  if (!campaign.truth || campaign.truth.humanUsefulnessEstablished !== false || campaign.truth.warningCleared !== false) {
    throw new Error('campaign truth boundary mismatch');
  }
}

function verifyManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('game manifest is required');
  const gameId = requiredText(manifest.game_id, 'game manifest game_id', 100).toLowerCase();
  const slot = requiredText(manifest.slot, 'game manifest slot', 3);
  if (!/^\d{3}-[a-z0-9][a-z0-9-]{0,95}$/.test(gameId) || !/^\d{3}$/.test(slot) || gameId.slice(0, 3) !== slot) {
    throw new Error('game manifest identity is not a bounded slot/game pair');
  }
  if (!manifest.controls || manifest.controls.phone_controller !== true || manifest.controls.touch !== true) {
    throw new Error('game manifest does not declare a touch phone-controller surface');
  }
  const seam = manifest.verification && manifest.verification.game_night;
  if (!seam || seam.schema !== 'axm.game-night-seams/v1') throw new Error('game manifest game-night seam is missing');
  if (!['pending', 'verified'].includes(seam.physical_phone_qa)) throw new Error('game manifest physical-phone QA state is unsupported');
  if (seam.physical_phone_qa === 'verified') {
    if (!String(seam.physical_phone_qa_scope || '').trim()) throw new Error('verified game manifest needs physical-phone QA scope');
    if (!Array.isArray(seam.physical_phone_qa_evidence) || !seam.physical_phone_qa_evidence.length) {
      throw new Error('verified game manifest needs physical-phone QA evidence references');
    }
  }
  return { gameId, slot, seam };
}

function verifyDeviceEvidence(receipt, game) {
  if (!receipt || receipt.schema !== 'axm.device-qa-evidence/v1') throw new Error('device evidence schema mismatch');
  requiredText(receipt.id, 'device evidence id', 180);
  timestamp(receipt.capturedAt, 'device evidence capturedAt');
  const digest = String(receipt.digest || '').toLowerCase().replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('device evidence digest must be SHA-256');
  const payload = clone(receipt);
  delete payload.digest;
  if (nativeJsonDigest(payload) !== digest) throw new Error('device evidence native digest mismatch');
  const observation = receipt.phoneObservation;
  if (!observation || observation.schema !== 'axm.qa-phone-observation/v1') throw new Error('phone observation is missing');
  if (observation.gameId !== game.gameId || observation.slot !== game.slot) throw new Error('phone observation targets a different game');
  if (!observation.observations || OBSERVATION_KEYS.some((key) => observation.observations[key] !== true)) {
    throw new Error('phone observation does not contain all six affirmative declarations');
  }
  if (observation.complete !== true || observation.reviewState !== 'CANDIDATE_REQUIRES_HUMAN_REVIEW') {
    throw new Error('phone observation is not a complete review candidate');
  }
  if (!receipt.truth || receipt.truth.physicalHardwareProven !== false || receipt.truth.manifestMutated !== false || receipt.truth.externalReviewRequired !== true) {
    throw new Error('device evidence truth boundary mismatch');
  }
  return { digest: 'sha256:' + digest, capturedAt: timestamp(receipt.capturedAt, 'device evidence capturedAt') };
}

function verifyClosureReport(report, game, earliestAt) {
  if (!report || report.schema !== 'axm.game-package-verification/v1') throw new Error('closure report schema mismatch');
  if (!Array.isArray(report.games) || report.pass !== true || report.failCount !== 0) throw new Error('closure report must pass with zero failures');
  const warningCount = report.games.reduce((sum, item) => sum + (Array.isArray(item.warnings) ? item.warnings.length : 0), 0);
  if (report.warningCount !== warningCount) throw new Error('closure report warning count mismatch');
  const checkedAt = timestamp(report.checkedAt, 'closure report checkedAt');
  const selected = report.games.find((item) => item && item.game === game.gameId && item.slot === game.slot);
  if (!selected || !Array.isArray(selected.errors) || selected.errors.length || !Array.isArray(selected.warnings)) {
    throw new Error('closure report lacks a passing selected game');
  }
  if (selected.warnings.includes(PHONE_WARNING)) throw new Error('closure report still carries the physical-phone warning');
  if (earliestAt && new Date(checkedAt) < new Date(earliestAt)) throw new Error('closure report predates the accepted candidate');
  return { checkedAt, digest: sha256(report) };
}

function normalizeBinding(input) {
  exactKeys(input, ['capabilityId', 'humanClaimId', 'targetScope', 'scopeStatement'], 'binding');
  const targetScope = String(input.targetScope || '').toUpperCase();
  if (!TARGET_SCOPES.includes(targetScope)) throw new Error('binding targetScope is unsupported');
  return {
    capabilityId: requiredText(input.capabilityId, 'binding capabilityId', 180),
    humanClaimId: requiredText(input.humanClaimId, 'binding humanClaimId', 180),
    targetScope,
    scopeStatement: requiredText(input.scopeStatement, 'binding scopeStatement', 800)
  };
}

function inspectHumanHandoff(handoff, binding, gameSurfaceRef) {
  if (handoff == null) return {
    state: 'HUMAN_USEFULNESS_NOT_RUN',
    passed: false,
    verdict: 'NOT_RUN',
    routeStatus: 'NOT_PROVEN',
    reasons: ['EXPLICIT_HUMAN_USEFULNESS_OUTCOME_REQUIRED'],
    handoffRef: null,
    outcomeRef: null
  };
  const packageCheck = Handoff.verifyPackage(handoff);
  if (!packageCheck.pass) throw new Error('human handoff is invalid: ' + packageCheck.errors.join('; '));
  const outcome = handoff.bridgeBundle && handoff.bridgeBundle.groundedOutcome;
  const check = Growth.verifyOutcome(outcome);
  if (!check.pass) throw new Error('human outcome is invalid: ' + check.errors.join('; '));
  if (handoff.capabilityId !== binding.capabilityId || outcome.capabilityId !== binding.capabilityId) {
    throw new Error('human outcome capability binding mismatch');
  }
  if (handoff.claimId !== binding.humanClaimId) throw new Error('human handoff claim binding mismatch');
  const claim = outcome.claims.find((item) => item.id === binding.humanClaimId && item.beneficiary === 'HUMAN');
  if (!claim) throw new Error('human outcome claim binding mismatch');
  const expectedPrefix = '[Scope: ' + binding.targetScope + '] ' + binding.scopeStatement + ' ';
  if (!String(claim.statement || '').startsWith(expectedPrefix)) throw new Error('human outcome scope statement mismatch');
  if (claim.outcomeRef && !sameReference(claim.outcomeRef, gameSurfaceRef)) throw new Error('human outcome candidate surface mismatch');
  const protocol = handoff.evaluation && handoff.evaluation.protocol;
  const candidateCondition = protocol && Array.isArray(protocol.conditions)
    ? protocol.conditions.find((item) => item.role === 'CANDIDATE')
    : null;
  if (!candidateCondition || !sameReference(candidateCondition.artifactRef, gameSurfaceRef)) {
    throw new Error('human handoff candidate surface mismatch');
  }
  const admitted = handoff.state === 'ADMITTED'
    && handoff.mappedDecision === claim.verdict
    && claim.routeStatus === 'ADMITTED'
    && claim.admittedVerdict === claim.verdict;
  const reasons = [];
  if (!admitted) reasons.push('HUMAN_CLAIM_NOT_ADMITTED');
  if (claim.verdict === 'PASS' && (!claim.outcomeRef || !sameReference(claim.outcomeRef, gameSurfaceRef))) reasons.push('GAME_SURFACE_OUTCOME_REFERENCE_REQUIRED');
  const passed = claim.verdict === 'PASS' && admitted && reasons.length === 0;
  const failed = claim.verdict === 'FAIL' && admitted;
  return {
    state: passed ? 'HUMAN_USEFULNESS_PASS' : failed ? 'HUMAN_USEFULNESS_FAIL' : 'HUMAN_USEFULNESS_HOLD',
    passed,
    verdict: claim.verdict,
    routeStatus: claim.routeStatus,
    reasons,
    handoffRef: reference(handoff.handoffId, Handoff.HANDOFF_SCHEMA, handoff.handoffDigest),
    outcomeRef: reference(outcome.outcomeId, Growth.OUTCOME_SCHEMA, outcome.receiptDigest)
  };
}

function deviceState(game, device, closure) {
  if (!device) return { state: 'DEVICE_BEHAVIOR_NOT_RUN', passed: false, reasons: ['VOLUNTARY_PHONE_OBSERVATION_REQUIRED'] };
  if (game.reviewDecision === 'REJECT') return { state: 'DEVICE_CANDIDATE_REJECTED', passed: false, reasons: ['OPTIONAL_RETRY_OR_STOP'] };
  if (game.reviewDecision === 'INCOMPLETE') return { state: 'DEVICE_CANDIDATE_INCOMPLETE', passed: false, reasons: ['OPTIONAL_RETRY_OR_STOP'] };
  if (game.reviewDecision !== 'ACCEPT_FOR_SEPARATE_GAME_REVIEW') {
    return { state: 'DEVICE_CANDIDATE_REVIEW_REQUIRED', passed: false, reasons: ['EXPLICIT_CANDIDATE_REVIEW_REQUIRED'] };
  }
  if (!closure) return { state: 'DEVICE_REVIEW_ACCEPTED_WARNING_OPEN', passed: false, reasons: ['PER_GAME_MANIFEST_EVIDENCE_GATE_REQUIRED'] };
  return { state: 'DEVICE_BEHAVIOR_VERIFIED', passed: true, reasons: [] };
}

function overallState(device, human) {
  if (human.state === 'HUMAN_USEFULNESS_FAIL') return 'HUMAN_OUTCOME_HOLD';
  if (device.passed && human.passed) return 'TWO_KEY_EVIDENCE_PRESENT';
  if (human.passed && !device.passed) return 'HUMAN_PASS_DEVICE_EVIDENCE_INCOMPLETE';
  if (device.passed) return 'WAITING_FOR_HUMAN_USEFULNESS';
  if (device.state === 'DEVICE_REVIEW_ACCEPTED_WARNING_OPEN') return 'WAITING_FOR_MANIFEST_EVIDENCE_GATE';
  if (device.state === 'DEVICE_CANDIDATE_REVIEW_REQUIRED') return 'WAITING_FOR_CANDIDATE_REVIEW';
  if (device.state === 'DEVICE_BEHAVIOR_NOT_RUN') return 'WAITING_FOR_VOLUNTARY_PHONE_OBSERVATION';
  return 'OPTIONAL_RETRY_OR_STOP';
}

function build(input) {
  exactKeys(input, ['gateId', 'generatedAt', 'campaign', 'gameManifest', 'deviceEvidence', 'closureReport', 'binding', 'humanHandoff'], 'gate input');
  const campaign = clone(input.campaign);
  verifyCampaign(campaign);
  const manifest = clone(input.gameManifest);
  const gameIdentity = verifyManifest(manifest);
  const game = campaign.games.find((item) => item.gameId === gameIdentity.gameId && item.slot === gameIdentity.slot);
  if (!game) throw new Error('game manifest is outside the campaign queue');
  if (game.warning !== PHONE_WARNING || game.warningOpen !== true) throw new Error('campaign game warning boundary mismatch');
  const binding = normalizeBinding(input.binding);
  const gameSurfaceRef = reference(gameIdentity.gameId, 'axm.game-manifest-surface/v1', sha256(manifest));

  const deviceEvidence = input.deviceEvidence == null ? null : clone(input.deviceEvidence);
  const device = deviceEvidence == null ? null : verifyDeviceEvidence(deviceEvidence, gameIdentity);
  if (game.candidateDigest && (!device || game.candidateDigest !== device.digest)) throw new Error('campaign candidate digest does not match device evidence');
  if (game.reviewDecision && !device) throw new Error('campaign review requires its exact device evidence receipt');

  const earliestClosure = device && game.reviewedAt
    ? new Date(Math.max(new Date(device.capturedAt).getTime(), new Date(timestamp(game.reviewedAt, 'campaign reviewedAt')).getTime())).toISOString()
    : null;
  const closureReport = input.closureReport == null ? null : clone(input.closureReport);
  const closure = closureReport == null ? null : verifyClosureReport(closureReport, gameIdentity, earliestClosure);
  if (closure && gameIdentity.seam.physical_phone_qa !== 'verified') {
    throw new Error('warning-free closure report requires the verified game manifest surface');
  }
  const deviceLane = deviceState(game, device, closure);
  if (closure && !deviceLane.passed) deviceLane.reasons.push('CLOSURE_REPORT_CANNOT_REPLACE_ACCEPTED_BOUND_CANDIDATE');
  const humanLane = inspectHumanHandoff(input.humanHandoff == null ? null : clone(input.humanHandoff), binding, gameSurfaceRef);
  const overall = overallState(deviceLane, humanLane);
  const sourceTimes = [
    campaign.generatedAt,
    device && device.capturedAt,
    closure && closure.checkedAt,
    input.humanHandoff && input.humanHandoff.generatedAt
  ].filter(Boolean).map((value) => new Date(value).getTime());
  if (sourceTimes.some((value) => value > new Date(timestamp(input.generatedAt, 'generatedAt')).getTime())) {
    throw new Error('gate receipt cannot predate a source receipt');
  }

  const nextActions = [];
  if (!device) nextActions.push('OPTIONALLY_CAPTURE_ONE_VOLUNTARY_PHYSICAL_PHONE_CANDIDATE');
  else if (game.reviewDecision == null) nextActions.push('EXPLICITLY_REVIEW_THE_BOUND_CANDIDATE_OR_STOP');
  else if (['REJECT', 'INCOMPLETE'].includes(game.reviewDecision)) nextActions.push('OPTIONALLY_RETRY_OR_STOP');
  else if (!closure) nextActions.push('COMPLETE_SEPARATE_PER_GAME_MANIFEST_EVIDENCE_GATE');
  if (!humanLane.passed && humanLane.state !== 'HUMAN_USEFULNESS_FAIL') nextActions.push('RUN_SEPARATE_VOLUNTARY_HUMAN_BENEFIT_ROUTE_IF_DESIRED');
  if (humanLane.state === 'HUMAN_USEFULNESS_FAIL') nextActions.push('HOLD_OR_REPAIR_THE_DECLARED_HUMAN_EXPERIENCE');
  if (overall === 'TWO_KEY_EVIDENCE_PRESENT') nextActions.push('PRESENT_FOR_EXPLICIT_STEWARD_REVIEW_WITHOUT_AUTOMATIC_PROMOTION');

  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    gateId: requiredText(input.gateId, 'gateId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    game: { gameId: gameIdentity.gameId, slot: gameIdentity.slot },
    binding,
    sourceRefs: {
      campaign: reference(campaign.campaignId, Campaign.CAMPAIGN_SCHEMA, campaign.campaignDigest),
      gameSurface: gameSurfaceRef,
      deviceEvidence: device ? reference(deviceEvidence.id, 'axm.device-qa-evidence/v1', device.digest) : null,
      closureReport: closure ? reference('game-package-verification-' + gameIdentity.gameId, 'axm.game-package-verification/v1', closure.digest) : null,
      humanHandoff: humanLane.handoffRef,
      humanOutcome: humanLane.outcomeRef
    },
    keys: {
      deviceBehavior: deviceLane,
      humanUsefulness: {
        state: humanLane.state,
        passed: humanLane.passed,
        verdict: humanLane.verdict,
        routeStatus: humanLane.routeStatus,
        reasons: humanLane.reasons
      }
    },
    overall,
    nextActions: Array.from(new Set(nextActions)),
    truth: {
      deviceBehaviorIsHumanUsefulness: false,
      candidateReviewIsWarningClosure: false,
      warningClosureIsHumanBenefit: false,
      humanPassRequiresDevicePassForCombinedState: true,
      gameCapabilityMappingIsCallerDeclared: true,
      humanIdentityAuthenticated: false,
      physicalHardwareMachineProven: false,
      humanUsefulnessEstablished: humanLane.passed,
      deviceBehaviorVerified: deviceLane.passed,
      combinedEvidencePresent: overall === 'TWO_KEY_EVIDENCE_PRESENT',
      gameManifestMutated: false,
      portfolioMutated: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verify(receipt, input) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) return { pass: false, errors: ['gate receipt schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('gate receipt version mismatch');
  let rebuilt = null;
  try {
    rebuilt = build(input);
  } catch (error) {
    errors.push('gate receipt source invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('gate receipt content or digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  PHONE_WARNING,
  OBSERVATION_KEYS,
  stableStringify,
  sha256,
  nativeJsonDigest,
  build,
  verify
};
