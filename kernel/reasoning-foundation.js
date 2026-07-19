'use strict';

const Principle = require('./principle-cell');
const Seam = require('./seam-cell');
const State = require('./state-language');
const StrategyModel = require('../learning/reasoning-strategy-model');
const ReasoningStrategyOrgan = require('../organs/reasoning-strategy-organ');
const ReasoningMemoryGuidanceOrgan = require('../organs/reasoning-memory-guidance-organ');
const ReasoningStructuralFeatureOrgan = require('../organs/reasoning-structural-feature-organ');

const CELL_ID = 'axm.mirror.reasoning-foundation/seed-0';
const SCHEMA = 'axm.mirror.reasoning-session/v1';
const VERIFY_RESULTS = new Set(['PASS', 'HOLD', 'FAIL', 'CONFLICT']);
const OUTCOME_RESULTS = new Set(['PASS', 'HOLD', 'FAIL', 'CONFLICT']);
const COST = Object.freeze({ LOW: 3, MEDIUM: 2, HIGH: 1, UNKNOWN: 0 });
const RISK_SCORE = Object.freeze({ low: 3, medium: 2, high: 1, severe: 0 });
const FORBIDDEN_REASONING_KEYS = new Set([
  'chainofthought', 'chain_of_thought', 'hiddenreasoning', 'hidden_reasoning',
  'privatereasoning', 'private_reasoning', 'scratchpad', 'internalmonologue', 'internal_monologue'
]);

function clean(value, max = 4000) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim().slice(0, max);
}

function id(value, fallback) {
  const result = clean(value, 120).replace(/[^a-zA-Z0-9._:/-]/g, '-').replace(/-+/g, '-');
  return result || fallback;
}

function list(value, max = 256) { return Array.isArray(value) ? value.slice(0, max) : []; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(value, max = 256) { return Array.from(new Set(list(value, max).map(item => id(item, '')).filter(Boolean))); }
function featureUnion(...groups) { return Array.from(new Set(groups.flatMap(group => Array.isArray(group) ? group : []).filter(item => typeof item === 'string' && item))).sort(); }
function clamp(value, low, high) { return Math.max(low, Math.min(high, Number(value) || 0)); }

function rejectPrivateReasoning(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectPrivateReasoning(item, trail.concat(String(index))));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[- ]/g, '_');
    if (FORBIDDEN_REASONING_KEYS.has(normalized)) {
      throw new Error(`private hidden reasoning field is refused at ${trail.concat(key).join('.')}`);
    }
    rejectPrivateReasoning(child, trail.concat(key));
  }
}

function normalizeCoreInput(input) {
  const allowed = new Set([
    'schema', 'requestId', 'sessionId', 'actor', 'goal', 'evidence', 'unknowns',
    'assumptions', 'constraints', 'permissions', 'actions', 'budget',
    'decomposition', 'pathProfiles', 'verificationReceipts', 'outcome'
  ]);
  const unexpected = Object.keys(input).filter(key => !allowed.has(key));
  if (unexpected.length) throw new Error(`unknown critical reasoning-session fields: ${unexpected.join(', ')}`);
  if (input.schema && ![SCHEMA, 'axm.mirror.reason/v1'].includes(input.schema)) {
    throw new Error(`unsupported reasoning-session schema: ${clean(input.schema, 120)}`);
  }
  return {
    schema: 'axm.mirror.reason/v1',
    requestId: input.requestId,
    sessionId: input.sessionId,
    actor: input.actor,
    goal: input.goal,
    evidence: input.evidence,
    unknowns: input.unknowns,
    constraints: input.constraints,
    permissions: input.permissions,
    actions: input.actions,
    budget: input.budget
  };
}

function normalizeAssumptions(value, evidenceIds) {
  return list(value, 128).map((item, index) => {
    item = item && typeof item === 'object' ? item : { statement: item };
    const statement = clean(item.statement || item.value, 1000);
    if (!statement) throw new Error(`assumptions[${index}] requires a statement`);
    const evidenceRefs = unique(item.evidenceRefs || item.evidence_refs, 128);
    return {
      id: id(item.id, `assumption-${index + 1}`),
      statement,
      status: ['OPEN', 'SUPPORTED', 'REFUTED'].includes(item.status) ? item.status : 'OPEN',
      evidenceRefs,
      missingEvidenceRefs: evidenceRefs.filter(ref => !evidenceIds.has(ref))
    };
  });
}

function normalizeDecomposition(value, request) {
  let rows = list(value, 128);
  if (!rows.length) {
    rows = ((request.epistemic && request.epistemic.unknowns) || []).map(item => ({
      id: `question-${item.id}`,
      question: item.question,
      dependsOn: [],
      cheapestCheck: item.blocking
        ? 'Obtain one attributed observation or test that directly answers this blocking unknown.'
        : 'Compare one attributed observation with the current interpretation.',
      status: 'OPEN',
      answerEvidenceRefs: []
    }));
  }
  if (!rows.length) rows = [{
    id: 'question-compare-paths',
    question: `Which bounded path best advances the goal: ${request.goal.statement}`,
    dependsOn: [],
    cheapestCheck: 'Compare supplied candidates by evidence, permissions, reversibility, risk, cost, and disconfirming checks.',
    status: 'OPEN',
    answerEvidenceRefs: []
  }];
  return rows.map((item, index) => {
    item = item && typeof item === 'object' ? item : { question: item };
    const question = clean(item.question || item.statement, 1200);
    if (!question) throw new Error(`decomposition[${index}] requires a question`);
    return {
      id: id(item.id || item.questionId || item.question_id, `question-${index + 1}`),
      question,
      dependsOn: unique(item.dependsOn || item.depends_on, 64),
      cheapestCheck: clean(item.cheapestCheck || item.cheapest_check, 1200) || 'No bounded check supplied yet.',
      status: ['OPEN', 'ANSWERED', 'BLOCKED'].includes(item.status) ? item.status : 'OPEN',
      answerEvidenceRefs: unique(item.answerEvidenceRefs || item.answer_evidence_refs, 128)
    };
  });
}

function dependencyIssues(questions) {
  const ids = new Set(questions.map(item => item.id));
  const missing = [];
  for (const question of questions) {
    for (const dependency of question.dependsOn) if (!ids.has(dependency)) missing.push({ questionId: question.id, dependency });
  }
  const visiting = new Set();
  const visited = new Set();
  let cycle = false;
  const byId = new Map(questions.map(item => [item.id, item]));
  function visit(questionId) {
    if (visiting.has(questionId)) { cycle = true; return; }
    if (visited.has(questionId) || !byId.has(questionId)) return;
    visiting.add(questionId);
    for (const dependency of byId.get(questionId).dependsOn) visit(dependency);
    visiting.delete(questionId);
    visited.add(questionId);
  }
  questions.forEach(item => visit(item.id));
  return { missing, cycle };
}

function normalizeToolRequest(value) {
  if (!value || typeof value !== 'object') return null;
  const tool = clean(value.tool || value.name, 120);
  if (!tool) return null;
  return {
    tool,
    scope: clean(value.scope, 500) || 'scope-not-supplied',
    reason: clean(value.reason, 1000) || 'reason-not-supplied',
    requiredPermission: id(value.requiredPermission || value.required_permission, '') || null,
    authorityGranted: false
  };
}

function normalizePathProfiles(value, actions) {
  const supplied = new Map();
  for (const item of list(value, 128)) {
    if (!item || typeof item !== 'object') continue;
    const actionId = id(item.actionId || item.action_id, '');
    if (!actionId) throw new Error('every path profile requires actionId');
    if (supplied.has(actionId)) throw new Error(`duplicate path profile for action ${actionId}`);
    supplied.set(actionId, item);
  }
  return actions.map((action, index) => {
    const item = supplied.get(action.id) || {};
    return {
      pathId: id(item.pathId || item.path_id, `path-${action.id}`),
      actionId: action.id,
      approach: clean(item.approach, 1600) || action.label,
      questionIds: unique(item.questionIds || item.question_ids, 128),
      requiredEvidence: unique(item.requiredEvidence || item.required_evidence || action.preconditionEvidence, 256),
      requiredPermissions: unique(item.requiredPermissions || item.required_permissions || action.requiredPermissions, 128),
      toolRequest: normalizeToolRequest(item.toolRequest || item.tool_request),
      estimatedCost: Object.prototype.hasOwnProperty.call(COST, item.estimatedCost) ? item.estimatedCost : 'UNKNOWN',
      informationValue: clamp(item.informationValue == null ? 0.5 : item.informationValue, 0, 1),
      reversible: item.reversible == null ? action.reversible : item.reversible === true,
      failureConditions: list(item.failureConditions || item.failure_conditions, 64).map(row => clean(row, 1000)).filter(Boolean),
      strategyTags: unique(item.strategyTags || item.strategy_tags, 64).map(row => row.toLowerCase()),
      source: supplied.has(action.id) ? 'SUPPLIED_PROFILE' : 'DERIVED_FROM_ACTION',
      inputIndex: index
    };
  });
}

function normalizeVerificationReceipts(value, actionIds, evidenceIds) {
  return list(value, 256).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`verificationReceipts[${index}] must be an object`);
    const result = clean(item.result, 20).toUpperCase();
    if (!VERIFY_RESULTS.has(result)) throw new Error(`verificationReceipts[${index}] has unknown result ${result || '(missing)'}`);
    const actionId = id(item.actionId || item.action_id, '');
    if (actionId && !actionIds.has(actionId)) throw new Error(`verification receipt references unknown action ${actionId}`);
    const claim = clean(item.claim, 1600);
    if (!claim) throw new Error(`verificationReceipts[${index}] requires a claim`);
    const evidenceRefs = unique(item.evidenceRefs || item.evidence_refs, 256);
    const record = {
      schema: 'axm.mirror.reasoning-verification/v1',
      id: id(item.id, `verification-${index + 1}`),
      actionId: actionId || null,
      claim,
      evidenceRefs,
      method: clean(item.method, 1000) || 'method-not-supplied',
      result,
      limitations: list(item.limitations, 64).map(row => clean(row, 1000)).filter(Boolean),
      missingEvidenceRefs: evidenceRefs.filter(ref => !evidenceIds.has(ref)),
      source: 'SUPPLIED_RECEIPT'
    };
    record.receiptDigest = State.digest(record, 64);
    return record;
  });
}

function verificationStatus(receipts, actionId) {
  const rows = receipts.filter(item => !item.actionId || item.actionId === actionId);
  if (rows.some(item => item.result === 'CONFLICT')) return 'CONFLICT';
  if (rows.some(item => item.result === 'FAIL')) return 'FAIL';
  if (rows.some(item => item.result === 'HOLD' || item.missingEvidenceRefs.length)) return 'HOLD';
  if (rows.some(item => item.result === 'PASS')) return 'PASS';
  return 'UNTESTED';
}

function comparisonScore(evaluation, profile, verifyStatus, evidenceIds, strategyPrediction, memoryGuidance) {
  const action = evaluation.action;
  const required = Array.from(new Set(profile.requiredEvidence.concat(action.preconditionEvidence || [])));
  const coverage = required.length ? required.filter(ref => evidenceIds.has(ref)).length / required.length : 1;
  const kindPenalty = action.kind === 'hold' ? -120 : 0;
  const gate = evaluation.value === 1 ? 100 : evaluation.value === 0 ? 20 : -100;
  const verify = verifyStatus === 'PASS' ? 12 : verifyStatus === 'UNTESTED' ? 0 : verifyStatus === 'HOLD' ? -35 : -140;
  const strategySupport = strategyPrediction ? Math.min(1, StrategyModel.supportForTags(strategyPrediction, profile.strategyTags)) : 0;
  const sequenceSupport = strategyPrediction ? StrategyModel.supportForSequence(strategyPrediction, profile.strategyTags) : 0;
  const strategyBonus = strategySupport * 20 + sequenceSupport * 40;
  const observableTags = strategyPrediction ? StrategyModel.observableStrategyTags(strategyPrediction.features) : [];
  const covered = observableTags.length ? observableTags.filter(tag => profile.strategyTags.includes(tag)).length / observableTags.length : 0;
  const exactObservableSequence = observableTags.length > 0 && observableTags.length === profile.strategyTags.length && observableTags.every((tag, index) => profile.strategyTags[index] === tag);
  const obligationBonus = covered * 50 + (exactObservableSequence ? 30 : 0);
  const memoryAdjustment = memoryGuidance ? Number(memoryGuidance.adjustment) || 0 : 0;
  return Number((gate + kindPenalty + verify + profile.informationValue * 10 + coverage * 6 +
    (profile.reversible ? 5 : 0) + COST[profile.estimatedCost] + RISK_SCORE[action.risk] + strategyBonus + obligationBonus + memoryAdjustment).toFixed(4));
}

function comparePaths(trace, profiles, receipts, evidenceIds, strategyPrediction, memoryGuidance) {
  const byProfile = new Map(profiles.map(item => [item.actionId, item]));
  const memoryByAction = new Map((memoryGuidance && memoryGuidance.paths || []).map(item => [item.actionId, item]));
  return trace.candidates.map(evaluation => {
    const profile = byProfile.get(evaluation.action.id);
    const memory = memoryByAction.get(evaluation.action.id) || null;
    const verifyStatus = verificationStatus(receipts, evaluation.action.id);
    const missingEvidence = profile.requiredEvidence.filter(ref => !evidenceIds.has(ref));
    const missingPermissions = profile.requiredPermissions.filter(permission => !trace.permissions.includes(permission));
    const strategySupport = strategyPrediction ? Math.min(1, StrategyModel.supportForTags(strategyPrediction, profile.strategyTags)) : 0;
    const sequenceSupport = strategyPrediction ? StrategyModel.supportForSequence(strategyPrediction, profile.strategyTags) : 0;
    const observableTags = strategyPrediction ? StrategyModel.observableStrategyTags(strategyPrediction.features) : [];
    const structuralObligationCoverage = observableTags.length ? observableTags.filter(tag => profile.strategyTags.includes(tag)).length / observableTags.length : 0;
    const exactObservableSequence = observableTags.length > 0 && observableTags.length === profile.strategyTags.length && observableTags.every((tag, index) => profile.strategyTags[index] === tag);
    const eligible = evaluation.value === 1 && evaluation.action.kind !== 'hold' &&
      !['FAIL', 'CONFLICT', 'HOLD'].includes(verifyStatus) && !missingEvidence.length && !missingPermissions.length;
    const comparison = {
      pathId: profile.pathId,
      actionId: evaluation.action.id,
      actionKind: evaluation.action.kind,
      approach: profile.approach,
      gateValue: evaluation.value,
      verificationStatus: verifyStatus,
      missingEvidence,
      missingPermissions,
      toolRequest: profile.toolRequest,
      estimatedCost: profile.estimatedCost,
      informationValue: profile.informationValue,
      reversible: profile.reversible,
      failureConditions: profile.failureConditions,
      strategyTags: profile.strategyTags,
      learnedStrategySupport: Number(strategySupport.toFixed(8)),
      learnedSequenceSupport: Number(sequenceSupport.toFixed(8)),
      learnedStrategyBonus: Number((strategySupport * 20 + sequenceSupport * 40).toFixed(4)),
      observableStrategyTags: observableTags,
      structuralObligationCoverage: Number(structuralObligationCoverage.toFixed(8)),
      exactObservableSequence,
      structuralObligationBonus: Number((structuralObligationCoverage * 50 + (exactObservableSequence ? 30 : 0)).toFixed(4)),
      eligible,
      score: comparisonScore(evaluation, profile, verifyStatus, evidenceIds, strategyPrediction, memory),
      scoreBoundary: 'Operational path-ordering heuristic, not a probability, intelligence score, or truth claim.'
    };
    if (memory) {
      comparison.memoryGuidanceState = memory.state;
      comparison.memoryGuidanceAdjustment = memory.adjustment;
      comparison.memoryGuidanceEvidenceSufficient = memory.evidenceSufficient;
      comparison.memoryGuidanceId = memoryGuidance.guidanceId;
    }
    return comparison;
  }).sort((left, right) => right.score - left.score || left.actionId.localeCompare(right.actionId));
}

function conflicts(evidence) {
  const present = new Set(evidence.map(item => item.id));
  const pairs = [];
  for (const item of evidence) for (const target of item.contradicts || []) {
    if (present.has(target)) pairs.push([item.id, target].sort().join('::'));
  }
  return Array.from(new Set(pairs)).map(pair => pair.split('::'));
}

function makeSeam(idValue, severity, statement, evidenceRefs, repair) {
  return {
    id: idValue,
    severity,
    status: 'OPEN',
    statement,
    evidenceRefs: Array.from(new Set((evidenceRefs || []).filter(Boolean))),
    cheapestDisconfirmingCheck: repair
  };
}

function buildSeams(request, assumptions, questions, dependency, profiles, receipts, comparisons, evidenceConflicts, selected) {
  const seams = [];
  const blocking = ((request.epistemic && request.epistemic.unknowns) || []).filter(item => item.blocking);
  if (blocking.length) seams.push(makeSeam('blocking-unknowns', 'high', `${blocking.length} blocking unknown(s) remain open.`, blocking.map(item => item.id), 'Answer the first dependency-ordered blocking unknown with attributed evidence, or retain HOLD.'));
  if (evidenceConflicts.length) seams.push(makeSeam('unresolved-contradictions', 'high', `${evidenceConflicts.length} evidence contradiction(s) remain visible.`, evidenceConflicts.flat(), 'Run a check that discriminates between the conflicting records without deleting either.'));
  const missingAssumptionRefs = assumptions.flatMap(item => item.missingEvidenceRefs);
  if (missingAssumptionRefs.length) seams.push(makeSeam('assumption-lineage-missing', 'medium', 'One or more assumptions cite evidence that is not present.', missingAssumptionRefs, 'Supply the cited records or keep the assumptions explicitly unsupported.'));
  if (dependency.missing.length) seams.push(makeSeam('decomposition-dependency-missing', 'high', 'The decomposition refers to a question that is not present.', dependency.missing.map(item => `${item.questionId}->${item.dependency}`), 'Repair the dependency graph and replay the decomposition.'));
  if (dependency.cycle) seams.push(makeSeam('decomposition-cycle', 'high', 'The decomposition contains a circular dependency.', questions.map(item => item.id), 'Break the cycle at the cheapest independently observable question.'));
  const activeProfiles = profiles.filter((profile, index) => comparisons.find(item => item.actionId === profile.actionId && item.actionKind !== 'hold' && item.gateValue >= 0) && index < 128);
  if (!activeProfiles.length) seams.push(makeSeam('candidate-path-missing', 'high', 'No non-hold bounded candidate path exists.', [], 'Originate at least one proposal without granting it execution authority.'));
  else if (activeProfiles.length < 2) seams.push(makeSeam('independent-path-missing', 'medium', 'Fewer than two potentially viable paths were available for comparison.', activeProfiles.map(item => item.pathId), 'Supply a materially different alternative or explicitly justify why only HOLD is safe.'));
  const approaches = activeProfiles.map(item => item.approach.toLowerCase().replace(/\s+/g, ' ').trim());
  if (approaches.length > 1 && new Set(approaches).size < approaches.length) seams.push(makeSeam('candidate-paths-not-distinct', 'medium', 'Two or more candidate paths repeat the same approach.', activeProfiles.map(item => item.pathId), 'Propose an alternative that changes the tested assumption, evidence source, or recovery route.'));
  const missingVerificationRefs = receipts.flatMap(item => item.missingEvidenceRefs);
  if (missingVerificationRefs.length) seams.push(makeSeam('verification-lineage-missing', 'high', 'A verification receipt cites evidence that is not present.', missingVerificationRefs, 'Attach the exact evidence record and verify its digest before using the receipt.'));
  if (!selected) seams.push(makeSeam('supported-path-missing', 'high', 'No supplied path passed the current evidence, permission, risk, and verification gates.', comparisons.map(item => item.pathId), 'Repair the highest-information held path or retain HOLD.'));
  if (selected && selected.verificationStatus === 'UNTESTED') seams.push(makeSeam('selected-path-unverified', 'medium', 'The selected bounded path has no independent verification receipt yet.', [selected.pathId], 'Run the path\'s cheapest disconfirming check before claiming an outcome.'));
  if (selected && selected.toolRequest) seams.push(makeSeam('external-tool-gate-required', 'medium', 'The selected path requests a tool, but the Reasoning Foundation cannot grant or use it.', [selected.pathId], 'Request the named tool and exact scope from an external permission gate; return its receipt as evidence.'));
  return seams;
}

function normalizeOutcome(value, evidenceIds) {
  if (!value || typeof value !== 'object') return null;
  const result = clean(value.result, 20).toUpperCase();
  if (!OUTCOME_RESULTS.has(result)) throw new Error(`outcome has unknown result ${result || '(missing)'}`);
  const evidenceRefs = unique(value.evidenceRefs || value.evidence_refs, 256);
  const transferEvidenceRefs = unique(value.transferEvidenceRefs || value.transfer_evidence_refs, 256);
  const regressionEvidenceRefs = unique(value.regressionEvidenceRefs || value.regression_evidence_refs, 256);
  const repairEvidenceRefs = unique(value.repairEvidenceRefs || value.repair_evidence_refs, 256);
  const resolvedSeams = list(value.resolvedSeams || value.resolved_seams, 128).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`outcome.resolvedSeams[${index}] must be an object`);
    const seamId = id(item.seamId || item.seam_id, '');
    if (!seamId) throw new Error(`outcome.resolvedSeams[${index}] requires seamId`);
    return {
      seamId,
      testStatus: clean(item.testStatus || item.test_status, 20).toUpperCase(),
      statement: clean(item.statement, 1000),
      evidenceRefs: unique(item.evidenceRefs || item.evidence_refs, 128)
    };
  });
  const allRefs = evidenceRefs.concat(transferEvidenceRefs, regressionEvidenceRefs, repairEvidenceRefs, resolvedSeams.flatMap(item => item.evidenceRefs));
  return {
    result,
    statement: clean(value.statement, 1600) || 'No outcome statement supplied.',
    evidenceRefs,
    transferEvidenceRefs,
    regressionEvidenceRefs,
    repairEvidenceRefs,
    resolvedSeams,
    missingEvidenceRefs: Array.from(new Set(allRefs.filter(ref => !evidenceIds.has(ref)))),
    observedAt: clean(value.observedAt || value.observed_at, 80) || null,
    verified: value.verified === true,
    repeatedVerifiedOutcomes: Math.max(0, Math.min(100000, Number(value.repeatedVerifiedOutcomes || value.repeated_verified_outcomes) || 0)),
    usePermission: value.usePermission || value.use_permission || 'unknown',
    permissionBasis: clean(value.permissionBasis || value.permission_basis, 500) || null,
    worldMutations: Math.max(0, Number(value.worldMutations || value.world_mutations) || 0),
    runtimePointerChanged: value.runtimePointerChanged === true,
    unexpectedSeams: list(value.unexpectedSeams || value.unexpected_seams, 128).map(item => clean(item, 240)).filter(Boolean)
  };
}

function consolidationProposal(sessionId, selected, outcome, seams, trace) {
  const criteria = {
    selectedPathPresent: !!selected,
    outcomePassed: !!outcome && outcome.result === 'PASS',
    outcomeVerified: !!outcome && outcome.verified,
    evidenceLineageComplete: !!outcome && !outcome.missingEvidenceRefs.length && outcome.evidenceRefs.length > 0,
    usePermissionAllowed: !!outcome && outcome.usePermission === 'allowed' && !!outcome.permissionBasis,
    repeatedEvidence: !!outcome && outcome.repeatedVerifiedOutcomes >= 2,
    unseenTransferEvidence: !!outcome && outcome.transferEvidenceRefs.length > 0,
    regressionEvidence: !!outcome && outcome.regressionEvidenceRefs.length > 0,
    runtimeUnchanged: !outcome || outcome.runtimePointerChanged === false,
    noWorldMutationClaim: !outcome || outcome.worldMutations === 0,
    noOpenHighSeam: !seams.some(item => item.status !== 'CLOSED' && ['high', 'critical'].includes(item.severity))
  };
  const eligible = Object.values(criteria).every(Boolean);
  const proposal = {
    schema: 'axm.mirror.consolidation-proposal/v1',
    state: eligible ? 'PROPOSE_REVIEW' : 'NOT_ELIGIBLE',
    sourceReasoningSessionId: sessionId,
    criteria,
    lessonCandidate: eligible ? {
      kind: 'REUSABLE_REASONING_PATTERN_CANDIDATE',
      goalScope: trace.goal.statement,
      procedure: selected.approach,
      evidenceRefs: Array.from(new Set(outcome.evidenceRefs.concat(outcome.transferEvidenceRefs, outcome.regressionEvidenceRefs, outcome.repairEvidenceRefs))),
      permissionBasis: outcome.permissionBasis,
      limitations: seams.map(item => item.id),
      status: 'CANDIDATE'
    } : null,
    authority: {
      memoryWrite: false,
      trainingAdmission: false,
      activeModelChange: false,
      canonChange: false,
      identityChange: false,
      toolGrant: false,
      humanReviewRequired: true
    },
    boundary: 'Even an eligible consolidation is a review proposal. It is not memory truth, training admission, promotion, or canon.'
  };
  proposal.proposalDigest = State.digest(proposal, 64);
  return proposal;
}

function metacognition(selected, seams, outcome) {
  const openSeams = seams.filter(item => item.status !== 'CLOSED');
  let estimate = selected ? 0.58 : 0.12;
  if (selected && selected.verificationStatus === 'PASS') estimate += 0.18;
  if (outcome && outcome.verified && outcome.result === 'PASS') estimate += 0.14;
  if (openSeams.some(item => item.id === 'blocking-unknowns')) estimate = Math.min(estimate, 0.45);
  if (openSeams.some(item => item.id === 'unresolved-contradictions')) estimate = Math.min(estimate, 0.35);
  if (openSeams.some(item => item.id === 'verification-lineage-missing')) estimate = Math.min(estimate, 0.25);
  if (!selected) estimate = Math.min(estimate, 0.2);
  let nextAction = 'ANSWER_OR_PROPOSE';
  if (!selected) nextAction = 'HOLD';
  else if (openSeams.some(item => item.id === 'blocking-unknowns')) nextAction = 'ASK_OR_OBSERVE';
  else if (selected.toolRequest) nextAction = 'REQUEST_EXTERNAL_TOOL_GATE';
  else if (selected.verificationStatus !== 'PASS') nextAction = 'TEST';
  else if (!outcome) nextAction = 'OBSERVE_CONSEQUENCE';
  else if (outcome.result !== 'PASS') nextAction = 'REPAIR';
  return {
    schema: 'axm.mirror.metacognition-receipt/v1',
    confidenceBefore: null,
    confidenceAfter: Number(clamp(estimate, 0, 0.95).toFixed(3)),
    confidenceBasis: 'Deterministic ceiling from present gates, verification, contradictions, blocking unknowns, and observed consequence evidence.',
    operationalEstimateNotProbability: true,
    openSeamCount: openSeams.length,
    nextAction
  };
}

function memoryRoute(trace, selected, receipts, outcome, consolidation) {
  const route = {
    schema: 'axm.mirror.memory-route/v1',
    working: [trace.goal.id].concat(selected ? [selected.pathId] : []),
    episodicCandidates: [trace.traceId].concat(receipts.map(item => item.id)),
    semanticCandidates: consolidation.lessonCandidate ? [consolidation.proposalDigest] : [],
    skillCandidates: consolidation.lessonCandidate ? [consolidation.proposalDigest] : [],
    repairCandidates: outcome && (outcome.result === 'FAIL' || outcome.repairEvidenceRefs.length) ? outcome.repairEvidenceRefs : [],
    preserveDissentAndContradictions: trace.epistemic.contradictions,
    discard: ['incidental wording', 'unsupported speculation', 'duplicate unverified guesses'],
    writesPerformed: [],
    authority: 'PROPOSAL_ONLY'
  };
  route.routeDigest = State.digest(route, 64);
  return route;
}

function developmentProposal(sessionId, seams, outcome) {
  const openSeams = seams.filter(item => item.status !== 'CLOSED');
  if (!openSeams.length) return null;
  const target = openSeams.slice().sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0) || a.id.localeCompare(b.id);
  })[0];
  const proposal = {
    schema: 'axm.mirror.reasoning-development-proposal/v1',
    state: 'PROPOSAL',
    sourceReasoningSessionId: sessionId,
    targetSeam: clone(target),
    curriculumCandidate: {
      objective: `Develop and test a reusable repair for reasoning seam ${target.id}.`,
      practiceBoundary: 'Permissioned local fixtures and explicit sessions only.',
      completionEvidence: target.cheapestDisconfirmingCheck
    },
    requiredExam: {
      unseenTransfer: true,
      counterexample: true,
      earlierCapabilityRegression: true,
      repairReplay: true,
      independentEvaluator: true
    },
    architectureRoute: {
      decision: outcome && outcome.verified && outcome.repeatedVerifiedOutcomes >= 2 &&
        outcome.unexpectedSeams.includes(target.id)
        ? 'NEW_HARDCODED_ORGAN_CANDIDATE'
        : 'EVIDENCE_REQUIRED',
      newHardcodedOrganAllowed: true,
      alternativesToCompare: ['REUSE_EXISTING_CELL', 'EXTEND_REASONING_FOUNDATION', 'NEW_HARDCODED_ORGAN', 'LEARNED_CHALLENGER'],
      organNeedEvidence: [
        'the same verified gap recurs rather than appearing once',
        'existing cells were tried and their failure receipts are preserved',
        'the proposed organ has a narrow typed input/output contract',
        'held-out, counterexample, regression and rollback tests can falsify it'
      ],
      boundary: 'Mirror is small, so a proven specialization gap may earn a dedicated hard-coded organ. The organ remains proposal-only until its independent exam passes.'
    },
    authority: { selfApply: false, selfGradeFinalExam: false, trainingAdmission: false, promotion: false, canon: false, tools: false }
  };
  proposal.proposalId = `reasoning-development-${State.digest(proposal)}`;
  return proposal;
}

function run(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reasoning session must be an object');
  rejectPrivateReasoning(input);
  const coreInput = normalizeCoreInput(input);
  let candidateOrigin = null;
  let pathProfileInput = input.pathProfiles;
  if ((!Array.isArray(coreInput.actions) || !coreInput.actions.length) && options.strategyModel && options.originateStrategies === true) {
    candidateOrigin = ReasoningStrategyOrgan.originate(coreInput, options.strategyModel, {
      assumptions: input.assumptions,
      maxCandidates: options.maxOriginatedCandidates
    });
    coreInput.actions = candidateOrigin.candidates;
    pathProfileInput = candidateOrigin.pathProfiles;
  }
  const provisional = Principle.reason(coreInput);
  const evidenceIds = new Set(provisional.epistemic.evidence.map(item => item.id));
  const actionIds = new Set(provisional.candidates.map(item => item.action.id));
  const assumptions = normalizeAssumptions(input.assumptions, evidenceIds);
  const questions = normalizeDecomposition(input.decomposition, provisional);
  const dependency = dependencyIssues(questions);
  const profiles = normalizePathProfiles(pathProfileInput, provisional.candidates.map(item => item.action));
  const receipts = normalizeVerificationReceipts(input.verificationReceipts, actionIds, evidenceIds);
  const featureContext = {
    problemState: {
      evidence: provisional.epistemic.evidence,
      assumptions,
      unknowns: provisional.epistemic.unknowns,
      contradictions: conflicts(provisional.epistemic.evidence),
      constraints: provisional.constraints,
      permissions: provisional.permissions
    },
    pathSet: { profiles },
    principleTrace: provisional
  };
  const structuralProjection = ReasoningStructuralFeatureOrgan.create(featureContext);
  ReasoningStructuralFeatureOrgan.verify(structuralProjection, featureContext);
  const featureSource = Array.isArray(options.strategyFeatures)
    ? 'EXPLICIT_PRIVATE_TEST_OVERRIDE'
    : candidateOrigin
      ? 'CANDIDATE_ORIGIN_LEGACY_PLUS_SCHEMA_SELECTED_MACHINE_PROJECTION'
      : 'SESSION_LEGACY_PLUS_SCHEMA_SELECTED_MACHINE_PROJECTION';
  const legacyFeatures = candidateOrigin ? candidateOrigin.structuralFeatures : StrategyModel.extractFeatures(featureContext);
  const problemFeatures = Array.isArray(options.strategyFeatures)
    ? featureUnion(options.strategyFeatures)
    : featureUnion(legacyFeatures, structuralProjection.features);
  const strategyPrediction = options.strategyModel ? StrategyModel.predict(options.strategyModel, problemFeatures) : null;
  const memoryGuidance = options.reasoningMemory ? ReasoningMemoryGuidanceOrgan.create({
    problemFeatures,
    pathProfiles: profiles,
    receipts: options.reasoningMemory.receipts,
    access: options.reasoningMemory.access
  }) : null;
  let comparisons = comparePaths(provisional, profiles, receipts, evidenceIds, strategyPrediction, memoryGuidance);
  const selected = comparisons.find(item => item.eligible) || null;
  let trace = provisional;
  if (selected && provisional.decision.selectedActionId !== selected.actionId) {
    const actions = provisional.candidates.map(item => item.action).sort((left, right) => {
      if (left.id === selected.actionId) return -1;
      if (right.id === selected.actionId) return 1;
      return left.id.localeCompare(right.id);
    });
    trace = Principle.reason(Object.assign({}, coreInput, { requestId: provisional.requestId, actions }));
    comparisons = comparePaths(trace, profiles, receipts, evidenceIds, strategyPrediction, memoryGuidance);
  }
  const chosen = comparisons.find(item => item.actionId === (selected && selected.actionId)) || null;
  const evidenceConflicts = conflicts(trace.epistemic.evidence);
  const seams = buildSeams(trace, assumptions, questions, dependency, profiles, receipts, comparisons, evidenceConflicts, chosen);
  const outcome = normalizeOutcome(input.outcome, evidenceIds);
  if (!outcome) seams.push(makeSeam('observed-consequence-missing', 'medium', 'No observed consequence is attached to this reasoning attempt.', chosen ? [chosen.pathId] : [], 'Observe and attribute the real outcome before proposing consolidation.'));
  else if (outcome.missingEvidenceRefs.length) seams.push(makeSeam('outcome-lineage-missing', 'high', 'The outcome cites evidence that is not present.', outcome.missingEvidenceRefs, 'Attach and digest the observed consequence records before interpreting the outcome.'));
  else if (!outcome.verified) seams.push(makeSeam('outcome-unverified', 'high', 'The supplied outcome has not been independently verified.', outcome.evidenceRefs, 'Run an independent check against observed state.'));
  if (outcome) {
    for (const resolution of outcome.resolvedSeams) {
      const seam = seams.find(item => item.id === resolution.seamId && item.status !== 'CLOSED');
      const lineageComplete = resolution.evidenceRefs.length > 0 && resolution.evidenceRefs.every(ref => evidenceIds.has(ref));
      if (seam && resolution.testStatus === 'PASS' && resolution.statement && lineageComplete) {
        seam.status = 'CLOSED';
        seam.closure = {
          testStatus: 'PASS',
          statement: resolution.statement,
          evidenceRefs: resolution.evidenceRefs
        };
      }
    }
  }
  const basis = {
    requestId: trace.requestId,
    traceId: trace.traceId,
    assumptions,
    questions,
    profiles,
    receipts,
    outcome,
    strategyModelDigest: options.strategyModel && options.strategyModel.modelDigest || null,
    featureSource,
    problemFeatures,
    structuralProjectionDigest: structuralProjection.projectionDigest
  };
  if (memoryGuidance) basis.memoryGuidanceDigest = memoryGuidance.guidanceDigest;
  const reasoningSessionId = `reasoning-${State.digest(basis)}`;
  const consolidation = consolidationProposal(reasoningSessionId, chosen, outcome, seams, trace);
  const session = {
    schema: SCHEMA,
    reasoningSessionId,
    cell: { id: CELL_ID, status: options.strategyModel ? 'PRIVATE_CHALLENGER' : memoryGuidance ? 'PRIVATE_MEMORY_CHALLENGER' : 'EXPERIMENTAL', learnedWeights: !!options.strategyModel },
    createdAt: clean(options.at, 80) || new Date().toISOString(),
    identity: trace.identity,
    rootBundle: trace.rootBundle,
    problemState: {
      schema: 'axm.mirror.reasoning-state/v1',
      goal: trace.goal,
      observations: trace.epistemic.evidence.filter(item => ['observation', 'tool-result', 'test'].includes(item.kind) && ['observed', 'tested'].includes(item.status)),
      assertions: trace.epistemic.evidence.filter(item => item.status === 'asserted'),
      derived: trace.epistemic.evidence.filter(item => item.status === 'derived'),
      predictions: trace.epistemic.evidence.filter(item => item.status === 'predicted'),
      assumptions,
      unknowns: trace.epistemic.unknowns,
      constraints: trace.constraints,
      permissions: trace.permissions,
      evidenceRefs: trace.epistemic.evidence.map(item => item.id),
      contradictions: evidenceConflicts,
      authority: 'NONE'
    },
    decomposition: {
      schema: 'axm.mirror.decomposition/v1',
      questions,
      dependencyStatus: dependency.missing.length || dependency.cycle ? 'HOLD_REPAIR' : 'VISIBLE'
    },
    pathSet: {
      schema: 'axm.mirror.reasoning-path-set/v1',
      profiles,
      comparisons,
      selectedPathId: chosen ? chosen.pathId : null,
      selectedActionId: chosen ? chosen.actionId : null,
      state: chosen ? 'BOUNDED_PROPOSAL' : 'HOLD',
      selectionReason: chosen
        ? 'Selected deterministically from paths that passed the Principle Cell and present evidence/permission/verification gates.'
        : 'No path passed every present gate; HOLD is preserved.',
      inputOrderAuthority: false,
      strategyGuidance: {
        mode: strategyPrediction && memoryGuidance ? 'PRIVATE_STRATEGY_AND_MEMORY_CHALLENGER' : strategyPrediction ? 'PRIVATE_CHALLENGER' : memoryGuidance ? 'PRIVATE_MEMORY_CHALLENGER' : 'NONE',
        featureSource,
        problemFeatures,
        structuralProjection,
        prediction: strategyPrediction,
        activeRuntimeAuthority: false,
        ...(memoryGuidance ? { memory: memoryGuidance } : {})
      }
    },
    verification: {
      schema: 'axm.mirror.reasoning-verification-set/v1',
      suppliedReceipts: receipts,
      principleTraceId: trace.traceId,
      finalOutcome: outcome,
      fluentLanguageCanCloseSeam: false
    },
    seams,
    metacognition: metacognition(chosen, seams, outcome),
    memoryRoute: null,
    consolidation,
    developmentProposal: developmentProposal(reasoningSessionId, seams, outcome),
    independentSeamReview: null,
    candidateOrigin,
    principleTrace: trace,
    authority: {
      proposalOnly: true,
      worldAction: false,
      toolUse: false,
      permissionGrant: false,
      memoryWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    limitations: [
      'This deterministic foundation compares supplied bounded candidates; it does not yet originate open-ended domain solutions.',
      'Path scores order present proposals and are not truth probabilities or intelligence scores.',
      strategyPrediction
        ? 'Private learned strategy guidance adjusted path ordering for this challenger session; it has no active-runtime authority.'
        : 'No learned strategy model influenced this active deterministic session.',
      candidateOrigin
        ? 'A private learned candidate organ originated non-mutating epistemic paths; it did not originate a domain answer or execute an action.'
        : 'No learned candidate organ originated paths for this session.',
      memoryGuidance
        ? 'A private verified episodic-memory challenger supplied a bounded ordering adjustment after eligibility gates; it did not supply truth, permission, evidence, confidence, or execution authority.'
        : 'No episodic-memory guidance influenced this session.',
      'Schema-selected structural features may expose declared finite machine facts to private challengers; unselected prose and identifiers remain inert, and the projection has no truth, permission, training, promotion, or action authority.',
      'A development or consolidation proposal performs no learning, memory write, code change, promotion, or external action.',
      'Inspectability records checkpoints and receipts; it does not collect or claim to expose private hidden chain-of-thought.'
    ]
  };
  session.memoryRoute = memoryRoute(trace, chosen, receipts, outcome, consolidation);
  session.independentSeamReview = Seam.inspectReasoningSession(session, { deliberate: true });
  if (typeof options.onTrace === 'function') options.onTrace(trace);
  if (typeof options.onSession === 'function') options.onSession(session);
  return session;
}

module.exports = { CELL_ID, SCHEMA, run };
