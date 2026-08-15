'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const ReasoningFoundation = require('../kernel/reasoning-foundation');
const BehavioralExam = require('./english-behavioral-exam-organ');

const ORGAN_ID = 'axm.mirror.english-capability-frontier-organ/experimental-v2';
const REQUEST_SCHEMA = 'axm.mirror.english-capability-frontier-request/v2';
const BATCH_SCHEMA = 'axm.mirror.english-capability-frontier-batch/v2';
const MIN_RECURRENT_SOURCE_GROUPS = 2;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.slice().sort())) throw new Error(`${label} shape is closed`);
}
function boundedId(value, label, maximum = 200) {
  const output = String(value || '').trim();
  if (!output || output.length > maximum || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(output)) throw new Error(`${label} must be a bounded machine identifier`);
  return output;
}

function grouping(exam) {
  const resultByCase = new Map(exam.results.map(result => [result.caseId, result]));
  const groups = new Map();
  for (const gap of exam.curriculumGaps) {
    const result = resultByCase.get(gap.caseId);
    if (!result || result.verdict !== 'FAIL' || result.capabilityClass.replaceAll('_', '-').toLowerCase() !== gap.capabilityId.split('.').slice(-2).join('-') && !gap.capabilityId.endsWith(result.capabilityClass.replaceAll('_', '-').toLowerCase())) {
      throw new Error(`English capability gap is not bound to a failed exam result: ${gap.gapId}`);
    }
    if (!groups.has(gap.capabilityId)) groups.set(gap.capabilityId, []);
    groups.get(gap.capabilityId).push({ gap, result });
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function reasoningTrace(exam, capabilityId, rows, researchCandidateObserved, observedAt) {
  const sourceGroups = Array.from(new Set(rows.map(row => row.result.sourceGroupId))).sort();
  const separatelyAuthored = exam.independence.sourceDeclaredIndependent === true && exam.independence.modelOutputsUnavailableDuringAuthorship === true;
  const evidence = [
    { id: 'exam-envelope-verified', kind: 'test', status: 'tested', statement: 'The source behavioral exam digest and zero-authority envelope verified.', source: { kind: 'test', id: exam.examId } },
    { id: 'capability-gap-recurred', kind: 'measurement', status: sourceGroups.length >= MIN_RECURRENT_SOURCE_GROUPS ? 'tested' : 'asserted', statement: `${rows.length} failed case(s) span ${sourceGroups.length} distinct frozen source group(s) for one capability.`, source: { kind: 'behavioral-exam', id: exam.examId } },
    { id: 'target-architecture-declared', kind: 'artifact', status: 'tested', statement: `The exact target declares architecture ${exam.target.modelArchitecture}.`, source: { kind: 'model-reference', id: exam.target.modelDigest } },
    { id: 'answer-key-training-refused', kind: 'rule', status: 'tested', statement: 'Every source gap refuses answer-key copying and automatic training.', source: { kind: 'contract', id: BehavioralExam.GAP_SCHEMA } }
  ];
  const unknowns = [
    separatelyAuthored
      ? { id: 'outside-authorship-not-externally-certified', question: 'Can the declared outside authorship be independently certified without exposing the pack before evaluation?', blocking: false }
      : { id: 'outside-authored-transfer-evidence-missing', question: 'Would the same capability gap reproduce on a separately authored unseen pack?', blocking: true },
    { id: 'generalization-method-unproven', question: 'Which bounded generalization method can improve transfer without weakening safe holds?', blocking: true }
  ];
  const input = {
    schema: 'axm.mirror.reasoning-session/v1',
    requestId: `english-frontier-${sha256({ examDigest: exam.examDigest, capabilityId }).slice(0, 24)}`,
    actor: { id: 'english-capability-frontier', kind: 'experimental-proposal-organ', displayName: 'English Capability Frontier' },
    goal: `Preserve evidence and propose the next bounded research route for ${capabilityId}.`,
    evidence,
    unknowns,
    constraints: [
      { id: 'no-answer-key-training', type: 'hard-limit', statement: 'Exam prompts and expected answers cannot become training examples.', actionIds: ['request-more-evidence', 'research-generalization-organ', 'hold-capability-gap'], hard: true },
      { id: 'proposal-only', type: 'authority-boundary', statement: 'No route may build, install, train, connect, or promote anything automatically.', actionIds: ['request-more-evidence', 'research-generalization-organ', 'hold-capability-gap'], hard: true }
    ],
    permissions: [],
    actions: [
      { id: 'request-more-evidence', kind: 'proposal', label: 'Request a separately authored frozen capability probe.', supportingEvidence: ['exam-envelope-verified'], risk: 'low', reversible: true, recovery: 'Keep the existing gap unresolved.' },
      { id: 'research-generalization-organ', kind: 'proposal', label: 'Request research for a bounded generalization organ or adapter without supplying answer keys.', supportingEvidence: ['exam-envelope-verified', 'capability-gap-recurred', 'target-architecture-declared', 'answer-key-training-refused'], risk: 'low', reversible: true, recovery: 'Retain the request as unbuilt and continue using the exact-only hold.' },
      { id: 'hold-capability-gap', kind: 'hold', label: 'Preserve the capability gap without changing the model.', supportingEvidence: ['exam-envelope-verified'], risk: 'low', reversible: true, recovery: 'Revisit when independent evidence or a reviewed method exists.' }
    ],
    pathProfiles: [
      { actionId: 'request-more-evidence', approach: 'Increase independent behavioral evidence before changing architecture.', estimatedCost: 'LOW', informationValue: 0.8, reversible: true, strategyTags: ['preserve-lineage', 'seek-independent-evidence'] },
      { actionId: 'research-generalization-organ', approach: 'Specify and test a reusable capability-level learner or adapter.', estimatedCost: 'MEDIUM', informationValue: 0.9, reversible: true, strategyTags: ['learn-from-recurrent-gap', 'no-answer-key-leakage'] },
      { actionId: 'hold-capability-gap', approach: 'Retain the exact-only model and explicit miss.', estimatedCost: 'LOW', informationValue: 0.4, reversible: true, strategyTags: ['retain-uncertainty'] }
    ]
  };
  const session = ReasoningFoundation.run(input, { at: observedAt });
  const selectedActionId = session.pathSet.selectedActionId;
  const proposedRoute = researchCandidateObserved && selectedActionId === 'research-generalization-organ'
    ? 'RESEARCH_GENERALIZATION_OR_ADAPTER'
    : 'REQUEST_MORE_SEPARATELY_AUTHORED_EVIDENCE';
  return {
    inputDigest: sha256(input),
    reasoningSessionId: session.reasoningSessionId,
    sessionDigest: sha256(session),
    selectedActionId,
    proposedRoute,
    selectionIsBuildAuthority: false,
    proposalOnly: session.authority.proposalOnly,
    trainingAdmissionAuthority: session.authority.trainingAdmission,
    runtimePromotionAuthority: session.authority.runtimePromotion,
    blockingUnknownIds: unknowns.filter(item => item.blocking).map(item => item.id)
  };
}

function requestFor(exam, capabilityId, rows, observedAt) {
  const sourceGroupIds = Array.from(new Set(rows.map(row => row.result.sourceGroupId))).sort();
  const gapIds = rows.map(row => row.gap.gapId).sort();
  const recurrent = sourceGroupIds.length >= MIN_RECURRENT_SOURCE_GROUPS;
  const exactOnly = /exact-normalized-surface/i.test(exam.target.modelArchitecture);
  const generalizationCandidateObserved = recurrent && exactOnly;
  const reasoningFoundation = reasoningTrace(exam, capabilityId, rows, generalizationCandidateObserved, observedAt);
  const route = reasoningFoundation.proposedRoute;
  const basis = { examDigest: exam.examDigest, capabilityId, sourceGroupIds, gapIds, route };
  return stable({
    schema: REQUEST_SCHEMA,
    requestId: `english-capability-frontier-${sha256(basis).slice(0, 24)}`,
    capabilityId: boundedId(capabilityId, 'capabilityId'),
    route,
    sourceExamId: exam.examId,
    sourceExamDigest: exam.examDigest,
    targetModelDigest: exam.target.modelDigest,
    targetModelArchitecture: exam.target.modelArchitecture,
    failedCaseCount: rows.length,
    distinctFrozenSourceGroupCount: sourceGroupIds.length,
    sourceGroupIds,
    sourceGapIds: gapIds,
    recurrenceThreshold: MIN_RECURRENT_SOURCE_GROUPS,
    recurrenceThresholdMet: recurrent,
    exactOnlyArchitectureObserved: exactOnly,
    generalizationCandidateObserved,
    reasoningFoundation,
    answerKeysCopiedIntoRequest: false,
    examPromptsCopiedIntoRequest: false,
    automaticCodeBuild: false,
    automaticLessonCreation: false,
    automaticTraining: false,
    trainingAdmissionAuthority: false,
    detail: route === 'RESEARCH_GENERALIZATION_OR_ADAPTER'
      ? 'Repeated same-capability misses on an exact-only model and the Reasoning Foundation path comparison justify a proposal to research a reusable generalization organ or adapter. They do not prove which method will work.'
      : generalizationCandidateObserved
        ? 'Repeated same-capability misses identify a generalization research candidate, but the Reasoning Foundation selected separately authored frozen evidence as the next bounded step.'
        : 'Current evidence is too narrow for an architecture request; gather a separately authored frozen probe while preserving the miss.'
  });
}

function batchDigestBasis(batch) {
  const basis = clone(batch);
  basis.batchDigest = null;
  return basis;
}

function analyze(exam, options = {}) {
  BehavioralExam.verifyExamEnvelope(exam);
  const observedAt = String(options.at || '').trim();
  if (!observedAt || observedAt.length > 80) throw new Error('English capability frontier requires an explicit bounded observation time');
  const requests = grouping(exam).map(([capabilityId, rows]) => requestFor(exam, capabilityId, rows, observedAt));
  const research = requests.filter(request => request.route === 'RESEARCH_GENERALIZATION_OR_ADAPTER').length;
  const evidence = requests.filter(request => request.route === 'REQUEST_MORE_SEPARATELY_AUTHORED_EVIDENCE').length;
  const basis = { sourceExamDigest: exam.examDigest, observedAt, requestIds: requests.map(item => item.requestId) };
  const batch = stable({
    schema: BATCH_SCHEMA,
    batchId: `english-capability-frontier-batch-${sha256(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticRouting: false },
    specialistId: exam.specialistId,
    observedAt,
    sourceExam: { examId: exam.examId, examDigest: exam.examDigest, state: exam.state, failedCases: exam.summary.failed, independentLearningImprovementEvidence: exam.independence.eligibleAsLearningImprovementEvidence },
    state: !requests.length ? 'NO_CURRENT_ENGLISH_CAPABILITY_GAPS' : research ? 'PROPOSED_GENERALIZATION_RESEARCH_REQUESTS' : 'PROPOSED_ADDITIONAL_EVIDENCE_REQUESTS',
    requests,
    summary: {
      requestCount: requests.length,
      generalizationResearchRequests: research,
      additionalEvidenceRequests: evidence,
      answerKeysCopied: 0,
      examPromptsCopied: 0,
      codeBuilds: 0,
      lessonsCreated: 0,
      trainingWrites: 0,
      modelWrites: 0,
      runtimeAdmissions: 0,
      parentMirrorWrites: 0,
      worldActions: 0
    },
    authority: {
      privateRequestEvidenceWrite: true,
      chooseGeneralizationMethod: false,
      buildCode: false,
      createLesson: false,
      trainingAdmission: false,
      modelChange: false,
      permissionGrant: false,
      toolUse: false,
      activeRuntime: false,
      parentMirrorWrite: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    nextGate: research ? 'ROUTE_MODULAR_RESEARCH_REQUEST_TO_HUMAN_OR_CAPABLE_BUILDER_WITH_INDEPENDENT_EXAM_REQUIREMENT' : requests.length ? 'REQUEST_SEPARATELY_AUTHORED_FROZEN_EVIDENCE' : 'KEEP_CURRENT_MODEL_HELD_TO_EXISTING_SCOPE',
    boundary: 'This frontier converts verified repeated capability misses into proposal-only modular requests. It does not infer semantics from prose, copy answer keys, choose a learning method, build code, create lessons, train, change a model, grant permission, connect or start runtime parts, write Mirror, promote behavior, change CANON, or act.'
  });
  batch.batchDigest = sha256(batchDigestBasis(batch));
  return stable(batch);
}

function verifyBatch(batch, exam, runDir = null) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !/^english-capability-frontier-batch-[a-f0-9]{24}$/.test(batch.batchId || '')) throw new Error('English capability frontier batch identity is invalid');
  if (batch.batchDigest !== sha256(batchDigestBasis(batch))) throw new Error('English capability frontier batch digest changed');
  BehavioralExam.verifyExamEnvelope(exam);
  const rebuilt = analyze(exam, { at: batch.observedAt });
  if (JSON.stringify(stable(rebuilt)) !== JSON.stringify(stable(batch))) throw new Error('English capability frontier batch does not reconstruct from its source exam');
  if (!batch.authority || batch.authority.privateRequestEvidenceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key === 'privateRequestEvidenceWrite' ? value !== true : value !== false)) throw new Error('English capability frontier authority changed');
  if (batch.requests.some(request => request.answerKeysCopiedIntoRequest !== false || request.examPromptsCopiedIntoRequest !== false || request.automaticCodeBuild !== false || request.automaticTraining !== false)) throw new Error('English capability frontier request boundary changed');
  if (runDir) {
    const root = path.resolve(runDir);
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('English capability frontier run directory changed');
    const batchBytes = fs.readFileSync(path.join(root, 'batch.json'), 'utf8');
    if (batchBytes !== json(batch)) throw new Error('English capability frontier batch file changed');
    const requestRoot = path.join(root, 'requests');
    const requestStat = fs.lstatSync(requestRoot);
    if (!requestStat.isDirectory() || requestStat.isSymbolicLink()) throw new Error('English capability frontier request directory changed');
    const expectedFiles = batch.requests.map(request => `${request.requestId}.json`).sort();
    const actualFiles = fs.readdirSync(requestRoot).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('English capability frontier request file set changed');
    for (const request of batch.requests) {
      const bytes = fs.readFileSync(path.join(requestRoot, `${request.requestId}.json`), 'utf8');
      if (bytes !== json(request)) throw new Error(`English capability frontier request file changed: ${request.requestId}`);
    }
  }
  return true;
}

function run(exam, options = {}) {
  if (!options.stateDir) throw new Error('English capability frontier requires an explicit clone-private stateDir');
  const stateDir = path.resolve(options.stateDir);
  fs.mkdirSync(stateDir, { recursive: true });
  const stat = fs.lstatSync(stateDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('English capability frontier stateDir must be a real directory');
  const batch = analyze(exam, options);
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const stored = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(stored, exam, runDir);
    if (stored.batchDigest !== batch.batchDigest) throw new Error('English capability frontier content-addressed identity collision');
    return { batch: stored, runDir, reused: true, writes: 0 };
  }
  const stage = path.join(stateDir, `.stage-${process.pid}-${batch.batchId}`);
  if (fs.existsSync(stage)) throw new Error('English capability frontier staging directory already exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'batch.json'), json(batch), { encoding: 'utf8', flag: 'wx' });
    const requestRoot = path.join(stage, 'requests');
    fs.mkdirSync(requestRoot);
    for (const request of batch.requests) fs.writeFileSync(path.join(requestRoot, `${request.requestId}.json`), json(request), { encoding: 'utf8', flag: 'wx' });
    verifyBatch(batch, exam, stage);
    const commit = ImmutableStore.commitDirectory(stage, runDir);
    return { batch, runDir, reused: commit.reused, writes: commit.reused ? 0 : 1 + batch.requests.length };
  } catch (error) {
    if (fs.existsSync(stage) && stage.startsWith(stateDir + path.sep) && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, BATCH_SCHEMA, MIN_RECURRENT_SOURCE_GROUPS, analyze, verifyBatch, run };
