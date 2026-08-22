'use strict';

const crypto = require('crypto');
const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Composer = require('./declarative-blueprint-composer-v1');
const Compiler = require('./blueprint-schema-compiler-v1');
const DeterministicJson = require('../../tools/deterministic-json-core');

const VERSION = '0.1.0';
const REQUEST_SCHEMA = 'axm.semantic-generation-request/v1';
const PACKET_SCHEMA = 'axm.semantic-candidate-packet/v1';
const COMPARISON_SCHEMA = 'axm.candidate-alternative-comparison/v1';
const REVIEW_CARD_SCHEMA = 'axm.creation-review-card/v1';
const PROFILE_SCHEMA = 'axm.semantic-candidate-generator-profile/v1';
const RECIPE_LIBRARY_SCHEMA = 'axm.native-recipe-library/v1';
const MODULE_BUNDLE_SCHEMA = 'axm.module-bundle/v1';
const CANDIDATE_RECEIPT_SCHEMA = 'axm.module-candidate-receipt/v1';
const MODULE_CONTRACT_SCHEMA = 'axm.module-contract/v1';
const TOOL_MANIFEST_SCHEMA = 'axm.tool-manifest/v1';
const TEST_PLAN_SCHEMA = 'axm.semantic-candidate-test-plan/v1';
const CAPABILITY_GAP_SCHEMA = 'axm.semantic-generation-capability-gap/v1';
const NATIVE_PROVIDER_ID = 'axm-native-recipe-engine';
const RECIPE_ID = 'creation-review-card-adapter';
const ACKNOWLEDGEMENT = 'ONE DETACHED INERT SEMANTIC CANDIDATE SET ONLY';
const DECLARATION_SCHEMA = 'axm.interactive-pilot-declaration/v1';
const DECLARATION_ID = 'interactive-semantic-generation-declaration';
const ROOTS = Consent.ROOTS_GATE.slice();
const MODES = Object.freeze(['NATIVE_ONLY', 'NATIVE_WITH_AI_CHALLENGER']);
const NATIVE_OPERATIONS = Object.freeze([
  'VALIDATION',
  'MAPPING',
  'FILTERING',
  'COMPARISON',
  'SUMMARIZATION',
  'PLAIN_LANGUAGE_RENDERING'
]);
const REQUIRED_COMPONENT_IDS = Object.freeze([
  'code-recipe-foundry',
  'detached-candidate-nursery',
  'deterministic-json-core',
  'evidence-desk',
  'review-inbox'
]);
const REQUIRED_CANDIDATE_FILES = Object.freeze([
  'README.md',
  'adapter.js',
  'candidate.receipt.json',
  'manifest.json',
  'module.contract.json',
  'test-plan.json'
]);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  PACKET_SCHEMA,
  COMPARISON_SCHEMA,
  REVIEW_CARD_SCHEMA
]);
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_CANDIDATE_FILES = 16;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_CANDIDATE_BYTES = 512 * 1024;
const MAX_CANDIDATES = 2;
const MAX_TEXT = 2000;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CANDIDATE_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,219}$/;
const PORTABLE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,79}$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|clock\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\..*)?$/i;

const LIMITATIONS = Object.freeze([
  'CANDIDATE_CODE_NOT_EXECUTED',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'VISUAL_BEHAVIOR_NOT_PROVEN',
  'ACCESSIBILITY_NOT_PROVEN',
  'AUTHENTICATED_HUMAN_DECISION_NOT_VERIFIED',
  'NATURAL_PERSON_IDENTITY_NOT_PROVEN',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'HOST_AUTHORIZATION_NOT_GRANTED',
  'HOST_OBSERVER_AUTHENTICITY_NOT_PROVEN',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_VERIFIED',
  'ATTEMPT_LIMIT_IS_PER_INVOCATION_NOT_DURABLE_LEDGER',
  'RESOURCE_DURATION_NOT_ENFORCED',
  'RESOURCE_MEMORY_NOT_ENFORCED',
  'GENERATED_SOURCE_DIRECT_REUSE_RIGHTS_HELD',
  'AI_CHALLENGER_OUTPUT_IS_UNTRUSTED_DATA',
  'AI_CHALLENGER_DIRECT_REUSE_RIGHTS_HELD',
  'INSTALLATION_NOT_AUTHORIZED',
  'INTEGRATION_NOT_AUTHORIZED',
  'PERSISTENT_LEARNING_NOT_AUTHORIZED',
  'PUBLICATION_NOT_AUTHORIZED',
  'PHYSICAL_ACTUATION_NOT_AUTHORIZED',
  'PROMOTION_NOT_AUTHORIZED',
  'CANON_CHANGE_NOT_AUTHORIZED'
]);

const PROFILE_CORE = Object.freeze({
  schema: PROFILE_SCHEMA,
  version: VERSION,
  id: 'semantic-candidate-generator-v1',
  status: 'TEST',
  kind: 'PURE_DATA_TRANSFORM',
  defaultMode: 'NATIVE_ONLY',
  consentTier: 1,
  supportedRecipeIds: [RECIPE_ID],
  nativeOperations: NATIVE_OPERATIONS.slice(),
  maxRequestBytes: MAX_REQUEST_BYTES,
  maxCandidates: MAX_CANDIDATES,
  maxFilesPerCandidate: MAX_CANDIDATE_FILES,
  maxFileBytes: MAX_FILE_BYTES,
  maxCandidateBytes: MAX_CANDIDATE_BYTES,
  permissions: [],
  networkDomains: [],
  authority: 'NONE'
});

const PROFILE = Object.freeze({
  ...PROFILE_CORE,
  profileDigest: sha256Value(PROFILE_CORE)
});

const RECIPE_LIBRARY_CORE = Object.freeze({
  schema: RECIPE_LIBRARY_SCHEMA,
  version: 'v1',
  id: 'axm-native-semantic-recipes',
  status: 'TEST',
  recipes: [{
    id: RECIPE_ID,
    version: '1.0.0',
    outputSchema: REVIEW_CARD_SCHEMA,
    operations: NATIVE_OPERATIONS.slice(),
    candidateStatus: 'EXPERIMENTAL'
  }],
  authority: 'NONE'
});

const RECIPE_LIBRARY = Object.freeze({
  ...RECIPE_LIBRARY_CORE,
  libraryDigest: sha256Value(RECIPE_LIBRARY_CORE)
});

function canonicalJson(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Value(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
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
  if (!same(actual, expected)) {
    throw new Error(label + ' fields must be exactly: ' + expected.join(', '));
  }
}

function strictText(value, label, maximum = MAX_TEXT) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || value.trim() !== value ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be bounded non-empty text without control characters');
  }
  return value;
}

function identifier(value, label) {
  const normalized = strictText(value, label, 128);
  if (!ID.test(normalized)) throw new Error(label + ' must be a portable identifier');
  return normalized;
}

function candidateId(value, label) {
  const normalized = strictText(value, label, 80);
  if (!CANDIDATE_ID.test(normalized)) throw new Error(label + ' must be a portable candidate identifier');
  return normalized;
}

function contractToken(value, label) {
  const normalized = strictText(value, label, 220);
  if (!CONTRACT_TOKEN.test(normalized)) throw new Error(label + ' must be a contract token');
  return normalized;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a sha256 digest');
  return value;
}

function hexDigest(value, label) {
  if (typeof value !== 'string' || !HEX_DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 hex digest');
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer between ' + minimum + ' and ' + maximum);
  }
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function artifactReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  return {
    ...reference({ id: value.id, schema: value.schema, sha256: value.sha256 }, label),
    byteLength: boundedInteger(value.byteLength, label + '.byteLength', 1, MAX_REQUEST_BYTES)
  };
}

function refs(values, label, minimum = 0, maximum = 64) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must be a bounded array');
  }
  const normalized = values.map((item, index) => reference(item, label + '[' + index + ']'))
    .sort((left, right) => compareText(canonicalJson(left), canonicalJson(right)));
  if (new Set(normalized.map(canonicalJson)).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}

function identifiers(values, label, minimum = 0, maximum = 64) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must be a bounded array');
  }
  const normalized = values.map((item, index) => identifier(item, label + '[' + index + ']')).sort(compareText);
  if (new Set(normalized).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}

function contracts(values, label, minimum = 0, maximum = 64) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must be a bounded array');
  }
  const normalized = values.map((item, index) => contractToken(item, label + '[' + index + ']')).sort(compareText);
  if (new Set(normalized).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}

function profileRef() {
  return { id: PROFILE.id, schema: PROFILE.schema, sha256: PROFILE.profileDigest };
}

function recipeLibraryRef() {
  return { id: RECIPE_LIBRARY.id, schema: RECIPE_LIBRARY.schema, sha256: RECIPE_LIBRARY.libraryDigest };
}

function declarationRef() {
  const core = {
    schema: DECLARATION_SCHEMA,
    id: DECLARATION_ID,
    scope: 'ONE_DETACHED_INERT_SEMANTIC_CANDIDATE_SET',
    acknowledgement: ACKNOWLEDGEMENT,
    authority: 'NONE'
  };
  return { id: core.id, schema: core.schema, sha256: sha256Value(core) };
}

function normalizePortablePath(value, label = 'path') {
  const text = strictText(value, label, 240);
  if (text.includes('\\') || text.includes(':') || text.startsWith('/') || text.startsWith('//') ||
    /^[A-Za-z]:/.test(text) || text.normalize('NFC') !== text) {
    throw new Error(label + ' is not a portable relative path');
  }
  const segments = text.split('/');
  if (!segments.length || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(label + ' contains an empty or traversal segment');
  }
  segments.forEach((segment) => {
    if (!PORTABLE_SEGMENT.test(segment) || /[. ]$/.test(segment) || WINDOWS_DEVICE.test(segment)) {
      throw new Error(label + ' contains a non-portable or Windows-reserved segment');
    }
  });
  return segments.join('/');
}

function pathKey(value) {
  return normalizePortablePath(value).toLowerCase();
}

function artifact(value, id, schema) {
  const bytes = jsonBytes(value);
  return {
    ref: {
      id,
      schema,
      sha256: 'sha256:' + sha256Bytes(bytes),
      byteLength: bytes.length
    },
    value: clone(value)
  };
}

function normalizeArtifact(value, label, expectedId, expectedSchema, expectedValue) {
  exactKeys(value, ['ref', 'value'], label);
  const ref = artifactReference(value.ref, label + '.ref');
  if (ref.id !== expectedId || ref.schema !== expectedSchema) throw new Error(label + ' identity mismatch');
  const bytes = jsonBytes(value.value);
  if (ref.sha256 !== 'sha256:' + sha256Bytes(bytes) || ref.byteLength !== bytes.length) {
    throw new Error(label + ' byte-bound reference mismatch');
  }
  if (!same(value.value, expectedValue)) throw new Error(label + ' differs from deterministic source');
  return { ref, value: clone(expectedValue) };
}

function normalizeBlueprintPacket(value) {
  exactKeys(value, ['intent', 'blueprint', 'inputSchema', 'outputSchema', 'acceptanceMatrix'], 'request.blueprintPacket');
  const intent = Composer.normalizeIntent(value.intent);
  const blueprint = Composer.buildBlueprint(intent);
  const blueprintArtifact = normalizeArtifact(
    value.blueprint,
    'request.blueprintPacket.blueprint',
    blueprint.id,
    Composer.BLUEPRINT_SCHEMA,
    blueprint
  );
  const inputSchema = Compiler.buildInterfaceSchema(blueprint, 'input');
  const outputSchema = Compiler.buildInterfaceSchema(blueprint, 'output');
  const matrix = Compiler.buildAcceptanceMatrix(blueprint, inputSchema, outputSchema);
  return {
    intent,
    blueprint: blueprintArtifact,
    inputSchema: normalizeArtifact(value.inputSchema, 'request.blueprintPacket.inputSchema',
      blueprint.id + '-input-schema', inputSchema.$id, inputSchema),
    outputSchema: normalizeArtifact(value.outputSchema, 'request.blueprintPacket.outputSchema',
      blueprint.id + '-output-schema', outputSchema.$id, outputSchema),
    acceptanceMatrix: normalizeArtifact(value.acceptanceMatrix, 'request.blueprintPacket.acceptanceMatrix',
      blueprint.id + '-acceptance-matrix', Compiler.MATRIX_SCHEMA, matrix)
  };
}

function normalizeComponent(value, label) {
  exactKeys(value, ['ref', 'contract'], label);
  const ref = reference(value.ref, label + '.ref');
  object(value.contract, label + '.contract');
  if (value.contract.schema !== MODULE_CONTRACT_SCHEMA || value.contract.id !== ref.id || ref.schema !== MODULE_CONTRACT_SCHEMA ||
    sha256Value(value.contract) !== ref.sha256) {
    throw new Error(label + ' contract bytes do not match its exact reference');
  }
  return { ref, contract: clone(value.contract) };
}

function normalizeComponents(values) {
  if (!Array.isArray(values) || values.length !== REQUIRED_COMPONENT_IDS.length) {
    throw new Error('request.components must contain the exact required Workshop component set');
  }
  const normalized = values.map((item, index) => normalizeComponent(item, 'request.components[' + index + ']'))
    .sort((left, right) => compareText(left.ref.id, right.ref.id));
  if (!same(normalized.map((item) => item.ref.id), REQUIRED_COMPONENT_IDS.slice())) {
    throw new Error('request.components omits or adds a Workshop component');
  }
  return normalized;
}

function normalizeRootGate(values) {
  if (!Array.isArray(values) || values.length !== ROOTS.length) throw new Error('request.rootsGate must contain four decisions');
  return values.map((item, index) => {
    exactKeys(item, ['root', 'verdict', 'evidenceRefs'], 'request.rootsGate[' + index + ']');
    if (item.root !== ROOTS[index]) throw new Error('request.rootsGate must preserve the four roots in exact order');
    if (!['PASS', 'HOLD', 'FAIL'].includes(item.verdict)) throw new Error('root verdict is unsupported');
    const evidenceRefs = refs(item.evidenceRefs, 'request.rootsGate[' + index + '].evidenceRefs', 1, 8);
    return { root: item.root, verdict: item.verdict, evidenceRefs };
  });
}

function requirePassingRoots(rootsGate) {
  const blocking = rootsGate.filter((item) => item.verdict !== 'PASS');
  if (blocking.length) {
    throw new Error('ROOTS_GATE_HOLD:' + blocking.map((item) => item.root + '=' + item.verdict).join(','));
  }
}

function normalizeResourceEnvelope(value) {
  exactKeys(value, [
    'maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs',
    'maxProcesses', 'maxAttempts', 'maxCostMinorUnits'
  ], 'request.resourceEnvelope');
  const normalized = {
    maxInputBytes: boundedInteger(value.maxInputBytes, 'request.resourceEnvelope.maxInputBytes', 1, MAX_REQUEST_BYTES),
    maxOutputBytes: boundedInteger(value.maxOutputBytes, 'request.resourceEnvelope.maxOutputBytes', 1, MAX_CANDIDATE_BYTES * MAX_CANDIDATES),
    maxMemoryBytes: boundedInteger(value.maxMemoryBytes, 'request.resourceEnvelope.maxMemoryBytes', 1, Number.MAX_SAFE_INTEGER),
    maxDurationMs: boundedInteger(value.maxDurationMs, 'request.resourceEnvelope.maxDurationMs', 1, Number.MAX_SAFE_INTEGER),
    maxProcesses: boundedInteger(value.maxProcesses, 'request.resourceEnvelope.maxProcesses', 1, 1024),
    maxAttempts: boundedInteger(value.maxAttempts, 'request.resourceEnvelope.maxAttempts', 1, 1024),
    maxCostMinorUnits: boundedInteger(value.maxCostMinorUnits, 'request.resourceEnvelope.maxCostMinorUnits', 0, Number.MAX_SAFE_INTEGER)
  };
  if (normalized.maxProcesses !== 1 || normalized.maxAttempts !== 1 || normalized.maxCostMinorUnits !== 0) {
    throw new Error('semantic generation is limited to one zero-cost in-process attempt declaration');
  }
  return normalized;
}

function normalizeConsent(value, blueprintPacket, resources) {
  exactKeys(value, ['evaluationInput', 'evaluation'], 'request.consent');
  const verification = Consent.verifyEvaluation(value.evaluation, value.evaluationInput);
  if (!verification.pass) throw new Error('grounded consent evaluation invalid: ' + verification.errors.join('; '));
  const evaluation = Consent.normalizeEvaluation(value.evaluation);
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') {
    throw new Error('grounded consent scope contains a hold');
  }
  const instance = Consent.normalizeInstance(value.evaluationInput.instance);
  const expectedSubjectRef = {
    id: blueprintPacket.blueprint.ref.id,
    schema: blueprintPacket.blueprint.ref.schema,
    sha256: blueprintPacket.blueprint.value.blueprintDigest
  };
  if (!same(instance.subjectRef, expectedSubjectRef)) throw new Error('consent subject does not bind the exact blueprint');
  if (!same(instance.domainProfileRef, profileRef())) throw new Error('consent profile does not bind the semantic generator');
  if (!same(instance.actions, ['code.generate-inert-semantic-candidate']) || instance.permissions.length ||
    instance.networkDomains.length || !same(instance.sourceUses, ['derive-concepts'])) {
    throw new Error('consent authority must remain pure, permissionless, networkless concept derivation');
  }
  if (!Consent.LIFECYCLE_FIELDS.every((field) => instance.lifecycle[field] === false)) {
    throw new Error('semantic generation consent may not include lifecycle effects');
  }
  const resourceFields = Consent.RESOURCE_FIELDS;
  if (!resourceFields.every((field) => instance.resources[field] === resources[field])) {
    throw new Error('semantic generation resources drift from grounded consent');
  }
  const missingEvidence = REQUIRED_EVIDENCE_SCHEMAS.filter((schema) => !instance.requiredEvidenceSchemas.includes(schema));
  if (missingEvidence.length) throw new Error('consent removes required semantic evidence: ' + missingEvidence.join(','));
  return { evaluationInput: clone(value.evaluationInput), evaluation };
}

function normalizeReuseRights(value) {
  exactKeys(value, ['nativeRecipe', 'aiChallenger'], 'request.reuseRights');
  if (value.nativeRecipe !== 'DECLARED_REUSE_ALLOWED') throw new Error('native recipe reuse must be explicitly allowed');
  if (value.aiChallenger !== 'RESEARCH_ONLY_HOLD') throw new Error('AI challenger direct reuse must remain held');
  return { nativeRecipe: value.nativeRecipe, aiChallenger: value.aiChallenger };
}

function normalizeExactProvider(value, label) {
  exactKeys(value, ['id', 'version', 'descriptorSha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    version: strictText(value.version, label + '.version', 80),
    descriptorSha256: digest(value.descriptorSha256, label + '.descriptorSha256')
  };
}

function normalizeProviderPolicy(value, mode) {
  exactKeys(value, ['nativeProviderId', 'recipeLibraryRef', 'challenger'], 'request.providerPolicy');
  if (value.nativeProviderId !== NATIVE_PROVIDER_ID || !same(value.recipeLibraryRef, recipeLibraryRef())) {
    throw new Error('native provider policy drifted from the versioned recipe library');
  }
  exactKeys(value.challenger, [
    'enabled', 'exactProvider', 'routePlanDigest', 'allowedCandidatePermissions', 'allowedCandidateNetworkDomains'
  ], 'request.providerPolicy.challenger');
  const enabled = value.challenger.enabled;
  if (typeof enabled !== 'boolean' || enabled !== (mode === 'NATIVE_WITH_AI_CHALLENGER')) {
    throw new Error('challenger policy conflicts with generation mode');
  }
  const exactProvider = value.challenger.exactProvider == null ? null :
    normalizeExactProvider(value.challenger.exactProvider, 'request.providerPolicy.challenger.exactProvider');
  const routePlanDigest = value.challenger.routePlanDigest == null ? null :
    digest(value.challenger.routePlanDigest, 'request.providerPolicy.challenger.routePlanDigest');
  if (enabled !== (exactProvider !== null) || enabled !== (routePlanDigest !== null)) {
    throw new Error('challenger policy needs one exact provider and route plan digest only when enabled');
  }
  return {
    nativeProviderId: NATIVE_PROVIDER_ID,
    recipeLibraryRef: recipeLibraryRef(),
    challenger: {
      enabled,
      exactProvider,
      routePlanDigest,
      allowedCandidatePermissions: identifiers(value.challenger.allowedCandidatePermissions,
        'request.providerPolicy.challenger.allowedCandidatePermissions'),
      allowedCandidateNetworkDomains: identifiers(value.challenger.allowedCandidateNetworkDomains,
        'request.providerPolicy.challenger.allowedCandidateNetworkDomains', 0, 32)
    }
  };
}

function decodeBundleFile(value, label) {
  exactKeys(value, ['path', 'encoding', 'content', 'sha256'], label);
  const path = normalizePortablePath(value.path, label + '.path');
  if (value.encoding !== 'base64') throw new Error(label + '.encoding must be base64');
  if (typeof value.content !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.content)) {
    throw new Error(label + '.content must be canonical base64');
  }
  const bytes = Buffer.from(value.content, 'base64');
  if (bytes.toString('base64') !== value.content) throw new Error(label + '.content is not canonical base64');
  if (bytes.length > MAX_FILE_BYTES) throw new Error(label + ' exceeds the per-file byte ceiling');
  const fileDigest = hexDigest(value.sha256, label + '.sha256');
  if (sha256Bytes(bytes) !== fileDigest) throw new Error(label + ' content digest mismatch');
  return { path, encoding: 'base64', content: value.content, sha256: fileDigest, bytes };
}

function parseJsonFile(file, label) {
  try {
    return JSON.parse(file.bytes.toString('utf8'));
  } catch (error) {
    throw new Error(label + ' is not strict JSON: ' + error.message);
  }
}

function normalizeTestPlan(value, candidate) {
  exactKeys(value, ['schema', 'version', 'candidate', 'cases', 'truth', 'authority'], 'test plan');
  if (value.schema !== TEST_PLAN_SCHEMA || value.version !== VERSION || !same(value.candidate, candidate) || value.authority !== 'NONE') {
    throw new Error('test plan identity or authority mismatch');
  }
  if (!Array.isArray(value.cases) || value.cases.length < 7 || value.cases.length > 32) {
    throw new Error('test plan cases must be a bounded non-empty array');
  }
  const cases = value.cases.map((item, index) => {
    exactKeys(item, ['id', 'claim', 'evidenceKind', 'verdict'], 'test plan.cases[' + index + ']');
    if (item.verdict !== 'UNRUN') throw new Error('generated candidate tests must start UNRUN');
    return {
      id: identifier(item.id, 'test plan case id'),
      claim: strictText(item.claim, 'test plan case claim', 500),
      evidenceKind: identifier(item.evidenceKind, 'test plan evidence kind'),
      verdict: 'UNRUN'
    };
  }).sort((left, right) => compareText(left.id, right.id));
  if (new Set(cases.map((item) => item.id)).size !== cases.length) throw new Error('test plan case ids must be unique');
  exactKeys(value.truth, ['candidateCodeExecuted', 'runtimeQualityProven', 'visualQualityProven', 'humanApproved'], 'test plan.truth');
  if (Object.values(value.truth).some(Boolean)) throw new Error('test plan truth ceiling may not claim execution or approval');
  return {
    schema: TEST_PLAN_SCHEMA,
    version: VERSION,
    candidate: clone(candidate),
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

function normalizeModuleBundle(value, expectedCandidateId) {
  exactKeys(value, ['schema', 'requiredSeats', 'files'], 'module bundle');
  if (value.schema !== MODULE_BUNDLE_SCHEMA) throw new Error('module bundle schema mismatch');
  boundedInteger(value.requiredSeats, 'module bundle.requiredSeats', 1, 10);
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > MAX_CANDIDATE_FILES) {
    throw new Error('module bundle files exceed the bounded file count');
  }
  const decoded = value.files.map((item, index) => decodeBundleFile(item, 'module bundle.files[' + index + ']'))
    .sort((left, right) => compareText(left.path, right.path));
  if (new Set(decoded.map((file) => pathKey(file.path))).size !== decoded.length) {
    throw new Error('module bundle contains a duplicate or Windows case-alias path');
  }
  if (!same(decoded.map((file) => file.path), value.files.map((file) => file.path))) {
    throw new Error('module bundle files must be in deterministic path order');
  }
  const totalBytes = decoded.reduce((sum, file) => sum + file.bytes.length, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_CANDIDATE_BYTES) {
    throw new Error('module bundle exceeds the candidate byte ceiling');
  }
  const paths = decoded.map((file) => file.path);
  const missing = REQUIRED_CANDIDATE_FILES.filter((file) => !paths.includes(file));
  if (missing.length) throw new Error('module bundle misses required candidate files: ' + missing.join(','));
  const byPath = Object.fromEntries(decoded.map((file) => [file.path, file]));
  const manifest = parseJsonFile(byPath['manifest.json'], 'manifest.json');
  const contract = parseJsonFile(byPath['module.contract.json'], 'module.contract.json');
  const receipt = parseJsonFile(byPath['candidate.receipt.json'], 'candidate.receipt.json');
  const candidate = { id: expectedCandidateId, version: 'v0.1', status: 'EXPERIMENTAL' };
  exactKeys(manifest, ['schema', 'id', 'name', 'version', 'status', 'entry', 'contract', 'kind', 'uses', 'permissions', 'summary'], 'candidate manifest');
  if (manifest.schema !== TOOL_MANIFEST_SCHEMA || manifest.id !== candidate.id || manifest.version !== candidate.version ||
    manifest.status !== candidate.status || manifest.entry !== 'adapter.js' || manifest.contract !== 'module.contract.json' ||
    manifest.kind !== 'candidate-module' || !paths.includes(manifest.entry)) {
    throw new Error('candidate manifest identity or entry mismatch');
  }
  const permissions = identifiers(manifest.permissions, 'candidate manifest.permissions');
  const uses = identifiers(manifest.uses, 'candidate manifest.uses');
  exactKeys(contract, [
    'schema', 'id', 'version', 'status', 'provides', 'consumes', 'permissions', 'handoffs',
    'rootsGate', 'lifecycle', 'boundaries'
  ], 'candidate contract');
  if (contract.schema !== MODULE_CONTRACT_SCHEMA || contract.id !== candidate.id || contract.version !== candidate.version ||
    contract.status !== candidate.status || !same(contract.permissions, permissions) || !same(contract.rootsGate, ROOTS)) {
    throw new Error('candidate contract identity, permissions, or roots mismatch');
  }
  exactKeys(contract.handoffs, ['emits', 'accepts'], 'candidate contract.handoffs');
  exactKeys(contract.lifecycle, ['state_owner', 'reload', 'disconnect', 'cleanup'], 'candidate contract.lifecycle');
  exactKeys(contract.boundaries, ['writes', 'refuses'], 'candidate contract.boundaries');
  if (contract.boundaries.writes.length || ![
    'generated-code-execution', 'network-use', 'permission-grant', 'automatic-install',
    'automatic-integration', 'automatic-learning', 'automatic-promotion', 'automatic-canon'
  ].every((item) => contract.boundaries.refuses.includes(item))) {
    throw new Error('candidate contract authority ceiling is incomplete');
  }
  exactKeys(receipt, ['schema', 'candidate', 'creation', 'authority', 'truth'], 'candidate receipt');
  if (receipt.schema !== CANDIDATE_RECEIPT_SCHEMA || !same(receipt.candidate, { id: candidate.id, version: candidate.version })) {
    throw new Error('candidate receipt identity mismatch');
  }
  exactKeys(receipt.creation, ['lane', 'generatorRef', 'declaredStatus', 'humanReviewRequired'], 'candidate receipt.creation');
  exactKeys(receipt.authority, ['installed', 'registered', 'staged', 'integrated', 'published', 'learned', 'promoted', 'canonChanged', 'permissionsChanged'], 'candidate receipt.authority');
  exactKeys(receipt.truth, ['generatedCodeExecuted', 'runtimeQualityProven', 'visualApprovalProven', 'humanApproved'], 'candidate receipt.truth');
  if (receipt.creation.declaredStatus !== 'EXPERIMENTAL' || receipt.creation.humanReviewRequired !== true ||
    Object.values(receipt.authority).some(Boolean) || Object.values(receipt.truth).some(Boolean)) {
    throw new Error('candidate receipt exceeds its inert authority or truth ceiling');
  }
  const testPlan = normalizeTestPlan(parseJsonFile(byPath['test-plan.json'], 'test-plan.json'), candidate);
  const networkDomains = identifiers(contract.networkDomains || [], 'candidate contract.networkDomains', 0, 32);
  const normalizedBundle = {
    schema: MODULE_BUNDLE_SCHEMA,
    requiredSeats: value.requiredSeats,
    files: decoded.map((file) => ({ path: file.path, encoding: 'base64', content: file.content, sha256: file.sha256 }))
  };
  return {
    bundle: normalizedBundle,
    candidate,
    manifest: clone(manifest),
    contract: clone(contract),
    receipt: clone(receipt),
    testPlan,
    permissions,
    networkDomains,
    uses,
    sourceFiles: decoded.map((file) => ({
      path: file.path,
      sha256: 'sha256:' + file.sha256,
      byteLength: file.bytes.length
    })),
    totalBytes
  };
}

function normalizeChallengerIngress(value, providerPolicy, blueprintPacket) {
  exactKeys(value, ['candidateId', 'routeInput', 'routePlan', 'moduleBundle', 'reuseRights', 'lineageRefs', 'limitations'], 'request.challengerIngress');
  const routePlan = Fabric.normalizeRoutePlan(value.routePlan);
  const verification = Fabric.verifyRoutePlan(routePlan, value.routeInput);
  if (!verification.pass) throw new Error('AI challenger route plan is forged or stale: ' + verification.errors.join('; '));
  if (routePlan.status !== 'ROUTE_PLANNED' || routePlan.planDigest !== providerPolicy.challenger.routePlanDigest ||
    !same(routePlan.selected && {
      id: routePlan.selected.id,
      version: routePlan.selected.version,
      descriptorSha256: routePlan.selected.descriptorSha256
    }, providerPolicy.challenger.exactProvider)) {
    throw new Error('AI challenger route does not match the exact provider policy');
  }
  if (routePlan.request.capability !== 'code.semantic-candidate-challenger' ||
    routePlan.request.inputSchema !== REQUEST_SCHEMA || routePlan.request.outputSchema !== PACKET_SCHEMA) {
    throw new Error('AI challenger route has the wrong semantic generation tuple');
  }
  const blueprintArtifact = routePlan.request.inputArtifacts.find((item) =>
    item.id === blueprintPacket.blueprint.ref.id && item.schema === blueprintPacket.blueprint.ref.schema);
  if (!blueprintArtifact || blueprintArtifact.sha256 !== blueprintPacket.blueprint.ref.sha256 ||
    blueprintArtifact.byteLength !== blueprintPacket.blueprint.ref.byteLength) {
    throw new Error('AI challenger route does not bind the exact blueprint bytes');
  }
  exactKeys(value.reuseRights, ['state', 'directReuseAllowed', 'authorityRef'], 'request.challengerIngress.reuseRights');
  if (value.reuseRights.state !== 'RESEARCH_ONLY_HOLD' || value.reuseRights.directReuseAllowed !== false ||
    value.reuseRights.authorityRef !== null) {
    throw new Error('AI challenger direct reuse must remain research-only and held');
  }
  const id = candidateId(value.candidateId, 'request.challengerIngress.candidateId');
  const bundle = normalizeModuleBundle(value.moduleBundle, id);
  const permissionGap = bundle.permissions.filter((item) => !providerPolicy.challenger.allowedCandidatePermissions.includes(item));
  const networkGap = bundle.networkDomains.filter((item) => !providerPolicy.challenger.allowedCandidateNetworkDomains.includes(item));
  if (permissionGap.length || networkGap.length) {
    throw new Error('AI challenger candidate expands permission or network scope');
  }
  if (bundle.receipt.creation.lane !== 'AI_CHALLENGER' || !same(bundle.receipt.creation.generatorRef, routePlan.selected)) {
    throw new Error('AI challenger candidate receipt does not identify its exact lane and provider');
  }
  const limitations = identifiers(value.limitations, 'request.challengerIngress.limitations', 1, 32);
  return {
    candidateId: id,
    routeInput: clone(value.routeInput),
    routePlan,
    moduleBundle: clone(bundle.bundle),
    reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, authorityRef: null },
    lineageRefs: refs(value.lineageRefs, 'request.challengerIngress.lineageRefs', 1, 32),
    limitations
  };
}

function normalizeRequestCore(value) {
  exactKeys(value, [
    'schema', 'id', 'goal', 'mode', 'tier', 'recipeId', 'blueprintPacket', 'components',
    'consent', 'resourceEnvelope', 'reuseRights', 'providerPolicy', 'rootsGate',
    'challengerIngress', 'instructionRef', 'authority'
  ], 'semantic generation request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') throw new Error('semantic generation request identity or authority mismatch');
  if (!MODES.includes(value.mode)) throw new Error('semantic generation mode is unsupported');
  if (value.tier !== 1) throw new Error('semantic generation only implements consent Tier 1');
  if (value.recipeId !== RECIPE_ID) throw new Error('CAPABILITY_GAP:unsupported native recipe: ' + value.recipeId);
  const blueprintPacket = normalizeBlueprintPacket(value.blueprintPacket);
  if (blueprintPacket.blueprint.value.provides[0] !== REVIEW_CARD_SCHEMA) {
    throw new Error('CAPABILITY_GAP:blueprint output is not the supported Creation Review Card contract');
  }
  const resources = normalizeResourceEnvelope(value.resourceEnvelope);
  const rootsGate = normalizeRootGate(value.rootsGate);
  requirePassingRoots(rootsGate);
  const providerPolicy = normalizeProviderPolicy(value.providerPolicy, value.mode);
  const challengerIngress = value.challengerIngress == null ? null :
    normalizeChallengerIngress(value.challengerIngress, providerPolicy, blueprintPacket);
  if ((challengerIngress !== null) !== providerPolicy.challenger.enabled) {
    throw new Error('AI challenger ingress conflicts with exact provider policy');
  }
  if (!same(value.instructionRef, declarationRef())) throw new Error('semantic generation instruction declaration mismatch');
  const core = {
    schema: REQUEST_SCHEMA,
    id: identifier(value.id, 'semantic generation request.id'),
    goal: strictText(value.goal, 'semantic generation request.goal', 600),
    mode: value.mode,
    tier: 1,
    recipeId: RECIPE_ID,
    blueprintPacket,
    components: normalizeComponents(value.components),
    consent: null,
    resourceEnvelope: resources,
    reuseRights: normalizeReuseRights(value.reuseRights),
    providerPolicy,
    rootsGate,
    challengerIngress,
    instructionRef: declarationRef(),
    authority: 'NONE'
  };
  core.consent = normalizeConsent(value.consent, blueprintPacket, resources);
  const inputBytes = jsonBytes(core).length;
  if (inputBytes > resources.maxInputBytes || inputBytes > MAX_REQUEST_BYTES) {
    throw new Error('semantic generation request exceeds its exact input byte ceiling');
  }
  return core;
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  const sealed = { ...core, requestDigest: sha256Value(core) };
  if (jsonBytes(sealed).length > sealed.resourceEnvelope.maxInputBytes || jsonBytes(sealed).length > MAX_REQUEST_BYTES) {
    throw new Error('sealed semantic generation request exceeds its exact input byte ceiling');
  }
  return sealed;
}

function normalizeRequest(value) {
  exactKeys(value, [
    'schema', 'id', 'goal', 'mode', 'tier', 'recipeId', 'blueprintPacket', 'components',
    'consent', 'resourceEnvelope', 'reuseRights', 'providerPolicy', 'rootsGate',
    'challengerIngress', 'instructionRef', 'authority', 'requestDigest'
  ], 'semantic generation request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (sealed.requestDigest !== digest(requestDigest, 'semantic generation request.requestDigest') || !same(sealed, value)) {
    throw new Error('semantic generation request digest or canonical form mismatch');
  }
  return sealed;
}

function sourceFile(path, bytes) {
  return {
    path,
    encoding: 'base64',
    content: bytes.toString('base64'),
    sha256: sha256Bytes(bytes)
  };
}

function buildTestPlan(candidate) {
  const cases = [
    ['acceptance-lineage', 'Reject candidate input whose exact blueprint or schema lineage drifts.', 'lineage-proof'],
    ['malformed-record', 'Reject malformed consent, candidate, lineage, or Evidence Desk records.', 'schema-behavior'],
    ['truth-ceiling', 'Never render UNKNOWN or UNRUN evidence as PASS.', 'countertest'],
    ['ai-disclosure', 'Always disclose whether AI challenger data contributed to the card.', 'content-inspection'],
    ['authority-visibility', 'Display exact candidate permissions, network scope, tier, and next gate.', 'content-inspection'],
    ['keyboard-operation', 'All Review Inbox choices remain keyboard operable after integration.', 'browser-render-click'],
    ['accessible-rendering', 'The integrated review card has readable labels and programmatic structure.', 'browser-accessibility'],
    ['rollback', 'Discarding the detached candidate leaves no installed or integrated state.', 'filesystem-and-state-proof'],
    ['restart', 'Any later durable decision preserves exact digest binding after restart.', 'restart-proof']
  ].map(([id, claim, evidenceKind]) => ({ id, claim, evidenceKind, verdict: 'UNRUN' }))
    .sort((left, right) => compareText(left.id, right.id));
  return {
    schema: TEST_PLAN_SCHEMA,
    version: VERSION,
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

function reviewAdapterSource() {
  return Buffer.from(`'use strict';

const ROOTS = ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'];
const EVIDENCE = new Set(['PASS', 'FAIL', 'HOLD', 'UNKNOWN', 'UNRUN']);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' must be an object');
  return value;
}

function evidence(value) {
  if (!EVIDENCE.has(value)) throw new TypeError('unsupported evidence verdict');
  return value;
}

function mapEvidence(records) {
  if (!Array.isArray(records)) throw new TypeError('evidence records must be an array');
  return records.map(function (record) {
    object(record, 'evidence record');
    return { id: String(record.id), verdict: evidence(record.verdict), evidenceRef: record.evidenceRef || null };
  });
}

function filterPublicRefs(records) {
  return records.filter(function (record) { return record.private !== true; }).map(function (record) {
    return { id: String(record.id), schema: String(record.schema), sha256: String(record.sha256) };
  });
}

function compareEvidence(records) {
  return records.reduce(function (summary, record) {
    summary[record.verdict] += 1;
    return summary;
  }, { PASS: 0, FAIL: 0, HOLD: 0, UNKNOWN: 0, UNRUN: 0 });
}

function summarize(summary) {
  if (summary.FAIL || summary.HOLD) return 'Evidence contains a failure or hold. Repair or discard this candidate.';
  if (summary.UNKNOWN || summary.UNRUN) return 'Some required evidence is still unknown or unrun. This candidate is not approved.';
  return 'All supplied evidence records say PASS. Human acceptance and later gates are still required.';
}

function renderPlainLanguage(input) {
  object(input, 'review input');
  const records = mapEvidence(input.evidence || []);
  const summary = compareEvidence(records);
  return {
    schema: 'axm.creation-review-card/v1',
    goal: String(input.goal),
    ai: { used: input.lane === 'AI_CHALLENGER', lane: String(input.lane) },
    sourcesUsed: filterPublicRefs(input.sources || []),
    exactChanges: (input.files || []).map(function (file) {
      return { path: String(file.path), sha256: String(file.sha256), byteLength: Number(file.byteLength) };
    }),
    permissions: (input.permissions || []).map(String),
    resources: object(input.resources, 'resources'),
    evidence: { records: records, summary: summary, plainLanguage: summarize(summary) },
    rootsGate: ROOTS.map(function (root) { return { root: root, verdict: 'HOLD_UNTIL_HOST_SUPPLIED' }; }),
    choices: ['ACCEPT_FOR_NEXT_GATE', 'REQUEST_REPAIR', 'DISCARD'],
    authority: 'NONE'
  };
}

module.exports = {
  validate: object,
  mapEvidence,
  filterPublicRefs,
  compareEvidence,
  summarize,
  renderPlainLanguage
};
`, 'utf8');
}

function buildNativeBundle(request) {
  const id = 'creation-review-card-adapter-native';
  const candidate = { id, version: 'v0.1', status: 'EXPERIMENTAL' };
  const generatorRef = {
    id: NATIVE_PROVIDER_ID,
    schema: RECIPE_LIBRARY_SCHEMA,
    sha256: RECIPE_LIBRARY.libraryDigest
  };
  const manifest = {
    schema: TOOL_MANIFEST_SCHEMA,
    id,
    name: 'AXM Creation Review-Card Adapter — Native Candidate',
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'adapter.js',
    contract: 'module.contract.json',
    kind: 'candidate-module',
    uses: [],
    permissions: [],
    summary: 'Pure candidate adapter for translating exact Fabric records into plain-language Review Inbox card data.'
  };
  const contract = {
    schema: MODULE_CONTRACT_SCHEMA,
    id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    provides: [REVIEW_CARD_SCHEMA],
    consumes: [
      Consent.EVALUATION_SCHEMA,
      PACKET_SCHEMA,
      'axm.evidence-receipt/v1'
    ].sort(compareText),
    permissions: [],
    handoffs: { emits: [REVIEW_CARD_SCHEMA], accepts: [PACKET_SCHEMA, Consent.EVALUATION_SCHEMA] },
    rootsGate: ROOTS.slice(),
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'explicit' },
    boundaries: {
      writes: [],
      refuses: [
        'generated-code-execution', 'network-use', 'permission-grant', 'automatic-install',
        'automatic-integration', 'automatic-learning', 'automatic-promotion', 'automatic-canon'
      ]
    }
  };
  const receipt = {
    schema: CANDIDATE_RECEIPT_SCHEMA,
    candidate: { id, version: 'v0.1' },
    creation: { lane: 'NATIVE', generatorRef, declaredStatus: 'EXPERIMENTAL', humanReviewRequired: true },
    authority: {
      installed: false, registered: false, staged: false, integrated: false, published: false,
      learned: false, promoted: false, canonChanged: false, permissionsChanged: false
    },
    truth: {
      generatedCodeExecuted: false,
      runtimeQualityProven: false,
      visualApprovalProven: false,
      humanApproved: false
    }
  };
  const testPlan = buildTestPlan(candidate);
  const readme = Buffer.from(
    '# AXM Creation Review-Card Adapter — Native Candidate\n\n' +
    'Status: `EXPERIMENTAL` · detached candidate data · native-only recipe ' + RECIPE_ID + '.\n\n' +
    'This candidate maps exact Fabric consent, lineage, candidate, and Evidence Desk records into plain-language ' +
    'Review Inbox data. Direct reuse remains RESEARCH_ONLY_HOLD pending Mike’s rights decision. ' +
    'It has not been executed, installed, integrated, visually tested, learned from, promoted, or made CANON.\n',
    'utf8'
  );
  const files = [
    sourceFile('README.md', readme),
    sourceFile('adapter.js', reviewAdapterSource()),
    sourceFile('candidate.receipt.json', jsonBytes(receipt)),
    sourceFile('manifest.json', jsonBytes(manifest)),
    sourceFile('module.contract.json', jsonBytes(contract)),
    sourceFile('test-plan.json', jsonBytes(testPlan))
  ].sort((left, right) => compareText(left.path, right.path));
  return normalizeModuleBundle({ schema: MODULE_BUNDLE_SCHEMA, requiredSeats: 1, files }, id);
}

function packetRef(packet) {
  return { id: packet.candidate.id, schema: packet.schema, sha256: packet.packetDigest };
}

function buildPacketCore(request, lane, bundle, generator, reuseRights, lineageRefs, extraLimitations) {
  const bundleBytes = jsonBytes(bundle.bundle);
  return {
    schema: PACKET_SCHEMA,
    version: VERSION,
    candidate: bundle.candidate,
    lane,
    status: 'EXPERIMENTAL',
    goal: request.goal,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    blueprintRef: request.blueprintPacket.blueprint.ref,
    schemaPacketRefs: [
      request.blueprintPacket.inputSchema.ref,
      request.blueprintPacket.outputSchema.ref,
      request.blueprintPacket.acceptanceMatrix.ref
    ].sort((left, right) => compareText(left.id, right.id)),
    consentEvaluationRef: {
      id: request.consent.evaluationInput.instance.id + '-evaluation',
      schema: request.consent.evaluation.schema,
      sha256: request.consent.evaluation.evaluationDigest
    },
    rootsGate: clone(request.rootsGate),
    generator: clone(generator),
    moduleBundle: clone(bundle.bundle),
    moduleBundleRef: {
      id: bundle.candidate.id + '-module-bundle',
      schema: MODULE_BUNDLE_SCHEMA,
      sha256: 'sha256:' + sha256Bytes(bundleBytes),
      byteLength: bundleBytes.length
    },
    sourceFiles: clone(bundle.sourceFiles),
    testPlanRef: {
      id: bundle.candidate.id + '-test-plan',
      schema: TEST_PLAN_SCHEMA,
      sha256: 'sha256:' + bundle.moduleBundleFileDigest
    },
    declaredAuthority: {
      permissions: bundle.permissions.slice(),
      networkDomains: bundle.networkDomains.slice(),
      lifecycleEffects: []
    },
    resourceObservation: {
      sourceFileCount: bundle.sourceFiles.length,
      sourceBytes: bundle.totalBytes,
      fileCountEnforced: true,
      fileByteCeilingEnforced: true,
      totalByteCeilingEnforced: true,
      attemptCountEnforced: true,
      durationEnforced: false,
      memoryEnforced: false,
      processesSpawned: 0,
      networkUsed: false
    },
    reuseRights: clone(reuseRights),
    lineageRefs: refs(lineageRefs, 'candidate lineageRefs', 1, 64),
    limitations: Array.from(new Set([...LIMITATIONS, ...extraLimitations])).sort(compareText),
    truth: {
      exactBlueprintBytesBound: true,
      compiledSchemasBound: true,
      groundedConsentScopeBound: true,
      fourRootPassDecisionsBound: true,
      fourRootEvidenceContentVerified: false,
      sourceFilesByteBound: true,
      providerCalledByGenerator: false,
      providerCodeLoaded: false,
      candidateCodeExecuted: false,
      runtimeBehaviorProven: false,
      visualBehaviorProven: false,
      authenticatedHumanDecisionVerified: false,
      hostAuthorizationGranted: false,
      installed: false,
      integrated: false,
      published: false,
      persistentLearningAdmitted: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
}

function buildPacket(request, lane, bundle, generator, reuseRights, lineageRefs, extraLimitations = []) {
  const testFile = bundle.sourceFiles.find((file) => file.path === 'test-plan.json');
  bundle.moduleBundleFileDigest = testFile.sha256.slice('sha256:'.length);
  const core = buildPacketCore(request, lane, bundle, generator, reuseRights, lineageRefs, extraLimitations);
  return { ...core, packetDigest: sha256Value(core) };
}

function comparePackets(request, packets) {
  const native = packets[0];
  const challenger = packets.length === 2 ? packets[1] : null;
  const fileMap = (packet) => new Map(packet.sourceFiles.map((file) => [pathKey(file.path), file]));
  let fileDelta = null;
  let permissionDelta = null;
  let evidenceDelta = null;
  if (challenger) {
    const left = fileMap(native);
    const right = fileMap(challenger);
    const keys = Array.from(new Set([...left.keys(), ...right.keys()])).sort(compareText);
    fileDelta = {
      addedByChallenger: keys.filter((key) => !left.has(key)).map((key) => right.get(key)),
      removedByChallenger: keys.filter((key) => !right.has(key)).map((key) => left.get(key)),
      changed: keys.filter((key) => left.has(key) && right.has(key) && left.get(key).sha256 !== right.get(key).sha256)
        .map((key) => ({ path: left.get(key).path, nativeSha256: left.get(key).sha256, challengerSha256: right.get(key).sha256 }))
    };
    permissionDelta = {
      addedByChallenger: challenger.declaredAuthority.permissions.filter((item) => !native.declaredAuthority.permissions.includes(item)),
      removedByChallenger: native.declaredAuthority.permissions.filter((item) => !challenger.declaredAuthority.permissions.includes(item)),
      networkAddedByChallenger: challenger.declaredAuthority.networkDomains.filter((item) => !native.declaredAuthority.networkDomains.includes(item)),
      networkRemovedByChallenger: native.declaredAuthority.networkDomains.filter((item) => !challenger.declaredAuthority.networkDomains.includes(item))
    };
    evidenceDelta = {
      nativeTestPlanRef: native.testPlanRef,
      challengerTestPlanRef: challenger.testPlanRef,
      sameTestPlanBytes: native.testPlanRef.sha256 === challenger.testPlanRef.sha256
    };
  }
  const core = {
    schema: COMPARISON_SCHEMA,
    version: VERSION,
    status: challenger ? 'ALTERNATIVES_PRESERVED' : 'NATIVE_ONLY',
    goal: request.goal,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    alternatives: packets.map((packet) => ({
      lane: packet.lane,
      candidateRef: packetRef(packet),
      generator: packet.generator,
      permissions: packet.declaredAuthority.permissions,
      networkDomains: packet.declaredAuthority.networkDomains,
      reuseRights: packet.reuseRights,
      testPlanRef: packet.testPlanRef
    })),
    fileDelta,
    permissionDelta,
    evidenceDelta,
    ranking: null,
    selection: null,
    combination: 'NEW_REQUEST_AND_EXACT_CONSENT_REQUIRED',
    dissentPreserved: true,
    truth: {
      alternativesExecuted: false,
      semanticEquivalenceProven: false,
      qualityWinnerProven: false,
      automaticChoiceMade: false,
      automaticMergeMade: false
    },
    authority: 'NONE'
  };
  return { ...core, comparisonDigest: sha256Value(core) };
}

function buildReviewCard(request, packet, comparison) {
  const unknownEvidence = packet.moduleBundle.files
    .find((file) => file.path === 'test-plan.json');
  const plan = JSON.parse(Buffer.from(unknownEvidence.content, 'base64').toString('utf8'));
  const core = {
    schema: REVIEW_CARD_SCHEMA,
    version: VERSION,
    status: 'REVIEW_REQUIRED',
    goal: request.goal,
    candidateRef: packetRef(packet),
    comparisonRef: { id: request.id + '-alternatives', schema: comparison.schema, sha256: comparison.comparisonDigest },
    tier: 1,
    ai: {
      used: packet.lane === 'AI_CHALLENGER',
      lane: packet.lane,
      providerRef: packet.lane === 'AI_CHALLENGER' ? packet.generator.providerRef : null,
      directReuseRightsHeld: packet.lane === 'AI_CHALLENGER'
    },
    sourcesUsed: packet.lineageRefs,
    exactChanges: packet.sourceFiles,
    permissions: packet.declaredAuthority.permissions,
    networkDomains: packet.declaredAuthority.networkDomains,
    resources: packet.resourceObservation,
    reuseRights: packet.reuseRights,
    rootsGate: packet.rootsGate,
    evidence: {
      passed: [],
      failed: [],
      held: [],
      unknown: plan.cases.map((item) => ({ id: item.id, evidenceKind: item.evidenceKind, verdict: 'UNRUN' }))
    },
    limitations: packet.limitations,
    controls: {
      stop: 'DISCARD_DETACHED_CANDIDATE',
      revoke: 'REVOKE_OR_EXPIRE_BEFORE_ANY_HIGHER_TIER',
      rollback: 'REMOVE_ONLY_THE_UNINSTALLED_DETACHED_CANDIDATE',
      changedBytes: 'NEW_REQUEST_AND_RECONSENT_REQUIRED'
    },
    choices: [
      { id: 'ACCEPT_FOR_NEXT_GATE', effect: 'REQUEST_AUTHENTICATED_HUMAN_DECISION_ONLY' },
      { id: 'REQUEST_REPAIR', effect: 'NEW_CANDIDATE_BYTES_REQUIRED' },
      { id: 'DISCARD', effect: 'NO_INSTALL_OR_INTEGRATION' }
    ],
    nextGate: 'AUTHENTICATED_HUMAN_DECISION_REQUIRED',
    truth: {
      unknownRenderedAsPass: false,
      aiInvolvementHidden: false,
      approvalSeatImpersonated: false,
      changedBytesApproved: false,
      candidateExecuted: false,
      installed: false,
      integrated: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  return { ...core, cardDigest: sha256Value(core) };
}

function generate(input) {
  const request = normalizeRequest(input);
  const nativeBundle = buildNativeBundle(request);
  const nativePacket = buildPacket(
    request,
    'NATIVE',
    nativeBundle,
    { lane: 'NATIVE', providerId: NATIVE_PROVIDER_ID, recipeLibraryRef: recipeLibraryRef(), recipeId: RECIPE_ID },
    { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, authorityRef: null },
    [
      ...request.components.map((item) => item.ref),
      { id: request.blueprintPacket.blueprint.ref.id, schema: request.blueprintPacket.blueprint.ref.schema, sha256: request.blueprintPacket.blueprint.value.blueprintDigest }
    ]
  );
  const packets = [nativePacket];
  if (request.challengerIngress) {
    const ingress = request.challengerIngress;
    const challengerBundle = normalizeModuleBundle(ingress.moduleBundle, ingress.candidateId);
    packets.push(buildPacket(
      request,
      'AI_CHALLENGER',
      challengerBundle,
      { lane: 'AI_CHALLENGER', providerRef: clone(ingress.routePlan.selected), routePlanRef: {
        id: request.id + '-challenger-route', schema: Fabric.PLAN_SCHEMA, sha256: ingress.routePlan.planDigest
      } },
      ingress.reuseRights,
      ingress.lineageRefs,
      ingress.limitations
    ));
  }
  if (packets.length > request.resourceEnvelope.maxAttempts + 1 || packets.length > MAX_CANDIDATES) {
    throw new Error('semantic candidate count exceeds its fixed ceiling');
  }
  const comparison = comparePackets(request, packets);
  const reviewCards = packets.map((packet) => buildReviewCard(request, packet, comparison));
  const result = {
    request,
    packets,
    comparison,
    reviewCards,
    truth: {
      deterministicGenerationOnly: true,
      providerCalled: false,
      candidateCodeExecuted: false,
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
  const outputBytes = jsonBytes(result).length;
  if (outputBytes > request.resourceEnvelope.maxOutputBytes) {
    throw new Error('complete semantic generation result exceeds the consented output byte ceiling');
  }
  return result;
}

function verifyGeneration(result, input) {
  const errors = [];
  try {
    const rebuilt = generate(input);
    if (!same(result, rebuilt)) throw new Error('semantic generation differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function buildCapabilityGap(recipeId, goal) {
  const core = {
    schema: CAPABILITY_GAP_SCHEMA,
    version: VERSION,
    status: 'MISSING_TYPED_RECIPE',
    requestedRecipeId: strictText(recipeId, 'capability gap recipe id', 120),
    goal: strictText(goal, 'capability gap goal', 600),
    supportedRecipeIds: [RECIPE_ID],
    proposedHandContract: {
      provides: ['versioned-native-recipe'],
      mustPreserve: ['exact-byte-lineage', 'permissionless-generation', 'UNRUN-evidence', 'human-merge-gate'],
      authority: 'NONE'
    },
    truth: { implementationAvailable: false, fallbackPretended: false },
    authority: 'NONE'
  };
  return { ...core, gapDigest: sha256Value(core) };
}

function component(contract) {
  return {
    ref: { id: contract.id, schema: contract.schema, sha256: sha256Value(contract) },
    contract: clone(contract)
  };
}

function buildExampleRequest() {
  const intent = Composer.sealIntent({
    schema: Composer.INTENT_SCHEMA,
    id: 'creation-review-card-adapter',
    name: 'Creation Review-Card Adapter',
    purpose: 'Convert exact Fabric consent, lineage, candidate, and evidence records into plain-language Review Inbox card data without executing candidates or granting authority.',
    capability: REVIEW_CARD_SCHEMA,
    status: 'EXPERIMENTAL',
    kind: 'PURE_DATA_TRANSFORM',
    inputFields: [
      { id: 'candidate-record', type: 'object', required: true, description: 'One exact semantic candidate packet.' },
      { id: 'consent-record', type: 'object', required: true, description: 'One exact grounded consent evaluation.' },
      { id: 'evidence-records', type: 'array', required: true, description: 'Bounded Evidence Desk verdict records.' },
      { id: 'lineage-records', type: 'array', required: true, description: 'Exact public lineage references.' }
    ],
    outputFields: [
      { id: 'creation-review-card', type: 'object', source: 'creation-review-card', description: 'Plain-language Review Inbox card data.' }
    ],
    steps: [
      { id: 'validate-records', operation: 'VALIDATE', reads: ['candidate-record', 'consent-record', 'evidence-records', 'lineage-records'], produces: 'validated-records', description: 'Reject malformed, drifted, or authority-expanding records.' },
      { id: 'select-public-fields', operation: 'SELECT', reads: ['validated-records'], produces: 'public-fields', description: 'Keep exact review fields while excluding private content and hidden reasoning.' },
      { id: 'map-review-data', operation: 'TRANSFORM', reads: ['public-fields'], produces: 'mapped-review-data', description: 'Map exact candidate, consent, evidence, and lineage fields without truth inflation.' },
      { id: 'format-plain-language', operation: 'FORMAT', reads: ['mapped-review-data'], produces: 'plain-language-review', description: 'Render limitations and choices in plain language.' },
      { id: 'emit-review-card', operation: 'EMIT', reads: ['plain-language-review'], produces: 'creation-review-card', description: 'Emit inert Review Inbox card data for later authenticated human decision.' }
    ],
    qualityClaims: [
      'AI involvement remains visible.',
      'Changed bytes require a new decision.',
      'Unknown or unrun evidence never becomes pass.',
      'The adapter grants no install, integration, learning, promotion, or CANON authority.'
    ],
    resourceBudget: {
      maxInputBytes: 65536,
      maxOutputBytes: 65536,
      maxDurationMs: 1000,
      maxMemoryBytes: 67108864,
      maxOperations: 6
    },
    authority: 'NONE'
  });
  const blueprint = Composer.buildBlueprint(intent);
  const inputSchema = Compiler.buildInterfaceSchema(blueprint, 'input');
  const outputSchema = Compiler.buildInterfaceSchema(blueprint, 'output');
  const matrix = Compiler.buildAcceptanceMatrix(blueprint, inputSchema, outputSchema);
  const blueprintPacket = {
    intent,
    blueprint: artifact(blueprint, blueprint.id, Composer.BLUEPRINT_SCHEMA),
    inputSchema: artifact(inputSchema, blueprint.id + '-input-schema', inputSchema.$id),
    outputSchema: artifact(outputSchema, blueprint.id + '-output-schema', outputSchema.$id),
    acceptanceMatrix: artifact(matrix, blueprint.id + '-acceptance-matrix', Compiler.MATRIX_SCHEMA)
  };
  const resources = {
    maxInputBytes: MAX_REQUEST_BYTES,
    maxOutputBytes: MAX_CANDIDATE_BYTES * MAX_CANDIDATES,
    maxMemoryBytes: 134217728,
    maxDurationMs: 5000,
    maxProcesses: 1,
    maxAttempts: 1,
    maxCostMinorUnits: 0
  };
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'semantic-generation-tier-one-policy',
    validFrom: '2026-08-22T18:00:00.000Z',
    expiresAt: '2026-08-23T18:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [Composer.BLUEPRINT_SCHEMA],
      domainProfileSchemas: [PROFILE_SCHEMA],
      allowedActions: ['code.generate-inert-semantic-candidate'],
      allowedPermissions: [],
      allowedNetworkDomains: [],
      allowedDataClasses: ['public-generated-artifact', 'public-instruction'],
      allowedSourceUses: ['derive-concepts'],
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: resources,
      requiredPredecisionEvidenceSchemas: ['axm.code-policy-bound-assurance-review/v1'],
      requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice()
    }],
    rootsGate: ROOTS.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'creation-review-card-semantic-generation',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: { id: blueprint.id, schema: blueprint.schema, sha256: blueprint.blueprintDigest },
    domainProfileRef: profileRef(),
    predecisionEvidenceRefs: [{
      id: 'semantic-generator-four-root-review',
      schema: 'axm.code-policy-bound-assurance-review/v1',
      sha256: sha256Value('semantic-generator-four-root-review')
    }],
    inputArtifacts: [
      blueprintPacket.blueprint.ref,
      blueprintPacket.inputSchema.ref,
      blueprintPacket.outputSchema.ref,
      blueprintPacket.acceptanceMatrix.ref
    ],
    actions: ['code.generate-inert-semantic-candidate'],
    permissions: [],
    networkDomains: [],
    dataClasses: ['public-generated-artifact', 'public-instruction'],
    sourceUses: ['derive-concepts'],
    lifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
    resources,
    requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice(),
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T19:00:00.000Z',
    expiresAt: '2026-08-22T20:00:00.000Z',
    authority: 'NONE'
  });
  const evaluationInput = { policy, instance, evaluatedAt: '2026-08-22T19:10:00.000Z' };
  const contractsById = {
    'code-recipe-foundry': require('../../tools/code-recipe-foundry/module.contract.json'),
    'detached-candidate-nursery': require('../../tools/detached-candidate-nursery/module.contract.json'),
    'deterministic-json-core': require('../../tools/deterministic-json-core/module.contract.json'),
    'evidence-desk': require('../../tools/evidence-desk/module.contract.json'),
    'review-inbox': require('../../tools/review-inbox/module.contract.json')
  };
  const rootEvidence = ROOTS.map((root) => ({
    root,
    verdict: 'PASS',
    evidenceRefs: [{
      id: 'semantic-generator-' + root,
      schema: 'axm.four-root-technical-review/v1',
      sha256: sha256Value('semantic-generator-' + root)
    }]
  }));
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id: 'generate-creation-review-card-adapter',
    goal: 'Create one detached, inert Creation Review-Card Adapter candidate from exact Fabric records.',
    mode: 'NATIVE_ONLY',
    tier: 1,
    recipeId: RECIPE_ID,
    blueprintPacket,
    components: REQUIRED_COMPONENT_IDS.map((id) => component(contractsById[id])),
    consent: { evaluationInput, evaluation: Consent.evaluateGroundedConsent(evaluationInput) },
    resourceEnvelope: resources,
    reuseRights: { nativeRecipe: 'DECLARED_REUSE_ALLOWED', aiChallenger: 'RESEARCH_ONLY_HOLD' },
    providerPolicy: {
      nativeProviderId: NATIVE_PROVIDER_ID,
      recipeLibraryRef: recipeLibraryRef(),
      challenger: {
        enabled: false,
        exactProvider: null,
        routePlanDigest: null,
        allowedCandidatePermissions: [],
        allowedCandidateNetworkDomains: []
      }
    },
    rootsGate: rootEvidence,
    challengerIngress: null,
    instructionRef: declarationRef(),
    authority: 'NONE'
  });
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  PACKET_SCHEMA,
  COMPARISON_SCHEMA,
  REVIEW_CARD_SCHEMA,
  PROFILE_SCHEMA,
  RECIPE_LIBRARY_SCHEMA,
  TEST_PLAN_SCHEMA,
  CAPABILITY_GAP_SCHEMA,
  NATIVE_PROVIDER_ID,
  RECIPE_ID,
  ROOTS,
  MODES,
  NATIVE_OPERATIONS,
  REQUIRED_COMPONENT_IDS,
  REQUIRED_CANDIDATE_FILES,
  LIMITATIONS,
  PROFILE,
  RECIPE_LIBRARY,
  MAX_REQUEST_BYTES,
  MAX_CANDIDATE_FILES,
  MAX_FILE_BYTES,
  MAX_CANDIDATE_BYTES,
  canonicalJson,
  sha256Value,
  jsonBytes,
  normalizePortablePath,
  pathKey,
  profileRef,
  recipeLibraryRef,
  declarationRef,
  sealRequest,
  normalizeRequest,
  normalizeModuleBundle,
  buildNativeBundle,
  comparePackets,
  buildReviewCard,
  generate,
  verifyGeneration,
  buildCapabilityGap,
  buildExampleRequest,
  clone
};
