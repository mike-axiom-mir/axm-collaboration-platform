'use strict';

const Knowledge = require('../grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Human = require('../human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');

const PARTICIPATION_FRONTIER_SCHEMA = 'axm.grounded-growth-participation-frontier-receipt/v1';
const PARTICIPANT_PACKET_SCHEMA = 'axm.human-benefit-participant-packet/v1';
const HANDOFF_READINESS_SCHEMA = 'axm.grounded-growth-human-handoff-readiness/v1';
const VERSION = '0.1.0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return Knowledge.stableStringify(value);
}

function sha256(value) {
  return Knowledge.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(label + ' has unsupported field(s): ' + extra.join(', '));
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 180)) throw new Error(label + ' is too long');
  return result;
}

function exactTimestamp(value, label) {
  const result = requiredText(value, label, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' is not a timestamp');
  return parsed.toISOString();
}

function reference(value, idField, digestField, label) {
  if (!value || typeof value !== 'object') throw new Error(label + ' source is required');
  const result = {
    id: requiredText(value[idField], label + ' id'),
    schema: requiredText(value.schema, label + ' schema', 240),
    sha256: requiredText(value[digestField], label + ' digest', 80).toLowerCase()
  };
  if (!/^sha256:[0-9a-f]{64}$/.test(result.sha256)) throw new Error(label + ' digest is not SHA-256');
  return result;
}

function sameReference(left, right) {
  return Boolean(left && right
    && left.id === right.id
    && left.schema === right.schema
    && left.sha256 === right.sha256);
}

function oneOutcome(knowledge, knowledgeInput) {
  const portfolio = knowledgeInput
    && knowledgeInput.stewardshipFrontierInput
    && knowledgeInput.stewardshipFrontierInput.evidenceFrontierInput
    && knowledgeInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput
    && knowledgeInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio;
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('participation portfolio invalid: ' + portfolioCheck.errors.join('; '));
  const matches = portfolio.outcomes.filter(outcome => outcome.outcomeId === knowledge.knowledgeBinding.researchOutcomeId
    && outcome.receiptDigest === knowledge.sourceRefs.groundedResearchOutcome.sha256);
  if (matches.length !== 1) throw new Error('knowledge frontier must bind exactly one current research outcome');
  const outcome = matches[0];
  const outcomeCheck = Growth.verifyOutcome(outcome);
  if (!outcomeCheck.pass) throw new Error('research outcome invalid: ' + outcomeCheck.errors.join('; '));
  return outcome;
}

function oneHumanClaim(outcome, knowledge) {
  const matches = outcome.claims.filter(claim => claim.beneficiary === 'HUMAN'
    && claim.id === knowledge.knowledgeBinding.humanClaimId);
  if (matches.length !== 1) throw new Error('research outcome must contain the exact knowledge-frontier human claim');
  const claim = matches[0];
  if (claim.admittedVerdict !== 'NOT_RUN' || claim.routeStatus !== 'NOT_PROVEN' || claim.proofSurface !== 'NOT_RUN') {
    throw new Error('participation frontier requires the human-benefit claim to remain NOT_RUN and NOT_PROVEN');
  }
  return claim;
}

function buildParticipantPacket(input) {
  exactKeys(input, ['packetId', 'protocol', 'outcome'], 'participant packet input');
  const protocol = clone(input.protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('human-benefit protocol invalid: ' + protocolCheck.errors.join('; '));
  const outcome = clone(input.outcome);
  const outcomeCheck = Growth.verifyOutcome(outcome);
  if (!outcomeCheck.pass) throw new Error('participant packet outcome invalid: ' + outcomeCheck.errors.join('; '));
  const humanClaims = outcome.claims.filter(claim => claim.beneficiary === 'HUMAN' && claim.id === protocol.claim.id);
  if (humanClaims.length !== 1) throw new Error('participant packet protocol does not bind exactly one outcome human claim');
  if (outcome.capabilityId !== input.outcome.cycleReceipt.capabilityId) throw new Error('outcome capability and cycle capability mismatch');
  if (protocol.fixtureMode !== 'LIVE' || protocol.claim.targetScope !== 'NAMED_LOCAL_STEWARD') {
    throw new Error('participant packet requires a LIVE named-local-steward protocol');
  }
  const conditionLabels = new Map(protocol.conditions.map(condition => [condition.id, condition.label]));
  const protocolRef = reference(protocol, 'protocolId', 'protocolDigest', 'protocol');
  const packet = {
    schema: PARTICIPANT_PACKET_SCHEMA,
    version: VERSION,
    packetId: requiredText(input.packetId, 'packetId'),
    generatedAt: protocol.generatedAt,
    capabilityBinding: {
      capabilityId: outcome.capabilityId,
      humanClaimId: protocol.claim.id,
      protocolRef,
      cycleRef: reference(outcome.cycleReceipt, 'cycleId', 'receiptDigest', 'cycle'),
      currentOutcomeRef: reference(outcome, 'outcomeId', 'receiptDigest', 'outcome')
    },
    protocolRef: clone(protocolRef),
    status: 'READY_FOR_VOLUNTARY_HUMAN_SESSION',
    notices: [
      'Participation is optional. Stopping or withdrawing does not count as failure.',
      'The packet records only structured choices, confidence, confusion, elapsed milliseconds, effect and burden.',
      'Do not enter a name, email address, free-text comment, audio, video or screen recording.',
      'This one-person result can describe only the participating local steward.',
      'The condition roles and expected decisions are intentionally absent from this participant packet.',
      'The exact protocol reference must accompany an external response so responses cannot cross capability routes.'
    ],
    trials: protocol.trials.map(trial => ({
      trialId: trial.id,
      order: trial.order,
      conditionLabel: conditionLabels.get(trial.conditionId),
      prompt: trial.prompt,
      responseFields: {
        decision: ['CONTINUE', 'HOLD', 'UNSURE'],
        confidence: 'integer 1 to 5',
        confusion: ['NONE', 'SOME', 'BLOCKED'],
        elapsedMs: 'integer 0 to 3600000'
      }
    })),
    completionFields: {
      effect: ['HELPED', 'HARMED', 'NO_MEANINGFUL_DIFFERENCE', 'UNSURE'],
      burden: ['LOW', 'ACCEPTABLE', 'HIGH'],
      confidence: 'integer 1 to 5'
    },
    responseBoundary: {
      schema: 'axm.human-benefit-response-input/v1',
      exactProtocolRefRequired: true,
      externalToWorkshopRepository: true,
      structuredNoFreeText: true
    },
    outputBoundary: {
      writesAutomatically: false,
      sendsToNetwork: false,
      authenticatesHuman: false,
      createsHumanBenefitVerdict: false
    },
    packetDigest: null
  };
  const payload = clone(packet);
  delete payload.packetDigest;
  packet.packetDigest = sha256(payload);
  return packet;
}

function verifyParticipantPacket(packet, protocol, outcome) {
  const errors = [];
  try {
    if (!packet || packet.schema !== PARTICIPANT_PACKET_SCHEMA) throw new Error('participant packet schema mismatch');
    const rebuilt = buildParticipantPacket({ packetId: packet.packetId, protocol, outcome });
    if (stableStringify(rebuilt) !== stableStringify(packet)) throw new Error('participant packet content or digest mismatch');
    const serialized = stableStringify(packet);
    ['expectedDecision', '\"BASELINE\"', '\"CANDIDATE\"', 'artifactRef'].forEach(token => {
      if (serialized.includes(token)) throw new Error('participant packet leaks answer or condition role: ' + token);
    });
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function verifyReadinessDigest(readiness) {
  if (!readiness || readiness.schema !== HANDOFF_READINESS_SCHEMA) throw new Error('human handoff readiness schema mismatch');
  if (readiness.version !== VERSION || readiness.status !== 'TEST') throw new Error('human handoff readiness version or status mismatch');
  const payload = clone(readiness);
  const digest = payload.receiptDigest;
  delete payload.receiptDigest;
  if (digest !== sha256(payload)) throw new Error('human handoff readiness digest mismatch');
  if (readiness.state !== 'TECHNICAL_HANDOFF_READY_HUMAN_EVIDENCE_NOT_RUN') throw new Error('human handoff readiness state mismatch');
  if (!readiness.livePath || readiness.livePath.state !== 'NOT_RUN' || readiness.livePath.humanBenefitEstablished !== false) {
    throw new Error('human handoff live path must remain NOT_RUN');
  }
  const truth = readiness.truth || {};
  ['humanParticipationOccurred', 'liveSessionReceiptCreated', 'liveEvaluationCreated', 'liveJudgmentCreated',
    'admittedLiveBridgePackageCreated', 'groundedHumanOutcomeCreated', 'humanBenefitClaimed',
    'automaticExecution', 'automaticWrite', 'automaticInstall', 'automaticPermissionGrant',
    'automaticPromotion', 'automaticCanon', 'foundationMutation', 'modelWeightTrainingClaimed']
    .forEach(key => {
      if (truth[key] !== false) throw new Error('human handoff readiness truth mismatch: ' + key);
    });
  if (truth.readinessOnly !== true) throw new Error('human handoff readiness must remain readiness-only');
}

function buildParticipationFrontier(input) {
  exactKeys(input, [
    'participationFrontierId', 'generatedAt',
    'knowledgeFrontierReceipt', 'knowledgeFrontierInput',
    'humanHandoffReadiness', 'protocol', 'participantPacket', 'interventionLink'
  ], 'participation frontier input');
  const knowledge = clone(input.knowledgeFrontierReceipt);
  const knowledgeInput = clone(input.knowledgeFrontierInput);
  const knowledgeCheck = Knowledge.verifyKnowledgeFrontier(knowledge, knowledgeInput);
  if (!knowledgeCheck.pass) throw new Error('knowledge frontier invalid: ' + knowledgeCheck.errors.join('; '));
  const outcome = oneOutcome(knowledge, knowledgeInput);
  const humanClaim = oneHumanClaim(outcome, knowledge);

  const protocol = clone(input.protocol);
  const protocolCheck = Human.verifyProtocol(protocol);
  if (!protocolCheck.pass) throw new Error('human-benefit protocol invalid: ' + protocolCheck.errors.join('; '));
  if (protocol.claim.id !== humanClaim.id || protocol.claim.statement !== humanClaim.statement) {
    throw new Error('human-benefit protocol does not bind the exact research human claim');
  }
  if (protocol.claim.beneficiary !== 'HUMAN' || protocol.claim.targetScope !== 'NAMED_LOCAL_STEWARD' || protocol.fixtureMode !== 'LIVE') {
    throw new Error('research handoff protocol must be LIVE, HUMAN, and NAMED_LOCAL_STEWARD scoped');
  }

  const packet = clone(input.participantPacket);
  const packetCheck = verifyParticipantPacket(packet, protocol, outcome);
  if (!packetCheck.pass) throw new Error('participant packet invalid: ' + packetCheck.errors.join('; '));
  const link = clone(input.interventionLink);
  const linkCheck = Bridge.verifyInterventionLink(link, outcome.cycleReceipt, protocol);
  if (!linkCheck.pass) throw new Error('intervention link invalid: ' + linkCheck.errors.join('; '));

  const readiness = clone(input.humanHandoffReadiness);
  verifyReadinessDigest(readiness);
  const routes = readiness.routes.filter(route => route.capabilityId === outcome.capabilityId
    && route.humanClaimId === humanClaim.id);
  if (routes.length !== 1) throw new Error('human handoff readiness must expose exactly one research route');
  const route = routes[0];
  const expectedProtocolRef = reference(protocol, 'protocolId', 'protocolDigest', 'protocol');
  const expectedPacketRef = reference(packet, 'packetId', 'packetDigest', 'participant packet');
  const expectedLinkRef = reference(link, 'linkId', 'linkDigest', 'intervention link');
  const expectedCycleRef = reference(outcome.cycleReceipt, 'cycleId', 'receiptDigest', 'cycle');
  if (!sameReference(route.protocolRef, expectedProtocolRef)) throw new Error('readiness route protocol reference mismatch');
  if (!sameReference(route.packetRef, expectedPacketRef)) throw new Error('readiness route participant packet reference mismatch');
  if (!sameReference(route.interventionLinkRef, expectedLinkRef)) throw new Error('readiness route intervention link reference mismatch');
  if (!sameReference(route.cycleRef, expectedCycleRef)) throw new Error('readiness route cycle reference mismatch');
  if (!sameReference(packet.capabilityBinding.currentOutcomeRef, reference(outcome, 'outcomeId', 'receiptDigest', 'outcome'))) {
    throw new Error('participant packet does not bind the exact knowledge-frontier outcome');
  }
  if (route.ancestryMode !== link.ancestry.mode || !sameReference(route.capabilitySurfaceRef, link.ancestry.capabilitySurfaceRef)) {
    throw new Error('readiness route ancestry mismatch');
  }
  if (route.selectorVerification !== 'PASS' || route.protocolVerification !== 'PASS'
    || route.interventionLinkVerification !== 'PASS'
    || route.technicalHandoffState !== 'READY_FOR_OPTIONAL_LOCAL_TTY_INPUT'
    || route.humanEvidenceState !== 'NOT_RUN' || route.humanBenefitEstablished !== false) {
    throw new Error('research readiness route is not an optional NOT_RUN handoff');
  }

  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  [knowledge.generatedAt, readiness.generatedAt, protocol.generatedAt, packet.generatedAt, link.generatedAt]
    .forEach((sourceTime, index) => {
      if (new Date(sourceTime) > new Date(generatedAt)) throw new Error('participation frontier cannot predate source index ' + index);
    });

  const participationLane = {
    id: 'RESEARCH_VOLUNTARY_HUMAN_HANDOFF',
    state: 'READY_TO_REVIEW_OPTIONAL_LOCAL_SESSION',
    itemCount: packet.trials.length,
    capabilityId: outcome.capabilityId,
    humanClaimId: humanClaim.id,
    targetScope: protocol.claim.targetScope,
    protocolRef: expectedProtocolRef,
    participantPacketRef: expectedPacketRef,
    interventionLinkRef: expectedLinkRef,
    currentOutcomeRef: clone(packet.capabilityBinding.currentOutcomeRef),
    ancestryMode: link.ancestry.mode,
    humanEvidenceState: 'NOT_RUN',
    humanBenefitEstablished: false,
    reviewIsParticipation: false,
    packetReadinessIsHumanEvidence: false,
    participationStartedAutomatically: false,
    automatic: false
  };
  const receipt = {
    schema: PARTICIPATION_FRONTIER_SCHEMA,
    version: VERSION,
    participationFrontierId: requiredText(input.participationFrontierId, 'participationFrontierId'),
    generatedAt,
    status: 'TEST',
    scope: 'CURRENT_RESEARCH_KNOWLEDGE_AND_VOLUNTARY_HUMAN_HANDOFF',
    sourceRefs: {
      knowledgeFrontier: reference(knowledge, 'knowledgeFrontierId', 'knowledgeFrontierDigest', 'knowledge frontier'),
      groundedResearchOutcome: reference(outcome, 'outcomeId', 'receiptDigest', 'research outcome'),
      humanHandoffReadiness: reference(readiness, 'state', 'receiptDigest', 'human handoff readiness'),
      humanBenefitProtocol: expectedProtocolRef,
      participantPacket: expectedPacketRef,
      interventionLink: expectedLinkRef
    },
    counts: {
      priorLanes: knowledge.lanes.length,
      totalLanes: knowledge.lanes.length + 1,
      researchArtifacts: knowledge.counts.researchArtifacts,
      researchModelSeats: knowledge.counts.researchModelSeats,
      retainedResearchSignals: knowledge.counts.researchRetainedSignals,
      boundedResearchAiWorkflowPass: knowledge.counts.researchAiWorkflowPass,
      researchHumanBenefitPass: 0,
      availableOptionalHandoffs: 1,
      participantTrials: packet.trials.length,
      reviewCandidates: 1
    },
    lanes: [...clone(knowledge.lanes), participationLane],
    participationBinding: {
      knowledgeOutcomeMatchesPacket: true,
      outcomeCycleMatchesReadiness: true,
      humanClaimMatchesProtocol: true,
      protocolVerifiedNatively: true,
      participantPacketVerifiedByExactRebuild: true,
      interventionLinkVerifiedNatively: true,
      readinessRouteReferencesMatch: true,
      targetScope: protocol.claim.targetScope,
      responseInputSchema: packet.responseBoundary.schema
    },
    balance: {
      technicalKnowledgeIntakeReady: knowledge.balance.technicalKnowledgeIntakeReady,
      boundedResearchAiWorkflowEvidencePresent: knowledge.balance.boundedResearchAiWorkflowEvidencePresent,
      voluntaryResearchHumanHandoffReady: true,
      liveResearchHumanEvidencePresent: false,
      researchHumanBenefitEstablished: false,
      groundedGrowthForAiAndHumansEstablished: false,
      unresolvedEvidence: clone(knowledge.balance.unresolvedEvidence),
      resolvedTechnicalSeams: ['RESEARCH_VOLUNTARY_HANDOFF_EXACT_BINDING']
    },
    decision: {
      state: 'BOUNDED_PARTICIPATION_READINESS_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: knowledge.decision.reviewableActionCount + 1,
      optionalHandoffReviewCount: 1,
      currentBestAction: 'REVIEW_OPTIONAL_RESEARCH_HUMAN_HANDOFF_OR_WAIT',
      participationRequiresNewEvent: true,
      externalEventsThatMayChangeFrontier: Array.from(new Set([
        ...knowledge.decision.externalEventsThatMayChangeFrontier,
        'VOLUNTARY_RESEARCH_SESSION_OPT_IN',
        'VOLUNTARY_RESEARCH_SESSION_WITHDRAWAL',
        'ADMITTED_VOLUNTARY_RESEARCH_HUMAN_OUTCOME'
      ]))
    },
    truth: {
      knowledgeFrontierVerifiedByExactRebuild: true,
      humanHandoffReadinessDigestVerified: true,
      exactResearchOutcomeCrossBound: true,
      protocolVerifiedNatively: true,
      participantPacketVerifiedByExactRebuild: true,
      interventionLinkVerifiedNatively: true,
      reviewCandidateIsHumanBenefit: false,
      packetReadinessIsParticipation: false,
      packetReadinessIsHumanEvidence: false,
      aiWorkflowEvidenceIsHumanBenefit: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
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
    participationFrontierDigest: null
  };
  const payload = clone(receipt);
  delete payload.participationFrontierDigest;
  receipt.participationFrontierDigest = sha256(payload);
  return receipt;
}

function verifyParticipationFrontier(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== PARTICIPATION_FRONTIER_SCHEMA) throw new Error('participation frontier schema mismatch');
    if (receipt.version !== VERSION) throw new Error('participation frontier version mismatch');
    const rebuilt = buildParticipationFrontier(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('participation frontier content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  PARTICIPATION_FRONTIER_SCHEMA,
  PARTICIPANT_PACKET_SCHEMA,
  HANDOFF_READINESS_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  buildParticipantPacket,
  verifyParticipantPacket,
  buildParticipationFrontier,
  verifyParticipationFrontier
};

