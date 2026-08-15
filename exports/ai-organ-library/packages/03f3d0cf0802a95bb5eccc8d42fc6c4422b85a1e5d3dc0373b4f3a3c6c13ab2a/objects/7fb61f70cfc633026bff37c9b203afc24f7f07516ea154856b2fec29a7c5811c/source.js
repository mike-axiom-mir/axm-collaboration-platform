'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const PackCell = require('../kernel/declarative-reasoning-organ-heldout-pack-cell');
const Runner = require('../kernel/declarative-reasoning-organ-exam-runner');
const StructuralFeature = require('./reasoning-structural-feature-organ');
const Builder = require('./declarative-reasoning-organ-candidate-builder-organ');
const Foundation = require('../kernel/reasoning-foundation');

const ORGAN_ID = 'axm.mirror.organ/declarative-reasoning-organ-independent-exam-v1';
const EXAM_SCHEMA = 'axm.mirror.declarative-reasoning-organ-independent-exam/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'declarative-reasoning-organ-independent-exam-runs');
const MAX_RUNNER_MILLISECONDS = 7500;
const MAX_RUNNER_BUFFER = 4 * 1024 * 1024;
const SOURCE_PATHS = Object.freeze([
  'organs/declarative-reasoning-organ-independent-exam-organ.js',
  'organs/declarative-reasoning-organ-candidate-builder-organ.js',
  'organs/reasoning-structural-feature-organ.js',
  'kernel/declarative-reasoning-organ-heldout-pack-cell.js',
  'kernel/declarative-reasoning-organ-exam-runner.js',
  'kernel/declarative-reasoning-organ-recipe-cell.js',
  'kernel/schema-structural-feature-projection-cell.js',
  'kernel/key-safe-json-transport-cell.js',
  'kernel/immutable-batch-store.js',
  'kernel/reasoning-foundation.js',
  'training/TRAINING_POLICY.json',
  'contracts/declarative-reasoning-organ-heldout-pack-draft.schema.json',
  'contracts/declarative-reasoning-organ-heldout-pack.schema.json',
  'contracts/declarative-reasoning-organ-candidate-execution-input.schema.json',
  'contracts/declarative-reasoning-organ-candidate-execution-output.schema.json',
  'contracts/declarative-reasoning-organ-independent-exam.schema.json'
]);

function stable(value) { return KeySafeJson.stable(value); }
function digest(value) { return KeySafeJson.digest(value); }
function same(left, right) { return KeySafeJson.same(left, right); }
function clone(value) { return KeySafeJson.stable(value); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum); }
function inside(root, target) { const relation = path.relative(path.resolve(root), path.resolve(target)); return !!relation && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation); }
function relative(root, target) { return path.relative(root, target).replace(/\\/g, '/'); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !expected.has(key));
  const missing = keys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) throw new Error(`${label} fields changed: unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`);
}
function normalizedAt(value) {
  if (value == null) return null;
  const time = Date.parse(String(value));
  if (!Number.isFinite(time)) throw new Error('declarative organ independent exam time is invalid');
  return new Date(time).toISOString();
}

function sourceLineage(root = ROOT) {
  return SOURCE_PATHS.map(sourcePath => {
    const bytes = fs.readFileSync(path.join(root, sourcePath));
    return { path: sourcePath, bytes: bytes.length, sha256: KeySafeJson.sha256Bytes(bytes) };
  });
}

function loadPolicy(options = {}) {
  const file = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('declarative organ independent exam requires the Mirror training policy');
  if (policy.automaticDeclarativeReasoningOrganIndependentExam !== false) throw new Error('declarative organ independent exam must remain explicit and nonautomatic');
  if (!String(policy.explicitDeclarativeReasoningOrganIndependentExamScope || '').includes('answer-free-candidate-execution')) throw new Error('declarative organ independent exam policy scope is incomplete');
  if (policy.automaticOrganInstallation !== false || policy.automaticAuthorityGrowth !== false || policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false) throw new Error('declarative organ independent exam refuses automatic installation, authority, runtime, or CANON growth');
  return policy;
}

function candidateDescriptor(batch, result) {
  if (!result || !result.candidate || !result.source || !result.source.recipe) throw new Error('declarative organ independent exam requires one built candidate result');
  const candidate = result.candidate;
  const recipe = result.source.recipe;
  return PackCell.normalizeCandidateDescriptor({
    batchId: batch.batchId,
    batchDigest: batch.batchDigest,
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    targetOrganId: candidate.targetOrganId,
    targetSeamId: candidate.targetSeamId,
    sourceAdmission: candidate.sourceAdmission,
    sourceRecipe: candidate.sourceRecipe,
    reviewer: { id: recipe.review.actorId, kind: recipe.review.actorKind },
    namedEvaluatorId: recipe.heldOutExam.evaluatorId,
    language: recipe.language
  });
}

function loadCandidateRun(candidateRunDir, candidateId, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const stateRoot = path.join(root, 'state');
  const runDir = path.resolve(candidateRunDir);
  if (!inside(stateRoot, runDir)) throw new Error('declarative organ candidate exam source must stay inside Mirror private state');
  const stat = fs.lstatSync(runDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('declarative organ candidate exam source must be one real directory');
  const batchFile = path.join(runDir, 'batch.json');
  const batchStat = fs.lstatSync(batchFile);
  if (!batchStat.isFile() || batchStat.isSymbolicLink() || batchStat.size > 32 * 1024 * 1024) throw new Error('declarative organ candidate exam batch file is invalid');
  const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  if (options.copiedEvidence === true) verifyCandidateBatchCopy(batch, runDir, root);
  else Builder.verifyBatch(batch, null, runDir, root);
  const result = batch.results.find(item => item.candidate && item.candidate.candidateId === clean(candidateId, 220));
  if (!result) throw new Error('declarative organ candidate is absent from the verified builder batch');
  const descriptor = candidateDescriptor(batch, result);
  if (descriptor.namedEvaluatorId !== ORGAN_ID) throw new Error('declarative organ candidate names a different independent evaluator');
  const candidateDir = path.resolve(runDir, result.candidate.directory);
  const candidateFile = path.join(candidateDir, 'organ.js');
  if (!inside(runDir, candidateDir) || !inside(candidateDir, candidateFile)) throw new Error('declarative organ candidate source path escaped its verified batch');
  return { root, runDir, batch, result, descriptor, candidateDir, candidateFile, copiedEvidence: options.copiedEvidence === true };
}

function describeCandidate(candidateRunDir, candidateId, options = {}) {
  return loadCandidateRun(candidateRunDir, candidateId, options).descriptor;
}

function sealPack(draft, candidateRunDir, candidateId, options = {}) {
  loadPolicy(options);
  const source = loadCandidateRun(candidateRunDir, candidateId, options);
  return PackCell.sealPack(draft, source.descriptor);
}

function reverseObjectOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectOrder);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).reverse()) output[key] = reverseObjectOrder(value[key]);
  return output;
}

function proseDecoyContext(context, caseId) {
  const output = clone(context);
  output.problemState.goal = {
    id: `prose-decoy-${digest(caseId).slice(0, 16)}`,
    statement: 'Fluent confident prose is deliberately outside the selector and must not change candidate behavior.',
    description: 'This sentence has no feature, evidence, permission, selection, or answer authority.'
  };
  return output;
}

function containsAnswerKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Object.keys(value).some(key => ['expected', 'matchedRuleIds', 'actionKinds', 'answer', 'correctAnswer'].includes(key))) return true;
  return Object.values(value).some(containsAnswerKey);
}

function behaviorProjection(output, descriptor) {
  const value = clone(output);
  exactKeys(value, ['schema', 'profiles', 'comparisons', 'selectedPathId', 'selectedActionId', 'state', 'selectionReason', 'inputOrderAuthority', 'strategyGuidance'], 'candidate reasoning path set');
  if (value.schema !== 'axm.mirror.reasoning-path-set/v1' || !Array.isArray(value.profiles) || !Array.isArray(value.comparisons) || value.comparisons.length !== 0 || value.inputOrderAuthority !== false) throw new Error('candidate reasoning path-set boundary changed');
  const rules = new Map(descriptor.language.rules.map(rule => [rule.ruleId, rule]));
  let toolRequests = 0;
  let permissionRequirements = 0;
  const actionKinds = [];
  const matchedRuleIds = value.profiles.map((profile, index) => {
    if (!profile || typeof profile !== 'object' || !profile.candidateAction || typeof profile.candidateAction !== 'object') throw new Error(`candidate profile ${index} is malformed`);
    const prefix = 'declarative-path-';
    const pathId = clean(profile.pathId, 180);
    if (!pathId.startsWith(prefix)) throw new Error('candidate profile path identity changed');
    const ruleId = pathId.slice(prefix.length);
    const rule = rules.get(ruleId);
    if (!rule || clean(profile.candidateAction.kind, 30).toUpperCase() !== rule.actionKind) throw new Error('candidate profile action no longer binds its reviewed rule');
    if (!Array.isArray(profile.requiredPermissions) || !Array.isArray(profile.candidateAction.requiredPermissions)) throw new Error('candidate profile permission declaration changed');
    permissionRequirements += profile.requiredPermissions.length + profile.candidateAction.requiredPermissions.length;
    if (profile.toolRequest !== null) toolRequests += 1;
    actionKinds.push({ ruleId, actionKind: rule.actionKind });
    return ruleId;
  }).sort();
  if (new Set(matchedRuleIds).size !== matchedRuleIds.length) throw new Error('candidate originated a duplicate reviewed rule profile');
  actionKinds.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  return {
    matchedRuleIds,
    actionKinds,
    state: clean(value.state, 40).toUpperCase(),
    selectedPathId: value.selectedPathId,
    selectedActionId: value.selectedActionId,
    toolRequests,
    permissionRequirements
  };
}

function runnerEnvironment() {
  const output = {};
  for (const key of ['PATH', 'SystemRoot']) if (typeof process.env[key] === 'string') output[key] = process.env[key];
  return output;
}

function executeVariant(source, candidateInput, inputFile, outputFile) {
  if (containsAnswerKey(candidateInput)) throw new Error('candidate execution input contains a held-out answer key');
  fs.writeFileSync(inputFile, json(candidateInput), { flag: 'wx' });
  const execution = childProcess.spawnSync(process.execPath, [path.join(ROOT, 'kernel', 'declarative-reasoning-organ-exam-runner.js'), source.candidateFile, inputFile], {
    cwd: source.candidateDir,
    encoding: 'utf8',
    timeout: MAX_RUNNER_MILLISECONDS,
    maxBuffer: MAX_RUNNER_BUFFER,
    windowsHide: true,
    env: runnerEnvironment()
  });
  let response = null;
  try { response = JSON.parse(String(execution.stdout || '').trim()); } catch (_) {}
  let validResponse = false;
  try {
    exactKeys(response, ['schema', 'executionId', 'candidateId', 'inputDigest', 'output', 'outputDigest'], 'candidate execution response');
    validResponse = response.schema === Runner.OUTPUT_SCHEMA && response.executionId === candidateInput.executionId && response.candidateId === source.descriptor.candidateId && response.inputDigest === digest(candidateInput) && response.outputDigest === digest(response.output);
  } catch (_) { validResponse = false; }
  const receipt = {
    schema: 'axm.mirror.declarative-reasoning-organ-candidate-runner-receipt/v1',
    executionId: candidateInput.executionId,
    candidateId: source.descriptor.candidateId,
    processStatus: Number.isInteger(execution.status) ? execution.status : null,
    signal: execution.signal || null,
    timeout: !!(execution.error && execution.error.code === 'ETIMEDOUT'),
    stdoutDigest: KeySafeJson.sha256Bytes(String(execution.stdout || '')),
    stderrDigest: KeySafeJson.sha256Bytes(String(execution.stderr || '')),
    response: validResponse && execution.status === 0 && !execution.error ? clone(response) : null,
    state: validResponse && execution.status === 0 && !execution.error ? 'PASS_BOUNDED_ANSWER_FREE_CANDIDATE_EXECUTION' : 'FAIL_BOUNDED_ANSWER_FREE_CANDIDATE_EXECUTION',
    expectedAnswersInInput: 0,
    expectedAnswersInEnvironment: 0,
    candidatePathSelectionsExecuted: 0,
    toolCalls: 0,
    permissionGrants: 0,
    worldActions: 0
  };
  fs.writeFileSync(outputFile, json(receipt), { flag: 'wx' });
  return receipt;
}

function caseFilename(index, caseId, variant) {
  return `${String(index + 1).padStart(3, '0')}-${digest(caseId).slice(0, 12)}-${variant.toLowerCase().replace(/_/g, '-')}.json`;
}

function evaluateCase(item, index, source, stageDir) {
  const variants = [
    { kind: 'BASE', context: clone(item.context) },
    { kind: 'PROSE_DECOY', context: proseDecoyContext(item.context, item.caseId) },
    { kind: 'INPUT_ORDER_REVERSED', context: reverseObjectOrder(clone(item.context)) }
  ];
  const executions = variants.map(variant => {
    const selector = PackCell.normalizeSelector(item.selector);
    const projection = StructuralFeature.create(variant.context, { selector });
    StructuralFeature.verify(projection, variant.context, { selector });
    if (variant.kind === 'BASE' && (projection.projectionId !== item.sealedProjection.projectionId || projection.projectionDigest !== item.sealedProjection.projectionDigest || projection.selector.selectorDigest !== item.sealedProjection.selectorDigest)) throw new Error(`held-out case ${item.caseId} structural projection changed after pack seal`);
    const executionId = `declarative-organ-execution-${digest({ candidateDigest: source.descriptor.candidateDigest, packCase: item.caseId, variant: variant.kind, projectionDigest: projection.projectionDigest }).slice(0, 24)}`;
    const candidateInput = {
      schema: Runner.INPUT_SCHEMA,
      executionId,
      candidateId: source.descriptor.candidateId,
      candidateDigest: source.descriptor.candidateDigest,
      problemState: variant.context.problemState,
      structuralProjection: projection
    };
    const filename = caseFilename(index, item.caseId, variant.kind);
    const inputFile = path.join(stageDir, 'candidate-inputs', filename);
    const outputFile = path.join(stageDir, 'candidate-outputs', filename);
    const receipt = executeVariant(source, candidateInput, inputFile, outputFile);
    let actual = null;
    let behaviorError = null;
    if (receipt.response) {
      try { actual = behaviorProjection(receipt.response.output, source.descriptor); }
      catch (error) { behaviorError = clean(error.message, 500); }
    }
    return {
      variant: variant.kind,
      executionId,
      candidateInputDigest: digest(candidateInput),
      structuralProjection: { projectionId: projection.projectionId, projectionDigest: projection.projectionDigest },
      inputFile: relative(stageDir, inputFile),
      outputFile: relative(stageDir, outputFile),
      runnerState: receipt.state,
      actual,
      behaviorError
    };
  });
  const base = executions.find(entry => entry.variant === 'BASE');
  const baseAgreement = !!base.actual && same(base.actual, item.expected);
  const invariant = !!base.actual && executions.every(entry => !!entry.actual && same(entry.actual, base.actual));
  const runnerPass = executions.every(entry => entry.runnerState === 'PASS_BOUNDED_ANSWER_FREE_CANDIDATE_EXECUTION');
  const state = runnerPass && baseAgreement && invariant ? 'PASS_DECLARED_HELDOUT_CASE_AND_METAMORPHIC_INVARIANCE' : 'FAIL_DECLARED_HELDOUT_CASE_OR_METAMORPHIC_INVARIANCE';
  return {
    caseId: item.caseId,
    sourceGroupId: item.sourceGroupId,
    expected: clone(item.expected),
    actual: base.actual,
    executions,
    comparison: { baseAgreement, proseDecoyInvariant: invariant && same(executions.find(entry => entry.variant === 'PROSE_DECOY').actual, base.actual), inputOrderInvariant: invariant && same(executions.find(entry => entry.variant === 'INPUT_ORDER_REVERSED').actual, base.actual) },
    state
  };
}

function foundationSession(examId, state, source, pack, cases, options = {}) {
  const pass = state === 'DECLARED_INDEPENDENT_HELDOUT_CASES_PASS_PROPOSE_HUMAN_ADMISSION_REVIEW';
  const evidence = [
    { id: examId, kind: 'test', status: 'tested', statement: `The content-bound declarative organ exam is in state ${state}.`, source: { kind: 'declarative-organ-independent-exam', id: examId, at: options.at || null } },
    { id: source.descriptor.candidateId, kind: 'artifact', status: 'observed', statement: 'The candidate bytes reconstruct exactly from one attributed HUMAN-reviewed closed recipe and remain isolated.', source: { kind: 'declarative-organ-candidate', id: source.descriptor.candidateId, at: null } },
    { id: pack.packId, kind: 'test', status: 'tested', statement: 'The held-out pack binds the named evaluator and an outside-authorship declaration; Mirror does not certify that declaration.', source: { kind: 'declarative-organ-heldout-pack', id: pack.packId, at: null } }
  ];
  const evidenceIds = evidence.map(item => item.id);
  const proposalId = `propose-human-admission-review-${digest(examId).slice(0, 20)}`;
  const actions = pass ? [{
    id: proposalId,
    kind: 'proposal',
    label: 'Propose an attributed HUMAN admission review of the still-isolated declarative reasoning organ candidate',
    requiredPermissions: [],
    supportingEvidence: evidenceIds,
    preconditionEvidence: evidenceIds,
    expectedEffects: ['A human may inspect the exact candidate, declared held-out pack, and exam without installing or loading it.'],
    possibleSideEffects: ['Declared independence may later fail external verification or broader transfer.'],
    reversible: true,
    recovery: 'Reject or supersede the proposal while preserving the candidate, pack, executions, and failed evidence.',
    risk: 'low'
  }] : [];
  const reasoning = {
    schema: 'axm.mirror.reason/v1',
    requestId: `foundation-${examId}`,
    sessionId: `foundation-${examId}`,
    actor: { id: 'mirror-declarative-organ-independent-exam', kind: 'machine', displayName: 'Mirror Declarative Organ Independent Examiner' },
    goal: { id: 'route-declarative-organ-heldout-evidence', statement: 'Route exact declared held-out candidate behavior to human review only when coverage, agreement, and invariance all pass.' },
    evidence,
    unknowns: [],
    constraints: [{ id: 'candidate-remains-isolated', type: 'max-risk', statement: 'The examiner may propose HUMAN review but may not install, load, train, grant, promote, change CANON, or act.', actionIds: actions.map(item => item.id), evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions,
    budget: { maxCandidates: 1, deadlineMs: 1000 },
    decomposition: [],
    assumptions: [],
    pathProfiles: actions.map(action => ({ pathId: `path-${action.id}`, actionId: action.id, approach: action.label, questionIds: [], requiredEvidence: evidenceIds, requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0.75, reversible: true, failureConditions: ['Candidate, pack, projection, or execution reconstruction fails.', 'Declared independence is relabelled certified.', 'Any operative authority becomes true.'], strategyTags: ['declarative-organ-exam', 'human-admission-review-only'] })),
    verificationReceipts: actions.map(action => ({ id: `verify-${action.id}`, actionId: action.id, claim: 'The review proposal is reproduced from exact candidate bytes, sealed pack content, answer-free executions, closed comparisons, and metamorphic invariance.', evidenceRefs: evidenceIds, method: 'Re-run the independent exam from the complete stored source bundle.', result: 'PASS', limitations: ['authorship independence is declared, not certified', 'bounded cases do not prove broad reasoning improvement', 'candidate remains uninstalled'] })),
    outcome: { result: 'HOLD', statement: pass ? 'Bounded declared held-out evidence supports human review only; the candidate remains isolated.' : `The candidate remains held because the exam state is ${state}.`, evidenceRefs: evidenceIds, transferEvidenceRefs: [], regressionEvidenceRefs: cases.filter(item => item.state.startsWith('FAIL')).map(item => item.caseId), repairEvidenceRefs: [], resolvedSeams: [], observedAt: options.at || null, verified: true, repeatedVerifiedOutcomes: cases.filter(item => item.state.startsWith('PASS')).length, usePermission: pack.usePermission, permissionBasis: pack.permissionBasis, worldMutations: 0, runtimePointerChanged: false, unexpectedSeams: [] }
  };
  const session = Foundation.run(reasoning, { at: options.at || null });
  if (pass && session.pathSet.selectedActionId !== proposalId) throw new Error('Reasoning Foundation did not preserve the bounded human-review proposal');
  if (!session.authority || session.authority.proposalOnly !== true || Object.entries(session.authority).some(([key, value]) => key === 'proposalOnly' ? value !== true : value !== false)) throw new Error('declarative organ exam Foundation session gained authority');
  return session;
}

function copyCandidateBatch(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'batch.json'), fs.readFileSync(path.join(source.runDir, 'batch.json')), { flag: 'wx' });
  for (const item of source.batch.results.filter(entry => entry.candidate)) {
    const targetDirectory = path.join(destination, item.candidate.directory);
    if (!inside(destination, targetDirectory)) throw new Error('candidate batch evidence copy escaped its destination');
    fs.mkdirSync(targetDirectory, { recursive: true });
    for (const seal of item.candidate.files) {
      const from = path.join(source.runDir, item.candidate.directory, seal.name);
      const to = path.join(targetDirectory, seal.name);
      fs.writeFileSync(to, fs.readFileSync(from), { flag: 'wx' });
    }
  }
  verifyCandidateBatchCopy(source.batch, destination, source.root);
}

function verifyCandidateBatchCopy(batch, runDir, root = ROOT) {
  Builder.verifyBatch(batch, null, null, root);
  const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  if (!same(diskBatch, batch)) throw new Error('copied declarative organ candidate batch changed');
  const expectedRootEntries = ['batch.json'].concat(batch.results.some(item => item.candidate) ? ['candidates'] : []).sort();
  if (!same(fs.readdirSync(runDir).sort(), expectedRootEntries)) throw new Error('copied declarative organ candidate batch contains unexpected entries');
  const expectedCandidateDirectories = batch.results.filter(entry => entry.candidate).map(entry => path.basename(entry.candidate.directory)).sort();
  if (expectedCandidateDirectories.length && !same(fs.readdirSync(path.join(runDir, 'candidates')).sort(), expectedCandidateDirectories)) throw new Error('copied declarative organ candidate directory inventory changed');
  for (const item of batch.results.filter(entry => entry.candidate)) {
    const candidateDir = path.join(runDir, item.candidate.directory);
    if (!inside(runDir, candidateDir)) throw new Error('copied declarative organ candidate escaped its batch');
    const expectedNames = item.candidate.files.map(entry => entry.name).sort();
    if (!same(fs.readdirSync(candidateDir).sort(), expectedNames)) throw new Error('copied declarative organ candidate contains unexpected files');
    for (const seal of item.candidate.files) {
      const file = path.join(candidateDir, seal.name);
      const stat = fs.lstatSync(file);
      const bytes = fs.readFileSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || bytes.length !== seal.bytes || KeySafeJson.sha256Bytes(bytes) !== seal.sha256) throw new Error(`copied declarative organ candidate file changed: ${seal.name}`);
    }
    const stored = item.canaryReceipt;
    if (stored) exactKeys(stored, ['schema', 'state', 'processStatus', 'testsPassed', 'testsFailed', 'stdoutDigest', 'stderrDigest', 'timeout', 'candidateSourceExecuted', 'syntheticBuilderCanariesOnly', 'heldOutFixturesAuthored', 'heldOutCasesExecuted', 'heldOutFitEstablished', 'targetContractConformanceEstablished', 'installed', 'loadedIntoRuntime'], 'copied candidate builder canary receipt');
    if (!stored || stored.state !== 'PASS_BUILDER_CANARIES_NOT_HELD_OUT' || stored.processStatus !== 0 || stored.testsPassed !== 7 || stored.testsFailed !== 0 || stored.timeout !== false || stored.candidateSourceExecuted !== true || stored.syntheticBuilderCanariesOnly !== true || stored.heldOutFixturesAuthored !== 0 || stored.heldOutCasesExecuted !== 0 || stored.heldOutFitEstablished !== false || stored.targetContractConformanceEstablished !== false || stored.installed !== false || stored.loadedIntoRuntime !== false || !/^[a-f0-9]{64}$/.test(String(stored.stdoutDigest || '')) || !/^[a-f0-9]{64}$/.test(String(stored.stderrDigest || ''))) throw new Error('copied declarative organ candidate builder canary receipt boundary changed');
  }
  return true;
}

function fileManifest(directory) {
  const rows = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error('declarative organ exam evidence may not contain symlinks');
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) {
        const bytes = fs.readFileSync(absolute);
        rows.push({ path: relative(directory, absolute), bytes: bytes.length, sha256: KeySafeJson.sha256Bytes(bytes) });
      } else throw new Error('declarative organ exam evidence contains a special file');
    }
  }
  walk(directory);
  return rows.sort((left, right) => left.path.localeCompare(right.path));
}

function examAuthority() {
  return {
    privateEvidenceTraceWrite: true,
    isolatedCandidateExecution: true,
    independenceCertification: false,
    humanDecision: false,
    candidatePathSelection: false,
    toolUse: false,
    permissionGrant: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    install: false,
    load: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function buildStage(pack, source, stageDir, options = {}) {
  PackCell.verifyPack(pack, source.descriptor);
  fs.mkdirSync(path.join(stageDir, 'candidate-inputs'), { recursive: true });
  fs.mkdirSync(path.join(stageDir, 'candidate-outputs'), { recursive: true });
  const cases = pack.cases.map((item, index) => evaluateCase(item, index, source, stageDir));
  const casesPassed = cases.filter(item => item.state.startsWith('PASS')).length;
  const allCasesPassed = casesPassed === cases.length;
  const state = !pack.coverage.fullRequiredCoverage
    ? 'DECLARED_INDEPENDENT_HELDOUT_EVIDENCE_INSUFFICIENT_COVERAGE'
    : allCasesPassed
      ? 'DECLARED_INDEPENDENT_HELDOUT_CASES_PASS_PROPOSE_HUMAN_ADMISSION_REVIEW'
      : 'DECLARED_INDEPENDENT_HELDOUT_CASES_FAIL_CANDIDATE_REQUIRES_REVIEW';
  const lineage = sourceLineage(source.root);
  const examId = `declarative-reasoning-organ-independent-exam-${digest({ candidateDigest: source.descriptor.candidateDigest, packDigest: pack.packDigest, sourceLineage: lineage }).slice(0, 24)}`;
  const at = normalizedAt(options.at);
  const session = foundationSession(examId, state, source, pack, cases, { at });
  fs.writeFileSync(path.join(stageDir, 'source-pack.json'), json(pack), { flag: 'wx' });
  copyCandidateBatch(source, path.join(stageDir, 'source-candidate-batch'));
  const files = fileManifest(stageDir);
  const reviewProposals = state === 'DECLARED_INDEPENDENT_HELDOUT_CASES_PASS_PROPOSE_HUMAN_ADMISSION_REVIEW' ? 1 : 0;
  const exam = {
    schema: EXAM_SCHEMA,
    examId,
    examDigest: null,
    createdAt: at,
    organ: { id: ORGAN_ID, status: 'TEST_DECLARED_INDEPENDENT_ANSWER_BLIND_HELDOUT_EXAM', learnedWeights: false, automaticEvaluation: false },
    source: { candidate: clone(source.descriptor), pack: { packId: pack.packId, packDigest: pack.packDigest }, sourceLineage: lineage },
    independence: { declaredByPackAuthor: true, declarationBoundByPackDigest: true, namedEvaluatorBound: pack.evaluator.id === ORGAN_ID, reviewerAndAuthorDistinct: pack.author.id !== source.descriptor.reviewer.id, cryptographicallyProven: false, externallyVerified: false, syntheticFixtureCountedAsIndependent: false },
    coverage: clone(pack.coverage),
    cases,
    foundationSession: session,
    summary: {
      heldOutCases: cases.length,
      candidateExecutions: cases.length * 3,
      baseCasesPassed: cases.filter(item => item.comparison.baseAgreement).length,
      baseCasesFailed: cases.filter(item => !item.comparison.baseAgreement).length,
      proseDecoyInvariantsPassed: cases.filter(item => item.comparison.proseDecoyInvariant).length,
      proseDecoyInvariantFailures: cases.filter(item => !item.comparison.proseDecoyInvariant).length,
      inputOrderInvariantsPassed: cases.filter(item => item.comparison.inputOrderInvariant).length,
      inputOrderInvariantFailures: cases.filter(item => !item.comparison.inputOrderInvariant).length,
      completeCasesPassed: casesPassed,
      completeCasesFailed: cases.length - casesPassed,
      fullRequiredCoverage: pack.coverage.fullRequiredCoverage,
      answerKeysSuppliedToCandidate: 0,
      declaredIndependentPacksEvaluated: 1,
      independentAuthorshipCertifications: 0,
      targetContractConformanceClaims: 0,
      humanAdmissionReviewProposals: reviewProposals,
      humanDecisions: 0,
      candidatePathSelections: 0,
      toolCalls: 0,
      permissionGrants: 0,
      evidenceAdmissions: 0,
      trainingAdmissions: 0,
      candidatesInstalled: 0,
      candidatesLoaded: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    files,
    state,
    authority: examAuthority(),
    boundary: 'A pass means one exact isolated candidate agreed with a content-sealed pack carrying an outside-authorship declaration, under answer-free subprocess input plus prose and object-order variants, with complete declared rule and absence coverage. Mirror binds but cannot certify the authorship declaration. A pass proposes attributed HUMAN admission review only; it is not target-contract conformance, broad reasoning improvement, safety, installation, runtime readiness, intelligence, CANON, permission, training, or world authority.'
  };
  exam.examDigest = digest(Object.assign({}, exam, { examDigest: null }));
  fs.writeFileSync(path.join(stageDir, 'exam.json'), json(exam), { flag: 'wx' });
  return exam;
}

function verifyFiles(exam, runDir) {
  const actual = fileManifest(runDir).filter(item => item.path !== 'exam.json');
  if (!same(actual, exam.files)) throw new Error('declarative organ independent exam evidence file inventory changed');
  for (const entry of exam.files.filter(item => item.path.startsWith('candidate-inputs/'))) {
    const input = JSON.parse(fs.readFileSync(path.join(runDir, entry.path), 'utf8'));
    if (containsAnswerKey(input)) throw new Error('stored candidate input contains held-out answers');
  }
  return true;
}

function verifyExamShape(exam, pack, source, runDir) {
  exactKeys(exam, ['schema', 'examId', 'examDigest', 'createdAt', 'organ', 'source', 'independence', 'coverage', 'cases', 'foundationSession', 'summary', 'files', 'state', 'authority', 'boundary'], 'declarative organ independent exam');
  if (exam.schema !== EXAM_SCHEMA || exam.examDigest !== digest(Object.assign({}, exam, { examDigest: null }))) throw new Error('declarative organ independent exam digest changed');
  if (!exam.organ || exam.organ.id !== ORGAN_ID || exam.organ.status !== 'TEST_DECLARED_INDEPENDENT_ANSWER_BLIND_HELDOUT_EXAM' || exam.organ.learnedWeights !== false || exam.organ.automaticEvaluation !== false) throw new Error('declarative organ independent exam identity changed');
  if (!same(exam.authority, examAuthority())) throw new Error('declarative organ independent exam authority changed');
  if (!same(exam.source.candidate, source.descriptor) || exam.source.pack.packId !== pack.packId || exam.source.pack.packDigest !== pack.packDigest || !same(exam.source.sourceLineage, sourceLineage(source.root))) throw new Error('declarative organ independent exam source binding changed');
  if (exam.summary.answerKeysSuppliedToCandidate !== 0 || exam.summary.independentAuthorshipCertifications !== 0 || exam.summary.targetContractConformanceClaims !== 0 || ['humanDecisions', 'candidatePathSelections', 'toolCalls', 'permissionGrants', 'evidenceAdmissions', 'trainingAdmissions', 'candidatesInstalled', 'candidatesLoaded', 'runtimePromotions', 'canonChanges', 'worldActions'].some(key => exam.summary[key] !== 0)) throw new Error('declarative organ independent exam claim ceiling changed');
  const proposalState = exam.state === 'DECLARED_INDEPENDENT_HELDOUT_CASES_PASS_PROPOSE_HUMAN_ADMISSION_REVIEW';
  if (exam.summary.humanAdmissionReviewProposals !== (proposalState ? 1 : 0)) throw new Error('declarative organ independent exam proposal count changed');
  if (proposalState && (!exam.coverage.fullRequiredCoverage || exam.summary.completeCasesFailed !== 0 || !exam.foundationSession.pathSet.selectedActionId)) throw new Error('declarative organ independent exam pass lacks coverage, agreement, invariance, or Foundation review routing');
  if (!exam.foundationSession.authority || exam.foundationSession.authority.proposalOnly !== true || Object.entries(exam.foundationSession.authority).some(([key, value]) => key === 'proposalOnly' ? value !== true : value !== false)) throw new Error('stored declarative organ exam Foundation session gained authority');
  PackCell.verifyPack(pack, source.descriptor);
  if (source.copiedEvidence) verifyCandidateBatchCopy(source.batch, source.runDir, source.root);
  else Builder.verifyBatch(source.batch, null, source.runDir, source.root);
  verifyFiles(exam, runDir);
  return true;
}

function verifyStored(runDir, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const exam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
  const pack = JSON.parse(fs.readFileSync(path.join(runDir, 'source-pack.json'), 'utf8'));
  const copiedCandidateRun = path.join(runDir, 'source-candidate-batch');
  const source = loadCandidateRun(copiedCandidateRun, pack.candidate.candidateId, { root, copiedEvidence: true });
  verifyExamShape(exam, pack, source, runDir);
  const privateRoot = path.join(root, 'state');
  const replayCandidateRun = fs.mkdtempSync(path.join(privateRoot, `.declarative-organ-exam-replay-candidate-${process.pid}-`));
  const scratch = fs.mkdtempSync(path.join(privateRoot, `.declarative-organ-exam-replay-stage-${process.pid}-`));
  try {
    copyCandidateBatch(source, replayCandidateRun);
    const replaySource = loadCandidateRun(replayCandidateRun, pack.candidate.candidateId, { root });
    const rebuilt = buildStage(pack, replaySource, scratch, { at: exam.createdAt });
    if (!same(rebuilt, exam)) throw new Error('declarative organ independent exam does not replay from its complete stored source bundle');
  } finally {
    if (inside(privateRoot, scratch) && path.basename(scratch).startsWith(`.declarative-organ-exam-replay-stage-${process.pid}-`)) fs.rmSync(scratch, { recursive: true, force: true });
    if (inside(privateRoot, replayCandidateRun) && path.basename(replayCandidateRun).startsWith(`.declarative-organ-exam-replay-candidate-${process.pid}-`)) fs.rmSync(replayCandidateRun, { recursive: true, force: true });
  }
  return { exam, pack, source };
}

function run(packValue, candidateRunDir, candidateId, options = {}) {
  loadPolicy(options);
  const root = path.resolve(options.root || ROOT);
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'declarative-reasoning-organ-independent-exam-runs'));
  if (!inside(root, stateDir)) throw new Error('declarative organ independent exam state must stay inside the Mirror root');
  const source = loadCandidateRun(candidateRunDir, candidateId, { root });
  const pack = clone(packValue);
  PackCell.verifyPack(pack, source.descriptor);
  const lineage = sourceLineage(root);
  const examId = `declarative-reasoning-organ-independent-exam-${digest({ candidateDigest: source.descriptor.candidateDigest, packDigest: pack.packDigest, sourceLineage: lineage }).slice(0, 24)}`;
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, examId);
  if (fs.existsSync(runDir)) {
    const verified = verifyStored(runDir, { root });
    if (!same(verified.pack, pack) || !same(verified.source.descriptor, source.descriptor)) throw new Error('declarative organ independent exam content-addressed identity collision');
    return { exam: verified.exam, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${examId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('declarative organ independent exam staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  try {
    const exam = buildStage(pack, source, stageDir, { at: options.at });
    verifyExamShape(exam, pack, loadCandidateRun(path.join(stageDir, 'source-candidate-batch'), candidateId, { root, copiedEvidence: true }), stageDir);
    const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
    return { exam, runDir, reused: commit.reused };
  } catch (error) {
    // Preserve a complete failing stage as evidence. Incomplete stages are never
    // promoted and are deliberately not deleted by the evaluator.
    throw error;
  }
}

module.exports = {
  ORGAN_ID,
  EXAM_SCHEMA,
  ROOT,
  DEFAULT_STATE_DIR,
  MAX_RUNNER_MILLISECONDS,
  MAX_RUNNER_BUFFER,
  SOURCE_PATHS,
  sourceLineage,
  loadPolicy,
  candidateDescriptor,
  loadCandidateRun,
  describeCandidate,
  sealPack,
  reverseObjectOrder,
  proseDecoyContext,
  containsAnswerKey,
  behaviorProjection,
  executeVariant,
  evaluateCase,
  foundationSession,
  copyCandidateBatch,
  verifyCandidateBatchCopy,
  fileManifest,
  examAuthority,
  buildStage,
  verifyFiles,
  verifyExamShape,
  verifyStored,
  run
};
