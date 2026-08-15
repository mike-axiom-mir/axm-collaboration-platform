'use strict';

const fs = require('node:fs');
const path = require('node:path');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const SuiteCell = require('../kernel/code-story-learning-robustness-suite-cell');
const Evaluator = require('./code-story-learning-heldout-evaluator-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-native-code-story-lab-mission-v1';
const REQUEST_SCHEMA = 'axm.mirror.code-clone-native-code-story-lab-mission-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-native-code-story-lab-mission-receipt/v1';
const DEFAULT_SUITE_PATH = path.resolve(__dirname, '..', 'lineage', 'code-story-learning-robustness-suite-v1.json');
const SELECTION_POLICY = 'CONTENT_ADDRESS_MODULO_SORTED_SEALED_CONFIGURATIONS_V1';
const AUTHORITY_KEYS = Object.freeze([
  'trainingPersistence', 'checkpointPersistence', 'candidateInstallation',
  'runtimeActivation', 'evidenceAdmission', 'trainingAdmission',
  'mirrorSourceWrite', 'workshopSourceWrite', 'permissionGrant', 'promotion',
  'canon', 'networkAction', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_BOUND_SYNTHETIC_CODE_STORY_MISSION_ONLY',
  'HOLD_BOUND_SYNTHETIC_CODE_STORY_MISSION',
  'REFUSED_MISSION_AUTHORITY_GROWTH',
  'HOLD_MISSION_EXCEPTION'
]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function identity(value, label, maximum = 240) {
  const text = String(value == null ? '' : value);
  if (!text || text.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(text)) throw new Error(`${label} must be a bounded identity`);
  return text;
}

function digest(value, label) {
  const text = String(value == null ? '' : value);
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
  return text;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(`${label} must be a canonical ISO timestamp`);
  return value;
}

function loadSuite(file = DEFAULT_SUITE_PATH) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Code Story lab suite must be one bounded real file');
  return SuiteCell.verifySuite(JSON.parse(fs.readFileSync(absolute, 'utf8')));
}

function requestAuthorityIsClosed(request) {
  return request.requestedAuthority.selectOneSealedSyntheticConfiguration === true &&
    request.requestedAuthority.fitDisposableModel === true &&
    request.requestedAuthority.generateBoundCandidates === true &&
    request.requestedAuthority.executeBoundHiddenCases === true &&
    AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function requestBasis(input, suite) {
  exactKeys(input, ['cloneId', 'frameDigest', 'observedAt', 'sessionId', 'structuralFocus'], 'mission request input');
  exactKeys(input.structuralFocus, ['id', 'kind', 'source', 'sourceDigest', 'state'], 'mission structural focus');
  return {
    schema: REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    missionId: null,
    specialistId: 'future-code-mirror',
    cloneId: identity(input.cloneId, 'clone ID'),
    sessionId: identity(input.sessionId, 'session ID'),
    observedAt: timestamp(input.observedAt, 'observedAt'),
    selectedBy: 'CLONE_SELF',
    humanDirectiveSource: false,
    frameDigest: digest(input.frameDigest, 'frame digest'),
    structuralFocus: {
      id: identity(input.structuralFocus.id, 'focus ID'),
      kind: identity(input.structuralFocus.kind, 'focus kind'),
      state: identity(input.structuralFocus.state, 'focus state'),
      source: identity(input.structuralFocus.source, 'focus source'),
      sourceDigest: digest(input.structuralFocus.sourceDigest, 'focus source digest')
    },
    suiteBinding: { suiteId: suite.suiteId, suiteDigest: suite.suiteDigest },
    selectionPolicy: SELECTION_POLICY,
    limits: {
      configurationsAvailable: SuiteCell.CONFIGURATION_COUNT,
      configurationsSelected: 1,
      subjects: 3,
      hiddenCasesPerCandidateKind: 9,
      candidateKinds: 2,
      executorReplaysPerCase: 2,
      maximumFreshChildProcesses: 36,
      persistentLearnedWeights: 0,
      parentWrites: 0
    },
    requestedAuthority: {
      selectOneSealedSyntheticConfiguration: true,
      fitDisposableModel: true,
      generateBoundCandidates: true,
      executeBoundHiddenCases: true,
      ...ZERO_AUTHORITY
    }
  };
}

function buildRequest(input, suiteValue = null) {
  const suite = suiteValue == null ? loadSuite() : SuiteCell.verifySuite(suiteValue);
  const basis = requestBasis(input, suite);
  const requestDigest = KeySafeJson.digest({ ...basis, missionId: null });
  return KeySafeJson.stable({ ...basis, missionId: `native-code-story-mission/${requestDigest.slice(0, 24)}` });
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 256 * 1024, maxDepth: 32, maxNodes: 4096 });
  exactKeys(request, ['cloneId', 'frameDigest', 'humanDirectiveSource', 'limits', 'missionId', 'observedAt', 'requestedAuthority', 'schema', 'selectedBy', 'selectionPolicy', 'sessionId', 'specialistId', 'status', 'structuralFocus', 'suiteBinding'], 'Code Story lab mission request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('Code Story lab mission request identity changed');
  if (request.selectedBy !== 'CLONE_SELF' || request.humanDirectiveSource !== false || request.selectionPolicy !== SELECTION_POLICY) throw new Error('Code Story lab mission selection authority changed');
  identity(request.cloneId, 'clone ID');
  identity(request.sessionId, 'session ID');
  timestamp(request.observedAt, 'observedAt');
  digest(request.frameDigest, 'frame digest');
  exactKeys(request.structuralFocus, ['id', 'kind', 'source', 'sourceDigest', 'state'], 'mission structural focus');
  for (const field of ['id', 'kind', 'state', 'source']) identity(request.structuralFocus[field], `focus ${field}`);
  digest(request.structuralFocus.sourceDigest, 'focus source digest');
  exactKeys(request.suiteBinding, ['suiteDigest', 'suiteId'], 'mission suite binding');
  identity(request.suiteBinding.suiteId, 'suite ID');
  digest(request.suiteBinding.suiteDigest, 'suite digest');
  exactKeys(request.limits, ['candidateKinds', 'configurationsAvailable', 'configurationsSelected', 'executorReplaysPerCase', 'hiddenCasesPerCandidateKind', 'maximumFreshChildProcesses', 'parentWrites', 'persistentLearnedWeights', 'subjects'], 'mission limits');
  const expectedLimits = { configurationsAvailable: 3, configurationsSelected: 1, subjects: 3, hiddenCasesPerCandidateKind: 9, candidateKinds: 2, executorReplaysPerCase: 2, maximumFreshChildProcesses: 36, persistentLearnedWeights: 0, parentWrites: 0 };
  if (!KeySafeJson.same(request.limits, expectedLimits)) throw new Error('Code Story lab mission limits changed');
  exactKeys(request.requestedAuthority, ['executeBoundHiddenCases', 'fitDisposableModel', 'generateBoundCandidates', 'selectOneSealedSyntheticConfiguration', ...AUTHORITY_KEYS], 'mission requested authority');
  if (Object.values(request.requestedAuthority).some(value => typeof value !== 'boolean')) throw new Error('Code Story lab mission authority values must be booleans');
  const expectedId = `native-code-story-mission/${KeySafeJson.digest({ ...request, missionId: null }).slice(0, 24)}`;
  if (request.missionId !== expectedId) throw new Error('Code Story lab mission content address changed');
  return request;
}

function selectConfiguration(request, suite) {
  const configurations = suite.configurations.slice().sort((left, right) => left.configurationId.localeCompare(right.configurationId));
  const selectionDigest = KeySafeJson.digest({
    policy: request.selectionPolicy,
    missionId: request.missionId,
    frameDigest: request.frameDigest,
    structuralFocus: request.structuralFocus,
    suiteDigest: suite.suiteDigest,
    configurationIds: configurations.map(item => item.configurationId)
  });
  const index = Number(BigInt(`0x${selectionDigest.slice(0, 16)}`) % BigInt(configurations.length));
  return { policy: SELECTION_POLICY, selectionDigest, configurationIndex: index, configuration: configurations[index] };
}

function verifyEvaluatorReceipt(receipt, evaluationRequest) {
  if (!receipt || receipt.schema !== Evaluator.RECEIPT_SCHEMA || !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || ''))) throw new Error('held-out evaluator receipt is invalid');
  const basis = { ...receipt };
  delete basis.receiptId;
  delete basis.receiptDigest;
  if (KeySafeJson.digest(basis) !== receipt.receiptDigest) throw new Error('held-out evaluator receipt digest changed');
  if (!receipt.verification || receipt.verification.requestDigest !== KeySafeJson.digest(evaluationRequest)) throw new Error('held-out evaluator request binding changed');
  if (receipt.verification.packDigest !== evaluationRequest.pack.packDigest || receipt.verification.trainingBatchDigest !== KeySafeJson.digest(evaluationRequest.trainingBatch)) throw new Error('held-out evaluator source binding changed');
  if (receipt.eligibility.runtimeActivation !== false || receipt.eligibility.installation !== false || receipt.eligibility.evidenceAdmission !== false || receipt.eligibility.trainingAdmission !== false || receipt.eligibility.canon !== false) throw new Error('held-out evaluator eligibility boundary changed');
  return receipt;
}

function candidateSet(receipt) {
  if (!receipt || !Array.isArray(receipt.generations)) return [];
  return receipt.generations.map(item => ({
    subjectId: item.subjectId,
    targetStoryDigest: item.targetStoryDigest,
    challengerState: item.challenger.state,
    modelDigest: item.challenger.modelDigest,
    proposalDigest: item.challenger.proposal ? item.challenger.proposal.proposalDigest : null,
    candidateDigest: item.challenger.proposal ? item.challenger.proposal.sha256 : null,
    candidateBytes: item.challenger.proposal ? item.challenger.proposal.bytes : null,
    expressionSignature: item.challenger.proposal ? item.challenger.proposal.expressionSignature : null,
    proposalOnly: item.challenger.proposal ? item.challenger.proposal.proposalOnly : null
  }));
}

function buildReceipt({ request, suite, selection, state, evaluatorReceipt = null, preservedError = null }) {
  if (!RECEIPT_STATES.includes(state)) throw new Error('Code Story lab mission state escaped its closed set');
  const pass = state === 'PASS_BOUND_SYNTHETIC_CODE_STORY_MISSION_ONLY';
  const candidates = candidateSet(evaluatorReceipt);
  const basis = KeySafeJson.stable({
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    state,
    recordedAt: request.observedAt,
    request,
    requestDigest: KeySafeJson.digest(request),
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_DISPOSABLE_CODE_STORY_LEARNER_AND_PURE_WASM_LAB', persistentLearnedWeights: false },
    selection: {
      policy: selection ? selection.policy : request.selectionPolicy,
      selectionDigest: selection ? selection.selectionDigest : null,
      suiteId: suite.suiteId,
      suiteDigest: suite.suiteDigest,
      configurationIndex: selection ? selection.configurationIndex : null,
      configurationId: selection ? selection.configuration.configurationId : null,
      capabilityFamily: selection ? selection.configuration.capabilityFamily : null,
      humanStoryProseUsedForSelection: false
    },
    evaluator: evaluatorReceipt == null ? null : { receiptId: evaluatorReceipt.receiptId, receiptDigest: evaluatorReceipt.receiptDigest, state: evaluatorReceipt.state, receipt: evaluatorReceipt },
    candidates,
    summary: {
      selectedConfigurations: selection ? 1 : 0,
      targetStories: evaluatorReceipt ? evaluatorReceipt.summary.targetStories : 0,
      challengerCandidatesGenerated: candidates.filter(item => item.candidateDigest != null).length,
      challengerHiddenCasesRun: evaluatorReceipt ? evaluatorReceipt.summary.challengerCasesRun : 0,
      challengerHiddenCasesPassed: evaluatorReceipt ? evaluatorReceipt.summary.challengerPasses : 0,
      baselineHiddenCasesPassed: evaluatorReceipt ? evaluatorReceipt.summary.baselinePasses : 0,
      observedPassImprovement: evaluatorReceipt ? evaluatorReceipt.summary.observedPassImprovement : 0,
      freshChildProcessReplays: evaluatorReceipt ? evaluatorReceipt.summary.observedFreshChildProcessReplays : 0
    },
    consequence: {
      machineState: pass ? 'PASS' : state.startsWith('REFUSED_') ? 'REFUSE' : 'HOLD',
      claimClass: 'ONE_CLONE_SELECTED_SYNTHETIC_CODE_STORY_CONFIGURATION_ONLY',
      candidateCodeActuallyExecuted: evaluatorReceipt ? evaluatorReceipt.summary.challengerCasesRun > 0 : false,
      hiddenExpectedResultsSentToGenerators: evaluatorReceipt ? evaluatorReceipt.learningEvidence.hiddenExpectedResultsSentToGenerators : false,
      exactCandidatesInstalled: 0,
      learnedWeightsPersisted: 0,
      eligibleForRealProjectCodingClaim: false,
      eligibleForGeneralCodingClaim: false
    },
    sideEffects: {
      temporaryModelFits: evaluatorReceipt ? evaluatorReceipt.sideEffects.temporaryModelFits : 0,
      downstreamDisposableExecutorReplays: evaluatorReceipt ? evaluatorReceipt.sideEffects.downstreamDisposableExecutorReplays : 0,
      checkpointsPersisted: 0,
      trainingExamplesPersisted: 0,
      candidatesInstalled: 0,
      parentMirrorWrites: 0,
      workshopWrites: 0,
      networkActions: 0
    },
    eligibility: { realProjectCoding: false, unattendedCoding: false, evidenceAdmission: false, trainingAdmission: false, runtimeActivation: false, installation: false, promotion: false, canon: false },
    authority: { selectOneSealedSyntheticConfiguration: requestAuthorityIsClosed(request), fitDisposableModel: requestAuthorityIsClosed(request), generateBoundCandidates: requestAuthorityIsClosed(request), executeBoundHiddenCases: requestAuthorityIsClosed(request), ...ZERO_AUTHORITY },
    preservedError,
    limitations: [
      'The mission selects only among three already sealed synthetic integer-behavior configurations; it does not invent an arbitrary problem or real repository change.',
      'Human story prose remains attributed trace context and has no configuration-selection, permission, evidence, or release authority.',
      'A pass proves one disposable story-to-candidate-to-hidden-execution consequence on this machine, not creativity, maintainability, general coding skill, or safe real-project work.',
      'Every learned model and candidate remains temporary and proposal-only; only this clone-state receipt may persist.'
    ],
    boundary: 'Selects one sealed synthetic Code Story configuration from structural machine state, fits disposable in-memory weights, generates bounded pure-Wasm proposals, and executes exact hidden cases in fresh permission-restricted child processes. It cannot persist learning, install code, write Mirror or Workshop source, grant permission, admit evidence, promote, accept CANON, or act outside the clone.'
  });
  const receiptDigest = KeySafeJson.digest(basis);
  return KeySafeJson.stable({ receiptId: `native-code-story-mission-receipt/${receiptDigest.slice(0, 24)}`, receiptDigest, ...basis });
}

function verifyReceipt(value) {
  const receipt = KeySafeJson.stable(value, { maxBytes: 2 * 1024 * 1024, maxDepth: 96, maxNodes: 65536 });
  if (receipt.schema !== RECEIPT_SCHEMA || !RECEIPT_STATES.includes(receipt.state) || !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || ''))) throw new Error('Code Story lab mission receipt is invalid');
  const basis = { ...receipt };
  delete basis.receiptId;
  delete basis.receiptDigest;
  const expected = KeySafeJson.digest(basis);
  if (receipt.receiptDigest !== expected || receipt.receiptId !== `native-code-story-mission-receipt/${expected.slice(0, 24)}`) throw new Error('Code Story lab mission receipt content address changed');
  const request = validateRequest(receipt.request);
  if (receipt.requestDigest !== KeySafeJson.digest(request)) throw new Error('Code Story lab mission receipt request digest changed');
  if (Object.entries(receipt.authority).some(([key, value]) => AUTHORITY_KEYS.includes(key) && value !== false)) throw new Error('Code Story lab mission receipt authority changed');
  return receipt;
}

function run(value, options = {}) {
  const request = validateRequest(value);
  const suite = options.suite == null ? loadSuite(options.suitePath || DEFAULT_SUITE_PATH) : SuiteCell.verifySuite(options.suite);
  if (request.suiteBinding.suiteId !== suite.suiteId || request.suiteBinding.suiteDigest !== suite.suiteDigest) throw new Error('Code Story lab mission suite binding changed');
  const selection = selectConfiguration(request, suite);
  if (!requestAuthorityIsClosed(request)) return buildReceipt({ request, suite, selection, state: 'REFUSED_MISSION_AUTHORITY_GROWTH' });
  const evaluationRequest = SuiteCell.buildConfigurationRequest(suite, selection.configuration.configurationId);
  let evaluatorReceipt;
  try {
    evaluatorReceipt = (options.evaluate || Evaluator.evaluate)(evaluationRequest);
    verifyEvaluatorReceipt(evaluatorReceipt, evaluationRequest);
  } catch (error) {
    return buildReceipt({ request, suite, selection, state: 'HOLD_MISSION_EXCEPTION', preservedError: { code: String(error.code || 'EVALUATOR_EXCEPTION').slice(0, 160), message: String(error.message || error).slice(0, 2000) } });
  }
  const state = evaluatorReceipt.state === 'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY'
    ? 'PASS_BOUND_SYNTHETIC_CODE_STORY_MISSION_ONLY'
    : 'HOLD_BOUND_SYNTHETIC_CODE_STORY_MISSION';
  return buildReceipt({ request, suite, selection, state, evaluatorReceipt });
}

module.exports = {
  ORGAN_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  DEFAULT_SUITE_PATH,
  SELECTION_POLICY,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  loadSuite,
  buildRequest,
  validateRequest,
  requestAuthorityIsClosed,
  selectConfiguration,
  verifyEvaluatorReceipt,
  buildReceipt,
  verifyReceipt,
  run
};
