'use strict';

const Outcome = require('../kernel/outcome-learning-cell');
const BoundedReplay = require('./bounded-environment-replay-organ');

const ORGAN_ID = 'axm.mirror.bounded-replay-outcome-adapter-organ/v1';
const RESPONSE_SCHEMA = 'axm.mirror.bounded-replay-outcome-adapter-response/v1';
const FIELD_SCHEMA_ID = 'axm.mirror.bounded-replay-outcome-fields/v1';
const FIELD_IDS = ['authoritative-state-hash', 'actor.position', 'actor.energy', 'world.time'];
const FIELD_TYPES = { 'authoritative-state-hash': 'STRING', 'actor.position': 'STRING', 'actor.energy': 'NUMBER', 'world.time': 'NUMBER' };
const FIELD_SCHEMA_DIGEST = Outcome.digest({ schema: FIELD_SCHEMA_ID, fields: FIELD_IDS.map(fieldId => ({ fieldId, valueType: FIELD_TYPES[fieldId] })) });

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Outcome.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function probabilityMap(rows) {
  if (!Array.isArray(rows) || rows.length > FIELD_IDS.length) throw new Error('probabilities requires a bounded array');
  const map = new Map();
  rows.forEach((row, index) => {
    exactKeys(row, ['fieldId', 'probabilityBasisPoints'], `probabilities[${index}]`);
    if (!FIELD_IDS.includes(row.fieldId) || map.has(row.fieldId)) throw new Error(`probabilities[${index}] has an unknown or duplicate field`);
    if (row.probabilityBasisPoints !== null && (!Number.isSafeInteger(row.probabilityBasisPoints) || row.probabilityBasisPoints < 0 || row.probabilityBasisPoints > 10000)) throw new Error(`probabilities[${index}] requires null or 0..10000 basis points`);
    map.set(row.fieldId, row.probabilityBasisPoints);
  });
  return map;
}
function scalarType(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'string') return 'STRING';
  throw new Error('bounded replay outcome adapter refuses non-scalar fact values');
}
function predictionField(fieldId, fact, probability, evidenceRef) {
  const valueType = FIELD_TYPES[fieldId];
  if (!fact || fact.status !== 'KNOWN') return { fieldId, valueType, expectation: 'UNKNOWN', value: null, probabilityBasisPoints: null, evidenceRefs: [evidenceRef] };
  if (scalarType(fact.value) !== valueType) throw new Error(`bounded replay planned field ${fieldId} changed type`);
  return { fieldId, valueType, expectation: 'VALUE', value: fact.value, probabilityBasisPoints: probability == null ? null : probability, evidenceRefs: [evidenceRef] };
}
function observationField(fieldId, fact, evidenceRef, predictedType) {
  if (!fact || fact.status !== 'KNOWN' || !Object.prototype.hasOwnProperty.call(fact, 'value')) return { fieldId, state: 'MISSING', valueType: predictedType, value: null, alternatives: [], evidenceRefs: [evidenceRef], missingReason: fact ? 'AUTHORITATIVE_FIXTURE_REPORTED_UNKNOWN_WITHOUT_A_VALUE' : 'AUTHORITATIVE_FIXTURE_DID_NOT_EXPOSE_THE_FIELD' };
  if (scalarType(fact.value) !== predictedType) throw new Error(`bounded replay observed field ${fieldId} changed type`);
  return { fieldId, state: 'OBSERVED', valueType: predictedType, value: fact.value, alternatives: [], evidenceRefs: [evidenceRef], missingReason: null };
}
function seal(response) {
  response.responseId = `bounded-replay-outcome-${Outcome.digest(Object.assign({}, response, { responseId: null, responseDigest: null })).slice(0, 24)}`;
  response.responseDigest = Outcome.digest(Object.assign({}, response, { responseDigest: null }));
  return Outcome.stable(response);
}
function adapt(input, options = {}) {
  exactKeys(input, ['replay', 'predictionSource', 'probabilities', 'questions'], 'bounded replay outcome adapter request');
  BoundedReplay.verify(input.replay);
  if (input.replay.state !== 'PASS_DETERMINISTIC_DIFFERENTIAL' || !input.replay.boundedReasoning.search.plan || !input.replay.observation) throw new Error('bounded replay outcome adapter requires a passing differential replay with a plan and observation');
  exactKeys(input.predictionSource, ['sourceSystemId', 'sourceGroupId', 'sequence', 'priorPredictionDigest'], 'predictionSource');
  const probabilities = probabilityMap(input.probabilities);
  const replay = input.replay;
  const plan = replay.boundedReasoning.search.plan;
  const predictedFacts = new Map(plan.finalFacts.map(item => [item.id, item]));
  const observedFacts = new Map(replay.observation.facts.map(item => [item.id, item]));
  const predictionEvidence = { id: plan.planId, digest: plan.planDigest };
  const observationEvidence = { id: replay.observation.observationId, digest: replay.observation.observationDigest };
  const scope = {
    scopeId: 'bounded-environment-final-state',
    subjectId: replay.source.problemId,
    subjectDigest: replay.source.problemDigest,
    startingStateDigest: replay.planProof.initialAuthoritativeStateHash,
    actionDigest: plan.planDigest,
    fieldSchemaId: FIELD_SCHEMA_ID,
    fieldSchemaDigest: FIELD_SCHEMA_DIGEST
  };
  const planned = [
    { fieldId: 'authoritative-state-hash', status: 'KNOWN', value: replay.planProof.predictedFinalStateHash },
    predictedFacts.get('actor.position'),
    predictedFacts.get('actor.energy'),
    predictedFacts.get('world.time')
  ];
  const observed = [
    { id: 'authoritative-state-hash', status: 'KNOWN', value: replay.observation.source.authoritativeStateHash },
    observedFacts.get('actor.position'),
    observedFacts.get('actor.energy'),
    observedFacts.get('world.time')
  ];
  const predictionFields = FIELD_IDS.map((fieldId, index) => predictionField(fieldId, planned[index], probabilities.has(fieldId) ? probabilities.get(fieldId) : null, predictionEvidence));
  const observationFields = FIELD_IDS.map((fieldId, index) => observationField(fieldId, observed[index], observationEvidence, predictionFields[index].valueType));
  const prediction = Outcome.sealPrediction({
    schema: Outcome.PREDICTION_DRAFT_SCHEMA,
    source: {
      sourceSystemId: input.predictionSource.sourceSystemId,
      sourceGroupId: input.predictionSource.sourceGroupId,
      sourceRecordId: plan.planId,
      sourceRecordDigest: plan.planDigest,
      sequence: input.predictionSource.sequence,
      priorPredictionDigest: input.predictionSource.priorPredictionDigest,
      collectionMethod: 'DIRECT_MACHINE_SEAL'
    },
    scope,
    method: { methodId: 'bounded-state-search-final-state', methodDigest: replay.boundedReasoning.source.searchResultDigest },
    fields: predictionFields,
    questions: clone(input.questions),
    permission: { status: 'ALLOWED', basisEvidenceRefs: [{ id: replay.responseId, digest: replay.responseDigest }] }
  }, { observationsBeforeSeal: options.observationsBeforeSeal || [], predecessor: options.predecessor || null });
  const observation = Outcome.sealObservation({
    schema: Outcome.OBSERVATION_DRAFT_SCHEMA,
    source: {
      sourceSystemId: replay.observation.adapter.id,
      sourceGroupId: replay.observation.source.environmentId,
      sourceRecordId: replay.observation.observationId,
      sourceRecordDigest: replay.observation.observationDigest,
      collectionMethod: 'DIRECT_MACHINE_SEAL'
    },
    scope,
    fields: observationFields,
    permission: { status: 'ALLOWED', basisEvidenceRefs: [{ id: replay.responseId, digest: replay.responseDigest }] }
  });
  const response = {
    schema: RESPONSE_SCHEMA,
    responseId: null,
    responseDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_EXACT_BOUNDED_REPLAY_TO_TYPED_OUTCOME_ADAPTER' },
    source: { replayResponseId: replay.responseId, replayResponseDigest: replay.responseDigest, planId: plan.planId, planDigest: plan.planDigest, observationId: replay.observation.observationId, observationDigest: replay.observation.observationDigest },
    fieldSchema: { id: FIELD_SCHEMA_ID, digest: FIELD_SCHEMA_DIGEST, fieldIds: FIELD_IDS },
    prediction,
    observation,
    counts: { fields: FIELD_IDS.length, callerSuppliedProbabilities: predictionFields.filter(item => item.probabilityBasisPoints !== null).length, probabilityValuesGeneratedByAdapter: 0, externalWorldActions: 0, permissionGrants: 0, repairsApplied: 0, trainingAdmissions: 0, runtimePromotions: 0, canonChanges: 0 },
    authority: { adaptExactVerifiedReplay: true, probabilityGeneration: false, truthWrite: false, evidenceAdmission: false, permissionGrant: false, repairApply: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'This adapter copies four exact planned and observed scalar fields from one verified bounded replay into the Outcome Learning contracts. Caller-supplied probabilities remain caller-supplied. The adapter does not certify chronology, external-world transfer, truth, permission, repair, training, runtime, canon, or action.'
  };
  return seal(response);
}
function verify(response) {
  exactKeys(response, ['schema', 'responseId', 'responseDigest', 'organ', 'source', 'fieldSchema', 'prediction', 'observation', 'counts', 'authority', 'boundary'], 'bounded replay outcome adapter response');
  if (response.schema !== RESPONSE_SCHEMA || response.organ.id !== ORGAN_ID || response.organ.learnedWeights !== false || response.fieldSchema.id !== FIELD_SCHEMA_ID || response.fieldSchema.digest !== FIELD_SCHEMA_DIGEST || !Outcome.same(response.fieldSchema.fieldIds, FIELD_IDS)) throw new Error('bounded replay outcome adapter identity changed');
  Outcome.verifyPredictionEnvelope(response.prediction);
  Outcome.verifyObservation(response.observation);
  if (response.prediction.targetKey !== response.observation.targetKey || response.counts.fields !== FIELD_IDS.length || response.counts.probabilityValuesGeneratedByAdapter !== 0 || response.counts.externalWorldActions !== 0 || response.counts.permissionGrants !== 0 || response.counts.repairsApplied !== 0 || response.counts.trainingAdmissions !== 0 || response.counts.runtimePromotions !== 0 || response.counts.canonChanges !== 0) throw new Error('bounded replay outcome adapter boundary changed');
  if (response.authority.adaptExactVerifiedReplay !== true || Object.entries(response.authority).some(([key, value]) => key !== 'adaptExactVerifiedReplay' && value !== false)) throw new Error('bounded replay outcome adapter gained authority');
  const expectedDigest = Outcome.digest(Object.assign({}, response, { responseDigest: null }));
  const expectedId = `bounded-replay-outcome-${Outcome.digest(Object.assign({}, response, { responseId: null, responseDigest: null })).slice(0, 24)}`;
  if (response.responseDigest !== expectedDigest || response.responseId !== expectedId) throw new Error('bounded replay outcome adapter response changed');
  return true;
}

module.exports = { ORGAN_ID, RESPONSE_SCHEMA, FIELD_SCHEMA_ID, FIELD_SCHEMA_DIGEST, FIELD_IDS, FIELD_TYPES, adapt, verify };
