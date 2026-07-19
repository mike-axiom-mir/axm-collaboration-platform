'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Frontier = require('../kernel/frontier-cell');
const ProviderHands = require('./provider-declaration-hand-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-research-exam-planner-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-exam-batch/v1';
const EXAM_SCHEMA = 'axm.mirror.provider-declaration-research-exam-request/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-exam-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-research-exam-response/v1';
const MAX_RESULTS = 128;

const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'provider-declaration-gap-hand-to-independent-research-exam-v1',
  sourceRule: 'consume every verified result in the current provider declaration hand batch',
  examRule: 'only a verified nonbuilt provider declaration gap hand may originate a research exam request',
  existingAmbiguousOrNoDemandRule: 'existing declarations, ambiguous declarations, and absent exact demand originate no exam',
  architectureRule: 'compare reusable declaration architecture hypotheses without selecting one before independent execution evidence',
  independenceRule: 'the future candidate may not author expected outcomes or held-out fixtures',
  repairRule: 'a later exact declaration removes the next exam while preserving the prior immutable batch',
  humanWordingAuthority: false,
  architectureSelection: false,
  examExecutorBuild: false,
  fixtureFileGeneration: false,
  providerCandidateBuild: false,
  providerContractWrite: false,
  workshopWrite: false,
  readinessClaim: false,
  execution: false,
  trainingAdmission: false
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
function clean(value, maximum = 300) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('../kernel/frontier-cell'),
    require.resolve('./provider-declaration-hand-organ'),
    path.join(root, 'contracts', 'provider-declaration-research-exam-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-exam-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-exam-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-research-exam-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function architectureHypotheses() {
  return [
    {
      hypothesisId: 'REUSE_TYPED_SHARED_SERVICE_DECLARATION',
      state: 'UNTESTED',
      mustDemonstrate: ['OUTER_REQUIREMENT_BINDING', 'PROVIDER_IDENTITY_BINDING', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'PERMISSION_DECLARATION'],
      candidateMayClaimFitWithoutExam: false
    },
    {
      hypothesisId: 'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION',
      state: 'UNTESTED',
      mustDemonstrate: ['OUTER_REQUIREMENT_BINDING', 'UNIQUE_REGISTRY_MEMBERSHIP', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'AMBIGUITY_REFUSAL'],
      candidateMayClaimFitWithoutExam: false
    },
    {
      hypothesisId: 'NEW_TYPED_PROVIDER_DECLARATION',
      state: 'UNTESTED',
      mustDemonstrate: ['SCHEMA_VERSION', 'OUTER_REQUIREMENT_BINDING', 'PROVIDER_IDENTITY_BINDING', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'BOUNDARY_AND_PERMISSION_DECLARATIONS'],
      candidateMayClaimFitWithoutExam: false
    },
    {
      hypothesisId: 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT',
      state: 'UNTESTED',
      mustDemonstrate: ['ALL_CANDIDATE_ARCHITECTURES_FAIL_ONE_OR_MORE_REQUIRED_RELATIONS', 'UNKNOWN_PRESERVED_WITHOUT_PROVIDER_INFERENCE'],
      candidateMayClaimFitWithoutExam: false
    }
  ];
}

function caseFamilies(hasSelectors) {
  return [
    { caseId: 'COMPLETE_EXACT_RELATION', applicable: true, heldOut: true, expectedState: 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST', requiredEvidence: ['EXACT_SCHEMA', 'EXACT_REQUIREMENT', 'UNIQUE_PROVIDER', 'IMPLEMENTATION_CONTENT_BINDING', 'DECLARED_BOUNDARIES'] },
    { caseId: 'PROVIDER_IDENTITY_MISSING', applicable: true, heldOut: true, expectedState: 'UNKNOWN', requiredEvidence: ['PROVIDER_IDENTITY_ABSENT'] },
    { caseId: 'DEMANDED_SELECTOR_COVERAGE_MISSING', applicable: hasSelectors, heldOut: true, expectedState: hasSelectors ? 'UNKNOWN' : 'NOT_APPLICABLE', requiredEvidence: ['EXACT_DEMANDED_SELECTOR_SET'] },
    { caseId: 'IMPLEMENTATION_TARGET_MISSING', applicable: true, heldOut: true, expectedState: 'UNKNOWN', requiredEvidence: ['MISSING_IMPLEMENTATION_TARGET'] },
    { caseId: 'IMPLEMENTATION_CONTENT_BINDING_MISMATCH', applicable: true, heldOut: true, expectedState: 'UNKNOWN', requiredEvidence: ['CONTENT_DIGEST_MISMATCH'] },
    { caseId: 'OUTSIDE_ROOT_OR_SYMBOLIC_TARGET', applicable: true, heldOut: true, expectedState: 'UNKNOWN', requiredEvidence: ['PATH_BOUNDARY_OR_SYMBOLIC_VIOLATION'] },
    { caseId: 'DUPLICATE_OR_COMPETING_PROVIDER', applicable: true, heldOut: true, expectedState: 'HOLD_AMBIGUITY', requiredEvidence: ['MORE_THAN_ONE_EXACT_PROVIDER'] },
    { caseId: 'PERMISSION_DECLARATION_MISSING', applicable: true, heldOut: true, expectedState: 'UNKNOWN', requiredEvidence: ['IMPLEMENTATION_PERMISSION_NOT_DECLARED'] },
    { caseId: 'REPAIRED_DECLARATION_REMOVES_NEXT_GAP', applicable: true, heldOut: true, expectedState: 'NO_GAP_NEXT_IMMUTABLE_BATCH', requiredEvidence: ['LATER_UNIQUE_EXACT_DECLARATION'] },
    { caseId: 'EXISTING_DECLARATION_REGRESSION', applicable: true, heldOut: true, expectedState: 'UNCHANGED_NO_GAP', requiredEvidence: ['PREVIOUSLY_ADMITTED_EXACT_DECLARATIONS'] }
  ];
}

function createExamRequest(result) {
  if (!result || !result.gapAssessment) throw new Error('provider declaration research exam requires one hand result');
  const gap = result.gapAssessment;
  if (result.handRequest == null) return null;
  ProviderHands.verifyHandRequest(result.handRequest, gap);
  const hand = result.handRequest;
  const basis = {
    schema: EXAM_SCHEMA,
    sourceHand: {
      requirementId: hand.requirementId,
      handRequestId: hand.requestId,
      handRequestDigest: hand.requestDigest,
      gapAssessmentDigest: hand.gapAssessmentDigest,
      sourceAffordanceAssessmentDigest: hand.sourceAffordanceAssessmentDigest
    },
    knownRelations: {
      exactConsumerBindings: clone(hand.consumerDemand.bindings),
      demandedProviderSelectors: clone(hand.consumerDemand.providerSelectors),
      exactProviderDeclarationsAtSource: gap.counts.exactProviderDeclarations,
      sourceGapClassification: gap.classification,
      interpretation: 'EXACT_CONSUMER_DEMAND_WITH_ZERO_EXACT_PROVIDER_DECLARATIONS'
    },
    unresolvedDimensions: [
      'PROVIDER_IDENTITY', 'DECLARATION_SCHEMA', 'DECLARATION_TARGET_PATH', 'IMPLEMENTATION_PATH',
      'IMPLEMENTATION_CONTENT_BINDING', 'RUNTIME_HEALTH', 'SEMANTIC_FITNESS', 'REQUIRED_PERMISSIONS'
    ],
    architectureHypotheses: architectureHypotheses(),
    caseFamilies: caseFamilies(hand.consumerDemand.providerSelectors.length > 0),
    independence: {
      examAuthorOrganId: ORGAN_ID,
      futureCandidateMayAuthorExpectedOutcomes: false,
      futureCandidateMayAuthorHeldOutFixtures: false,
      independentEvaluatorRequired: true,
      attributedStewardReviewRequiredBeforeExecutorBuild: true,
      heldOutFixtureBytesState: 'NOT_AUTHORED'
    },
    architectureDecision: 'UNRESOLVED_REQUIRES_INDEPENDENT_EXPERIMENT',
    examExecutorState: 'NOT_BUILT',
    state: 'REVIEWABLE_PROVIDER_DECLARATION_RESEARCH_EXAM_NOT_EXECUTED',
    humanWordingAuthority: false,
    authority: {
      architectureSelection: false,
      expectedOutcomeMutation: false,
      heldOutFixtureAuthoringByCandidate: false,
      examExecutorBuild: false,
      fixtureFileGeneration: false,
      providerIdentityInference: false,
      declarationSchemaSelection: false,
      declarationPathSelection: false,
      providerCandidateBuild: false,
      providerContractWrite: false,
      workshopWrite: false,
      readinessClaim: false,
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
    boundary: 'This request specifies an independent falsification problem for provider-declaration architectures. It does not select an architecture, author fixtures, build an executor or provider, write a declaration, prove availability, or grant authority.'
  };
  const examRequestId = `provider-declaration-research-exam-${digest(basis).slice(0, 20)}`;
  const request = Object.assign({ examRequestId, examRequestDigest: null }, basis);
  request.examRequestDigest = digest(Object.assign({}, request, { examRequestDigest: null }));
  return request;
}

function verifyExamRequest(request, result) {
  const expected = createExamRequest(result);
  if (!expected || !request || request.schema !== EXAM_SCHEMA || request.examRequestDigest !== digest(Object.assign({}, request, { examRequestDigest: null })) || JSON.stringify(stable(request)) !== JSON.stringify(stable(expected))) throw new Error('provider declaration research exam request mismatch');
  return true;
}

function frontierInput(examRequest) {
  if (!examRequest) return null;
  return {
    subject: {
      id: `provider-declaration-architecture-${examRequest.sourceHand.requirementId}`,
      statement: 'Determine whether any typed provider-declaration architecture can represent every required machine relation without inferred provider facts.',
      domain: 'provider-declaration-architecture'
    },
    observations: [
      {
        id: 'consumer-bound-declaration-gap',
        domain: 'provider-declaration-demand',
        statement: 'Exact consumer bindings coexist with zero exact provider declarations.',
        perspective: 'MACHINE_NATIVE',
        patternTags: ['missing-machine-relation', 'provider-declaration-architecture'],
        evidenceRef: examRequest.sourceHand.gapAssessmentDigest
      },
      {
        id: 'provider-fields-unresolved',
        domain: 'provider-declaration-evidence',
        statement: 'Provider identity, declaration schema, target path, and implementation binding remain unresolved.',
        perspective: 'MACHINE_NATIVE',
        patternTags: ['missing-machine-relation', 'architecture-unresolved'],
        evidenceRef: examRequest.sourceHand.handRequestDigest
      }
    ],
    currentCapabilities: [{
      id: 'provider-declaration-gap-recognition',
      statement: 'Recognize an exact consumer-bound provider-declaration gap without choosing the provider.',
      domains: ['provider-declaration-demand'],
      coversSeams: ['provider-declaration-gap-recognition'],
      examIds: []
    }],
    examCoverage: [],
    unexpectedSeams: [{
      id: 'provider-declaration-architecture-unresolved',
      statement: 'The current capability can expose the declaration gap but cannot compare a provider-declaration architecture against independent held-out relation cases.',
      severity: 'medium',
      evidenceRefs: [examRequest.sourceHand.handRequestDigest]
    }]
  };
}

function createFrontierAssessment(examRequest) {
  return examRequest ? Frontier.inspect(frontierInput(examRequest)) : null;
}

function truthfulActionId(result) {
  const id = result.gapAssessment.requirementId;
  return result.handRequest ? `propose-provider-declaration-research-exam-${id}` : `preserve-no-provider-declaration-research-exam-${id}`;
}

function reasoningInput(sourceResult) {
  const gap = sourceResult.gapAssessment;
  const truthful = truthfulActionId(sourceResult);
  const build = `build-provider-from-consumer-demand-${gap.requirementId}`;
  const resolve = `claim-gap-resolved-by-exam-request-${gap.requirementId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-declaration-research-exam-${digest(gap.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-provider-declaration-research-exam-organ' },
    goal: 'Originate an independent provider-declaration architecture research exam only for a verified nonbuilt gap hand, without selecting or building the provider.',
    evidence: [{
      id: 'provider-declaration-hand-result', kind: 'observation', status: 'observed',
      statement: `${gap.requirementId} is ${gap.classification} and hand presence is ${sourceResult.handRequest ? 'true' : 'false'}.`,
      source: { kind: 'provider-declaration-gap-assessment', id: gap.assessmentDigest, uri: `sha256:${gap.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Verified content-digested provider declaration hand result.' }
    }],
    unknowns: sourceResult.handRequest ? [
      { id: 'architecture-unknown', question: 'Which declaration architecture, if any, passes independent held-out relation cases?', blocking: true },
      { id: 'provider-identity-unknown', question: 'Which provider identity and implementation binding should be proposed?', blocking: true }
    ] : [],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: sourceResult.handRequest ? 'Propose a typed independent research exam request with no architecture decision' : 'Preserve the exact no-exam or hold relation', supportingEvidence: ['provider-declaration-hand-result'], preconditionEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], expectedEffects: ['An exam request or explicit no-exam result is preserved without provider construction.'], possibleSideEffects: ['An exam request could be mistaken for a completed experiment.'], reversible: true, recovery: 'Discard the request and preserve the source hand batch.', risk: 'low' },
      { id: build, kind: 'proposal', label: 'Build a provider declaration directly from consumer demand', supportingEvidence: ['provider-declaration-hand-result'], preconditionEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], expectedEffects: ['A provider identity and schema would be invented.'], possibleSideEffects: ['Demand could silently become supply authority.'], reversible: false, recovery: 'Reject the build and keep all provider fields unresolved.', risk: 'high' },
      { id: resolve, kind: 'proposal', label: 'Treat authoring the research exam as resolving the declaration gap', supportingEvidence: ['provider-declaration-hand-result'], preconditionEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], expectedEffects: ['An unexecuted exam would be confused with evidence.'], possibleSideEffects: ['Readiness could be overstated.'], reversible: false, recovery: 'Keep the gap and readiness UNKNOWN until independent evidence exists.', risk: 'high' }
    ],
    decomposition: [{ id: 'separate-exam-from-answer', question: 'Can Mirror specify a falsifiable experiment without selecting its answer?', dependsOn: [], cheapestCheck: 'Compare the source hand with fixed independence and authority gates.', status: 'ANSWERED', answerEvidenceRefs: ['provider-declaration-hand-result'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `truthful-exam-${gap.requirementId}`, approach: 'Follow the exact hand classification and preserve all unresolved provider dimensions.', requiredEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['The exam selects an architecture or claims execution.'], strategyTags: ['independent-exam-authoring', 'preserve-unknown'] },
      { actionId: build, pathId: `false-provider-build-${gap.requirementId}`, approach: 'Infer provider facts from demand.', requiredEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Provider evidence is absent.'], strategyTags: ['reject-provider-inference'] },
      { actionId: resolve, pathId: `false-gap-resolution-${gap.requirementId}`, approach: 'Treat an exam request as an executed successful experiment.', requiredEvidence: ['provider-declaration-hand-result'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No executor or fixture evidence exists.'], strategyTags: ['reject-fake-completion'] }
    ],
    verificationReceipts: [
      { id: `verify-exam-${gap.requirementId}`, actionId: truthful, claim: 'The action follows hand presence, keeps architecture unresolved, and grants no build or execution authority.', evidenceRefs: ['provider-declaration-hand-result'], method: 'Recompute the exam gate from the verified provider-declaration hand result.', result: 'PASS', limitations: ['Does not select an architecture or execute fixtures.'] },
      { id: `verify-provider-build-${gap.requirementId}`, actionId: build, claim: 'Consumer demand supplies provider identity, schema, and implementation.', evidenceRefs: ['provider-declaration-hand-result'], method: 'Compare demanded relations with absent provider evidence.', result: 'FAIL', limitations: ['A later attributed proposal may supply these fields.'] },
      { id: `verify-gap-resolution-${gap.requirementId}`, actionId: resolve, claim: 'Writing an exam request resolves the gap.', evidenceRefs: ['provider-declaration-hand-result'], method: 'Check executor, fixtures, and observed outcomes.', result: 'FAIL', limitations: ['A later independent experiment may provide evidence.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  const seam = Seam.inspectReasoningSession(session);
  if (seam.summary.open || !authorityClosed(session)) throw new Error('provider declaration research exam reasoning session has open authority seams');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const build = session.pathSet.comparisons.find(item => item.actionId === result.providerBuildActionId);
  const resolve = session.pathSet.comparisons.find(item => item.actionId === result.falseResolutionActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !build || build.verificationStatus !== 'FAIL' || build.eligible || !resolve || resolve.verificationStatus !== 'FAIL' || resolve.eligible) throw new Error('provider declaration research exam discrimination changed');
  return true;
}

function expectedSummary(results) {
  return {
    providerDeclarationHandResultsEvaluated: results.length,
    researchExamRequestsProposed: results.filter(item => item.researchExamRequest).length,
    declarationsPresentNoExam: results.filter(item => item.gapAssessment.classification === 'DECLARATION_PRESENT_NO_GAP').length,
    noConsumerDemandResearchHolds: results.filter(item => item.gapAssessment.classification === 'NO_CONSUMER_BOUND_DECLARATION_GAP_HOLD').length,
    ambiguousProviderResearchHolds: results.filter(item => item.gapAssessment.classification === 'AMBIGUOUS_PROVIDER_DECLARATIONS_HOLD').length,
    frontierExamRequired: results.filter(item => item.frontierAssessment && item.frontierAssessment.classification === 'FRONTIER_EXAM_REQUIRED').length,
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    providerBuildCandidatesRejected: results.filter(item => item.providerBuildRejected).length,
    falseResolutionCandidatesRejected: results.filter(item => item.falseResolutionRejected).length,
    architecturesSelected: 0,
    examExecutorsBuilt: 0,
    fixtureFilesGenerated: 0,
    providerCandidatesBuilt: 0,
    providerDeclarationsWritten: 0,
    liveExperimentsExecuted: 0,
    workshopFilesChanged: 0,
    permissionsGranted: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyBatch(batch, runDir, providerDerived) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider declaration research exam batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('provider declaration research exam organ identity changed');
  if (JSON.stringify(stable(batch.implementationContract)) !== JSON.stringify(stable(IMPLEMENTATION_CONTRACT)) || JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(sourceLineage()))) throw new Error('provider declaration research exam source contract changed');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RESULTS) throw new Error('provider declaration research exam result bound changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key === 'privateEvidenceTraceWrite' ? value !== true : value !== false)) throw new Error('provider declaration research exam authority boundary changed');
  const sourceBatch = providerDerived && providerDerived.batch ? providerDerived.batch : providerDerived;
  if (sourceBatch) {
    ProviderHands.verifyBatch(sourceBatch);
    if (batch.sourceProviderDeclarationHandBatch.batchId !== sourceBatch.batchId || batch.sourceProviderDeclarationHandBatch.batchDigest !== sourceBatch.batchDigest) throw new Error('provider declaration research exam source hand batch changed');
  }
  const foundations = batch.results.map(item => ({ gapAssessment: item.gapAssessment, handRequest: item.handRequest, researchExamRequest: item.researchExamRequest, frontierAssessment: item.frontierAssessment }));
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: sourceLineage(), sourceProviderDeclarationHandBatch: batch.sourceProviderDeclarationHandBatch, examFoundations: foundations };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-research-exams-${inputsDigest.slice(0, 20)}`) throw new Error('provider declaration research exam input lineage mismatch');
  const sourceByRequirement = sourceBatch ? new Map(sourceBatch.results.map(item => [item.gapAssessment.requirementId, item])) : null;
  const ids = new Set();
  for (const result of batch.results) {
    if (!result.gapAssessment || ids.has(result.gapAssessment.requirementId)) throw new Error('provider declaration research exam results must be present and unique');
    ids.add(result.gapAssessment.requirementId);
    const sourceResult = sourceByRequirement && sourceByRequirement.get(result.gapAssessment.requirementId);
    if (sourceResult && (sourceResult.gapAssessment.assessmentDigest !== result.gapAssessment.assessmentDigest || (sourceResult.handRequest && sourceResult.handRequest.requestDigest) !== (result.handRequest && result.handRequest.requestDigest))) throw new Error('provider declaration research exam source result mismatch');
    const resultBasis = sourceResult || { gapAssessment: result.gapAssessment, handRequest: result.handRequest };
    if (result.researchExamRequest) verifyExamRequest(result.researchExamRequest, resultBasis);
    else if (result.handRequest) throw new Error('provider declaration hand lacks a research exam request');
    const expectedFrontier = createFrontierAssessment(result.researchExamRequest);
    if (JSON.stringify(stable(result.frontierAssessment)) !== JSON.stringify(stable(expectedFrontier))) throw new Error('provider declaration research frontier assessment mismatch');
    if (result.frontierAssessment && result.frontierAssessment.classification !== 'FRONTIER_EXAM_REQUIRED') throw new Error('provider declaration research must preserve the independent exam gate');
    const expectedAction = truthfulActionId(resultBasis);
    if (result.expectedDecision.value !== 1 || result.expectedDecision.actionId !== expectedAction || !result.behaviorMatched || !result.providerBuildRejected || !result.falseResolutionRejected || result.architectureSelected || result.examExecutorBuilt || result.fixtureFilesGenerated !== 0 || result.providerCandidateBuilt || result.providerDeclarationWritten || result.liveExperimentExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider declaration research exam result exceeds proposal boundary');
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider declaration research exam session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider declaration research exam session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`provider declaration research exam session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (sourceByRequirement && sourceByRequirement.size !== batch.results.length) throw new Error('provider declaration research exam result set is incomplete');
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary(batch.results)))) throw new Error('provider declaration research exam summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-research-exam-runs'));
  if (!inside(root, stateDir)) throw new Error('provider declaration research exam private state must stay inside Mirror root');
  const providerDerived = options.providerDerived || ProviderHands.derive(Object.assign({}, options.providerOptions || {}, { root, workshopRoot }));
  ProviderHands.verifyBatch(providerDerived.batch, providerDerived.runDir, providerDerived.affordanceDerived && providerDerived.affordanceDerived.batch);
  if (providerDerived.batch.results.length > MAX_RESULTS) throw new Error(`provider declaration research exam planner holds: ${providerDerived.batch.results.length} results exceed ${MAX_RESULTS}`);
  const foundations = providerDerived.batch.results.map(sourceResult => {
    const researchExamRequest = createExamRequest(sourceResult);
    return {
      gapAssessment: clone(sourceResult.gapAssessment),
      handRequest: sourceResult.handRequest ? clone(sourceResult.handRequest) : null,
      researchExamRequest,
      frontierAssessment: createFrontierAssessment(researchExamRequest)
    };
  }).sort((a, b) => a.gapAssessment.requirementId.localeCompare(b.gapAssessment.requirementId));
  const lineage = sourceLineage();
  const sourceProviderDeclarationHandBatch = { batchId: providerDerived.batch.batchId, batchDigest: providerDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, sourceProviderDeclarationHandBatch, examFoundations: foundations };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-research-exams-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, providerDerived);
    return { batch, runDir, reused: true, providerDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const sourceByRequirement = new Map(providerDerived.batch.results.map(item => [item.gapAssessment.requirementId, item]));
  const results = foundations.map(foundation => {
    const sourceResult = sourceByRequirement.get(foundation.gapAssessment.requirementId);
    const session = Foundation.run(reasoningInput(sourceResult), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(sourceResult);
    const providerBuildActionId = `build-provider-from-consumer-demand-${foundation.gapAssessment.requirementId}`;
    const falseResolutionActionId = `claim-gap-resolved-by-exam-request-${foundation.gapAssessment.requirementId}`;
    const build = session.pathSet.comparisons.find(item => item.actionId === providerBuildActionId);
    const resolve = session.pathSet.comparisons.find(item => item.actionId === falseResolutionActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sessionFile = path.join('sessions', `session-${digest(foundation.gapAssessment.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = Object.assign({}, foundation, {
      expectedDecision: { value: 1, actionId: expectedAction },
      providerBuildActionId,
      falseResolutionActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      providerBuildRejected: !!build && build.verificationStatus === 'FAIL' && build.eligible === false,
      falseResolutionRejected: !!resolve && resolve.verificationStatus === 'FAIL' && resolve.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      architectureSelected: false,
      examExecutorBuilt: false,
      fixtureFilesGenerated: 0,
      providerCandidateBuilt: false,
      providerDeclarationWritten: false,
      liveExperimentExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    });
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), bytes, { flag: 'wx' });
    return result;
  });
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_PROVIDER_DECLARATION_RESEARCH_EXAM_PLANNER', learnedWeights: false },
    sourceLineage: lineage,
    implementationContract: IMPLEMENTATION_CONTRACT,
    sourceProviderDeclarationHandBatch,
    results,
    summary: expectedSummary(results),
    authority: {
      privateEvidenceTraceWrite: true,
      architectureSelection: false,
      expectedOutcomeMutation: false,
      heldOutFixtureAuthoringByCandidate: false,
      examExecutorBuild: false,
      fixtureFileGeneration: false,
      providerIdentityInference: false,
      declarationSchemaSelection: false,
      declarationPathSelection: false,
      providerCandidateBuild: false,
      providerContractWrite: false,
      workshopWrite: false,
      readinessClaim: false,
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
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The planner may originate an immutable independent research-exam request from a verified provider-declaration hand. It does not select an architecture, let a future candidate author its own expected outcomes, build fixtures or executors, construct a provider, write Workshop, claim readiness, grant, train, execute, install, or promote.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, providerDerived);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, providerDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider declaration research exam request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration research exam query fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : clean(request.requirementId);
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.gapAssessment.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_PROVIDER_DECLARATION_HAND_RESULT';
      reason = 'The current provider declaration hand batch contains no result for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const examRequests = selected.filter(item => item.researchExamRequest && item.behaviorMatched).map(item => ({ examRequest: clone(item.researchExamRequest), frontierAssessment: clone(item.frontierAssessment) }));
  const holds = selected.filter(item => !item.researchExamRequest || !item.behaviorMatched).map(item => ({ requirementId: item.gapAssessment.requirementId, assessmentDigest: item.gapAssessment.assessmentDigest, classification: item.gapAssessment.classification, state: 'HELD_NO_PROVIDER_DECLARATION_RESEARCH_EXAM' }));
  if (!state && examRequests.length) {
    state = 'PROPOSED_PROVIDER_DECLARATION_RESEARCH_EXAMS';
    reason = 'Verified nonbuilt declaration hands support independent architecture research-exam requests without selecting or executing an answer.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_PROVIDER_DECLARATION_RESEARCH_EXAM_REQUIRED';
    reason = 'A declaration is present, providers are ambiguous, exact demand is absent, or the hand reasoning did not match; no research exam is proposed.';
  } else if (!state) {
    state = 'NO_PROVIDER_DECLARATION_HAND_RESULTS';
    reason = 'No current provider declaration hand results require research-exam planning.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    examRequests,
    holds,
    architectureSelected: false,
    examExecutorBuilt: false,
    fixtureFilesGenerated: 0,
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, EXAM_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_RESULTS, IMPLEMENTATION_CONTRACT,
  digest, sourceLineage, architectureHypotheses, caseFamilies, createExamRequest, verifyExamRequest,
  frontierInput, createFrontierAssessment, truthfulActionId, reasoningInput, verifySession, expectedSummary,
  verifyBatch, derive, respond
};
