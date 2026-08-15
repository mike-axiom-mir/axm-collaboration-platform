'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const OutputAdapterPlanner = require('./foundation-development-capability-output-adapter-planner-organ');
const EnvelopeAdapter = require('./foundation-evidence-envelope-adapter-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-capability-output-adapter-fixture-exam-organ/v2';
const BATCH_SCHEMA = 'axm.mirror.foundation-capability-output-adapter-fixture-exam-batch/v2';
const STATUS = 'TEST_INDEPENDENT_SYNTHETIC_ADAPTER_FIXTURE_EXAM';
const EXAMINER_SOURCE_PATH = 'organs/foundation-capability-output-adapter-fixture-exam-organ.js';
const ADAPTER_SOURCE_PATH = 'organs/foundation-evidence-envelope-adapter-organ.js';
const TRANSPORT_SOURCE_PATH = 'kernel/key-safe-json-transport-cell.js';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HAND_STATE_DIR = HandPlanner.DEFAULT_STATE_DIR;
const DEFAULT_ADAPTER_REQUEST_STATE_DIR = OutputAdapterPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-capability-output-adapter-fixture-exam-runs');

function stable(value) {
  const active = new WeakSet();
  function copy(current) {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('independent reference canonicalizer refuses a non-finite number');
      return Object.is(current, -0) ? 0 : current;
    }
    if (!current || typeof current !== 'object' || util.types.isProxy(current)) throw new Error('independent reference canonicalizer requires inert JSON data');
    if (active.has(current)) throw new Error('independent reference canonicalizer refuses cycles');
    active.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) throw new Error('independent reference canonicalizer refuses changed array prototypes');
        const descriptors = Object.getOwnPropertyDescriptors(current);
        const ownKeys = Reflect.ownKeys(current);
        const allowed = new Set(['length', ...Array.from({ length: current.length }, (_, index) => String(index))]);
        if (ownKeys.some(key => typeof key === 'symbol' || !allowed.has(key)) || ownKeys.length !== allowed.size) throw new Error('independent reference canonicalizer refuses non-JSON arrays');
        return Array.from({ length: current.length }, (_, index) => {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) throw new Error('independent reference canonicalizer refuses accessors');
          return copy(descriptor.value);
        });
      }
      if (Object.getPrototypeOf(current) !== Object.prototype) throw new Error('independent reference canonicalizer refuses changed object prototypes');
      const descriptors = Object.getOwnPropertyDescriptors(current);
      const keys = Reflect.ownKeys(current);
      if (keys.some(key => typeof key === 'symbol')) throw new Error('independent reference canonicalizer refuses symbol keys');
      const out = {};
      for (const key of keys.slice().sort()) {
        const descriptor = descriptors[key];
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) throw new Error('independent reference canonicalizer refuses accessors or hidden properties');
        Object.defineProperty(out, key, { value: copy(descriptor.value), enumerable: true, configurable: true, writable: true });
      }
      return out;
    } finally {
      active.delete(current);
    }
  }
  return copy(value);
}
function digest(value) {
  const encoded = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(encoded === undefined ? 'undefined' : encoded).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function clone(value) { return stable(value); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation adapter fixture-exam path escapes its parent: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation adapter fixture exams require the Mirror training policy');
  if (policy.automaticFoundationCapabilityOutputAdapterFixtureExams !== true) throw new Error('automatic foundation output-adapter fixture exams are not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation adapter fixture exams refuse runtime, canon, or authority growth');
  if (!String(policy.foundationCapabilityOutputAdapterFixtureExamScope || '').includes('synthetic-only-independent-fixtures-and-output-predicates')) throw new Error('foundation adapter fixture-exam scope is incomplete');
  return policy;
}

function loadCurrentHandBatch(options = {}) {
  if (options.handBatch) {
    HandPlanner.verifyBatch(options.handBatch);
    return options.handBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentHandPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-development-hands-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation adapter fixture-exam current hand batch id is missing');
  const runDir = boundedChild(path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR), batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  HandPlanner.verifyBatch(batch, null, runDir);
  return batch;
}

function loadCurrentAdapterRequestBatch(options = {}) {
  if (options.adapterRequestBatch) {
    OutputAdapterPlanner.verifyBatch(options.adapterRequestBatch);
    return options.adapterRequestBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentCapabilityOutputAdapterPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-capability-output-adapters-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation adapter fixture-exam current adapter request batch id is missing');
  const runDir = boundedChild(path.resolve(options.adapterRequestStateDir || DEFAULT_ADAPTER_REQUEST_STATE_DIR), batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  OutputAdapterPlanner.verifyBatch(batch, null, null, runDir);
  return batch;
}

function adapterSourceSha256(options = {}) {
  if (options.adapterSourceBytes) return digest(Buffer.from(options.adapterSourceBytes));
  return digest(fs.readFileSync(path.join(ROOT, ADAPTER_SOURCE_PATH)));
}

function examinerSourceSha256(options = {}) {
  if (options.examinerSourceBytes) return digest(Buffer.from(options.examinerSourceBytes));
  return digest(fs.readFileSync(path.join(ROOT, EXAMINER_SOURCE_PATH)));
}

function transportSourceSha256(options = {}) {
  if (options.transportSourceBytes) return digest(Buffer.from(options.transportSourceBytes));
  return digest(fs.readFileSync(path.join(ROOT, TRANSPORT_SOURCE_PATH)));
}

function fixtureInput(request, suffix = 'BASE') {
  const artifact = {
    schema: 'axm.mirror.synthetic-output-adapter-fixture/v1',
    fixtureId: `${suffix}-${digest(request.adapterRequestDigest).slice(0, 16)}`,
    payload: { alpha: 1, beta: [true, 'opaque'], nested: { z: 3, a: 2 } }
  };
  return {
    schema: EnvelopeAdapter.INPUT_SCHEMA,
    capabilityId: request.source.capabilityId,
    declarationDigest: request.source.declarationDigest,
    nativeOutputKind: request.adapterContract.inputKinds.slice().sort()[0],
    nativeArtifact: artifact,
    nativeArtifactDigest: digest(artifact),
    permission: { status: 'ALLOWED', basis: 'independent synthetic fixture execution only', attribution: ORGAN_ID },
    provenance: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      authorshipDeclaration: ORGAN_ID,
      authorshipState: 'DECLARED_NOT_CERTIFIED',
      independenceDeclaration: true,
      independenceState: 'DECLARED_NOT_CERTIFIED',
      observedOutcome: 'NOT_APPLICABLE',
      nativeAcceptanceState: 'SYNTHETIC_FIXTURE_ONLY'
    },
    authority: {
      evidenceAdmission: false,
      evidenceRelabeling: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Independent synthetic fixture; prose has no evidence, selection, or authority effect.'
  };
}

function futureRequest(request) {
  const changed = clone(request);
  changed.adapterContract.inputKinds = [`axm.mirror.synthetic-unseen-native-output/${digest(request.adapterRequestDigest).slice(0, 16)}`];
  changed.adapterRequestId = null;
  changed.adapterRequestDigest = null;
  changed.adapterRequestId = `foundation-capability-output-adapter-${digest(Object.assign({}, changed, { adapterRequestId: null, adapterRequestDigest: null })).slice(0, 24)}`;
  changed.adapterRequestDigest = digest(Object.assign({}, changed, { adapterRequestDigest: null }));
  OutputAdapterPlanner.verifyRequest(changed);
  return changed;
}

function assertIndependentCandidate(candidate, input, request, hand) {
  exactKeys(candidate, ['schema', 'candidateId', 'candidateDigest', 'organ', 'source', 'native', 'permission', 'provenance', 'requestedEvidence', 'assessment', 'authority', 'boundary'], 'independent candidate');
  if (candidate.schema !== EnvelopeAdapter.OUTPUT_SCHEMA) throw new Error('independent predicate candidate schema changed');
  const expectedId = `foundation-evidence-candidate-${digest(Object.assign({}, candidate, { candidateId: null, candidateDigest: null })).slice(0, 24)}`;
  if (candidate.candidateId !== expectedId || candidate.candidateDigest !== digest(Object.assign({}, candidate, { candidateDigest: null }))) throw new Error('independent predicate candidate seal changed');
  exactKeys(candidate.organ, ['id', 'learnedWeights', 'capabilitySpecificRouting', 'nativeArtifactInterpretation', 'nativeVerificationClaim'], 'independent candidate organ');
  if (candidate.organ.id !== EnvelopeAdapter.ORGAN_ID || candidate.organ.learnedWeights !== false || candidate.organ.capabilitySpecificRouting !== false || candidate.organ.nativeArtifactInterpretation !== false || candidate.organ.nativeVerificationClaim !== false) throw new Error('independent predicate organ boundary changed');
  if (!same(candidate.source, {
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    capabilityId: input.capabilityId,
    declarationDigest: input.declarationDigest
  })) throw new Error('independent predicate lineage changed');
  if (candidate.native.outputKind !== input.nativeOutputKind || candidate.native.artifactDigest !== input.nativeArtifactDigest || !same(candidate.native.artifact, input.nativeArtifact) || candidate.native.verification !== 'NOT_RECHECKED_BY_GENERIC_ENVELOPE_ADAPTER') throw new Error('independent predicate native seal changed');
  if (!same(candidate.permission, input.permission) || !same(candidate.provenance, input.provenance)) throw new Error('independent predicate declarations changed');
  if (!same(candidate.requestedEvidence, {
    evidenceKind: hand.evidenceNeed.evidenceKind,
    sourceConstraint: hand.evidenceNeed.sourceConstraint,
    independentFromCandidate: hand.evidenceNeed.independentFromCandidate,
    eventInductionAllowed: hand.evidenceNeed.eventInductionAllowed,
    classificationState: 'REQUESTED_NOT_PROVEN'
  })) throw new Error('independent predicate evidence class changed');
  if (!same(candidate.assessment, {
    evidenceAdmission: 'NOT_ADMITTED',
    acceptanceState: 'UNASSESSED',
    operationalFit: 'UNTESTED',
    newOrganNeed: 'UNASSESSED',
    realEvidenceProduced: false
  })) throw new Error('independent predicate assessment authority changed');
  if (!candidate.authority || Object.values(candidate.authority).some(value => value !== false)) throw new Error('independent predicate authority opened');
  if (typeof candidate.boundary !== 'string' || !candidate.boundary.trim()) throw new Error('independent predicate boundary missing');
  return true;
}

function observeCase(caseId, target, expected, adapterCalls, operation) {
  let observed = 'ACCEPT';
  let candidate = null;
  let errorDigest = null;
  try {
    candidate = operation() || null;
  } catch (error) {
    observed = 'REFUSE';
    errorDigest = digest(String(error && error.message || error));
  }
  return {
    caseId,
    target,
    expected,
    observed,
    passed: observed === expected,
    adapterCalls,
    candidateDigest: candidate && /^[a-f0-9]{64}$/.test(String(candidate.candidateDigest || '')) ? candidate.candidateDigest : null,
    errorDigest
  };
}

function executeCases(request, hand) {
  const cases = [];
  const valid = fixtureInput(request);
  cases.push(observeCase('VALID_OPAQUE_SEAL', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const candidate = EnvelopeAdapter.buildCandidate(valid, request, hand);
    assertIndependentCandidate(candidate, valid, request, hand);
    return candidate;
  }));
  cases.push(observeCase('KEY_ORDER_AND_PROSE_INVARIANCE', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 2, () => {
    const left = fixtureInput(request, 'ORDER');
    left.nativeArtifact = { schema: 'opaque/v1', payload: { a: 1, b: 2 } };
    left.nativeArtifactDigest = digest(left.nativeArtifact);
    const right = clone(left);
    right.nativeArtifact = { payload: { b: 2, a: 1 }, schema: 'opaque/v1' };
    right.nativeArtifactDigest = digest(right.nativeArtifact);
    right.boundary = 'Fluent prose falsely claims PASS, REAL, VERIFIED, and CANON.';
    const a = EnvelopeAdapter.buildCandidate(left, request, hand);
    const b = EnvelopeAdapter.buildCandidate(right, request, hand);
    assertIndependentCandidate(a, left, request, hand);
    assertIndependentCandidate(b, right, request, hand);
    if (a.candidateId !== b.candidateId || a.candidateDigest !== b.candidateDigest) throw new Error('independent invariant changed');
    return a;
  }));
  cases.push(observeCase('UNSEEN_NATIVE_OUTPUT_KIND', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const unseenRequest = futureRequest(request);
    const input = fixtureInput(unseenRequest, 'UNSEEN');
    const candidate = EnvelopeAdapter.buildCandidate(input, unseenRequest, hand);
    assertIndependentCandidate(candidate, input, unseenRequest, hand);
    return candidate;
  }));
  cases.push(observeCase('PUBLIC_PROTOTYPE_FIELD_PRESERVED', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const input = fixtureInput(request, 'PUBLIC_PROTOTYPE');
    input.nativeArtifact.payload.prototype = { family: 'public-machine-field' };
    input.nativeArtifactDigest = digest(input.nativeArtifact);
    const candidate = EnvelopeAdapter.buildCandidate(input, request, hand);
    assertIndependentCandidate(candidate, input, request, hand);
    if (!Object.prototype.hasOwnProperty.call(candidate.native.artifact.payload, 'prototype')) throw new Error('independent predicate lost public prototype field');
    return candidate;
  }));
  cases.push(observeCase('CONSTRUCTOR_DATA_FIELD_PRESERVED', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const input = fixtureInput(request, 'CONSTRUCTOR_DATA');
    input.nativeArtifact.payload.constructor = 'public-machine-data';
    input.nativeArtifactDigest = digest(input.nativeArtifact);
    const candidate = EnvelopeAdapter.buildCandidate(input, request, hand);
    assertIndependentCandidate(candidate, input, request, hand);
    if (!Object.prototype.hasOwnProperty.call(candidate.native.artifact.payload, 'constructor')) throw new Error('independent predicate lost constructor data field');
    return candidate;
  }));
  cases.push(observeCase('OWN_PROTO_DATA_FIELD_PRESERVED_WITHOUT_POLLUTION', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const input = fixtureInput(request, 'OWN_PROTO_DATA');
    Object.defineProperty(input.nativeArtifact.payload, '__proto__', {
      value: { publicMachineData: true },
      enumerable: true,
      configurable: true,
      writable: true
    });
    input.nativeArtifactDigest = digest(input.nativeArtifact);
    const candidate = EnvelopeAdapter.buildCandidate(input, request, hand);
    assertIndependentCandidate(candidate, input, request, hand);
    const artifact = candidate.native.artifact.payload;
    if (Object.getPrototypeOf(artifact) !== Object.prototype || !Object.prototype.hasOwnProperty.call(artifact, '__proto__') || Object.prototype.publicMachineData !== undefined) throw new Error('independent predicate detected prototype pollution');
    return candidate;
  }));

  const refusal = (caseId, mutate, target = 'ADAPTER_INPUT_BOUNDARY') => {
    cases.push(observeCase(caseId, target, 'REFUSE', 1, () => {
      const input = fixtureInput(request, caseId);
      const context = { input, request, hand };
      mutate(context);
      return EnvelopeAdapter.buildCandidate(context.input, context.request, context.hand);
    }));
  };
  refusal('WRONG_NATIVE_OUTPUT_KIND', ({ input }) => { input.nativeOutputKind = 'axm.mirror.undeclared-native-output/v1'; });
  refusal('POST_SEAL_ARTIFACT_MUTATION', ({ input }) => { input.nativeArtifact.payload.alpha = 999; });
  refusal('UNKNOWN_REQUIRED_PERMISSION', ({ input }) => { input.permission = { status: 'UNKNOWN', basis: null, attribution: null }; });
  refusal('FORBIDDEN_SOURCE_MATERIAL', ({ input }) => { input.permission = { status: 'FORBIDDEN', basis: null, attribution: null }; });
  refusal('INVENTED_PERMISSION_STATUS', ({ input }) => { input.permission = { status: 'AI_APPROVED', basis: null, attribution: null }; });
  refusal('BLANK_PERMISSION_BASIS', ({ input }) => { input.permission.basis = ' '; });
  refusal('CAPABILITY_BINDING_MISMATCH', ({ input }) => { input.capabilityId = `${input.capabilityId}.other`; });
  refusal('DECLARATION_BINDING_MISMATCH', ({ input }) => { input.declarationDigest = 'f'.repeat(64); });
  refusal('HAND_BINDING_MISMATCH', context => {
    context.hand = clone(context.hand);
    context.hand.handRequestId = `${context.hand.handRequestId}-other`;
    context.hand.handRequestDigest = digest(Object.assign({}, context.hand, { handRequestDigest: null }));
  });
  refusal('NESTED_HIDDEN_REASONING', ({ input }) => {
    input.nativeArtifact.payload.private_reasoning = ['secret trace'];
    input.nativeArtifactDigest = digest(input.nativeArtifact);
  });
  refusal('AUTHORITY_INJECTION', ({ input }) => { input.authority.evidenceAdmission = true; });
  refusal('EXTRA_ACCEPTANCE_CLAIM', ({ input }) => { input.acceptanceClaim = 'PASS'; });
  refusal('POLLUTED_INPUT_PROTOTYPE', ({ input }) => {
    input.nativeArtifact.payload = { safe: true };
    Object.setPrototypeOf(input.nativeArtifact.payload, { polluted: true });
  });
  refusal('ACCESSOR_INPUT_WITHOUT_DATA_READ', ({ input }) => {
    Object.defineProperty(input.nativeArtifact.payload, 'activeValue', {
      enumerable: true,
      get() {
        throw new Error('ACCESSOR_EXECUTED');
      }
    });
  });

  cases.push(observeCase('NATIVE_PASS_LABEL_REMAINS_UNADMITTED', 'ADAPTER_AND_INDEPENDENT_OUTPUT_PREDICATE', 'ACCEPT', 1, () => {
    const input = fixtureInput(request, 'RELABEL');
    input.provenance.nativeAcceptanceState = 'PASS_VERIFIED_REAL_CANON';
    const candidate = EnvelopeAdapter.buildCandidate(input, request, hand);
    assertIndependentCandidate(candidate, input, request, hand);
    return candidate;
  }));
  cases.push(observeCase('CONTENT_AWARE_OUTPUT_TAMPER', 'INDEPENDENT_OUTPUT_PREDICATE', 'REFUSE', 1, () => {
    const input = fixtureInput(request, 'OUTPUT_TAMPER');
    const candidate = EnvelopeAdapter.buildCandidate(input, request, hand);
    candidate.assessment.evidenceAdmission = 'ADMITTED';
    candidate.candidateId = `foundation-evidence-candidate-${digest(Object.assign({}, candidate, { candidateId: null, candidateDigest: null })).slice(0, 24)}`;
    candidate.candidateDigest = digest(Object.assign({}, candidate, { candidateDigest: null }));
    assertIndependentCandidate(candidate, input, request, hand);
    return candidate;
  }));
  return cases;
}

function executeRequestExam(request, hand, sourceContext) {
  const beforeDigest = digest({ request, hand, sourceContext });
  const caseResults = executeCases(request, hand);
  const afterDigest = digest({ request, hand, sourceContext });
  const unchanged = beforeDigest === afterDigest;
  const passed = unchanged && caseResults.every(item => item.passed);
  return {
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    declaredInputKinds: request.adapterContract.inputKinds.slice().sort(),
    caseResults,
    sourceState: { beforeDigest, afterDigest, unchanged },
    state: passed ? 'SYNTHETIC_ADAPTER_FIXTURE_EXAM_PASSED_INSTRUMENT_ONLY' : 'SYNTHETIC_ADAPTER_FIXTURE_EXAM_FAILED_KNOWN_FAIL'
  };
}

function expectedSummary(results) {
  const cases = results.flatMap(result => result.caseResults || []);
  return {
    adapterRequestsExamined: results.length,
    reusableAdapterImplementationsExamined: results.length ? 1 : 0,
    independentFixtureCasesAuthored: cases.length,
    syntheticAdapterExecutions: cases.reduce((sum, item) => sum + item.adapterCalls, 0),
    passedFixtureCases: cases.filter(item => item.passed).length,
    failedFixtureCases: cases.filter(item => !item.passed).length,
    unchangedSourceBindings: results.filter(item => item.sourceState.unchanged).length,
    realNativeArtifactsAdapted: 0,
    nativeSourcesExecuted: 0,
    adapterImplementationsSelected: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    trainingAdmissions: 0,
    permissionGrants: 0,
    promotions: 0,
    worldActions: 0
  };
}

function buildBatch(handBatch, adapterRequestBatch, options = {}) {
  HandPlanner.verifyBatch(handBatch);
  OutputAdapterPlanner.verifyBatch(adapterRequestBatch);
  if (adapterRequestBatch.source.handBatchId !== handBatch.batchId || adapterRequestBatch.source.handBatchDigest !== handBatch.batchDigest) throw new Error('foundation adapter fixture-exam hand and adapter request binding changed');
  const examinerSha = examinerSourceSha256(options);
  const sourceSha = adapterSourceSha256(options);
  const transportSha = transportSourceSha256(options);
  const hands = new Map((handBatch.hands || []).map(hand => [hand.handRequestId, hand]));
  const sourceContext = { handBatchDigest: handBatch.batchDigest, adapterRequestBatchDigest: adapterRequestBatch.batchDigest, examinerSourceSha256: examinerSha, adapterSourceSha256: sourceSha, transportSourceSha256: transportSha };
  const results = (adapterRequestBatch.requests || []).slice().sort((a, b) => a.adapterRequestId.localeCompare(b.adapterRequestId)).map(request => {
    const hand = hands.get(request.source.handRequestId);
    if (!hand || hand.handRequestDigest !== request.source.handRequestDigest) throw new Error('foundation adapter fixture-exam request has no exact hand');
    return executeRequestExam(request, hand, sourceContext);
  });
  const source = {
    handBatchId: handBatch.batchId,
    handBatchDigest: handBatch.batchDigest,
    adapterRequestBatchId: adapterRequestBatch.batchId,
    adapterRequestBatchDigest: adapterRequestBatch.batchDigest,
    examinerSourcePath: EXAMINER_SOURCE_PATH,
    examinerSourceSha256: examinerSha,
    adapterOrganId: EnvelopeAdapter.ORGAN_ID,
    adapterSourcePath: ADAPTER_SOURCE_PATH,
    adapterSourceSha256: sourceSha,
    transportSourcePath: TRANSPORT_SOURCE_PATH,
    transportSourceSha256: transportSha
  };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-capability-output-adapter-fixture-exams-${digest({ organId: ORGAN_ID, source, results }).slice(0, 24)}`,
    batchDigest: null,
    organ: {
      id: ORGAN_ID,
      status: STATUS,
      learnedWeights: false,
      candidateAuthoredFixtures: false,
      nativeSourceExecution: false,
      adapterSelection: false
    },
    source,
    results,
    summary: expectedSummary(results),
    state: !results.length ? 'NO_OUTPUT_ADAPTER_REQUESTS_TO_EXAM'
      : results.every(item => item.state === 'SYNTHETIC_ADAPTER_FIXTURE_EXAM_PASSED_INSTRUMENT_ONLY')
        ? 'SYNTHETIC_ADAPTER_FIXTURE_EXAMS_PASSED_INSTRUMENT_ONLY'
        : 'SYNTHETIC_ADAPTER_FIXTURE_EXAMS_FAILED_KNOWN_FAIL',
    authority: {
      privateEvidenceTraceWrite: true,
      syntheticFixtureAuthoring: true,
      syntheticAdapterExecution: true,
      independentOutputPredicateEvaluation: true,
      nativeSourceExecution: false,
      realEvidenceAcquisition: false,
      adapterSelection: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      evidenceAdmission: false,
      evidenceRelabeling: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This independent examiner may author bounded synthetic fixtures, execute the pure generic envelope adapter against them, and apply separately authored output predicates. Passing proves instrument discrimination only. It does not execute a native capability source, adapt real evidence, select the adapter or a capability, claim operational fit or organ need, admit or relabel evidence, train, grant permission, promote, change canon, or act.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, handBatch, adapterRequestBatch, runDir, options = {}) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation adapter fixture-exam batch digest changed');
  const expectedId = `foundation-capability-output-adapter-fixture-exams-${digest({ organId: ORGAN_ID, source: batch.source, results: batch.results }).slice(0, 24)}`;
  if (batch.batchId !== expectedId) throw new Error('foundation adapter fixture-exam batch id changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.status !== STATUS || batch.organ.learnedWeights !== false || batch.organ.candidateAuthoredFixtures !== false || batch.organ.nativeSourceExecution !== false || batch.organ.adapterSelection !== false) throw new Error('foundation adapter fixture-exam organ boundary changed');
  if (!batch.source || batch.source.examinerSourcePath !== EXAMINER_SOURCE_PATH || batch.source.adapterOrganId !== EnvelopeAdapter.ORGAN_ID || batch.source.adapterSourcePath !== ADAPTER_SOURCE_PATH || batch.source.transportSourcePath !== TRANSPORT_SOURCE_PATH) throw new Error('foundation adapter fixture-exam source binding changed');
  if (!same(batch.summary, expectedSummary(batch.results || []))) throw new Error('foundation adapter fixture-exam summary changed');
  for (const result of batch.results || []) {
    if (!result.sourceState || result.sourceState.unchanged !== (result.sourceState.beforeDigest === result.sourceState.afterDigest)) throw new Error('foundation adapter fixture-exam source recovery changed');
    const passed = result.sourceState.unchanged && (result.caseResults || []).every(item => item.passed === (item.observed === item.expected) && item.passed);
    const expectedState = passed ? 'SYNTHETIC_ADAPTER_FIXTURE_EXAM_PASSED_INSTRUMENT_ONLY' : 'SYNTHETIC_ADAPTER_FIXTURE_EXAM_FAILED_KNOWN_FAIL';
    if (result.state !== expectedState) throw new Error('foundation adapter fixture-exam result state changed');
  }
  const allowedTrue = new Set(['privateEvidenceTraceWrite', 'syntheticFixtureAuthoring', 'syntheticAdapterExecution', 'independentOutputPredicateEvaluation']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => allowedTrue.has(key) ? value !== true : value !== false)) throw new Error('foundation adapter fixture-exam authority changed');
  if (batch.summary.realNativeArtifactsAdapted !== 0 || batch.summary.nativeSourcesExecuted !== 0 || batch.summary.adapterImplementationsSelected !== 0 || batch.summary.operationalFitsClaimed !== 0 || batch.summary.evidenceAdmissions !== 0 || batch.summary.evidenceRelabelings !== 0) throw new Error('foundation adapter fixture-exam evidence ceiling changed');
  if (handBatch && adapterRequestBatch && !same(buildBatch(handBatch, adapterRequestBatch, options), batch)) throw new Error('foundation adapter fixture-exam batch content changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation adapter fixture-exam batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const handBatch = loadCurrentHandBatch(options);
  const adapterRequestBatch = loadCurrentAdapterRequestBatch(options);
  const batch = buildBatch(handBatch, adapterRequestBatch, options);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, handBatch, adapterRequestBatch, runDir, options);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation adapter fixture-exam batch identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation adapter fixture-exam staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, handBatch, adapterRequestBatch, stageDir, options);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, STATUS, EXAMINER_SOURCE_PATH, ADAPTER_SOURCE_PATH, TRANSPORT_SOURCE_PATH, DEFAULT_HAND_STATE_DIR, DEFAULT_ADAPTER_REQUEST_STATE_DIR, DEFAULT_STATE_DIR,
  stable, digest, loadPolicy, loadCurrentHandBatch, loadCurrentAdapterRequestBatch, adapterSourceSha256,
  examinerSourceSha256, transportSourceSha256,
  fixtureInput, futureRequest, assertIndependentCandidate, observeCase, executeCases, executeRequestExam,
  expectedSummary, buildBatch, verifyBatch, run
};
