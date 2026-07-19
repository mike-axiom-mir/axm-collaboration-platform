'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Frontier = require('../kernel/frontier-cell');
const GapCell = require('../kernel/readiness-gap-cell');
const HandoffGraph = require('./reasoning-handoff-graph-organ');
const RouteReadiness = require('./reasoning-route-readiness-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-readiness-hand-planner-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-readiness-hand-batch/v1';
const HAND_SCHEMA = 'axm.mirror.readiness-probe-hand-request/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-readiness-hand-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-readiness-hand-response/v1';
const MAX_GAPS = 128;
const MAX_PROPOSALS = 32;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'readiness-gap-to-nonexecuting-hand-request-v1',
  sourceRule: 'aggregate UNKNOWN requirements only from a verified route-readiness batch and bind their manifest-bound module evidence',
  missingProbeRule: 'only exact missing-live-readiness-source or missing-readiness-probe observations may originate a new probe hand request',
  impactRule: 'route count is prioritization evidence only; it is not urgency, permission, feasibility, or truth',
  falseReadyRule: 'every gap must reject a candidate that claims READY',
  generatedWordingAuthority: false,
  codeGeneration: false,
  install: false,
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
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function token(value, fallback = '') { const result = clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120); return result || fallback; }
function inside(root, target) { const relative = path.relative(path.resolve(root), path.resolve(target)); return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/readiness-gap-cell'),
    path.join(root, 'contracts', 'readiness-gap-assessment.schema.json'),
    path.join(root, 'contracts', 'readiness-probe-hand-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-hand-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-hand-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-hand-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function buildAssessments(readinessBatch, handoffBatch) {
  RouteReadiness.verifyBatch(readinessBatch, null, handoffBatch);
  HandoffGraph.verifyBatch(handoffBatch);
  if (readinessBatch.sourceGraph.batchId !== handoffBatch.batchId || readinessBatch.sourceGraph.batchDigest !== handoffBatch.batchDigest) throw new Error('readiness hand source graph mismatch');
  const contracts = new Map(handoffBatch.contracts.map(item => [item.moduleId, item]));
  const groups = new Map();
  for (const module of readinessBatch.modules) {
    const contract = contracts.get(module.moduleId);
    if (!contract) throw new Error(`readiness hand source contract missing: ${module.moduleId}`);
    for (const requirement of module.requirements.filter(item => item.state === 'UNKNOWN')) {
      const group = groups.get(requirement.id) || { requirementId: requirement.id, observations: [], impactedRouteIds: new Set() };
      group.observations.push({
        moduleId: module.moduleId,
        state: requirement.state,
        detail: requirement.detail,
        evidenceMatchesGraph: module.evidenceMatchesGraph,
        manifestRelativePath: contract.manifestRelativePath,
        manifestSha256: contract.manifestSha256,
        contractRelativePath: contract.contractRelativePath,
        contractSha256: contract.contractSha256
      });
      groups.set(requirement.id, group);
    }
  }
  for (const result of readinessBatch.results) {
    for (const attention of result.assessment.attention.filter(item => item.state === 'UNKNOWN')) {
      const group = groups.get(attention.id);
      if (group) group.impactedRouteIds.add(result.routeId);
    }
  }
  if (groups.size > MAX_GAPS) throw new Error(`readiness hand planner holds: ${groups.size} gaps exceed ${MAX_GAPS}`);
  return Array.from(groups.values()).map(group => GapCell.evaluate({
    sourceReadinessBatchId: readinessBatch.batchId,
    sourceReadinessBatchDigest: readinessBatch.batchDigest,
    sourceStateDigest: readinessBatch.source.stateDigest,
    requirementId: group.requirementId,
    observations: group.observations,
    impactedRouteIds: Array.from(group.impactedRouteIds)
  })).sort((a, b) => b.counts.impactedRoutes - a.counts.impactedRoutes || b.counts.observedModules - a.counts.observedModules || a.requirementId.localeCompare(b.requirementId));
}

function createHandRequest(assessment) {
  GapCell.verify(assessment);
  if (assessment.classification !== 'MISSING_PROBE_HAND_CANDIDATE') return null;
  const basis = {
    schema: HAND_SCHEMA,
    requirementId: assessment.requirementId,
    assessmentDigest: assessment.assessmentDigest,
    observedInModuleIds: assessment.observations.map(item => item.moduleId),
    impact: {
      manifestBoundRouteCount: assessment.counts.impactedRoutes,
      observedModuleCount: assessment.counts.observedModules,
      routeIds: assessment.impactedRouteIds,
      interpretation: 'Impact counts prioritize review only; they do not prove urgency, permission, feasibility, or implementation quality.'
    },
    evidenceBindings: assessment.observations.map(item => ({
      moduleId: item.moduleId,
      manifestRelativePath: item.manifestRelativePath,
      manifestSha256: item.manifestSha256,
      contractRelativePath: item.contractRelativePath,
      contractSha256: item.contractSha256,
      observedState: item.state,
      observedDetail: item.detail
    })),
    proposedProbeContract: {
      subjectRequirementId: assessment.requirementId,
      inputSchema: 'axm.readiness-probe-request/v1',
      outputSchema: 'axm.readiness-observation/v1',
      requiredOutputFields: ['schema', 'requirementId', 'state', 'observedAt', 'evidenceRef', 'detail'],
      allowedStates: ['READY', 'AVAILABLE', 'OPTIONAL', 'USER_ACTION', 'OFFLINE', 'TRIPPED', 'UNKNOWN'],
      maximumObservationAgeMs: RouteReadiness.MAX_SNAPSHOT_AGE_MS,
      serviceSpecificMethod: 'MISSING_NOT_INFERRED',
      permissionRequirements: 'UNKNOWN_REQUIRES_EXPLICIT_CONTRACT_AND_STEWARD_REVIEW',
      verificationRequirements: [
        'positive fixture produces a content-bound non-stale observation',
        'negative or unavailable fixture never produces READY',
        'timeout, malformed output, and missing evidence map to UNKNOWN',
        'probe performs no repair, start, grant, install, or unrelated write',
        'an evaluator other than the probe verifies the output contract'
      ],
      recoveryRequirement: 'Probe failure changes no service state; discard the observation and preserve UNKNOWN.',
      implementationState: 'NOT_BUILT'
    },
    state: 'REVIEWABLE_MISSING_PROBE_HAND_REQUEST_NOT_BUILT',
    humanWordingAuthority: false,
    authority: {
      readinessClaim: false,
      probeCodeGeneration: false,
      fileWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This is a reviewable missing-hand contract proposal, not probe code, readiness evidence, permission, installation, execution, or completion.'
  };
  const requestId = `readiness-hand-${digest(basis).slice(0, 20)}`;
  const request = Object.assign({ requestId, requestDigest: null }, basis);
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return request;
}

function verifyHandRequest(request, assessment) {
  const expected = createHandRequest(assessment);
  if (!expected || !request || request.schema !== HAND_SCHEMA || request.requestDigest !== digest(Object.assign({}, request, { requestDigest: null }))) throw new Error('invalid readiness hand request');
  if (JSON.stringify(stable(request)) !== JSON.stringify(stable(expected))) throw new Error('readiness hand request content mismatch');
  return true;
}

function reasoningInput(assessment) {
  const candidate = assessment.classification === 'MISSING_PROBE_HAND_CANDIDATE';
  const truthfulActionId = candidate ? `propose-probe-hand-${assessment.requirementId}` : `hold-inspect-${assessment.requirementId}`;
  const falseReadyActionId = `claim-ready-${assessment.requirementId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `readiness-hand-exam-${digest(assessment.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-readiness-hand-planner-organ' },
    goal: 'Choose whether current UNKNOWN evidence supports a missing-probe hand request or only an inspection hold, while rejecting a false READY claim.',
    evidence: [{
      id: 'readiness-gap-assessment', kind: 'observation', status: 'observed',
      statement: `The independent readiness gap cell classified ${assessment.requirementId} as ${assessment.classification}.`,
      source: { kind: 'readiness-gap-assessment', id: assessment.assessmentDigest, uri: `sha256:${assessment.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Content-digested manifest-bound UNKNOWN observations.' }
    }],
    unknowns: [{ id: `implementation-${assessment.requirementId}`, question: 'What service-specific probe method and permissions are valid?', blocking: true }],
    assumptions: [], constraints: [], permissions: [],
    actions: [{
      id: truthfulActionId, kind: 'proposal',
      label: candidate ? `Propose a non-executing readiness probe hand contract for ${assessment.requirementId}` : `Hold ${assessment.requirementId} for inspection instead of assuming a missing probe`,
      supportingEvidence: ['readiness-gap-assessment'], preconditionEvidence: ['readiness-gap-assessment'], requiredPermissions: [],
      expectedEffects: ['A reviewable classification or hand request is surfaced; no code or service changes.'],
      possibleSideEffects: ['Route impact may be mistaken for implementation urgency.'], reversible: true, recovery: 'Discard the proposal; source state is unchanged.', risk: 'low'
    }, {
      id: falseReadyActionId, kind: 'proposal', label: `Claim ${assessment.requirementId} is READY despite UNKNOWN evidence`,
      supportingEvidence: ['readiness-gap-assessment'], preconditionEvidence: ['readiness-gap-assessment'], requiredPermissions: [],
      expectedEffects: ['An unsupported readiness claim would be surfaced.'], possibleSideEffects: ['A blocked route could be mistaken for executable.'],
      reversible: true, recovery: 'Discard the false claim and preserve UNKNOWN.', risk: 'medium'
    }],
    decomposition: [{ id: 'classify-gap', question: 'Is this UNKNOWN caused by a specifically missing probe declaration?', dependsOn: [], cheapestCheck: 'Use the typed gap assessment and exact observed detail.', status: 'ANSWERED', answerEvidenceRefs: ['readiness-gap-assessment'] }],
    pathProfiles: [{
      actionId: truthfulActionId, pathId: `truthful-${assessment.requirementId}`, approach: 'Preserve the independent gap classification and propose no execution.', requiredEvidence: ['readiness-gap-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['Source readiness state changes.'], strategyTags: ['preserve-readiness-gap-classification']
    }, {
      actionId: falseReadyActionId, pathId: `false-ready-${assessment.requirementId}`, approach: 'Erase UNKNOWN by claiming READY.', requiredEvidence: ['readiness-gap-assessment'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: true, failureConditions: ['The source state is UNKNOWN.'], strategyTags: ['reject-false-readiness']
    }],
    verificationReceipts: [{ id: `verify-truthful-${assessment.requirementId}`, actionId: truthfulActionId, claim: 'The response preserves the typed gap classification.', evidenceRefs: ['readiness-gap-assessment'], method: 'Independent readiness gap assessment.', result: 'PASS', limitations: ['This does not verify a future probe implementation.'] }, { id: `verify-false-ready-${assessment.requirementId}`, actionId: falseReadyActionId, claim: 'UNKNOWN evidence supports READY.', evidenceRefs: ['readiness-gap-assessment'], method: 'Typed state comparison.', result: 'FAIL', limitations: ['A future fresh probe may change the state.'] }],
    budget: { maxCandidates: 4, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('readiness hand requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('readiness hand session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const falseReady = session.pathSet.comparisons.find(item => item.actionId === result.falseReadyActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !falseReady || falseReady.verificationStatus !== 'FAIL' || falseReady.eligible) throw new Error('readiness hand candidate discrimination changed');
  return true;
}

function frontierFor(results) {
  const mismatches = results.filter(item => !item.behaviorMatched);
  if (!mismatches.length) return { state: 'NO_UNEXPECTED_SEAM', assessment: null };
  const assessment = Frontier.inspect({
    subject: { id: 'readiness-hand-classification', statement: 'Preserve missing-probe versus other UNKNOWN distinctions.', domain: 'reasoning-foundation' },
    observations: mismatches.map(item => ({ id: item.reasoningSessionId, domain: 'readiness-hand', statement: `Expected ${item.expectedDecision.actionId} but observed ${item.observedDecision.actionId || 'none'}.`, perspective: 'MACHINE_NATIVE', patternTags: ['readiness-hand-mismatch'], evidenceRef: item.sessionSha256 })),
    unexpectedSeams: mismatches.map(item => ({ id: `readiness-hand-${item.requirementId}`, statement: 'Readiness hand classification was not preserved.', severity: 'high', evidenceRefs: [item.sessionSha256] }))
  });
  return { state: mismatches.length > 1 ? 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED' : 'SINGLE_GAP_MORE_EVIDENCE_REQUIRED', assessment };
}

function expectedSummary(results) {
  const impacted = new Set(results.flatMap(item => item.assessment.impactedRouteIds));
  return {
    unknownRequirementIds: results.length,
    missingProbeHandRequests: results.filter(item => item.handRequest).length,
    unknownInspectionHolds: results.filter(item => !item.handRequest).length,
    impactedManifestBoundRoutes: impacted.size,
    classificationsMatched: results.filter(item => item.behaviorMatched).length,
    classificationMismatches: results.filter(item => !item.behaviorMatched).length,
    falseReadyCandidatesRejected: results.filter(item => item.falseReadyRejected).length,
    codeFilesGenerated: 0,
    probesInstalled: 0,
    servicesStartedOrRepaired: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyBatch(batch, runDir, readinessBatch, handoffBatch) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid readiness hand batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || !batch.authority || batch.authority.privateEvaluationTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvaluationTraceWrite' && value !== false)) throw new Error('readiness hand authority boundary changed');
  const lineage = sourceLineage();
  if (JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(lineage))) throw new Error('readiness hand source lineage mismatch');
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, sourceGraph: batch.sourceGraph, sourceReadiness: batch.sourceReadiness, assessments: batch.results.map(item => item.assessment) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-readiness-hands-${inputsDigest.slice(0, 20)}`) throw new Error('readiness hand input lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_GAPS) throw new Error('readiness hand result bound changed');
  if (readinessBatch && handoffBatch) {
    const assessments = buildAssessments(readinessBatch, handoffBatch);
    if (batch.sourceReadiness.batchId !== readinessBatch.batchId || batch.sourceReadiness.batchDigest !== readinessBatch.batchDigest || batch.sourceGraph.batchId !== handoffBatch.batchId || batch.sourceGraph.batchDigest !== handoffBatch.batchDigest) throw new Error('readiness hand source batches changed');
    if (JSON.stringify(stable(assessments)) !== JSON.stringify(stable(batch.results.map(item => item.assessment)))) throw new Error('readiness hand gap set is incomplete or changed');
  }
  const ids = new Set();
  for (const result of batch.results) {
    if (ids.has(result.requirementId)) throw new Error('duplicate readiness hand requirement');
    ids.add(result.requirementId);
    GapCell.verify(result.assessment);
    if (result.assessment.requirementId !== result.requirementId) throw new Error('readiness hand requirement lineage mismatch');
    if (result.handRequest) verifyHandRequest(result.handRequest, result.assessment);
    else if (result.assessment.classification === 'MISSING_PROBE_HAND_CANDIDATE') throw new Error('missing readiness hand request');
    const truthfulActionId = result.assessment.classification === 'MISSING_PROBE_HAND_CANDIDATE' ? `propose-probe-hand-${result.requirementId}` : `hold-inspect-${result.requirementId}`;
    const expectedDecision = { value: 1, actionId: truthfulActionId };
    const falseReadyActionId = `claim-ready-${result.requirementId}`;
    const matched = result.observedDecision.value === 1 && result.observedDecision.actionId === truthfulActionId;
    if (JSON.stringify(stable(result.expectedDecision)) !== JSON.stringify(stable(expectedDecision)) || result.falseReadyActionId !== falseReadyActionId || result.behaviorMatched !== matched || result.falseReadyRejected !== true) throw new Error('readiness hand reasoning decision changed');
    if (result.codeFilesGenerated !== 0 || result.probesInstalled !== 0 || result.servicesStartedOrRepaired !== 0 || result.trainingReceiptCreated !== false || result.worldActionExecuted !== false) throw new Error('readiness hand proposal impersonates implementation or outcome');
    if (runDir) {
      const file = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`readiness hand session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(file);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`readiness hand session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`readiness hand session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary(batch.results)))) throw new Error('readiness hand summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-readiness-hand-runs'));
  if (!inside(root, stateDir)) throw new Error('readiness hand private state must stay inside Mirror root');
  const handoff = options.handoffDerived || HandoffGraph.derive({ root, workshopRoot, stateDir: options.handoffGraphStateDir || path.join(root, 'state', 'reasoning-handoff-graph-runs') });
  const readiness = options.readinessDerived || RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, stateDir: options.routeReadinessStateDir || path.join(root, 'state', 'reasoning-route-readiness-runs'), snapshot: options.snapshot });
  const assessments = buildAssessments(readiness.batch, handoff.batch);
  const lineage = sourceLineage();
  const sourceGraph = { batchId: handoff.batch.batchId, batchDigest: handoff.batch.batchDigest };
  const sourceReadiness = { batchId: readiness.batch.batchId, batchDigest: readiness.batch.batchDigest, stateDigest: readiness.batch.source.stateDigest };
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, sourceGraph, sourceReadiness, assessments };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-readiness-hands-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, readiness.batch, handoff.batch);
    return { batch, runDir, reused: true, readiness, handoff };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = assessments.map(assessment => {
    const input = reasoningInput(assessment);
    const session = Foundation.run(input, { at: '1970-01-01T00:00:00.000Z' });
    const truthfulActionId = assessment.classification === 'MISSING_PROBE_HAND_CANDIDATE' ? `propose-probe-hand-${assessment.requirementId}` : `hold-inspect-${assessment.requirementId}`;
    const expectedDecision = { value: 1, actionId: truthfulActionId };
    const falseReadyActionId = `claim-ready-${assessment.requirementId}`;
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const comparison = session.pathSet.comparisons.find(item => item.actionId === falseReadyActionId);
    const sessionFile = path.join('sessions', `session-${digest(assessment.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      requirementId: assessment.requirementId,
      assessment,
      handRequest: createHandRequest(assessment),
      expectedDecision,
      falseReadyActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === truthfulActionId,
      falseReadyRejected: !!comparison && comparison.verificationStatus === 'FAIL' && comparison.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      codeFilesGenerated: 0,
      probesInstalled: 0,
      servicesStartedOrRepaired: 0,
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
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_MISSING_READINESS_HAND_PLANNER', learnedWeights: false },
    cell: { id: GapCell.CELL_ID, schema: GapCell.SCHEMA, learnedWeights: false },
    implementationContract: IMPLEMENTATION_CONTRACT,
    sourceLineage: lineage,
    sourceGraph,
    sourceReadiness,
    results,
    frontier: frontierFor(results),
    summary: expectedSummary(results),
    authority: {
      privateEvaluationTraceWrite: true,
      readinessClaim: false,
      probeCodeGeneration: false,
      fileWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      trainingAdmission: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This organ turns specifically missing readiness-probe declarations into reviewable typed hand requests. Other UNKNOWN states remain inspection holds. It creates no probe code and cannot write, install, start, repair, grant, train, execute, or promote.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, readiness.batch, handoff.batch);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, readiness, handoff };
}

function plan(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`readiness hand request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical readiness hand request fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : token(request.requirementId);
  const limit = Math.max(1, Math.min(MAX_PROPOSALS, Number(request.limit) || 10));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_READINESS_REQUIREMENT';
      reason = 'The current readiness batch contains no UNKNOWN observation for that requirement ID.';
    }
  }
  const proposals = selected.filter(item => item.handRequest && item.behaviorMatched).slice(0, limit).map(item => item.handRequest);
  const inspectionHolds = selected.filter(item => !item.handRequest || !item.behaviorMatched).map(item => ({ requirementId: item.requirementId, assessmentDigest: item.assessment.assessmentDigest, classification: item.assessment.classification, impactedRoutes: item.assessment.counts.impactedRoutes, state: 'HELD_FOR_INSPECTION_NOT_BUILT' }));
  if (!state && proposals.length) {
    state = 'PROPOSED_READINESS_PROBE_HAND_REQUESTS';
    reason = 'Current manifest-bound UNKNOWN observations explicitly report missing probe declarations; reviewable hand contracts are proposed by route impact.';
  } else if (!state && inspectionHolds.length) {
    state = 'HOLD_UNKNOWN_REQUIRES_INSPECTION_NOT_NEW_PROBE';
    reason = 'UNKNOWN evidence exists but does not prove a probe declaration is missing.';
  } else if (!state) {
    state = 'NO_MISSING_READINESS_PROBE_HANDS';
    reason = 'The current manifest-bound route set has no UNKNOWN readiness requirements.';
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
    inspectionHolds,
    humanRenderingAuthority: false,
    authority: {
      readinessClaim: false,
      probeCodeGeneration: false,
      fileWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      trainingAdmission: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Hand requests are reviewable specifications, not probe code or readiness. No request is installed, started, repaired, granted, trained, executed, or promoted.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, HAND_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_GAPS, MAX_PROPOSALS, IMPLEMENTATION_CONTRACT,
  digest, sourceLineage, buildAssessments, createHandRequest, verifyHandRequest, reasoningInput, verifySession, verifyBatch, derive, plan
};
