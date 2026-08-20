#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Feedback = require('../grounded-growth-feedback/grounded-growth-feedback');
const DeterministicJson = require('../../tools/deterministic-json-core');

const HANDOFF_SCHEMA = 'axm.grounded-growth-direction-handoff/v1';
const VERSION = '0.1.0';
const GEI_VERSION = '0.1.0';
const ACTIONS = [
  'BUILD', 'REPAIR', 'RESEARCH', 'TEST', 'INTEGRATE', 'DOCUMENT',
  'SIMPLIFY', 'DEPRECATE', 'REUSE', 'WAIT_FOR_EVIDENCE'
];
const SELECTION_SOURCES = ['LOCAL_STEWARD_DECLARATION', 'SYNTHETIC_FIXTURE'];
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const GEI_ID = /^axm:(module|capability|interface|evidence|edge|need|research|direction|intervention|decision|event|packet):[a-z0-9][a-z0-9._-]{2,127}$/;
const COST = {
  WAIT_FOR_EVIDENCE: 0.02,
  DOCUMENT: 0.12,
  TEST: 0.22,
  RESEARCH: 0.28,
  REUSE: 0.2,
  SIMPLIFY: 0.3,
  INTEGRATE: 0.42,
  REPAIR: 0.48,
  DEPRECATE: 0.5,
  BUILD: 0.62
};
const RISK = {
  WAIT_FOR_EVIDENCE: 0.01,
  DOCUMENT: 0.02,
  TEST: 0.05,
  RESEARCH: 0.04,
  REUSE: 0.12,
  SIMPLIFY: 0.22,
  INTEGRATE: 0.3,
  REPAIR: 0.32,
  DEPRECATE: 0.45,
  BUILD: 0.38
};

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex');
}

function requiredText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be non-empty text');
  const text = value.trim();
  if (maximum && text.length > maximum) throw new Error(label + ' is too long');
  return text;
}

function timestamp(value, label) {
  const text = requiredText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return text;
}

function reference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be a reference');
  const ref = {
    id: requiredText(input.id, label + '.id', 180),
    schema: requiredText(input.schema, label + '.schema', 180),
    sha256: requiredText(input.sha256, label + '.sha256', 71)
  };
  if (!DIGEST.test(ref.sha256)) throw new Error(label + '.sha256 must be an exact digest');
  return ref;
}

function unique(values) {
  return Array.from(new Set(values));
}

function round(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

function normalizeSelection(input, index) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('selection ' + index + ' must be an object');
  const actionType = requiredText(input.actionType, 'selection actionType', 40);
  if (!ACTIONS.includes(actionType)) throw new Error('selection actionType is unsupported');
  const sourceKind = requiredText(input.sourceKind, 'selection sourceKind', 40);
  if (!SELECTION_SOURCES.includes(sourceKind)) throw new Error('selection sourceKind is unsupported');
  return {
    needId: requiredText(input.needId, 'selection needId', 160),
    actionType,
    sourceKind,
    sourceRef: reference(input.sourceRef, 'selection sourceRef'),
    rationale: requiredText(input.rationale, 'selection rationale', 1200)
  };
}

function priorityFor(need, actionType) {
  const problemSeverity = round(need.severity);
  const ecosystemReach = round(need.ecosystem_reach);
  const evidenceConfidence = round(need.confidence);
  const expectedUsefulness = problemSeverity;
  const unblockValue = need.blocked_work.length ? round(Math.max(problemSeverity, ecosystemReach)) : 0;
  const reusePotential = ecosystemReach;
  const strategicAlignment = need.improvement_dimensions.some((item) => [
    'HUMAN_ACCESSIBILITY', 'AI_ACCESSIBILITY', 'PRIVACY', 'SAFETY', 'PROOF_MATURITY'
  ].includes(item)) ? 1 : 0.75;
  const proofMaturityGain = need.improvement_dimensions.includes('PROOF_MATURITY') ? 1 : 0.5;
  const estimatedCost = COST[actionType];
  const regressionRisk = RISK[actionType];
  const dependencyRisk = round(Math.min(1, need.blocked_work.length * 0.1));
  const uncertaintyPenalty = round(1 - evidenceConfidence);
  const positives = [problemSeverity, ecosystemReach, evidenceConfidence, expectedUsefulness, unblockValue, reusePotential, strategicAlignment, proofMaturityGain];
  const negatives = [estimatedCost, regressionRisk, dependencyRisk, uncertaintyPenalty];
  const advisoryScore = round((positives.reduce((sum, value) => sum + value, 0) / positives.length) * 0.7 -
    (negatives.reduce((sum, value) => sum + value, 0) / negatives.length) * 0.3);
  return {
    problem_severity: problemSeverity,
    ecosystem_reach: ecosystemReach,
    evidence_confidence: evidenceConfidence,
    expected_usefulness: expectedUsefulness,
    unblock_value: unblockValue,
    reuse_potential: reusePotential,
    strategic_alignment: strategicAlignment,
    proof_maturity_gain: proofMaturityGain,
    estimated_cost: estimatedCost,
    regression_risk: regressionRisk,
    dependency_risk: dependencyRisk,
    uncertainty_penalty: uncertaintyPenalty,
    advisory_score: advisoryScore,
    formula_version: 'grounded-feedback-transparent-v1'
  };
}

function directionId(packetDigest, needId, actionType) {
  const identity = sha256({ packetDigest, needId, actionType }).slice(7, 31);
  return 'axm:direction:grounded-feedback-' + identity;
}

function evidencePlan(need, actionType) {
  const waiting = actionType === 'WAIT_FOR_EVIDENCE';
  return {
    state: 'NOT_RUN',
    technicalEffect: {
      required: !waiting,
      proofSurface: waiting ? 'SOURCE_NATIVE_EVIDENCE' : 'BASELINE_CHALLENGER_VERIFICATION',
      passCondition: waiting
        ? need.verification_method
        : 'A retained baseline and isolated challenger are compared using the need verification method; regressions remain visible.'
    },
    aiWorkflowBenefit: {
      requiredForSharedGrowthClaim: true,
      proofSurface: 'HELD_OUT_OR_REPRESENTATIVE_AI_WORKFLOW_EVALUATION',
      verdict: 'NOT_RUN'
    },
    humanBenefit: {
      requiredForSharedGrowthClaim: true,
      proofSurface: 'VOLUNTARY_HUMAN_NATIVE_OBSERVATION_OR_JUDGMENT',
      verdict: 'NOT_RUN',
      participationAutomatic: false,
      completionOrWithdrawalValid: true
    },
    sharedGrowthClaimAllowed: false,
    rule: 'A technical pass, AI-workflow pass, or human judgment cannot substitute for either of the other beneficiary claims.'
  };
}

function executionPlan(need, actionType) {
  if (actionType === 'WAIT_FOR_EVIDENCE') {
    return {
      state: 'HOLD_FOR_EVIDENCE',
      automatic: false,
      steps: [],
      stopCondition: 'Remain held until the named source-native evidence exists or an explicit steward decision changes the direction.'
    };
  }
  return {
    state: 'PROPOSAL_ONLY',
    automatic: false,
    steps: [
      'Retain and digest-bind the current baseline.',
      'Construct an isolated challenger without changing the accepted baseline.',
      'Run the declared verification method and preserve counterevidence.',
      'Route AI-workflow and voluntary human benefit claims to their native proof surfaces before any shared-growth claim.'
    ],
    stopCondition: 'Stop on missing authority, missing verifier, baseline drift, regression, withdrawal, or contradictory evidence.'
  };
}

function makeDirection(packet, need, actionType, selection) {
  const needDigest = sha256(need);
  const sole = !selection;
  const selectionRecord = sole ? {
    state: 'SOLE_COMPATIBLE_RESPONSE',
    sourceKind: 'DETERMINISTIC_CONTRACT',
    sourceRef: null,
    rationale: actionType + ' is the only response declared compatible by the verified feedback need; this does not accept or execute it.'
  } : {
    state: 'EXPLICIT_PROPOSAL_SELECTION',
    sourceKind: selection.sourceKind,
    sourceRef: selection.sourceRef,
    rationale: selection.rationale
  };
  const priority = priorityFor(need, actionType);
  const direction = {
    direction_id: directionId(packet.packetDigest, need.need_id, actionType),
    contract_version: GEI_VERSION,
    action_type: actionType,
    target_scope: unique(need.affected_scope.concat([need.need_id])),
    problem_statement: need.observed_problem,
    evidence: clone(need.evidence),
    rationale: selectionRecord.rationale + ' The direction remains a review-only hypothesis.',
    affected_modules: need.affected_scope.filter((id) => id.startsWith('axm:module:')),
    expected_value: priority.expected_usefulness,
    expected_reuse: priority.reuse_potential,
    unblock_value: priority.unblock_value,
    estimated_cost: priority.estimated_cost,
    regression_risk: priority.regression_risk,
    required_tools: [],
    required_knowledge: clone(need.required_knowledge),
    verification_plan: need.verification_method,
    confidence: priority.evidence_confidence,
    truth_state: 'HYPOTHESIS',
    priority_components: priority,
    steward_status: 'PENDING',
    execution_status: 'NOT_STARTED'
  };
  return {
    needId: need.need_id,
    needDigest,
    selection: selectionRecord,
    direction,
    directionDigest: sha256(direction),
    evidencePlan: evidencePlan(need, actionType),
    executionPlan: executionPlan(need, actionType)
  };
}

function buildHandoff(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('handoff input must be an object');
  const sourcePacket = clone(input.sourcePacket);
  const verified = Feedback.verifyPacket(sourcePacket);
  if (!verified.pass) throw new Error('source feedback packet is invalid: ' + verified.errors.join('; '));
  const selections = (input.selections || []).map(normalizeSelection);
  const selectionByNeed = new Map();
  for (const selection of selections) {
    if (selectionByNeed.has(selection.needId)) throw new Error('duplicate selection for ' + selection.needId);
    selectionByNeed.set(selection.needId, selection);
  }
  const knownNeeds = new Set(sourcePacket.candidateNeeds.map((need) => need.need_id));
  for (const selection of selections) {
    if (!knownNeeds.has(selection.needId)) throw new Error('selection references an unknown candidate need');
  }

  const directions = [];
  const holds = [];
  for (const need of sourcePacket.candidateNeeds) {
    const selection = selectionByNeed.get(need.need_id) || null;
    let actionType = null;
    if (selection) {
      if (!need.possible_responses.includes(selection.actionType)) throw new Error('selection action is not allowed by ' + need.need_id);
      actionType = selection.actionType;
    } else if (need.possible_responses.length === 1) {
      actionType = need.possible_responses[0];
    }
    if (!actionType) {
      holds.push({
        needId: need.need_id,
        needDigest: sha256(need),
        reason: 'MULTIPLE_RESPONSES_REQUIRE_EXPLICIT_SELECTION',
        allowedActions: clone(need.possible_responses)
      });
      continue;
    }
    directions.push(makeDirection(sourcePacket, need, actionType, selection));
  }

  const handoff = {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    handoffId: requiredText(input.handoffId, 'handoffId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    sourcePacket,
    selections,
    directions,
    holds,
    summary: {
      candidateNeedCount: sourcePacket.candidateNeeds.length,
      directionCount: directions.length,
      holdCount: holds.length,
      waitDirectionCount: directions.filter((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE').length,
      actionDirectionCount: directions.filter((item) => item.direction.action_type !== 'WAIT_FOR_EVIDENCE').length,
      acceptedDirectionCount: 0,
      executedDirectionCount: 0
    },
    truth: {
      sourceFeedbackVerifiedNatively: true,
      needDigestsBound: true,
      directionsAreHypotheses: true,
      deterministicPriorityIsAdvisoryOnly: true,
      explicitSelectionAuthenticated: false,
      stewardAcceptanceRecorded: false,
      humanParticipationRequired: false,
      voluntaryCompletionOrWithdrawalPreserved: true,
      sharedGrowthClaimed: false,
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
    handoffDigest: null
  };
  const digestPayload = clone(handoff);
  delete digestPayload.handoffDigest;
  handoff.handoffDigest = sha256(digestPayload);
  return handoff;
}

function verifyHandoff(handoff) {
  const errors = [];
  if (!handoff || handoff.schema !== HANDOFF_SCHEMA) return { pass: false, errors: ['direction handoff schema mismatch'] };
  if (handoff.version !== VERSION) errors.push('direction handoff version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildHandoff({
      handoffId: handoff.handoffId,
      generatedAt: handoff.generatedAt,
      sourcePacket: handoff.sourcePacket,
      selections: handoff.selections
    });
  } catch (error) {
    errors.push('direction handoff content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(handoff)) errors.push('direction handoff content or derived state mismatch');
    if (rebuilt.handoffDigest !== handoff.handoffDigest) errors.push('direction handoff digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  HANDOFF_SCHEMA,
  VERSION,
  GEI_VERSION,
  ACTIONS,
  SELECTION_SOURCES,
  stableStringify,
  sha256,
  priorityFor,
  buildHandoff,
  verifyHandoff
};
