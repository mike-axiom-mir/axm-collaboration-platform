'use strict';

const Fabric = require('./code-capability-fabric-v2');
const Consent = require('./grounded-consent-scope-v1');
const Composer = require('./declarative-blueprint-composer-v1');
const Discovery = require('./code-recipe-discovery-v1');
const Bridge = require('./code-recipe-fabric-bridge-v1');
const MODULE_CONTRACT = require('./module-code-recipe-application-planner-v1.contract.json');

const VERSION = '1.2.0';
const REQUEST_SCHEMA = 'axm.code-recipe-application-request/v1';
const PLAN_SCHEMA = 'axm.code-recipe-application-plan/v1';
const APPLICATION_MODE = 'INDEPENDENT_NATIVE_REIMPLEMENTATION_PLAN';
const CONSENT_ACTION = 'code.plan-independent-native-reimplementation';
const NEXT_GATE = 'AUTHENTICATE_EXACT_HUMAN_DECISION_THEN_REQUEST_ONE_DETACHED_CANDIDATE';
const TARGET_RUNTIME = 'NATIVE_JAVASCRIPT_PURE_FUNCTION';
const ROOTS = Consent.ROOTS_GATE.slice();
const MAX_MAPPINGS = 8;
const MAX_REQUEST_BYTES = 524288;
const MAX_PLAN_BYTES = 524288;
const REQUIRED_DATA_CLASSES = Object.freeze(['public-blueprint', 'public-recipe-metadata']);
const REQUIRED_SOURCE_USES = Object.freeze(['derive-concepts', 'reference-metadata-only']);
const REQUIRED_EVIDENCE_SCHEMAS = Object.freeze([
  PLAN_SCHEMA,
  'axm.determinism-evidence/v1',
  'axm.four-root-technical-review/v1',
  'axm.static-structure-evidence/v1'
].sort(compareText));
const OPERATION_RULES = Object.freeze({
  FILTER_VALUES: Object.freeze({ blueprintOperation: 'SELECT', requiredTag: 'filter' }),
  MAP_VALUES: Object.freeze({ blueprintOperation: 'TRANSFORM', requiredTag: 'map' })
});
const LIMITATIONS = Object.freeze([
  'AUTHENTICATED_HUMAN_DECISION_NOT_VERIFIED',
  'CANDIDATE_CODE_NOT_GENERATED',
  'CORRECTNESS_NOT_PROVEN',
  'DIRECT_REUSE_NOT_AUTHORIZED',
  'DOMAIN_FIT_NOT_PROVEN',
  'IMPLEMENTATION_NOT_STARTED',
  'INFORMED_UNDERSTANDING_NOT_PROVEN',
  'RECIPE_SOURCE_NOT_APPLIED',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'SAFETY_NOT_PROVEN',
  'SEMANTIC_MAPPING_NOT_INFERRED',
  'SOURCE_AND_LICENSE_CLAIMS_UNVERIFIED',
  'TESTS_NOT_RUN',
  'TRUSTED_CLOCK_NOT_OBSERVED'
]);
const DECLARATION = Object.freeze({
  schema: 'axm.interactive-authorization-declaration/v1',
  id: 'code-recipe-application-plan-interactive-declaration',
  scope: 'ONE_INERT_APPLICATION_PLAN',
  acknowledgement: 'Produce one deterministic plan only. Do not copy recipe source, generate or execute code, write a candidate, install, integrate, promote, or change CANON.',
  authority: 'NONE'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const SOURCE_ID = /^CC-[0-9]{4}$/;
const STEP_ID = /^[a-z][a-z0-9-]{0,63}$/;

function canonicalJson(value) { return Fabric.canonicalJson(value); }
function clone(value) { return Fabric.clone(value); }
function sha256(value) { return Fabric.sha256(value); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function fail(message) { throw new Error(message); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(label + ' must be a plain object');
  }
  return value;
}

function exact(value, keys, label) {
  object(value, label);
  if (!same(Object.keys(value).sort(compareText), keys.slice().sort(compareText))) {
    fail(label + ' fields must be exactly ' + keys.slice().sort(compareText).join(', '));
  }
  return value;
}

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.length || value.trim() !== value ||
      /[\u0000-\u001f\u007f]/.test(value) || Buffer.byteLength(value, 'utf8') > maximum) {
    fail(label + ' must be bounded canonical text');
  }
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

function uniqueSorted(values, label, minimum, maximum, normalizer, key = canonicalJson) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    fail(label + ' must contain from ' + minimum + ' to ' + maximum + ' items');
  }
  const normalized = values.map((value, index) => normalizer(value, label + '[' + index + ']'));
  const keys = normalized.map(key);
  if (new Set(keys).size !== keys.length) fail(label + ' contains duplicates');
  return normalized.sort((left, right) => compareText(key(left), key(right)));
}

function ref(id, schema, digest) { return { id, schema, sha256: digest }; }
function blueprintRef(blueprint) { return ref(blueprint.id, blueprint.schema, blueprint.blueprintDigest); }
function moduleRef() { return ref(MODULE_CONTRACT.id, MODULE_CONTRACT.schema, sha256(MODULE_CONTRACT)); }
function declarationRef() { return ref(DECLARATION.id, DECLARATION.schema, sha256(DECLARATION)); }
function evaluationRef(requestId, evaluation) { return ref(requestId + '-consent-evaluation', evaluation.schema, evaluation.evaluationDigest); }
function artifactFrom(id, schema, digest, value) {
  return { id, schema, sha256: digest, byteLength: jsonBytes(value).length };
}

function normalizeResources(value) {
  exact(value, ['maxInputBytes', 'maxOutputBytes', 'maxMemoryBytes', 'maxDurationMs', 'maxProcesses', 'maxAttempts', 'maxCostMinorUnits'], 'resourceEnvelope');
  const result = {
    maxInputBytes: integer(value.maxInputBytes, 'resourceEnvelope.maxInputBytes', 1, MAX_REQUEST_BYTES),
    maxOutputBytes: integer(value.maxOutputBytes, 'resourceEnvelope.maxOutputBytes', 1, MAX_PLAN_BYTES),
    maxMemoryBytes: integer(value.maxMemoryBytes, 'resourceEnvelope.maxMemoryBytes', 1, 1073741824),
    maxDurationMs: integer(value.maxDurationMs, 'resourceEnvelope.maxDurationMs', 1, 60000),
    maxProcesses: value.maxProcesses,
    maxAttempts: value.maxAttempts,
    maxCostMinorUnits: value.maxCostMinorUnits
  };
  if (result.maxProcesses !== 1 || result.maxAttempts !== 1 || result.maxCostMinorUnits !== 0) {
    fail('application planning supports one declared host process, one attempt, and zero cost only');
  }
  return result;
}

function normalizeRoots(value) {
  if (!Array.isArray(value) || value.length !== ROOTS.length) fail('rootsGate must contain four decisions');
  return value.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index]) fail('rootsGate must use the exact AXM root order');
    if (entry.verdict !== 'PASS') fail('ROOTS_GATE_HOLD:' + entry.root + '=' + entry.verdict);
    const evidenceRefs = uniqueSorted(entry.evidenceRefs, 'rootsGate[' + index + '].evidenceRefs', 1, 8, reference);
    return { root: entry.root, verdict: 'PASS', evidenceRefs };
  });
}

function normalizeMappings(value, maximum) {
  const mappings = uniqueSorted(value, 'mappings', 1, maximum, (entry, label) => {
    exact(entry, ['sourceId', 'targetStepId', 'nativeOperation'], label);
    if (!SOURCE_ID.test(entry.sourceId)) fail(label + '.sourceId is invalid');
    if (!STEP_ID.test(entry.targetStepId)) fail(label + '.targetStepId is invalid');
    if (!Object.prototype.hasOwnProperty.call(OPERATION_RULES, entry.nativeOperation)) {
      fail(label + '.nativeOperation is unsupported');
    }
    return { sourceId: entry.sourceId, targetStepId: entry.targetStepId, nativeOperation: entry.nativeOperation };
  }, (entry) => entry.sourceId);
  if (new Set(mappings.map((entry) => entry.targetStepId)).size !== mappings.length) {
    fail('mappings cannot ambiguously target the same blueprint step');
  }
  return mappings;
}

function normalizeConsent(value, requestId, blueprint, discovery, selection, resources) {
  exact(value, ['evaluationInput', 'evaluation'], 'consent');
  exact(value.evaluationInput, ['policy', 'instance', 'evaluatedAt'], 'consent.evaluationInput');
  const verification = Consent.verifyEvaluation(value.evaluation, value.evaluationInput);
  if (!verification.pass) fail('grounded consent evaluation verification failed: ' + verification.errors.join('|'));
  const policy = Consent.normalizePolicy(value.evaluationInput.policy);
  const instance = Consent.normalizeInstance(value.evaluationInput.instance);
  const evaluation = Consent.normalizeEvaluation(value.evaluation);
  if (evaluation.status !== 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' || evaluation.holds.length !== 0 ||
      evaluation.truth.authenticatedHumanDecisionVerified !== false) {
    fail('application planning requires valid consent scope with exact human authentication still outstanding');
  }
  const expectedBlueprintRef = blueprintRef(blueprint);
  const discoveryRef = Discovery.packetRef(discovery);
  const selectionRef = Bridge.selectionPacketRef(selection);
  if (!same(instance.subjectRef, expectedBlueprintRef)) fail('consent subject does not bind the exact blueprint');
  if (!same(instance.domainProfileRef, moduleRef())) fail('consent domain profile does not bind the application planner contract');
  if (!same(instance.predecisionEvidenceRefs, [discoveryRef, selectionRef].sort((a, b) => compareText(canonicalJson(a), canonicalJson(b))))) {
    fail('consent predecision evidence does not bind exact discovery and selection packets');
  }
  const expectedArtifacts = [
    artifactFrom(blueprint.id, blueprint.schema, blueprint.blueprintDigest, blueprint),
    artifactFrom(discovery.id, discovery.schema, discovery.packetDigest, discovery),
    artifactFrom(selection.id, selection.schema, selection.packetDigest, selection)
  ].sort((a, b) => compareText(canonicalJson(a), canonicalJson(b)));
  if (!same(instance.inputArtifacts, expectedArtifacts)) fail('consent input artifacts do not bind exact blueprint, discovery, and selection bytes');
  if (instance.domain !== 'code' || !same(instance.actions, [CONSENT_ACTION]) || instance.permissions.length ||
      instance.networkDomains.length || !same(instance.dataClasses, REQUIRED_DATA_CLASSES) ||
      !same(instance.sourceUses, REQUIRED_SOURCE_USES) || !same(instance.resources, resources) ||
      !same(instance.requiredEvidenceSchemas, REQUIRED_EVIDENCE_SCHEMAS)) {
    fail('consent scope does not match the exact permissionless application-planning contract');
  }
  if (Object.values(instance.lifecycle).some(Boolean)) fail('consent scope cannot grant lifecycle authority');
  if (!same(instance.reconsentTriggers, Consent.MANDATORY_RECONSENT_TRIGGERS.slice().sort(compareText)) ||
      !same(instance.stopConditions, Consent.MANDATORY_STOP_CONDITIONS.slice().sort(compareText))) {
    fail('consent scope does not preserve mandatory re-consent and stop conditions');
  }
  return {
    evaluationInput: { policy, instance, evaluatedAt: value.evaluationInput.evaluatedAt },
    evaluation
  };
}

function validateRecipeMappings(discovery, selection, mappings, blueprint) {
  if (selection.mode !== 'REFERENCE_ONLY' || selection.reuseRights.state !== 'RESEARCH_ONLY_HOLD' ||
      selection.reuseRights.directReuseAllowed !== false || selection.selectedRecipes.some((recipe) => recipe.snippet !== null)) {
    fail('application planning accepts reference-only held-rights recipe evidence without snippet source');
  }
  const selectedIds = selection.selectedRecipes.map((recipe) => recipe.sourceId).sort(compareText);
  const mappedIds = mappings.map((mapping) => mapping.sourceId).sort(compareText);
  if (!same(selectedIds, mappedIds)) fail('mappings must name every and only exact selected recipe identity');
  const eligible = new Map(discovery.eligibleResults.map((recipe) => [recipe.sourceId, recipe]));
  const held = new Set(discovery.heldResults.map((recipe) => recipe.sourceId));
  const steps = new Map(blueprint.composition.steps.map((step) => [step.id, step]));
  for (const mapping of mappings) {
    if (held.has(mapping.sourceId)) fail('HELD_RECIPE_APPLICATION_REFUSED:' + mapping.sourceId);
    const discovered = eligible.get(mapping.sourceId);
    if (!discovered) fail('selected recipe was not visible in eligible discovery evidence: ' + mapping.sourceId);
    const selected = selection.selectedRecipes.find((recipe) => recipe.sourceId === mapping.sourceId);
    if (!selected || selected.recipeId !== discovered.recipeId || selected.title !== discovered.title ||
        !same(selected.snippetRef, { sha256: discovered.snippetRef.sha256, byteLength: discovered.snippetRef.byteLength })) {
      fail('selected recipe metadata or byte lineage differs from discovery evidence: ' + mapping.sourceId);
    }
    const step = steps.get(mapping.targetStepId);
    if (!step) fail('mapping target step is absent from the exact blueprint: ' + mapping.targetStepId);
    const rule = OPERATION_RULES[mapping.nativeOperation];
    if (step.operation !== rule.blueprintOperation) {
      fail('native operation is structurally incompatible with blueprint step: ' + mapping.nativeOperation + '!=' + step.operation);
    }
    const tags = selected.tags.map((tag) => tag.toLowerCase());
    if (!tags.includes(rule.requiredTag)) {
      fail('recipe metadata does not mechanically support declared native operation: ' + mapping.sourceId + ':' + rule.requiredTag);
    }
  }
}

function requestCore(value) {
  exact(value, ['schema', 'id', 'tier', 'applicationMode', 'intent', 'blueprint', 'discoveryEvidence', 'recipeSelection',
    'mappings', 'consent', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority'], 'application request');
  if (value.schema !== REQUEST_SCHEMA || value.tier !== 1 || value.applicationMode !== APPLICATION_MODE || value.authority !== 'NONE') {
    fail('application request identity, tier, mode, or authority mismatch');
  }
  const id = text(value.id, 'application request.id', 109);
  if (!ID.test(id)) fail('application request.id is invalid');
  const intent = Composer.normalizeIntent(value.intent);
  const blueprint = Composer.normalizeBlueprint(value.blueprint, intent);
  const discovery = Discovery.normalizeDiscoveryPacket(value.discoveryEvidence);
  const selection = Bridge.normalizeInstalledSelectionPacket(value.recipeSelection);
  const resources = normalizeResources(value.resourceEnvelope);
  const mappings = normalizeMappings(value.mappings, Math.min(MAX_MAPPINGS, selection.selectedRecipes.length));
  validateRecipeMappings(discovery, selection, mappings, blueprint);
  const rootsGate = normalizeRoots(value.rootsGate);
  if (!same(value.instructionRef, declarationRef())) fail('application request instruction declaration mismatch');
  const consent = normalizeConsent(value.consent, id, blueprint, discovery, selection, resources);
  const core = {
    schema: REQUEST_SCHEMA,
    id,
    tier: 1,
    applicationMode: APPLICATION_MODE,
    intent,
    blueprint,
    discoveryEvidence: discovery,
    recipeSelection: selection,
    mappings,
    consent,
    resourceEnvelope: resources,
    rootsGate,
    instructionRef: declarationRef(),
    authority: 'NONE'
  };
  if (jsonBytes(core).length > resources.maxInputBytes || jsonBytes(core).length > MAX_REQUEST_BYTES) {
    fail('application request exceeds its exact input byte ceiling');
  }
  return core;
}

function sealRequest(value) {
  const core = requestCore(value);
  const sealed = { ...core, requestDigest: sha256(core) };
  if (jsonBytes(sealed).length > sealed.resourceEnvelope.maxInputBytes) fail('sealed application request exceeds its exact input byte ceiling');
  return sealed;
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'tier', 'applicationMode', 'intent', 'blueprint', 'discoveryEvidence', 'recipeSelection',
    'mappings', 'consent', 'resourceEnvelope', 'rootsGate', 'instructionRef', 'authority', 'requestDigest'], 'application request');
  const copy = clone(value);
  delete copy.requestDigest;
  const expected = sealRequest(copy);
  if (value.requestDigest !== expected.requestDigest || !same(value, expected)) fail('application request digest or canonical form mismatch');
  return expected;
}

function applicationRecord(mapping, request) {
  const selected = request.recipeSelection.selectedRecipes.find((recipe) => recipe.sourceId === mapping.sourceId);
  const discovered = request.discoveryEvidence.eligibleResults.find((recipe) => recipe.sourceId === mapping.sourceId);
  const step = request.blueprint.composition.steps.find((item) => item.id === mapping.targetStepId);
  return {
    sourceId: selected.sourceId,
    recipeId: selected.recipeId,
    recipeEvidence: {
      title: selected.title,
      primaryLanguage: selected.primaryLanguage,
      domain: selected.domain,
      tags: clone(selected.tags),
      snippetRef: clone(selected.snippetRef),
      syntaxStatus: selected.syntaxEvidence.status,
      discoveryEligibility: discovered.eligibility
    },
    requesterMapping: {
      targetStepId: step.id,
      blueprintOperation: step.operation,
      nativeOperation: mapping.nativeOperation,
      inferredByMachine: false,
      authenticatedHumanChoiceVerified: false
    },
    nativeImplementationOutline: {
      targetRuntime: TARGET_RUNTIME,
      reads: clone(step.reads),
      produces: step.produces,
      implementationStatus: 'NOT_STARTED',
      candidateCodeIncluded: false
    },
    sourceTreatment: {
      mode: 'METADATA_REFERENCE_ONLY',
      snippetBytesEmitted: false,
      snippetBytesCopied: false,
      snippetBytesApplied: false,
      snippetExecuted: false,
      independentImplementationRequired: true,
      reuseRights: 'RESEARCH_ONLY_HOLD',
      directReuseAllowed: false
    }
  };
}

function buildPlan(requestValue) {
  const request = normalizeRequest(requestValue);
  const requestRef = ref(request.id, request.schema, request.requestDigest);
  const bRef = blueprintRef(request.blueprint);
  const dRef = Discovery.packetRef(request.discoveryEvidence);
  const sRef = Bridge.selectionPacketRef(request.recipeSelection);
  const consentEvaluation = request.consent.evaluation;
  const base = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    id: request.id + '-plan',
    status: 'TEST',
    planningStatus: 'CONSENT_SCOPE_VALID_AUTHENTICATION_REQUIRED',
    applicationMode: APPLICATION_MODE,
    applicationRequest: request,
    requestRef,
    blueprintRef: bRef,
    discoveryEvidenceRef: dRef,
    recipeSelectionRef: sRef,
    consentGate: {
      status: consentEvaluation.status,
      policyRef: clone(consentEvaluation.policyRef),
      instanceRef: clone(consentEvaluation.instanceRef),
      evaluationRef: evaluationRef(request.id, consentEvaluation),
      scopeValidated: true,
      authenticatedHumanDecisionVerified: false,
      hostAuthorizationGranted: false
    },
    applicationRecords: request.mappings.map((mapping) => applicationRecord(mapping, request)),
    acceptancePlan: request.blueprint.acceptancePlan.map((item) => ({
      id: item.id,
      claim: item.claim,
      evidenceRequired: item.evidenceRequired,
      executionStatus: 'NOT_RUN',
      verdict: 'UNKNOWN'
    })),
    candidate: null,
    resourceObservation: {
      requestBytes: jsonBytes(request).length,
      planBytes: 1,
      mappingCount: request.mappings.length,
      catalogRecipesVerified: 1000,
      childProcessesSpawned: 0,
      networkUsed: false,
      targetWorkspaceRead: false,
      targetWorkspaceWrite: false,
      requestByteCeilingEnforced: true,
      planByteCeilingEnforced: true,
      mappingCeilingEnforced: true,
      attemptCeilingEnforced: true
    },
    lineageRefs: [
      requestRef,
      bRef,
      dRef,
      sRef,
      clone(consentEvaluation.policyRef),
      clone(consentEvaluation.instanceRef),
      evaluationRef(request.id, consentEvaluation),
      moduleRef()
    ],
    limitations: LIMITATIONS.slice().sort(compareText),
    nextGate: NEXT_GATE,
    truth: {
      exactBlueprintVerified: true,
      installedDiscoveryVerified: true,
      installedSelectionVerified: true,
      selectedRecipesVisibleAsEligible: true,
      requesterMappingsBound: true,
      semanticMappingInferred: false,
      consentScopeValidated: true,
      authenticatedHumanDecisionVerified: false,
      informedUnderstandingProven: false,
      trustedClockObserved: false,
      hostAuthorizationGranted: false,
      sourceClaimsVerified: false,
      licensesVerified: false,
      directReuseAuthorized: false,
      snippetBytesIncluded: false,
      snippetBytesCopied: false,
      snippetBytesApplied: false,
      snippetsExecuted: false,
      independentNativeImplementationPlanned: true,
      candidateGenerated: false,
      candidateExecuted: false,
      testsRun: false,
      runtimeBehaviorProven: false,
      correctnessProven: false,
      safetyProven: false,
      installed: false,
      integrated: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  let plan = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    plan = { ...base, planDigest: sha256(base) };
    const bytes = jsonBytes(plan).length;
    if (bytes === base.resourceObservation.planBytes) break;
    base.resourceObservation.planBytes = bytes;
  }
  if (!plan || jsonBytes(plan).length !== base.resourceObservation.planBytes) fail('application plan byte measurement did not converge');
  if (plan.resourceObservation.planBytes > request.resourceEnvelope.maxOutputBytes || plan.resourceObservation.planBytes > MAX_PLAN_BYTES) {
    fail('application plan exceeds its exact output byte ceiling');
  }
  return plan;
}

function normalizePlan(value) {
  object(value, 'application plan');
  if (value.schema !== PLAN_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.authority !== 'NONE') {
    fail('application plan identity or authority mismatch');
  }
  const expected = buildPlan(value.applicationRequest);
  if (!same(value, expected)) fail('application plan differs from deterministic exact-input rebuild');
  return expected;
}

function planRef(value) {
  const plan = normalizePlan(value);
  return ref(plan.id, plan.schema, plan.planDigest);
}

function buildExampleIntent() {
  return Composer.sealIntent({
    schema: Composer.INTENT_SCHEMA,
    id: 'bounded-game-rule-module',
    name: 'Bounded Game Rule Module',
    purpose: 'Plan a deterministic pure-data game rule function that filters allowed actions and maps them to explicit outcomes without mutating input state or performing I/O.',
    capability: 'axm.bounded-game-rule-result/v1',
    status: 'EXPERIMENTAL',
    kind: 'PURE_DATA_TRANSFORM',
    inputFields: [
      { id: 'encounter-state', type: 'object', required: true, description: 'Exact immutable encounter state.' },
      { id: 'requested-actions', type: 'array', required: true, description: 'Bounded player action identifiers.' },
      { id: 'rule-table', type: 'array', required: true, description: 'Bounded explicit rule records.' }
    ],
    outputFields: [
      { id: 'game-rule-result', type: 'object', source: 'game-rule-result', description: 'Deterministic allowed actions and mapped outcomes.' }
    ],
    steps: [
      { id: 'validate-state', operation: 'VALIDATE', reads: ['encounter-state', 'requested-actions', 'rule-table'], produces: 'validated-input', description: 'Reject malformed or over-budget rule input.' },
      { id: 'filter-allowed-actions', operation: 'SELECT', reads: ['validated-input', 'requested-actions', 'rule-table'], produces: 'allowed-actions', description: 'Keep only actions explicitly allowed by the rule table.' },
      { id: 'map-action-outcomes', operation: 'TRANSFORM', reads: ['validated-input', 'allowed-actions', 'rule-table'], produces: 'mapped-outcomes', description: 'Map each allowed action to an explicit deterministic outcome.' },
      { id: 'assemble-result', operation: 'ASSEMBLE', reads: ['validated-input', 'allowed-actions', 'mapped-outcomes'], produces: 'assembled-result', description: 'Assemble the immutable game-rule result.' },
      { id: 'emit-result', operation: 'EMIT', reads: ['assembled-result'], produces: 'game-rule-result', description: 'Emit one inert result record.' }
    ],
    qualityClaims: [
      'Identical validated inputs produce byte-identical results.',
      'Unknown actions are rejected or omitted without inventing outcomes.',
      'Input encounter state is not mutated.',
      'The rule function performs no filesystem, network, provider, installation, or lifecycle action.'
    ],
    resourceBudget: {
      maxInputBytes: 65536,
      maxOutputBytes: 65536,
      maxDurationMs: 1000,
      maxMemoryBytes: 67108864,
      maxOperations: 8
    },
    authority: 'NONE'
  });
}

function buildExampleRequest() {
  const intent = buildExampleIntent();
  const blueprint = Composer.buildBlueprint(intent);
  const discoveryRequest = Discovery.buildExampleInstalledDiscoveryRequest({
    terms: [], languages: ['javascript'], domains: [], tags: [], familyKeys: [], maxResults: 32
  });
  const discoveryEvidence = Discovery.discoverInstalled(discoveryRequest);
  const recipeSelection = Bridge.selectInstalledForTest(['CC-0054', 'CC-0055'], 'REFERENCE_ONLY').packet;
  const mappings = [
    { sourceId: 'CC-0054', targetStepId: 'map-action-outcomes', nativeOperation: 'MAP_VALUES' },
    { sourceId: 'CC-0055', targetStepId: 'filter-allowed-actions', nativeOperation: 'FILTER_VALUES' }
  ];
  const resources = {
    maxInputBytes: MAX_REQUEST_BYTES,
    maxOutputBytes: MAX_PLAN_BYTES,
    maxMemoryBytes: 134217728,
    maxDurationMs: 5000,
    maxProcesses: 1,
    maxAttempts: 1,
    maxCostMinorUnits: 0
  };
  const dRef = Discovery.packetRef(discoveryEvidence);
  const sRef = Bridge.selectionPacketRef(recipeSelection);
  const profile = moduleRef();
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'code-recipe-application-plan-tier-one-policy',
    validFrom: '2026-08-23T08:00:00.000Z',
    expiresAt: '2026-08-24T08:00:00.000Z',
    maximumInstanceWindowMs: 3600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: [blueprint.schema],
      domainProfileSchemas: [profile.schema],
      allowedActions: [CONSENT_ACTION],
      allowedPermissions: [],
      allowedNetworkDomains: [],
      allowedDataClasses: REQUIRED_DATA_CLASSES.slice(),
      allowedSourceUses: REQUIRED_SOURCE_USES.slice(),
      allowedLifecycle: Object.fromEntries(Consent.LIFECYCLE_FIELDS.map((field) => [field, false])),
      resourceCeilings: resources,
      requiredPredecisionEvidenceSchemas: [dRef.schema, sRef.schema].sort(compareText),
      requiredEvidenceSchemas: REQUIRED_EVIDENCE_SCHEMAS.slice()
    }],
    rootsGate: ROOTS.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const inputArtifacts = [
    artifactFrom(blueprint.id, blueprint.schema, blueprint.blueprintDigest, blueprint),
    artifactFrom(discoveryEvidence.id, discoveryEvidence.schema, discoveryEvidence.packetDigest, discoveryEvidence),
    artifactFrom(recipeSelection.id, recipeSelection.schema, recipeSelection.packetDigest, recipeSelection)
  ];
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'bounded-game-rule-recipe-application-plan',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: blueprintRef(blueprint),
    domainProfileRef: profile,
    predecisionEvidenceRefs: [dRef, sRef],
    inputArtifacts,
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
    createdAt: '2026-08-23T09:00:00.000Z',
    expiresAt: '2026-08-23T10:00:00.000Z',
    authority: 'NONE'
  });
  const evaluationInput = { policy, instance, evaluatedAt: '2026-08-23T09:10:00.000Z' };
  const rootsGate = ROOTS.map((root) => ({
    root,
    verdict: 'PASS',
    evidenceRefs: [ref('recipe-application-' + root, 'axm.four-root-technical-review/v1', sha256('recipe-application-' + root))]
  }));
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id: 'plan-bounded-game-rule-recipe-application',
    tier: 1,
    applicationMode: APPLICATION_MODE,
    intent,
    blueprint,
    discoveryEvidence,
    recipeSelection,
    mappings,
    consent: { evaluationInput, evaluation: Consent.evaluateGroundedConsent(evaluationInput) },
    resourceEnvelope: resources,
    rootsGate,
    instructionRef: declarationRef(),
    authority: 'NONE'
  });
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  PLAN_SCHEMA,
  APPLICATION_MODE,
  CONSENT_ACTION,
  NEXT_GATE,
  TARGET_RUNTIME,
  ROOTS,
  MAX_MAPPINGS,
  MAX_REQUEST_BYTES,
  MAX_PLAN_BYTES,
  REQUIRED_DATA_CLASSES,
  REQUIRED_SOURCE_USES,
  REQUIRED_EVIDENCE_SCHEMAS,
  OPERATION_RULES,
  LIMITATIONS,
  DECLARATION,
  canonicalJson,
  sha256,
  jsonBytes,
  moduleRef,
  declarationRef,
  blueprintRef,
  sealRequest,
  normalizeRequest,
  buildPlan,
  normalizePlan,
  planRef,
  buildExampleIntent,
  buildExampleRequest,
  clone
};
