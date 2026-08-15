'use strict';

const fs = require('fs');
const path = require('path');
const Curriculum = require('../kernel/outcome-curriculum-cell');
const OutcomeOrgan = require('./outcome-learning-organ');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-curriculum-planner-organ/v1';
const BATCH_SCHEMA = 'axm.mirror.outcome-curriculum-batch/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-curriculum-planner-runs');
const DEFAULT_OUTCOME_STATE_DIR = OutcomeOrgan.DEFAULT_STATE_DIR;
const MAX_SOURCE_BATCHES = 128;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Curriculum.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function validateSources(batches) {
  if (!Array.isArray(batches)) throw new Error('outcome curriculum planner batches must be an array');
  if (batches.length > MAX_SOURCE_BATCHES) throw new Error('outcome curriculum planner source batch count exceeds its bound');
  const bytes = Buffer.byteLength(JSON.stringify(batches), 'utf8');
  if (bytes > MAX_SOURCE_BYTES) throw new Error('outcome curriculum planner source bytes exceed its bound');
  const copies = batches.map(clone).sort((left, right) => String(left.batchId).localeCompare(String(right.batchId)));
  if (new Set(copies.map(item => item.batchId)).size !== copies.length) throw new Error('duplicate outcome curriculum source batch ID');
  copies.forEach(OutcomeOrgan.verify);
  return copies;
}
function sourceRefs(batches) {
  return batches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest, createdAt: item.createdAt })).sort((left, right) => left.batchId.localeCompare(right.batchId));
}

function foundationSession(request, cases, options = {}) {
  Curriculum.verifyRequest(request);
  cases.forEach(Curriculum.verifyCase);
  const requestEvidenceId = `outcome-curriculum-request-${request.requestId}`;
  const caseEvidence = cases.map(item => ({
    id: item.caseId,
    kind: item.role === 'HISTORICAL_OBSERVED_REGRESSION_ONLY' ? 'test' : 'observation',
    status: item.role === 'HISTORICAL_OBSERVED_REGRESSION_ONLY' ? 'tested' : 'observed',
    statement: `${item.role} is content-bound as ${item.caseId}; its already known outcome cannot count as unseen or independent evidence.`,
    source: { kind: 'outcome-curriculum-historical-case', id: item.caseId, at: null }
  }));
  const evidence = [{
    id: requestEvidenceId,
    kind: 'rule',
    status: 'tested',
    statement: `Outcome mismatch signature ${request.failureSignatureDigest} was reconstructed from ${request.recurrence.distinctCorrections} unique correction(s), ${request.recurrence.declaredSourceGroups.length} declared source group(s), and ${request.recurrence.distinctTargetKeys.length} distinct target(s).`,
    source: { kind: 'outcome-curriculum-request', id: request.requestId, at: null }
  }].concat(caseEvidence);
  const independentUnknownId = `independent-exam-${request.failureSignatureDigest.slice(0, 24)}`;
  const unknowns = [{ id: independentUnknownId, question: 'Who will independently author the unseen target cases, expected observations, and evaluator after this request is sealed?', blocking: true }]
    .concat(request.openQuestions.map(item => ({ id: item.questionId, question: item.statement, blocking: true })));
  const decomposition = unknowns.map(item => ({
    id: item.id,
    question: item.question,
    dependsOn: [],
    cheapestCheck: item.id === independentUnknownId
      ? 'Assign an evaluator outside the candidate method, then seal unseen target and expected-observation fixtures without exposing them to the candidate.'
      : 'Obtain an attributed answer through the existing principle or permission steward and preserve its evidence.',
    status: 'OPEN',
    answerEvidenceRefs: []
  }));
  const actionIds = [
    `request-independent-exam-${request.requestId}`,
    `request-independent-reobservation-${request.requestId}`,
    `preserve-curriculum-hold-${request.requestId}`
  ];
  const commonEvidence = [requestEvidenceId].concat(cases.map(item => item.caseId));
  const actions = [
    {
      id: actionIds[0],
      kind: 'proposal',
      label: 'Request independently authored unseen outcome exams before evaluating any challenger method',
      requiredPermissions: [],
      supportingEvidence: commonEvidence,
      preconditionEvidence: commonEvidence,
      expectedEffects: ['A future evaluator can compare a reviewed challenger against historical regression cases and still-hidden target outcomes.'],
      possibleSideEffects: ['Declared source-group diversity may not represent actual independence.'],
      reversible: true,
      recovery: 'Discard the proposal while preserving its source corrections and historical cases.',
      risk: 'low'
    },
    {
      id: actionIds[1],
      kind: 'proposal',
      label: 'Request a new exact-scope observation from a separately attributed source',
      requiredPermissions: [],
      supportingEvidence: commonEvidence,
      preconditionEvidence: commonEvidence,
      expectedEffects: ['A separately attributed observation can test whether the exact mismatch reproduces without changing the failed prediction.'],
      possibleSideEffects: ['Separate attribution does not by itself certify independent authorship.'],
      reversible: true,
      recovery: 'Discard the proposal while preserving the original observation and correction.',
      risk: 'low'
    },
    {
      id: actionIds[2],
      kind: 'hold',
      label: 'Keep the recurrent mismatch visible without admitting curriculum or changing the method',
      requiredPermissions: [],
      supportingEvidence: commonEvidence,
      preconditionEvidence: commonEvidence,
      expectedEffects: ['The failure remains inspectable while the independent exam and challenger method are absent.'],
      possibleSideEffects: ['No capability improvement occurs while the hold remains open.'],
      reversible: true,
      recovery: 'Supersede the hold only with a content-linked reviewed curriculum result.',
      risk: 'low'
    }
  ];
  const reasoning = {
    schema: 'axm.mirror.reason/v1',
    requestId: `outcome-curriculum-foundation-${request.requestId}`,
    sessionId: `outcome-curriculum-${request.requestId}`,
    actor: { id: 'mirror-outcome-curriculum-planner-organ', kind: 'machine', displayName: 'Mirror Outcome Curriculum Planner Organ' },
    goal: { id: 'route-outcome-failure-to-curriculum', statement: 'Turn verified typed outcome failures into the smallest falsifiable curriculum request while preserving known outcomes, unknowns, permissions, and independent-exam boundaries.' },
    evidence,
    unknowns,
    constraints: [{ id: 'outcome-curriculum-proposal-only', type: 'max-risk', statement: 'Outcome curriculum planning is proposal-only and may not train, build, repair, install, promote, or act.', actionIds, evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions,
    budget: { maxCandidates: 4, deadlineMs: 1000 },
    decomposition,
    assumptions: [],
    pathProfiles: actions.map((action, index) => ({
      pathId: `path-${action.id}`,
      actionId: action.id,
      approach: action.label,
      questionIds: index < 2 ? unknowns.map(item => item.id) : [],
      requiredEvidence: action.preconditionEvidence,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: index === 0 ? 0.9 : index === 1 ? 0.7 : 0.2,
      reversible: true,
      failureConditions: ['A source Outcome batch does not reconstruct.', 'Known historical outcomes are relabelled held-out.', 'The candidate authors its own unseen answers.'],
      strategyTags: ['outcome-curriculum', index === 0 ? 'independent-exam-request' : index === 1 ? 'independent-reobservation-request' : 'preserve-hold']
    })),
    verificationReceipts: actions.map((action, index) => ({
      id: `verify-${index + 1}-${request.requestId}`,
      actionId: action.id,
      claim: `The proposal or hold ${action.id} is reproduced from the exact curriculum request, source correction lineage, and historical cases without claiming that any requested future exam or observation occurred.`,
      evidenceRefs: commonEvidence,
      method: 'Re-run the deterministic Outcome Curriculum Planner verifier against the exact source Outcome batches.',
      result: 'PASS',
      limitations: ['declared source groups are not externally certified independent', 'historical outcomes are not held out', 'no challenger method or unseen expected observation exists']
    })),
    outcome: {
      result: 'HOLD',
      statement: request.state === 'PROPOSE_REVIEWED_OUTCOME_CURRICULUM'
        ? 'Recurring declared mismatch evidence can justify curriculum review, but independent unseen exams and a reviewed challenger remain absent.'
        : 'The mismatch is preserved, but declared recurrence is insufficient for a method-challenger curriculum.',
      evidenceRefs: commonEvidence,
      transferEvidenceRefs: [],
      regressionEvidenceRefs: request.historicalRegressionCases.map(item => item.caseId),
      repairEvidenceRefs: [],
      resolvedSeams: [],
      observedAt: options.at || null,
      verified: true,
      repeatedVerifiedOutcomes: request.recurrence.distinctCorrections,
      usePermission: 'unknown',
      permissionBasis: null,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  };
  return Foundation.run(reasoning, { at: options.at });
}

function sealBatch(batch) {
  batch.batchId = `outcome-curriculum-plan-${Curriculum.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  batch.batchDigest = Curriculum.digest(Object.assign({}, batch, { batchDigest: null }));
  return Curriculum.stable(batch);
}

function run(input, options = {}) {
  rejectHidden(input);
  exactKeys(input, ['batches'], 'outcome curriculum planner input');
  const batches = validateSources(input.batches);
  const createdAt = String(options.at == null ? '' : options.at).trim() || new Date().toISOString();
  const artifacts = Curriculum.buildArtifacts(batches);
  const casesById = new Map(artifacts.regressionCases.concat(artifacts.matchControls).map(item => [item.caseId, item]));
  const foundationSessions = [];
  const reasoningBindings = artifacts.requests.map(request => {
    const caseRefs = request.historicalRegressionCases.concat(request.historicalMatchControls);
    const cases = caseRefs.map(ref => casesById.get(ref.caseId));
    if (cases.some(item => !item)) throw new Error('outcome curriculum request case binding is incomplete');
    const session = foundationSession(request, cases, { at: createdAt });
    foundationSessions.push(session);
    return { requestId: request.requestId, requestDigest: request.requestDigest, reasoningSessionId: session.reasoningSessionId };
  });
  const proposed = artifacts.requests.filter(item => item.state === 'PROPOSE_REVIEWED_OUTCOME_CURRICULUM').length;
  const state = batches.length === 0
    ? 'NO_OUTCOME_BATCHES'
    : artifacts.occurrences.length === 0
      ? 'NO_VERIFIED_MISMATCH_CORRECTIONS'
      : proposed
        ? 'OUTCOME_CURRICULUM_REVIEW_PROPOSED'
        : 'OUTCOME_FAILURES_HELD_FOR_RECURRENCE';
  return sealBatch({
    schema: BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_VERIFIED_OUTCOME_CORRECTIONS_TO_PROPOSAL_ONLY_CURRICULUM_REQUESTS' },
    sourceBatches: sourceRefs(batches),
    occurrences: artifacts.occurrences,
    exclusions: { duplicateCorrections: artifacts.duplicateCorrections },
    unresolvedAssessments: artifacts.unresolvedAssessments,
    regressionCases: artifacts.regressionCases,
    matchControls: artifacts.matchControls,
    requests: artifacts.requests,
    reasoningBindings,
    foundationSessions: foundationSessions.sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId)),
    summary: {
      sourceBatches: batches.length,
      uniqueMismatchCorrections: artifacts.occurrences.length,
      duplicateCorrectionsExcluded: artifacts.duplicateCorrections.length,
      unresolvedAssessmentsPreserved: artifacts.unresolvedAssessments.length,
      failureSignatures: artifacts.requests.length,
      historicalRegressionCases: artifacts.regressionCases.length,
      historicalMatchControls: artifacts.matchControls.length,
      recurrentSignatures: proposed,
      recurrenceHolds: artifacts.requests.length - proposed,
      curriculumRequestsProposed: proposed,
      foundationSessions: foundationSessions.length,
      generatedExpectedObservations: 0,
      generatedProbabilities: 0,
      curriculumAdmissions: 0,
      trainingAdmissions: 0,
      repairsSelected: 0,
      repairsApplied: 0,
      methodsGenerated: 0,
      methodsSelected: 0,
      codeBuilds: 0,
      organsInstalled: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: Object.assign({ privateProposalTraceWrite: true }, Curriculum.falseAuthority()),
    boundary: 'This TEST organ verifies Outcome batches, consumes unique append-linked mismatch corrections, groups exact typed failure shapes across declared source groups and targets, preserves known outcomes as non-held-out regression material, and emits proposal-only requests for independently authored unseen exams. It cannot certify independence or causality, invent expected observations or probabilities, generate or select methods, admit curriculum or training, apply repairs, build code, install organs, grant permission, use tools, promote, canonize, or act.'
  });
}

function verify(batch, sourceBatches, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'sourceBatches', 'occurrences', 'exclusions', 'unresolvedAssessments', 'regressionCases', 'matchControls', 'requests', 'reasoningBindings', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'outcome curriculum batch');
  if (batch.schema !== BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('outcome curriculum batch boundary changed');
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('outcome curriculum batch gained authority');
  batch.regressionCases.forEach(Curriculum.verifyCase);
  batch.matchControls.forEach(Curriculum.verifyCase);
  batch.requests.forEach(Curriculum.verifyRequest);
  if (batch.foundationSessions.some(session => session.authority.proposalOnly !== true || Object.entries(session.authority).some(([key, value]) => key !== 'proposalOnly' && value !== false))) throw new Error('outcome curriculum Foundation session gained authority');
  if (batch.summary.generatedExpectedObservations !== 0 || batch.summary.generatedProbabilities !== 0 || batch.summary.curriculumAdmissions !== 0 || batch.summary.trainingAdmissions !== 0 || batch.summary.repairsSelected !== 0 || batch.summary.repairsApplied !== 0 || batch.summary.methodsGenerated !== 0 || batch.summary.methodsSelected !== 0 || batch.summary.codeBuilds !== 0 || batch.summary.organsInstalled !== 0 || batch.summary.permissionGrants !== 0 || batch.summary.toolCalls !== 0 || batch.summary.runtimePromotions !== 0 || batch.summary.canonChanges !== 0 || batch.summary.worldActions !== 0) throw new Error('outcome curriculum batch claim ceiling changed');
  if (batch.batchDigest !== Curriculum.digest(Object.assign({}, batch, { batchDigest: null })) || batch.batchId !== `outcome-curriculum-plan-${Curriculum.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`) throw new Error('outcome curriculum batch identity changed');
  const sources = validateSources(sourceBatches);
  if (!Curriculum.same(sourceRefs(sources), batch.sourceBatches)) throw new Error('outcome curriculum source refs changed');
  const reconstructed = run({ batches: sources }, { at: batch.createdAt });
  if (!Curriculum.same(reconstructed, batch)) throw new Error('outcome curriculum batch does not replay from its source Outcome batches');
  if (runDir) {
    const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const diskSources = JSON.parse(fs.readFileSync(path.join(runDir, 'source-batches.json'), 'utf8'));
    if (!Curriculum.same(diskBatch, batch) || !Curriculum.same(diskSources, sources)) throw new Error('outcome curriculum stored files changed');
  }
  return true;
}

function ensureDirectory(directory) {
  const target = path.resolve(directory);
  fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('outcome curriculum state root must be a real directory');
  return target;
}

function record(input, options = {}) {
  const sources = validateSources(input.batches);
  const batch = run({ batches: sources }, options);
  verify(batch, sources);
  if (options.write === false) return { batch, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || DEFAULT_STATE_DIR);
  const finalDir = path.join(root, batch.batchId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'batch.json'), 'utf8'));
    const existingSources = JSON.parse(fs.readFileSync(path.join(finalDir, 'source-batches.json'), 'utf8'));
    verify(existing, existingSources, finalDir);
    if (!Curriculum.same(existing, batch) || !Curriculum.same(existingSources, sources)) throw new Error('outcome curriculum immutable identity collision');
    return { batch: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${batch.batchId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source-batches.json'), JSON.stringify(sources, null, 2) + '\n', { flag: 'wx' });
  verify(batch, sources, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { batch, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}

function loadOutcomeBatches(options = {}) {
  const root = path.resolve(options.outcomeStateDir || DEFAULT_OUTCOME_STATE_DIR);
  if (!fs.existsSync(root)) return [];
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('outcome curriculum source root must be a real directory');
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && /^outcome-learning-[a-f0-9]{24}$/.test(item.name)).sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length > MAX_SOURCE_BATCHES) throw new Error('outcome curriculum discovered source batch count exceeds its bound; use an explicit bounded selection');
  let bytes = 0;
  const batches = entries.map(entry => {
    const file = path.join(root, entry.name, 'batch.json');
    const fileStat = fs.lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error(`outcome curriculum source batch is not a real file: ${entry.name}`);
    bytes += fileStat.size;
    if (bytes > MAX_SOURCE_BYTES) throw new Error('outcome curriculum discovered source bytes exceed its bound; use an explicit bounded selection');
    const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
    OutcomeOrgan.verify(batch);
    if (batch.batchId !== entry.name) throw new Error(`outcome curriculum source directory identity changed: ${entry.name}`);
    return batch;
  });
  return validateSources(batches);
}

module.exports = {
  ROOT,
  ORGAN_ID,
  BATCH_SCHEMA,
  DEFAULT_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  MAX_SOURCE_BATCHES,
  MAX_SOURCE_BYTES,
  validateSources,
  sourceRefs,
  foundationSession,
  run,
  verify,
  record,
  loadOutcomeBatches
};
