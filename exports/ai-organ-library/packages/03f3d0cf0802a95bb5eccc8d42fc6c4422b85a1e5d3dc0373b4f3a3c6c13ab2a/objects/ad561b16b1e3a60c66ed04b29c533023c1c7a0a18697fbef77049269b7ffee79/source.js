'use strict';

const State = require('../kernel/state-language');
const Search = require('../kernel/bounded-state-search-cell');
const Foundation = require('../kernel/reasoning-foundation');

const ORGAN_ID = 'axm.mirror.bounded-search-reasoning-organ/v1';
const RESPONSE_SCHEMA = 'axm.mirror.bounded-search-reasoning-response/v1';
const RISK = Object.freeze({ low: 0, medium: 1, high: 2, severe: 3 });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return Array.from(new Set(values)).sort(); }
function maxRisk(values) { return values.reduce((current, value) => RISK[value] > RISK[current] ? value : current, 'low'); }
function evidenceIds(reasoning) { return new Set((reasoning.evidence || []).map(item => String(item && item.id || '')).filter(Boolean)); }

function planCandidate(search, problem, availableEvidence) {
  if (!search.plan) return null;
  const byId = new Map(problem.actions.map(action => [action.id, action]));
  const actions = search.plan.actionIds.map(actionId => byId.get(actionId));
  const alreadySatisfied = search.plan.actionIds.length === 0;
  const zeroActionProofId = `bounded-search-result:${search.resultId}`;
  const planSupportingEvidence = alreadySatisfied && availableEvidence.has(zeroActionProofId) ? [zeroActionProofId] : search.plan.supportingEvidence.filter(ref => availableEvidence.has(ref));
  const planPreconditionEvidence = alreadySatisfied && availableEvidence.has(zeroActionProofId) ? [zeroActionProofId] : search.plan.preconditionEvidence.filter(ref => availableEvidence.has(ref));
  return {
    action: {
      id: search.plan.planId,
      kind: alreadySatisfied ? 'bounded-zero-action-plan' : 'bounded-plan',
      label: alreadySatisfied ? 'Propose zero actions because the declared goal is already satisfied.' : `Propose bounded declared plan: ${search.plan.actionLabels.join(' then ')}`,
      requiredPermissions: search.plan.requiredPermissions,
      supportingEvidence: planSupportingEvidence,
      preconditionEvidence: planPreconditionEvidence,
      expectedEffects: search.plan.expectedEffects.length ? search.plan.expectedEffects : [alreadySatisfied ? 'Preserve the already-satisfied declared goal without mutation.' : `Reach declared goal through ${search.plan.stepCount} simulated transition(s).`],
      possibleSideEffects: search.plan.possibleSideEffects,
      reversible: search.plan.reversible,
      recovery: search.plan.recovery,
      risk: search.plan.risk
    },
    profile: {
      actionId: search.plan.planId,
      pathId: `path-${search.plan.planId}`,
      approach: alreadySatisfied ? 'Take zero actions; search proved the initial declared state already satisfies the goal.' : `Use declared transition sequence ${search.plan.actionIds.join(' -> ')}. Search simulated it but did not execute it.`,
      requiredEvidence: search.plan.preconditionEvidence,
      requiredPermissions: search.plan.requiredPermissions,
      toolRequest: null,
      estimatedCost: search.plan.totalCost <= 2 ? 'LOW' : search.plan.totalCost <= 8 ? 'MEDIUM' : search.plan.totalCost <= 32 ? 'HIGH' : 'UNKNOWN',
      informationValue: alreadySatisfied ? 0.6 : 0.8,
      reversible: search.plan.reversible,
      failureConditions: unique(actions.flatMap(action => action.preconditions.map(predicate => `${predicate.factId} ${predicate.operator} ${JSON.stringify(predicate.value)} no longer holds`))),
      strategyTags: ['bounded-search', problem.search.algorithm.toLowerCase(), ...(alreadySatisfied ? ['zero-action'] : [])]
    }
  };
}

function directCandidate(action, availableEvidence, prefix) {
  return {
    action: {
      id: `${prefix}-${action.id}`,
      kind: action.kind,
      label: `${prefix === 'repair' ? 'Repair or rollback proposal' : 'Declared proposal'}: ${action.label}`,
      requiredPermissions: action.requiredPermissions,
      supportingEvidence: action.supportingEvidence.filter(ref => availableEvidence.has(ref)),
      preconditionEvidence: action.preconditionEvidence.filter(ref => availableEvidence.has(ref)),
      expectedEffects: action.expectedEffects,
      possibleSideEffects: action.possibleSideEffects,
      reversible: action.reversible,
      recovery: action.recovery,
      risk: action.risk
    },
    profile: {
      actionId: `${prefix}-${action.id}`,
      pathId: `path-${prefix}-${action.id}`,
      approach: `Evaluate the exact declared ${action.kind} transition ${action.id} without executing it.`,
      requiredEvidence: action.preconditionEvidence,
      requiredPermissions: action.requiredPermissions,
      toolRequest: null,
      estimatedCost: action.cost <= 2 ? 'LOW' : action.cost <= 8 ? 'MEDIUM' : action.cost <= 32 ? 'HIGH' : 'UNKNOWN',
      informationValue: 0.5,
      reversible: action.reversible,
      failureConditions: action.preconditions.map(predicate => `${predicate.factId} ${predicate.operator} ${JSON.stringify(predicate.value)} is not verified`),
      strategyTags: ['declared-repair']
    }
  };
}

function epistemicCandidates(search) {
  const goalAlreadySatisfied = search.state === 'INITIAL_STATE_ALREADY_SATISFIES_GOAL';
  const noOp = {
    action: { id: search.generatedDefaults.noOp.id, kind: 'hold', label: 'Preserve current state without action.', requiredPermissions: [], supportingEvidence: [], preconditionEvidence: [], expectedEffects: ['No world mutation.'], possibleSideEffects: [], reversible: true, recovery: 'No state change occurred.', risk: 'low' },
    profile: { actionId: search.generatedDefaults.noOp.id, pathId: 'path-bounded-search-no-op', approach: search.generatedDefaults.noOp.reason, requiredEvidence: [], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: true, failureConditions: [], strategyTags: ['hold'] }
  };
  const observe = {
    action: { id: search.generatedDefaults.observeMore.id, kind: 'observe', label: search.generatedDefaults.observeMore.unknownFactIds.length ? `Observe unresolved facts: ${search.generatedDefaults.observeMore.unknownFactIds.join(', ')}` : 'Observe current state before committing to a world action.', requiredPermissions: [], supportingEvidence: [], preconditionEvidence: [], expectedEffects: ['Request new attributed evidence; do not assert the answer.'], possibleSideEffects: ['Observation may leave the problem unresolved.'], reversible: true, recovery: 'No world mutation occurred.', risk: 'low' },
    profile: { actionId: search.generatedDefaults.observeMore.id, pathId: 'path-bounded-search-observe-more', approach: goalAlreadySatisfied ? 'The exact declared goal is already satisfied; further observation remains available but is not required to justify extra world action.' : search.generatedDefaults.observeMore.reason, requiredEvidence: [], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: goalAlreadySatisfied ? 0.1 : search.generatedDefaults.observeMore.unknownFactIds.length ? 0.9 : 0.4, reversible: true, failureConditions: ['No permitted observation source is available.'], strategyTags: ['observe'] }
  };
  return [noOp, observe];
}

function run(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bounded search reasoning request must be an object');
  const unknown = Object.keys(input).filter(key => !['problem', 'reasoning'].includes(key));
  if (unknown.length) throw new Error(`bounded search reasoning request has unknown critical fields: ${unknown.join(', ')}`);
  const reasoning = clone(input.reasoning || {});
  if (Array.isArray(reasoning.actions) && reasoning.actions.length) throw new Error('bounded search reasoning refuses caller-supplied actions; the declared transition system must originate candidates');
  if (Array.isArray(reasoning.pathProfiles) && reasoning.pathProfiles.length) throw new Error('bounded search reasoning refuses caller-supplied path profiles');
  const problem = Search.normalizeProblem(input.problem);
  const reasoningPermissions = unique(Array.isArray(reasoning.permissions) ? reasoning.permissions.map(value => String(value)) : []);
  if (State.canonical(problem.permissions) !== State.canonical(reasoningPermissions)) throw new Error('bounded search problem permissions must exactly match the Reasoning Foundation request');
  const search = Search.run(input.problem, options.searchOptions || {});
  Search.verify(search);
  if (search.plan && search.plan.stepCount === 0) {
    const proofId = `bounded-search-result:${search.resultId}`;
    if ((reasoning.evidence || []).some(row => String(row && row.id || '') === proofId)) throw new Error('bounded search result evidence id collides with caller evidence');
    reasoning.evidence = (reasoning.evidence || []).concat({
      id: proofId,
      kind: 'test',
      status: 'tested',
      statement: 'The content-digested bounded search result proves that the declared initial state already satisfies the exact declared goal, so zero world actions are required.',
      source: { kind: 'bounded-search-result', id: search.resultId, uri: `sha256:${search.resultDigest}` }
    });
  }
  const availableEvidence = evidenceIds(reasoning);
  const candidates = [];
  const plan = planCandidate(search, problem, availableEvidence);
  if (plan) candidates.push(plan);
  const byId = new Map(problem.actions.map(action => [action.id, action]));
  for (const actionId of search.generatedDefaults.repairOrRollbackActionIds) candidates.push(directCandidate(byId.get(actionId), availableEvidence, 'repair'));
  candidates.push(...epistemicCandidates(search));
  reasoning.actions = candidates.map(item => item.action);
  reasoning.pathProfiles = candidates.map(item => item.profile);
  const session = Foundation.run(reasoning, Object.assign({}, options.foundationOptions || {}, { at: options.at || options.foundationOptions && options.foundationOptions.at }));
  const response = {
    schema: RESPONSE_SCHEMA,
    responseId: null,
    responseDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false },
    source: { problemId: problem.problemId, problemDigest: problem.problemDigest, searchResultId: search.resultId, searchResultDigest: search.resultDigest },
    search,
    reasoningSession: session,
    binding: {
      candidateActionIds: candidates.map(item => item.action.id),
      pathProfileActionIds: candidates.map(item => item.profile.actionId),
      selectedActionId: session.pathSet.selectedActionId,
      exactSearchPlanCandidateId: plan ? plan.action.id : null,
      searchExecutedWorldActions: 0,
      candidateExecutions: 0
    },
    authority: { proposalOnly: true, declaredTransitionSimulation: true, toolUse: false, worldAction: false, permissionGrant: false, evidenceFabrication: false, memoryWrite: false, trainingAdmission: false, modelChange: false, runtimePromotion: false, canonChange: false },
    boundary: 'The organ binds one hardcoded bounded-search result to the existing Reasoning Foundation as proposal candidates. Search transitions are simulations over declared finite facts; no candidate is executed and Foundation gates remain authoritative.'
  };
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  response.responseDigest = State.digest(basis, 64);
  response.responseId = `bounded-search-reasoning-${State.digest({ problemDigest: problem.problemDigest, responseDigest: response.responseDigest })}`;
  return response;
}

function verify(response) {
  if (!response || response.schema !== RESPONSE_SCHEMA || !response.organ || response.organ.id !== ORGAN_ID || response.organ.learnedWeights !== false) throw new Error('invalid bounded search reasoning response');
  Search.verify(response.search);
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  const expectedDigest = State.digest(basis, 64);
  const expectedId = `bounded-search-reasoning-${State.digest({ problemDigest: response.source.problemDigest, responseDigest: expectedDigest })}`;
  if (response.responseDigest !== expectedDigest || response.responseId !== expectedId) throw new Error('bounded search reasoning response digest changed');
  if (response.binding.candidateExecutions !== 0 || response.binding.searchExecutedWorldActions !== 0 || response.authority.worldAction !== false || response.authority.toolUse !== false) throw new Error('bounded search reasoning execution boundary changed');
  if (response.binding.candidateActionIds.length !== response.binding.pathProfileActionIds.length || response.binding.candidateActionIds.some((id, index) => id !== response.binding.pathProfileActionIds[index])) throw new Error('bounded search reasoning candidate binding changed');
  return true;
}

module.exports = { ORGAN_ID, RESPONSE_SCHEMA, planCandidate, epistemicCandidates, run, verify };
