'use strict';

const State = require('../kernel/state-language');
const StrategyModel = require('../learning/reasoning-strategy-model');

const ORGAN_ID = 'axm.mirror.organ/reasoning-strategy-private-challenger-v1';

function evidenceConflicts(evidence) {
  const present = new Set(evidence.map(item => item.id));
  const pairs = [];
  for (const item of evidence) for (const target of item.contradicts || []) {
    if (present.has(target)) pairs.push([item.id, target].sort().join('::'));
  }
  return Array.from(new Set(pairs)).map(pair => pair.split('::'));
}

function originate(input, model, options = {}) {
  StrategyModel.verify(model);
  const request = State.normalizeRequest(Object.assign({}, input, { schema: 'axm.mirror.reason/v1', actions: [] }));
  const problemState = {
    evidence: request.evidence,
    assumptions: Array.isArray(options.assumptions) ? options.assumptions : [],
    unknowns: request.unknowns,
    contradictions: evidenceConflicts(request.evidence),
    constraints: request.constraints,
    permissions: request.permissions
  };
  const features = StrategyModel.extractFeatures({
    problemState,
    pathSet: { profiles: [] },
    principleTrace: { constraints: request.constraints, permissions: request.permissions, candidates: [] }
  });
  const prediction = StrategyModel.predict(model, features);
  const maxCandidates = Math.max(2, Math.min(8, Number(options.maxCandidates) || 4));
  const observableStrategyTags = StrategyModel.observableStrategyTags(features);
  const observableSet = new Set(observableStrategyTags);
  const exactKey = observableStrategyTags.join('>then>');
  const compatible = prediction.sequenceRankings.filter(ranking =>
    ranking.strategyTags.length > 0 && ranking.strategyTags.every(tag => observableSet.has(tag)));
  const selectedRankings = observableStrategyTags.length
    ? compatible.sort((left, right) => (right.sequenceKey === exactKey ? 1 : 0) - (left.sequenceKey === exactKey ? 1 : 0) || right.support - left.support || left.sequenceKey.localeCompare(right.sequenceKey)).slice(0, maxCandidates)
    : [];
  const candidates = [];
  const pathProfiles = [];
  for (const ranking of selectedRankings) {
    const learned = model.sequences[ranking.sequenceKey];
    const prototype = learned && learned.prototype;
    if (!prototype) continue;
    const sequenceId = ranking.strategyTags.join('-then-');
    const actionId = `strategy-${sequenceId}`.slice(0, 120);
    candidates.push({
      id: actionId,
      kind: ['ask', 'observe', 'hold'].includes(prototype.kind) ? prototype.kind : 'ask',
      label: `Apply reviewable strategy sequence candidate: ${ranking.strategyTags.join(' then ')}`,
      requiredPermissions: [],
      supportingEvidence: [],
      preconditionEvidence: [],
      expectedEffects: ['Produce or request information that may close one reasoning seam.'],
      possibleSideEffects: ['The learned strategy may not transfer to this problem.'],
      reversible: true,
      recovery: 'No world mutation occurs; preserve the failed proposal and select another path.',
      risk: 'low'
    });
    pathProfiles.push({
      actionId,
      pathId: `learned-path-${sequenceId}`.slice(0, 120),
      approach: prototype.approach,
      requiredEvidence: [],
      requiredPermissions: [],
      toolRequest: prototype.toolRequestRequired ? {
        tool: 'minimum-required-external-tool',
        scope: 'scope must be named by an external permission gate',
        reason: 'The learned strategy predicts that current external evidence is required.',
        requiredPermission: null
      } : null,
      estimatedCost: prototype.estimatedCost,
      informationValue: prototype.informationValue,
      reversible: true,
      failureConditions: prototype.failureConditions,
      strategyTags: ranking.strategyTags
    });
  }
  const output = {
    schema: 'axm.mirror.reasoning-strategy-candidate-set/v1',
    candidateSetId: `reasoning-strategies-${State.digest({ modelDigest: model.modelDigest, requestId: request.requestId, features })}`,
    organ: {
      id: ORGAN_ID,
      status: 'PRIVATE_CHALLENGER',
      learnedModelId: model.modelId,
      learnedModelDigest: model.modelDigest,
      toolAuthority: false,
      worldMutationAuthority: false,
      runtimePromotionAuthority: false
    },
    requestId: request.requestId,
    structuralFeatures: features,
    observableStrategyTags,
    prediction,
    candidates,
    pathProfiles,
    abstention: candidates.length ? null : {
      state: 'HOLD_UNDERSPECIFIED',
      reason: observableStrategyTags.length
        ? 'No learned non-mutating sequence covers the observable structural obligations.'
        : 'No observable structural obligation supports choosing a learned strategy without guessing.'
    },
    authority: {
      proposalsOnly: true,
      toolUse: false,
      permissionGrant: false,
      worldAction: false,
      memoryWrite: false,
      trainingAdmission: false,
      runtimePromotion: false
    },
    boundary: 'This private learned organ may originate only non-mutating epistemic candidates that cover observable structural obligations. Underspecified state produces HOLD rather than a learned guess. The Principle and Seam cells still gate every proposal.'
  };
  output.candidateSetDigest = State.digest(output, 64);
  return output;
}

module.exports = { ORGAN_ID, originate };
