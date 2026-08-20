'use strict';

const crypto = require('crypto');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Direction = require('../grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const Intake = require('../simulation-lab-extension-intake/simulation-lab-extension-intake');
const Phone = require('../grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate');
const Challenger = require('../grounded-growth-challenger-lab/grounded-growth-challenger-lab');
const DeterministicJson = require('../../tools/deterministic-json-core');

const FRONTIER_SCHEMA = 'axm.grounded-growth-frontier-receipt/v1';
const VERSION = '0.1.0';
const EVIDENCE_FRONTIER_SCHEMA = 'axm.grounded-growth-evidence-frontier-receipt/v1';
const EVIDENCE_VERSION = '0.1.0';
const STEWARDSHIP_FRONTIER_SCHEMA = 'axm.grounded-growth-stewardship-frontier-receipt/v1';
const STEWARDSHIP_VERSION = '0.1.0';

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) {
  return JSON.parse(stableStringify(value));
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

function verifyDigestReceipt(receipt, expectedSchema, label) {
  if (!receipt || receipt.schema !== expectedSchema) throw new Error(label + ' schema mismatch');
  if (receipt.status !== 'TEST') throw new Error(label + ' must remain TEST');
  if (!/^sha256:[a-f0-9]{64}$/.test(receipt.receiptDigest || '')) throw new Error(label + ' receipt digest format mismatch');
  const payload = clone(receipt);
  const claimed = payload.receiptDigest;
  delete payload.receiptDigest;
  if (sha256(payload) !== claimed) throw new Error(label + ' receipt digest mismatch');
}

function effectiveOutcomes(portfolio) {
  const byId = new Map(portfolio.outcomes.map((outcome) => [outcome.outcomeId, outcome]));
  return portfolio.latest.map((item) => {
    const outcome = byId.get(item.effectiveOutcomeId);
    if (!outcome || outcome.receiptDigest !== item.effectiveReceiptDigest) throw new Error('portfolio effective outcome ancestry mismatch for ' + item.capabilityId);
    if (outcome.capabilityId !== item.capabilityId) throw new Error('portfolio effective outcome capability mismatch for ' + item.capabilityId);
    return outcome;
  });
}

function beneficiaryCount(outcomes, beneficiary, verdict) {
  return outcomes.filter((outcome) => outcome.claims.some((claim) =>
    claim.beneficiary === beneficiary && claim.admittedVerdict === verdict
  )).length;
}

function validateHumanReadiness(readiness, portfolio, outcomes) {
  verifyDigestReceipt(readiness, 'axm.grounded-growth-human-handoff-readiness/v1', 'human handoff readiness');
  if (readiness.state !== 'TECHNICAL_HANDOFF_READY_HUMAN_EVIDENCE_NOT_RUN') throw new Error('human handoff readiness state mismatch');
  if (!Array.isArray(readiness.routes)) throw new Error('human handoff readiness routes are required');
  const capabilityIds = portfolio.latest.map((item) => item.capabilityId).sort();
  const routeIds = readiness.routes.map((route) => route.capabilityId).sort();
  if (stableStringify(capabilityIds) !== stableStringify(routeIds)) throw new Error('human handoff routes do not cover the exact current capabilities');
  const humanClaims = new Map(outcomes.map((outcome) => {
    const claim = outcome.claims.find((item) => item.beneficiary === 'HUMAN');
    if (!claim) throw new Error('current outcome is missing a human claim: ' + outcome.capabilityId);
    return [outcome.capabilityId, claim.id];
  }));
  readiness.routes.forEach((route) => {
    if (route.humanClaimId !== humanClaims.get(route.capabilityId)) throw new Error('human handoff claim ancestry mismatch for ' + route.capabilityId);
    if (route.technicalHandoffState !== 'READY_FOR_OPTIONAL_LOCAL_TTY_INPUT') throw new Error('human handoff route is not technically ready');
    if (route.humanEvidenceState !== 'NOT_RUN' || route.humanBenefitEstablished !== false) throw new Error('human handoff readiness cannot claim live benefit');
  });
  if (!readiness.livePath || readiness.livePath.state !== 'NOT_RUN' || readiness.livePath.humanBenefitEstablished !== false) {
    throw new Error('human live path must remain NOT_RUN');
  }
  if (!readiness.stagedBoundary || readiness.stagedBoundary.startsParticipationAutomatically !== false || readiness.stagedBoundary.writesAutomatically !== false) {
    throw new Error('human handoff readiness expanded participation or write authority');
  }
  if (!readiness.truth || readiness.truth.humanParticipationOccurred !== false || readiness.truth.humanBenefitClaimed !== false || readiness.truth.automaticExecution !== false || readiness.truth.automaticCanon !== false) {
    throw new Error('human handoff readiness truth boundary mismatch');
  }
}

function validateExtensionReadiness(readiness, hostProfile) {
  verifyDigestReceipt(readiness, 'axm.simulation-lab-extension-intake-readiness/v1', 'extension intake readiness');
  const hostCheck = Intake.verifyHostProfile(hostProfile);
  if (!hostCheck.pass) throw new Error('extension host profile invalid: ' + hostCheck.errors.join('; '));
  if (readiness.bindings.hostProfileDigest !== hostProfile.profileDigest) throw new Error('extension readiness host profile binding mismatch');
  if (!readiness.current || !Number.isInteger(readiness.current.candidatePackageCount) || !Number.isInteger(readiness.current.assessmentCount)) {
    throw new Error('extension readiness candidate counts are required');
  }
  if (readiness.current.candidatePackageCount !== 0 || readiness.current.assessmentCount !== 0) {
    throw new Error('frontier v0.1 requires zero-candidate readiness; a candidate must be supplied and verified as a new exact input');
  }
  if (!readiness.truth || readiness.truth.automaticExecution !== false || readiness.truth.automaticInstall !== false || readiness.truth.automaticMerge !== false || readiness.truth.automaticCanon !== false) {
    throw new Error('extension readiness authority boundary mismatch');
  }
  if (readiness.truth.candidatePackagePresent !== false) throw new Error('extension readiness candidate presence mismatch');
}

function sourceRef(id, schema, digest) {
  return { id, schema, sha256: digest };
}

function technicalLane(directionHandoff) {
  const actionable = directionHandoff.summary.actionDirectionCount;
  return {
    id: 'CURRENT_TECHNICAL_DIRECTION',
    state: actionable ? 'REVIEWABLE_DIRECTION_PRESENT' : 'NO_ACTIONABLE_DIRECTION',
    itemCount: actionable,
    requiredEvent: actionable ? 'EXPLICIT_STEWARD_REVIEW' : 'NEW_VERIFIED_NON_WAIT_DIRECTION',
    automatic: false
  };
}

function humanLane(readiness, humanPassCount, capabilityCount) {
  const complete = capabilityCount > 0 && humanPassCount === capabilityCount;
  return {
    id: 'VOLUNTARY_HUMAN_EVIDENCE',
    state: complete ? 'CURRENT_HUMAN_EVIDENCE_PRESENT' : 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE',
    itemCount: readiness.routes.length,
    requiredEvent: complete ? 'NEW_INFORMATION_OR_REFRESH' : 'INDEPENDENT_VOLUNTARY_OPT_IN',
    completionOrWithdrawalEquallyValid: true,
    automatic: false
  };
}

function extensionLane(readiness) {
  const candidates = readiness.current.candidatePackageCount;
  const assessments = readiness.current.assessmentCount;
  let state = 'WAITING_FOR_EXPLICIT_CANDIDATE';
  let requiredEvent = 'EXPLICIT_EXPERIMENTAL_CANDIDATE';
  if (candidates > 0 && assessments === 0) {
    state = 'CANDIDATE_AWAITING_STATIC_ASSESSMENT';
    requiredEvent = 'STATIC_ASSESSMENT_WITHOUT_EXECUTION';
  } else if (candidates > 0 && assessments > 0) {
    state = 'CANDIDATE_ASSESSMENT_PRESENT';
    requiredEvent = 'EXPLICIT_STEWARD_EXPERIMENT_DECISION';
  }
  return {
    id: 'EXPERIMENTAL_EXTENSION',
    state,
    itemCount: candidates,
    requiredEvent,
    automatic: false
  };
}

function buildFrontier(input) {
  exactKeys(input, [
    'frontierId', 'generatedAt', 'portfolio', 'directionHandoff',
    'humanHandoffReadiness', 'extensionHostProfile', 'extensionReadiness'
  ], 'frontier input');

  const portfolio = clone(input.portfolio);
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('portfolio invalid: ' + portfolioCheck.errors.join('; '));
  const directionHandoff = clone(input.directionHandoff);
  const directionCheck = Direction.verifyHandoff(directionHandoff);
  if (!directionCheck.pass) throw new Error('direction handoff invalid: ' + directionCheck.errors.join('; '));
  if (!directionHandoff.sourcePacket || !directionHandoff.sourcePacket.source || directionHandoff.sourcePacket.source.kind !== 'PORTFOLIO') {
    throw new Error('direction handoff does not carry a portfolio source');
  }
  if (stableStringify(directionHandoff.sourcePacket.source.receipt) !== stableStringify(portfolio)) {
    throw new Error('direction handoff does not bind the exact current portfolio');
  }
  if (directionHandoff.summary.acceptedDirectionCount !== 0 || directionHandoff.summary.executedDirectionCount !== 0) {
    throw new Error('frontier input contains an accepted or executed direction');
  }
  directionHandoff.directions.forEach((item) => {
    if (item.executionPlan.automatic !== false) throw new Error('direction execution plan cannot be automatic');
    if (item.direction.action_type === 'WAIT_FOR_EVIDENCE' && item.executionPlan.steps.length !== 0) throw new Error('WAIT direction cannot contain execution steps');
  });

  const outcomes = effectiveOutcomes(portfolio);
  const humanHandoffReadiness = clone(input.humanHandoffReadiness);
  validateHumanReadiness(humanHandoffReadiness, portfolio, outcomes);
  const extensionHostProfile = clone(input.extensionHostProfile);
  const extensionReadiness = clone(input.extensionReadiness);
  validateExtensionReadiness(extensionReadiness, extensionHostProfile);

  const capabilityCount = portfolio.latest.length;
  const aiPassCount = beneficiaryCount(outcomes, 'AI_WORKFLOW', 'PASS');
  const humanPassCount = beneficiaryCount(outcomes, 'HUMAN', 'PASS');
  const humanNotRunCount = beneficiaryCount(outcomes, 'HUMAN', 'NOT_RUN');
  const sharedSystemPassCount = beneficiaryCount(outcomes, 'SHARED_SYSTEM', 'PASS');
  const lanes = [
    technicalLane(directionHandoff),
    humanLane(humanHandoffReadiness, humanPassCount, capabilityCount),
    extensionLane(extensionReadiness)
  ];
  let currentBestAction = 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE';
  if (directionHandoff.summary.actionDirectionCount > 0) currentBestAction = 'EXPLICIT_STEWARD_REVIEW_OF_NON_WAIT_DIRECTION';
  else if (extensionReadiness.current.candidatePackageCount > 0) currentBestAction = 'STATIC_CANDIDATE_ASSESSMENT_WITHOUT_EXECUTION';
  else if (humanPassCount === capabilityCount) currentBestAction = 'WAIT_FOR_NEW_INFORMATION';

  const receipt = {
    schema: FRONTIER_SCHEMA,
    version: VERSION,
    frontierId: requiredText(input.frontierId, 'frontierId'),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    scope: 'CURRENT_GROUNDED_GROWTH_AND_EXTENSION_INPUTS',
    sourceRefs: {
      portfolio: sourceRef(portfolio.portfolioId, portfolio.schema, portfolio.portfolioDigest),
      directionHandoff: sourceRef(directionHandoff.handoffId, directionHandoff.schema, directionHandoff.handoffDigest),
      humanHandoffReadiness: sourceRef('current-human-handoff-operational-readiness', humanHandoffReadiness.schema, humanHandoffReadiness.receiptDigest),
      extensionHostProfile: sourceRef(extensionHostProfile.profileId, extensionHostProfile.schema, extensionHostProfile.profileDigest),
      extensionReadiness: sourceRef('current-simulation-lab-extension-intake-readiness', extensionReadiness.schema, extensionReadiness.receiptDigest)
    },
    counts: {
      capabilityChains: capabilityCount,
      latestSharedSystemPass: sharedSystemPassCount,
      latestAiWorkflowPass: aiPassCount,
      latestHumanPass: humanPassCount,
      latestHumanNotRun: humanNotRunCount,
      waitDirections: directionHandoff.summary.waitDirectionCount,
      actionDirections: directionHandoff.summary.actionDirectionCount,
      voluntaryHumanRoutes: humanHandoffReadiness.routes.length,
      liveHumanOutcomes: humanHandoffReadiness.capabilityComparison.after.liveHumanOutcomes,
      candidatePackages: extensionReadiness.current.candidatePackageCount,
      candidateAssessments: extensionReadiness.current.assessmentCount
    },
    lanes,
    decision: {
      state: 'BOUNDED_FRONTIER_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: directionHandoff.summary.actionDirectionCount + extensionReadiness.current.candidatePackageCount,
      currentBestAction,
      externalEventsThatMayChangeFrontier: [
        'INDEPENDENT_VOLUNTARY_HUMAN_OPT_IN',
        'EXPLICIT_EXPERIMENTAL_EXTENSION_CANDIDATE',
        'NEW_VERIFIED_NON_WAIT_DIRECTION',
        'EXPLICIT_STEWARD_DECISION'
      ]
    },
    truth: {
      portfolioVerifiedNatively: true,
      directionHandoffVerifiedNatively: true,
      directionBindsExactPortfolio: true,
      humanReadinessDigestVerified: true,
      extensionHostProfileVerifiedNatively: true,
      extensionReadinessDigestVerified: true,
      aiWorkflowCoverageComplete: capabilityCount > 0 && aiPassCount === capabilityCount,
      humanRouteReadyIsConsent: false,
      humanBenefitEstablished: humanPassCount > 0,
      exampleDeclarationCountsAsCandidate: false,
      candidateCodeExecuted: false,
      autonomousWorkAuthorized: false,
      canonicalStateTouched: false,
      modelWeightTrainingClaimed: false,
      broadGeneralizationClaimed: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    frontierDigest: null
  };
  const payload = clone(receipt);
  delete payload.frontierDigest;
  receipt.frontierDigest = sha256(payload);
  return receipt;
}

function verifyFrontier(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== FRONTIER_SCHEMA) throw new Error('frontier schema mismatch');
    if (receipt.version !== VERSION) throw new Error('frontier version mismatch');
    const rebuilt = buildFrontier(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('frontier content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function phoneEvidenceLane(receipt) {
  const complete = receipt.overall === 'TWO_KEY_EVIDENCE_PRESENT';
  return {
    id: 'SUPPLEMENTAL_PHONE_DEVICE_AND_HUMAN_EVIDENCE',
    state: receipt.overall,
    itemCount: 1,
    capabilityId: receipt.binding.capabilityId,
    gameId: receipt.game.gameId,
    deviceBehaviorPassed: receipt.keys.deviceBehavior.passed,
    humanUsefulnessPassed: receipt.keys.humanUsefulness.passed,
    requiredEvents: complete
      ? ['EXPLICIT_STEWARD_REVIEW']
      : clone(receipt.nextActions),
    portfolioMembershipChanged: false,
    automatic: false
  };
}

function buildEvidenceFrontier(input) {
  exactKeys(input, [
    'evidenceFrontierId', 'generatedAt', 'frontierReceipt', 'frontierInput',
    'phoneEvidenceGate', 'phoneEvidenceInput'
  ], 'evidence frontier input');

  const frontierReceipt = clone(input.frontierReceipt);
  const frontierCheck = verifyFrontier(frontierReceipt, clone(input.frontierInput));
  if (!frontierCheck.pass) throw new Error('frontier receipt invalid: ' + frontierCheck.errors.join('; '));

  const phoneEvidenceGate = clone(input.phoneEvidenceGate);
  const phoneCheck = Phone.verify(phoneEvidenceGate, clone(input.phoneEvidenceInput));
  if (!phoneCheck.pass) throw new Error('phone evidence gate invalid: ' + phoneCheck.errors.join('; '));

  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  if (new Date(frontierReceipt.generatedAt) > new Date(generatedAt)
    || new Date(phoneEvidenceGate.generatedAt) > new Date(generatedAt)) {
    throw new Error('evidence frontier cannot predate a source receipt');
  }

  const phoneComplete = phoneEvidenceGate.overall === 'TWO_KEY_EVIDENCE_PRESENT';
  const lanes = [
    ...clone(frontierReceipt.lanes),
    phoneEvidenceLane(phoneEvidenceGate)
  ];
  const externalEvents = Array.from(new Set([
    ...frontierReceipt.decision.externalEventsThatMayChangeFrontier,
    'VOLUNTARY_PHYSICAL_PHONE_CANDIDATE',
    'ADMITTED_VOLUNTARY_HUMAN_USEFULNESS_OUTCOME'
  ]));

  const receipt = {
    schema: EVIDENCE_FRONTIER_SCHEMA,
    version: EVIDENCE_VERSION,
    evidenceFrontierId: requiredText(input.evidenceFrontierId, 'evidenceFrontierId'),
    generatedAt,
    status: 'TEST',
    scope: 'CURRENT_GROUNDED_GROWTH_FRONTIER_PLUS_ONE_SUPPLEMENTAL_PHONE_EVIDENCE_ROUTE',
    sourceRefs: {
      frontier: sourceRef(frontierReceipt.frontierId, frontierReceipt.schema, frontierReceipt.frontierDigest),
      phoneEvidenceGate: sourceRef(phoneEvidenceGate.gateId, phoneEvidenceGate.schema, phoneEvidenceGate.receiptDigest)
    },
    counts: {
      portfolioCapabilityChains: frontierReceipt.counts.capabilityChains,
      portfolioVoluntaryHumanRoutes: frontierReceipt.counts.voluntaryHumanRoutes,
      supplementalPhoneEvidenceRoutes: 1,
      phoneDeviceBehaviorPass: phoneEvidenceGate.keys.deviceBehavior.passed ? 1 : 0,
      phoneHumanUsefulnessPass: phoneEvidenceGate.keys.humanUsefulness.passed ? 1 : 0,
      phoneTwoKeyEvidencePresent: phoneComplete ? 1 : 0,
      portfolioCapabilityChainsAdded: 0
    },
    lanes,
    decision: {
      state: 'BOUNDED_EVIDENCE_FRONTIER_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: frontierReceipt.decision.reviewableActionCount + (phoneComplete ? 1 : 0),
      currentBestAction: phoneComplete
        ? 'EXPLICIT_STEWARD_REVIEW_OF_PHONE_TWO_KEY_EVIDENCE'
        : frontierReceipt.decision.currentBestAction,
      externalEventsThatMayChangeFrontier: externalEvents
    },
    truth: {
      frontierVerifiedByExactRebuild: true,
      phoneEvidenceGateVerifiedByExactRebuild: true,
      supplementalRouteAddedToPortfolio: false,
      portfolioCapabilityCountChanged: false,
      portfolioHumanBenefitEstablished: frontierReceipt.truth.humanBenefitEstablished,
      phoneDeviceBehaviorVerified: phoneEvidenceGate.truth.deviceBehaviorVerified,
      phoneHumanUsefulnessEstablished: phoneEvidenceGate.truth.humanUsefulnessEstablished,
      phoneTwoKeyEvidencePresent: phoneEvidenceGate.truth.combinedEvidencePresent,
      phoneTwoKeyEvidenceIsSharedGrowthProof: false,
      phoneDeviceBehaviorIsHumanUsefulness: false,
      routeReadinessIsParticipation: false,
      modelWeightTrainingClaimed: false,
      broadGeneralizationClaimed: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    evidenceFrontierDigest: null
  };
  const payload = clone(receipt);
  delete payload.evidenceFrontierDigest;
  receipt.evidenceFrontierDigest = sha256(payload);
  return receipt;
}

function verifyEvidenceFrontier(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== EVIDENCE_FRONTIER_SCHEMA) throw new Error('evidence frontier schema mismatch');
    if (receipt.version !== EVIDENCE_VERSION) throw new Error('evidence frontier version mismatch');
    const rebuilt = buildEvidenceFrontier(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('evidence frontier content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function challengerLane(readiness) {
  const reviewCandidates = readiness.evaluations.filter((item) => item.disposition === 'TECHNICAL_AI_REVIEW_CANDIDATE').length;
  return {
    id: 'BOUNDED_AI_CHALLENGER_EVIDENCE',
    state: readiness.state,
    itemCount: readiness.current.actionableDirectionCount,
    planCount: readiness.current.challengerPlanCount,
    evaluationCount: readiness.current.challengerEvaluationCount,
    technicalAiReviewCandidateCount: reviewCandidates,
    currentBestAction: readiness.truth.currentBestAction,
    readinessIsLearning: false,
    evaluationIsHumanBenefit: false,
    adoptionAuthorized: false,
    automatic: false
  };
}

function buildStewardshipFrontier(input) {
  exactKeys(input, [
    'stewardshipFrontierId', 'generatedAt',
    'evidenceFrontierReceipt', 'evidenceFrontierInput',
    'challengerReadiness', 'challengerReadinessInput'
  ], 'stewardship frontier input');
  const evidenceFrontierReceipt = clone(input.evidenceFrontierReceipt);
  const evidenceCheck = verifyEvidenceFrontier(evidenceFrontierReceipt, clone(input.evidenceFrontierInput));
  if (!evidenceCheck.pass) throw new Error('evidence frontier invalid: ' + evidenceCheck.errors.join('; '));
  const challengerReadiness = clone(input.challengerReadiness);
  const challengerCheck = Challenger.verifyReadiness(challengerReadiness, clone(input.challengerReadinessInput));
  if (!challengerCheck.pass) throw new Error('challenger readiness invalid: ' + challengerCheck.errors.join('; '));
  const frontierDirection = input.evidenceFrontierInput
    && input.evidenceFrontierInput.frontierInput
    && input.evidenceFrontierInput.frontierInput.directionHandoff;
  if (!frontierDirection || challengerReadiness.sourceRefs.directionHandoff.sha256 !== frontierDirection.handoffDigest) {
    throw new Error('challenger readiness does not bind the evidence frontier direction handoff');
  }
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  if (new Date(evidenceFrontierReceipt.generatedAt) > new Date(generatedAt)
    || new Date(challengerReadiness.generatedAt) > new Date(generatedAt)) {
    throw new Error('stewardship frontier cannot predate a source receipt');
  }

  const originalFrontier = input.evidenceFrontierInput.frontierReceipt;
  const challengerReviewCandidates = challengerReadiness.evaluations
    .filter((item) => item.disposition === 'TECHNICAL_AI_REVIEW_CANDIDATE').length;
  const humanEvidencePresent = originalFrontier.counts.latestHumanPass > 0
    || evidenceFrontierReceipt.counts.phoneHumanUsefulnessPass > 0;
  const sharedGrowthClaimAllowed = originalFrontier.counts.capabilityChains > 0
    && originalFrontier.counts.latestAiWorkflowPass === originalFrontier.counts.capabilityChains
    && originalFrontier.counts.latestHumanPass === originalFrontier.counts.capabilityChains;
  const lanes = [
    ...clone(evidenceFrontierReceipt.lanes),
    challengerLane(challengerReadiness)
  ];
  const currentBestAction = challengerReviewCandidates > 0
    ? 'EXPLICIT_STEWARD_REVIEW_OF_CHALLENGER_EVALUATION'
    : evidenceFrontierReceipt.decision.currentBestAction;

  const receipt = {
    schema: STEWARDSHIP_FRONTIER_SCHEMA,
    version: STEWARDSHIP_VERSION,
    stewardshipFrontierId: requiredText(input.stewardshipFrontierId, 'stewardshipFrontierId'),
    generatedAt,
    status: 'TEST',
    scope: 'CURRENT_GROUNDED_GROWTH_AI_AND_HUMAN_STEWARDSHIP_INPUTS',
    sourceRefs: {
      evidenceFrontier: sourceRef(
        evidenceFrontierReceipt.evidenceFrontierId,
        evidenceFrontierReceipt.schema,
        evidenceFrontierReceipt.evidenceFrontierDigest
      ),
      challengerReadiness: sourceRef(
        challengerReadiness.readinessId,
        challengerReadiness.schema,
        challengerReadiness.receiptDigest
      )
    },
    counts: {
      portfolioCapabilityChains: originalFrontier.counts.capabilityChains,
      portfolioAiWorkflowPass: originalFrontier.counts.latestAiWorkflowPass,
      portfolioHumanPass: originalFrontier.counts.latestHumanPass,
      supplementalPhoneEvidenceRoutes: evidenceFrontierReceipt.counts.supplementalPhoneEvidenceRoutes,
      phoneDeviceBehaviorPass: evidenceFrontierReceipt.counts.phoneDeviceBehaviorPass,
      phoneHumanUsefulnessPass: evidenceFrontierReceipt.counts.phoneHumanUsefulnessPass,
      challengerActionableDirections: challengerReadiness.current.actionableDirectionCount,
      challengerPlans: challengerReadiness.current.challengerPlanCount,
      challengerEvaluations: challengerReadiness.current.challengerEvaluationCount,
      challengerTechnicalAiReviewCandidates: challengerReviewCandidates
    },
    lanes,
    balance: {
      aiWorkflowPortfolioCoverageComplete: originalFrontier.counts.capabilityChains > 0
        && originalFrontier.counts.latestAiWorkflowPass === originalFrontier.counts.capabilityChains,
      portfolioHumanCoverageComplete: originalFrontier.counts.capabilityChains > 0
        && originalFrontier.counts.latestHumanPass === originalFrontier.counts.capabilityChains,
      anyScopedHumanEvidencePresent: humanEvidencePresent,
      challengerEvaluationPresent: challengerReadiness.current.challengerEvaluationCount > 0,
      sharedGrowthClaimAllowed,
      unresolvedEvidence: [
        ...(originalFrontier.counts.latestHumanPass < originalFrontier.counts.capabilityChains
          ? ['PORTFOLIO_HUMAN_BENEFIT_NATIVE_EVIDENCE'] : []),
        ...(evidenceFrontierReceipt.counts.phoneDeviceBehaviorPass === 0
          ? ['PHONE_DEVICE_BEHAVIOR_NATIVE_EVIDENCE'] : []),
        ...(evidenceFrontierReceipt.counts.phoneHumanUsefulnessPass === 0
          ? ['PHONE_HUMAN_USEFULNESS_NATIVE_EVIDENCE'] : []),
        ...(challengerReadiness.current.actionableDirectionCount === 0
          ? ['VERIFIED_NON_WAIT_DIRECTION_BEFORE_CHALLENGER_PLAN'] : [])
      ]
    },
    decision: {
      state: 'BOUNDED_AI_AND_HUMAN_STEWARDSHIP_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: evidenceFrontierReceipt.decision.reviewableActionCount + challengerReviewCandidates,
      currentBestAction,
      externalEventsThatMayChangeFrontier: Array.from(new Set([
        ...evidenceFrontierReceipt.decision.externalEventsThatMayChangeFrontier,
        'VERIFIED_NON_WAIT_DIRECTION_FOR_BOUNDED_CHALLENGER_PLAN',
        'BOUND_CHALLENGER_EVALUATION'
      ]))
    },
    truth: {
      evidenceFrontierVerifiedByExactRebuild: true,
      challengerReadinessVerifiedByExactRebuild: true,
      challengerDirectionMatchesFrontier: true,
      aiAndHumanEvidenceVisibleTogether: true,
      challengerLabReadyIsLearning: false,
      challengerEvaluationIsHumanBenefit: false,
      humanEvidenceIsAiLearning: false,
      sharedGrowthClaimed: sharedGrowthClaimAllowed,
      modelWeightTrainingClaimed: false,
      broadGeneralizationClaimed: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    stewardshipFrontierDigest: null
  };
  const payload = clone(receipt);
  delete payload.stewardshipFrontierDigest;
  receipt.stewardshipFrontierDigest = sha256(payload);
  return receipt;
}

function verifyStewardshipFrontier(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== STEWARDSHIP_FRONTIER_SCHEMA) throw new Error('stewardship frontier schema mismatch');
    if (receipt.version !== STEWARDSHIP_VERSION) throw new Error('stewardship frontier version mismatch');
    const rebuilt = buildStewardshipFrontier(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('stewardship frontier content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  FRONTIER_SCHEMA,
  VERSION,
  EVIDENCE_FRONTIER_SCHEMA,
  EVIDENCE_VERSION,
  STEWARDSHIP_FRONTIER_SCHEMA,
  STEWARDSHIP_VERSION,
  stableStringify,
  sha256,
  buildFrontier,
  verifyFrontier,
  buildEvidenceFrontier,
  verifyEvidenceFrontier,
  buildStewardshipFrontier,
  verifyStewardshipFrontier
};
