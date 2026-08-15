'use strict';

const RecipeCell = require('../kernel/declarative-reasoning-organ-recipe-cell');

const ORGAN_ID = 'axm.mirror.organ/declarative-reasoning-organ-human-review-bridge-v1';
const REQUEST_SCHEMA = 'axm.mirror.declarative-reasoning-organ-review-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.declarative-reasoning-organ-review-response/v1';

function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !expected.has(key));
  const missing = keys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) throw new Error(`${label} fields changed: unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`);
}

function review(admissionInput, assessment, request, actor, options = {}) {
  exactKeys(request, ['schema', 'assessmentId', 'decision', 'reason', 'language'], 'declarative organ review request');
  if (request.schema !== REQUEST_SCHEMA) throw new Error(`declarative organ review request must use ${REQUEST_SCHEMA}`);
  exactKeys(actor, ['id', 'kind'], 'declarative organ review actor');
  if (clean(actor.kind, 40).toUpperCase() !== 'HUMAN' || !clean(actor.id, 120)) throw new Error('declarative organ review requires an attributed HUMAN actor');
  const at = options.at == null ? new Date().toISOString() : clean(options.at, 80);
  if (!Number.isFinite(Date.parse(at))) throw new Error('declarative organ review time is invalid');
  const reason = clean(request.reason, 1000);
  if (!reason) throw new Error('declarative organ review requires a reason');
  RecipeCell.verifyAssessment(assessment, admissionInput);
  const recipe = RecipeCell.sealRecipe({
    assessmentId: clean(request.assessmentId, 200),
    assessmentDigest: assessment.assessmentDigest,
    decision: clean(request.decision, 80).toUpperCase(),
    review: { actorId: clean(actor.id, 120), actorKind: 'HUMAN', reviewedAt: at, reason },
    language: request.language == null ? null : clone(request.language)
  }, assessment, admissionInput);
  const approved = recipe.decision === 'APPROVE_ISOLATED_DECLARATIVE_CANDIDATE';
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceAdmission: {
      assessmentId: assessment.assessmentId,
      assessmentDigest: assessment.assessmentDigest,
      proposalId: assessment.buildProposal.proposalId,
      targetSeamId: assessment.buildProposal.targetSeamId
    },
    request: { assessmentId: recipe.assessmentId, decision: recipe.decision },
    reviewProvenance: clone(recipe.review),
    state: approved ? 'REVIEWED_DECLARATIVE_ORGAN_RECIPE_SEALED_NOT_BUILT' : 'HOLD_RECORDED_WITH_NO_ORGAN_RECIPE',
    recipe,
    authority: {
      humanDecision: false,
      codeWrite: false,
      builderCanaryExecution: false,
      heldOutFixtureAuthoring: false,
      heldOutEvaluation: false,
      candidateInstall: false,
      candidateLoad: false,
      pathSelection: false,
      toolUse: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false,
      worldAction: false
    },
    boundary: 'The HUMAN supplied the decision, reason, and closed structural mapping. This bridge only reconstructs the current admission and seals the review. It does not build or execute code, author or run held-out evidence, install, load, select, train, grant, promote, change CANON, or act.'
  };
  response.responseDigest = RecipeCell.digest(without(response, 'responseDigest'));
  return response;
}

function verify(response, admissionInput, assessment) {
  if (!response || response.schema !== RESPONSE_SCHEMA || response.responseDigest !== RecipeCell.digest(without(response, 'responseDigest'))) throw new Error('declarative organ review response digest changed');
  const expected = review(admissionInput, assessment, {
    schema: REQUEST_SCHEMA,
    assessmentId: response.request.assessmentId,
    decision: response.request.decision,
    reason: response.reviewProvenance.reason,
    language: response.recipe.language
  }, { id: response.reviewProvenance.actorId, kind: response.reviewProvenance.actorKind }, { at: response.reviewProvenance.reviewedAt });
  if (!RecipeCell.same(response, expected)) throw new Error('declarative organ review response content changed');
  return true;
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RESPONSE_SCHEMA, review, verify };
