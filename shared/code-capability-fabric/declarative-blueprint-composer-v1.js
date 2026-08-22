'use strict';

const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Pilot = require('./slow-creation-pilot-v1');

const VERSION = '0.1.0';
const INTENT_SCHEMA = 'axm.fabric-declarative-blueprint-intent/v1';
const BLUEPRINT_SCHEMA = 'axm.fabric-declarative-capability-blueprint/v1';
const RECEIPT_SCHEMA = 'axm.fabric-blueprint-composition-receipt/v1';
const PROFILE_SCHEMA = 'axm.fabric-blueprint-composer-profile/v1';
const KIND = 'PURE_DATA_TRANSFORM';
const ACKNOWLEDGEMENT = 'ONE INERT BLUEPRINT ONLY';
const DECLARATION_ID = 'interactive-blueprint-composition-declaration';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const ROOT_PREFIX = 'axm-fabric-creation-pilot-blueprint-';
const MAX_INPUT_FIELDS = 16;
const MAX_OUTPUT_FIELDS = 16;
const MAX_STEPS = 16;
const MAX_QUALITY_CLAIMS = 16;
const MAX_COMPOSER_INPUT_BYTES = 32768;
const MAX_WRITTEN_FILES = 2;
const MAX_WRITTEN_BYTES = 65536;
const BLUEPRINT_FILE = 'capability-blueprint.json';
const RECEIPT_FILE = 'composition-receipt.json';
const FIELD_TYPES = Object.freeze(['array', 'boolean', 'integer', 'number', 'object', 'string']);
const STEP_OPERATIONS = Object.freeze(['ASSEMBLE', 'EMIT', 'FORMAT', 'SELECT', 'TRANSFORM', 'VALIDATE']);
const REQUIRED_ACTIONS = Object.freeze(['code.compose-inert-blueprint']);
const REQUIRED_PERMISSIONS = Object.freeze(['candidate.output-write']);
const REQUIRED_DATA_CLASSES = Object.freeze(['public-instruction']);
const REQUIRED_SOURCE_USES = Object.freeze(['derive-concepts']);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([RECEIPT_SCHEMA, BLUEPRINT_SCHEMA]);
const LIMITATIONS = Object.freeze([
  'INTERACTIVE_DECLARATION_NOT_CRYPTOGRAPHIC_IDENTITY_PROOF',
  'INTERACTIVE_DECLARATION_REPLAY_NOT_PREVENTED',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED_BY_COMPOSER',
  'DECLARED_DATA_CLASS_CONTENT_NOT_VERIFIED',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'DECLARATIVE_BLUEPRINT_ONLY',
  'SEMANTIC_BEHAVIOR_NOT_IMPLEMENTED',
  'GENERATED_EXECUTABLE_CODE_ABSENT',
  'RUNTIME_RESOURCE_BUDGETS_DECLARED_NOT_ENFORCED',
  'RUNTIME_QUALITY_NOT_PROVEN',
  'MACHINE_HOST_DEFAULT_NOT_ACTIVATED',
  'PERSISTENT_LEARNING_NOT_ADMITTED'
]);
const NEXT_GAPS = Object.freeze([
  'consent.human-decision.authenticate',
  'consent.declaration.replay-prevent',
  'consent.revocation.observe-live',
  'consent.trusted-clock.observe',
  'creation.blueprint-to-code.provider',
  'creation.semantic-candidate.generate',
  'creation.runtime-quality.verify',
  'learning.admission.decide'
]);
const PROFILE = Object.freeze({
  schema: PROFILE_SCHEMA,
  id: 'declarative-pure-data-blueprint-composer',
  version: VERSION,
  kind: KIND,
  maximumInputFields: MAX_INPUT_FIELDS,
  maximumOutputFields: MAX_OUTPUT_FIELDS,
  maximumSteps: MAX_STEPS,
  maximumQualityClaims: MAX_QUALITY_CLAIMS,
  maximumComposerInputBytes: MAX_COMPOSER_INPUT_BYTES,
  maximumWrittenFiles: MAX_WRITTEN_FILES,
  maximumWrittenBytes: MAX_WRITTEN_BYTES,
  sourceReads: 'DISABLED',
  network: 'DISABLED',
  childProcesses: 'DISABLED',
  generatedCodeExecution: 'DISABLED',
  outputScope: 'ONE_NEW_OWNED_ROOT',
  authority: 'DISPOSABLE_BLUEPRINT_WRITE_ONLY'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const CANDIDATE_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const TOKEN = /^[a-z][a-z0-9-]{0,63}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;

function canonicalJson(value) {
  return Fabric.canonicalJson(value);
}

function clone(value) {
  return Fabric.clone(value);
}

function sha256(value) {
  return Fabric.sha256(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = allowed.slice().sort(compareText);
  const missing = expected.filter((key) => !actual.includes(key));
  const extras = actual.filter((key) => !expected.includes(key));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.join(', '));
}

function strictText(value, label, maximum) {
  if (typeof value !== 'string' || !value.length || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be non-empty canonical text');
  }
  if (value.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return value;
}

function candidateId(value, label) {
  const result = strictText(value, label, 80);
  if (!CANDIDATE_ID.test(result)) throw new Error(label + ' is not a portable candidate identifier');
  return result;
}

function token(value, label) {
  const result = strictText(value, label, 64);
  if (!TOKEN.test(result)) throw new Error(label + ' is not a portable token');
  return result;
}

function contractToken(value, label) {
  const result = strictText(value, label, 180);
  if (!CONTRACT_TOKEN.test(result)) throw new Error(label + ' is not a portable contract token');
  return result;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) {
    throw new Error(label + ' must be a lowercase SHA-256 digest');
  }
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: contractToken(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function uniqueSorted(values, label, normalizer, minimum, maximum) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain from ' + minimum + ' through ' + maximum + ' items');
  }
  const normalized = values.map((value, index) => normalizer(value, label + '[' + index + ']'));
  normalized.sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  for (let index = 1; index < normalized.length; index += 1) {
    if (same(normalized[index - 1], normalized[index])) throw new Error(label + ' contains a duplicate');
  }
  return normalized;
}

function normalizeInputField(value, label) {
  exactKeys(value, ['id', 'type', 'required', 'description'], label);
  if (!FIELD_TYPES.includes(value.type)) throw new Error(label + '.type is unsupported');
  if (typeof value.required !== 'boolean') throw new Error(label + '.required must be boolean');
  return {
    id: token(value.id, label + '.id'),
    type: value.type,
    required: value.required,
    description: strictText(value.description, label + '.description', 240)
  };
}

function normalizeOutputField(value, label) {
  exactKeys(value, ['id', 'type', 'source', 'description'], label);
  if (!FIELD_TYPES.includes(value.type)) throw new Error(label + '.type is unsupported');
  return {
    id: token(value.id, label + '.id'),
    type: value.type,
    source: token(value.source, label + '.source'),
    description: strictText(value.description, label + '.description', 240)
  };
}

function normalizeStep(value, label) {
  exactKeys(value, ['id', 'operation', 'reads', 'produces', 'description'], label);
  if (!STEP_OPERATIONS.includes(value.operation)) throw new Error(label + '.operation is unsupported');
  return {
    id: token(value.id, label + '.id'),
    operation: value.operation,
    reads: uniqueSorted(value.reads, label + '.reads', token, 1, 16),
    produces: token(value.produces, label + '.produces'),
    description: strictText(value.description, label + '.description', 360)
  };
}

function normalizeResourceBudget(value) {
  const label = 'blueprint intent.resourceBudget';
  exactKeys(value, ['maxInputBytes', 'maxOutputBytes', 'maxDurationMs', 'maxMemoryBytes', 'maxOperations'], label);
  return {
    maxInputBytes: boundedInteger(value.maxInputBytes, label + '.maxInputBytes', 1, 65536),
    maxOutputBytes: boundedInteger(value.maxOutputBytes, label + '.maxOutputBytes', 1, 65536),
    maxDurationMs: boundedInteger(value.maxDurationMs, label + '.maxDurationMs', 1, 5000),
    maxMemoryBytes: boundedInteger(value.maxMemoryBytes, label + '.maxMemoryBytes', 1048576, 134217728),
    maxOperations: boundedInteger(value.maxOperations, label + '.maxOperations', 1, MAX_STEPS)
  };
}

function requireUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(label + ' contains duplicate id ' + item.id);
    ids.add(item.id);
  }
}

function validateCompositionGraph(inputFields, outputFields, steps, resourceBudget) {
  requireUniqueIds(inputFields, 'blueprint intent.inputFields');
  requireUniqueIds(outputFields, 'blueprint intent.outputFields');
  requireUniqueIds(steps, 'blueprint intent.steps');
  if (steps.length > resourceBudget.maxOperations) {
    throw new Error('blueprint intent steps exceed declared maxOperations');
  }
  const available = new Set(inputFields.map((field) => field.id));
  const produced = new Set();
  const used = new Set();
  for (const step of steps) {
    for (const read of step.reads) {
      if (!available.has(read)) throw new Error('blueprint intent step ' + step.id + ' reads unavailable token ' + read);
      used.add(read);
    }
    if (available.has(step.produces)) {
      throw new Error('blueprint intent step ' + step.id + ' overwrites token ' + step.produces);
    }
    available.add(step.produces);
    produced.add(step.produces);
  }
  for (const output of outputFields) {
    if (!available.has(output.source)) {
      throw new Error('blueprint intent output ' + output.id + ' has unavailable source ' + output.source);
    }
    used.add(output.source);
  }
  for (const producedToken of produced) {
    if (!used.has(producedToken)) throw new Error('blueprint intent has unused produced token ' + producedToken);
  }
  for (const field of inputFields) {
    if (!used.has(field.id)) throw new Error('blueprint intent has unused input field ' + field.id);
  }
}

function normalizeIntentCore(value) {
  exactKeys(value, [
    'schema', 'id', 'name', 'purpose', 'capability', 'status', 'kind',
    'inputFields', 'outputFields', 'steps', 'qualityClaims', 'resourceBudget', 'authority'
  ], 'blueprint intent');
  if (value.schema !== INTENT_SCHEMA) throw new Error('blueprint intent schema mismatch');
  if (value.status !== 'EXPERIMENTAL') throw new Error('blueprint intent status must remain EXPERIMENTAL');
  if (value.kind !== KIND) throw new Error('blueprint intent kind is unsupported');
  if (value.authority !== 'NONE') throw new Error('blueprint intent authority must remain NONE');
  if (!Array.isArray(value.inputFields) || !Array.isArray(value.outputFields)) {
    throw new Error('blueprint intent inputFields and outputFields must be arrays');
  }
  const inputFields = value.inputFields.map((item, index) => normalizeInputField(item, 'blueprint intent.inputFields[' + index + ']'));
  inputFields.sort((left, right) => compareText(left.id, right.id));
  const outputFields = value.outputFields.map((item, index) => normalizeOutputField(item, 'blueprint intent.outputFields[' + index + ']'));
  outputFields.sort((left, right) => compareText(left.id, right.id));
  if (!inputFields.length || inputFields.length > MAX_INPUT_FIELDS) throw new Error('blueprint intent input field count is outside the profile');
  if (!outputFields.length || outputFields.length > MAX_OUTPUT_FIELDS) throw new Error('blueprint intent output field count is outside the profile');
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.length > MAX_STEPS) {
    throw new Error('blueprint intent step count is outside the profile');
  }
  const steps = value.steps.map((item, index) => normalizeStep(item, 'blueprint intent.steps[' + index + ']'));
  const qualityClaims = uniqueSorted(
    value.qualityClaims,
    'blueprint intent.qualityClaims',
    (item, label) => strictText(item, label, 360),
    1,
    MAX_QUALITY_CLAIMS
  );
  const resourceBudget = normalizeResourceBudget(value.resourceBudget);
  validateCompositionGraph(inputFields, outputFields, steps, resourceBudget);
  return {
    schema: INTENT_SCHEMA,
    id: candidateId(value.id, 'blueprint intent.id'),
    name: strictText(value.name, 'blueprint intent.name', 120),
    purpose: strictText(value.purpose, 'blueprint intent.purpose', 600),
    capability: contractToken(value.capability, 'blueprint intent.capability'),
    status: 'EXPERIMENTAL',
    kind: KIND,
    inputFields,
    outputFields,
    steps,
    qualityClaims,
    resourceBudget,
    authority: 'NONE'
  };
}

function sealIntent(value) {
  const core = normalizeIntentCore(value);
  return { ...core, intentDigest: sha256(core) };
}

function normalizeIntent(value) {
  exactKeys(value, [
    'schema', 'id', 'name', 'purpose', 'capability', 'status', 'kind',
    'inputFields', 'outputFields', 'steps', 'qualityClaims', 'resourceBudget',
    'authority', 'intentDigest'
  ], 'blueprint intent');
  const { intentDigest, ...core } = value;
  const sealed = sealIntent(core);
  if (sealed.intentDigest !== digest(intentDigest, 'blueprint intent.intentDigest')) {
    throw new Error('blueprint intent digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('blueprint intent is not in canonical normalized form');
  return sealed;
}

function intentRef(value) {
  const intent = normalizeIntent(value);
  return { id: intent.id, schema: intent.schema, sha256: intent.intentDigest };
}

function profileRef() {
  return { id: PROFILE.id, schema: PROFILE.schema, sha256: sha256(PROFILE) };
}

function declarationRef() {
  const declaration = {
    mode: 'INTERACTIVE_SESSION_DECLARATION',
    scope: 'ONE_INERT_BLUEPRINT',
    acknowledgement: ACKNOWLEDGEMENT
  };
  return { id: DECLARATION_ID, schema: DECLARATION_SCHEMA, sha256: sha256(declaration) };
}

function normalizeAuthorization(value) {
  exactKeys(value, ['mode', 'scope', 'acknowledgement', 'instructionRef'], 'blueprint authorization');
  if (value.mode !== 'INTERACTIVE_SESSION_DECLARATION' || value.scope !== 'ONE_INERT_BLUEPRINT' ||
    value.acknowledgement !== ACKNOWLEDGEMENT) {
    throw new Error('blueprint authorization exact bounded declaration is required');
  }
  const normalized = {
    mode: value.mode,
    scope: value.scope,
    acknowledgement: value.acknowledgement,
    instructionRef: reference(value.instructionRef, 'blueprint authorization.instructionRef')
  };
  if (!same(normalized.instructionRef, declarationRef())) {
    throw new Error('blueprint authorization instruction reference does not bind the exact declaration');
  }
  return normalized;
}

function allFalseLifecycle(value) {
  return Consent.LIFECYCLE_FIELDS.every((field) => value[field] === false);
}

function prepare(input) {
  exactKeys(input, ['intent', 'consentEvaluationInput', 'consentEvaluation', 'authorization'], 'blueprint composition input');
  const intent = normalizeIntent(input.intent);
  const authorization = normalizeAuthorization(input.authorization);
  const evaluation = Consent.normalizeEvaluation(input.consentEvaluation);
  const verified = Consent.verifyEvaluation(evaluation, input.consentEvaluationInput);
  if (!verified.pass) throw new Error('grounded consent evaluation verification failed: ' + verified.errors.join('|'));
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope must be hold-free before the blueprint declaration');
  }
  const policy = Consent.normalizePolicy(input.consentEvaluationInput.policy);
  const instance = Consent.normalizeInstance(input.consentEvaluationInput.instance);
  if (!same(instance.subjectRef, intentRef(intent))) throw new Error('grounded consent subject does not bind the exact blueprint intent');
  if (instance.domain !== 'code') throw new Error('blueprint consent domain must be code');
  if (!same(instance.domainProfileRef, profileRef())) throw new Error('grounded consent domain profile does not bind the composer');
  if (!same(instance.actions, REQUIRED_ACTIONS)) throw new Error('blueprint action scope must be exact');
  if (!same(instance.permissions, REQUIRED_PERMISSIONS)) throw new Error('blueprint permission scope must be exact');
  if (instance.networkDomains.length) throw new Error('blueprint network must remain disabled');
  if (!same(instance.dataClasses, REQUIRED_DATA_CLASSES)) throw new Error('blueprint data class must be exact');
  if (!same(instance.sourceUses, REQUIRED_SOURCE_USES)) throw new Error('blueprint source use must be exact');
  if (!allFalseLifecycle(instance.lifecycle)) throw new Error('blueprint lifecycle effects must remain false');
  if (instance.inputArtifacts.length) throw new Error('blueprint composer cannot read input artifacts');
  if (!same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) throw new Error('blueprint evidence schemas must be exact');
  if (instance.resources.maxAttempts !== 1 || instance.resources.maxProcesses !== 1 ||
    instance.resources.maxCostMinorUnits !== 0 ||
    instance.resources.maxInputBytes > MAX_COMPOSER_INPUT_BYTES ||
    instance.resources.maxOutputBytes > MAX_WRITTEN_BYTES) {
    throw new Error('blueprint composer resource scope exceeds the fixed profile');
  }
  const composerInputBytes = Buffer.byteLength(canonicalJson(intent), 'utf8');
  if (composerInputBytes > instance.resources.maxInputBytes) throw new Error('blueprint intent exceeds consented input byte budget');
  return { intent, policy, instance, evaluation, authorization, composerInputBytes };
}

function acceptancePlan(intent) {
  return [
    {
      id: 'composition-graph-resolves',
      claim: 'Every declared step reads an available token, produces a unique token, and contributes to an output.',
      evidenceRequired: 'STRICT_COMPOSER_VALIDATION',
      status: 'COMPOSER_VALIDATED'
    },
    {
      id: 'declared-input-contract-holds',
      claim: 'A future implementation accepts only the declared input fields and types.',
      evidenceRequired: 'HELD_OUT_SCHEMA_AND_BOUNDARY_TESTS',
      status: 'PLANNED'
    },
    {
      id: 'declared-output-contract-holds',
      claim: 'A future implementation emits every declared output field with its declared type.',
      evidenceRequired: 'HELD_OUT_OUTPUT_VALIDATION',
      status: 'PLANNED'
    },
    {
      id: 'deterministic-replay-holds',
      claim: 'A future implementation emits byte-identical output for the same normalized input and version.',
      evidenceRequired: 'REPEAT_EXECUTION_WITH_EXACT_DIGEST_COMPARISON',
      status: 'PLANNED'
    },
    {
      id: 'runtime-resource-ceilings-hold',
      claim: 'A future implementation stays inside the declared duration, memory, input, output, and operation ceilings.',
      evidenceRequired: 'MEASURED_RUNTIME_TELEMETRY_UNDER_DECLARED_WORKLOAD',
      status: 'PLANNED'
    },
    {
      id: 'authority-boundary-holds',
      claim: 'A future implementation cannot use network, filesystem, child-process, install, promote, or CANON authority.',
      evidenceRequired: 'ALLOWED_AND_DENIED_AUTHORIZATION_BOUNDARY_TESTS',
      status: 'PLANNED'
    },
    {
      id: 'human-quality-review-holds',
      claim: 'The declared quality outcomes are useful and meaningful for the intended human purpose.',
      evidenceRequired: 'MIKE_OR_APPOINTED_HUMAN_REVIEW',
      status: 'PLANNED'
    }
  ];
}

function buildBlueprint(intentValue) {
  const intent = normalizeIntent(intentValue);
  const core = {
    schema: BLUEPRINT_SCHEMA,
    version: VERSION,
    id: intent.id,
    name: intent.name,
    purpose: intent.purpose,
    status: 'EXPERIMENTAL',
    kind: KIND,
    provides: [intent.capability],
    consumes: [],
    interface: {
      inputs: clone(intent.inputFields),
      outputs: clone(intent.outputFields)
    },
    composition: {
      steps: clone(intent.steps)
    },
    desiredOutcomes: intent.qualityClaims.map((claim) => ({ claim, status: 'UNPROVEN' })),
    resourceBudget: clone(intent.resourceBudget),
    permissions: [],
    rootsGate: Consent.ROOTS_GATE.slice(),
    acceptancePlan: acceptancePlan(intent),
    boundaries: {
      permits: ['pure-data-transformation', 'deterministic-formatting', 'reviewable-blueprint-handoff'],
      refuses: [
        'source-content-reading',
        'network-use',
        'filesystem-write',
        'child-process-execution',
        'generated-code-execution',
        'permission-grant',
        'automatic-install',
        'automatic-registration',
        'automatic-staging',
        'automatic-promotion',
        'automatic-canon',
        'persistent-learning-admission'
      ]
    },
    provenance: {
      intentRef: intentRef(intent),
      composerProfileRef: profileRef()
    },
    authority: 'NONE'
  };
  return { ...core, blueprintDigest: sha256(core) };
}

function normalizeBlueprint(value, intentValue) {
  const expected = buildBlueprint(intentValue);
  if (!same(value, expected)) throw new Error('capability blueprint does not match its exact sealed intent and composer profile');
  return expected;
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function evaluationRef(evaluation, intent) {
  return { id: intent.id + '-consent-evaluation', schema: evaluation.schema, sha256: evaluation.evaluationDigest };
}

function sealReceipt(core) {
  return { ...core, receiptDigest: sha256(core) };
}

function receiptWithStableByteLength(core, blueprintBytes) {
  let receiptBytes = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const withResources = {
      ...core,
      resourceObservation: {
        ...core.resourceObservation,
        receiptBytes,
        totalBytesWritten: blueprintBytes.length + receiptBytes
      }
    };
    const receipt = sealReceipt(withResources);
    const bytes = jsonBytes(receipt);
    if (bytes.length === receiptBytes) return { receipt, bytes };
    receiptBytes = bytes.length;
  }
  throw new Error('blueprint receipt byte length did not stabilize');
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'intentRef', 'consentEvaluationRef', 'instructionRef',
    'composerProfileRef', 'blueprintRef', 'artifactFiles', 'resourceObservation',
    'limitations', 'nextImprovementGaps', 'truth', 'authority', 'receiptDigest'
  ], 'blueprint composition receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || value.status !== 'BLUEPRINT_EMITTED_FOR_REVIEW') {
    throw new Error('blueprint composition receipt identity mismatch');
  }
  if (!same(value.limitations, LIMITATIONS) || !same(value.nextImprovementGaps, NEXT_GAPS)) {
    throw new Error('blueprint composition receipt limitations or gaps drifted');
  }
  if (value.authority !== 'DISPOSABLE_BLUEPRINT_WRITE_ONLY_USED') throw new Error('blueprint composition receipt authority mismatch');
  if (!Array.isArray(value.artifactFiles) || value.artifactFiles.length !== 1) {
    throw new Error('blueprint composition receipt must bind exactly one candidate artifact');
  }
  const artifact = value.artifactFiles[0];
  exactKeys(artifact, ['path', 'sha256', 'byteLength'], 'blueprint composition receipt.artifactFiles[0]');
  if (artifact.path !== BLUEPRINT_FILE) throw new Error('blueprint composition receipt artifact path mismatch');
  const normalizedArtifact = {
    path: BLUEPRINT_FILE,
    sha256: digest(artifact.sha256, 'blueprint composition receipt artifact digest'),
    byteLength: boundedInteger(artifact.byteLength, 'blueprint composition receipt artifact bytes', 1, MAX_WRITTEN_BYTES)
  };
  exactKeys(value.resourceObservation, [
    'composerInputBytes', 'blueprintBytes', 'receiptBytes', 'totalFilesWritten',
    'totalBytesWritten', 'inputByteCeilingEnforced', 'fileCountEnforced',
    'outputByteCeilingEnforced', 'operationCountEnforced', 'durationEnforced', 'memoryEnforced'
  ], 'blueprint composition receipt.resourceObservation');
  const resources = {
    composerInputBytes: boundedInteger(value.resourceObservation.composerInputBytes, 'receipt composer input bytes', 1, MAX_COMPOSER_INPUT_BYTES),
    blueprintBytes: normalizedArtifact.byteLength,
    receiptBytes: boundedInteger(value.resourceObservation.receiptBytes, 'receipt bytes', 1, MAX_WRITTEN_BYTES),
    totalFilesWritten: MAX_WRITTEN_FILES,
    totalBytesWritten: normalizedArtifact.byteLength + value.resourceObservation.receiptBytes,
    inputByteCeilingEnforced: true,
    fileCountEnforced: true,
    outputByteCeilingEnforced: true,
    operationCountEnforced: true,
    durationEnforced: false,
    memoryEnforced: false
  };
  if (!same(resources, value.resourceObservation) || resources.totalBytesWritten > MAX_WRITTEN_BYTES) {
    throw new Error('blueprint composition receipt resource observation mismatch');
  }
  const truthFields = [
    'fabricFirstGateApplied', 'interactiveDeclarationSupplied', 'interactiveDeclarationReplayPrevented',
    'cryptographicHumanAuthenticationVerified', 'predecisionEvidenceContentVerified', 'trustedClockObserved',
    'declaredDataClassContentVerified', 'liveRevocationChecked', 'composerWriteAuthorityUsed', 'fabricGrantedAuthority', 'intentBytesValidated',
    'compositionGraphValidated', 'blueprintWritten', 'blueprintReadBack', 'receiptWritten', 'receiptReadBack',
    'sourceContentRead', 'networkUsed', 'childProcessSpawned', 'generatedExecutableCodePresent',
    'candidateCodeExecuted', 'runtimeQualityProven', 'machineDefaultActivated', 'persistentLearningAdmitted',
    'installed', 'registered', 'staged', 'promoted', 'canonChanged', 'filesRetained'
  ];
  exactKeys(value.truth, truthFields, 'blueprint composition receipt.truth');
  const expectedTrue = new Set([
    'fabricFirstGateApplied', 'interactiveDeclarationSupplied', 'composerWriteAuthorityUsed',
    'intentBytesValidated', 'compositionGraphValidated', 'blueprintWritten', 'blueprintReadBack',
    'receiptWritten', 'receiptReadBack', 'filesRetained'
  ]);
  for (const field of truthFields) {
    if (value.truth[field] !== expectedTrue.has(field)) {
      throw new Error('blueprint composition receipt.truth.' + field + ' violates the truth ceiling');
    }
  }
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: 'BLUEPRINT_EMITTED_FOR_REVIEW',
    intentRef: reference(value.intentRef, 'receipt.intentRef'),
    consentEvaluationRef: reference(value.consentEvaluationRef, 'receipt.consentEvaluationRef'),
    instructionRef: reference(value.instructionRef, 'receipt.instructionRef'),
    composerProfileRef: reference(value.composerProfileRef, 'receipt.composerProfileRef'),
    blueprintRef: reference(value.blueprintRef, 'receipt.blueprintRef'),
    artifactFiles: [normalizedArtifact],
    resourceObservation: resources,
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: clone(value.truth),
    authority: 'DISPOSABLE_BLUEPRINT_WRITE_ONLY_USED'
  };
  if (core.intentRef.schema !== INTENT_SCHEMA || core.blueprintRef.schema !== BLUEPRINT_SCHEMA ||
    core.blueprintRef.id !== core.intentRef.id) {
    throw new Error('blueprint composition receipt artifact lineage mismatch');
  }
  if (core.consentEvaluationRef.id !== core.intentRef.id + '-consent-evaluation' ||
    core.consentEvaluationRef.schema !== Consent.EVALUATION_SCHEMA) {
    throw new Error('blueprint composition receipt consent lineage mismatch');
  }
  if (!same(core.instructionRef, declarationRef()) || !same(core.composerProfileRef, profileRef())) {
    throw new Error('blueprint composition receipt instruction or profile lineage mismatch');
  }
  const receiptDigest = digest(value.receiptDigest, 'blueprint composition receipt.receiptDigest');
  if (sha256(core) !== receiptDigest) throw new Error('blueprint composition receipt digest mismatch');
  const normalized = { ...core, receiptDigest };
  if (!same(normalized, value)) throw new Error('blueprint composition receipt is not canonical');
  if (jsonBytes(normalized).length !== resources.receiptBytes) throw new Error('blueprint composition receipt byte observation mismatch');
  return normalized;
}

function verifyReceiptArtifacts(receiptValue, blueprintBytesValue, intentValue) {
  const receipt = normalizeReceipt(receiptValue);
  if (!Buffer.isBuffer(blueprintBytesValue)) throw new Error('blueprint artifact bytes must be a Buffer');
  const artifact = receipt.artifactFiles[0];
  if (blueprintBytesValue.length !== artifact.byteLength || sha256(blueprintBytesValue) !== artifact.sha256) {
    throw new Error('blueprint artifact file bytes do not match the receipt');
  }
  let parsed;
  try {
    parsed = JSON.parse(blueprintBytesValue.toString('utf8'));
  } catch (error) {
    throw new Error('blueprint artifact is not valid UTF-8 JSON');
  }
  const blueprint = normalizeBlueprint(parsed, intentValue);
  if (receipt.blueprintRef.id !== blueprint.id || receipt.blueprintRef.schema !== blueprint.schema ||
    receipt.blueprintRef.sha256 !== blueprint.blueprintDigest) {
    throw new Error('blueprint object digest does not match the receipt');
  }
  if (receipt.intentRef.sha256 !== blueprint.provenance.intentRef.sha256 ||
    receipt.composerProfileRef.sha256 !== blueprint.provenance.composerProfileRef.sha256) {
    throw new Error('blueprint provenance does not match receipt lineage');
  }
  return { receipt, blueprint };
}

function ensureFreshOwnedRoot(boundary) {
  fs.mkdirSync(boundary.root);
  const stat = fs.lstatSync(boundary.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(boundary.root) !== boundary.root) {
    throw new Error('blueprint output root changed identity after creation');
  }
}

function safeCleanupOwnedRoot(boundary) {
  if (!fs.existsSync(boundary.root)) return;
  const stat = fs.lstatSync(boundary.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(boundary.root) !== boundary.parent) {
    throw new Error('refusing cleanup because blueprint output root identity changed');
  }
  const allowedFiles = new Set([BLUEPRINT_FILE, RECEIPT_FILE]);
  const entries = fs.readdirSync(boundary.root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !allowedFiles.has(entry.name))) {
    throw new Error('refusing cleanup because blueprint output root contains an unexpected entry');
  }
  for (const entry of entries) fs.unlinkSync(path.join(boundary.root, entry.name));
  fs.rmdirSync(boundary.root);
}

function emit(input, options) {
  const prepared = prepare(input);
  exactKeys(options, ['allowedParent', 'rootName', 'faultAt'], 'blueprint composition options');
  const faultAt = options.faultAt == null ? null : String(options.faultAt);
  if (faultAt !== null && faultAt !== 'AFTER_BLUEPRINT' && faultAt !== 'AFTER_RECEIPT') {
    throw new Error('blueprint composition fault injection is unsupported');
  }
  if (typeof options.rootName !== 'string' || !options.rootName.startsWith(ROOT_PREFIX)) {
    throw new Error('blueprint output root name must use the fixed blueprint prefix');
  }
  const boundary = Pilot.validateNewRoot(options.allowedParent, options.rootName);
  const blueprint = buildBlueprint(prepared.intent);
  const blueprintBytes = jsonBytes(blueprint);
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: 'BLUEPRINT_EMITTED_FOR_REVIEW',
    intentRef: intentRef(prepared.intent),
    consentEvaluationRef: evaluationRef(prepared.evaluation, prepared.intent),
    instructionRef: prepared.authorization.instructionRef,
    composerProfileRef: profileRef(),
    blueprintRef: { id: blueprint.id, schema: blueprint.schema, sha256: blueprint.blueprintDigest },
    artifactFiles: [{ path: BLUEPRINT_FILE, sha256: sha256(blueprintBytes), byteLength: blueprintBytes.length }],
    resourceObservation: {
      composerInputBytes: prepared.composerInputBytes,
      blueprintBytes: blueprintBytes.length,
      totalFilesWritten: MAX_WRITTEN_FILES,
      inputByteCeilingEnforced: true,
      fileCountEnforced: true,
      outputByteCeilingEnforced: true,
      operationCountEnforced: true,
      durationEnforced: false,
      memoryEnforced: false
    },
    limitations: LIMITATIONS.slice(),
    nextImprovementGaps: NEXT_GAPS.slice(),
    truth: {
      fabricFirstGateApplied: true,
      interactiveDeclarationSupplied: true,
      interactiveDeclarationReplayPrevented: false,
      cryptographicHumanAuthenticationVerified: false,
      predecisionEvidenceContentVerified: false,
      declaredDataClassContentVerified: false,
      trustedClockObserved: false,
      liveRevocationChecked: false,
      composerWriteAuthorityUsed: true,
      fabricGrantedAuthority: false,
      intentBytesValidated: true,
      compositionGraphValidated: true,
      blueprintWritten: true,
      blueprintReadBack: true,
      receiptWritten: true,
      receiptReadBack: true,
      sourceContentRead: false,
      networkUsed: false,
      childProcessSpawned: false,
      generatedExecutableCodePresent: false,
      candidateCodeExecuted: false,
      runtimeQualityProven: false,
      machineDefaultActivated: false,
      persistentLearningAdmitted: false,
      installed: false,
      registered: false,
      staged: false,
      promoted: false,
      canonChanged: false,
      filesRetained: true
    },
    authority: 'DISPOSABLE_BLUEPRINT_WRITE_ONLY_USED'
  };
  const sealed = receiptWithStableByteLength(core, blueprintBytes);
  if (sealed.receipt.resourceObservation.totalBytesWritten > prepared.instance.resources.maxOutputBytes) {
    throw new Error('blueprint output exceeds consented output byte budget');
  }
  let rootCreated = false;
  try {
    ensureFreshOwnedRoot(boundary);
    rootCreated = true;
    fs.writeFileSync(path.join(boundary.root, BLUEPRINT_FILE), blueprintBytes, { flag: 'wx' });
    if (faultAt === 'AFTER_BLUEPRINT') throw new Error('bounded injected blueprint composition fault');
    fs.writeFileSync(path.join(boundary.root, RECEIPT_FILE), sealed.bytes, { flag: 'wx' });
    if (faultAt === 'AFTER_RECEIPT') throw new Error('bounded injected blueprint composition fault');
    const blueprintReadback = fs.readFileSync(path.join(boundary.root, BLUEPRINT_FILE));
    const receiptReadback = fs.readFileSync(path.join(boundary.root, RECEIPT_FILE));
    if (!blueprintReadback.equals(blueprintBytes) || !receiptReadback.equals(sealed.bytes)) {
      throw new Error('blueprint composition readback byte drift');
    }
    verifyReceiptArtifacts(JSON.parse(receiptReadback.toString('utf8')), blueprintReadback, prepared.intent);
    return { blueprint, receipt: sealed.receipt };
  } catch (error) {
    if (rootCreated) safeCleanupOwnedRoot(boundary);
    throw error;
  }
}

function buildExampleInput() {
  const intent = sealIntent({
    schema: INTENT_SCHEMA,
    id: 'bounded-code-change-proposal',
    name: 'Bounded Code Change Proposal',
    purpose: 'Compose one inert, reviewable capability blueprint from a request, declared capabilities, and known failures without creating or executing implementation code.',
    capability: 'code.change-proposal.compose',
    status: 'EXPERIMENTAL',
    kind: KIND,
    inputFields: [
      { id: 'capability-catalog', type: 'array', required: true, description: 'Declared provider-neutral capabilities available for composition.' },
      { id: 'change-request', type: 'object', required: true, description: 'One bounded human-directed code improvement request.' },
      { id: 'known-failures', type: 'array', required: true, description: 'Preserved failures and counterevidence relevant to the request.' }
    ],
    outputFields: [
      { id: 'candidate-specification', type: 'object', source: 'candidate-specification', description: 'An inert proposal containing interfaces, boundaries, tests, and unresolved gaps.' }
    ],
    steps: [
      { id: 'validate-request', operation: 'VALIDATE', reads: ['change-request'], produces: 'validated-request', description: 'Reject malformed, unbounded, or authority-expanding requests.' },
      { id: 'select-capabilities', operation: 'SELECT', reads: ['capability-catalog', 'validated-request'], produces: 'selected-capabilities', description: 'Select only exactly declared compatible capabilities; ambiguity remains a hold.' },
      { id: 'bind-failures', operation: 'ASSEMBLE', reads: ['known-failures', 'selected-capabilities'], produces: 'evidence-bound-route', description: 'Bind known failures and counterevidence to the proposed route.' },
      { id: 'emit-specification', operation: 'EMIT', reads: ['evidence-bound-route'], produces: 'candidate-specification', description: 'Emit an inert specification for later human review and separate implementation.' }
    ],
    qualityClaims: [
      'The proposal identifies verification before implementation.',
      'The proposal preserves all four AXM roots and leaves merge authority with Mike.',
      'The proposal preserves unresolved failures instead of hiding them.'
    ],
    resourceBudget: {
      maxInputBytes: 32768,
      maxOutputBytes: 32768,
      maxDurationMs: 1000,
      maxMemoryBytes: 67108864,
      maxOperations: 4
    },
    authority: 'NONE'
  });
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'blueprint-composition-test-settings',
    validFrom: '2026-08-22T00:00:00.000Z',
    expiresAt: '2026-08-23T00:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [INTENT_SCHEMA],
      domainProfileSchemas: [PROFILE_SCHEMA],
      allowedActions: REQUIRED_ACTIONS.slice(),
      allowedPermissions: REQUIRED_PERMISSIONS.slice(),
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: {
        maxInputBytes: MAX_COMPOSER_INPUT_BYTES,
        maxOutputBytes: MAX_WRITTEN_BYTES,
        maxMemoryBytes: 134217728,
        maxDurationMs: 5000,
        maxProcesses: 1,
        maxAttempts: 1,
        maxCostMinorUnits: 0
      },
      requiredPredecisionEvidenceSchemas: ['axm.code-policy-bound-assurance-review/v1'],
      requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice()
    }],
    rootsGate: Consent.ROOTS_GATE.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'blueprint-composition-test-instance',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: intentRef(intent),
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'four-root-blueprint-policy-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256('blueprint-composition-predecision-review-placeholder')
    }],
    inputArtifacts: [],
    actions: REQUIRED_ACTIONS.slice(),
    permissions: REQUIRED_PERMISSIONS.slice(),
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources: {
      maxInputBytes: MAX_COMPOSER_INPUT_BYTES,
      maxOutputBytes: MAX_WRITTEN_BYTES,
      maxMemoryBytes: 134217728,
      maxDurationMs: 5000,
      maxProcesses: 1,
      maxAttempts: 1,
      maxCostMinorUnits: 0
    },
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T02:20:00.000Z',
    expiresAt: '2026-08-22T03:20:00.000Z',
    authority: 'NONE'
  });
  const consentEvaluationInput = { policy, instance, evaluatedAt: '2026-08-22T02:25:00.000Z' };
  return {
    intent,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput),
    authorization: {
      mode: 'INTERACTIVE_SESSION_DECLARATION',
      scope: 'ONE_INERT_BLUEPRINT',
      acknowledgement: ACKNOWLEDGEMENT,
      instructionRef: declarationRef()
    }
  };
}

module.exports = {
  VERSION,
  INTENT_SCHEMA,
  BLUEPRINT_SCHEMA,
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  KIND,
  ACKNOWLEDGEMENT,
  DECLARATION_ID,
  DECLARATION_SCHEMA,
  ROOT_PREFIX,
  MAX_INPUT_FIELDS,
  MAX_OUTPUT_FIELDS,
  MAX_STEPS,
  MAX_QUALITY_CLAIMS,
  MAX_COMPOSER_INPUT_BYTES,
  MAX_WRITTEN_FILES,
  MAX_WRITTEN_BYTES,
  BLUEPRINT_FILE,
  RECEIPT_FILE,
  FIELD_TYPES,
  STEP_OPERATIONS,
  REQUIRED_ACTIONS,
  REQUIRED_PERMISSIONS,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  LIMITATIONS,
  NEXT_GAPS,
  PROFILE,
  canonicalJson,
  sha256,
  sealIntent,
  normalizeIntent,
  intentRef,
  profileRef,
  declarationRef,
  prepare,
  buildBlueprint,
  normalizeBlueprint,
  emit,
  normalizeReceipt,
  verifyReceiptArtifacts,
  buildExampleInput
};
