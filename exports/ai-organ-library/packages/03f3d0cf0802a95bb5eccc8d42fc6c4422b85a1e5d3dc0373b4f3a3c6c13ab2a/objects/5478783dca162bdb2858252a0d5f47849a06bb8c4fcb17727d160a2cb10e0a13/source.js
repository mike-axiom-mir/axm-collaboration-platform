'use strict';

const crypto = require('crypto');
const RecipeCell = require('../kernel/provider-declaration-research-executor-recipe-cell');
const ResearchExams = require('./provider-declaration-research-exam-organ');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-research-executor-human-review-bridge-v1';
const REQUEST_SCHEMA = 'axm.mirror.provider-declaration-research-executor-review-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.provider-declaration-research-executor-review-response/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function review(batchOrDerived, request, actor, options = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  ResearchExams.verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider declaration research executor review request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'examRequestId', 'decision', 'reason', 'executor'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration research executor review fields: ${unexpected.join(', ')}`);
  const missing = ['examRequestId', 'decision', 'reason', 'executor'].filter(key => !Object.prototype.hasOwnProperty.call(request, key));
  if (missing.length) throw new Error(`provider declaration research executor review is missing explicit fields: ${missing.join(', ')}`);
  if (!actor || typeof actor !== 'object' || Array.isArray(actor) || clean(actor.kind, 40).toUpperCase() !== 'HUMAN' || !clean(actor.id, 120)) throw new Error('provider declaration research executor review requires an attributed HUMAN actor');
  const at = options.at == null ? new Date().toISOString() : clean(options.at, 80);
  if (!Number.isFinite(Date.parse(at))) throw new Error('provider declaration research executor review time is invalid');
  const examRequestId = clean(request.examRequestId, 180);
  const source = batch.results.find(item => item.researchExamRequest && item.researchExamRequest.examRequestId === examRequestId);
  if (!source) throw new Error(`provider declaration research exam is not in the current batch: ${examRequestId}`);
  const decision = clean(request.decision, 80).toUpperCase();
  const reason = clean(request.reason, 1000);
  if (!reason) throw new Error('provider declaration research executor review requires a reason');
  const recipe = RecipeCell.sealRecipe({
    examRequestId: source.researchExamRequest.examRequestId,
    examRequestDigest: source.researchExamRequest.examRequestDigest,
    decision,
    review: { actorId: clean(actor.id, 120), actorKind: 'HUMAN', reviewedAt: at, reason },
    executor: request.executor == null ? null : clone(request.executor)
  });
  const admission = RecipeCell.evaluate({ examRequest: source.researchExamRequest, recipe });
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceResearchExamBatch: { batchId: batch.batchId, batchDigest: batch.batchDigest },
    request: { examRequestId, decision },
    reviewProvenance: clone(recipe.review),
    state: decision === 'HOLD' ? 'HOLD_RECORDED_WITH_NO_EXECUTOR' : 'REVIEWED_EXECUTOR_RECIPE_SEALED_NOT_BUILT',
    recipe,
    admission,
    authority: {
      humanDecision: false,
      architectureSelection: false,
      candidateArchitectureAuthoring: false,
      executorBuild: false,
      disposableCandidateWrite: false,
      sandboxFixtureExecution: false,
      liveArchitectureEvaluation: false,
      providerCandidateBuild: false,
      providerContractWrite: false,
      installedRuntimeWrite: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveExecution: false,
      trainingAdmission: false,
      toolUse: false,
      networkUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The HUMAN supplied the decision and reason. This bridge only binds that decision to the current immutable exam and seals the fixed recipe. It does not decide, build, run fixtures, select or evaluate architecture, install, write Workshop, train, or promote.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

function verify(response, batchOrDerived) {
  if (!response || response.schema !== RESPONSE_SCHEMA || response.responseDigest !== digest(without(response, 'responseDigest'))) throw new Error('invalid provider declaration research executor review response or digest');
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  if (batch) {
    const expected = review(batch, {
      schema: REQUEST_SCHEMA,
      examRequestId: response.request.examRequestId,
      decision: response.request.decision,
      reason: response.reviewProvenance.reason,
      executor: response.recipe.executor
    }, { id: response.reviewProvenance.actorId, kind: response.reviewProvenance.actorKind }, { at: response.reviewProvenance.reviewedAt });
    if (!same(response, expected)) throw new Error('provider declaration research executor review response content mismatch');
  }
  return true;
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RESPONSE_SCHEMA, digest, review, verify };
