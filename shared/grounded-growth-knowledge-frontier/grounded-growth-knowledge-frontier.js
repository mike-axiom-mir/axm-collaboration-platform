'use strict';

const crypto = require('crypto');
const Frontier = require('../grounded-growth-frontier-gate/grounded-growth-frontier-gate');
const Research = require('../research-contribution-intake/research-contribution-intake');
const Capsule = require('../portable-baseline-capsule/portable-baseline-capsule');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const DeterministicJson = require('../../tools/deterministic-json-core');

const KNOWLEDGE_FRONTIER_SCHEMA = 'axm.grounded-growth-knowledge-frontier-receipt/v1';
const VERSION = '0.1.0';

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(label + ' has unsupported field(s): ' + extra.join(', '));
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 180)) throw new Error(label + ' is too long');
  return result;
}

function timestamp(value, label) {
  const result = requiredText(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(label + ' is not a timestamp');
  return result;
}

function sourceRef(id, schema, digest) {
  return {
    id: requiredText(id, 'source id'),
    schema: requiredText(schema, 'source schema', 240),
    sha256: requiredText(digest, 'source digest', 80)
  };
}

function referenceEqual(left, right) {
  return !!left && !!right
    && left.id === right.id
    && left.schema === right.schema
    && left.sha256 === right.sha256;
}

function contentReferenceEqual(left, right) {
  return !!left && !!right
    && left.schema === right.schema
    && left.sha256 === right.sha256;
}

function sortedRefs(values) {
  return clone(values || []).map(value => ({ id: value.id, schema: value.schema, sha256: value.sha256 }))
    .sort((left, right) => (left.id + left.schema + left.sha256).localeCompare(right.id + right.schema + right.sha256));
}

function findResearchOutcome(portfolio, dispositionRef) {
  const matches = portfolio.outcomes.filter(outcome => outcome.capabilityId === 'simulation.run-envelope.verify'
    && contentReferenceEqual(outcome.interventionRef, dispositionRef)
    && outcome.claims.some(claim => claim.beneficiary === 'AI_WORKFLOW' && claim.proofSurface === 'AI_WORKFLOW_EVALUATION'));
  if (matches.length !== 1) throw new Error('portfolio must contain exactly one research AI-workflow outcome bound to the baseline disposition');
  return matches[0];
}

function oneClaim(outcome, beneficiary, label) {
  const claims = outcome.claims.filter(claim => claim.beneficiary === beneficiary);
  if (claims.length !== 1) throw new Error('research outcome must contain exactly one ' + label + ' claim');
  return claims[0];
}

function warningEvidenceCodes(warnings) {
  const mapping = {
    ARTIFACT_TO_SEAT_MAPPING_NOT_ESTABLISHED: 'RESEARCH_ARTIFACT_TO_MODEL_MAPPING_NATIVE_EVIDENCE',
    MODEL_IDENTITY_DISCLOSURE_GAP: 'RESEARCH_EXACT_MODEL_IDENTITY_EVIDENCE',
    PRIOR_OUTPUT_EXPOSURE_NOT_EXCLUDED: 'RESEARCH_PRIOR_OUTPUT_ISOLATION_EVIDENCE',
    CROSS_MODEL_INDEPENDENCE_NOT_ESTABLISHED: 'RESEARCH_CROSS_MODEL_INDEPENDENCE_EVIDENCE',
    SIGNAL_ATTRIBUTION_MISSING: 'RESEARCH_SIGNAL_ATTRIBUTION_EVIDENCE'
  };
  return Array.from(new Set((warnings || []).map(item => mapping[item.code] || ('RESEARCH_WARNING_' + item.code)))).sort();
}

function buildKnowledgeFrontier(input) {
  exactKeys(input, [
    'knowledgeFrontierId', 'generatedAt',
    'stewardshipFrontierReceipt', 'stewardshipFrontierInput',
    'researchContributionAssessment', 'baselineCapsule'
  ], 'knowledge frontier input');

  const stewardship = clone(input.stewardshipFrontierReceipt);
  const stewardshipInput = clone(input.stewardshipFrontierInput);
  const stewardshipCheck = Frontier.verifyStewardshipFrontier(stewardship, stewardshipInput);
  if (!stewardshipCheck.pass) throw new Error('stewardship frontier invalid: ' + stewardshipCheck.errors.join('; '));

  const assessment = clone(input.researchContributionAssessment);
  const assessmentCheck = Research.verifyAssessment(assessment);
  if (!assessmentCheck.pass) throw new Error('research contribution assessment invalid: ' + assessmentCheck.errors.join('; '));

  const baseline = clone(input.baselineCapsule);
  const baselineCheck = Capsule.verify(baseline);
  if (!baselineCheck.pass) throw new Error('portable baseline capsule invalid: ' + baselineCheck.errors.join('; '));

  const portfolio = stewardshipInput
    && stewardshipInput.evidenceFrontierInput
    && stewardshipInput.evidenceFrontierInput.frontierInput
    && stewardshipInput.evidenceFrontierInput.frontierInput.portfolio;
  const portfolioCheck = Growth.verifyPortfolio(portfolio);
  if (!portfolioCheck.pass) throw new Error('knowledge frontier portfolio invalid: ' + portfolioCheck.errors.join('; '));

  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  [stewardship.generatedAt, assessment.generatedAt, baseline.capturedAt, portfolio.generatedAt].forEach((sourceTime, index) => {
    if (new Date(sourceTime) > new Date(generatedAt)) throw new Error('knowledge frontier cannot predate source index ' + index);
  });

  const baselineRef = Capsule.capsuleReference(baseline);
  if (!referenceEqual(assessment.bundle.baselineRef, baselineRef)) throw new Error('research contribution assessment does not bind the supplied portable baseline');
  const assessmentArtifacts = sortedRefs(assessment.projection.newInformationRefs);
  const baselineArtifacts = sortedRefs(baseline.newInformationRefs);
  if (stableStringify(assessmentArtifacts) !== stableStringify(baselineArtifacts)) {
    throw new Error('research contribution artifact set does not match the portable baseline new-information set');
  }

  const dispositionExtension = (baseline.extensions || []).find(item => item.namespace === 'axm.5yff.research-disposition');
  if (!dispositionExtension || !dispositionExtension.extensionRef) throw new Error('portable baseline lacks the research disposition extension reference');
  const researchOutcome = findResearchOutcome(portfolio, dispositionExtension.extensionRef);
  const outcomeCheck = Growth.verifyOutcome(researchOutcome);
  if (!outcomeCheck.pass) throw new Error('research AI-workflow outcome invalid: ' + outcomeCheck.errors.join('; '));

  const systemClaim = oneClaim(researchOutcome, 'SHARED_SYSTEM', 'shared-system');
  const aiClaim = oneClaim(researchOutcome, 'AI_WORKFLOW', 'AI-workflow');
  const humanClaim = oneClaim(researchOutcome, 'HUMAN', 'human');
  if (systemClaim.admittedVerdict !== 'PASS' || systemClaim.routeStatus !== 'ADMITTED') throw new Error('research system effect is not admitted PASS');
  if (!referenceEqual(systemClaim.baselineRef, baselineRef)) throw new Error('research system effect does not bind the contribution baseline');
  if (aiClaim.admittedVerdict !== 'PASS' || aiClaim.routeStatus !== 'ADMITTED' || aiClaim.proofSurface !== 'AI_WORKFLOW_EVALUATION') {
    throw new Error('research AI-workflow benefit is not admitted on its native evaluation surface');
  }
  if (humanClaim.admittedVerdict !== 'NOT_RUN' || humanClaim.routeStatus !== 'NOT_PROVEN') {
    throw new Error('research human-benefit state must remain NOT_RUN and NOT_PROVEN');
  }

  const knowledgeLane = {
    id: 'RESEARCH_CONTRIBUTION_KNOWLEDGE',
    state: assessment.state,
    itemCount: assessment.counts.retainedSignals,
    artifactCount: assessment.counts.artifacts,
    modelSeatCount: assessment.counts.modelSeats,
    proposalCount: assessment.counts.proposals,
    warningCount: assessment.counts.warnings,
    holdCount: assessment.counts.holds,
    systemEffect: {
      outcomeId: researchOutcome.outcomeId,
      claimId: systemClaim.id,
      admittedVerdict: systemClaim.admittedVerdict,
      proofSurface: systemClaim.proofSurface
    },
    boundedAiWorkflowEvidence: {
      claimId: aiClaim.id,
      admittedVerdict: aiClaim.admittedVerdict,
      proofSurface: aiClaim.proofSurface
    },
    humanBenefitEvidence: {
      claimId: humanClaim.id,
      admittedVerdict: humanClaim.admittedVerdict,
      proofSurface: humanClaim.proofSurface
    },
    artifactToSeatMappingEstablished: assessment.attributionAssessment.artifactToSeatMappingEstablished,
    crossModelIndependenceEstablished: assessment.attributionAssessment.crossModelIndependenceEstablished,
    planningIsExecution: false,
    planningIsCandidatePresence: false,
    agreementIsProof: false,
    automatic: false
  };

  const researchHumanPass = humanClaim.admittedVerdict === 'PASS' ? 1 : 0;
  const researchAiPass = aiClaim.admittedVerdict === 'PASS' ? 1 : 0;
  const sharedGrowthEstablished = stewardship.balance.sharedGrowthClaimAllowed && researchHumanPass === 1 && researchAiPass === 1;
  const unresolvedEvidence = Array.from(new Set([
    ...stewardship.balance.unresolvedEvidence,
    ...warningEvidenceCodes(assessment.warnings),
    ...(researchHumanPass === 0 ? ['RESEARCH_HUMAN_BENEFIT_NATIVE_EVIDENCE'] : []),
    ...(assessment.counts.holds > 0 ? ['RESEARCH_CONTRIBUTION_EVIDENCE_REPAIR'] : [])
  ])).sort();

  const receipt = {
    schema: KNOWLEDGE_FRONTIER_SCHEMA,
    version: VERSION,
    knowledgeFrontierId: requiredText(input.knowledgeFrontierId, 'knowledgeFrontierId'),
    generatedAt,
    status: 'TEST',
    scope: 'CURRENT_GROUNDED_GROWTH_KNOWLEDGE_AI_AND_HUMAN_INPUTS',
    sourceRefs: {
      stewardshipFrontier: sourceRef(stewardship.stewardshipFrontierId, stewardship.schema, stewardship.stewardshipFrontierDigest),
      researchContributionAssessment: sourceRef(assessment.assessmentId, assessment.schema, assessment.receiptDigest),
      portableBaseline: baselineRef,
      groundedResearchOutcome: sourceRef(researchOutcome.outcomeId, researchOutcome.schema, researchOutcome.receiptDigest),
      researchDisposition: clone(dispositionExtension.extensionRef)
    },
    counts: {
      priorLanes: stewardship.lanes.length,
      totalLanes: stewardship.lanes.length + 1,
      portfolioCapabilityChains: stewardship.counts.portfolioCapabilityChains,
      portfolioAiWorkflowPass: stewardship.counts.portfolioAiWorkflowPass,
      portfolioHumanPass: stewardship.counts.portfolioHumanPass,
      researchArtifacts: assessment.counts.artifacts,
      researchModelSeats: assessment.counts.modelSeats,
      researchRetainedSignals: assessment.counts.retainedSignals,
      researchProposals: assessment.counts.proposals,
      researchWarnings: assessment.counts.warnings,
      researchHolds: assessment.counts.holds,
      researchAiWorkflowPass: researchAiPass,
      researchHumanPass
    },
    lanes: [...clone(stewardship.lanes), knowledgeLane],
    knowledgeBinding: {
      assessmentMatchesPortableBaseline: true,
      assessmentArtifactSetMatchesBaseline: true,
      baselineDispositionMatchesPortfolioOutcome: true,
      dispositionContentIdentityMatches: true,
      baselineDispositionId: dispositionExtension.extensionRef.id,
      outcomeDispositionId: researchOutcome.interventionRef.id,
      dispositionIdsAliasButDigestMatches: dispositionExtension.extensionRef.id !== researchOutcome.interventionRef.id,
      portfolioOutcomeVerifiedNatively: true,
      researchOutcomeId: researchOutcome.outcomeId,
      systemClaimId: systemClaim.id,
      aiWorkflowClaimId: aiClaim.id,
      humanClaimId: humanClaim.id
    },
    balance: {
      technicalKnowledgeIntakeReady: assessment.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING',
      boundedResearchAiWorkflowEvidencePresent: researchAiPass === 1,
      researchHumanBenefitEvidencePresent: researchHumanPass === 1,
      researchAttributionComplete: assessment.attributionAssessment.artifactToSeatMappingEstablished
        && assessment.attributionAssessment.exactModelIdentityEstablished
        && assessment.attributionAssessment.priorOutputIsolationEstablished,
      crossModelIndependenceEstablished: assessment.attributionAssessment.crossModelIndependenceEstablished,
      groundedGrowthForAiAndHumansEstablished: sharedGrowthEstablished,
      unresolvedEvidence
    },
    decision: {
      state: 'BOUNDED_KNOWLEDGE_TO_GROWTH_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: stewardship.decision.reviewableActionCount,
      currentBestAction: assessment.counts.holds > 0
        ? 'WAIT_FOR_RESEARCH_CONTRIBUTION_EVIDENCE_REPAIR'
        : stewardship.decision.currentBestAction,
      externalEventsThatMayChangeFrontier: Array.from(new Set([
        ...stewardship.decision.externalEventsThatMayChangeFrontier,
        'NEW_DIGEST_BOUND_RESEARCH_CONTRIBUTION',
        'NATIVE_EVIDENCE_FOR_RETAINED_RESEARCH_SIGNAL',
        'VOLUNTARY_HUMAN_OUTCOME_FOR_RESEARCH_WORKFLOW',
        'EXPLICIT_RESEARCH_DERIVED_CANDIDATE'
      ]))
    },
    truth: {
      stewardshipFrontierVerifiedByExactRebuild: true,
      researchContributionVerifiedByExactRebuild: true,
      portableBaselineVerifiedNatively: true,
      groundedGrowthPortfolioVerifiedNatively: true,
      researchArtifactsCrossBoundToBaseline: true,
      researchDispositionCrossBoundToOutcome: true,
      structuralIntakeIsEvidence: false,
      planningReadinessIsCandidatePresence: false,
      aiWorkflowEvidenceIsModelLearning: false,
      aiWorkflowEvidenceIsHumanBenefit: false,
      modelAgreementIsProof: false,
      sharedGrowthClaimed: sharedGrowthEstablished,
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
    knowledgeFrontierDigest: null
  };
  const payload = clone(receipt);
  delete payload.knowledgeFrontierDigest;
  receipt.knowledgeFrontierDigest = sha256(payload);
  return receipt;
}

function verifyKnowledgeFrontier(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== KNOWLEDGE_FRONTIER_SCHEMA) throw new Error('knowledge frontier schema mismatch');
    if (receipt.version !== VERSION) throw new Error('knowledge frontier version mismatch');
    const rebuilt = buildKnowledgeFrontier(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('knowledge frontier content or derived state mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  KNOWLEDGE_FRONTIER_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  buildKnowledgeFrontier,
  verifyKnowledgeFrontier
};
