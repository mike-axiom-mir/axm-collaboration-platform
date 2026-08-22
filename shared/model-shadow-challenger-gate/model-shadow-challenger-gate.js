#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Shadow = require('../model-shadow-continuity/model-shadow-continuity');
const Challenger = require('../grounded-growth-challenger-lab/grounded-growth-challenger-lab');
const DeterministicJson = require('../../tools/deterministic-json-core');

const PROPOSAL_SCHEMA = 'axm.model-shadow-challenger-proposal/v1';
const HANDOFF_SCHEMA = 'axm.model-shadow-challenger-reviewed-handoff/v1';
const REVIEW_ACTION_SCHEMA = 'axm.model-shadow-challenger-review-action/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RAW_DIGEST = /^[a-f0-9]{64}$/;
const INVALID_CLASSIFICATIONS = new Set([
  'HOLD_TASK_MISMATCH',
  'CONTEXT_CHANGED_COMPARISON_NOT_VALID',
  'IDENTITY_CHANGED_COMPARISON_NOT_VALID',
  'HOLD_NON_FORWARD_SEQUENCE'
]);

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  const bytes = typeof value === 'string' ? value : stableStringify(value);
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be non-empty text');
  const result = value.trim();
  if (maximum && result.length > maximum) throw new Error(label + ' is too long');
  return result;
}

function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function reference(input, label) {
  exactKeys(input, ['id', 'schema', 'sha256'], label);
  const result = {
    id: text(input.id, label + '.id', 180),
    schema: text(input.schema, label + '.schema', 180),
    sha256: text(input.sha256, label + '.sha256', 71)
  };
  if (!DIGEST.test(result.sha256)) throw new Error(label + '.sha256 must be an exact digest');
  return result;
}

function snapshotRef(snapshot) {
  return reference({ id: snapshot.snapshotId, schema: snapshot.schema, sha256: snapshot.snapshotDigest }, 'snapshot reference');
}

function observationInput(receipt) {
  return {
    observationId: receipt && receipt.observationId,
    observedAt: receipt && receipt.observedAt,
    baselineSnapshot: receipt && receipt.baselineSnapshot,
    candidateSnapshot: receipt && receipt.candidateSnapshot
  };
}

function verifyObservation(receipt) {
  const checked = Shadow.verifyObservation(observationInput(receipt), receipt);
  if (!checked.pass) throw new Error('model-shadow observation is invalid: ' + checked.errors.join('; '));
  return checked.rebuilt;
}

function proposalRoute(observation) {
  const classification = observation.decision.classification;
  if (!observation.decision.validComparison || INVALID_CLASSIFICATIONS.has(classification)) {
    return {
      state: 'HOLD_INVALID_COMPARISON',
      currentBestAction: 'REPAIR_COMPARISON_INPUTS_BEFORE_CHALLENGER_DESIGN',
      planAllowed: false
    };
  }
  if (classification === 'CRITICAL_DRIFT') {
    return {
      state: 'HOLD_CRITICAL_AUTHORITY_DRIFT',
      currentBestAction: 'REPAIR_OR_REFUSE_AUTHORITY_DRIFT_BEFORE_CHALLENGER_DESIGN',
      planAllowed: false
    };
  }
  if (classification === 'STRUCTURED_TRACE_MATCH') {
    return {
      state: 'NO_STRUCTURED_DRIFT_TO_CHALLENGE',
      currentBestAction: 'PRESERVE_MATCH_RECEIPT_AND_WAIT_FOR_NEW_INFORMATION',
      planAllowed: false
    };
  }
  if (classification !== 'DRIFT_DETECTED') throw new Error('unsupported model-shadow classification');
  if (observation.comparison.outputArtifactMatch) {
    return {
      state: 'HOLD_NO_DISTINCT_OUTPUT_ARTIFACTS',
      currentBestAction: 'SUPPLY_DISTINCT_DIGEST_BOUND_OUTPUT_ARTIFACTS_OR_KEEP_HELD',
      planAllowed: false
    };
  }
  return {
    state: 'CHALLENGER_PLAN_READY_FOR_EXPLICIT_REVIEW',
    currentBestAction: 'SUBMIT_EXACT_PLAN_DIGEST_FOR_DECLARED_HUMAN_REVIEW',
    planAllowed: true
  };
}

function buildReviewProjection(proposalId, observation, plan) {
  const sourceRef = 'model-shadow-challenger:' + proposalId + ':' + observation.receiptDigest;
  if (sourceRef.length > 300) throw new Error('review sourceRef exceeds Review Inbox bounds');
  return {
    schema: 'axm.model-shadow-challenger-review-projection/v1',
    kind: 'model-shadow-challenger-plan',
    title: 'Review bounded model-shadow challenger plan',
    sourceRef,
    artifactDigest: plan.planDigest.slice('sha256:'.length),
    summary: 'Ordinary structured drift has a distinct output artifact and an existing verified Grounded Growth direction. Review the exact held-out challenger plan; approval still grants no execution or adoption authority.',
    requiredSeats: 1,
    action: {
      schema: REVIEW_ACTION_SCHEMA,
      observationDigest: observation.receiptDigest,
      planDigest: plan.planDigest,
      directionDigest: plan.directionRef.sha256,
      executionOnApproval: false,
      automaticApply: false,
      applyAuthority: 'NONE'
    }
  };
}

function buildProposal(input) {
  exactKeys(input, [
    'proposalId', 'generatedAt', 'observation', 'directionHandoff', 'directionId',
    'caseManifestId', 'cases', 'budget'
  ], 'model-shadow challenger proposal input');
  const proposalId = text(input.proposalId, 'proposalId', 180);
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  const observation = verifyObservation(clone(input.observation));
  if (Date.parse(generatedAt) < Date.parse(observation.observedAt)) throw new Error('proposal cannot predate the model-shadow observation');
  const route = proposalRoute(observation);
  let plan = null;
  let reviewProjection = null;
  if (route.planAllowed) {
    plan = Challenger.buildPlan({
      planId: 'model-shadow-plan:' + proposalId,
      generatedAt,
      directionHandoff: clone(input.directionHandoff),
      directionId: text(input.directionId, 'directionId', 180),
      baselineRef: reference(observation.baselineSnapshot.outputRef, 'baseline outputRef'),
      challengerRef: reference(observation.candidateSnapshot.outputRef, 'candidate outputRef'),
      caseManifestId: text(input.caseManifestId, 'caseManifestId', 180),
      cases: clone(input.cases),
      budget: clone(input.budget)
    });
    reviewProjection = buildReviewProjection(proposalId, observation, plan);
  }
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    proposalId,
    generatedAt,
    status: STATUS,
    observationRef: {
      id: observation.observationId,
      schema: observation.schema,
      sha256: observation.receiptDigest
    },
    snapshotRefs: {
      baseline: snapshotRef(observation.baselineSnapshot),
      candidate: snapshotRef(observation.candidateSnapshot)
    },
    outputRefs: {
      baseline: reference(observation.baselineSnapshot.outputRef, 'baseline outputRef'),
      candidate: reference(observation.candidateSnapshot.outputRef, 'candidate outputRef')
    },
    classification: observation.decision.classification,
    state: route.state,
    currentBestAction: route.currentBestAction,
    plan,
    reviewProjection,
    truth: {
      observationVerifiedByExactRebuild: true,
      ordinaryDriftRequiredForPlan: true,
      criticalAuthorityDriftHeld: observation.decision.classification === 'CRITICAL_DRIFT',
      invalidComparisonHeld: !observation.decision.validComparison,
      distinctOutputArtifactsRequired: true,
      sourceDirectionInvented: false,
      challengerPlanVerifiedNatively: Boolean(plan),
      rawModelOutputEmbedded: false,
      privateContextEmbedded: false,
      reviewSubmitted: false,
      declaredHumanReviewRecorded: false,
      experimentExecuted: false,
      evaluationPerformed: false,
      adoptionAuthorized: false,
      humanBenefitProven: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    proposalDigest: null
  };
  const payload = clone(proposal);
  delete payload.proposalDigest;
  proposal.proposalDigest = sha256(payload);
  return proposal;
}

function verifyProposal(input, proposal) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!proposal || proposal.schema !== PROPOSAL_SCHEMA) throw new Error('proposal schema mismatch');
    rebuilt = buildProposal(input);
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(proposal)) errors.push('proposal content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

function normalizeReviewEvidence(item, expected) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('review item must be an object');
  if (item.schema !== 'axm.review-item/v1') throw new Error('review item schema mismatch');
  if (item.kind !== expected.kind || item.sourceRef !== expected.sourceRef) throw new Error('review item route mismatch');
  const artifactDigest = text(item.artifactDigest, 'review artifactDigest', 64).toLowerCase();
  if (!RAW_DIGEST.test(artifactDigest) || artifactDigest !== expected.artifactDigest) throw new Error('review item artifact digest mismatch');
  if (stableStringify(item.action) !== stableStringify(expected.action)) throw new Error('review item action mismatch');
  if (item.state !== 'APPROVED') throw new Error('review item is not approved');
  const requiredSeats = Number(item.requiredSeats);
  if (!Number.isInteger(requiredSeats) || requiredSeats < 1 || requiredSeats > 10) throw new Error('review item requiredSeats is invalid');
  if (!Array.isArray(item.votes)) throw new Error('review item votes are missing');
  const approvals = [];
  const uniqueActors = new Set();
  let conflictingVoteCount = 0;
  for (const vote of item.votes) {
    if (!vote || typeof vote !== 'object' || vote.artifactDigest !== artifactDigest) continue;
    const verdict = String(vote.verdict || '').toUpperCase();
    if (verdict === 'HOLD' || verdict === 'REJECT') conflictingVoteCount += 1;
    if (verdict !== 'APPROVE') continue;
    const actor = text(vote.actor, 'review vote actor', 120).toLowerCase();
    if (uniqueActors.has(actor)) continue;
    uniqueActors.add(actor);
    approvals.push({
      actorDigest: sha256('review-actor:' + actor),
      actorKind: text(vote.actorKind, 'review vote actorKind', 40).toLowerCase(),
      artifactDigest,
      at: timestamp(vote.at, 'review vote timestamp')
    });
  }
  if (conflictingVoteCount) throw new Error('review item contains a conflicting vote for the exact plan digest');
  if (approvals.length < requiredSeats) throw new Error('review item lacks its required distinct approvals');
  const declaredHumanApprovalCount = approvals.filter(itemValue => itemValue.actorKind === 'human').length;
  if (!declaredHumanApprovalCount) throw new Error('review item lacks a declared human approval seat');
  const proof = {
    schema: 'axm.model-shadow-challenger-review-evidence/v1',
    reviewItemId: text(item.id, 'review item id', 180),
    reviewItemSchema: item.schema,
    kind: item.kind,
    sourceRef: item.sourceRef,
    artifactDigest,
    state: item.state,
    requiredSeats,
    approvalCount: approvals.length,
    declaredHumanApprovalCount,
    approvals: approvals.sort((left, right) => left.actorDigest.localeCompare(right.actorDigest)),
    discussionIngested: false,
    voteNotesIngested: false,
    actorAuthenticationProvided: false
  };
  return {
    id: proof.reviewItemId,
    schema: proof.schema,
    sha256: sha256(proof),
    proof
  };
}

function buildReviewedHandoff(input) {
  exactKeys(input, ['handoffId', 'generatedAt', 'proposalInput', 'proposal', 'reviewItem'], 'reviewed handoff input');
  const proposalCheck = verifyProposal(clone(input.proposalInput), clone(input.proposal));
  if (!proposalCheck.pass) throw new Error('challenger proposal is invalid: ' + proposalCheck.errors.join('; '));
  const proposal = proposalCheck.rebuilt;
  if (proposal.state !== 'CHALLENGER_PLAN_READY_FOR_EXPLICIT_REVIEW' || !proposal.plan || !proposal.reviewProjection) {
    throw new Error('only a review-ready challenger plan can create a reviewed handoff');
  }
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  if (Date.parse(generatedAt) < Date.parse(proposal.generatedAt)) throw new Error('reviewed handoff cannot predate its proposal');
  const review = normalizeReviewEvidence(input.reviewItem, proposal.reviewProjection);
  const handoff = {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    handoffId: text(input.handoffId, 'handoffId', 180),
    generatedAt,
    status: STATUS,
    proposalRef: { id: proposal.proposalId, schema: proposal.schema, sha256: proposal.proposalDigest },
    observationRef: clone(proposal.observationRef),
    plan: clone(proposal.plan),
    reviewEvidenceRef: { id: review.id, schema: review.schema, sha256: review.sha256 },
    reviewEvidence: review.proof,
    state: 'DECLARED_HUMAN_REVIEW_RECORDED_EXECUTION_NOT_AUTHORIZED',
    nextGate: 'EXPLICIT_SHADOW_EXECUTION_DECISION_USING_EXISTING_CHALLENGER_PLAN',
    truth: {
      proposalVerifiedByExactRebuild: true,
      challengerPlanVerifiedNatively: Challenger.verifyPlan(proposal.plan).pass,
      reviewItemExactPlanDigestMatch: true,
      declaredHumanApprovalPresent: true,
      reviewActorAuthenticated: false,
      actualHumanParticipationProven: false,
      reviewDiscussionIngested: false,
      voteNotesIngested: false,
      rawModelOutputEmbedded: false,
      privateContextEmbedded: false,
      experimentExecuted: false,
      evaluationPerformed: false,
      executionAuthorized: false,
      adoptionAuthorized: false,
      humanBenefitProven: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    handoffDigest: null
  };
  const payload = clone(handoff);
  delete payload.handoffDigest;
  handoff.handoffDigest = sha256(payload);
  return handoff;
}

function verifyReviewedHandoff(input, handoff) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!handoff || handoff.schema !== HANDOFF_SCHEMA) throw new Error('reviewed handoff schema mismatch');
    rebuilt = buildReviewedHandoff(input);
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(handoff)) errors.push('reviewed handoff content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  PROPOSAL_SCHEMA,
  HANDOFF_SCHEMA,
  REVIEW_ACTION_SCHEMA,
  VERSION,
  STATUS,
  stableStringify,
  sha256,
  buildProposal,
  verifyProposal,
  buildReviewedHandoff,
  verifyReviewedHandoff
};
