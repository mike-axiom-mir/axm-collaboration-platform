'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Frontier = require('../kernel/frontier-cell');
const ReadinessCell = require('../kernel/route-readiness-cell');
const HandoffGraph = require('./reasoning-handoff-graph-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-route-readiness-overlay-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-route-readiness-batch/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-route-readiness-response/v1';
const MAX_ROUTES = 256;
const MAX_MODULES = 64;
const MAX_SNAPSHOT_AGE_MS = 5 * 60 * 1000;
const IMPLEMENTATION_CONTRACT = Object.freeze({
  version: 'technical-glasses-route-readiness-overlay-v1',
  sourceSchema: 'axm.technical-glasses/v1',
  sourceRule: 'project only graph modules, their typed readiness requirements, and exact manifest-contract evidence paths',
  moduleRule: 'OFFLINE TRIPPED or UNKNOWN => BLOCKED; USER_ACTION => NEEDS_ACTION; AVAILABLE or OPTIONAL => AVAILABLE; otherwise READY',
  routeRule: 'apply the same ordering over all requirements from every module in the route',
  missingOrMismatchedSourceRule: 'inject explicit UNKNOWN and block',
  freshnessRule: `responses hold when the current observation is older than ${MAX_SNAPSHOT_AGE_MS}ms`,
  generatedWordingAuthority: false,
  trainingAdmission: false,
  execution: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return require('crypto').createHash('sha256').update(bytes).digest('hex');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }

function token(value, fallback = 'route') {
  const result = clean(value, 160).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  return result || fallback;
}

function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/route-readiness-cell'),
    path.join(root, 'contracts', 'route-readiness-assessment.schema.json'),
    path.join(root, 'contracts', 'reasoning-route-readiness-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-route-readiness-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function normalizeState(value) {
  const state = clean(value, 40).toUpperCase();
  return ReadinessCell.STATES.has(state) ? state : 'UNKNOWN';
}

function snapshotInput(options, workshopRoot) {
  if (options.snapshot && typeof options.snapshot === 'object') {
    const snapshot = clone(options.snapshot);
    return { snapshot, bytes: Buffer.from(json(snapshot), 'utf8'), source: 'INJECTED_TYPED_SNAPSHOT' };
  }
  const file = path.resolve(options.snapshotFile || path.join(workshopRoot, 'state', 'technical-glasses', 'latest.json'));
  if (!inside(workshopRoot, file) || !fs.existsSync(file)) return { snapshot: null, bytes: null, source: 'MISSING_TECHNICAL_GLASSES_SNAPSHOT' };
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) return { snapshot: null, bytes: null, source: 'REFUSED_UNSAFE_TECHNICAL_GLASSES_SNAPSHOT' };
  try {
    const bytes = fs.readFileSync(file);
    return { snapshot: JSON.parse(bytes.toString('utf8')), bytes, source: relative(workshopRoot, file) };
  } catch (error) {
    return { snapshot: null, bytes: null, source: 'REFUSED_INVALID_TECHNICAL_GLASSES_SNAPSHOT' };
  }
}

function projectSnapshot(source, handoffBatch) {
  const snapshot = source.snapshot;
  const validSnapshot = !!snapshot && snapshot.schema === 'axm.technical-glasses/v1' && snapshot.ok === true &&
    snapshot.freshness && /^[a-f0-9]{64}$/.test(String(snapshot.freshness.fingerprint || '')) && Array.isArray(snapshot.modules);
  const fingerprint = validSnapshot ? snapshot.freshness.fingerprint : '0'.repeat(64);
  const byId = new Map(validSnapshot ? snapshot.modules.map(module => [clean(module.id, 120), module]) : []);
  const graphModules = Array.from(new Set(handoffBatch.results.flatMap(result => result.moduleIds))).sort();
  if (graphModules.length > MAX_MODULES) throw new Error(`route readiness holds: ${graphModules.length} modules exceed the ${MAX_MODULES} module bound`);
  const contracts = new Map(handoffBatch.contracts.map(contract => [contract.moduleId, contract]));
  const modules = graphModules.map(moduleId => {
    const graph = contracts.get(moduleId);
    const observed = byId.get(moduleId);
    const evidence = observed && observed.evidence || {};
    const evidenceMatchesGraph = !!graph && !!observed && evidence.manifest === graph.manifestRelativePath && evidence.contract === graph.contractRelativePath &&
      evidence.contractDeclared === true && evidence.contractPass === true;
    let requirements = evidenceMatchesGraph && Array.isArray(observed.readiness) ? observed.readiness.map(item => ({
      id: clean(item.id, 120),
      state: normalizeState(item.state),
      detail: ReadinessCell.STATES.has(clean(item.state, 40).toUpperCase())
        ? clean(item.detail, 500) || 'No detail supplied by Technical Glasses.'
        : `Unsupported readiness state ${clean(item.state, 80) || 'EMPTY'} was preserved as UNKNOWN.`
    })) : [];
    if (!validSnapshot || !observed || !evidenceMatchesGraph) {
      requirements = [{
        id: 'technical-glasses-graph-evidence',
        state: 'UNKNOWN',
        detail: !validSnapshot ? 'Technical Glasses snapshot is missing or invalid.' : !observed ? 'Graph module is absent from Technical Glasses.' : 'Technical Glasses manifest or contract evidence does not match the graph.'
      }];
    }
    requirements.sort((a, b) => a.id.localeCompare(b.id));
    return { moduleId, evidenceMatchesGraph, requirements };
  });
  const stateBasis = { schema: validSnapshot ? snapshot.schema : 'MISSING_OR_INVALID', fingerprint, modules };
  const stateDigest = digest(stateBasis);
  return {
    schema: stateBasis.schema,
    fingerprint,
    stateDigest,
    modules,
    sourceState: validSnapshot ? 'OBSERVED' : 'MISSING_OR_INVALID',
    observation: {
      schema: validSnapshot ? snapshot.schema : null,
      compiledAt: validSnapshot ? snapshot.compiledAt || null : null,
      fingerprint,
      snapshotSha256: source.bytes ? digest(source.bytes) : null,
      source: source.source,
      stateDigest
    }
  };
}

function moduleSubset(route, projection) {
  const byId = new Map(projection.modules.map(module => [module.moduleId, module]));
  return route.moduleIds.map(moduleId => {
    const module = byId.get(moduleId);
    if (!module) throw new Error(`route readiness projection missing module ${moduleId}`);
    return module;
  });
}

function decoyAssessment(route, projection, actual) {
  if (actual.routeState !== 'READY') return actual;
  const modules = clone(moduleSubset(route, projection));
  if (modules[0].requirements.length) modules[0].requirements[0].state = 'UNKNOWN';
  else modules[0].requirements.push({ id: 'generated-readiness-unknown', state: 'UNKNOWN', detail: 'Generated structural unknown for discrimination only.' });
  const decoy = ReadinessCell.evaluate({ sourceStateDigest: projection.stateDigest, route: { routeId: route.routeId, moduleIds: route.moduleIds }, modules });
  if (decoy.routeState !== 'BLOCKED') throw new Error('ready route decoy did not become blocked');
  return decoy;
}

function routeInput(route, assessment, decoy, sessionId) {
  const assessmentEvidenceId = 'observed-route-readiness';
  const decoyEvidenceId = 'not-ready-route-evidence';
  const truthfulActionId = `surface-${assessment.routeState.toLowerCase()}-${route.routeId}`;
  const falseReadyActionId = `claim-ready-${route.routeId}`;
  const truthful = {
    id: truthfulActionId,
    kind: 'proposal',
    label: `Surface ${assessment.routeState} readiness state for ${route.moduleIds.join(' -> ')}`,
    requiredPermissions: [],
    supportingEvidence: [assessmentEvidenceId],
    preconditionEvidence: [assessmentEvidenceId],
    expectedEffects: ['A reviewable readiness classification is returned; no module is invoked.'],
    possibleSideEffects: ['Readiness may change after this observation.'],
    reversible: true,
    recovery: 'Refresh the independent readiness observation; no Workshop state was changed by this assessment.',
    risk: 'low'
  };
  const falseReady = {
    id: falseReadyActionId,
    kind: 'proposal',
    label: `Claim the route is READY despite non-ready evidence`,
    requiredPermissions: [],
    supportingEvidence: [decoyEvidenceId],
    preconditionEvidence: [decoyEvidenceId],
    expectedEffects: ['A readiness claim unsupported by the supplied assessment would be returned.'],
    possibleSideEffects: ['A human could mistake structural compatibility for current availability.'],
    reversible: true,
    recovery: 'Discard the false readiness claim.',
    risk: 'low'
  };
  const actions = parseInt(digest(route.routeId).slice(0, 2), 16) % 2 ? [falseReady, truthful] : [truthful, falseReady];
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: sessionId || `route-readiness-exam-${digest(`${route.routeId}:${assessment.sourceStateDigest}`).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-route-readiness-overlay-organ' },
    goal: 'Select the response that preserves the independently classified route readiness state without starting or repairing anything.',
    evidence: [{
      id: assessmentEvidenceId,
      kind: 'observation',
      status: 'observed',
      statement: `The route readiness cell classified this route ${assessment.routeState}.`,
      source: { kind: 'route-readiness-assessment', id: assessment.assessmentDigest, uri: `sha256:${assessment.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Content-digested typed readiness assessment.' }
    }, {
      id: decoyEvidenceId,
      kind: 'test',
      status: 'tested',
      statement: `The false-ready candidate conflicts with a ${decoy.routeState} readiness assessment.`,
      source: { kind: 'route-readiness-assessment', id: decoy.assessmentDigest, uri: `sha256:${decoy.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Actual non-ready evidence or a generated structural UNKNOWN decoy.' }
    }],
    unknowns: assessment.routeState === 'BLOCKED' ? assessment.attention.filter(item => item.state === 'UNKNOWN').map(item => `${item.moduleId}:${item.id}`) : [],
    assumptions: [],
    constraints: [],
    permissions: [],
    actions,
    decomposition: [{
      id: 'classify-route-readiness',
      question: 'What state follows from every typed readiness requirement in the route?',
      dependsOn: [],
      cheapestCheck: 'Use the independent route readiness assessment and preserve UNKNOWN.',
      status: 'ANSWERED',
      answerEvidenceRefs: [assessmentEvidenceId, decoyEvidenceId]
    }],
    pathProfiles: [{
      actionId: truthfulActionId,
      pathId: `path-truthful-${route.routeId}`,
      approach: 'Surface the exact classified state without acting.',
      requiredEvidence: [assessmentEvidenceId],
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 1,
      reversible: true,
      failureConditions: ['The readiness assessment or source state digest changes.'],
      strategyTags: ['preserve-typed-route-readiness']
    }, {
      actionId: falseReadyActionId,
      pathId: `path-false-ready-${route.routeId}`,
      approach: 'Claim READY while ignoring non-ready evidence.',
      requiredEvidence: [decoyEvidenceId],
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: 0,
      reversible: true,
      failureConditions: ['The supplied readiness assessment is not READY.'],
      strategyTags: ['reject-false-readiness']
    }],
    verificationReceipts: [{
      id: `verify-readiness-${route.routeId}`,
      actionId: truthfulActionId,
      claim: `The response preserves route state ${assessment.routeState}.`,
      evidenceRefs: [assessmentEvidenceId],
      method: 'Independent typed readiness classification.',
      result: 'PASS',
      limitations: ['This is an observation, not permission, execution, or a durability guarantee.']
    }, {
      id: `verify-false-ready-${route.routeId}`,
      actionId: falseReadyActionId,
      claim: 'The route can be claimed READY under the supplied non-ready evidence.',
      evidenceRefs: [decoyEvidenceId],
      method: 'Independent typed readiness classification.',
      result: 'FAIL',
      limitations: ['A READY route uses a generated UNKNOWN decoy only for structural discrimination.']
    }],
    budget: { maxCandidates: 4, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true &&
    Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false) throw new Error('route readiness requires a deterministic Reasoning Foundation session');
  if (!authorityClosed(session)) throw new Error('route readiness session gained authority');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('route readiness session failed independent authority review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const decoy = session.pathSet.comparisons.find(item => item.actionId === result.decoyActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !decoy || decoy.verificationStatus !== 'FAIL' || decoy.eligible) throw new Error('route readiness candidate discrimination is not preserved');
  return true;
}

function frontierFor(results) {
  const mismatches = results.filter(result => !result.behaviorMatched);
  if (!mismatches.length) return { state: 'NO_UNEXPECTED_SEAM', assessment: null };
  const assessment = Frontier.inspect({
    subject: { id: 'typed-route-readiness-classification', statement: 'Preserve dynamic route readiness state from independent typed observations.', domain: 'reasoning-foundation' },
    observations: mismatches.map(result => ({ id: result.reasoningSessionId, domain: 'route-readiness', statement: `Expected ${result.expectedDecision.actionId} but observed ${result.observedDecision.actionId || 'none'}.`, perspective: 'MACHINE_NATIVE', patternTags: ['route-readiness-mismatch'], evidenceRef: result.sessionSha256 })),
    unexpectedSeams: mismatches.map(result => ({ id: `route-readiness-${result.routeId}`, statement: `Readiness state ${result.readinessState} was not preserved.`, severity: 'high', evidenceRefs: [result.sessionSha256] }))
  });
  return { state: mismatches.length > 1 ? 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED' : 'SINGLE_GAP_MORE_EVIDENCE_REQUIRED', assessment };
}

function verifyBatch(batch, runDir, handoffBatch) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || !batch.batchDigest || !batch.inputsDigest) throw new Error('invalid route readiness batch');
  if (batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('route readiness batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('route readiness organ lineage mismatch');
  if (!batch.authority || batch.authority.privateEvaluationTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvaluationTraceWrite' && value !== false)) throw new Error('route readiness authority boundary changed');
  if (!Array.isArray(batch.modules) || batch.modules.length > MAX_MODULES || !Array.isArray(batch.results) || batch.results.length > MAX_ROUTES) throw new Error('route readiness batch bounds changed');
  const currentLineage = sourceLineage();
  if (JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(currentLineage))) throw new Error('route readiness source lineage mismatch');
  const stateDigest = digest({ schema: batch.source.schema, fingerprint: batch.source.fingerprint, modules: batch.modules });
  if (stateDigest !== batch.source.stateDigest) throw new Error('route readiness projected state digest mismatch');
  const expectedInputs = digest({ organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: currentLineage, sourceGraph: batch.sourceGraph, source: { schema: batch.source.schema, fingerprint: batch.source.fingerprint, stateDigest }, modules: batch.modules });
  if (batch.inputsDigest !== expectedInputs || batch.batchId !== `reasoning-route-readiness-${expectedInputs.slice(0, 20)}`) throw new Error('route readiness input lineage mismatch');
  if (handoffBatch) {
    HandoffGraph.verifyBatch(handoffBatch);
    if (handoffBatch.batchId !== batch.sourceGraph.batchId || handoffBatch.batchDigest !== batch.sourceGraph.batchDigest) throw new Error('route readiness source graph changed');
  }
  const routeIds = new Set();
  for (const result of batch.results) {
    if (routeIds.has(result.routeId)) throw new Error('route readiness batch has duplicate routes');
    routeIds.add(result.routeId);
    ReadinessCell.verify(result.assessment);
    ReadinessCell.verify(result.decoyAssessment);
    const modules = moduleSubset({ moduleIds: result.moduleIds }, { modules: batch.modules });
    const expectedAssessment = ReadinessCell.evaluate({ sourceStateDigest: stateDigest, route: { routeId: result.routeId, moduleIds: result.moduleIds }, modules });
    if (expectedAssessment.assessmentDigest !== result.assessment.assessmentDigest || expectedAssessment.routeState !== result.readinessState) throw new Error(`route readiness assessment changed: ${result.routeId}`);
    const expectedDecoy = decoyAssessment({ routeId: result.routeId, moduleIds: result.moduleIds }, { stateDigest, modules: batch.modules }, expectedAssessment);
    if (expectedDecoy.assessmentDigest !== result.decoyAssessment.assessmentDigest) throw new Error(`route readiness decoy changed: ${result.routeId}`);
    const expectedDecision = { value: 1, actionId: `surface-${result.readinessState.toLowerCase()}-${result.routeId}` };
    const matched = result.observedDecision.value === expectedDecision.value && result.observedDecision.actionId === expectedDecision.actionId;
    if (JSON.stringify(stable(result.expectedDecision)) !== JSON.stringify(stable(expectedDecision)) || result.decoyActionId !== `claim-ready-${result.routeId}` || result.behaviorMatched !== matched || result.state !== (matched ? 'READINESS_CLASSIFICATION_MATCHED' : 'READINESS_CLASSIFICATION_MISMATCH')) throw new Error(`route readiness decision lineage changed: ${result.routeId}`);
    if (result.trainingReceiptCreated !== false || result.worldActionExecuted !== false || result.semanticConsolidation !== false) throw new Error('route readiness evaluation impersonates training or a world outcome');
    if (runDir) {
      const file = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`route readiness session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(file);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`route readiness session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`route readiness session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  const expectedSummary = {
    graphRoutes: batch.results.length,
    graphModules: batch.modules.length,
    readinessRequirements: batch.modules.reduce((count, module) => count + module.requirements.length, 0),
    readyRoutes: batch.results.filter(result => result.readinessState === 'READY').length,
    availableRoutes: batch.results.filter(result => result.readinessState === 'AVAILABLE').length,
    needsActionRoutes: batch.results.filter(result => result.readinessState === 'NEEDS_ACTION').length,
    blockedRoutes: batch.results.filter(result => result.readinessState === 'BLOCKED').length,
    classificationsMatched: batch.results.filter(result => result.behaviorMatched).length,
    classificationMismatches: batch.results.filter(result => !result.behaviorMatched).length,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary))) throw new Error('route readiness summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-route-readiness-runs'));
  if (!inside(root, stateDir)) throw new Error('route readiness private state must stay inside Mirror root');
  const handoff = options.handoffDerived || HandoffGraph.derive({ root, workshopRoot, stateDir: options.handoffGraphStateDir || path.join(root, 'state', 'reasoning-handoff-graph-runs') });
  HandoffGraph.verifyBatch(handoff.batch, handoff.runDir);
  const source = snapshotInput(options, workshopRoot);
  const projection = projectSnapshot(source, handoff.batch);
  const lineage = sourceLineage();
  const sourceGraph = { batchId: handoff.batch.batchId, batchDigest: handoff.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, implementationContract: IMPLEMENTATION_CONTRACT, sourceLineage: lineage, sourceGraph, source: { schema: projection.schema, fingerprint: projection.fingerprint, stateDigest: projection.stateDigest }, modules: projection.modules };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-route-readiness-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, handoff.batch);
    return { batch, runDir, reused: true, observation: projection.observation, handoff };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  const results = [];
  for (const route of handoff.batch.results) {
    const modules = moduleSubset(route, projection);
    const assessment = ReadinessCell.evaluate({ sourceStateDigest: projection.stateDigest, route: { routeId: route.routeId, moduleIds: route.moduleIds }, modules });
    const decoy = decoyAssessment(route, projection, assessment);
    const input = routeInput(route, assessment, decoy);
    const expectedDecision = { value: 1, actionId: `surface-${assessment.routeState.toLowerCase()}-${route.routeId}` };
    const decoyActionId = `claim-ready-${route.routeId}`;
    const session = Foundation.run(input, { at: '1970-01-01T00:00:00.000Z' });
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const behaviorMatched = observedDecision.value === expectedDecision.value && observedDecision.actionId === expectedDecision.actionId;
    const sessionName = `session-${digest(`${route.routeId}:${projection.stateDigest}`).slice(0, 20)}.json`;
    const sessionFile = path.join('sessions', sessionName).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = {
      routeId: route.routeId,
      depth: route.depth,
      moduleIds: route.moduleIds,
      handoffTypes: route.handoffTypes,
      sourceReasoningSessionId: route.reasoningSessionId,
      readinessState: assessment.routeState,
      assessment,
      decoyAssessment: decoy,
      expectedDecision,
      decoyActionId,
      observedDecision,
      behaviorMatched,
      state: behaviorMatched ? 'READINESS_CLASSIFICATION_MATCHED' : 'READINESS_CLASSIFICATION_MISMATCH',
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      trainingReceiptCreated: false,
      worldActionExecuted: false,
      semanticConsolidation: false
    };
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), bytes, { flag: 'wx' });
    results.push(result);
  }
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_DYNAMIC_TYPED_ROUTE_READINESS_OVERLAY', learnedWeights: false },
    cell: { id: ReadinessCell.CELL_ID, schema: ReadinessCell.SCHEMA, learnedWeights: false },
    implementationContract: IMPLEMENTATION_CONTRACT,
    sourceLineage: lineage,
    sourceGraph,
    source: {
      schema: projection.schema,
      fingerprint: projection.fingerprint,
      stateDigest: projection.stateDigest,
      sourceState: projection.sourceState,
      firstObservation: projection.observation
    },
    eligibleModuleIds: handoff.batch.contracts.map(contract => contract.moduleId).sort(),
    refusedModuleIds: handoff.batch.refusedContracts.map(contract => contract.moduleId).filter(Boolean).sort(),
    modules: projection.modules,
    results,
    frontier: frontierFor(results),
    summary: {
      graphRoutes: results.length,
      graphModules: projection.modules.length,
      readinessRequirements: projection.modules.reduce((count, module) => count + module.requirements.length, 0),
      readyRoutes: results.filter(result => result.readinessState === 'READY').length,
      availableRoutes: results.filter(result => result.readinessState === 'AVAILABLE').length,
      needsActionRoutes: results.filter(result => result.readinessState === 'NEEDS_ACTION').length,
      blockedRoutes: results.filter(result => result.readinessState === 'BLOCKED').length,
      classificationsMatched: results.filter(result => result.behaviorMatched).length,
      classificationMismatches: results.filter(result => !result.behaviorMatched).length,
      trainingReceiptsCreated: 0,
      worldActionsExecuted: 0
    },
    authority: {
      privateEvaluationTraceWrite: true,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      readinessMutation: false,
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
    boundary: 'This overlay classifies current route readiness from Technical Glasses evidence. Static compatibility remains separate. READY and AVAILABLE are review-only; BLOCKED and NEEDS_ACTION hold. No service is started, repaired, granted, executed, trained, or promoted.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, handoff.batch);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, observation: projection.observation, handoff };
}

function freshness(observation, now) {
  const observed = observation && Date.parse(observation.compiledAt || '');
  const current = Date.parse(now || new Date().toISOString());
  const ageMs = Number.isFinite(observed) && Number.isFinite(current) ? current - observed : null;
  const fresh = ageMs != null && ageMs >= -60000 && ageMs <= MAX_SNAPSHOT_AGE_MS;
  return { fresh, ageMs, maximumAgeMs: MAX_SNAPSHOT_AGE_MS };
}

function plan(batchOrDerived, request, options = {}) {
  const derived = batchOrDerived && batchOrDerived.batch ? batchOrDerived : { batch: batchOrDerived, observation: batchOrDerived && batchOrDerived.source && batchOrDerived.source.firstObservation };
  const batch = derived.batch;
  verifyBatch(batch);
  if (!request || request.schema !== HandoffGraph.REQUEST_SCHEMA || typeof request !== 'object' || Array.isArray(request)) throw new Error(`route readiness request must use ${HandoffGraph.REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'sourceModuleId', 'targetModuleId', 'maximumDepth'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical route readiness request fields: ${unexpected.join(', ')}`);
  const sourceModuleId = token(request.sourceModuleId, '');
  const targetModuleId = token(request.targetModuleId, '');
  if (!sourceModuleId || !targetModuleId) throw new Error('route readiness request requires sourceModuleId and targetModuleId');
  const maximumDepth = Math.max(1, Math.min(2, Number(request.maximumDepth) || 2));
  const eligible = new Set(batch.eligibleModuleIds);
  const refused = new Set(batch.refusedModuleIds);
  const observed = derived.observation || batch.source.firstObservation;
  const fresh = freshness(observed, options.now);
  let state;
  let reason;
  let proposals = [];
  let heldRoutes = [];
  let matches = [];
  if (refused.has(sourceModuleId) || refused.has(targetModuleId)) {
    state = 'HOLD_UNBOUND_MODULE_CONTRACT';
    reason = 'At least one module is excluded from the manifest-bound static graph.';
  } else if (!eligible.has(sourceModuleId) || !eligible.has(targetModuleId)) {
    state = 'HOLD_UNKNOWN_MODULE';
    reason = 'The current manifest-bound graph does not contain both requested module IDs.';
  } else {
    matches = batch.results.filter(result => result.depth <= maximumDepth && result.moduleIds[0] === sourceModuleId && result.moduleIds[result.moduleIds.length - 1] === targetModuleId && result.behaviorMatched)
      .sort((a, b) => a.depth - b.depth || a.routeId.localeCompare(b.routeId));
    if (!matches.length) {
      state = 'HOLD_NO_MANIFEST_BOUND_EXACT_TYPED_ROUTE';
      reason = `No depth-${maximumDepth}-or-less static route exists before readiness is considered.`;
    } else if (!fresh.fresh) {
      state = 'HOLD_READINESS_EVIDENCE_STALE_OR_MISSING';
      reason = 'The current Technical Glasses observation is missing, invalid, future-dated, or older than the bounded freshness window.';
      heldRoutes = matches.map(result => renderHeld(result, 'STALE'));
    } else {
      const ready = matches.filter(result => result.readinessState === 'READY');
      const available = matches.filter(result => result.readinessState === 'AVAILABLE');
      const needsAction = matches.filter(result => result.readinessState === 'NEEDS_ACTION');
      if (ready.length) {
        state = 'PROPOSED_READY_MANIFEST_BOUND_EXACT_TYPED_ROUTES';
        reason = 'At least one compatible route has only READY requirements in the fresh Technical Glasses observation.';
        proposals = ready.slice(0, 8).map(result => renderProposal(result, 'READY'));
      } else if (available.length) {
        state = 'PROPOSED_AVAILABLE_EXPLICIT_START_REQUIRED_ROUTES';
        reason = 'At least one compatible route is AVAILABLE but requires a separate explicit start; nothing was started.';
        proposals = available.slice(0, 8).map(result => renderProposal(result, 'AVAILABLE'));
      } else if (needsAction.length) {
        state = 'HOLD_ROUTE_READINESS_NEEDS_ACTION';
        reason = 'Every compatible route requires explicit user action before it can be treated as ready.';
      } else {
        state = 'HOLD_ROUTE_READINESS_BLOCKED';
        reason = 'Every compatible route contains UNKNOWN, OFFLINE, or TRIPPED readiness evidence.';
      }
      const selected = new Set(proposals.map(item => item.routeId));
      heldRoutes = matches.filter(result => !selected.has(result.routeId)).map(result => renderHeld(result, result.readinessState));
    }
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceGraphBatchId: batch.sourceGraph.batchId,
    sourceReadinessBatchId: batch.batchId,
    request: { sourceModuleId, targetModuleId, maximumDepth },
    observation: Object.assign({}, observed || {}, fresh),
    state,
    reason,
    compatibilityRoutesEvaluated: matches.length,
    proposals,
    heldRoutes,
    humanRenderingAuthority: false,
    authority: {
      execution: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      readinessMutation: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Readiness overlays static compatibility. READY and AVAILABLE remain review-only; AVAILABLE never starts a runtime. UNKNOWN, unavailable, required action, stale evidence, and unbound contracts hold.'
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

function renderProposal(result, state) {
  return {
    routeId: result.routeId,
    depth: result.depth,
    moduleIds: result.moduleIds,
    handoffTypes: result.handoffTypes,
    readinessState: state,
    readinessAssessmentDigest: result.assessment.assessmentDigest,
    reasoningSessionId: result.reasoningSessionId,
    state: state === 'READY' ? 'REVIEWABLE_READY_PROPOSAL_NOT_EXECUTED' : 'REVIEWABLE_AVAILABLE_PROPOSAL_EXPLICIT_START_REQUIRED_NOT_EXECUTED'
  };
}

function renderHeld(result, state) {
  return {
    routeId: result.routeId,
    depth: result.depth,
    moduleIds: result.moduleIds,
    handoffTypes: result.handoffTypes,
    readinessState: state,
    attention: result.assessment.attention,
    readinessAssessmentDigest: result.assessment.assessmentDigest,
    reasoningSessionId: result.reasoningSessionId,
    state: 'HELD_NOT_EXECUTED'
  };
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, RESPONSE_SCHEMA, MAX_ROUTES, MAX_MODULES, MAX_SNAPSHOT_AGE_MS, IMPLEMENTATION_CONTRACT,
  digest, sourceLineage, snapshotInput, projectSnapshot, routeInput, verifySession, verifyBatch, derive, freshness, plan
};
