'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/readiness-probe-recipe-admission-v1';
const SCHEMA = 'axm.mirror.readiness-probe-recipe-admission/v1';
const RECIPE_SCHEMA = 'axm.mirror.reviewed-readiness-probe-recipe/v1';
const HAND_SCHEMA = 'axm.mirror.readiness-probe-hand-request/v1';
const KINDS = new Set([
  'FILE_EXISTS',
  'DIRECTORY_EXISTS',
  'DECLARED_MODULE_AVAILABLE',
  'DECLARED_SHARED_SERVICE_AVAILABLE',
  'DECLARED_FOUNDATION_SERVICE_AVAILABLE'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }

function targetPath(value) {
  const result = clean(value, 300).replace(/\\/g, '/');
  if (!result || result.startsWith('/') || /^[a-z]:/i.test(result) || result.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('probe target must be a non-empty normalized relative path without traversal');
  return result;
}

function sealRecipe(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reviewed probe recipe input is required');
  const unexpected = Object.keys(input).filter(key => !['handRequestId', 'handRequestDigest', 'decision', 'review', 'probe'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical reviewed probe recipe fields: ${unexpected.join(', ')}`);
  const review = input.review || {};
  const decision = clean(input.decision, 80).toUpperCase();
  if (!['APPROVE_DISPOSABLE_CANDIDATE', 'HOLD'].includes(decision)) throw new Error('review decision must approve a disposable candidate or hold');
  const approved = decision === 'APPROVE_DISPOSABLE_CANDIDATE';
  const probe = input.probe == null ? null : input.probe;
  const unexpectedReview = Object.keys(review).filter(key => !['actorId', 'actorKind', 'reviewedAt', 'reason'].includes(key));
  const unexpectedProbe = probe && typeof probe === 'object' && !Array.isArray(probe) ? Object.keys(probe).filter(key => !['kind', 'targetRelativePath', 'presentState', 'missingState', 'requiredPermission', 'liveExecutionApproved'].includes(key)) : [];
  if (unexpectedReview.length || unexpectedProbe.length) throw new Error(`unknown critical reviewed probe recipe fields: ${unexpectedReview.concat(unexpectedProbe).join(', ')}`);
  if (approved && (!probe || typeof probe !== 'object' || Array.isArray(probe))) throw new Error('approved recipe requires an explicit disposable presence probe');
  if (!approved && probe !== null) throw new Error('HOLD recipe must preserve no probe instead of inventing a target');
  const basis = {
    schema: RECIPE_SCHEMA,
    handRequestId: clean(input.handRequestId, 160),
    handRequestDigest: clean(input.handRequestDigest, 64).toLowerCase(),
    decision,
    review: {
      actorId: clean(review.actorId, 120),
      actorKind: clean(review.actorKind, 40).toUpperCase(),
      reviewedAt: clean(review.reviewedAt, 80),
      reason: clean(review.reason, 1000)
    },
    probe: approved ? {
      kind: clean(probe.kind, 40).toUpperCase(),
      targetRelativePath: targetPath(probe.targetRelativePath),
      presentState: clean(probe.presentState || 'AVAILABLE', 40).toUpperCase(),
      missingState: clean(probe.missingState || 'UNKNOWN', 40).toUpperCase(),
      requiredPermission: clean(probe.requiredPermission || 'files:read', 120),
      liveExecutionApproved: probe.liveExecutionApproved === true
    } : null
  };
  if (!basis.handRequestId || !/^[a-f0-9]{64}$/.test(basis.handRequestDigest)) throw new Error('recipe must bind a hand request ID and digest');
  if (!basis.review.actorId || basis.review.actorKind !== 'HUMAN' || !Number.isFinite(Date.parse(basis.review.reviewedAt)) || !basis.review.reason) throw new Error('recipe requires an explicit attributed human review');
  if (approved && (!KINDS.has(basis.probe.kind) || basis.probe.presentState !== 'AVAILABLE' || basis.probe.missingState !== 'UNKNOWN' || basis.probe.requiredPermission !== 'files:read' || basis.probe.liveExecutionApproved)) throw new Error('recipe exceeds the disposable structural-probe DSL');
  const recipeId = `probe-recipe-${digest(basis).slice(0, 20)}`;
  const recipe = Object.assign({ recipeId, recipeDigest: null }, basis);
  recipe.recipeDigest = digest(Object.assign({}, recipe, { recipeDigest: null }));
  return recipe;
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.handRequest || !input.recipe) throw new Error('probe recipe admission requires handRequest and recipe');
  const unexpected = Object.keys(input).filter(key => !['handRequest', 'recipe'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical probe recipe admission fields: ${unexpected.join(', ')}`);
  const hand = clone(input.handRequest);
  const recipe = clone(input.recipe);
  if (hand.schema !== HAND_SCHEMA || hand.requestDigest !== digest(Object.assign({}, hand, { requestDigest: null })) || hand.state !== 'REVIEWABLE_MISSING_PROBE_HAND_REQUEST_NOT_BUILT') throw new Error('recipe source hand request is invalid');
  const resealed = sealRecipe({ handRequestId: recipe.handRequestId, handRequestDigest: recipe.handRequestDigest, decision: recipe.decision, review: recipe.review, probe: recipe.probe });
  if (recipe.schema !== RECIPE_SCHEMA || recipe.recipeId !== resealed.recipeId || recipe.recipeDigest !== resealed.recipeDigest || JSON.stringify(stable(recipe)) !== JSON.stringify(stable(resealed))) throw new Error('reviewed probe recipe digest or content mismatch');
  if (recipe.handRequestId !== hand.requestId || recipe.handRequestDigest !== hand.requestDigest) throw new Error('reviewed probe recipe does not bind the supplied hand request');
  const approved = recipe.decision === 'APPROVE_DISPOSABLE_CANDIDATE';
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    handRequestId: hand.requestId,
    handRequestDigest: hand.requestDigest,
    requirementId: hand.requirementId,
    recipeId: recipe.recipeId,
    recipeDigest: recipe.recipeDigest,
    classification: approved ? 'APPROVED_DISPOSABLE_CANDIDATE_BUILD' : 'HELD_RECIPE_NOT_APPROVED',
    probe: recipe.probe,
    review: recipe.review,
    authority: {
      installedRuntimeWrite: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveProbeExecution: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Admission authorizes only deterministic candidate bytes and disposable fixture tests under ignored Mirror state. It does not authorize Workshop writes, live probing, installation, start, repair, permission, training, execution, or promotion.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment, handRequest, recipe) {
  const expected = evaluate({ handRequest, recipe });
  if (!assessment || assessment.assessmentDigest !== expected.assessmentDigest || JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('probe recipe admission assessment mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, RECIPE_SCHEMA, HAND_SCHEMA, KINDS, digest, targetPath, sealRecipe, evaluate, verify };
