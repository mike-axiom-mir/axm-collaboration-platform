'use strict';

const fs = require('fs');
const path = require('path');
const Episode = require('./session-episode');
const Frontier = require('../kernel/frontier-cell');

const ROOT = path.resolve(__dirname, '..');

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 1000);
}

function loadPolicy(file) {
  const target = path.resolve(file || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('automatic growth requires the Mirror training policy');
  if (policy.automaticPractice !== true) throw new Error('automatic practice is not enabled');
  if (policy.automaticTraining !== true || policy.automaticTrainingScope !== 'private-challenger-only') throw new Error('automatic training must remain private-challenger-only');
  if (policy.automaticCanonPromotion !== false || policy.automaticRuntimePromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('automatic practice refuses any policy that can promote canon, runtime, or authority');
  }
  const permission = policy.standingLearningPermission || {};
  if (!permission.policyId || !permission.grantedBy || !permission.statement || !Array.isArray(permission.scope) || !permission.scope.length) {
    throw new Error('standing learning permission is incomplete');
  }
  return { policy, file: target };
}

function approvePracticeEpisode(candidate, receipt, policyInput) {
  Episode.verify(candidate);
  if (!candidate.review || candidate.review.state !== 'CANDIDATE') throw new Error('automatic practice only accepts a fresh CANDIDATE');
  const loaded = policyInput && policyInput.policy ? policyInput : loadPolicy(policyInput);
  const policy = loaded.policy;
  const permission = policy.standingLearningPermission;
  receipt = receipt || {};

  if (candidate.source.provider !== 'axm-workshop-local' || candidate.source.model !== 'mirror-kernel') {
    throw new Error('automatic practice source is outside the standing local Workshop scope');
  }
  if (receipt.explicitSession !== true || receipt.expectedDecisionMatched !== true || receipt.outcomeVerified !== true) {
    throw new Error('automatic practice requires an explicit session, matched decision, and verified outcome');
  }
  if (Number(receipt.worldMutations) !== 0 || Number(receipt.networkCalls) !== 0 || receipt.runtimePointerChanged !== false) {
    throw new Error('automatic practice refuses mutation, network use, or runtime pointer changes');
  }
  const unexpected = Array.isArray(receipt.unexpectedSeams) ? receipt.unexpectedSeams.filter(Boolean) : [];
  if (unexpected.length) throw new Error(`automatic practice found unexpected seams: ${unexpected.join(', ')}`);

  const output = JSON.parse(JSON.stringify(candidate));
  output.review = {
    state: 'APPROVED',
    promoted: false,
    mode: 'standing-permission-policy',
    policyId: clean(permission.policyId, 200),
    reviewedBy: [`policy:${clean(permission.grantedBy, 120)}`],
    reviewedAt: clean(receipt.at, 80) || null,
    statement: clean(`Automatically admitted as bounded local practice under ${permission.policyId}. Verified behavior: ${receipt.behavior || 'expected decision matched'}. No world mutation, network call, runtime promotion, canon promotion, or authority growth occurred.`, 1000)
  };
  return output;
}

function proposeUnexpectedFrontier(candidate, receipt, policyInput) {
  Episode.verify(candidate);
  const loaded = policyInput && policyInput.policy ? policyInput : loadPolicy(policyInput);
  const permission = loaded.policy.standingLearningPermission;
  receipt = receipt || {};
  const unexpected = Array.isArray(receipt.unexpectedSeams) ? receipt.unexpectedSeams.filter(Boolean) : [];
  if (!unexpected.length) throw new Error('frontier routing requires at least one unexpected seam');
  if (candidate.source.provider !== 'axm-workshop-local' || candidate.source.model !== 'mirror-kernel') {
    throw new Error('frontier routing source is outside the standing local Workshop scope');
  }
  if (receipt.explicitSession !== true || receipt.outcomeVerified !== true) {
    throw new Error('frontier routing requires an explicit session and verified observation');
  }
  if (Number(receipt.worldMutations) !== 0 || Number(receipt.networkCalls) !== 0 || receipt.runtimePointerChanged !== false) {
    throw new Error('frontier routing refuses mutation, network use, or runtime pointer changes');
  }
  const unexpectedRows = unexpected.map((item, index) => typeof item === 'string'
    ? { id: item, statement: `Unexpected practice seam ${item}`, severity: 'medium', evidenceRefs: candidate.evidenceRefs }
    : Object.assign({ id: `unexpected-${index + 1}`, severity: 'medium', evidenceRefs: candidate.evidenceRefs }, item));
  const unexpectedIds = unexpectedRows.map(item => clean(item.id, 160) || 'unexpected-seam');
  return Frontier.inspect({
    subject: { id: candidate.episodeId, domain: 'workshop-practice', statement: candidate.goal },
    observations: candidate.observations.map((statement, index) => ({
      id: `episode-observation-${index + 1}`,
      domain: 'workshop-practice',
      perspective: 'SHARED',
      statement,
      patternTags: ['unexpected-practice-seam'],
      evidenceRef: candidate.evidenceRefs[index] || `episode://${candidate.episodeId}`
    })),
    unexpectedSeams: unexpectedRows,
    candidate: {
      id: `learn-${unexpectedIds.join('-')}`,
      statement: `Develop a testable capability for the unexpected Workshop seam family: ${unexpectedIds.join(', ')}.`,
      mechanism: 'unexpected-seam-to-curriculum-frontier',
      sourceRefs: [candidate.episodeId, permission.policyId]
    }
  });
}

module.exports = { loadPolicy, approvePracticeEpisode, proposeUnexpectedFrontier };
