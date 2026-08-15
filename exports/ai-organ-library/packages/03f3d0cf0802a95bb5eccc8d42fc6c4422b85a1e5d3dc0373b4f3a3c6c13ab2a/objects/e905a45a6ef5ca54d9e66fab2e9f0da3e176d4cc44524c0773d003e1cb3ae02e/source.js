'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const RecipeCell = require('../kernel/provider-declaration-research-executor-recipe-cell');
const ResearchExams = require('./provider-declaration-research-exam-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-research-executor-builder-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-executor-builder-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-executor-builder-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-executor-builder-response/v1';
const RECEIPT_SCHEMA = 'axm.mirror.provider-declaration-research-executor-fixture-receipt/v1';
const MAX_RECIPES = 32;
const GENERATION_CONTRACT = Object.freeze({
  version: 'reviewed-provider-declaration-exam-to-disposable-relation-executor-v1',
  reviewedRecipeRequired: true,
  executorKind: RecipeCell.EXECUTOR_KIND,
  projectionSchema: RecipeCell.PROJECTION_SCHEMA,
  architectureHypothesesAcceptedWithoutSelection: [
    'REUSE_TYPED_SHARED_SERVICE_DECLARATION',
    'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION',
    'NEW_TYPED_PROVIDER_DECLARATION',
    'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT'
  ],
  generatedFiles: ['executor.js', 'contract.json', 'candidate-projection.schema.json', 'fixture-manifest.json', 'test.js'],
  fixtureCaseIds: Array.from(RecipeCell.CASE_IDS),
  fixtureSource: 'exact immutable research exam authored before the future architecture candidate',
  positiveStateCeiling: 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST',
  candidateRoot: 'ignored-private-state-only',
  architectureSelection: false,
  architectureEvaluation: false,
  candidateArchitectureAuthoring: false,
  futureCandidateFixtureAuthoring: false,
  liveExecution: false,
  workshopWrite: false,
  providerBuild: false,
  declarationWrite: false,
  install: false,
  trainingAdmission: false,
  runtimePromotion: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/provider-declaration-research-executor-recipe-cell'),
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('./provider-declaration-research-exam-organ'),
    path.join(root, 'contracts', 'provider-declaration-architecture-projection.schema.json'),
    path.join(root, 'contracts', 'reviewed-provider-declaration-research-executor-recipe.schema.json'),
    path.join(root, 'contracts', 'provider-declaration-research-executor-recipe-admission.schema.json'),
    path.join(root, 'contracts', 'provider-declaration-research-executor-fixture-receipt.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-executor-builder-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-executor-builder-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-executor-builder-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function executorSource(examRequest) {
  const requirementId = JSON.stringify(examRequest.sourceHand.requirementId);
  const bindings = JSON.stringify(examRequest.knownRelations.exactConsumerBindings);
  const selectors = JSON.stringify(examRequest.knownRelations.demandedProviderSelectors);
  return `'use strict';

const PROJECTION_SCHEMA = 'axm.mirror.provider-declaration-architecture-projection/v1';
const REQUIREMENT_ID = ${requirementId};
const EXPECTED_BINDINGS = ${bindings};
const DEMANDED_SELECTORS = ${selectors};
const HYPOTHESES = new Set(['REUSE_TYPED_SHARED_SERVICE_DECLARATION', 'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION', 'NEW_TYPED_PROVIDER_DECLARATION', 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT']);

function list(value) { return Array.isArray(value) ? value.map(item => String(item)).sort() : null; }
function equalList(left, right) { return !!left && left.length === right.length && left.every((value, index) => value === right[index]); }
function result(state, evidence) { return { state, evidence, architectureFitEstablished: false, readinessEstablished: false }; }

function evaluate(projection) {
  if (!projection || typeof projection !== 'object' || Array.isArray(projection) || projection.schema !== PROJECTION_SCHEMA) return result('UNKNOWN', ['MALFORMED_PROJECTION']);
  const transition = projection.transition;
  if (!transition || typeof transition !== 'object') return result('UNKNOWN', ['MISSING_TRANSITION_RELATION']);
  if (transition.kind === 'REPAIRED_NEXT_BATCH' && transition.previousExactDeclarationRetained === true && transition.nextGapExists === false) return result('NO_GAP_NEXT_IMMUTABLE_BATCH', ['LATER_UNIQUE_EXACT_DECLARATION']);
  if (transition.kind === 'EXISTING_DECLARATION_REGRESSION' && transition.previousExactDeclarationRetained === true && transition.nextGapExists === false) return result('UNCHANGED_NO_GAP', ['PREVIOUSLY_ADMITTED_EXACT_DECLARATIONS']);
  if (!HYPOTHESES.has(projection.architectureHypothesisId)) return result('UNKNOWN', ['UNKNOWN_ARCHITECTURE_HYPOTHESIS_IDENTIFIER']);
  if (projection.requirementId !== REQUIREMENT_ID) return result('UNKNOWN', ['REQUIREMENT_BINDING_MISMATCH']);
  if (typeof projection.providerIdentity !== 'string' || !projection.providerIdentity.trim()) return result('UNKNOWN', ['PROVIDER_IDENTITY_ABSENT']);
  if (!equalList(list(projection.consumerBindings), list(EXPECTED_BINDINGS))) return result('UNKNOWN', ['CONSUMER_BINDING_MISMATCH']);
  if (!equalList(list(projection.providerSelectors), list(DEMANDED_SELECTORS))) return result('UNKNOWN', ['EXACT_DEMANDED_SELECTOR_SET_MISSING']);
  if (projection.exactProviderCount !== 1) return projection.exactProviderCount > 1 ? result('HOLD_AMBIGUITY', ['MORE_THAN_ONE_EXACT_PROVIDER']) : result('UNKNOWN', ['UNIQUE_PROVIDER_ABSENT']);
  const declaration = projection.declaration;
  if (!declaration || typeof declaration !== 'object' || typeof declaration.schema !== 'string' || !declaration.schema || declaration.requirementId !== REQUIREMENT_ID || declaration.providerIdentity !== projection.providerIdentity) return result('UNKNOWN', ['EXACT_DECLARATION_RELATION_MISSING']);
  const implementation = projection.implementation;
  if (!implementation || implementation.exists !== true || implementation.regularFile !== true || typeof implementation.path !== 'string' || !implementation.path) return result('UNKNOWN', ['MISSING_IMPLEMENTATION_TARGET']);
  const boundary = projection.rootBoundary;
  if (!boundary || boundary.insideRoot !== true || boundary.symbolicTarget !== false || implementation.symbolic !== false) return result('UNKNOWN', ['PATH_BOUNDARY_OR_SYMBOLIC_VIOLATION']);
  if (declaration.implementationPath !== implementation.path || typeof declaration.implementationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(declaration.implementationSha256) || declaration.implementationSha256 !== implementation.sha256) return result('UNKNOWN', ['CONTENT_DIGEST_MISMATCH']);
  const permissions = projection.permissions;
  const required = permissions && list(permissions.required);
  const declared = permissions && list(permissions.declared);
  const declarationPermissions = list(declaration.permissions);
  if (!required || !declared || !declarationPermissions || required.some(permission => !declared.includes(permission) || !declarationPermissions.includes(permission))) return result('UNKNOWN', ['IMPLEMENTATION_PERMISSION_NOT_DECLARED']);
  return result('STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST', ['EXACT_SCHEMA', 'EXACT_REQUIREMENT', 'UNIQUE_PROVIDER', 'IMPLEMENTATION_CONTENT_BINDING', 'DECLARED_BOUNDARIES']);
}

module.exports = { PROJECTION_SCHEMA, REQUIREMENT_ID, EXPECTED_BINDINGS, DEMANDED_SELECTORS, evaluate };
`;
}

function baseProjection(examRequest) {
  const requirementId = examRequest.sourceHand.requirementId;
  const implementationDigest = 'a'.repeat(64);
  return {
    schema: RecipeCell.PROJECTION_SCHEMA,
    architectureHypothesisId: 'NEW_TYPED_PROVIDER_DECLARATION',
    requirementId,
    providerIdentity: `fixture-provider:${requirementId}`,
    consumerBindings: clone(examRequest.knownRelations.exactConsumerBindings),
    providerSelectors: clone(examRequest.knownRelations.demandedProviderSelectors),
    declaration: {
      schema: 'axm.mirror.synthetic-provider-declaration/v1',
      requirementId,
      providerIdentity: `fixture-provider:${requirementId}`,
      implementationPath: 'synthetic-provider/index.js',
      implementationSha256: implementationDigest,
      permissions: ['files:read']
    },
    implementation: { path: 'synthetic-provider/index.js', sha256: implementationDigest, exists: true, regularFile: true, symbolic: false },
    permissions: { required: ['files:read'], declared: ['files:read'] },
    exactProviderCount: 1,
    rootBoundary: { insideRoot: true, symbolicTarget: false },
    transition: { kind: 'CURRENT', previousExactDeclarationRetained: false, nextGapExists: true }
  };
}

function fixtureProjection(caseId, examRequest) {
  const projection = baseProjection(examRequest);
  if (caseId === 'PROVIDER_IDENTITY_MISSING') {
    projection.providerIdentity = null;
    projection.declaration.providerIdentity = null;
  } else if (caseId === 'DEMANDED_SELECTOR_COVERAGE_MISSING') {
    projection.providerSelectors = projection.providerSelectors.slice(1);
  } else if (caseId === 'IMPLEMENTATION_TARGET_MISSING') {
    projection.implementation.exists = false;
  } else if (caseId === 'IMPLEMENTATION_CONTENT_BINDING_MISMATCH') {
    projection.implementation.sha256 = 'b'.repeat(64);
  } else if (caseId === 'OUTSIDE_ROOT_OR_SYMBOLIC_TARGET') {
    projection.rootBoundary.insideRoot = false;
    projection.rootBoundary.symbolicTarget = true;
    projection.implementation.symbolic = true;
  } else if (caseId === 'DUPLICATE_OR_COMPETING_PROVIDER') {
    projection.exactProviderCount = 2;
  } else if (caseId === 'PERMISSION_DECLARATION_MISSING') {
    projection.permissions.declared = [];
    projection.declaration.permissions = [];
  } else if (caseId === 'REPAIRED_DECLARATION_REMOVES_NEXT_GAP') {
    projection.transition = { kind: 'REPAIRED_NEXT_BATCH', previousExactDeclarationRetained: true, nextGapExists: false };
  } else if (caseId === 'EXISTING_DECLARATION_REGRESSION') {
    projection.transition = { kind: 'EXISTING_DECLARATION_REGRESSION', previousExactDeclarationRetained: true, nextGapExists: false };
  }
  return projection;
}

function fixtureManifest(examRequest) {
  RecipeCell.verifyExam(examRequest);
  return {
    schema: 'axm.mirror.provider-declaration-research-executor-fixture-manifest/v1',
    examRequestId: examRequest.examRequestId,
    examRequestDigest: examRequest.examRequestDigest,
    fixtureAuthor: ORGAN_ID,
    fixtureSource: 'IMMUTABLE_PRE_CANDIDATE_RESEARCH_EXAM',
    futureCandidateMayAuthorExpectedOutcomes: false,
    futureCandidateMayAuthorHeldOutFixtures: false,
    architectureEvaluated: false,
    cases: examRequest.caseFamilies.map(item => ({
      caseId: item.caseId,
      applicable: item.applicable,
      heldOut: item.heldOut,
      expectedState: item.expectedState,
      requiredEvidence: clone(item.requiredEvidence),
      projection: item.applicable ? fixtureProjection(item.caseId, examRequest) : null
    })),
    boundary: 'Synthetic relation projections test only whether the fixed executor distinguishes the ten pre-authored case families. They contain no real provider candidate and establish no architecture fit, availability, runtime health, or readiness.'
  };
}

function contractDocument(examRequest, recipe) {
  return {
    schema: 'axm.mirror.disposable-provider-declaration-research-executor-contract/v1',
    status: 'TEST',
    examRequestId: examRequest.examRequestId,
    examRequestDigest: examRequest.examRequestDigest,
    recipeId: recipe.recipeId,
    recipeDigest: recipe.recipeDigest,
    executorKind: RecipeCell.EXECUTOR_KIND,
    inputSchema: RecipeCell.PROJECTION_SCHEMA,
    outputStates: ['STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST', 'UNKNOWN', 'HOLD_AMBIGUITY', 'NOT_APPLICABLE', 'NO_GAP_NEXT_IMMUTABLE_BATCH', 'UNCHANGED_NO_GAP'],
    positiveStateCeiling: 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST',
    architectureSelected: false,
    architectureEvaluated: false,
    installed: false,
    liveExecutionApproved: false,
    permissions: [],
    refuses: ['provider-inference', 'architecture-selection', 'architecture-fitness-claim', 'availability-claim', 'readiness-claim', 'Workshop-write', 'provider-write', 'installation', 'live-execution', 'training-admission', 'promotion']
  };
}

function testSource() {
  return `'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Executor = require('./executor');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }

const manifestFile = path.join(__dirname, 'fixture-manifest.json');
const manifestBytes = fs.readFileSync(manifestFile);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const caseResults = manifest.cases.map(item => {
  const observed = item.applicable ? Executor.evaluate(item.projection) : { state: 'NOT_APPLICABLE', evidence: item.requiredEvidence, architectureFitEstablished: false, readinessEstablished: false };
  return {
    caseId: item.caseId,
    applicable: item.applicable,
    heldOut: item.heldOut,
    expectedState: item.expectedState,
    observedState: observed.state,
    passed: observed.state === item.expectedState && observed.architectureFitEstablished === false && observed.readinessEstablished === false
  };
});
const failed = caseResults.filter(item => !item.passed).length;
process.stdout.write(JSON.stringify({
  fixtureManifestSha256: digest(manifestBytes),
  caseResults,
  summary: { total: caseResults.length, passed: caseResults.length - failed, failed, notApplicable: caseResults.filter(item => item.observedState === 'NOT_APPLICABLE').length },
  state: failed ? 'FAIL' : 'PASS',
  architectureEvaluated: false
}));
`;
}

function candidatePlan(examRequest, recipe, lineage = sourceLineage()) {
  RecipeCell.verifyExam(examRequest);
  RecipeCell.evaluate({ examRequest, recipe });
  const projectionSchema = fs.readFileSync(path.resolve(__dirname, '..', 'contracts', 'provider-declaration-architecture-projection.schema.json'), 'utf8');
  const files = {
    'executor.js': executorSource(examRequest),
    'contract.json': json(contractDocument(examRequest, recipe)),
    'candidate-projection.schema.json': projectionSchema.endsWith('\n') ? projectionSchema : `${projectionSchema}\n`,
    'fixture-manifest.json': json(fixtureManifest(examRequest)),
    'test.js': testSource()
  };
  const fileReceipts = Object.keys(files).sort().map(name => ({ name, sha256: digest(Buffer.from(files[name], 'utf8')), bytes: Buffer.byteLength(files[name], 'utf8') }));
  const basis = {
    organ: ORGAN_ID,
    generationContract: GENERATION_CONTRACT,
    sourceLineage: lineage,
    examRequestId: examRequest.examRequestId,
    examRequestDigest: examRequest.examRequestDigest,
    recipeId: recipe.recipeId,
    recipeDigest: recipe.recipeDigest,
    files: fileReceipts
  };
  const candidateDigest = digest(basis);
  return { candidateId: `provider-declaration-research-executor-${candidateDigest.slice(0, 20)}`, candidateDigest, files, fileReceipts };
}

function runFixtures(candidateDir, examRequest, recipe, candidateId) {
  const execution = childProcess.spawnSync(process.execPath, ['test.js'], { cwd: candidateDir, encoding: 'utf8', timeout: 10000, windowsHide: true });
  if (execution.error || execution.status !== 0) throw new Error(`provider declaration research executor fixture process failed: ${execution.error ? execution.error.message : execution.stderr}`);
  let observed;
  try { observed = JSON.parse(execution.stdout); } catch (error) { throw new Error(`provider declaration research executor fixture receipt is invalid JSON: ${error.message}`); }
  const receipt = {
    schema: RECEIPT_SCHEMA,
    receiptDigest: null,
    examRequestId: examRequest.examRequestId,
    recipeId: recipe.recipeId,
    executorCandidateId: candidateId,
    fixtureManifestSha256: observed.fixtureManifestSha256,
    caseResults: observed.caseResults,
    summary: observed.summary,
    state: observed.state,
    architectureEvaluated: false,
    authority: {
      architectureSelection: false,
      architectureFitnessClaim: false,
      availabilityClaim: false,
      readinessClaim: false,
      providerWrite: false,
      workshopWrite: false,
      installation: false,
      liveExecution: false,
      trainingAdmission: false,
      promotion: false
    },
    boundary: 'This receipt proves only that the disposable executor matched the ten synthetic held-out relation cases. No provider architecture or live state was evaluated.'
  };
  if (observed.architectureEvaluated !== false || !Array.isArray(receipt.caseResults) || receipt.caseResults.length !== 10 || receipt.summary.total !== 10) throw new Error('provider declaration research executor fixture boundary or case count changed');
  receipt.receiptDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  return receipt;
}

function truthfulActionId(admission) {
  return admission.classification === 'APPROVED_DISPOSABLE_EXECUTOR_BUILD'
    ? `build-disposable-relation-executor-${admission.recipeId}`
    : `hold-provider-declaration-research-executor-${admission.recipeId}`;
}

function reasoningInput(admission) {
  const truthful = truthfulActionId(admission);
  const selfProof = `claim-architecture-fit-from-executor-selftest-${admission.recipeId}`;
  const bypass = `build-unreviewed-provider-or-live-executor-${admission.recipeId}`;
  const approved = admission.classification === 'APPROVED_DISPOSABLE_EXECUTOR_BUILD';
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-declaration-research-executor-builder-${digest(admission.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-review-bound-provider-declaration-research-executor-builder' },
    goal: 'Follow the exact reviewed executor admission while preserving architecture uncertainty and every world-facing gate.',
    evidence: [{
      id: 'research-executor-admission', kind: 'observation', status: 'observed',
      statement: `${admission.examRequestId} admission is ${admission.classification}.`,
      source: { kind: 'provider-declaration-research-executor-recipe-admission', id: admission.assessmentDigest, uri: `sha256:${admission.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Recomputed digest-bound attributed review admission.' }
    }],
    unknowns: [{ id: 'architecture-fitness', question: 'Will any real provider-declaration architecture pass independent evidence and live review?', blocking: true }],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: approved ? 'Build and fixture-test only the fixed disposable relation executor in ignored private state' : 'Preserve the attributed HOLD and generate no executor candidate', supportingEvidence: ['research-executor-admission'], preconditionEvidence: ['research-executor-admission'], requiredPermissions: [], expectedEffects: ['A disposable research instrument or explicit hold is recorded without changing active architecture.'], possibleSideEffects: ['Synthetic executor success could be mistaken for architecture fitness.'], reversible: true, recovery: 'Discard the ignored-state candidate directory while retaining the immutable review trace.', risk: 'low' },
      { id: selfProof, kind: 'proposal', label: 'Treat executor self-test success as proof that an architecture fits', supportingEvidence: ['research-executor-admission'], preconditionEvidence: ['research-executor-admission'], requiredPermissions: [], expectedEffects: ['Synthetic discrimination would become a false architecture result.'], possibleSideEffects: ['Mirror could select an untested provider architecture.'], reversible: false, recovery: 'Reject the inference and preserve every hypothesis as UNTESTED.', risk: 'high' },
      { id: bypass, kind: 'proposal', label: 'Build a provider or live executor outside the reviewed fixed recipe', supportingEvidence: ['research-executor-admission'], preconditionEvidence: ['research-executor-admission'], requiredPermissions: [], expectedEffects: ['Review and architecture gates would be bypassed.'], possibleSideEffects: ['Unreviewed code or provider facts could affect live state.'], reversible: false, recovery: 'Refuse the bypass and preserve the declaration gap.', risk: 'high' }
    ],
    decomposition: [{ id: 'separate-instrument-from-answer', question: 'Does a reviewed disposable test instrument answer the architecture question it is designed to test later?', dependsOn: [], cheapestCheck: 'Compare its synthetic fixture scope with absent real candidate and live evidence.', status: 'ANSWERED', answerEvidenceRefs: ['research-executor-admission'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `truthful-${admission.recipeId}`, approach: 'Follow admission exactly and preserve all no-architecture and no-live boundaries.', requiredEvidence: ['research-executor-admission'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['Candidate escapes ignored state or claims architecture fitness.'], strategyTags: ['review-bound-disposable-research-instrument'] },
      { actionId: selfProof, pathId: `self-proof-${admission.recipeId}`, approach: 'Confuse fixture discrimination with independent architecture evidence.', requiredEvidence: ['research-executor-admission'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No real architecture candidate was evaluated.'], strategyTags: ['reject-self-certification'] },
      { actionId: bypass, pathId: `bypass-${admission.recipeId}`, approach: 'Treat review wording as general build permission.', requiredEvidence: ['research-executor-admission'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Admission authorizes only one fixed ignored-state instrument.'], strategyTags: ['reject-review-boundary-bypass'] }
    ],
    verificationReceipts: [
      { id: `verify-truthful-${admission.recipeId}`, actionId: truthful, claim: 'The action exactly follows the reviewed admission without selecting or testing an architecture.', evidenceRefs: ['research-executor-admission'], method: 'Recompute admission and compare generated authority.', result: 'PASS', limitations: ['Does not establish architecture fitness, live validity, availability, or readiness.'] },
      { id: `verify-self-proof-${admission.recipeId}`, actionId: selfProof, claim: 'Passing synthetic executor fixtures establishes provider architecture fitness.', evidenceRefs: ['research-executor-admission'], method: 'Check whether a real architecture candidate or live declaration was supplied.', result: 'FAIL', limitations: ['A later independently reviewed real experiment could supply relevant evidence.'] },
      { id: `verify-bypass-${admission.recipeId}`, actionId: bypass, claim: 'The admission grants provider construction or live execution authority.', evidenceRefs: ['research-executor-admission'], method: 'Inspect the fixed executor recipe and authority map.', result: 'FAIL', limitations: ['A separate later gate could grant tightly scoped work.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('provider declaration research executor builder requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('provider declaration research executor builder session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const selfProof = session.pathSet.comparisons.find(item => item.actionId === result.selfProofActionId);
  const bypass = session.pathSet.comparisons.find(item => item.actionId === result.bypassActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !selfProof || selfProof.verificationStatus !== 'FAIL' || selfProof.eligible || !bypass || bypass.verificationStatus !== 'FAIL' || bypass.eligible) throw new Error('provider declaration research executor builder discrimination changed');
  return true;
}

function expectedSummary(results) {
  return {
    reviewedRecipes: results.length,
    approvedRecipes: results.filter(item => item.admission.classification === 'APPROVED_DISPOSABLE_EXECUTOR_BUILD').length,
    heldRecipes: results.filter(item => item.admission.classification === 'HELD_EXECUTOR_NOT_APPROVED').length,
    executorCandidatesBuilt: results.filter(item => item.candidate).length,
    candidateFilesGenerated: results.reduce((sum, item) => sum + (item.candidate ? item.candidate.files.length : 0), 0),
    fixtureCasesExecuted: results.reduce((sum, item) => sum + (item.fixtureReceipt ? item.fixtureReceipt.caseResults.filter(entry => entry.applicable).length : 0), 0),
    fixtureCasesNotApplicable: results.reduce((sum, item) => sum + (item.fixtureReceipt ? item.fixtureReceipt.caseResults.filter(entry => !entry.applicable).length : 0), 0),
    fixtureSuitesPassed: results.filter(item => item.fixtureReceipt && item.fixtureReceipt.state === 'PASS').length,
    fixtureSuitesFailed: results.filter(item => item.fixtureReceipt && item.fixtureReceipt.state !== 'PASS').length,
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    falseArchitectureProofCandidatesRejected: results.filter(item => item.selfProofRejected).length,
    reviewBypassCandidatesRejected: results.filter(item => item.reviewBypassRejected).length,
    architecturesSelected: 0,
    architecturesEvaluated: 0,
    providerCandidatesBuilt: 0,
    providerDeclarationsWritten: 0,
    liveExperimentsExecuted: 0,
    workshopFilesChanged: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyCandidate(result, runDir, lineage, rerunFixtures) {
  if (!result.candidate) return true;
  const plan = candidatePlan(result.examRequest, result.recipe, lineage);
  if (result.candidate.candidateId !== plan.candidateId || result.candidate.candidateDigest !== plan.candidateDigest || !same(result.candidate.files, plan.fileReceipts)) throw new Error('provider declaration research executor candidate receipt mismatch');
  if (!runDir) return true;
  const candidateDir = path.resolve(runDir, result.candidate.directory || '');
  if (!inside(runDir, candidateDir) || !fs.existsSync(candidateDir)) throw new Error(`provider declaration research executor candidate directory missing: ${result.candidate.candidateId}`);
  for (const receipt of plan.fileReceipts) {
    const file = path.resolve(candidateDir, receipt.name);
    if (!inside(candidateDir, file) || !fs.existsSync(file)) throw new Error(`provider declaration research executor candidate file missing: ${receipt.name}`);
    const bytes = fs.readFileSync(file);
    if (digest(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes || bytes.toString('utf8') !== plan.files[receipt.name]) throw new Error(`provider declaration research executor candidate file hash mismatch: ${receipt.name}`);
  }
  if (rerunFixtures) {
    const receipt = runFixtures(candidateDir, result.examRequest, result.recipe, result.candidate.candidateId);
    if (receipt.state !== 'PASS' || !same(receipt, result.fixtureReceipt)) throw new Error(`provider declaration research executor fixture receipt mismatch: ${result.candidate.candidateId}`);
  }
  return true;
}

function verifyBatch(batch, runDir, researchExamBatch, rerunFixtures = false) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider declaration research executor builder batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('provider declaration research executor builder identity changed');
  if (!batch.authority || batch.authority.disposableCandidateWrite !== true || batch.authority.sandboxFixtureExecution !== true || Object.entries(batch.authority).some(([key, value]) => !['disposableCandidateWrite', 'sandboxFixtureExecution'].includes(key) && value !== false)) throw new Error('provider declaration research executor builder authority boundary changed');
  const lineage = sourceLineage();
  if (!same(batch.sourceLineage, lineage)) throw new Error('provider declaration research executor builder source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RECIPES) throw new Error('provider declaration research executor recipe bound changed');
  const inputBasis = { organ: ORGAN_ID, generationContract: GENERATION_CONTRACT, sourceLineage: lineage, sourceResearchExamBatch: batch.sourceResearchExamBatch, recipes: batch.results.map(item => item.recipe), admissions: batch.results.map(item => item.admission) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-research-executors-${inputsDigest.slice(0, 20)}`) throw new Error('provider declaration research executor builder input lineage mismatch');
  if (researchExamBatch) {
    ResearchExams.verifyBatch(researchExamBatch);
    if (batch.sourceResearchExamBatch.batchId !== researchExamBatch.batchId || batch.sourceResearchExamBatch.batchDigest !== researchExamBatch.batchDigest) throw new Error('provider declaration research executor source exam batch changed');
  }
  const sourceRequests = researchExamBatch ? new Map(researchExamBatch.results.filter(item => item.researchExamRequest).map(item => [item.researchExamRequest.examRequestId, item.researchExamRequest])) : null;
  const ids = new Set();
  for (const result of batch.results) {
    if (!result.recipe || ids.has(result.recipe.recipeId)) throw new Error('reviewed provider declaration research executor recipes must be present and unique');
    ids.add(result.recipe.recipeId);
    if (sourceRequests && !same(sourceRequests.get(result.examRequest.examRequestId), result.examRequest)) throw new Error('provider declaration research executor exam is absent from source batch');
    const admission = RecipeCell.evaluate({ examRequest: result.examRequest, recipe: result.recipe });
    if (!same(admission, result.admission)) throw new Error('provider declaration research executor admission changed');
    const approved = admission.classification === 'APPROVED_DISPOSABLE_EXECUTOR_BUILD';
    if (approved !== !!result.candidate || approved !== !!result.fixtureReceipt) throw new Error('provider declaration research executor build does not follow reviewed admission');
    if (result.fixtureReceipt && (result.fixtureReceipt.state !== 'PASS' || result.fixtureReceipt.architectureEvaluated !== false || result.fixtureReceipt.receiptDigest !== digest(Object.assign({}, result.fixtureReceipt, { receiptDigest: null })))) throw new Error('provider declaration research executor fixture receipt is invalid');
    if (!result.behaviorMatched || !result.selfProofRejected || !result.reviewBypassRejected || result.architectureSelected || result.architectureEvaluated || result.providerCandidateBuilt || result.providerDeclarationWritten || result.liveExperimentExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider declaration research executor result exceeds disposable boundary');
    verifyCandidate(result, runDir, lineage, rerunFixtures);
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider declaration research executor session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider declaration research executor session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`provider declaration research executor session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (!same(batch.summary, expectedSummary(batch.results))) throw new Error('provider declaration research executor builder summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-research-executor-builder-runs'));
  if (!inside(root, stateDir)) throw new Error('provider declaration research executor private state must stay inside Mirror root');
  const researchDerived = options.researchDerived || ResearchExams.derive(Object.assign({}, options.researchOptions || {}, { root, workshopRoot }));
  ResearchExams.verifyBatch(researchDerived.batch, researchDerived.runDir, researchDerived.providerDerived);
  const recipes = Array.isArray(options.recipes) ? options.recipes.map(clone).sort((a, b) => String(a.recipeId || '').localeCompare(String(b.recipeId || ''))) : [];
  if (recipes.length > MAX_RECIPES) throw new Error(`provider declaration research executor builder holds: ${recipes.length} recipes exceed ${MAX_RECIPES}`);
  const examRequests = new Map(researchDerived.batch.results.filter(item => item.researchExamRequest).map(item => [item.researchExamRequest.examRequestId, item.researchExamRequest]));
  const seen = new Set();
  const prepared = recipes.map(recipe => {
    if (!recipe || seen.has(recipe.recipeId)) throw new Error('reviewed provider declaration research executor recipes must be present and unique');
    seen.add(recipe.recipeId);
    const examRequest = examRequests.get(recipe.examRequestId);
    if (!examRequest) throw new Error(`reviewed provider declaration research executor exam is not in the current research batch: ${recipe.examRequestId}`);
    const admission = RecipeCell.evaluate({ examRequest, recipe });
    return { recipe, examRequest: clone(examRequest), admission };
  });
  const lineage = sourceLineage();
  const sourceResearchExamBatch = { batchId: researchDerived.batch.batchId, batchDigest: researchDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, generationContract: GENERATION_CONTRACT, sourceLineage: lineage, sourceResearchExamBatch, recipes: prepared.map(item => item.recipe), admissions: prepared.map(item => item.admission) };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-research-executors-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, researchDerived.batch, true);
    return { batch, runDir, reused: true, researchDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.s-${digest(batchId).slice(0, 12)}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 's'), { recursive: true });
  fs.mkdirSync(path.join(stageDir, 'c'), { recursive: true });
  const results = prepared.map(item => {
    const session = Foundation.run(reasoningInput(item.admission), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(item.admission);
    const selfProofActionId = `claim-architecture-fit-from-executor-selftest-${item.admission.recipeId}`;
    const bypassActionId = `build-unreviewed-provider-or-live-executor-${item.admission.recipeId}`;
    const selfProof = session.pathSet.comparisons.find(entry => entry.actionId === selfProofActionId);
    const bypass = session.pathSet.comparisons.find(entry => entry.actionId === bypassActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sessionFile = path.join('s', `${digest(item.admission.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const sessionBytes = Buffer.from(json(session), 'utf8');
    const approved = item.admission.classification === 'APPROVED_DISPOSABLE_EXECUTOR_BUILD';
    let candidate = null;
    let fixtureReceipt = null;
    if (approved) {
      const plan = candidatePlan(item.examRequest, item.recipe, lineage);
      const candidateDirectory = path.join('c', plan.candidateDigest.slice(0, 20)).replace(/\\/g, '/');
      const candidateDir = path.join(stageDir, candidateDirectory);
      fs.mkdirSync(candidateDir, { recursive: true });
      for (const [name, content] of Object.entries(plan.files)) fs.writeFileSync(path.join(candidateDir, name), content, { encoding: 'utf8', flag: 'wx' });
      fixtureReceipt = runFixtures(candidateDir, item.examRequest, item.recipe, plan.candidateId);
      if (fixtureReceipt.state !== 'PASS') throw new Error(`provider declaration research executor candidate fixtures failed: ${plan.candidateId}`);
      candidate = {
        candidateId: plan.candidateId,
        candidateDigest: plan.candidateDigest,
        directory: candidateDirectory,
        files: plan.fileReceipts,
        state: 'DISPOSABLE_RESEARCH_EXECUTOR_FIXTURES_PASS_NO_ARCHITECTURE_EVALUATED_NOT_INSTALLED'
      };
    }
    const result = {
      recipe: item.recipe,
      examRequest: item.examRequest,
      admission: item.admission,
      expectedDecision: { value: 1, actionId: expectedAction },
      selfProofActionId,
      bypassActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      selfProofRejected: !!selfProof && selfProof.verificationStatus === 'FAIL' && selfProof.eligible === false,
      reviewBypassRejected: !!bypass && bypass.verificationStatus === 'FAIL' && bypass.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(sessionBytes),
      sessionDigest: digest(session),
      candidate,
      fixtureReceipt,
      architectureSelected: false,
      architectureEvaluated: false,
      providerCandidateBuilt: false,
      providerDeclarationWritten: false,
      liveExperimentExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    };
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), sessionBytes, { flag: 'wx' });
    return result;
  });
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_REVIEW_BOUND_DISPOSABLE_PROVIDER_DECLARATION_RESEARCH_EXECUTOR_BUILDER', learnedWeights: false },
    cell: { id: RecipeCell.CELL_ID, schema: RecipeCell.SCHEMA, learnedWeights: false },
    generationContract: GENERATION_CONTRACT,
    sourceLineage: lineage,
    sourceResearchExamBatch,
    results,
    summary: expectedSummary(results),
    authority: {
      disposableCandidateWrite: true,
      sandboxFixtureExecution: true,
      architectureSelection: false,
      candidateArchitectureAuthoring: false,
      expectedOutcomeMutation: false,
      heldOutFixtureAuthoringByCandidate: false,
      liveArchitectureEvaluation: false,
      architectureFitnessClaim: false,
      availabilityClaim: false,
      readinessClaim: false,
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
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      networkUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Only an exact digest-bound HUMAN-reviewed recipe can generate the fixed executor under ignored private state and run the ten pre-authored synthetic fixture families. No architecture is selected or evaluated; no provider or declaration is authored; nothing is installed, run live, written to Workshop, trained, promoted, or called available or ready.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, researchDerived.batch, true);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, researchDerived };
}

function respond(batchOrDerived) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  let state = 'NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED';
  if (batch.summary.executorCandidatesBuilt) state = 'DISPOSABLE_RESEARCH_EXECUTORS_FIXTURE_TESTED_NO_ARCHITECTURE_EVALUATED_NOT_INSTALLED';
  else if (batch.summary.reviewedRecipes) state = 'REVIEWED_EXECUTOR_RECIPES_HELD_NO_CANDIDATES_BUILT';
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    state,
    summary: clone(batch.summary),
    candidates: batch.results.filter(item => item.candidate).map(item => ({
      recipeId: item.recipe.recipeId,
      examRequestId: item.examRequest.examRequestId,
      candidate: clone(item.candidate),
      fixtureState: item.fixtureReceipt.state,
      architectureEvaluated: false,
      installed: false
    })),
    holds: batch.results.filter(item => !item.candidate).map(item => ({
      recipeId: item.recipe.recipeId,
      examRequestId: item.examRequest.examRequestId,
      admission: item.admission.classification,
      state: 'HELD_NO_EXECUTOR_CANDIDATE'
    })),
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, RECEIPT_SCHEMA, MAX_RECIPES, GENERATION_CONTRACT,
  digest, sourceLineage, executorSource, baseProjection, fixtureProjection, fixtureManifest, contractDocument,
  testSource, candidatePlan, runFixtures, truthfulActionId, reasoningInput, verifySession, expectedSummary,
  verifyCandidate, verifyBatch, derive, respond
};
