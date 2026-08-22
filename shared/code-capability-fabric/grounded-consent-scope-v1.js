'use strict';

const Fabric = require('./code-capability-fabric-v2');

const VERSION = '0.1.0';
const POLICY_SCHEMA = 'axm.grounded-consent-policy/v1';
const INSTANCE_SCHEMA = 'axm.grounded-consent-instance/v1';
const EVALUATION_SCHEMA = 'axm.grounded-consent-evaluation/v1';
const ROOTS_GATE = [
  'truth',
  'agency-non-domination',
  'continuity',
  'wisdom-over-speed'
];
const MANDATORY_RECONSENT_TRIGGERS = [
  'actions-change',
  'authority-expansion',
  'domain-profile-change',
  'evidence-reduction',
  'input-digest-change',
  'lifecycle-expansion',
  'policy-change',
  'resource-expansion',
  'subject-change',
  'time-window-change'
];
const MANDATORY_STOP_CONDITIONS = [
  'domain-safety-failure',
  'evidence-failure',
  'expiry',
  'human-revocation',
  'input-digest-drift',
  'policy-drift',
  'resource-exhaustion',
  'scope-drift'
];
const LIFECYCLE_FIELDS = [
  'publish',
  'install',
  'deploy',
  'persistentLearning',
  'hardwareActuation',
  'canon'
];
const RESOURCE_FIELDS = [
  'maxInputBytes',
  'maxOutputBytes',
  'maxMemoryBytes',
  'maxDurationMs',
  'maxProcesses',
  'maxAttempts',
  'maxCostMinorUnits'
];
const LIMITATIONS = [
  'POLICY_AUTHORSHIP_NOT_PROVEN',
  'NATURAL_PERSON_IDENTITY_NOT_PROVEN',
  'INFORMED_UNDERSTANDING_NOT_PROVEN',
  'PREDECISION_EVIDENCE_CONTENT_NOT_VERIFIED',
  'INPUT_ARTIFACT_BYTES_NOT_OBSERVED',
  'TRUSTED_CLOCK_NOT_OBSERVED',
  'LIVE_REVOCATION_NOT_CHECKED',
  'DOMAIN_SAFETY_NOT_VERIFIED',
  'HOST_AUTHORIZATION_NOT_GRANTED'
];
const STATUSES = new Set([
  'POLICY_HOLD',
  'INSTANCE_HOLD',
  'POLICY_BINDING_HOLD',
  'DOMAIN_HOLD',
  'SUBJECT_SCHEMA_HOLD',
  'DOMAIN_PROFILE_HOLD',
  'PREDECISION_EVIDENCE_HOLD',
  'ACTION_SCOPE_HOLD',
  'AUTHORITY_SCOPE_HOLD',
  'DATA_SCOPE_HOLD',
  'LIFECYCLE_SCOPE_HOLD',
  'RESOURCE_SCOPE_HOLD',
  'INPUT_BUDGET_HOLD',
  'EVIDENCE_SCOPE_HOLD',
  'RECONSENT_BINDING_HOLD',
  'TIME_WINDOW_HOLD',
  'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
]);
const STAGED_TRUTH_FIELDS = [
  'policyIntegrityVerified',
  'instanceIntegrityVerified',
  'policyDigestBound',
  'domainRuleSelected',
  'subjectSchemaAllowed',
  'domainProfileSchemaAllowed',
  'predecisionEvidenceReferencesBound',
  'actionsWithinPolicy',
  'authorityWithinPolicy',
  'dataUseWithinPolicy',
  'lifecycleWithinPolicy',
  'resourcesWithinPolicy',
  'inputBudgetWithinPolicy',
  'evidenceRequirementsPreserved',
  'reconsentTriggersBound',
  'declaredTimeWindowValid'
];
const FALSE_CEILING_FIELDS = [
  'authenticatedHumanDecisionVerified',
  'naturalPersonIdentityProven',
  'informedUnderstandingProven',
  'trustedClockObserved',
  'liveRevocationChecked',
  'domainSafetyVerified',
  'hostAuthorizationGranted',
  'attemptExecuted',
  'outputProduced',
  'persistentLearningAdmitted',
  'hardwareActuated',
  'installed',
  'published',
  'promoted',
  'canonChanged'
];
const TRUTH_FIELDS = [...STAGED_TRUTH_FIELDS, ...FALSE_CEILING_FIELDS];
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' is not a stable identifier');
  return value;
}

function contractToken(value, label) {
  if (typeof value !== 'string' || !CONTRACT_TOKEN.test(value)) {
    throw new Error(label + ' is not a portable contract token');
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) {
    throw new Error(label + ' must be a lowercase SHA-256 digest');
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) {
    throw new Error(label + ' must be a canonical UTC timestamp');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(label + ' must be a valid canonical UTC timestamp');
  }
  return value;
}

function boundedInteger(value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
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
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256'),
    byteLength: boundedInteger(value.byteLength, label + '.byteLength')
  };
}

function unique(values, label, normalizer, minimum, maximum, key = canonicalJson) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain from ' + minimum + ' to ' + maximum + ' items');
  }
  const normalized = values.map((value, index) => normalizer(value, label + '[' + index + ']'));
  const keys = normalized.map(key);
  if (new Set(keys).size !== keys.length) throw new Error(label + ' contains duplicates');
  return normalized.sort((left, right) => compareText(key(left), key(right)));
}

function identifiers(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, identifier, minimum, maximum, (value) => value);
}

function contracts(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, contractToken, minimum, maximum, (value) => value);
}

function references(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, reference, minimum, maximum);
}

function artifactReferences(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, artifactReference, minimum, maximum);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeLifecycle(value, label) {
  exactKeys(value, LIFECYCLE_FIELDS, label);
  const result = {};
  for (const field of LIFECYCLE_FIELDS) {
    if (typeof value[field] !== 'boolean') throw new Error(label + '.' + field + ' must be boolean');
    result[field] = value[field];
  }
  return result;
}

function normalizeResources(value, label) {
  exactKeys(value, RESOURCE_FIELDS, label);
  return {
    maxInputBytes: boundedInteger(value.maxInputBytes, label + '.maxInputBytes', 1),
    maxOutputBytes: boundedInteger(value.maxOutputBytes, label + '.maxOutputBytes', 1),
    maxMemoryBytes: boundedInteger(value.maxMemoryBytes, label + '.maxMemoryBytes', 1),
    maxDurationMs: boundedInteger(value.maxDurationMs, label + '.maxDurationMs', 1),
    maxProcesses: boundedInteger(value.maxProcesses, label + '.maxProcesses', 1, 1024),
    maxAttempts: boundedInteger(value.maxAttempts, label + '.maxAttempts', 1, 1000000),
    maxCostMinorUnits: boundedInteger(value.maxCostMinorUnits, label + '.maxCostMinorUnits', 0)
  };
}

function normalizeDomainRule(value, label) {
  exactKeys(value, [
    'domain', 'subjectSchemas', 'domainProfileSchemas', 'allowedActions',
    'allowedPermissions', 'allowedNetworkDomains', 'allowedDataClasses',
    'allowedSourceUses', 'allowedLifecycle', 'resourceCeilings',
    'requiredPredecisionEvidenceSchemas', 'requiredEvidenceSchemas'
  ], label);
  return {
    domain: identifier(value.domain, label + '.domain'),
    subjectSchemas: contracts(value.subjectSchemas, label + '.subjectSchemas', 1, 32),
    domainProfileSchemas: contracts(value.domainProfileSchemas, label + '.domainProfileSchemas', 1, 32),
    allowedActions: identifiers(value.allowedActions, label + '.allowedActions', 1, 64),
    allowedPermissions: identifiers(value.allowedPermissions, label + '.allowedPermissions'),
    allowedNetworkDomains: identifiers(value.allowedNetworkDomains, label + '.allowedNetworkDomains', 0, 32),
    allowedDataClasses: identifiers(value.allowedDataClasses, label + '.allowedDataClasses', 1, 32),
    allowedSourceUses: identifiers(value.allowedSourceUses, label + '.allowedSourceUses', 1, 32),
    allowedLifecycle: normalizeLifecycle(value.allowedLifecycle, label + '.allowedLifecycle'),
    resourceCeilings: normalizeResources(value.resourceCeilings, label + '.resourceCeilings'),
    requiredPredecisionEvidenceSchemas: contracts(
      value.requiredPredecisionEvidenceSchemas,
      label + '.requiredPredecisionEvidenceSchemas',
      1,
      32
    ),
    requiredEvidenceSchemas: contracts(value.requiredEvidenceSchemas, label + '.requiredEvidenceSchemas', 1, 32)
  };
}

function normalizeRootsGate(value) {
  if (!Array.isArray(value) || !same(value, ROOTS_GATE)) {
    throw new Error('grounded consent policy.rootsGate must preserve the four roots in exact order');
  }
  return ROOTS_GATE.slice();
}

function normalizePolicyCore(value) {
  exactKeys(value, [
    'schema', 'id', 'validFrom', 'expiresAt', 'maximumInstanceWindowMs',
    'domainRules', 'rootsGate', 'mandatoryReconsentTriggers', 'authority'
  ], 'grounded consent policy');
  if (value.schema !== POLICY_SCHEMA) throw new Error('grounded consent policy schema mismatch');
  if (value.authority !== 'NONE') throw new Error('grounded consent policy authority must remain NONE');
  const validFrom = timestamp(value.validFrom, 'grounded consent policy.validFrom');
  const expiresAt = timestamp(value.expiresAt, 'grounded consent policy.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(validFrom)) {
    throw new Error('grounded consent policy.expiresAt must be after validFrom');
  }
  const domainRules = unique(value.domainRules, 'grounded consent policy.domainRules', normalizeDomainRule, 1, 32,
    (rule) => rule.domain);
  const triggers = identifiers(
    value.mandatoryReconsentTriggers,
    'grounded consent policy.mandatoryReconsentTriggers',
    MANDATORY_RECONSENT_TRIGGERS.length,
    32
  );
  const missingTriggers = MANDATORY_RECONSENT_TRIGGERS.filter((item) => !triggers.includes(item));
  if (missingTriggers.length) {
    throw new Error('grounded consent policy omits mandatory re-consent triggers: ' + missingTriggers.join(', '));
  }
  return {
    schema: POLICY_SCHEMA,
    id: identifier(value.id, 'grounded consent policy.id'),
    validFrom,
    expiresAt,
    maximumInstanceWindowMs: boundedInteger(
      value.maximumInstanceWindowMs,
      'grounded consent policy.maximumInstanceWindowMs',
      1,
      31 * 24 * 60 * 60 * 1000
    ),
    domainRules,
    rootsGate: normalizeRootsGate(value.rootsGate),
    mandatoryReconsentTriggers: triggers,
    authority: 'NONE'
  };
}

function sealPolicy(value) {
  const core = normalizePolicyCore(value);
  return { ...core, policyDigest: sha256(core) };
}

function normalizePolicy(value) {
  exactKeys(value, [
    'schema', 'id', 'validFrom', 'expiresAt', 'maximumInstanceWindowMs',
    'domainRules', 'rootsGate', 'mandatoryReconsentTriggers', 'authority',
    'policyDigest'
  ], 'grounded consent policy');
  const { policyDigest, ...candidateCore } = value;
  const sealed = sealPolicy(candidateCore);
  if (sealed.policyDigest !== digest(policyDigest, 'grounded consent policy.policyDigest')) {
    throw new Error('grounded consent policy digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('grounded consent policy is not in canonical normalized form');
  return sealed;
}

function policyRef(value) {
  const policy = normalizePolicy(value);
  return { id: policy.id, schema: policy.schema, sha256: policy.policyDigest };
}

function normalizeInstanceCore(value) {
  exactKeys(value, [
    'schema', 'id', 'policyRef', 'domain', 'subjectRef', 'domainProfileRef',
    'predecisionEvidenceRefs', 'inputArtifacts', 'actions', 'permissions', 'networkDomains', 'dataClasses',
    'sourceUses', 'lifecycle', 'resources', 'requiredEvidenceSchemas',
    'reconsentTriggers', 'stopConditions', 'createdAt', 'expiresAt', 'authority'
  ], 'grounded consent instance');
  if (value.schema !== INSTANCE_SCHEMA) throw new Error('grounded consent instance schema mismatch');
  if (value.authority !== 'NONE') throw new Error('grounded consent instance authority must remain NONE');
  const createdAt = timestamp(value.createdAt, 'grounded consent instance.createdAt');
  const expiresAt = timestamp(value.expiresAt, 'grounded consent instance.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new Error('grounded consent instance.expiresAt must be after createdAt');
  }
  const stopConditions = identifiers(value.stopConditions, 'grounded consent instance.stopConditions',
    MANDATORY_STOP_CONDITIONS.length, 32);
  const missingStops = MANDATORY_STOP_CONDITIONS.filter((item) => !stopConditions.includes(item));
  if (missingStops.length) {
    throw new Error('grounded consent instance omits mandatory stop conditions: ' + missingStops.join(', '));
  }
  return {
    schema: INSTANCE_SCHEMA,
    id: identifier(value.id, 'grounded consent instance.id'),
    policyRef: reference(value.policyRef, 'grounded consent instance.policyRef'),
    domain: identifier(value.domain, 'grounded consent instance.domain'),
    subjectRef: reference(value.subjectRef, 'grounded consent instance.subjectRef'),
    domainProfileRef: reference(value.domainProfileRef, 'grounded consent instance.domainProfileRef'),
    predecisionEvidenceRefs: references(
      value.predecisionEvidenceRefs,
      'grounded consent instance.predecisionEvidenceRefs',
      1,
      32
    ),
    inputArtifacts: artifactReferences(value.inputArtifacts, 'grounded consent instance.inputArtifacts', 0, 64),
    actions: identifiers(value.actions, 'grounded consent instance.actions', 1, 64),
    permissions: identifiers(value.permissions, 'grounded consent instance.permissions'),
    networkDomains: identifiers(value.networkDomains, 'grounded consent instance.networkDomains', 0, 32),
    dataClasses: identifiers(value.dataClasses, 'grounded consent instance.dataClasses', 1, 32),
    sourceUses: identifiers(value.sourceUses, 'grounded consent instance.sourceUses', 1, 32),
    lifecycle: normalizeLifecycle(value.lifecycle, 'grounded consent instance.lifecycle'),
    resources: normalizeResources(value.resources, 'grounded consent instance.resources'),
    requiredEvidenceSchemas: contracts(
      value.requiredEvidenceSchemas,
      'grounded consent instance.requiredEvidenceSchemas',
      1,
      32
    ),
    reconsentTriggers: identifiers(value.reconsentTriggers, 'grounded consent instance.reconsentTriggers', 1, 32),
    stopConditions,
    createdAt,
    expiresAt,
    authority: 'NONE'
  };
}

function sealInstance(value) {
  const core = normalizeInstanceCore(value);
  return { ...core, instanceDigest: sha256(core) };
}

function normalizeInstance(value) {
  exactKeys(value, [
    'schema', 'id', 'policyRef', 'domain', 'subjectRef', 'domainProfileRef',
    'predecisionEvidenceRefs', 'inputArtifacts', 'actions', 'permissions', 'networkDomains', 'dataClasses',
    'sourceUses', 'lifecycle', 'resources', 'requiredEvidenceSchemas',
    'reconsentTriggers', 'stopConditions', 'createdAt', 'expiresAt', 'authority',
    'instanceDigest'
  ], 'grounded consent instance');
  const { instanceDigest, ...candidateCore } = value;
  const sealed = sealInstance(candidateCore);
  if (sealed.instanceDigest !== digest(instanceDigest, 'grounded consent instance.instanceDigest')) {
    throw new Error('grounded consent instance digest mismatch');
  }
  if (!same(sealed, value)) throw new Error('grounded consent instance is not in canonical normalized form');
  return sealed;
}

function instanceRef(value) {
  const instance = normalizeInstance(value);
  return { id: instance.id, schema: instance.schema, sha256: instance.instanceDigest };
}

function emptyTruth() {
  return Object.fromEntries(TRUTH_FIELDS.map((field) => [field, false]));
}

function sealEvaluation(status, details = {}) {
  if (!STATUSES.has(status)) throw new Error('grounded consent evaluation status is unsupported');
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status,
    evaluatedAt: details.evaluatedAt || null,
    policyRef: details.policyRef || null,
    instanceRef: details.instanceRef || null,
    domainRuleId: details.domainRuleId || null,
    holds: (details.holds || []).slice(),
    limitations: LIMITATIONS.slice(),
    nextGate: status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
      ? 'VERIFY_PREDECISION_EVIDENCE_THEN_AUTHENTICATE_EXACT_HUMAN_DECISION_AND_CHECK_LIVE_REVOCATION_DOMAIN_SAFETY_AND_HOST_AUTHORIZATION'
      : 'REPAIR_CONSENT_SCOPE_THEN_REEVALUATE',
    truth: { ...emptyTruth(), ...(details.truth || {}) },
    authority: 'NONE'
  };
  return { ...core, evaluationDigest: sha256(core) };
}

function hold(status, details, message) {
  return sealEvaluation(status, { ...details, holds: [...(details.holds || []), message] });
}

function missingValues(required, allowed) {
  const allowedSet = new Set(allowed);
  return required.filter((item) => !allowedSet.has(item));
}

function lifecycleExcess(actual, allowed) {
  return LIFECYCLE_FIELDS.filter((field) => actual[field] && !allowed[field]);
}

function resourceExcess(actual, ceilings) {
  return RESOURCE_FIELDS.filter((field) => actual[field] > ceilings[field]);
}

function sumArtifactBytes(artifacts) {
  let total = 0;
  for (const artifact of artifacts) {
    total += artifact.byteLength;
    if (!Number.isSafeInteger(total)) throw new Error('grounded consent input byte total exceeds safe integer range');
  }
  return total;
}

function evaluateGroundedConsent(input) {
  exactKeys(input, ['policy', 'instance', 'evaluatedAt'], 'grounded consent evaluation input');
  const details = {};
  let policy;
  try {
    policy = normalizePolicy(input.policy);
  } catch (error) {
    return hold('POLICY_HOLD', details, 'POLICY_INVALID:' + error.message);
  }
  details.policyRef = policyRef(policy);
  details.truth = { policyIntegrityVerified: true };

  let instance;
  try {
    instance = normalizeInstance(input.instance);
  } catch (error) {
    return hold('INSTANCE_HOLD', details, 'INSTANCE_INVALID:' + error.message);
  }
  details.instanceRef = instanceRef(instance);
  details.truth.instanceIntegrityVerified = true;

  if (!same(instance.policyRef, details.policyRef)) {
    return hold('POLICY_BINDING_HOLD', details, 'INSTANCE_POLICY_REFERENCE_MISMATCH');
  }
  details.truth.policyDigestBound = true;

  const rule = policy.domainRules.find((item) => item.domain === instance.domain);
  if (!rule) return hold('DOMAIN_HOLD', details, 'DOMAIN_NOT_ALLOWED:' + instance.domain);
  details.domainRuleId = rule.domain;
  details.truth.domainRuleSelected = true;

  if (!rule.subjectSchemas.includes(instance.subjectRef.schema)) {
    return hold('SUBJECT_SCHEMA_HOLD', details, 'SUBJECT_SCHEMA_NOT_ALLOWED:' + instance.subjectRef.schema);
  }
  details.truth.subjectSchemaAllowed = true;

  if (!rule.domainProfileSchemas.includes(instance.domainProfileRef.schema)) {
    return hold('DOMAIN_PROFILE_HOLD', details, 'DOMAIN_PROFILE_SCHEMA_NOT_ALLOWED:' + instance.domainProfileRef.schema);
  }
  details.truth.domainProfileSchemaAllowed = true;

  const predecisionSchemas = instance.predecisionEvidenceRefs.map((item) => item.schema).sort(compareText);
  if (new Set(predecisionSchemas).size !== predecisionSchemas.length ||
    !same(predecisionSchemas, rule.requiredPredecisionEvidenceSchemas)) {
    return hold('PREDECISION_EVIDENCE_HOLD', details, 'PREDECISION_EVIDENCE_SCHEMA_SET_MISMATCH');
  }
  details.truth.predecisionEvidenceReferencesBound = true;

  const actionGap = missingValues(instance.actions, rule.allowedActions);
  if (actionGap.length) return hold('ACTION_SCOPE_HOLD', details, 'ACTIONS_NOT_ALLOWED:' + actionGap.join(','));
  details.truth.actionsWithinPolicy = true;

  const permissionGap = missingValues(instance.permissions, rule.allowedPermissions);
  const networkGap = missingValues(instance.networkDomains, rule.allowedNetworkDomains);
  if (permissionGap.length || networkGap.length) {
    const messages = [];
    if (permissionGap.length) messages.push('PERMISSIONS_NOT_ALLOWED:' + permissionGap.join(','));
    if (networkGap.length) messages.push('NETWORK_DOMAINS_NOT_ALLOWED:' + networkGap.join(','));
    return hold('AUTHORITY_SCOPE_HOLD', details, messages.join('|'));
  }
  details.truth.authorityWithinPolicy = true;

  const dataGap = missingValues(instance.dataClasses, rule.allowedDataClasses);
  const sourceGap = missingValues(instance.sourceUses, rule.allowedSourceUses);
  if (dataGap.length || sourceGap.length) {
    const messages = [];
    if (dataGap.length) messages.push('DATA_CLASSES_NOT_ALLOWED:' + dataGap.join(','));
    if (sourceGap.length) messages.push('SOURCE_USES_NOT_ALLOWED:' + sourceGap.join(','));
    return hold('DATA_SCOPE_HOLD', details, messages.join('|'));
  }
  details.truth.dataUseWithinPolicy = true;

  const lifecycleGap = lifecycleExcess(instance.lifecycle, rule.allowedLifecycle);
  if (lifecycleGap.length) {
    return hold('LIFECYCLE_SCOPE_HOLD', details, 'LIFECYCLE_EFFECTS_NOT_ALLOWED:' + lifecycleGap.join(','));
  }
  details.truth.lifecycleWithinPolicy = true;

  const resourceGap = resourceExcess(instance.resources, rule.resourceCeilings);
  if (resourceGap.length) {
    return hold('RESOURCE_SCOPE_HOLD', details, 'RESOURCE_CEILINGS_EXCEEDED:' + resourceGap.join(','));
  }
  details.truth.resourcesWithinPolicy = true;

  let artifactBytes;
  try {
    artifactBytes = sumArtifactBytes(instance.inputArtifacts);
  } catch (error) {
    return hold('INPUT_BUDGET_HOLD', details, 'INPUT_ARTIFACT_BYTES_INVALID:' + error.message);
  }
  if (artifactBytes > instance.resources.maxInputBytes) {
    return hold('INPUT_BUDGET_HOLD', details, 'INPUT_ARTIFACT_BYTES_EXCEED_INSTANCE_BUDGET');
  }
  details.truth.inputBudgetWithinPolicy = true;

  const evidenceGap = missingValues(rule.requiredEvidenceSchemas, instance.requiredEvidenceSchemas);
  if (evidenceGap.length) {
    return hold('EVIDENCE_SCOPE_HOLD', details, 'REQUIRED_EVIDENCE_REMOVED:' + evidenceGap.join(','));
  }
  details.truth.evidenceRequirementsPreserved = true;

  if (!same(instance.reconsentTriggers, policy.mandatoryReconsentTriggers)) {
    return hold('RECONSENT_BINDING_HOLD', details, 'RECONSENT_TRIGGERS_DO_NOT_MATCH_POLICY');
  }
  details.truth.reconsentTriggersBound = true;

  let evaluatedAt;
  try {
    evaluatedAt = timestamp(input.evaluatedAt, 'grounded consent evaluation input.evaluatedAt');
  } catch (error) {
    return hold('TIME_WINDOW_HOLD', details, 'DECLARED_EVALUATION_TIME_INVALID:' + error.message);
  }
  details.evaluatedAt = evaluatedAt;
  const policyStart = Date.parse(policy.validFrom);
  const policyEnd = Date.parse(policy.expiresAt);
  const instanceStart = Date.parse(instance.createdAt);
  const instanceEnd = Date.parse(instance.expiresAt);
  const evaluated = Date.parse(evaluatedAt);
  if (instanceStart < policyStart || instanceEnd > policyEnd ||
    instanceEnd - instanceStart > policy.maximumInstanceWindowMs ||
    evaluated < instanceStart || evaluated >= instanceEnd ||
    evaluated < policyStart || evaluated >= policyEnd) {
    return hold('TIME_WINDOW_HOLD', details, 'DECLARED_TIME_WINDOW_OUTSIDE_POLICY');
  }
  details.truth.declaredTimeWindowValid = true;

  return sealEvaluation('AUTHENTICATED_HUMAN_DECISION_REQUIRED', details);
}

function normalizeHolds(values) {
  if (!Array.isArray(values) || values.length > 16) throw new Error('grounded consent evaluation.holds must be bounded');
  return values.map((value, index) => {
    if (typeof value !== 'string' || !value.length || value.length > 1000 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('grounded consent evaluation.holds[' + index + '] must be bounded canonical text');
    }
    return value;
  });
}

function normalizeTruth(value) {
  exactKeys(value, TRUTH_FIELDS, 'grounded consent evaluation.truth');
  const result = {};
  for (const field of TRUTH_FIELDS) {
    if (typeof value[field] !== 'boolean') throw new Error('grounded consent evaluation.truth.' + field + ' must be boolean');
    result[field] = value[field];
  }
  for (const field of FALSE_CEILING_FIELDS) {
    if (result[field]) throw new Error('grounded consent evaluation.truth.' + field + ' violates the planning truth ceiling');
  }
  return result;
}

function normalizeEvaluation(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'evaluatedAt', 'policyRef', 'instanceRef',
    'domainRuleId', 'holds', 'limitations', 'nextGate', 'truth', 'authority',
    'evaluationDigest'
  ], 'grounded consent evaluation');
  if (value.schema !== EVALUATION_SCHEMA) throw new Error('grounded consent evaluation schema mismatch');
  if (value.version !== VERSION) throw new Error('grounded consent evaluation version mismatch');
  if (!STATUSES.has(value.status)) throw new Error('grounded consent evaluation status is unsupported');
  if (value.authority !== 'NONE') throw new Error('grounded consent evaluation authority must remain NONE');
  if (!same(value.limitations, LIMITATIONS)) throw new Error('grounded consent evaluation limitations must remain explicit');
  const expectedNextGate = value.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED'
    ? 'VERIFY_PREDECISION_EVIDENCE_THEN_AUTHENTICATE_EXACT_HUMAN_DECISION_AND_CHECK_LIVE_REVOCATION_DOMAIN_SAFETY_AND_HOST_AUTHORIZATION'
    : 'REPAIR_CONSENT_SCOPE_THEN_REEVALUATE';
  if (value.nextGate !== expectedNextGate) throw new Error('grounded consent evaluation nextGate conflicts with status');
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status: value.status,
    evaluatedAt: value.evaluatedAt == null ? null : timestamp(value.evaluatedAt, 'grounded consent evaluation.evaluatedAt'),
    policyRef: value.policyRef == null ? null : reference(value.policyRef, 'grounded consent evaluation.policyRef'),
    instanceRef: value.instanceRef == null ? null : reference(value.instanceRef, 'grounded consent evaluation.instanceRef'),
    domainRuleId: value.domainRuleId == null ? null : identifier(value.domainRuleId, 'grounded consent evaluation.domainRuleId'),
    holds: normalizeHolds(value.holds),
    limitations: LIMITATIONS.slice(),
    nextGate: expectedNextGate,
    truth: normalizeTruth(value.truth),
    authority: 'NONE'
  };
  const evaluationDigest = digest(value.evaluationDigest, 'grounded consent evaluation.evaluationDigest');
  if (sha256(core) !== evaluationDigest) throw new Error('grounded consent evaluation digest mismatch');
  const normalized = { ...core, evaluationDigest };
  if (!same(normalized, value)) throw new Error('grounded consent evaluation is not in canonical normalized form');

  const progressByStatus = {
    POLICY_HOLD: 0,
    INSTANCE_HOLD: 1,
    POLICY_BINDING_HOLD: 2,
    DOMAIN_HOLD: 3,
    SUBJECT_SCHEMA_HOLD: 4,
    DOMAIN_PROFILE_HOLD: 5,
    PREDECISION_EVIDENCE_HOLD: 6,
    ACTION_SCOPE_HOLD: 7,
    AUTHORITY_SCOPE_HOLD: 8,
    DATA_SCOPE_HOLD: 9,
    LIFECYCLE_SCOPE_HOLD: 10,
    RESOURCE_SCOPE_HOLD: 11,
    INPUT_BUDGET_HOLD: 12,
    EVIDENCE_SCOPE_HOLD: 13,
    RECONSENT_BINDING_HOLD: 14,
    TIME_WINDOW_HOLD: 15,
    AUTHENTICATED_HUMAN_DECISION_REQUIRED: 16
  };
  const progress = progressByStatus[value.status];
  STAGED_TRUTH_FIELDS.forEach((field, index) => {
    if (core.truth[field] !== (index < progress)) {
      throw new Error('grounded consent evaluation status conflicts with truth.' + field);
    }
  });
  if ((value.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED') !== (core.holds.length === 0)) {
    throw new Error('only AUTHENTICATED_HUMAN_DECISION_REQUIRED may be hold-free');
  }
  if (core.truth.policyIntegrityVerified !== (core.policyRef !== null)) {
    throw new Error('grounded consent policy reference conflicts with truth');
  }
  if (core.truth.instanceIntegrityVerified !== (core.instanceRef !== null)) {
    throw new Error('grounded consent instance reference conflicts with truth');
  }
  if (core.truth.domainRuleSelected !== (core.domainRuleId !== null)) {
    throw new Error('grounded consent domain rule conflicts with truth');
  }
  if (core.truth.declaredTimeWindowValid && core.evaluatedAt === null) {
    throw new Error('grounded consent declared time conflicts with truth');
  }
  return normalized;
}

function verifyEvaluation(value, input) {
  const errors = [];
  try {
    const normalized = normalizeEvaluation(value);
    const rebuilt = evaluateGroundedConsent(input);
    if (!same(normalized, rebuilt)) throw new Error('grounded consent evaluation differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  POLICY_SCHEMA,
  INSTANCE_SCHEMA,
  EVALUATION_SCHEMA,
  ROOTS_GATE,
  MANDATORY_RECONSENT_TRIGGERS,
  MANDATORY_STOP_CONDITIONS,
  LIFECYCLE_FIELDS,
  RESOURCE_FIELDS,
  LIMITATIONS,
  canonicalJson,
  sha256,
  sealPolicy,
  normalizePolicy,
  policyRef,
  sealInstance,
  normalizeInstance,
  instanceRef,
  evaluateGroundedConsent,
  normalizeEvaluation,
  verifyEvaluation,
  clone
};
