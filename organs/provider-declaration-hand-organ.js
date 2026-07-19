'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const GapCell = require('../kernel/provider-declaration-gap-cell');
const Affordances = require('./reasoning-readiness-probe-affordance-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-hand-planner-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-hand-batch/v1';
const HAND_SCHEMA = 'axm.mirror.provider-declaration-hand-request/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-hand-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-hand-response/v1';
const MAX_ASSESSMENTS = 128;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'consumer-bound-provider-declaration-gap-to-nonbuilt-hand-v1',
  sourceRule: 'consume every verified current readiness affordance assessment',
  gapRule: 'only zero-provider holds with one or more exact consumer service bindings may originate a declaration hand',
  providerInferenceRule: 'consumer demand identifies a missing declaration relation but never the provider, schema, implementation, or target path',
  ambiguityRule: 'competing provider declarations hold instead of generating another declaration',
  repairedRule: 'a later unique exact provider declaration removes the next hand without erasing the prior batch',
  generatedWordingAuthority: false,
  declarationCandidateBuild: false,
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
    require.resolve('../kernel/provider-declaration-gap-cell'),
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('./reasoning-readiness-probe-affordance-organ'),
    path.join(root, 'contracts', 'provider-declaration-gap-assessment.schema.json'),
    path.join(root, 'contracts', 'provider-declaration-hand-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-hand-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-hand-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-hand-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function createHandRequest(assessment) {
  if (!assessment || assessment.schema !== GapCell.SCHEMA || assessment.assessmentDigest !== digest(without(assessment, 'assessmentDigest'))) throw new Error('invalid provider declaration gap assessment');
  if (assessment.classification !== 'PROVIDER_DECLARATION_GAP_CANDIDATE') return null;
  const basis = {
    schema: HAND_SCHEMA,
    requirementId: assessment.requirementId,
    gapAssessmentDigest: assessment.assessmentDigest,
    sourceAffordanceAssessmentDigest: assessment.sourceAffordanceAssessmentDigest,
    consumerDemand: {
      bindings: clone(assessment.consumerBindings),
      providerSelectors: clone(assessment.providerSelectors),
      interpretation: 'These content-bound consumer contracts prove demand for a provider declaration relation. They do not identify or validate the provider that should satisfy it.'
    },
    proposedProviderDeclarationContract: {
      subjectRequirementId: assessment.requirementId,
      demandedServiceBindings: assessment.consumerBindings.map(item => item.consumes),
      demandedProviderSelectors: clone(assessment.providerSelectors),
      providerIdentity: 'UNRESOLVED_NOT_INFERRED',
      declarationSchema: 'UNRESOLVED_REQUIRES_STEWARD_SELECTION',
      declarationTargetRelativePath: null,
      implementationRelativePath: null,
      requiredMachineRelations: [
        'exact outer requirement ID binding',
        'exact demanded provider-selector coverage when a selector is present',
        'typed declaration schema and version',
        'content-bound implementation or registry relation',
        'declared permission requirements without granting them',
        'explicit write, execution, health, and semantic boundaries'
      ],
      verificationRequirements: [
        'one unique exact declaration satisfies every admitted consumer binding',
        'missing, malformed, stale, symbolic, or conflicting declarations preserve UNKNOWN',
        'implementation existence and declaration binding are independently checked',
        'structural declaration establishes at most AVAILABLE and never READY',
        'no declaration is installed or written without separate attributed human review',
        'an evaluator other than the proposed provider verifies the relation'
      ],
      recoveryRequirement: 'Discard an invalid proposal, preserve the consumer evidence and UNKNOWN readiness, and append a superseding request if evidence changes.',
      implementationState: 'NOT_BUILT'
    },
    state: 'REVIEWABLE_PROVIDER_DECLARATION_GAP_HAND_NOT_BUILT',
    humanWordingAuthority: false,
    authority: {
      providerIdentityInference: false,
      declarationSchemaSelection: false,
      declarationPathSelection: false,
      declarationCandidateBuild: false,
      contractWrite: false,
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
    boundary: 'This hand asks a steward to resolve a missing machine-readable provider declaration. It is not a provider choice, declaration schema decision, contract file, implementation, review, readiness observation, or permission.'
  };
  const requestId = `provider-declaration-hand-${digest(basis).slice(0, 20)}`;
  const request = Object.assign({ requestId, requestDigest: null }, basis);
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return request;
}

function verifyHandRequest(request, assessment) {
  const expected = createHandRequest(assessment);
  if (!expected || !request || request.schema !== HAND_SCHEMA || request.requestDigest !== digest(Object.assign({}, request, { requestDigest: null })) || JSON.stringify(stable(request)) !== JSON.stringify(stable(expected))) throw new Error('provider declaration hand request mismatch');
  return true;
}

function truthfulActionId(assessment) {
  if (assessment.classification === 'PROVIDER_DECLARATION_GAP_CANDIDATE') return `propose-provider-declaration-hand-${assessment.requirementId}`;
  if (assessment.classification === 'DECLARATION_PRESENT_NO_GAP') return `hold-declaration-present-${assessment.requirementId}`;
  if (assessment.classification === 'AMBIGUOUS_PROVIDER_DECLARATIONS_HOLD') return `hold-provider-ambiguity-${assessment.requirementId}`;
  return `hold-no-consumer-demand-${assessment.requirementId}`;
}

function reasoningInput(assessment) {
  const truthful = truthfulActionId(assessment);
  const infer = `infer-provider-from-consumer-${assessment.requirementId}`;
  const available = `claim-available-without-declaration-${assessment.requirementId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-declaration-hand-exam-${digest(assessment.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-provider-declaration-hand-planner-organ' },
    goal: 'Distinguish a consumer-bound missing provider declaration from existing, ambiguous, or unsupported relations while refusing to infer a provider or claim availability.',
    evidence: [{
      id: 'provider-declaration-gap-assessment', kind: 'observation', status: 'observed',
      statement: `${assessment.requirementId} is classified ${assessment.classification} from exact current affordance evidence.`,
      source: { kind: 'provider-declaration-gap-assessment', id: assessment.assessmentDigest, uri: `sha256:${assessment.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Content-digested provider declarations and exact consumer bindings.' }
    }],
    unknowns: assessment.unknowns.map((question, index) => ({ id: `gap-unknown-${index + 1}`, question, blocking: true })),
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: assessment.classification === 'PROVIDER_DECLARATION_GAP_CANDIDATE' ? 'Propose a nonbuilt provider declaration hand for steward resolution' : 'Preserve the exact no-gap or hold classification', supportingEvidence: ['provider-declaration-gap-assessment'], preconditionEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], expectedEffects: ['A nonbuilt hand or explicit hold is recorded without choosing a provider.'], possibleSideEffects: ['Consumer demand could be mistaken for provider evidence.'], reversible: true, recovery: 'Discard the proposal and preserve the source assessment.', risk: 'low' },
      { id: infer, kind: 'proposal', label: 'Infer that a named consumer selector or nearby implementation is the provider', supportingEvidence: ['provider-declaration-gap-assessment'], preconditionEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], expectedEffects: ['A provider would be invented without a declaration.'], possibleSideEffects: ['A false provider could acquire structural credibility.'], reversible: false, recovery: 'Reject inference and keep provider identity unresolved.', risk: 'high' },
      { id: available, kind: 'proposal', label: 'Claim AVAILABLE from consumer demand without a provider declaration', supportingEvidence: ['provider-declaration-gap-assessment'], preconditionEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], expectedEffects: ['Demand would be confused with supply.'], possibleSideEffects: ['Blocked routes could appear usable.'], reversible: false, recovery: 'Preserve UNKNOWN until exact declaration evidence exists.', risk: 'high' }
    ],
    decomposition: [{ id: 'classify-declaration-gap', question: 'Does exact consumer demand coexist with zero exact provider declarations?', dependsOn: [], cheapestCheck: 'Inspect the independent gap assessment.', status: 'ANSWERED', answerEvidenceRefs: ['provider-declaration-gap-assessment'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `truthful-${assessment.requirementId}`, approach: 'Follow the exact declaration-gap classification without choosing an unresolved provider.', requiredEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['A hand becomes a provider decision.'], strategyTags: ['consumer-provider-relation', 'preserve-unknown'] },
      { actionId: infer, pathId: `provider-inference-${assessment.requirementId}`, approach: 'Treat a demanded selector or implementation resemblance as provision.', requiredEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No exact provider declaration exists.'], strategyTags: ['reject-provider-inference'] },
      { actionId: available, pathId: `false-available-${assessment.requirementId}`, approach: 'Turn consumer demand into availability.', requiredEvidence: ['provider-declaration-gap-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Demand is not supply.'], strategyTags: ['reject-false-availability'] }
    ],
    verificationReceipts: [
      { id: `verify-truthful-${assessment.requirementId}`, actionId: truthful, claim: 'The action preserves the independent declaration-gap classification and all unresolved fields.', evidenceRefs: ['provider-declaration-gap-assessment'], method: 'Recompute from exact current affordance evidence.', result: 'PASS', limitations: ['Does not select or validate a provider.'] },
      { id: `verify-inference-${assessment.requirementId}`, actionId: infer, claim: 'Consumer demand identifies its provider.', evidenceRefs: ['provider-declaration-gap-assessment'], method: 'Compare consumer and provider evidence relations.', result: 'FAIL', limitations: ['A later exact declaration may resolve the gap.'] },
      { id: `verify-available-${assessment.requirementId}`, actionId: available, claim: 'Consumer demand proves structural availability.', evidenceRefs: ['provider-declaration-gap-assessment'], method: 'Compare demand with declaration evidence.', result: 'FAIL', limitations: ['A later reviewed structural probe may establish AVAILABLE.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('provider declaration hand requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('provider declaration hand session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const inferred = session.pathSet.comparisons.find(item => item.actionId === result.providerInferenceActionId);
  const available = session.pathSet.comparisons.find(item => item.actionId === result.falseAvailableActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !inferred || inferred.verificationStatus !== 'FAIL' || inferred.eligible || !available || available.verificationStatus !== 'FAIL' || available.eligible) throw new Error('provider declaration hand discrimination changed');
  return true;
}

function expectedSummary(results) {
  return {
    affordanceAssessmentsEvaluated: results.length,
    providerDeclarationHandsProposed: results.filter(item => item.handRequest).length,
    declarationsPresentNoGap: results.filter(item => item.gapAssessment.classification === 'DECLARATION_PRESENT_NO_GAP').length,
    noConsumerDemandHolds: results.filter(item => item.gapAssessment.classification === 'NO_CONSUMER_BOUND_DECLARATION_GAP_HOLD').length,
    ambiguousProviderHolds: results.filter(item => item.gapAssessment.classification === 'AMBIGUOUS_PROVIDER_DECLARATIONS_HOLD').length,
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    providerInferenceCandidatesRejected: results.filter(item => item.providerInferenceRejected).length,
    falseAvailableCandidatesRejected: results.filter(item => item.falseAvailableRejected).length,
    declarationCandidateFilesGenerated: 0,
    providerDeclarationsWritten: 0,
    liveProbesExecuted: 0,
    workshopFilesChanged: 0,
    permissionsGranted: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyBatch(batch, runDir, affordanceBatch) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider declaration hand batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || !batch.cell || batch.cell.id !== GapCell.CELL_ID || batch.cell.learnedWeights !== false) throw new Error('provider declaration hand organ or cell identity changed');
  if (JSON.stringify(stable(batch.implementationContract)) !== JSON.stringify(stable(IMPLEMENTATION_CONTRACT)) || JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(sourceLineage()))) throw new Error('provider declaration hand source contract changed');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_ASSESSMENTS) throw new Error('provider declaration hand assessment bound changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key === 'privateEvidenceTraceWrite' ? value !== true : value !== false)) throw new Error('provider declaration hand authority boundary changed');
  if (affordanceBatch) {
    Affordances.verifyBatch(affordanceBatch);
    if (batch.sourceAffordanceBatch.batchId !== affordanceBatch.batchId || batch.sourceAffordanceBatch.batchDigest !== affordanceBatch.batchDigest) throw new Error('provider declaration hand source affordance batch changed');
  }
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: sourceLineage(), sourceAffordanceBatch: batch.sourceAffordanceBatch, gapAssessments: batch.results.map(item => item.gapAssessment) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-hands-${inputsDigest.slice(0, 20)}`) throw new Error('provider declaration hand input lineage mismatch');
  const sourceByDigest = affordanceBatch ? new Map(affordanceBatch.results.map(item => [item.assessment.assessmentDigest, item.assessment])) : null;
  const ids = new Set();
  for (const result of batch.results) {
    if (!result.gapAssessment || ids.has(result.gapAssessment.requirementId)) throw new Error('provider declaration hand assessments must be present and unique');
    ids.add(result.gapAssessment.requirementId);
    const source = sourceByDigest && sourceByDigest.get(result.gapAssessment.sourceAffordanceAssessmentDigest);
    if (source) GapCell.verify(result.gapAssessment, source);
    else if (result.gapAssessment.assessmentDigest !== digest(without(result.gapAssessment, 'assessmentDigest'))) throw new Error('provider declaration gap assessment digest mismatch');
    if (result.handRequest) verifyHandRequest(result.handRequest, result.gapAssessment);
    else if (result.gapAssessment.classification === 'PROVIDER_DECLARATION_GAP_CANDIDATE') throw new Error('provider declaration gap hand missing');
    const expectedAction = truthfulActionId(result.gapAssessment);
    if (result.expectedDecision.value !== 1 || result.expectedDecision.actionId !== expectedAction || !result.behaviorMatched || !result.providerInferenceRejected || !result.falseAvailableRejected || result.declarationCandidateBuilt || result.providerDeclarationWritten || result.liveProbeExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider declaration hand result exceeds proposal boundary');
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider declaration hand session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider declaration hand session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`provider declaration hand session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (sourceByDigest && sourceByDigest.size !== batch.results.length) throw new Error('provider declaration hand assessment set is incomplete');
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary(batch.results)))) throw new Error('provider declaration hand summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-hand-runs'));
  if (!inside(root, stateDir)) throw new Error('provider declaration hand private state must stay inside Mirror root');
  const affordanceDerived = options.affordanceDerived || Affordances.derive(Object.assign({}, options.affordanceOptions || {}, { root, workshopRoot }));
  Affordances.verifyBatch(affordanceDerived.batch);
  const sourceAssessments = affordanceDerived.batch.results.map(item => item.assessment).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  if (sourceAssessments.length > MAX_ASSESSMENTS) throw new Error(`provider declaration hand planner holds: ${sourceAssessments.length} assessments exceed ${MAX_ASSESSMENTS}`);
  const gapAssessments = sourceAssessments.map(affordanceAssessment => GapCell.evaluate({ affordanceAssessment }));
  const lineage = sourceLineage();
  const sourceAffordanceBatch = { batchId: affordanceDerived.batch.batchId, batchDigest: affordanceDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, sourceAffordanceBatch, gapAssessments };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-hands-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, affordanceDerived.batch);
    return { batch, runDir, reused: true, affordanceDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = gapAssessments.map(gapAssessment => {
    const session = Foundation.run(reasoningInput(gapAssessment), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(gapAssessment);
    const providerInferenceActionId = `infer-provider-from-consumer-${gapAssessment.requirementId}`;
    const falseAvailableActionId = `claim-available-without-declaration-${gapAssessment.requirementId}`;
    const inferred = session.pathSet.comparisons.find(item => item.actionId === providerInferenceActionId);
    const available = session.pathSet.comparisons.find(item => item.actionId === falseAvailableActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sessionFile = path.join('sessions', `session-${digest(gapAssessment.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      gapAssessment,
      handRequest: createHandRequest(gapAssessment),
      expectedDecision: { value: 1, actionId: expectedAction },
      providerInferenceActionId,
      falseAvailableActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      providerInferenceRejected: !!inferred && inferred.verificationStatus === 'FAIL' && inferred.eligible === false,
      falseAvailableRejected: !!available && available.verificationStatus === 'FAIL' && available.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      declarationCandidateBuilt: false,
      providerDeclarationWritten: false,
      liveProbeExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    };
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
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_CONSUMER_BOUND_PROVIDER_DECLARATION_GAP_HAND_PLANNER', learnedWeights: false },
    cell: { id: GapCell.CELL_ID, schema: GapCell.SCHEMA, status: 'WORKING_EXACT_CONSUMER_PROVIDER_RELATION_CLASSIFIER', learnedWeights: false },
    implementationContract: IMPLEMENTATION_CONTRACT,
    sourceLineage: lineage,
    sourceAffordanceBatch,
    results,
    summary: expectedSummary(results),
    authority: {
      privateEvidenceTraceWrite: true,
      providerIdentityInference: false,
      declarationSchemaSelection: false,
      declarationPathSelection: false,
      declarationCandidateBuild: false,
      contractWrite: false,
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
    boundary: 'The planner may originate a nonbuilt declaration-gap hand from exact consumer-bound demand when zero providers are declared. It never selects a provider, schema, implementation, or target path and never builds, writes, installs, probes, grants, trains, promotes, or changes Workshop.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, affordanceDerived.batch);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, affordanceDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider declaration hand request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration hand query fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : clean(request.requirementId);
  const limit = Math.max(1, Math.min(MAX_ASSESSMENTS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.gapAssessment.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_AFFORDANCE_ASSESSMENT';
      reason = 'The current affordance batch contains no assessment for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const proposals = selected.filter(item => item.handRequest && item.behaviorMatched).map(item => clone(item.handRequest));
  const holds = selected.filter(item => !item.handRequest || !item.behaviorMatched).map(item => ({ requirementId: item.gapAssessment.requirementId, assessmentDigest: item.gapAssessment.assessmentDigest, classification: item.gapAssessment.classification, counts: clone(item.gapAssessment.counts), state: 'HELD_NO_PROVIDER_DECLARATION_HAND_BUILT' }));
  if (!state && proposals.length) {
    state = 'PROPOSED_PROVIDER_DECLARATION_GAP_HANDS';
    reason = 'Exact consumer demand with zero exact providers supports nonbuilt declaration-gap hands for attributed steward resolution.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_CONSUMER_BOUND_UNIQUE_PROVIDER_DECLARATION_GAP';
    reason = 'A declaration is already present, demand is not exact, or competing declarations require inspection; no new hand is proposed.';
  } else if (!state) {
    state = 'NO_PROVIDER_DECLARATION_GAP_ASSESSMENTS';
    reason = 'No current affordance assessments require provider declaration gap planning.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    proposals,
    holds,
    declarationCandidatesBuilt: false,
    providerDeclarationsWritten: false,
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, HAND_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_ASSESSMENTS, IMPLEMENTATION_CONTRACT,
  digest, sourceLineage, createHandRequest, verifyHandRequest, truthfulActionId, reasoningInput, verifySession, expectedSummary, verifyBatch, derive, respond
};
