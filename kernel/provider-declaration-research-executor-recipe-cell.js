'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/provider-declaration-research-executor-recipe-admission-v1';
const SCHEMA = 'axm.mirror.provider-declaration-research-executor-recipe-admission/v1';
const RECIPE_SCHEMA = 'axm.mirror.reviewed-provider-declaration-research-executor-recipe/v1';
const EXAM_SCHEMA = 'axm.mirror.provider-declaration-research-exam-request/v1';
const PROJECTION_SCHEMA = 'axm.mirror.provider-declaration-architecture-projection/v1';
const EXECUTOR_KIND = 'DECLARATION_RELATION_FIXTURE_EXECUTOR_V1';
const CASE_IDS = Object.freeze([
  'COMPLETE_EXACT_RELATION',
  'PROVIDER_IDENTITY_MISSING',
  'DEMANDED_SELECTOR_COVERAGE_MISSING',
  'IMPLEMENTATION_TARGET_MISSING',
  'IMPLEMENTATION_CONTENT_BINDING_MISMATCH',
  'OUTSIDE_ROOT_OR_SYMBOLIC_TARGET',
  'DUPLICATE_OR_COMPETING_PROVIDER',
  'PERMISSION_DECLARATION_MISSING',
  'REPAIRED_DECLARATION_REMOVES_NEXT_GAP',
  'EXISTING_DECLARATION_REGRESSION'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function fixedExecutor() {
  return {
    kind: EXECUTOR_KIND,
    projectionSchema: PROJECTION_SCHEMA,
    buildRoot: 'IGNORED_PRIVATE_STATE',
    fixtureCaseIds: Array.from(CASE_IDS),
    architectureSelection: 'NONE',
    candidateMayAuthorFixtures: false,
    liveExecutionApproved: false
  };
}

function sealRecipe(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reviewed provider declaration research executor recipe input is required');
  const unexpected = Object.keys(input).filter(key => !['examRequestId', 'examRequestDigest', 'decision', 'review', 'executor'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration research executor recipe fields: ${unexpected.join(', ')}`);
  const decision = clean(input.decision, 80).toUpperCase();
  if (!['APPROVE_DISPOSABLE_EXECUTOR', 'HOLD'].includes(decision)) throw new Error('research executor decision must approve the fixed disposable executor or hold');
  const review = input.review || {};
  const unexpectedReview = review && typeof review === 'object' && !Array.isArray(review)
    ? Object.keys(review).filter(key => !['actorId', 'actorKind', 'reviewedAt', 'reason'].includes(key))
    : ['review'];
  if (unexpectedReview.length) throw new Error(`unknown critical provider declaration research executor review fields: ${unexpectedReview.join(', ')}`);
  const approved = decision === 'APPROVE_DISPOSABLE_EXECUTOR';
  const executor = input.executor == null ? null : clone(input.executor);
  if (approved && !same(executor, fixedExecutor())) throw new Error('approved research executor recipe must use the fixed disposable relation-executor specification');
  if (!approved && executor !== null) throw new Error('HOLD research executor recipe must contain no executor');
  const basis = {
    schema: RECIPE_SCHEMA,
    examRequestId: clean(input.examRequestId, 180),
    examRequestDigest: clean(input.examRequestDigest, 64).toLowerCase(),
    decision,
    review: {
      actorId: clean(review.actorId, 120),
      actorKind: clean(review.actorKind, 40).toUpperCase(),
      reviewedAt: clean(review.reviewedAt, 80),
      reason: clean(review.reason, 1000)
    },
    executor: approved ? fixedExecutor() : null,
    humanWordingAuthority: false,
    boundary: 'This attributed review may admit only the fixed disposable relation executor under ignored private state. It selects no provider architecture, authors no candidate architecture, grants no live execution, and authorizes no installation, Workshop write, training, readiness claim, or promotion.'
  };
  if (!basis.examRequestId || !/^[a-f0-9]{64}$/.test(basis.examRequestDigest)) throw new Error('research executor recipe must bind an exact exam request ID and digest');
  if (!basis.review.actorId || basis.review.actorKind !== 'HUMAN' || !Number.isFinite(Date.parse(basis.review.reviewedAt)) || !basis.review.reason) throw new Error('research executor recipe requires an explicit attributed HUMAN review');
  const recipeId = `provider-declaration-research-executor-recipe-${digest(basis).slice(0, 20)}`;
  const recipe = Object.assign({ recipeId, recipeDigest: null }, basis);
  recipe.recipeDigest = digest(Object.assign({}, recipe, { recipeDigest: null }));
  return recipe;
}

function verifyExam(examRequest) {
  if (!examRequest || examRequest.schema !== EXAM_SCHEMA || !examRequest.examRequestId || examRequest.examRequestDigest !== digest(Object.assign({}, examRequest, { examRequestDigest: null }))) throw new Error('provider declaration research executor admission requires a valid immutable exam request');
  if (examRequest.state !== 'REVIEWABLE_PROVIDER_DECLARATION_RESEARCH_EXAM_NOT_EXECUTED' || examRequest.examExecutorState !== 'NOT_BUILT' || examRequest.architectureDecision !== 'UNRESOLVED_REQUIRES_INDEPENDENT_EXPERIMENT') throw new Error('provider declaration research exam is not at the reviewable unexecuted frontier');
  if (!examRequest.independence || examRequest.independence.attributedStewardReviewRequiredBeforeExecutorBuild !== true || examRequest.independence.futureCandidateMayAuthorExpectedOutcomes !== false || examRequest.independence.futureCandidateMayAuthorHeldOutFixtures !== false) throw new Error('provider declaration research exam independence boundary changed');
  if (!Array.isArray(examRequest.caseFamilies) || !same(examRequest.caseFamilies.map(item => item.caseId), CASE_IDS)) throw new Error('provider declaration research exam held-out case families changed');
  return true;
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.examRequest || !input.recipe) throw new Error('provider declaration research executor admission requires examRequest and recipe');
  const unexpected = Object.keys(input).filter(key => !['examRequest', 'recipe'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration research executor admission fields: ${unexpected.join(', ')}`);
  const examRequest = clone(input.examRequest);
  const recipe = clone(input.recipe);
  verifyExam(examRequest);
  const resealed = sealRecipe({
    examRequestId: recipe.examRequestId,
    examRequestDigest: recipe.examRequestDigest,
    decision: recipe.decision,
    review: recipe.review,
    executor: recipe.executor
  });
  if (recipe.schema !== RECIPE_SCHEMA || recipe.recipeId !== resealed.recipeId || recipe.recipeDigest !== resealed.recipeDigest || !same(recipe, resealed)) throw new Error('reviewed provider declaration research executor recipe digest or content mismatch');
  if (recipe.examRequestId !== examRequest.examRequestId || recipe.examRequestDigest !== examRequest.examRequestDigest) throw new Error('reviewed research executor recipe does not bind the supplied exam request');
  const approved = recipe.decision === 'APPROVE_DISPOSABLE_EXECUTOR';
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    examRequestId: examRequest.examRequestId,
    examRequestDigest: examRequest.examRequestDigest,
    recipeId: recipe.recipeId,
    recipeDigest: recipe.recipeDigest,
    classification: approved ? 'APPROVED_DISPOSABLE_EXECUTOR_BUILD' : 'HELD_EXECUTOR_NOT_APPROVED',
    executor: approved ? clone(recipe.executor) : null,
    review: clone(recipe.review),
    authority: {
      architectureSelection: false,
      candidateArchitectureAuthoring: false,
      expectedOutcomeMutation: false,
      heldOutFixtureAuthoringByCandidate: false,
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
    boundary: 'Admission recognizes only whether the fixed disposable executor may be built and fixture-tested later. The admission itself writes and executes nothing, selects no architecture, and grants no wider authority.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment, examRequest, recipe) {
  const expected = evaluate({ examRequest, recipe });
  if (!assessment || assessment.assessmentDigest !== expected.assessmentDigest || !same(assessment, expected)) throw new Error('provider declaration research executor admission assessment mismatch');
  return true;
}

module.exports = {
  CELL_ID, SCHEMA, RECIPE_SCHEMA, EXAM_SCHEMA, PROJECTION_SCHEMA, EXECUTOR_KIND, CASE_IDS,
  digest, fixedExecutor, sealRecipe, verifyExam, evaluate, verify
};
