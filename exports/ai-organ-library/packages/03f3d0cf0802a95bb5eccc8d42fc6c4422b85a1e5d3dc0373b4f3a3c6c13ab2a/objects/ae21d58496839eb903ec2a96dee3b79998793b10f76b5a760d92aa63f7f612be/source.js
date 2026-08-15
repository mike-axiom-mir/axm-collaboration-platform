'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const BindingCell = require('../kernel/provider-binding-experiment-cell');
const SessionEvidenceSegments = require('../kernel/session-evidence-segment-cell');
const ImplementationEvidence = require('./provider-declaration-implementation-evidence-survey-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-binding-experiment-planner-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-binding-experiment-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-binding-experiment-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-binding-experiment-response/v1';
const MAX_RESULTS = 128;
const MAX_FRAMES_PER_MATRIX = 384;
const PLANNER_CONTRACT = Object.freeze({
  version: 'implementation-evidence-to-balanced-provider-binding-experiment-matrix-session-segment-v2',
  sourceRule: 'pair every eligible exported exact-selector source with every positive UNTESTED architecture hypothesis',
  validationRule: 'reserve tests and non-exported selector witnesses as validation evidence rather than implementation candidates',
  unresolvedRule: 'provider identity, outer binding, declaration schema and path, and provider permissions remain unresolved',
  evidenceCeiling: 'BALANCED_EXPERIMENT_INPUT_MATRIX_NOT_PROVIDER_BINDING',
  sessionStorage: 'HASH_CHAINED_JSONL_PER_PROVIDER_BINDING_EXPERIMENT_BATCH_V1',
  maximumSessionsPerSegment: MAX_RESULTS,
  historicalSessionFilesRewritten: false,
  automaticEvidenceDeletion: false,
  firstOrStrongestSourceSelection: false,
  consumerPermissionCopy: false,
  experimentFrameSelection: false,
  sourceExecution: false,
  architectureSelection: false,
  architectureEvaluation: false,
  providerCandidateBuild: false,
  declarationWrite: false,
  workshopWrite: false,
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
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/provider-binding-experiment-cell'),
    require.resolve('../kernel/session-evidence-segment-cell'),
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('./provider-declaration-implementation-evidence-survey-organ'),
    path.join(root, 'contracts', 'provider-declaration-binding-experiment-frame.schema.json'),
    path.join(root, 'contracts', 'provider-declaration-binding-experiment-matrix.schema.json'),
    path.join(root, 'contracts', 'session-evidence-segment-manifest.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-binding-experiment-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-binding-experiment-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-binding-experiment-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function researchResultsByRequirement(implementationDerived) {
  const architectureDerived = implementationDerived && implementationDerived.architectureDerived;
  const researchDerived = architectureDerived && architectureDerived.researchDerived;
  if (!researchDerived || !researchDerived.batch || !Array.isArray(researchDerived.batch.results)) throw new Error('provider binding experiment planner requires research-exam lineage');
  const output = new Map();
  for (const result of researchDerived.batch.results) {
    const requirementId = result.handRequest && result.handRequest.requirementId || result.gapAssessment && result.gapAssessment.requirementId || result.researchExamRequest && result.researchExamRequest.sourceHand && result.researchExamRequest.sourceHand.requirementId;
    if (!requirementId || output.has(requirementId)) throw new Error('provider binding experiment planner research requirement lineage is missing or ambiguous');
    output.set(requirementId, result);
  }
  return output;
}

function createFoundation(sourceResult, researchResult) {
  const requirementId = sourceResult.requirementId;
  const evidence = sourceResult.evidenceSurvey ? clone(sourceResult.evidenceSurvey) : null;
  const architecture = sourceResult.sourceArchitectureSurvey ? clone(sourceResult.sourceArchitectureSurvey) : null;
  const exam = researchResult && researchResult.researchExamRequest ? clone(researchResult.researchExamRequest) : null;
  if (!!evidence !== !!architecture) throw new Error('provider binding experiment planner evidence and architecture presence mismatch');
  if (evidence && !exam) throw new Error('provider binding experiment planner cannot frame evidence without its independent research exam');
  const matrix = evidence ? BindingCell.evaluate({ requirementId, evidenceSurvey: evidence, architectureSurvey: architecture, researchExamRequest: exam }) : null;
  if (matrix && matrix.experimentFrames.length > MAX_FRAMES_PER_MATRIX) throw new Error(`provider binding experiment matrix exceeds ${MAX_FRAMES_PER_MATRIX} frames`);
  return { requirementId, sourceEvidenceSurvey: evidence, sourceArchitectureSurvey: architecture, sourceResearchExamRequest: exam, experimentMatrix: matrix };
}

function truthfulActionId(requirementId, matrix) {
  return matrix ? `preserve-balanced-provider-binding-experiment-matrix-${requirementId}` : `preserve-no-provider-binding-experiment-matrix-${requirementId}`;
}

function reasoningInput(foundation) {
  const requirementId = foundation.requirementId;
  const matrix = foundation.experimentMatrix;
  const truthful = truthfulActionId(requirementId, matrix);
  const select = `select-first-provider-binding-frame-${requirementId}`;
  const copyPermissions = `copy-consumer-permissions-to-provider-${requirementId}`;
  const frameCount = matrix ? matrix.experimentFrames.length : 0;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-binding-experiments-${digest(matrix ? matrix.matrixDigest : requirementId).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-provider-binding-experiment-planner-organ' },
    goal: 'Originate a balanced provider-binding experiment matrix without selecting a source, copying permissions, or establishing a provider relation.',
    evidence: [{
      id: 'binding-experiment-lineage', kind: 'observation', status: 'observed',
      statement: matrix ? `${requirementId} has ${matrix.candidateSources.length} eligible source inputs across ${matrix.hypothesesRepresented.length} UNTESTED architecture hypotheses, producing ${frameCount} balanced experiment frames.` : `${requirementId} has no implementation evidence survey from which to originate binding experiment frames.`,
      source: { kind: 'provider-implementation-evidence-survey', id: matrix ? matrix.sourceEvidenceSurvey.evidenceSurveyDigest : digest(requirementId), uri: matrix ? `sha256:${matrix.sourceEvidenceSurvey.evidenceSurveyDigest}` : null },
      confidence: { low: 1, high: 1, basis: 'Immutable content-digested evidence survey, architecture survey, and independently authored research exam.' }
    }],
    unknowns: matrix ? [
      { id: 'provider-identity', question: 'Which attributed provider identity should be tested?', blocking: true },
      { id: 'provider-permissions', question: 'Which permissions belong to the provider rather than its consumer?', blocking: true },
      { id: 'declaration-binding', question: 'Which schema and target path explicitly bind the outer requirement to one implementation?', blocking: true }
    ] : [],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: matrix ? 'Preserve every balanced experiment frame without selecting one' : 'Preserve the explicit no-matrix result', supportingEvidence: ['binding-experiment-lineage'], preconditionEvidence: ['binding-experiment-lineage'], requiredPermissions: [], expectedEffects: ['Reviewable experiment inputs remain complete, symmetric, and nonauthoritative.'], possibleSideEffects: ['A reviewer could mistake a proposed implementation input for an established provider binding.'], reversible: true, recovery: 'Discard the matrix view while preserving all source and exam lineage.', risk: 'low' },
      { id: select, kind: 'proposal', label: 'Select the first or strongest-looking source frame as the provider', supportingEvidence: ['binding-experiment-lineage'], preconditionEvidence: ['binding-experiment-lineage'], requiredPermissions: [], expectedEffects: ['One frame would gain provider and architecture authority from ordering or surface syntax.'], possibleSideEffects: ['Adversarial or canary source could be silently promoted.'], reversible: false, recovery: 'Restore the balanced matrix and require attributed review plus independent evaluation.', risk: 'high' },
      { id: copyPermissions, kind: 'proposal', label: 'Copy consumer permission strings into the provider declaration', supportingEvidence: ['binding-experiment-lineage'], preconditionEvidence: ['binding-experiment-lineage'], requiredPermissions: [], expectedEffects: ['Consumer permissions would be treated as provider permission evidence.'], possibleSideEffects: ['The provider could receive missing, excessive, or semantically wrong permissions.'], reversible: false, recovery: 'Keep provider permissions unresolved until explicitly declared and independently checked.', risk: 'high' }
    ],
    decomposition: [{ id: 'separate-experiment-input-from-binding', question: 'Can known evidence automatically form complete experiment inputs without choosing a provider?', dependsOn: [], cheapestCheck: 'Construct the full candidate-source by positive-hypothesis cross-product and verify selectedFrameId remains null.', status: 'ANSWERED', answerEvidenceRefs: ['binding-experiment-lineage'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `balanced-matrix-${requirementId}`, approach: 'Preserve all evidence-derived frames and unresolved dimensions.', requiredEvidence: ['binding-experiment-lineage'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['A frame is omitted, selected, executed, or promoted.'], strategyTags: ['balanced-experiment-matrix', 'preserve-provider-unknown'] },
      { actionId: select, pathId: `first-frame-selection-${requirementId}`, approach: 'Use ordering or source signals as selection authority.', requiredEvidence: ['binding-experiment-lineage'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No attributed selection or independent evaluation exists.'], strategyTags: ['reject-order-authority'] },
      { actionId: copyPermissions, pathId: `consumer-permission-copy-${requirementId}`, approach: 'Infer provider permissions from consumer declarations.', requiredEvidence: ['binding-experiment-lineage'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Consumer and provider permission roles are different.'], strategyTags: ['reject-permission-inference'] }
    ],
    verificationReceipts: [
      { id: `verify-balanced-${requirementId}`, actionId: truthful, claim: 'The matrix is a complete cross-product and selects no frame.', evidenceRefs: ['binding-experiment-lineage'], method: 'Recompute all eligible source and positive hypothesis pairs; inspect selectedFrameId and authority maps.', result: 'PASS', limitations: ['The frames are experiment inputs, not evaluated candidates.'] },
      { id: `verify-select-${requirementId}`, actionId: select, claim: 'Source order or registration syntax establishes provider fitness.', evidenceRefs: ['binding-experiment-lineage'], method: 'Look for attributed binding review and independent case execution.', result: 'FAIL', limitations: ['Later independent evidence may support one frame.'] },
      { id: `verify-permissions-${requirementId}`, actionId: copyPermissions, claim: 'Consumer permissions prove provider permissions.', evidenceRefs: ['binding-experiment-lineage'], method: 'Compare actor roles and require a provider-side declaration.', result: 'FAIL', limitations: ['Some strings may coincide but role-specific evidence is still required.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('provider binding experiment planner requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('provider binding experiment planner session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const select = session.pathSet.comparisons.find(item => item.actionId === result.frameSelectionActionId);
  const permissions = session.pathSet.comparisons.find(item => item.actionId === result.permissionCopyActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !select || select.verificationStatus !== 'FAIL' || select.eligible || !permissions || permissions.verificationStatus !== 'FAIL' || permissions.eligible) throw new Error('provider binding experiment planner discrimination changed');
  return true;
}

function expectedSummary(results, sessionEvidence = null, includeSessionMetrics = true) {
  const matrices = results.filter(item => item.experimentMatrix).map(item => item.experimentMatrix);
  const summary = {
    implementationEvidenceResultsEvaluated: results.length,
    experimentMatricesProposed: matrices.length,
    noImplementationEvidenceHolds: results.filter(item => !item.experimentMatrix).length,
    candidateSourceWitnesses: matrices.reduce((sum, item) => sum + item.candidateSources.length, 0),
    validationOnlyWitnesses: matrices.reduce((sum, item) => sum + item.validationWitnesses.length, 0),
    architectureHypothesesRepresented: matrices.reduce((sum, item) => sum + item.hypothesesRepresented.length, 0),
    experimentFramesProposed: matrices.reduce((sum, item) => sum + item.experimentFrames.length, 0),
    fallbackHypothesesRemainingUntested: matrices.filter(item => item.unresolvedFallback && item.unresolvedFallback.state === 'UNTESTED').length,
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    frameSelectionsRejected: results.filter(item => item.frameSelectionRejected).length,
    permissionCopiesRejected: results.filter(item => item.permissionCopyRejected).length,
    framesSelected: 0,
    providerIdentitiesInferred: 0,
    outerRequirementsBound: 0,
    permissionsInferred: 0,
    implementationsSelected: 0,
    sourcesExecuted: 0,
    architecturesSelected: 0,
    architecturesEvaluated: 0,
    providerCandidatesBuilt: 0,
    providerDeclarationsWritten: 0,
    workshopFilesChanged: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
  if (includeSessionMetrics) {
    summary.sessionEvidenceRecords = results.length;
    summary.sessionEvidenceSegments = sessionEvidence ? sessionEvidence.segments.length : results.length;
    summary.individualSessionFilesWritten = sessionEvidence ? 0 : results.length;
    summary.sessionFilesAvoidedAgainstLegacyLayout = sessionEvidence ? Math.max(0, results.length - sessionEvidence.segments.length) : 0;
  }
  return summary;
}

function sessionSegmentId(batchId) {
  return `${batchId}/session-segment-0000`;
}

function verifySessionEvidence(batch, runDir) {
  const evidence = batch.sessionEvidence;
  if (!evidence) return { legacy: true, segmentCount: 0 };
  const expectedSegments = batch.results.length ? 1 : 0;
  if (evidence.cellId !== SessionEvidenceSegments.CELL_ID || evidence.storage !== PLANNER_CONTRACT.sessionStorage ||
      evidence.records !== batch.results.length || evidence.legacySessionFilesWritten !== 0 ||
      evidence.historicalRunsRewritten !== false || evidence.automaticDeletion !== false ||
      !Array.isArray(evidence.segments) || evidence.segments.length !== expectedSegments) {
    throw new Error('provider binding experiment session evidence declaration mismatch');
  }
  if (!expectedSegments) return { legacy: false, segmentCount: 0 };
  const segment = evidence.segments[0];
  const expectedSegmentId = sessionSegmentId(batch.batchId);
  if (!segment || segment.segmentIndex !== 0 || segment.segmentId !== expectedSegmentId ||
      !segment.manifest || segment.manifest.segmentId !== expectedSegmentId ||
      segment.manifest.records !== batch.results.length || path.basename(segment.file || '') !== segment.manifest.segmentFile) {
    throw new Error('provider binding experiment session evidence segment lineage mismatch');
  }
  let checked = null;
  if (runDir) {
    const file = path.resolve(runDir, segment.file || '');
    if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`provider binding experiment session segment missing: ${expectedSegmentId}`);
    try { checked = SessionEvidenceSegments.verify(file, segment.manifest); }
    catch (error) { throw new Error(`provider binding experiment session hash mismatch: ${expectedSegmentId}: ${error.message}`); }
  }
  const referenced = new Set();
  for (const result of batch.results) {
    const reference = result.sessionRecord;
    if (result.sessionFile !== segment.file || !reference || !Number.isInteger(reference.index) ||
        reference.index < 0 || reference.index >= batch.results.length || reference.recordId !== result.reasoningSessionId ||
        reference.payloadDigest !== result.sessionDigest || !/^[a-f0-9]{64}$/.test(reference.eventHash || '')) {
      throw new Error(`provider binding experiment session reference mismatch: ${result.reasoningSessionId}`);
    }
    if (referenced.has(reference.index)) throw new Error('provider binding experiment session record is referenced more than once');
    referenced.add(reference.index);
    if (checked) {
      const record = checked.records[reference.index];
      if (record.recordId !== reference.recordId || record.payloadDigest !== reference.payloadDigest || record.eventHash !== reference.eventHash) {
        throw new Error(`provider binding experiment session record lineage mismatch: ${result.reasoningSessionId}`);
      }
      const bytes = Buffer.from(json(record.payload), 'utf8');
      if (digest(bytes) !== result.sessionSha256 || record.payload.reasoningSessionId !== result.reasoningSessionId) {
        throw new Error(`provider binding experiment session payload hash mismatch: ${result.reasoningSessionId}`);
      }
      verifySession(record.payload, result);
    }
  }
  if (referenced.size !== evidence.records) throw new Error('provider binding experiment session evidence contains unreferenced records');
  return { legacy: false, segmentCount: 1 };
}

function verifyBatch(batch, runDir, implementationDerived, workshopRoot) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider binding experiment batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || !batch.cell || batch.cell.id !== BindingCell.CELL_ID) throw new Error('provider binding experiment planner identity changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvidenceTraceWrite' && value !== false)) throw new Error('provider binding experiment planner authority changed');
  const lineage = sourceLineage();
  if (!same(batch.sourceLineage, lineage)) throw new Error('provider binding experiment planner source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RESULTS) throw new Error('provider binding experiment planner result bound changed');
  let sourceMap = null;
  let researchMap = null;
  if (implementationDerived) {
    if (!workshopRoot) throw new Error('provider binding experiment source verification requires its Workshop root');
    const discovered = ImplementationEvidence.discoverSources(path.resolve(workshopRoot));
    ImplementationEvidence.verifyBatch(implementationDerived.batch, implementationDerived.runDir, implementationDerived.architectureDerived, discovered);
    if (batch.sourceImplementationEvidenceBatch.batchId !== implementationDerived.batch.batchId || batch.sourceImplementationEvidenceBatch.batchDigest !== implementationDerived.batch.batchDigest) throw new Error('provider binding experiment source batch changed');
    sourceMap = new Map(implementationDerived.batch.results.map(item => [item.requirementId, item]));
    researchMap = researchResultsByRequirement(implementationDerived);
  }
  const inputFoundations = batch.results.map(item => ({ requirementId: item.requirementId, sourceEvidenceSurvey: item.sourceEvidenceSurvey, sourceArchitectureSurvey: item.sourceArchitectureSurvey, sourceResearchExamRequest: item.sourceResearchExamRequest, experimentMatrix: item.experimentMatrix }));
  const inputBasis = { organ: ORGAN_ID, plannerContract: PLANNER_CONTRACT, sourceLineage: lineage, sourceImplementationEvidenceBatch: batch.sourceImplementationEvidenceBatch, inputFoundations };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-binding-experiments-${inputsDigest.slice(0, 20)}`) throw new Error('provider binding experiment input lineage mismatch');
  if (batch.sessionEvidence) verifySessionEvidence(batch, runDir);
  for (const result of batch.results) {
    const source = sourceMap && sourceMap.get(result.requirementId);
    const research = researchMap && researchMap.get(result.requirementId);
    if (source && !same(source.evidenceSurvey, result.sourceEvidenceSurvey)) throw new Error('provider binding experiment source evidence changed');
    if (source && !same(source.sourceArchitectureSurvey, result.sourceArchitectureSurvey)) throw new Error('provider binding experiment source architecture changed');
    if (research && !same(research.researchExamRequest, result.sourceResearchExamRequest)) throw new Error('provider binding experiment source exam changed');
    if (!!result.experimentMatrix !== !!result.sourceEvidenceSurvey) throw new Error('provider binding experiment matrix presence changed');
    if (result.experimentMatrix) {
      BindingCell.verify(result.experimentMatrix);
      const expected = BindingCell.evaluate({ requirementId: result.requirementId, evidenceSurvey: result.sourceEvidenceSurvey, architectureSurvey: result.sourceArchitectureSurvey, researchExamRequest: result.sourceResearchExamRequest });
      if (!same(expected, result.experimentMatrix)) throw new Error('provider binding experiment matrix no longer matches source evidence');
      if (result.experimentMatrix.experimentFrames.length > MAX_FRAMES_PER_MATRIX) throw new Error('provider binding experiment frame bound changed');
    }
    if (!result.behaviorMatched || !result.frameSelectionRejected || !result.permissionCopyRejected || result.selectedFrameId !== null || result.providerIdentityInferred || result.outerRequirementBound || result.permissionsInferred || result.implementationSelected || result.sourceExecuted || result.architectureSelected || result.architectureEvaluated || result.providerCandidateBuilt || result.providerDeclarationWritten || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider binding experiment result exceeds proposal boundary');
    if (runDir && !batch.sessionEvidence) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider binding experiment session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider binding experiment session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error('provider binding experiment session lineage mismatch');
      verifySession(session, result);
    }
  }
  const includeSessionMetrics = !!batch.sessionEvidence || Object.prototype.hasOwnProperty.call(batch.summary || {}, 'sessionEvidenceRecords');
  if (!same(batch.summary, expectedSummary(batch.results, batch.sessionEvidence || null, includeSessionMetrics))) throw new Error('provider binding experiment summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-binding-experiment-runs'));
  if (!inside(root, stateDir)) throw new Error('provider binding experiment private state must stay inside Mirror root');
  const implementationDerived = options.implementationDerived || ImplementationEvidence.derive(Object.assign({}, options.implementationOptions || {}, { root, workshopRoot }));
  const discovered = ImplementationEvidence.discoverSources(workshopRoot);
  ImplementationEvidence.verifyBatch(implementationDerived.batch, implementationDerived.runDir, implementationDerived.architectureDerived, discovered);
  if (implementationDerived.batch.results.length > MAX_RESULTS) throw new Error(`provider binding experiment planner holds: ${implementationDerived.batch.results.length} results exceed ${MAX_RESULTS}`);
  const researchMap = researchResultsByRequirement(implementationDerived);
  const foundations = implementationDerived.batch.results.map(item => createFoundation(item, researchMap.get(item.requirementId))).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  const lineage = sourceLineage();
  const sourceImplementationEvidenceBatch = { batchId: implementationDerived.batch.batchId, batchDigest: implementationDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, plannerContract: PLANNER_CONTRACT, sourceLineage: lineage, sourceImplementationEvidenceBatch, inputFoundations: foundations };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-binding-experiments-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, implementationDerived, workshopRoot);
    return { batch, runDir, reused: true, implementationDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.s-${digest(batchId).slice(0, 12)}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const sessionFile = path.join('sessions', 'session-segment-0000.jsonl').replace(/\\/g, '/');
  const sessionRecords = [];
  const results = foundations.map(foundation => {
    const session = Foundation.run(reasoningInput(foundation), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(foundation.requirementId, foundation.experimentMatrix);
    const frameSelectionActionId = `select-first-provider-binding-frame-${foundation.requirementId}`;
    const permissionCopyActionId = `copy-consumer-permissions-to-provider-${foundation.requirementId}`;
    const select = session.pathSet.comparisons.find(item => item.actionId === frameSelectionActionId);
    const permissions = session.pathSet.comparisons.find(item => item.actionId === permissionCopyActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const bytes = Buffer.from(json(session), 'utf8');
    const result = Object.assign({}, foundation, {
      expectedDecision: { value: 1, actionId: expectedAction },
      frameSelectionActionId,
      permissionCopyActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      frameSelectionRejected: !!select && select.verificationStatus === 'FAIL' && select.eligible === false,
      permissionCopyRejected: !!permissions && permissions.verificationStatus === 'FAIL' && permissions.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionRecord: null,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      selectedFrameId: null,
      providerIdentityInferred: false,
      outerRequirementBound: false,
      permissionsInferred: false,
      implementationSelected: false,
      sourceExecuted: false,
      architectureSelected: false,
      architectureEvaluated: false,
      providerCandidateBuilt: false,
      providerDeclarationWritten: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    });
    verifySession(session, result);
    sessionRecords.push({ recordId: session.reasoningSessionId, payload: session });
    return result;
  });
  const sessionEvidenceSegments = [];
  if (sessionRecords.length) {
    const segmentId = sessionSegmentId(batchId);
    const written = SessionEvidenceSegments.write(path.join(stageDir, sessionFile), sessionRecords, { segmentId });
    for (let index = 0; index < written.records.length; index += 1) results[index].sessionRecord = written.records[index];
    sessionEvidenceSegments.push({ segmentIndex: 0, segmentId, file: sessionFile, manifest: written.manifest });
  }
  const sessionEvidence = {
    cellId: SessionEvidenceSegments.CELL_ID,
    storage: PLANNER_CONTRACT.sessionStorage,
    records: results.length,
    segments: sessionEvidenceSegments,
    legacySessionFilesWritten: 0,
    historicalRunsRewritten: false,
    automaticDeletion: false
  };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_BALANCED_PROVIDER_BINDING_EXPERIMENT_PLANNER', learnedWeights: false },
    cell: { id: BindingCell.CELL_ID, matrixSchema: BindingCell.MATRIX_SCHEMA, frameSchema: BindingCell.FRAME_SCHEMA, learnedWeights: false },
    plannerContract: PLANNER_CONTRACT,
    sourceLineage: lineage,
    sourceImplementationEvidenceBatch,
    sessionEvidence,
    results,
    summary: expectedSummary(results, sessionEvidence),
    authority: {
      privateEvidenceTraceWrite: true,
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
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The organ may originate a complete symmetric matrix of provider-binding experiment inputs plus one sealed session segment per bounded batch under ignored private state. It cannot rewrite history, delete evidence, select a frame, infer provider identity or permissions, bind an outer requirement, execute source, choose or evaluate architecture, build or write a provider, touch Workshop, train, grant, install, or promote.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, implementationDerived, workshopRoot);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, implementationDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider binding experiment request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider binding experiment query fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : clean(request.requirementId, 300);
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_PROVIDER_IMPLEMENTATION_EVIDENCE_RESULT';
      reason = 'The current implementation-evidence batch contains no result for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const matrices = selected.filter(item => item.experimentMatrix && item.behaviorMatched).map(item => clone(item.experimentMatrix));
  const holds = selected.filter(item => !item.experimentMatrix || !item.behaviorMatched).map(item => ({ requirementId: item.requirementId, state: 'HELD_NO_PROVIDER_BINDING_EXPERIMENT_MATRIX', reason: item.sourceEvidenceSurvey ? 'Reasoning behavior did not match.' : 'No provider implementation evidence survey exists.' }));
  const frameCount = matrices.reduce((sum, item) => sum + item.experimentFrames.length, 0);
  if (!state && frameCount) {
    state = 'PROPOSED_PROVIDER_BINDING_EXPERIMENT_MATRICES_NOT_SELECTED';
    reason = 'Balanced evidence-derived experiment frames are reviewable, but no provider binding, source, permission set, or architecture has been selected.';
  } else if (!state && matrices.length) {
    state = 'HOLD_NO_ELIGIBLE_IMPLEMENTATION_EXPERIMENT_INPUT';
    reason = 'Implementation evidence exists, but no exported source is eligible even as a nonauthoritative experiment input.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_IMPLEMENTATION_EVIDENCE_SURVEY_TO_FRAME';
    reason = 'The selected result has no implementation evidence survey, so no binding experiment matrix is originated.';
  } else if (!state) {
    state = 'NO_PROVIDER_IMPLEMENTATION_EVIDENCE_RESULTS';
    reason = 'No current implementation evidence results are available.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    matrices,
    holds,
    selectedFrameId: null,
    providerIdentityInferred: false,
    outerRequirementBound: false,
    permissionsInferred: false,
    implementationSelected: false,
    sourceExecuted: false,
    architectureSelected: false,
    architectureEvaluated: false,
    providerCandidateBuilt: false,
    providerDeclarationWritten: false,
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_RESULTS, MAX_FRAMES_PER_MATRIX, PLANNER_CONTRACT,
  digest, sourceLineage, researchResultsByRequirement, createFoundation, truthfulActionId, reasoningInput, verifySession,
  expectedSummary, sessionSegmentId, verifySessionEvidence, verifyBatch, derive, respond
};
