'use strict';

const crypto = require('crypto');
const Consent = require('./grounded-consent-scope-v1');
const Planner = require('./code-recipe-application-planner-v1');
const Semantic = require('./semantic-candidate-generator-v1');
const MODULE_CONTRACT = require('./module-native-game-rule-candidate-generator-v1.contract.json');

const VERSION = '1.4.0';
const REQUEST_SCHEMA = 'axm.native-game-rule-candidate-request/v1';
const PACKET_SCHEMA = 'axm.native-game-rule-candidate-packet/v1';
const MODE = 'NATIVE_IN_MEMORY_DRAFT';
const CONSENT_ACTION = 'code.generate-inert-native-game-rule-candidate';
const GENERATOR_ID = 'axm-native-game-rule-candidate-generator';
const NEXT_GATE = 'AUTHENTICATE_EXACT_CANDIDATE_BYTES_BEFORE_NURSERY_WRITE';
const INPUT_SCHEMA = 'axm.bounded-game-rule-input/v1';
const OUTPUT_SCHEMA = 'axm.bounded-game-rule-result/v1';
const APPLICATION_SCHEMA = 'axm.native-game-rule-recipe-application/v1';
const ROOTS = Consent.ROOTS_GATE.slice();
const MAX_REQUEST_BYTES = 524288;
const MAX_OUTPUT_BYTES = 524288;
const REQUIRED_FILES = Object.freeze([
  'README.md',
  'adapter.js',
  'candidate.receipt.json',
  'game-rule-input.schema.json',
  'game-rule-result.schema.json',
  'manifest.json',
  'module.contract.json',
  'recipe-application.json',
  'test-plan.json'
]);
const REQUIRED_DATA_CLASSES = Object.freeze(['public-blueprint', 'public-recipe-metadata']);
const REQUIRED_SOURCE_USES = Object.freeze([
  'derive-concepts',
  'independent-native-implementation',
  'reference-metadata-only'
]);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  PACKET_SCHEMA,
  'axm.determinism-evidence/v1',
  'axm.four-root-technical-review/v1',
  'axm.static-structure-evidence/v1'
].sort(compareText));
const LIMITATIONS = Object.freeze([
  'ARBITRARY_BLUEPRINT_GENERATION_NOT_SUPPORTED',
  'ARBITRARY_RECIPE_APPLICATION_NOT_SUPPORTED',
  'ATLAS_SOURCE_AND_LICENSE_CLAIMS_UNVERIFIED',
  'ATLAS_SOURCE_BYTES_NOT_INCLUDED',
  'AUTHENTICATED_HUMAN_DECISION_NOT_VERIFIED',
  'CANDIDATE_CODE_NOT_EXECUTED',
  'CANDIDATE_DIRECT_REUSE_RIGHTS_HELD',
  'CANDIDATE_TESTS_NOT_RUN',
  'CORRECTNESS_NOT_PROVEN',
  'DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_REVERIFIED',
  'HOST_AUTHORIZATION_NOT_GRANTED',
  'INFORMED_UNDERSTANDING_NOT_PROVEN',
  'INSTALLATION_NOT_AUTHORIZED',
  'INTEGRATION_NOT_AUTHORIZED',
  'MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'NATURAL_PERSON_IDENTITY_NOT_PROVEN',
  'PERSISTENT_LEARNING_NOT_AUTHORIZED',
  'PROMOTION_NOT_AUTHORIZED',
  'PUBLICATION_NOT_AUTHORIZED',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'SAFETY_NOT_PROVEN',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'CANON_CHANGE_NOT_AUTHORIZED'
].sort(compareText));
const DECLARATION = Object.freeze({
  schema: 'axm.interactive-authorization-declaration/v1',
  id: 'native-game-rule-candidate-interactive-declaration',
  scope: 'ONE_IN_MEMORY_INERT_GAME_RULE_CANDIDATE_DRAFT',
  acknowledgement: 'Create one deterministic candidate draft as in-memory data only. Do not run candidate code or tests, write a candidate root, install, integrate, publish, learn, promote, or change CANON.',
  authority: 'NONE'
});

const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function canonicalJson(value) { return Semantic.canonicalJson(value); }
function clone(value) { return Semantic.clone(value); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function sha256Value(value) { return Semantic.sha256Value(value); }
function sha256Bytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function jsonBytes(value) { return Semantic.jsonBytes(value); }
function fail(message) { throw new Error(message); }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(label + ' must be a plain object');
  }
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  if (!same(Object.keys(value).sort(compareText), fields.slice().sort(compareText))) {
    fail(label + ' fields must be exactly ' + fields.slice().sort(compareText).join(', '));
  }
  return value;
}

function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) fail(label + ' must be a portable identifier');
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function reference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  if (!ID.test(value.id) || typeof value.schema !== 'string' || !value.schema.length || value.schema.length > 220 ||
      !DIGEST.test(value.sha256)) fail(label + ' is invalid');
  return clone(value);
}

function uniqueRefs(values, label, minimum, maximum) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    fail(label + ' must contain from ' + minimum + ' to ' + maximum + ' references');
  }
  const refs = values.map((value, index) => reference(value, label + '[' + index + ']'))
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(refs.map(canonicalJson)).size !== refs.length) fail(label + ' contains duplicate references');
  return refs;
}

function moduleRef() {
  return { id: MODULE_CONTRACT.id, schema: MODULE_CONTRACT.schema, sha256: sha256Value(MODULE_CONTRACT) };
}

function declarationRef() {
  return { id: DECLARATION.id, schema: DECLARATION.schema, sha256: sha256Value(DECLARATION) };
}

function artifactRef(id, schema, digest, value) {
  return { id, schema, sha256: digest, byteLength: jsonBytes(value).length };
}

function evaluationRef(requestId, evaluation) {
  return { id: requestId + '-consent-evaluation', schema: evaluation.schema, sha256: evaluation.evaluationDigest };
}

function normalizeResources(value) {
  exact(value, [
    'maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs',
    'maxProcesses', 'maxAttempts', 'maxCostMinorUnits'
  ], 'resourceEnvelope');
  const resources = {
    maxInputBytes: integer(value.maxInputBytes, 'resourceEnvelope.maxInputBytes', 1, MAX_REQUEST_BYTES),
    maxOutputBytes: integer(value.maxOutputBytes, 'resourceEnvelope.maxOutputBytes', 1, MAX_OUTPUT_BYTES),
    maxMemoryBytes: integer(value.maxMemoryBytes, 'resourceEnvelope.maxMemoryBytes', 1, 1073741824),
    maxDurationMs: integer(value.maxDurationMs, 'resourceEnvelope.maxDurationMs', 1, 60000),
    maxProcesses: value.maxProcesses,
    maxAttempts: value.maxAttempts,
    maxCostMinorUnits: value.maxCostMinorUnits
  };
  if (resources.maxProcesses !== 1 || resources.maxAttempts !== 1 || resources.maxCostMinorUnits !== 0) {
    fail('native candidate generation supports one in-process attempt and zero cost only');
  }
  return resources;
}

function validateSupportedPlan(plan) {
  const intent = plan.applicationRequest.intent;
  const blueprint = plan.applicationRequest.blueprint;
  const inputShape = intent.inputFields.map((field) => ({ id: field.id, type: field.type, required: field.required }));
  const outputShape = intent.outputFields.map((field) => ({ id: field.id, type: field.type, source: field.source }));
  const stepShape = blueprint.composition.steps.map((step) => ({
    id: step.id,
    operation: step.operation,
    reads: step.reads,
    produces: step.produces
  }));
  const expectedInputs = [
    { id: 'encounter-state', type: 'object', required: true },
    { id: 'requested-actions', type: 'array', required: true },
    { id: 'rule-table', type: 'array', required: true }
  ];
  const expectedOutputs = [
    { id: 'game-rule-result', type: 'object', source: 'game-rule-result' }
  ];
  const expectedSteps = [
    { id: 'validate-state', operation: 'VALIDATE', reads: ['encounter-state', 'requested-actions', 'rule-table'], produces: 'validated-input' },
    { id: 'filter-allowed-actions', operation: 'SELECT', reads: ['requested-actions', 'rule-table', 'validated-input'], produces: 'allowed-actions' },
    { id: 'map-action-outcomes', operation: 'TRANSFORM', reads: ['allowed-actions', 'rule-table', 'validated-input'], produces: 'mapped-outcomes' },
    { id: 'assemble-result', operation: 'ASSEMBLE', reads: ['allowed-actions', 'mapped-outcomes', 'validated-input'], produces: 'assembled-result' },
    { id: 'emit-result', operation: 'EMIT', reads: ['assembled-result'], produces: 'game-rule-result' }
  ];
  const bindingShape = plan.applicationRecords.map((record) => ({
    sourceId: record.sourceId,
    targetStepId: record.requesterMapping.targetStepId,
    blueprintOperation: record.requesterMapping.blueprintOperation,
    nativeOperation: record.requesterMapping.nativeOperation
  }));
  const expectedBindings = [
    { sourceId: 'CC-0054', targetStepId: 'map-action-outcomes', blueprintOperation: 'TRANSFORM', nativeOperation: 'MAP_VALUES' },
    { sourceId: 'CC-0055', targetStepId: 'filter-allowed-actions', blueprintOperation: 'SELECT', nativeOperation: 'FILTER_VALUES' }
  ];
  if (intent.kind !== 'PURE_DATA_TRANSFORM' || intent.capability !== OUTPUT_SCHEMA ||
      !same(blueprint.provides, [OUTPUT_SCHEMA]) || !same(inputShape, expectedInputs) ||
      !same(outputShape, expectedOutputs) || !same(stepShape, expectedSteps) || !same(bindingShape, expectedBindings)) {
    fail('CAPABILITY_GAP:application plan is not the one supported bounded game-rule shape');
  }
  if (plan.candidate !== null || plan.truth.candidateGenerated !== false || plan.truth.testsRun !== false ||
      plan.consentGate.authenticatedHumanDecisionVerified !== false || plan.consentGate.hostAuthorizationGranted !== false) {
    fail('application plan exceeds its plan-only truth or authority ceiling');
  }
  if (plan.applicationRecords.some((record) => record.sourceTreatment.mode !== 'METADATA_REFERENCE_ONLY' ||
      record.sourceTreatment.snippetBytesEmitted || record.sourceTreatment.snippetBytesCopied ||
      record.sourceTreatment.snippetBytesApplied || record.sourceTreatment.snippetExecuted ||
      record.sourceTreatment.directReuseAllowed)) {
    fail('application plan may provide Atlas metadata references only');
  }
}

function normalizeConsent(value, requestId, plan, resources) {
  exact(value, ['evaluationInput', 'evaluation'], 'consent');
  exact(value.evaluationInput, ['policy', 'instance', 'evaluatedAt'], 'consent.evaluationInput');
  const verification = Consent.verifyEvaluation(value.evaluation, value.evaluationInput);
  if (!verification.pass) fail('grounded consent evaluation verification failed: ' + verification.errors.join('|'));
  const policy = Consent.normalizePolicy(value.evaluationInput.policy);
  const instance = Consent.normalizeInstance(value.evaluationInput.instance);
  const evaluation = Consent.normalizeEvaluation(value.evaluation);
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' || evaluation.holds.length ||
      evaluation.truth.authenticatedHumanDecisionVerified !== false) {
    fail('native candidate generation requires valid scope with exact human authentication still outstanding');
  }
  const pRef = Planner.planRef(plan);
  if (!same(instance.subjectRef, pRef) || !same(instance.domainProfileRef, moduleRef()) ||
      !same(instance.predecisionEvidenceRefs, [pRef])) {
    fail('generation consent does not bind the exact application plan and generator contract');
  }
  if (!same(instance.inputArtifacts, [artifactRef(plan.id, plan.schema, plan.planDigest, plan)])) {
    fail('generation consent does not bind the exact application plan bytes');
  }
  if (instance.domain !== 'code' || !same(instance.actions, [CONSENT_ACTION]) || instance.permissions.length ||
      instance.networkDomains.length || !same(instance.dataClasses, REQUIRED_DATA_CLASSES) ||
      !same(instance.sourceUses, REQUIRED_SOURCE_USES) || !same(instance.resources, resources) ||
      !same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) {
    fail('generation consent scope differs from the fixed permissionless native draft contract');
  }
  if (Object.values(instance.lifecycle).some(Boolean)) fail('generation consent cannot grant lifecycle authority');
  if (!same(instance.reconsentTriggers, Consent.MANDATORY_RECONSENT_TRIGGERS.slice().sort(compareText)) ||
      !same(instance.stopConditions, Consent.MANDATORY_STOP_CONDITIONS.slice().sort(compareText))) {
    fail('generation consent does not preserve mandatory re-consent and stop conditions');
  }
  return { evaluationInput: { policy, instance, evaluatedAt: value.evaluationInput.evaluatedAt }, evaluation };
}

function requestCore(value) {
  exact(value, ['schema', 'id', 'tier', 'mode', 'applicationPlan', 'consent', 'resourceEnvelope', 'instructionRef', 'authority'], 'native game-rule candidate request');
  if (value.schema !== REQUEST_SCHEMA || value.tier !== 1 || value.mode !== MODE || value.authority !== 'NONE') {
    fail('native game-rule candidate request identity, tier, mode, or authority mismatch');
  }
  const id = identifier(value.id, 'native game-rule candidate request.id');
  const plan = Planner.normalizePlan(value.applicationPlan);
  validateSupportedPlan(plan);
  const resources = normalizeResources(value.resourceEnvelope);
  if (!same(value.instructionRef, declarationRef())) fail('native game-rule candidate instruction declaration mismatch');
  const core = {
    schema: REQUEST_SCHEMA,
    id,
    tier: 1,
    mode: MODE,
    applicationPlan: plan,
    consent: null,
    resourceEnvelope: resources,
    instructionRef: declarationRef(),
    authority: 'NONE'
  };
  core.consent = normalizeConsent(value.consent, id, plan, resources);
  if (jsonBytes(core).length > resources.maxInputBytes || jsonBytes(core).length > MAX_REQUEST_BYTES) {
    fail('native game-rule candidate request exceeds its exact input byte ceiling');
  }
  return core;
}

function sealRequest(value) {
  const core = requestCore(value);
  const sealed = { ...core, requestDigest: sha256Value(core) };
  if (jsonBytes(sealed).length > sealed.resourceEnvelope.maxInputBytes) {
    fail('sealed native game-rule candidate request exceeds its exact input byte ceiling');
  }
  return sealed;
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'tier', 'mode', 'applicationPlan', 'consent', 'resourceEnvelope', 'instructionRef', 'authority', 'requestDigest'], 'native game-rule candidate request');
  const copy = clone(value);
  delete copy.requestDigest;
  const expected = sealRequest(copy);
  if (value.requestDigest !== expected.requestDigest || !same(value, expected)) {
    fail('native game-rule candidate request digest or canonical form mismatch');
  }
  return expected;
}

function sourceFile(path, bytes) {
  return {
    path: Semantic.normalizePortablePath(path),
    encoding: 'base64',
    content: bytes.toString('base64'),
    sha256: sha256Bytes(bytes).slice('sha256:'.length)
  };
}

function gameRuleSource() {
  return Buffer.from(`'use strict';

const ACTION = /^[a-z][a-z0-9-]{0,63}$/;

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' must be an object');
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = fields.slice().sort(compareText);
  if (actual.length !== expected.length || actual.some(function (field, index) { return field !== expected[index]; })) {
    throw new TypeError(label + ' fields are invalid');
  }
}

function action(value, label) {
  if (typeof value !== 'string' || !ACTION.test(value)) throw new TypeError(label + ' must be a bounded action id');
  return value;
}

function outcome(value, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 160 || /[\\u0000-\\u001f\\u007f]/.test(value)) {
    throw new TypeError(label + ' must be bounded text');
  }
  return value;
}

function applyGameRule(input) {
  exact(input, ['schema', 'encounterState', 'requestedActions', 'ruleTable'], 'game-rule input');
  if (input.schema !== 'axm.bounded-game-rule-input/v1') throw new TypeError('game-rule input schema is unsupported');
  exact(input.encounterState, ['id', 'turn'], 'encounterState');
  const encounterId = action(input.encounterState.id, 'encounterState.id');
  if (!Number.isSafeInteger(input.encounterState.turn) || input.encounterState.turn < 0 || input.encounterState.turn > 1000000) {
    throw new TypeError('encounterState.turn is out of bounds');
  }
  if (!Array.isArray(input.requestedActions) || input.requestedActions.length < 1 || input.requestedActions.length > 64) {
    throw new TypeError('requestedActions must contain from 1 to 64 actions');
  }
  const requested = input.requestedActions.map(function (value, index) { return action(value, 'requestedActions[' + index + ']'); });
  if (new Set(requested).size !== requested.length) throw new TypeError('requestedActions contains duplicates');
  if (!Array.isArray(input.ruleTable) || input.ruleTable.length < 1 || input.ruleTable.length > 64) {
    throw new TypeError('ruleTable must contain from 1 to 64 rules');
  }
  const rules = Object.create(null);
  input.ruleTable.forEach(function (rule, index) {
    exact(rule, ['action', 'allowed', 'outcome'], 'ruleTable[' + index + ']');
    const id = action(rule.action, 'ruleTable[' + index + '].action');
    if (typeof rule.allowed !== 'boolean') throw new TypeError('ruleTable[' + index + '].allowed must be boolean');
    if (Object.prototype.hasOwnProperty.call(rules, id)) throw new TypeError('ruleTable contains duplicate actions');
    rules[id] = { allowed: rule.allowed, outcome: outcome(rule.outcome, 'ruleTable[' + index + '].outcome') };
  });
  const allowedActions = requested.filter(function (id) { return rules[id] && rules[id].allowed; });
  const outcomes = allowedActions.map(function (id) { return { action: id, outcome: rules[id].outcome }; });
  const omittedActions = requested.filter(function (id) { return !rules[id] || !rules[id].allowed; });
  return {
    schema: 'axm.bounded-game-rule-result/v1',
    encounter: { id: encounterId, turn: input.encounterState.turn },
    allowedActions,
    outcomes,
    omittedActions
  };
}

module.exports = { applyGameRule };
`, 'utf8');
}

function inputSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: INPUT_SCHEMA,
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'encounterState', 'requestedActions', 'ruleTable'],
    properties: {
      schema: { const: INPUT_SCHEMA },
      encounterState: {
        type: 'object', additionalProperties: false, required: ['id', 'turn'],
        properties: { id: { $ref: '#/$defs/action' }, turn: { type: 'integer', minimum: 0, maximum: 1000000 } }
      },
      requestedActions: { type: 'array', minItems: 1, maxItems: 64, uniqueItems: true, items: { $ref: '#/$defs/action' } },
      ruleTable: { type: 'array', minItems: 1, maxItems: 64, items: { $ref: '#/$defs/rule' } }
    },
    $defs: {
      action: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
      rule: {
        type: 'object', additionalProperties: false, required: ['action', 'allowed', 'outcome'],
        properties: {
          action: { $ref: '#/$defs/action' },
          allowed: { type: 'boolean' },
          outcome: { type: 'string', minLength: 1, maxLength: 160, pattern: '^[^\\u0000-\\u001f\\u007f]+$' }
        }
      }
    }
  };
}

function outputSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: OUTPUT_SCHEMA,
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'encounter', 'allowedActions', 'outcomes', 'omittedActions'],
    properties: {
      schema: { const: OUTPUT_SCHEMA },
      encounter: {
        type: 'object', additionalProperties: false, required: ['id', 'turn'],
        properties: { id: { $ref: '#/$defs/action' }, turn: { type: 'integer', minimum: 0, maximum: 1000000 } }
      },
      allowedActions: { type: 'array', maxItems: 64, uniqueItems: true, items: { $ref: '#/$defs/action' } },
      outcomes: { type: 'array', maxItems: 64, items: { $ref: '#/$defs/outcome' } },
      omittedActions: { type: 'array', maxItems: 64, uniqueItems: true, items: { $ref: '#/$defs/action' } }
    },
    $defs: {
      action: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' },
      outcome: {
        type: 'object', additionalProperties: false, required: ['action', 'outcome'],
        properties: {
          action: { $ref: '#/$defs/action' },
          outcome: { type: 'string', minLength: 1, maxLength: 160, pattern: '^[^\\u0000-\\u001f\\u007f]+$' }
        }
      }
    }
  };
}

function operationBindings(plan) {
  return plan.applicationRecords.map((record) => ({
    sourceId: record.sourceId,
    recipeId: record.recipeId,
    snippetRef: clone(record.recipeEvidence.snippetRef),
    targetStepId: record.requesterMapping.targetStepId,
    blueprintOperation: record.requesterMapping.blueprintOperation,
    nativeOperation: record.requesterMapping.nativeOperation,
    sourceMode: 'METADATA_REFERENCE_ONLY'
  }));
}

function recipeApplication(plan) {
  return {
    schema: APPLICATION_SCHEMA,
    version: VERSION,
    applicationPlanRef: Planner.planRef(plan),
    blueprintRef: clone(plan.blueprintRef),
    implementationOrigin: 'INDEPENDENT_NATIVE_FROM_TYPED_BLUEPRINT',
    operationBindings: operationBindings(plan),
    sourceTreatment: {
      atlasSnippetBytesIncluded: false,
      atlasSnippetBytesApplied: false,
      atlasSnippetExecuted: false,
      directReuseAllowed: false
    },
    authority: 'NONE'
  };
}

function buildTestPlan(candidate) {
  const cases = [
    ['atlas-source-absence', 'No Atlas snippet bytes appear in the generated JavaScript source.', 'static-source-inspection'],
    ['byte-lineage', 'Every candidate file and the module bundle match their recorded byte digests.', 'lineage-proof'],
    ['deterministic-generation', 'The exact request rebuilds a byte-identical packet.', 'deterministic-rebuild'],
    ['duplicate-action-hold', 'Duplicate requested actions and duplicate rule-table actions are rejected.', 'runtime-countertest'],
    ['filter-behavior', 'Only actions explicitly marked allowed survive the filter operation.', 'runtime-behavior'],
    ['input-immutability', 'Applying the rule does not mutate the supplied encounter, action, or rule data.', 'runtime-countertest'],
    ['malformed-input-hold', 'Unknown fields and malformed bounded records are rejected.', 'schema-and-runtime-countertest'],
    ['map-behavior', 'Each allowed action maps to its exact declared outcome.', 'runtime-behavior'],
    ['no-ambient-authority', 'The candidate has no filesystem, network, provider, environment, or lifecycle authority.', 'static-boundary-inspection'],
    ['output-schema', 'The emitted result validates against the closed output schema.', 'schema-behavior']
  ].map(([id, claim, evidenceKind]) => ({ id, claim, evidenceKind, verdict: 'UNRUN' }))
    .sort((left, right) => compareText(left.id, right.id));
  return {
    schema: Semantic.TEST_PLAN_SCHEMA,
    version: Semantic.VERSION,
    candidate,
    cases,
    truth: {
      candidateCodeExecuted: false,
      runtimeQualityProven: false,
      visualQualityProven: false,
      humanApproved: false
    },
    authority: 'NONE'
  };
}

function parseBundleJson(bundle, targetPath) {
  const file = bundle.files.find((entry) => entry.path === targetPath);
  if (!file) fail('candidate bundle misses ' + targetPath);
  try { return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')); }
  catch (error) { fail(targetPath + ' is not strict JSON: ' + error.message); }
}

function normalizeCandidateBundle(value, planInput) {
  const plan = Planner.normalizePlan(planInput);
  validateSupportedPlan(plan);
  const candidateId = 'bounded-game-rule-' + plan.planDigest.slice('sha256:'.length, 'sha256:'.length + 16);
  const normalized = Semantic.normalizeModuleBundle(value, candidateId);
  if (normalized.permissions.length || normalized.networkDomains.length || normalized.uses.length) {
    fail('native game-rule candidate must remain standalone, permissionless, and networkless');
  }
  if (!same(normalized.bundle.files.map((file) => file.path), REQUIRED_FILES.slice())) {
    fail('native game-rule candidate file set drifted');
  }
  if (!same(parseBundleJson(normalized.bundle, 'game-rule-input.schema.json'), inputSchema()) ||
      !same(parseBundleJson(normalized.bundle, 'game-rule-result.schema.json'), outputSchema()) ||
      !same(parseBundleJson(normalized.bundle, 'recipe-application.json'), recipeApplication(plan))) {
    fail('native game-rule candidate emitted record validation failed');
  }
  const adapter = normalized.bundle.files.find((file) => file.path === 'adapter.js');
  const expectedSource = gameRuleSource();
  if (!adapter || Buffer.from(adapter.content, 'base64').compare(expectedSource) !== 0 ||
      adapter.sha256 !== sha256Bytes(expectedSource).slice('sha256:'.length)) {
    fail('native game-rule candidate source differs from the closed native recipe');
  }
  return normalized;
}

function buildBundle(request) {
  const plan = request.applicationPlan;
  const candidateId = 'bounded-game-rule-' + plan.planDigest.slice('sha256:'.length, 'sha256:'.length + 16);
  const candidate = { id: candidateId, version: 'v0.1', status: 'EXPERIMENTAL' };
  const manifest = {
    schema: 'axm.tool-manifest/v1',
    id: candidateId,
    name: 'AXM Bounded Game Rule — Native Candidate',
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'adapter.js',
    contract: 'module.contract.json',
    kind: 'candidate-module',
    uses: [],
    permissions: [],
    summary: 'Pure bounded game-rule candidate implementing the exact typed filter and map plan.'
  };
  const contract = {
    schema: 'axm.module-contract/v1',
    id: candidateId,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    provides: [OUTPUT_SCHEMA],
    consumes: [INPUT_SCHEMA, Planner.PLAN_SCHEMA].sort(compareText),
    permissions: [],
    handoffs: { emits: [OUTPUT_SCHEMA], accepts: [INPUT_SCHEMA] },
    rootsGate: ROOTS.slice(),
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'explicit' },
    boundaries: {
      writes: [],
      refuses: [
        'generated-code-execution', 'network-use', 'permission-grant', 'provider-call',
        'host-environment-access', 'filesystem-access', 'automatic-install',
        'automatic-integration', 'automatic-learning', 'automatic-promotion', 'automatic-canon'
      ]
    }
  };
  const receipt = {
    schema: 'axm.module-candidate-receipt/v1',
    candidate: { id: candidateId, version: 'v0.1' },
    creation: { lane: 'NATIVE', generatorRef: moduleRef(), declaredStatus: 'EXPERIMENTAL', humanReviewRequired: true },
    authority: {
      installed: false, registered: false, staged: false, integrated: false, published: false,
      learned: false, promoted: false, canonChanged: false, permissionsChanged: false
    },
    truth: { generatedCodeExecuted: false, runtimeQualityProven: false, visualApprovalProven: false, humanApproved: false }
  };
  const readme = Buffer.from(
    '# AXM Bounded Game Rule — Native Candidate\n\n' +
    'Status: `EXPERIMENTAL` · in-memory candidate data · unmaterialized.\n\n' +
    'This candidate independently implements the exact typed FILTER_VALUES and MAP_VALUES game-rule plan. ' +
    'Atlas snippet bytes are not included, copied, applied, or executed. Candidate code and tests are unrun. ' +
    'Direct reuse remains held. Authentication over the exact bytes is required before any Nursery write; ' +
    'installation, integration, promotion, and CANON remain separate Mike decisions.\n',
    'utf8'
  );
  const application = recipeApplication(plan);
  const files = [
    sourceFile('README.md', readme),
    sourceFile('adapter.js', gameRuleSource()),
    sourceFile('candidate.receipt.json', jsonBytes(receipt)),
    sourceFile('game-rule-input.schema.json', jsonBytes(inputSchema())),
    sourceFile('game-rule-result.schema.json', jsonBytes(outputSchema())),
    sourceFile('manifest.json', jsonBytes(manifest)),
    sourceFile('module.contract.json', jsonBytes(contract)),
    sourceFile('recipe-application.json', jsonBytes(application)),
    sourceFile('test-plan.json', jsonBytes(buildTestPlan(candidate)))
  ].sort((left, right) => compareText(left.path, right.path));
  if (!same(files.map((file) => file.path), REQUIRED_FILES.slice())) fail('native game-rule candidate file set drifted');
  return normalizeCandidateBundle({ schema: 'axm.module-bundle/v1', requiredSeats: 1, files }, plan);
}

function buildPacket(request) {
  const plan = request.applicationPlan;
  const bundle = buildBundle(request);
  const bundleBytes = jsonBytes(bundle.bundle);
  const testFile = bundle.sourceFiles.find((file) => file.path === 'test-plan.json');
  const consentRef = evaluationRef(request.id, request.consent.evaluation);
  const refs = uniqueRefs([
    ...plan.lineageRefs,
    Planner.planRef(plan),
    moduleRef(),
    declarationRef(),
    consentRef
  ], 'candidate lineageRefs', 8, 16);
  const base = {
    schema: PACKET_SCHEMA,
    version: VERSION,
    status: 'EXPERIMENTAL',
    generationStatus: 'INERT_DRAFT_CREATED_AUTHENTICATION_REQUIRED_BEFORE_WRITE',
    candidate: bundle.candidate,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    applicationPlanRef: Planner.planRef(plan),
    blueprintRef: clone(plan.blueprintRef),
    discoveryEvidenceRef: clone(plan.discoveryEvidenceRef),
    recipeSelectionRef: clone(plan.recipeSelectionRef),
    consentEvaluationRef: consentRef,
    generator: {
      id: GENERATOR_ID,
      version: VERSION,
      lane: 'NATIVE',
      aiUsed: false,
      implementationOrigin: 'INDEPENDENT_NATIVE_FROM_TYPED_BLUEPRINT'
    },
    moduleBundle: bundle.bundle,
    moduleBundleRef: {
      id: bundle.candidate.id + '-module-bundle',
      schema: 'axm.module-bundle/v1',
      sha256: sha256Bytes(bundleBytes),
      byteLength: bundleBytes.length
    },
    sourceFiles: bundle.sourceFiles,
    operationBindings: operationBindings(plan),
    testPlanRef: {
      id: bundle.candidate.id + '-test-plan',
      schema: Semantic.TEST_PLAN_SCHEMA,
      sha256: testFile.sha256
    },
    rootsGate: clone(plan.applicationRequest.rootsGate),
    declaredAuthority: { permissions: [], networkDomains: [], lifecycleEffects: [] },
    resourceObservation: null,
    reuseRights: {
      atlasSource: {
        state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, sourceBytesIncluded: false,
        sourceBytesApplied: false, sourceExecuted: false
      },
      candidateSource: {
        state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, sourceBytesIncluded: true,
        sourceBytesApplied: false, sourceExecuted: false
      }
    },
    lineageRefs: refs,
    limitations: LIMITATIONS.slice(),
    nextGate: NEXT_GATE,
    truth: {
      exactApplicationPlanRebuilt: true,
      installedAtlasLineageRebuilt: true,
      requesterMappingsBound: true,
      semanticMappingInferred: false,
      groundedConsentScopeBound: true,
      authenticatedHumanDecisionVerified: false,
      fourRootPassDecisionsBound: true,
      fourRootEvidenceContentVerified: false,
      atlasSourceBytesIncluded: false,
      atlasSourceBytesApplied: false,
      atlasSourceExecuted: false,
      generatedSourceByteBound: true,
      candidateGenerated: true,
      candidateCodeExecuted: false,
      candidateTestsRun: false,
      runtimeBehaviorProven: false,
      correctnessProven: false,
      safetyProven: false,
      providerCalled: false,
      providerCodeLoaded: false,
      hostAuthorizationGranted: false,
      workspaceWritten: false,
      installed: false,
      integrated: false,
      published: false,
      persistentLearningAdmitted: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  let packetBytes = 1;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const resourceObservation = {
      requestBytes: jsonBytes(request).length,
      packetBytes,
      sourceFileCount: bundle.sourceFiles.length,
      sourceBytes: bundle.totalBytes,
      fileCountEnforced: true,
      fileByteCeilingEnforced: true,
      totalByteCeilingEnforced: true,
      attemptCountEnforced: true,
      durationEnforced: false,
      memoryEnforced: false,
      processesSpawned: 0,
      networkUsed: false,
      targetWorkspaceRead: false,
      targetWorkspaceWrite: false
    };
    const core = { ...base, resourceObservation };
    const packet = { ...core, packetDigest: sha256Value(core) };
    const measured = jsonBytes(packet).length;
    if (measured === packetBytes) {
      if (measured > request.resourceEnvelope.maxOutputBytes || measured > MAX_OUTPUT_BYTES ||
          bundle.totalBytes > request.resourceEnvelope.maxOutputBytes) {
        fail('native game-rule candidate exceeds its exact output byte ceiling');
      }
      return packet;
    }
    packetBytes = measured;
  }
  fail('native game-rule candidate packet byte measurement did not converge');
}

function generate(input) {
  const request = normalizeRequest(input);
  const packet = buildPacket(request);
  const result = {
    request,
    packet,
    truth: {
      deterministicGenerationOnly: true,
      atlasSourceReadByGenerator: false,
      providerCalled: false,
      candidateCodeExecuted: false,
      candidateTestsRun: false,
      workspaceWritten: false,
      networkUsed: false,
      childProcessSpawned: false,
      humanDecisionAuthenticated: false,
      installed: false,
      integrated: false,
      persistentLearningAdmitted: false,
      promoted: false,
      canonChanged: false
    }
  };
  if (jsonBytes(result).length > request.resourceEnvelope.maxOutputBytes) {
    fail('complete native game-rule generation result exceeds the consented output byte ceiling');
  }
  return result;
}

function normalizePacket(value, requestInput) {
  object(value, 'native game-rule candidate packet');
  if (value.schema !== PACKET_SCHEMA || value.version !== VERSION || value.status !== 'EXPERIMENTAL' || value.authority !== 'NONE') {
    fail('native game-rule candidate packet identity or authority mismatch');
  }
  const expected = generate(requestInput).packet;
  if (!same(value, expected)) fail('native game-rule candidate packet differs from deterministic exact-input rebuild');
  return expected;
}

function verifyGeneration(result, input) {
  try {
    const rebuilt = generate(input);
    return same(result, rebuilt) ? { pass: true, errors: [] } : { pass: false, errors: ['generation differs from deterministic rebuild'] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

function buildExampleRequest() {
  const plan = Planner.buildPlan(Planner.buildExampleRequest());
  const resources = {
    maxInputBytes: MAX_REQUEST_BYTES,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    maxMemoryBytes: 134217728,
    maxDurationMs: 5000,
    maxProcesses: 1,
    maxAttempts: 1,
    maxCostMinorUnits: 0
  };
  const pRef = Planner.planRef(plan);
  const profile = moduleRef();
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'native-game-rule-candidate-tier-one-policy',
    validFrom: '2026-08-23T10:00:00.000Z',
    expiresAt: '2026-08-24T10:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [plan.schema],
      domainProfileSchemas: [profile.schema],
      allowedActions: [CONSENT_ACTION],
      allowedPermissions: [],
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: resources,
      requiredPredecisionEvidenceSchemas: [plan.schema],
      requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice()
    }],
    rootsGate: ROOTS.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'native-game-rule-candidate-draft',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: pRef,
    domainProfileRef: profile,
    predecisionEvidenceRefs: [pRef],
    inputArtifacts: [artifactRef(plan.id, plan.schema, plan.planDigest, plan)],
    actions: [CONSENT_ACTION],
    permissions: [],
    networkDomains: [],
    dataClasses: REQUIRED_DATA_CLASSES.slice(),
    sourceUses: REQUIRED_SOURCE_USES.slice(),
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources,
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-23T11:00:00.000Z',
    expiresAt: '2026-08-23T12:00:00.000Z',
    authority: 'NONE'
  });
  const evaluationInput = { policy, instance, evaluatedAt: '2026-08-23T11:10:00.000Z' };
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id: 'generate-native-bounded-game-rule-candidate',
    tier: 1,
    mode: MODE,
    applicationPlan: plan,
    consent: { evaluationInput, evaluation: Consent.evaluateGroundedConsent(evaluationInput) },
    resourceEnvelope: resources,
    instructionRef: declarationRef(),
    authority: 'NONE'
  });
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  PACKET_SCHEMA,
  MODE,
  CONSENT_ACTION,
  GENERATOR_ID,
  NEXT_GATE,
  INPUT_SCHEMA,
  OUTPUT_SCHEMA,
  APPLICATION_SCHEMA,
  ROOTS,
  MAX_REQUEST_BYTES,
  MAX_OUTPUT_BYTES,
  REQUIRED_FILES,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  LIMITATIONS,
  DECLARATION,
  canonicalJson,
  clone,
  sha256Value,
  sha256Bytes,
  jsonBytes,
  moduleRef,
  declarationRef,
  artifactRef,
  sealRequest,
  normalizeRequest,
  gameRuleSource,
  inputSchema,
  outputSchema,
  operationBindings,
  recipeApplication,
  normalizeCandidateBundle,
  buildBundle,
  buildPacket,
  generate,
  normalizePacket,
  verifyGeneration,
  buildExampleRequest
};
