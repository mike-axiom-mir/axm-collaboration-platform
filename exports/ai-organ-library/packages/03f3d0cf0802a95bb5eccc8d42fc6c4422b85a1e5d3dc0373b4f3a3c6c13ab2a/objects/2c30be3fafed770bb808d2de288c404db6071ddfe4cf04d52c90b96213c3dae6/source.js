'use strict';

const State = require('../kernel/state-language');
const Environment = require('../kernel/declarative-environment-adapter');
const Foundation = require('../kernel/reasoning-foundation');
const BoundedReasoning = require('./bounded-search-reasoning-organ');

const ORGAN_ID = 'axm.mirror.bounded-environment-replay-organ/v1';
const RESPONSE_SCHEMA = 'axm.mirror.bounded-environment-replay-response/v1';
const HIDDEN_KEYS = /^(chain[-_ ]?of[-_ ]?thought|private[-_ ]?reasoning|hidden[-_ ]?reasoning|scratchpad)$/i;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}
function allowed(value, keys, label) {
  const unknown = Object.keys(value).filter(key => !keys.has(key));
  if (unknown.length) throw new Error(`${label} has unknown critical fields: ${unknown.join(', ')}`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (HIDDEN_KEYS.test(key)) throw new Error(`private hidden reasoning is refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function clean(value, max = 1000) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function id(value, label) {
  const result = clean(value, 120).replace(/[^a-zA-Z0-9._:/-]/g, '-').replace(/-+/g, '-');
  if (!result) throw new Error(`${label} requires an id`);
  return result;
}
function unique(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const result = values.map((value, index) => id(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicates`);
  return result.sort();
}
function consentMap(rows) {
  if (!Array.isArray(rows)) throw new Error('planning.consentEvidence must be an array');
  const result = new Map();
  rows.forEach((row, index) => {
    object(row, `planning.consentEvidence[${index}]`);
    allowed(row, new Set(['actionId', 'evidenceRefs']), `planning.consentEvidence[${index}]`);
    const actionId = id(row.actionId, `planning.consentEvidence[${index}].actionId`);
    if (result.has(actionId)) throw new Error(`planning.consentEvidence duplicates ${actionId}`);
    result.set(actionId, unique(row.evidenceRefs || [], `planning.consentEvidence[${index}].evidenceRefs`));
  });
  return result;
}
function seal(response) {
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  response.responseDigest = State.digest(basis, 64);
  response.responseId = `bounded-environment-replay-${State.digest({ responseDigest: response.responseDigest, source: response.source })}`;
  return response;
}

function closeObservationLoop(inputReasoning, bounded, plan, observation, replay, pass, permissions, options) {
  const reasoning = clone(inputReasoning || {});
  if (Array.isArray(reasoning.verificationReceipts) && reasoning.verificationReceipts.length) throw new Error('bounded environment replay originates its own exact verification receipt');
  if (reasoning.outcome != null) throw new Error('bounded environment replay originates its own observed outcome');
  const observationEvidence = {
    id: observation.observationId,
    kind: 'observation',
    status: 'observed',
    statement: `The bounded in-memory environment fixture was observed at authoritative state hash ${observation.source.authoritativeStateHash}.`,
    source: { kind: 'bounded-environment-observation', id: observation.observationId, at: options.at || null }
  };
  const replayEvidence = {
    id: replay.reportId,
    kind: 'test',
    status: 'tested',
    statement: `The frozen deterministic environment replay result was ${replay.state}; this applies only to the declared bounded fixture.`,
    source: { kind: 'bounded-environment-replay', id: replay.reportId, at: options.at || null }
  };
  const existingIds = new Set((reasoning.evidence || []).map(row => String(row && row.id || '')));
  if (existingIds.has(observationEvidence.id) || existingIds.has(replayEvidence.id)) throw new Error('bounded environment replay evidence id collides with caller evidence');
  const searchEvidence = (bounded.reasoningSession.principleTrace.epistemic.evidence || []).filter(row => row.source && row.source.kind === 'bounded-search-result');
  for (const row of searchEvidence) if (existingIds.has(row.id)) throw new Error('bounded environment replay search evidence id collides with caller evidence');
  reasoning.evidence = (reasoning.evidence || []).concat(searchEvidence.map(clone), observationEvidence, replayEvidence);
  reasoning.permissions = permissions;
  reasoning.actions = bounded.reasoningSession.principleTrace.candidates.map(row => clone(row.action));
  reasoning.pathProfiles = clone(bounded.reasoningSession.pathSet.profiles);
  reasoning.verificationReceipts = [{
    id: `verify-${plan.planId}`,
    actionId: plan.planId,
    claim: 'The exact cloned plan prediction matches the separately observed authoritative bounded fixture state and frozen replay chain.',
    evidenceRefs: [observationEvidence.id, replayEvidence.id],
    method: 'clone, execute in isolated deterministic fixture, observe, replay frozen requests, and compare state plus receipt hashes',
    result: pass ? 'PASS' : 'FAIL',
    limitations: ['bounded declarative in-memory fixture only', 'caller-declared permissions are fixture inputs, not authenticated external grants', 'no stochastic or external-world transfer claim']
  }];
  reasoning.outcome = {
    result: pass ? 'PASS' : 'FAIL',
    statement: pass
      ? 'The cloned plan predicted the observed authoritative bounded fixture state and exact frozen replay chain.'
      : 'The bounded prediction, authoritative fixture observation, or frozen replay chain diverged.',
    evidenceRefs: [observationEvidence.id, replayEvidence.id],
    verified: true,
    observedAt: options.at || null,
    repeatedVerifiedOutcomes: 1,
    transferEvidenceRefs: [],
    regressionEvidenceRefs: [],
    repairEvidenceRefs: [],
    resolvedSeams: [],
    usePermission: 'allowed',
    permissionBasis: 'Caller-declared local bounded-fixture scope; not authenticated external-world authority.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: pass ? [] : ['bounded-environment-differential-failed']
  };
  return Foundation.run(reasoning, Object.assign({}, options.foundationOptions || {}, { at: options.at }));
}

function run(input, options = {}) {
  rejectHidden(input);
  object(input, 'bounded environment replay request');
  allowed(input, new Set(['environment', 'planning', 'reasoning', 'goldenTrace']), 'bounded environment replay request');
  const planning = object(input.planning, 'planning');
  allowed(planning, new Set(['problemId', 'actor', 'permissions', 'consentEvidence', 'goal', 'search', 'previousFailure']), 'planning');
  const permissions = unique(planning.permissions || [], 'planning.permissions');
  const actor = object(planning.actor, 'planning.actor');
  allowed(actor, new Set(['id', 'kind']), 'planning.actor');
  const normalizedActor = { id: id(actor.id, 'planning.actor.id'), kind: clean(actor.kind, 20).toUpperCase() };
  if (!['HUMAN', 'MACHINE'].includes(normalizedActor.kind)) throw new Error('planning.actor.kind must be HUMAN or MACHINE');
  const consent = consentMap(planning.consentEvidence || []);
  const declaration = Environment.normalizeDeclaration(input.environment);
  if (declaration.adapterKind !== 'DECLARATIVE_V1') throw new Error('bounded environment replay requires DECLARATIVE_V1; the null adapter has no transition plan');
  const registry = Environment.createRegistry();
  const authoritativeFixture = registry.create(declaration.adapterKind, declaration);
  const initialAuthoritativeStateHash = authoritativeFixture.hash();
  const plannerClone = authoritativeFixture.clone();
  const problem = plannerClone.toSearchProblem({
    problemId: planning.problemId,
    goal: planning.goal,
    search: planning.search,
    actor: normalizedActor,
    permissions,
    previousFailure: planning.previousFailure == null ? null : planning.previousFailure
  });
  const reasoning = clone(input.reasoning || {});
  if (Array.isArray(reasoning.verificationReceipts) && reasoning.verificationReceipts.length) throw new Error('bounded environment replay originates its own exact verification receipt');
  if (reasoning.outcome != null) throw new Error('bounded environment replay originates its own observed outcome');
  reasoning.permissions = permissions;
  reasoning.actions = [];
  reasoning.pathProfiles = [];
  const bounded = BoundedReasoning.run({ problem, reasoning }, { at: options.at, searchOptions: options.searchOptions, foundationOptions: options.foundationOptions });
  BoundedReasoning.verify(bounded);
  const plan = bounded.search.plan;
  const plannerObservation = plannerClone.observe({ actor: normalizedActor, permissions });
  const base = {
    schema: RESPONSE_SCHEMA,
    responseId: null,
    responseDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_BOUNDED_DETERMINISTIC_ENVIRONMENT_ADAPTER_AND_REPLAY_DIFFERENTIAL' },
    source: {
      environmentId: declaration.environmentId,
      declarationDigest: declaration.declarationDigest,
      adapterKind: declaration.adapterKind,
      problemId: problem.problemId,
      problemDigest: bounded.source.problemDigest,
      searchResultId: bounded.search.resultId,
      searchResultDigest: bounded.search.resultDigest,
      reasoningResponseId: bounded.responseId,
      reasoningResponseDigest: bounded.responseDigest,
      plannerObservationId: plannerObservation.observationId,
      plannerObservationDigest: plannerObservation.observationDigest
    },
    state: null,
    boundedReasoning: bounded,
    postObservationReasoning: null,
    planProof: null,
    replay: null,
    observation: null,
    counts: { searchedPlanSteps: plan ? plan.stepCount : 0, plannerCloneTransitions: 0, authoritativeFixtureTransitions: 0, replayTransitions: 0, postObservationReasoningSessions: 0, externalWorldActions: 0, toolCalls: 0, permissionGrants: 0, trainingAdmissions: 0, runtimePromotions: 0, canonChanges: 0 },
    authority: { testOnly: true, boundedInMemoryFixtureMutation: true, externalWorldAction: false, toolUse: false, permissionGrant: false, evidenceAdmission: false, memoryWrite: false, trainingAdmission: false, modelChange: false, runtimePromotion: false, canonChange: false },
    boundary: 'This TEST organ generates a bounded plan from a cloned declarative adapter belief, replays it in two isolated in-memory adapters, and compares the predicted state with an observed authoritative fixture state. The fixture is not an external world; no tool, live runtime, permission, training, release, or CANON authority is gained.'
  };
  if (!plan) {
    base.state = 'HOLD_NO_SEARCH_PLAN';
    base.planProof = {
      state: 'NOT_RUN',
      reason: bounded.search.state,
      initialAuthoritativeStateHash,
      predictedFinalStateHash: null,
      plannerCloneFinalStateHash: null,
      authoritativeFixtureFinalStateHash: authoritativeFixture.hash(),
      predictionMatchedPlannerClone: false,
      predictionMatchedAuthoritativeFixture: false,
      cloneMatchedAuthoritativeFixture: false,
      allTransitionsApplied: false,
      exactActionGrammarShared: true
    };
    base.observation = authoritativeFixture.observe({ actor: normalizedActor, permissions });
    return seal(base);
  }

  const requests = plan.actionIds.map((actionId, index) => ({
    schema: Environment.ACTION_REQUEST_SCHEMA,
    requestId: `bounded-plan-step-${index + 1}-${plan.planId}`,
    actor: normalizedActor,
    actionId,
    permissions,
    consentEvidenceRefs: consent.get(actionId) || []
  }));
  const executionClone = plannerClone.clone();
  const cloneReceipts = requests.map(request => executionClone.step(request));
  const authoritativeReceipts = requests.map(request => authoritativeFixture.step(request));
  const finalObservation = authoritativeFixture.observe({ actor: normalizedActor, permissions });
  const generatedGolden = Environment.makeGoldenTrace(`golden-${plan.planId}`, requests, authoritativeReceipts, authoritativeFixture.hash());
  const golden = input.goldenTrace == null ? generatedGolden : clone(input.goldenTrace);
  const exactGoldenRequests = State.canonical(golden.requests) === State.canonical(requests);
  const replay = Environment.playTrace(declaration, golden);
  const cloneDigests = cloneReceipts.map(receipt => receipt.receiptDigest);
  const authoritativeDigests = authoritativeReceipts.map(receipt => receipt.receiptDigest);
  const allApplied = cloneReceipts.concat(authoritativeReceipts).every(receipt => receipt.status === 'APPLIED');
  const predictionMatchedPlannerClone = executionClone.hash() === plan.finalStateHash;
  const predictionMatchedAuthoritativeFixture = authoritativeFixture.hash() === plan.finalStateHash;
  const cloneMatchedAuthoritativeFixture = executionClone.hash() === authoritativeFixture.hash() && State.canonical(cloneDigests) === State.canonical(authoritativeDigests);
  const pass = allApplied && predictionMatchedPlannerClone && predictionMatchedAuthoritativeFixture && cloneMatchedAuthoritativeFixture && exactGoldenRequests && replay.state === 'PASS' && finalObservation.source.authoritativeStateHash === authoritativeFixture.hash();
  base.state = pass ? 'PASS_DETERMINISTIC_DIFFERENTIAL' : 'FAIL_DETERMINISTIC_DIFFERENTIAL';
  base.planProof = {
    state: pass ? 'PASS' : 'FAIL',
    reason: pass ? 'CLONED_PLAN_PREDICTED_OBSERVED_AUTHORITATIVE_FIXTURE_STATE' : 'PREDICTION_OR_REPLAY_DIVERGED',
    initialAuthoritativeStateHash,
    predictedFinalStateHash: plan.finalStateHash,
    plannerCloneFinalStateHash: executionClone.hash(),
    authoritativeFixtureFinalStateHash: authoritativeFixture.hash(),
    predictionMatchedPlannerClone,
    predictionMatchedAuthoritativeFixture,
    cloneMatchedAuthoritativeFixture,
    allTransitionsApplied: allApplied,
    exactActionGrammarShared: State.canonical(cloneReceipts.map(receipt => receipt.request)) === State.canonical(authoritativeReceipts.map(receipt => receipt.request)),
    exactGoldenRequests,
    plannerCloneReceipts: cloneReceipts,
    authoritativeFixtureReceipts: authoritativeReceipts
  };
  base.replay = { source: input.goldenTrace == null ? 'GENERATED_FROM_AUTHORITATIVE_FIXTURE_FOR_THIS_PROOF' : 'CALLER_SUPPLIED_FROZEN_GOLDEN_TRACE', goldenTrace: golden, report: replay };
  base.observation = finalObservation;
  base.postObservationReasoning = closeObservationLoop(input.reasoning, bounded, plan, finalObservation, replay, pass, permissions, options);
  base.source.postObservationReasoningSessionId = base.postObservationReasoning.reasoningSessionId;
  base.counts.plannerCloneTransitions = cloneReceipts.filter(receipt => receipt.status === 'APPLIED').length;
  base.counts.authoritativeFixtureTransitions = authoritativeReceipts.filter(receipt => receipt.status === 'APPLIED').length;
  base.counts.replayTransitions = replay.receipts.filter(receipt => receipt.status === 'APPLIED').length;
  base.counts.postObservationReasoningSessions = 1;
  return seal(base);
}

function verify(response) {
  if (!response || response.schema !== RESPONSE_SCHEMA || !response.organ || response.organ.id !== ORGAN_ID || response.organ.learnedWeights !== false) throw new Error('invalid bounded environment replay response');
  BoundedReasoning.verify(response.boundedReasoning);
  Environment.verifyObservation(response.observation);
  if (response.replay) Environment.verifyReplayReport(response.replay.report);
  if (response.postObservationReasoning && (response.postObservationReasoning.authority.worldAction !== false || response.postObservationReasoning.authority.toolUse !== false || response.postObservationReasoning.authority.permissionGrant !== false || response.postObservationReasoning.authority.trainingAdmission !== false || response.postObservationReasoning.authority.runtimePromotion !== false || response.postObservationReasoning.authority.canonChange !== false)) throw new Error('post-observation Reasoning Foundation session gained authority');
  const basis = Object.assign({}, response, { responseId: null, responseDigest: null });
  const expectedDigest = State.digest(basis, 64);
  const expectedId = `bounded-environment-replay-${State.digest({ responseDigest: expectedDigest, source: response.source })}`;
  if (response.responseDigest !== expectedDigest || response.responseId !== expectedId) throw new Error('bounded environment replay response digest changed');
  if (response.counts.externalWorldActions !== 0 || response.counts.toolCalls !== 0 || response.counts.permissionGrants !== 0 || response.counts.trainingAdmissions !== 0 || response.counts.runtimePromotions !== 0 || response.counts.canonChanges !== 0) throw new Error('bounded environment replay gained authority');
  if (response.authority.externalWorldAction !== false || response.authority.toolUse !== false || response.authority.permissionGrant !== false || response.authority.runtimePromotion !== false || response.authority.canonChange !== false) throw new Error('bounded environment replay authority boundary changed');
  if (response.state === 'PASS_DETERMINISTIC_DIFFERENTIAL') {
    if (!response.planProof || response.planProof.state !== 'PASS' || !response.planProof.predictionMatchedPlannerClone || !response.planProof.predictionMatchedAuthoritativeFixture || !response.planProof.cloneMatchedAuthoritativeFixture || !response.planProof.allTransitionsApplied || !response.planProof.exactActionGrammarShared || !response.planProof.exactGoldenRequests) throw new Error('bounded environment replay PASS lacks exact differential evidence');
    if (!response.replay || response.replay.report.state !== 'PASS' || !response.observation || response.observation.source.authoritativeStateHash !== response.planProof.authoritativeFixtureFinalStateHash) throw new Error('bounded environment replay PASS lacks replay or observation evidence');
    if (!response.postObservationReasoning || response.postObservationReasoning.pathSet.selectedActionId !== response.boundedReasoning.search.plan.planId || response.postObservationReasoning.pathSet.comparisons.find(row => row.actionId === response.boundedReasoning.search.plan.planId).verificationStatus !== 'PASS' || response.postObservationReasoning.seams.some(row => ['selected-path-unverified', 'observed-consequence-missing'].includes(row.id) && row.status !== 'CLOSED')) throw new Error('bounded environment replay PASS did not close the exact Foundation observation loop');
    response.planProof.plannerCloneReceipts.forEach(Environment.verifyTransitionReceipt);
    response.planProof.authoritativeFixtureReceipts.forEach(Environment.verifyTransitionReceipt);
  }
  return true;
}

module.exports = { ORGAN_ID, RESPONSE_SCHEMA, run, verify };
