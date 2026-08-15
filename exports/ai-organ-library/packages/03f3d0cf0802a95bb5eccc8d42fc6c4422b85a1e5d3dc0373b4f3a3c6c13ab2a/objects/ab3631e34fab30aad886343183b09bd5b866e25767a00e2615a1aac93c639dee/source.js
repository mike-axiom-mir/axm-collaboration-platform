'use strict';

const crypto = require('crypto');
const RecipeCell = require('../kernel/readiness-probe-recipe-cell');
const ReadinessHands = require('./reasoning-readiness-hand-organ');

const ORGAN_ID = 'axm.mirror.organ/reasoning-readiness-probe-human-review-bridge-v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-readiness-probe-review-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-readiness-probe-review-response/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }

function review(batchOrDerived, request, actor, options = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  ReadinessHands.verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`probe review request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'handRequestId', 'decision', 'reason', 'probe'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical probe review request fields: ${unexpected.join(', ')}`);
  const missing = ['handRequestId', 'decision', 'reason', 'probe'].filter(key => !Object.prototype.hasOwnProperty.call(request, key));
  if (missing.length) throw new Error(`probe review request is missing explicit fields: ${missing.join(', ')}`);
  if (!actor || typeof actor !== 'object' || Array.isArray(actor) || clean(actor.kind, 40).toUpperCase() !== 'HUMAN' || !clean(actor.id, 120)) throw new Error('probe recipe review requires an attributed HUMAN actor');
  const at = options.at == null ? new Date().toISOString() : clean(options.at, 80);
  if (!Number.isFinite(Date.parse(at))) throw new Error('probe recipe review time is invalid');
  const handRequestId = clean(request.handRequestId, 160);
  const source = batch.results.find(item => item.handRequest && item.handRequest.requestId === handRequestId);
  if (!source) throw new Error(`probe review hand is not in the current planner batch: ${handRequestId}`);
  const decision = clean(request.decision, 80).toUpperCase();
  const reason = clean(request.reason, 1000);
  if (!reason) throw new Error('probe recipe review requires a reason');
  const recipe = RecipeCell.sealRecipe({
    handRequestId: source.handRequest.requestId,
    handRequestDigest: source.handRequest.requestDigest,
    decision,
    review: { actorId: clean(actor.id, 120), actorKind: 'HUMAN', reviewedAt: at, reason },
    probe: request.probe == null ? null : clone(request.probe)
  });
  const admission = RecipeCell.evaluate({ handRequest: source.handRequest, recipe });
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceHandBatch: { batchId: batch.batchId, batchDigest: batch.batchDigest },
    request: { handRequestId, decision },
    reviewProvenance: clone(recipe.review),
    state: decision === 'HOLD' ? 'HOLD_RECORDED_WITH_NO_PROBE' : 'REVIEWED_RECIPE_SEALED_NOT_BUILT',
    recipe,
    admission,
    authority: {
      humanDecision: false,
      candidateWrite: false,
      readinessClaim: false,
      installedRuntimeWrite: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveProbeExecution: false,
      trainingAdmission: false,
      toolUse: false,
      networkUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The human supplied the decision and service-specific recipe fields. This bridge only binds them to the current hand and seals their digest; it does not decide, build, test, install, execute, grant, train, or promote anything.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

function verify(response, batchOrDerived) {
  if (!response || response.schema !== RESPONSE_SCHEMA || response.responseDigest !== digest(without(response, 'responseDigest'))) throw new Error('invalid probe review response or digest');
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  if (batch) {
    const expected = review(batch, {
      schema: REQUEST_SCHEMA,
      handRequestId: response.request.handRequestId,
      decision: response.request.decision,
      reason: response.reviewProvenance.reason,
      probe: response.recipe.probe
    }, { id: response.reviewProvenance.actorId, kind: response.reviewProvenance.actorKind }, { at: response.reviewProvenance.reviewedAt });
    if (JSON.stringify(stable(response)) !== JSON.stringify(stable(expected))) throw new Error('probe review response content mismatch');
  }
  return true;
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RESPONSE_SCHEMA, digest, review, verify };
