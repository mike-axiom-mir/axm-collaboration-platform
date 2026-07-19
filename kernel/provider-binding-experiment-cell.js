'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/provider-binding-experiment-frame-v1';
const MATRIX_SCHEMA = 'axm.mirror.provider-declaration-binding-experiment-matrix/v1';
const FRAME_SCHEMA = 'axm.mirror.provider-declaration-binding-experiment-frame/v1';
const POSITIVE_HYPOTHESES = Object.freeze([
  'REUSE_TYPED_SHARED_SERVICE_DECLARATION',
  'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION',
  'NEW_TYPED_PROVIDER_DECLARATION'
]);
const AUTHORITY = Object.freeze({
  providerIdentityInference: false,
  outerRequirementBinding: false,
  declarationSchemaSelection: false,
  declarationPathSelection: false,
  permissionInference: false,
  permissionGrant: false,
  sourceExecution: false,
  experimentFrameSelection: false,
  implementationSelection: false,
  architectureSelection: false,
  architectureEvaluation: false,
  providerCandidateBuild: false,
  providerContractWrite: false,
  declarationWrite: false,
  workshopWrite: false,
  readinessClaim: false,
  availabilityClaim: false,
  liveExecution: false,
  install: false,
  automaticStart: false,
  automaticRepair: false,
  trainingAdmission: false,
  toolUse: false,
  networkUse: false,
  worldAction: false,
  semanticTruthWrite: false,
  runtimePromotion: false,
  canonChange: false,
  identityChange: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function unique(values) { return Array.from(new Set((values || []).map(item => clean(item, 300)).filter(Boolean))).sort(); }
function authorityClosed(value) { return value && Object.values(value).every(item => item === false); }

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('provider binding experiment cell requires an object');
  const allowed = new Set(['requirementId', 'evidenceSurvey', 'architectureSurvey', 'researchExamRequest']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`provider binding experiment cell refuses unknown critical field: ${key}`);
  const requirementId = clean(input.requirementId, 200);
  const evidence = input.evidenceSurvey;
  const architecture = input.architectureSurvey;
  const exam = input.researchExamRequest;
  if (!requirementId) throw new Error('provider binding experiment cell requires requirementId');
  if (!evidence || evidence.schema !== 'axm.mirror.provider-declaration-implementation-evidence-survey/v1') throw new Error('provider binding experiment cell requires a typed implementation evidence survey');
  if (!architecture || architecture.schema !== 'axm.mirror.provider-declaration-architecture-pattern-survey/v1') throw new Error('provider binding experiment cell requires a typed architecture survey');
  if (!exam || exam.schema !== 'axm.mirror.provider-declaration-research-exam-request/v1') throw new Error('provider binding experiment cell requires a typed research exam');
  if (evidence.requirementId !== requirementId || architecture.requirementId !== requirementId || !exam.sourceHand || exam.sourceHand.requirementId !== requirementId) throw new Error('provider binding experiment requirement lineage mismatch');
  if (evidence.sourceArchitectureSurveyId !== architecture.surveyId || evidence.sourceArchitectureSurveyDigest !== architecture.surveyDigest) throw new Error('provider binding experiment architecture lineage mismatch');
  if (architecture.examRequestId !== exam.examRequestId || architecture.examRequestDigest !== exam.examRequestDigest) throw new Error('provider binding experiment exam lineage mismatch');
  if (!same(unique(evidence.demandedProviderSelectors), unique(architecture.demandedProviderSelectors)) || !same(unique(evidence.demandedProviderSelectors), unique(exam.knownRelations && exam.knownRelations.demandedProviderSelectors))) throw new Error('provider binding experiment selector lineage mismatch');
  if (evidence.providerIdentityInferred || evidence.outerRequirementBound || evidence.implementationSelected || evidence.sourceExecuted) throw new Error('provider binding experiment source already exceeds evidence authority');
  if (!authorityClosed(evidence.authority) || !authorityClosed(architecture.authority) || !authorityClosed(exam.authority)) throw new Error('provider binding experiment requires authority-closed source evidence');
  return { requirementId, evidence, architecture, exam };
}

function categorizeSource(source, demandedSelectors) {
  const exact = unique(source && source.exactSelectorLiterals).filter(item => demandedSelectors.includes(item));
  const document = source && source.document || {};
  const signals = source && source.sourceSignals || {};
  let role = 'VALIDATION_ONLY_NOT_EXPORTED';
  let eligible = false;
  let reason = 'An exact selector witness without an exported surface remains validation evidence only.';
  if (document.symbolic || document.insideRoot !== true || (document.lexicalErrors || []).length) {
    role = 'REFUSED_BOUNDARY_OR_LEXICAL_SOURCE';
    reason = 'Boundary-invalid or lexically malformed source cannot become an experiment input.';
  } else if (signals.selftestPath || source.classification === 'SELECTOR_BEARING_TEST_SOURCE') {
    role = 'INDEPENDENT_TEST_WITNESS_NOT_IMPLEMENTATION_CANDIDATE';
    reason = 'A test witness is reserved as independent validation evidence and cannot be selected as the implementation.';
  } else if (signals.commonJsExportSyntax === true && exact.length) {
    role = 'IMPLEMENTATION_EXPERIMENT_INPUT_CANDIDATE';
    eligible = true;
    reason = 'The content-digested exported source may be tested as an implementation input, but is not bound as the provider.';
  }
  return {
    sourceAssessmentDigest: source.assessmentDigest,
    document: clone(document),
    classification: source.classification,
    exactDemandedSelectorLiterals: exact,
    sourceSignals: clone(signals),
    role,
    eligibleForExperimentFrame: eligible,
    providerIdentityBound: false,
    outerRequirementBound: false,
    implementationSelected: false,
    reason
  };
}

function createFrame(requirementId, source, hypothesis, exam, demandedSelectors) {
  const witnessed = unique(source.exactDemandedSelectorLiterals);
  const missingSelectors = demandedSelectors.filter(item => !witnessed.includes(item));
  const requiredRelations = unique(hypothesis.mustDemonstrate);
  const unresolved = unique([].concat(exam.unresolvedDimensions || [], requiredRelations, [
    'EXPLICIT_OUTER_REQUIREMENT_TO_PROVIDER_BINDING',
    'ATTRIBUTED_PROVIDER_IDENTITY_DECISION',
    'DECLARED_PROVIDER_PERMISSIONS'
  ], missingSelectors.length ? ['COMPLETE_DEMANDED_SELECTOR_SET'] : []));
  const basis = {
    schema: FRAME_SCHEMA,
    requirementId,
    sourceEvidence: {
      sourceAssessmentDigest: source.sourceAssessmentDigest,
      relativePath: source.document.relativePath,
      sha256: source.document.sha256,
      bytes: source.document.bytes,
      classification: source.classification,
      exactDemandedSelectorLiterals: witnessed,
      sourceSignals: clone(source.sourceSignals)
    },
    architectureHypothesis: {
      hypothesisId: hypothesis.hypothesisId,
      state: 'UNTESTED',
      requiredRelations,
      architectureSelected: false,
      architectureEvaluated: false
    },
    candidateInputs: {
      subjectRequirementId: requirementId,
      demandedProviderSelectors: clone(demandedSelectors),
      exactConsumerBindings: clone(exam.knownRelations && exam.knownRelations.exactConsumerBindings || []),
      proposedImplementationRelativePath: source.document.relativePath,
      proposedImplementationSha256: source.document.sha256,
      selectorLiteralsWitnessedInSource: witnessed,
      selectorSetCompletelyWitnessedInSource: missingSelectors.length === 0,
      missingSelectorLiterals: missingSelectors,
      providerIdentity: 'UNRESOLVED_NOT_INFERRED',
      declarationSchema: 'UNRESOLVED_NOT_SELECTED',
      declarationTargetRelativePath: null,
      providerPermissions: null,
      permissionEvidenceState: 'UNRESOLVED_NOT_INFERRED_FROM_CONSUMER_OR_SOURCE'
    },
    independentExam: {
      examRequestId: exam.examRequestId,
      examRequestDigest: exam.examRequestDigest,
      caseFamilies: (exam.caseFamilies || []).map(item => ({ caseId: item.caseId, expectedState: item.expectedState, heldOut: item.heldOut === true })),
      candidateMayAuthorExpectedOutcomes: false,
      candidateMayAuthorHeldOutFixtures: false,
      independentEvaluatorRequired: true
    },
    unresolvedRelations: unresolved,
    selectionState: 'NOT_SELECTED',
    providerBindingEstablished: false,
    implementationSelected: false,
    sourceExecuted: false,
    architectureSelected: false,
    architectureEvaluated: false,
    providerCandidateBuilt: false,
    providerDeclarationWritten: false,
    state: 'REVIEWABLE_PROVIDER_BINDING_EXPERIMENT_FRAME_NOT_SELECTED_NOT_EXECUTED',
    authority: clone(AUTHORITY),
    boundary: 'This frame joins one content-digested exported selector source with one UNTESTED architecture hypothesis as an experiment input. It is not a provider binding, provider identity, permission inference, architecture choice, implementation selection, declaration, execution, training example, or Workshop write.'
  };
  const experimentFrameId = `provider-binding-experiment-frame-${digest(basis).slice(0, 20)}`;
  const frame = Object.assign({ experimentFrameId, experimentFrameDigest: null }, basis);
  frame.experimentFrameDigest = digest(Object.assign({}, frame, { experimentFrameDigest: null }));
  return frame;
}

function evaluate(input) {
  const { requirementId, evidence, architecture, exam } = validateInput(input);
  const demandedSelectors = unique(evidence.demandedProviderSelectors);
  const categorized = (evidence.selectorSources || []).map(item => categorizeSource(item, demandedSelectors)).sort((a, b) => String(a.document.relativePath).localeCompare(String(b.document.relativePath)) || a.sourceAssessmentDigest.localeCompare(b.sourceAssessmentDigest));
  const candidateSources = categorized.filter(item => item.eligibleForExperimentFrame);
  const validationWitnesses = categorized.filter(item => !item.eligibleForExperimentFrame);
  const hypotheses = (exam.architectureHypotheses || []).filter(item => POSITIVE_HYPOTHESES.includes(item.hypothesisId) && item.state === 'UNTESTED').map(clone).sort((a, b) => a.hypothesisId.localeCompare(b.hypothesisId));
  const fallback = (exam.architectureHypotheses || []).find(item => item.hypothesisId === 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT') || null;
  const frames = [];
  for (const source of candidateSources) for (const hypothesis of hypotheses) frames.push(createFrame(requirementId, source, hypothesis, exam, demandedSelectors));
  frames.sort((a, b) => a.experimentFrameId.localeCompare(b.experimentFrameId));
  const basis = {
    schema: MATRIX_SCHEMA,
    cellId: CELL_ID,
    sourceEvidenceSurvey: { evidenceSurveyId: evidence.evidenceSurveyId, evidenceSurveyDigest: evidence.evidenceSurveyDigest },
    sourceArchitectureSurvey: { surveyId: architecture.surveyId, surveyDigest: architecture.surveyDigest },
    sourceResearchExam: { examRequestId: exam.examRequestId, examRequestDigest: exam.examRequestDigest },
    requirementId,
    demandedProviderSelectors: demandedSelectors,
    candidateSources,
    validationWitnesses,
    hypothesesRepresented: hypotheses.map(item => ({ hypothesisId: item.hypothesisId, state: 'UNTESTED' })),
    unresolvedFallback: fallback ? { hypothesisId: fallback.hypothesisId, state: 'UNTESTED', selected: false } : null,
    experimentFrames: frames,
    selectedFrameId: null,
    selectionState: 'NO_EXPERIMENT_FRAME_SELECTED',
    providerIdentityInferred: false,
    outerRequirementBound: false,
    permissionsInferred: false,
    implementationSelected: false,
    sourceExecuted: false,
    architectureSelected: false,
    architectureEvaluated: false,
    providerCandidateBuilt: false,
    providerDeclarationWritten: false,
    state: frames.length ? 'PROPOSED_BALANCED_PROVIDER_BINDING_EXPERIMENT_MATRIX_NOT_SELECTED' : 'NO_ELIGIBLE_IMPLEMENTATION_EXPERIMENT_INPUT_PRESERVE_UNRESOLVED',
    authority: clone(AUTHORITY),
    boundary: 'Every eligible exported selector source is paired with every positive UNTESTED architecture hypothesis. No ordering, registration signal, filename, consumer permission, or mention frequency selects a frame or establishes a provider relation.'
  };
  const matrixId = `provider-binding-experiment-matrix-${digest(basis).slice(0, 20)}`;
  const matrix = Object.assign({ matrixId, matrixDigest: null }, basis);
  matrix.matrixDigest = digest(Object.assign({}, matrix, { matrixDigest: null }));
  return matrix;
}

function verify(matrix) {
  if (!matrix || matrix.schema !== MATRIX_SCHEMA || matrix.cellId !== CELL_ID) throw new Error('provider binding experiment matrix schema mismatch');
  if (matrix.matrixDigest !== digest(Object.assign({}, matrix, { matrixDigest: null }))) throw new Error('provider binding experiment matrix digest mismatch');
  if (matrix.selectedFrameId !== null || matrix.selectionState !== 'NO_EXPERIMENT_FRAME_SELECTED' || matrix.providerIdentityInferred || matrix.outerRequirementBound || matrix.permissionsInferred || matrix.implementationSelected || matrix.sourceExecuted || matrix.architectureSelected || matrix.architectureEvaluated || matrix.providerCandidateBuilt || matrix.providerDeclarationWritten || !authorityClosed(matrix.authority)) throw new Error('provider binding experiment matrix exceeds proposal boundary');
  const sourceIds = new Set(matrix.candidateSources.map(item => item.sourceAssessmentDigest));
  const hypothesisIds = new Set(matrix.hypothesesRepresented.map(item => item.hypothesisId));
  const expectedCount = sourceIds.size * hypothesisIds.size;
  if (matrix.experimentFrames.length !== expectedCount) throw new Error('provider binding experiment matrix is not the complete balanced cross-product');
  const pairs = new Set();
  for (const frame of matrix.experimentFrames) {
    if (frame.schema !== FRAME_SCHEMA || frame.experimentFrameDigest !== digest(Object.assign({}, frame, { experimentFrameDigest: null }))) throw new Error('provider binding experiment frame digest mismatch');
    const pair = `${frame.sourceEvidence.sourceAssessmentDigest}:${frame.architectureHypothesis.hypothesisId}`;
    if (pairs.has(pair) || !sourceIds.has(frame.sourceEvidence.sourceAssessmentDigest) || !hypothesisIds.has(frame.architectureHypothesis.hypothesisId)) throw new Error('provider binding experiment frame pair mismatch');
    pairs.add(pair);
    if (frame.selectionState !== 'NOT_SELECTED' || frame.providerBindingEstablished || frame.implementationSelected || frame.sourceExecuted || frame.architectureSelected || frame.architectureEvaluated || frame.providerCandidateBuilt || frame.providerDeclarationWritten || frame.candidateInputs.providerIdentity !== 'UNRESOLVED_NOT_INFERRED' || frame.candidateInputs.providerPermissions !== null || !authorityClosed(frame.authority)) throw new Error('provider binding experiment frame exceeds proposal boundary');
  }
  return true;
}

module.exports = { CELL_ID, MATRIX_SCHEMA, FRAME_SCHEMA, POSITIVE_HYPOTHESES, AUTHORITY, digest, categorizeSource, createFrame, evaluate, verify };
