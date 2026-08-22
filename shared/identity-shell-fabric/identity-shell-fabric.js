'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const VERSION = '0.1.0';
const STATUS = 'EXPERIMENTAL';
const SCHEMAS = Object.freeze({
  identityRoot: 'axm.identity-shell.identity-root/v1',
  continuityPolicy: 'axm.identity-shell.continuity-policy/v1',
  continuityEvent: 'axm.identity-shell.continuity-event/v1',
  adapterDescriptor: 'axm.identity-shell.adapter-descriptor/v1',
  bodyDescriptor: 'axm.identity-shell.body-descriptor/v1',
  resourceEnvelope: 'axm.identity-shell.resource-envelope/v1',
  blueprint: 'axm.identity-shell.blueprint/v1',
  manifest: 'axm.identity-shell.manifest/v1',
  lineageReceipt: 'axm.identity-shell.lineage-receipt/v1',
  buildGapReceipt: 'axm.identity-shell.build-gap-receipt/v1',
  humanDecisionReceipt: 'axm.identity-shell.human-decision-receipt/v1'
});

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/;
const CONTRACT = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const WINDOWS_RESERVED = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9']);
const ADAPTER_ROLES = Object.freeze(['NEURAL_REASONER', 'DETERMINISTIC_TOOL', 'HUMAN_INPUT', 'SENSOR', 'BODY', 'OUTPUT']);
const BODY_CLASSES = Object.freeze(['SOFTWARE', 'GAME', 'AVATAR', 'ROBOTIC']);
const EVENT_TYPES = Object.freeze(['ORIGIN', 'MEMORY_CANDIDATE', 'MEMORY_ACCEPTANCE', 'DISSENT', 'MODEL_OR_CONNECTOR_SWAP', 'MIGRATION', 'RECONSTRUCTION', 'ROLLBACK', 'RETIREMENT_PROPOSAL']);
const LINEAGE_KINDS = Object.freeze(['ORIGIN', 'FORK', 'MIGRATION', 'RECONSTRUCTION', 'SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL']);
const DISCLOSURE_KINDS = Object.freeze(['FORK', 'MIGRATION', 'RECONSTRUCTION', 'SUCCESSION', 'RETIREMENT', 'ADAPTER_SWAP', 'BODY_SWAP', 'MODEL_OR_CONNECTOR_SWAP']);
const HUMAN_DECISIONS = Object.freeze(['AUTHORIZE_SUCCESSION_PROPOSAL', 'AUTHORIZE_RETIREMENT_PROPOSAL', 'HOLD', 'REJECT']);
const HUMAN_ACCEPTANCE_SCHEMA = 'axm.human-acceptance/v1';

class ShellFabricError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ShellFabricError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ShellFabricError(code, message);
}

function canonicalJson(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail('TYPE_MISMATCH', label + ' must be a plain object');
  }
  return value;
}

function exactKeys(value, expected, label) {
  plainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    fail('UNKNOWN_OR_MISSING_FIELD', label + ' fields must be exactly: ' + wanted.join(', '));
  }
}

function enumValue(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) fail('UNSUPPORTED_VALUE', label + ' is unsupported');
  return value;
}

function boolean(value, expected, label) {
  if (typeof value !== 'boolean') fail('TYPE_MISMATCH', label + ' must be boolean');
  if (expected !== undefined && value !== expected) fail('BOUNDARY_VIOLATION', label + ' must be ' + expected);
  return value;
}

function safeText(value, label, maximum = 1000) {
  if (typeof value !== 'string') fail('COERCION_REFUSED', label + ' must be a string');
  if (!value || value !== value.trim()) fail('TEXT_BOUNDARY', label + ' must be non-empty with no outer whitespace');
  if (value.length > maximum) fail('TEXT_BOUNDARY', label + ' exceeds ' + maximum + ' characters');
  if (value.normalize('NFC') !== value) fail('UNICODE_ALIAS', label + ' must already be Unicode NFC');
  if (/[\u0000-\u001f\u007f<>]/u.test(value)) fail('TEXT_BOUNDARY', label + ' contains a refused control or markup character');
  return value;
}

function nullableText(value, label, maximum) {
  return value === null ? null : safeText(value, label, maximum);
}

function stableId(value, label, maximum = 120) {
  const result = safeText(value, label, maximum);
  if (result.length < 2 || !ID.test(result)) fail('NON_PORTABLE_ID', label + ' must be lowercase portable ASCII');
  const segments = result.split(/[._-]/);
  if (segments.some(segment => WINDOWS_RESERVED.has(segment))) fail('WINDOWS_ALIAS_HAZARD', label + ' contains a Windows-reserved alias');
  return result;
}

function nullableId(value, label, maximum) {
  return value === null ? null : stableId(value, label, maximum);
}

function semanticVersion(value, label) {
  const result = safeText(value, label, 80);
  if (!SEMVER.test(result)) fail('INVALID_VERSION', label + ' must be lowercase semantic version text');
  return result;
}

function contractToken(value, label) {
  const result = safeText(value, label, 180);
  if (!CONTRACT.test(result)) fail('NON_PORTABLE_CONTRACT', label + ' must be a portable contract token');
  return result;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail('INVALID_DIGEST', label + ' must be a lowercase SHA-256 digest');
  return value;
}

function nullableDigest(value, label) {
  return value === null ? null : digest(value, label);
}

function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail('COERCION_REFUSED', label + ' must be a non-negative safe integer');
  return value;
}

function timestamp(value, label) {
  const result = safeText(value, label, 40);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== result) fail('INVALID_TIMESTAMP', label + ' must be canonical UTC date-time text');
  return result;
}

function boundedArray(value, label, maximum, minimum = 0) {
  if (!Array.isArray(value)) fail('TYPE_MISMATCH', label + ' must be an array');
  if (value.length < minimum || value.length > maximum) fail('ARRAY_BOUNDARY', label + ' must contain ' + minimum + '-' + maximum + ' entries');
  return value;
}

function uniqueIds(values, label, maximum = 64, minimum = 0) {
  const result = boundedArray(values, label, maximum, minimum).map((value, index) => stableId(value, label + '[' + index + ']'));
  if (new Set(result).size !== result.length) fail('DUPLICATE_ID', label + ' contains duplicate identifiers');
  return result.sort();
}

function uniqueContracts(values, label, maximum = 64, minimum = 0) {
  const result = boundedArray(values, label, maximum, minimum).map((value, index) => contractToken(value, label + '[' + index + ']'));
  if (new Set(result).size !== result.length) fail('DUPLICATE_CONTRACT', label + ' contains duplicate contracts');
  return result.sort();
}

function normalizeReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: stableId(value.id, label + '.id', 160),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function normalizeReferences(values, label, maximum = 64, sort = true) {
  const result = boundedArray(values, label, maximum).map((value, index) => normalizeReference(value, label + '[' + index + ']'));
  const keys = result.map(item => item.id + '|' + item.schema + '|' + item.sha256);
  if (new Set(keys).size !== keys.length) fail('DUPLICATE_REFERENCE', label + ' contains duplicate exact references');
  return sort ? result.sort((left, right) => (left.id + left.sha256).localeCompare(right.id + right.sha256)) : result;
}

function normalizeIdentityRoot(value) {
  exactKeys(value, ['schema', 'version', 'shellId', 'display', 'purpose', 'roots', 'authority', 'disclosure', 'ownership'], 'identityRoot');
  if (value.schema !== SCHEMAS.identityRoot || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'identityRoot schema or version mismatch');
  exactKeys(value.display, ['label', 'description', 'tags'], 'identityRoot.display');
  const roots = boundedArray(value.roots, 'identityRoot.roots', 32, 1).map((root, index) => {
    exactKeys(root, ['id', 'statement'], 'identityRoot.roots[' + index + ']');
    return { id: stableId(root.id, 'identityRoot.roots[' + index + '].id'), statement: safeText(root.statement, 'identityRoot.roots[' + index + '].statement', 1000) };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(roots.map(root => root.id)).size !== roots.length) fail('DUPLICATE_ID', 'identityRoot.roots contains duplicate ids');
  exactKeys(value.authority, ['scopeId', 'permittedPermissions', 'forbiddenActions', 'humanGates', 'automaticExpansion'], 'identityRoot.authority');
  exactKeys(value.disclosure, ['technicalSubstrateDisclosureRequired', 'modelOrConnectorSwapDisclosureRequired', 'consciousnessClaimed', 'personhoodClaimed', 'subjectiveContinuityClaimed', 'neutralityStatement'], 'identityRoot.disclosure');
  exactKeys(value.ownership, ['controllerKind', 'controllerId', 'exportPolicy', 'forkPolicy', 'automaticInheritance', 'automaticPromotion'], 'identityRoot.ownership');
  return {
    schema: SCHEMAS.identityRoot,
    version: VERSION,
    shellId: stableId(value.shellId, 'identityRoot.shellId'),
    display: {
      label: safeText(value.display.label, 'identityRoot.display.label', 160),
      description: safeText(value.display.description, 'identityRoot.display.description', 1000),
      tags: uniqueIds(value.display.tags, 'identityRoot.display.tags', 24)
    },
    purpose: safeText(value.purpose, 'identityRoot.purpose', 1600),
    roots,
    authority: {
      scopeId: stableId(value.authority.scopeId, 'identityRoot.authority.scopeId'),
      permittedPermissions: uniqueIds(value.authority.permittedPermissions, 'identityRoot.authority.permittedPermissions'),
      forbiddenActions: uniqueIds(value.authority.forbiddenActions, 'identityRoot.authority.forbiddenActions'),
      humanGates: uniqueIds(value.authority.humanGates, 'identityRoot.authority.humanGates', 32, 1),
      automaticExpansion: boolean(value.authority.automaticExpansion, false, 'identityRoot.authority.automaticExpansion')
    },
    disclosure: {
      technicalSubstrateDisclosureRequired: boolean(value.disclosure.technicalSubstrateDisclosureRequired, true, 'identityRoot.disclosure.technicalSubstrateDisclosureRequired'),
      modelOrConnectorSwapDisclosureRequired: boolean(value.disclosure.modelOrConnectorSwapDisclosureRequired, true, 'identityRoot.disclosure.modelOrConnectorSwapDisclosureRequired'),
      consciousnessClaimed: boolean(value.disclosure.consciousnessClaimed, false, 'identityRoot.disclosure.consciousnessClaimed'),
      personhoodClaimed: boolean(value.disclosure.personhoodClaimed, false, 'identityRoot.disclosure.personhoodClaimed'),
      subjectiveContinuityClaimed: boolean(value.disclosure.subjectiveContinuityClaimed, false, 'identityRoot.disclosure.subjectiveContinuityClaimed'),
      neutralityStatement: safeText(value.disclosure.neutralityStatement, 'identityRoot.disclosure.neutralityStatement', 600)
    },
    ownership: {
      controllerKind: enumValue(value.ownership.controllerKind, ['USER', 'HUMAN_STEWARD', 'ORGANIZATION'], 'identityRoot.ownership.controllerKind'),
      controllerId: stableId(value.ownership.controllerId, 'identityRoot.ownership.controllerId'),
      exportPolicy: enumValue(value.ownership.exportPolicy, ['PORTABLE_REDACTED', 'PRIVATE_NO_EXPORT'], 'identityRoot.ownership.exportPolicy'),
      forkPolicy: enumValue(value.ownership.forkPolicy, ['ALLOWED_WITH_NEW_ID', 'HUMAN_DECISION_REQUIRED'], 'identityRoot.ownership.forkPolicy'),
      automaticInheritance: boolean(value.ownership.automaticInheritance, false, 'identityRoot.ownership.automaticInheritance'),
      automaticPromotion: boolean(value.ownership.automaticPromotion, false, 'identityRoot.ownership.automaticPromotion')
    }
  };
}

function normalizeContinuityPolicy(value) {
  exactKeys(value, ['schema', 'version', 'policyId', 'acceptedEventTypes', 'candidateMemory', 'acceptance', 'dissent', 'retention', 'reconstruction', 'migration', 'rollback', 'lostContinuity'], 'continuityPolicy');
  if (value.schema !== SCHEMAS.continuityPolicy || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'continuityPolicy schema or version mismatch');
  const acceptedEventTypes = boundedArray(value.acceptedEventTypes, 'continuityPolicy.acceptedEventTypes', EVENT_TYPES.length, 1).map((event, index) => enumValue(event, EVENT_TYPES, 'continuityPolicy.acceptedEventTypes[' + index + ']')).sort();
  if (new Set(acceptedEventTypes).size !== acceptedEventTypes.length) fail('DUPLICATE_ID', 'continuityPolicy.acceptedEventTypes contains duplicates');
  exactKeys(value.candidateMemory, ['defaultState', 'neuralOutputIsMemory', 'generatedMemoryRequiresAcceptance'], 'continuityPolicy.candidateMemory');
  exactKeys(value.acceptance, ['actorKinds', 'requiresReceipt', 'allowedEventTypes'], 'continuityPolicy.acceptance');
  exactKeys(value.dissent, ['preserve', 'automaticResolution'], 'continuityPolicy.dissent');
  exactKeys(value.retention, ['maxAcceptedReceipts', 'maxCandidateReceipts', 'rawPrivateDataAllowed'], 'continuityPolicy.retention');
  exactKeys(value.reconstruction, ['authoritativeStateFromAcceptedReceipts', 'missingEvidenceState', 'ordering'], 'continuityPolicy.reconstruction');
  exactKeys(value.migration, ['modelSwapDisclosureRequired', 'connectorSwapDisclosureRequired'], 'continuityPolicy.migration');
  exactKeys(value.rollback, ['targetDigestRequired', 'preserveSupersededHistory'], 'continuityPolicy.rollback');
  exactKeys(value.lostContinuity, ['state', 'action'], 'continuityPolicy.lostContinuity');
  const allowedEventTypes = boundedArray(value.acceptance.allowedEventTypes, 'continuityPolicy.acceptance.allowedEventTypes', EVENT_TYPES.length, 1).map((event, index) => enumValue(event, EVENT_TYPES, 'continuityPolicy.acceptance.allowedEventTypes[' + index + ']')).sort();
  if (new Set(allowedEventTypes).size !== allowedEventTypes.length) fail('DUPLICATE_ID', 'continuityPolicy.acceptance.allowedEventTypes contains duplicates');
  if (allowedEventTypes.some(event => !acceptedEventTypes.includes(event))) fail('AUTHORITY_EXPANSION', 'acceptance event types must be a subset of accepted event types');
  const maxAcceptedReceipts = safeInteger(value.retention.maxAcceptedReceipts, 'continuityPolicy.retention.maxAcceptedReceipts');
  const maxCandidateReceipts = safeInteger(value.retention.maxCandidateReceipts, 'continuityPolicy.retention.maxCandidateReceipts');
  if (maxAcceptedReceipts > 256 || maxCandidateReceipts > 256) fail('RETENTION_BOUNDARY', 'continuity policy retention cannot exceed 256 receipts');
  return {
    schema: SCHEMAS.continuityPolicy,
    version: VERSION,
    policyId: stableId(value.policyId, 'continuityPolicy.policyId'),
    acceptedEventTypes,
    candidateMemory: {
      defaultState: enumValue(value.candidateMemory.defaultState, ['CANDIDATE'], 'continuityPolicy.candidateMemory.defaultState'),
      neuralOutputIsMemory: boolean(value.candidateMemory.neuralOutputIsMemory, false, 'continuityPolicy.candidateMemory.neuralOutputIsMemory'),
      generatedMemoryRequiresAcceptance: boolean(value.candidateMemory.generatedMemoryRequiresAcceptance, true, 'continuityPolicy.candidateMemory.generatedMemoryRequiresAcceptance')
    },
    acceptance: {
      actorKinds: boundedArray(value.acceptance.actorKinds, 'continuityPolicy.acceptance.actorKinds', 1, 1).map((actor, index) => enumValue(actor, ['HUMAN'], 'continuityPolicy.acceptance.actorKinds[' + index + ']')),
      requiresReceipt: boolean(value.acceptance.requiresReceipt, true, 'continuityPolicy.acceptance.requiresReceipt'),
      allowedEventTypes
    },
    dissent: {
      preserve: boolean(value.dissent.preserve, true, 'continuityPolicy.dissent.preserve'),
      automaticResolution: boolean(value.dissent.automaticResolution, false, 'continuityPolicy.dissent.automaticResolution')
    },
    retention: {
      maxAcceptedReceipts,
      maxCandidateReceipts,
      rawPrivateDataAllowed: boolean(value.retention.rawPrivateDataAllowed, false, 'continuityPolicy.retention.rawPrivateDataAllowed')
    },
    reconstruction: {
      authoritativeStateFromAcceptedReceipts: boolean(value.reconstruction.authoritativeStateFromAcceptedReceipts, true, 'continuityPolicy.reconstruction.authoritativeStateFromAcceptedReceipts'),
      missingEvidenceState: enumValue(value.reconstruction.missingEvidenceState, ['UNKNOWN'], 'continuityPolicy.reconstruction.missingEvidenceState'),
      ordering: enumValue(value.reconstruction.ordering, ['STRICT_HASH_CHAIN'], 'continuityPolicy.reconstruction.ordering')
    },
    migration: {
      modelSwapDisclosureRequired: boolean(value.migration.modelSwapDisclosureRequired, true, 'continuityPolicy.migration.modelSwapDisclosureRequired'),
      connectorSwapDisclosureRequired: boolean(value.migration.connectorSwapDisclosureRequired, true, 'continuityPolicy.migration.connectorSwapDisclosureRequired')
    },
    rollback: {
      targetDigestRequired: boolean(value.rollback.targetDigestRequired, true, 'continuityPolicy.rollback.targetDigestRequired'),
      preserveSupersededHistory: boolean(value.rollback.preserveSupersededHistory, true, 'continuityPolicy.rollback.preserveSupersededHistory')
    },
    lostContinuity: {
      state: enumValue(value.lostContinuity.state, ['UNKNOWN'], 'continuityPolicy.lostContinuity.state'),
      action: enumValue(value.lostContinuity.action, ['HOLD'], 'continuityPolicy.lostContinuity.action')
    }
  };
}

function normalizeMetric(value, label, unit) {
  exactKeys(value, ['state', 'unit', 'requested', 'permitted'], label);
  const state = enumValue(value.state, ['KNOWN', 'UNKNOWN'], label + '.state');
  if (value.unit !== unit) fail('RESOURCE_UNIT_MISMATCH', label + '.unit must be ' + unit);
  if (state === 'UNKNOWN') {
    if (value.requested !== null || value.permitted !== null) fail('UNKNOWN_NOT_UNLIMITED', label + ' UNKNOWN limits must remain null');
    return { value: { state, unit, requested: null, permitted: null }, gap: label };
  }
  const requested = safeInteger(value.requested, label + '.requested');
  const permitted = safeInteger(value.permitted, label + '.permitted');
  if (requested > permitted) fail('RESOURCE_EXPANSION', label + '.requested exceeds permitted');
  return { value: { state, unit, requested, permitted }, gap: null };
}

function normalizeResourceEnvelope(value) {
  exactKeys(value, ['schema', 'version', 'envelopeId', 'compute', 'memory', 'storage', 'time', 'network', 'energy', 'actuation'], 'resourceEnvelope');
  if (value.schema !== SCHEMAS.resourceEnvelope || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'resourceEnvelope schema or version mismatch');
  const metrics = {
    compute: normalizeMetric(value.compute, 'resourceEnvelope.compute', 'abstract-compute-unit'),
    memory: normalizeMetric(value.memory, 'resourceEnvelope.memory', 'byte'),
    storage: normalizeMetric(value.storage, 'resourceEnvelope.storage', 'byte'),
    time: normalizeMetric(value.time, 'resourceEnvelope.time', 'millisecond'),
    energy: normalizeMetric(value.energy, 'resourceEnvelope.energy', 'milliwatt-hour')
  };
  exactKeys(value.network, ['state', 'mode', 'requestedDomains', 'permittedDomains'], 'resourceEnvelope.network');
  const networkState = enumValue(value.network.state, ['KNOWN', 'UNKNOWN'], 'resourceEnvelope.network.state');
  let network;
  let networkGap = null;
  if (networkState === 'UNKNOWN') {
    if (value.network.mode !== 'DISABLED' || value.network.requestedDomains !== null || value.network.permittedDomains !== null) fail('UNKNOWN_NOT_UNLIMITED', 'UNKNOWN network must remain disabled with null domain lists');
    network = { state: 'UNKNOWN', mode: 'DISABLED', requestedDomains: null, permittedDomains: null };
    networkGap = 'resourceEnvelope.network';
  } else {
    const mode = enumValue(value.network.mode, ['DISABLED', 'ALLOWLIST'], 'resourceEnvelope.network.mode');
    const requestedDomains = uniqueIds(value.network.requestedDomains, 'resourceEnvelope.network.requestedDomains', 32);
    const permittedDomains = uniqueIds(value.network.permittedDomains, 'resourceEnvelope.network.permittedDomains', 32);
    if (mode === 'DISABLED' && (requestedDomains.length || permittedDomains.length)) fail('NETWORK_BOUNDARY', 'disabled network cannot declare domains');
    if (requestedDomains.some(domain => !permittedDomains.includes(domain))) fail('AUTHORITY_EXPANSION', 'requested network domains exceed permitted domains');
    network = { state: 'KNOWN', mode, requestedDomains, permittedDomains };
  }
  exactKeys(value.actuation, ['state', 'mode', 'requestedOperations', 'permittedOperations'], 'resourceEnvelope.actuation');
  const actuationState = enumValue(value.actuation.state, ['KNOWN', 'UNKNOWN'], 'resourceEnvelope.actuation.state');
  let actuation;
  let actuationGap = null;
  if (value.actuation.mode !== 'UNAVAILABLE_V0_1') fail('ACTUATION_UNAVAILABLE', 'robotic actuation is unavailable in v0.1');
  if (actuationState === 'UNKNOWN') {
    if (value.actuation.requestedOperations !== null || value.actuation.permittedOperations !== null) fail('UNKNOWN_NOT_UNLIMITED', 'UNKNOWN actuation limits must remain null');
    actuation = { state: 'UNKNOWN', mode: 'UNAVAILABLE_V0_1', requestedOperations: null, permittedOperations: null };
    actuationGap = 'resourceEnvelope.actuation';
  } else {
    const requestedOperations = safeInteger(value.actuation.requestedOperations, 'resourceEnvelope.actuation.requestedOperations');
    const permittedOperations = safeInteger(value.actuation.permittedOperations, 'resourceEnvelope.actuation.permittedOperations');
    if (requestedOperations !== 0 || permittedOperations !== 0) fail('ACTUATION_UNAVAILABLE', 'actuation operations must remain zero in v0.1');
    actuation = { state: 'KNOWN', mode: 'UNAVAILABLE_V0_1', requestedOperations: 0, permittedOperations: 0 };
  }
  return {
    value: {
      schema: SCHEMAS.resourceEnvelope,
      version: VERSION,
      envelopeId: stableId(value.envelopeId, 'resourceEnvelope.envelopeId'),
      compute: metrics.compute.value,
      memory: metrics.memory.value,
      storage: metrics.storage.value,
      time: metrics.time.value,
      network,
      energy: metrics.energy.value,
      actuation
    },
    gaps: [metrics.compute.gap, metrics.memory.gap, metrics.storage.gap, metrics.time.gap, networkGap, metrics.energy.gap, actuationGap].filter(Boolean)
  };
}

function normalizeResourceRequest(value, label) {
  exactKeys(value, ['computeUnits', 'memoryBytes', 'storageBytes', 'timeMilliseconds', 'networkDomains', 'energyMilliwattHours', 'actuationOperations'], label);
  const actuationOperations = safeInteger(value.actuationOperations, label + '.actuationOperations');
  if (actuationOperations !== 0) fail('ACTUATION_UNAVAILABLE', label + '.actuationOperations must be zero in v0.1');
  return {
    computeUnits: safeInteger(value.computeUnits, label + '.computeUnits'),
    memoryBytes: safeInteger(value.memoryBytes, label + '.memoryBytes'),
    storageBytes: safeInteger(value.storageBytes, label + '.storageBytes'),
    timeMilliseconds: safeInteger(value.timeMilliseconds, label + '.timeMilliseconds'),
    networkDomains: uniqueIds(value.networkDomains, label + '.networkDomains', 32),
    energyMilliwattHours: safeInteger(value.energyMilliwattHours, label + '.energyMilliwattHours'),
    actuationOperations: 0
  };
}

function normalizeExecution(value, label) {
  exactKeys(value, ['mode', 'codeIncluded', 'loadable', 'executable'], label);
  return {
    mode: enumValue(value.mode, ['INERT_DESCRIPTOR_ONLY'], label + '.mode'),
    codeIncluded: boolean(value.codeIncluded, false, label + '.codeIncluded'),
    loadable: boolean(value.loadable, false, label + '.loadable'),
    executable: boolean(value.executable, false, label + '.executable')
  };
}

function normalizeAdapterDescriptor(value) {
  exactKeys(value, ['schema', 'version', 'descriptorId', 'descriptorVersion', 'status', 'role', 'providerBinding', 'contracts', 'requestedPermissions', 'resourceRequest', 'execution', 'evidenceCeiling', 'truth'], 'adapterDescriptor');
  if (value.schema !== SCHEMAS.adapterDescriptor || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'adapterDescriptor schema or version mismatch');
  exactKeys(value.providerBinding, ['state', 'providerFamily', 'modelId', 'connectorId'], 'adapterDescriptor.providerBinding');
  if (value.providerBinding.state !== 'UNBOUND' || value.providerBinding.providerFamily !== null || value.providerBinding.modelId !== null || value.providerBinding.connectorId !== null) fail('PROVIDER_BINDING_UNAVAILABLE', 'v0.1 adapter descriptors must remain provider-neutral and UNBOUND');
  exactKeys(value.contracts, ['accepts', 'produces'], 'adapterDescriptor.contracts');
  exactKeys(value.truth, ['neuralOutputAuthority', 'memoryAuthority', 'identityAuthority', 'verificationAuthority', 'truthAuthority'], 'adapterDescriptor.truth');
  const role = enumValue(value.role, ADAPTER_ROLES, 'adapterDescriptor.role');
  const neuralAuthority = enumValue(value.truth.neuralOutputAuthority, ['PROPOSAL_ONLY', 'NOT_APPLICABLE'], 'adapterDescriptor.truth.neuralOutputAuthority');
  if ((role === 'NEURAL_REASONER') !== (neuralAuthority === 'PROPOSAL_ONLY')) fail('NEURAL_AUTHORITY_BOUNDARY', 'neural proposal authority must match the NEURAL_REASONER role');
  return {
    schema: SCHEMAS.adapterDescriptor,
    version: VERSION,
    descriptorId: stableId(value.descriptorId, 'adapterDescriptor.descriptorId'),
    descriptorVersion: semanticVersion(value.descriptorVersion, 'adapterDescriptor.descriptorVersion'),
    status: enumValue(value.status, ['EXPERIMENTAL'], 'adapterDescriptor.status'),
    role,
    providerBinding: { state: 'UNBOUND', providerFamily: null, modelId: null, connectorId: null },
    contracts: {
      accepts: uniqueContracts(value.contracts.accepts, 'adapterDescriptor.contracts.accepts', 64, 1),
      produces: uniqueContracts(value.contracts.produces, 'adapterDescriptor.contracts.produces', 64, 1)
    },
    requestedPermissions: uniqueIds(value.requestedPermissions, 'adapterDescriptor.requestedPermissions'),
    resourceRequest: normalizeResourceRequest(value.resourceRequest, 'adapterDescriptor.resourceRequest'),
    execution: normalizeExecution(value.execution, 'adapterDescriptor.execution'),
    evidenceCeiling: safeText(value.evidenceCeiling, 'adapterDescriptor.evidenceCeiling', 800),
    truth: {
      neuralOutputAuthority: neuralAuthority,
      memoryAuthority: boolean(value.truth.memoryAuthority, false, 'adapterDescriptor.truth.memoryAuthority'),
      identityAuthority: boolean(value.truth.identityAuthority, false, 'adapterDescriptor.truth.identityAuthority'),
      verificationAuthority: boolean(value.truth.verificationAuthority, false, 'adapterDescriptor.truth.verificationAuthority'),
      truthAuthority: boolean(value.truth.truthAuthority, false, 'adapterDescriptor.truth.truthAuthority')
    }
  };
}

function normalizeBodyDescriptor(value) {
  exactKeys(value, ['schema', 'version', 'descriptorId', 'descriptorVersion', 'status', 'bodyClass', 'interfaces', 'requestedPermissions', 'resourceRequest', 'observationBoundary', 'actuationBoundary', 'execution', 'evidenceCeiling'], 'bodyDescriptor');
  if (value.schema !== SCHEMAS.bodyDescriptor || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'bodyDescriptor schema or version mismatch');
  const interfaces = boundedArray(value.interfaces, 'bodyDescriptor.interfaces', 64, 1).map((item, index) => {
    const label = 'bodyDescriptor.interfaces[' + index + ']';
    exactKeys(item, ['id', 'direction', 'schema'], label);
    return {
      id: stableId(item.id, label + '.id'),
      direction: enumValue(item.direction, ['OBSERVATION_IN', 'OUTPUT_OUT'], label + '.direction'),
      schema: contractToken(item.schema, label + '.schema')
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(interfaces.map(item => item.id)).size !== interfaces.length) fail('DUPLICATE_ID', 'bodyDescriptor.interfaces contains duplicate ids');
  exactKeys(value.observationBoundary, ['allowedInterfaceIds', 'undeclaredObservationAllowed'], 'bodyDescriptor.observationBoundary');
  const allowedInterfaceIds = uniqueIds(value.observationBoundary.allowedInterfaceIds, 'bodyDescriptor.observationBoundary.allowedInterfaceIds', 64, 1);
  if (allowedInterfaceIds.some(id => !interfaces.some(item => item.id === id))) fail('INTERFACE_BOUNDARY', 'observation boundary names an undeclared interface');
  exactKeys(value.actuationBoundary, ['mode', 'allowedInterfaceIds'], 'bodyDescriptor.actuationBoundary');
  if (value.actuationBoundary.mode !== 'UNAVAILABLE_V0_1' || !Array.isArray(value.actuationBoundary.allowedInterfaceIds) || value.actuationBoundary.allowedInterfaceIds.length) fail('ACTUATION_UNAVAILABLE', 'body actuation must remain unavailable with no interfaces in v0.1');
  return {
    schema: SCHEMAS.bodyDescriptor,
    version: VERSION,
    descriptorId: stableId(value.descriptorId, 'bodyDescriptor.descriptorId'),
    descriptorVersion: semanticVersion(value.descriptorVersion, 'bodyDescriptor.descriptorVersion'),
    status: enumValue(value.status, ['EXPERIMENTAL'], 'bodyDescriptor.status'),
    bodyClass: enumValue(value.bodyClass, BODY_CLASSES, 'bodyDescriptor.bodyClass'),
    interfaces,
    requestedPermissions: uniqueIds(value.requestedPermissions, 'bodyDescriptor.requestedPermissions'),
    resourceRequest: normalizeResourceRequest(value.resourceRequest, 'bodyDescriptor.resourceRequest'),
    observationBoundary: {
      allowedInterfaceIds,
      undeclaredObservationAllowed: boolean(value.observationBoundary.undeclaredObservationAllowed, false, 'bodyDescriptor.observationBoundary.undeclaredObservationAllowed')
    },
    actuationBoundary: { mode: 'UNAVAILABLE_V0_1', allowedInterfaceIds: [] },
    execution: normalizeExecution(value.execution, 'bodyDescriptor.execution'),
    evidenceCeiling: safeText(value.evidenceCeiling, 'bodyDescriptor.evidenceCeiling', 800)
  };
}

function normalizeDescriptor(value) {
  plainObject(value, 'descriptor');
  if (value.schema === SCHEMAS.adapterDescriptor) return normalizeAdapterDescriptor(value);
  if (value.schema === SCHEMAS.bodyDescriptor) return normalizeBodyDescriptor(value);
  fail('SCHEMA_MISMATCH', 'descriptor schema is unsupported');
}

function descriptorDigest(value) {
  return sha256(normalizeDescriptor(value));
}

function normalizeSlot(value, index) {
  const label = 'blueprint.slots[' + index + ']';
  exactKeys(value, ['slotId', 'kind', 'role', 'descriptorId', 'descriptorVersion', 'descriptorSha256', 'required'], label);
  const kind = enumValue(value.kind, ['ADAPTER', 'BODY'], label + '.kind');
  const role = enumValue(value.role, ADAPTER_ROLES, label + '.role');
  if (kind === 'BODY' && role !== 'BODY') fail('ROLE_MISMATCH', label + ' BODY descriptors require the BODY role');
  if (kind === 'ADAPTER' && role === 'BODY') fail('ROLE_MISMATCH', label + ' BODY role requires a body descriptor');
  return {
    slotId: stableId(value.slotId, label + '.slotId'),
    kind,
    role,
    descriptorId: stableId(value.descriptorId, label + '.descriptorId'),
    descriptorVersion: semanticVersion(value.descriptorVersion, label + '.descriptorVersion'),
    descriptorSha256: digest(value.descriptorSha256, label + '.descriptorSha256'),
    required: boolean(value.required, true, label + '.required')
  };
}

function normalizeDisclosure(value, index) {
  const label = 'blueprint.lineage.disclosures[' + index + ']';
  exactKeys(value, ['kind', 'statement', 'beforeRef', 'afterRef'], label);
  return {
    kind: enumValue(value.kind, DISCLOSURE_KINDS, label + '.kind'),
    statement: safeText(value.statement, label + '.statement', 1000),
    beforeRef: value.beforeRef === null ? null : normalizeReference(value.beforeRef, label + '.beforeRef'),
    afterRef: value.afterRef === null ? null : normalizeReference(value.afterRef, label + '.afterRef')
  };
}

function normalizeLineage(value) {
  exactKeys(value, ['eventKind', 'parentManifestRefs', 'continuityEvidenceRefs', 'humanDecisionReceiptRef', 'disclosures'], 'blueprint.lineage');
  const disclosures = boundedArray(value.disclosures, 'blueprint.lineage.disclosures', 32).map(normalizeDisclosure)
    .sort((left, right) => (left.kind + left.statement).localeCompare(right.kind + right.statement));
  return {
    eventKind: enumValue(value.eventKind, LINEAGE_KINDS, 'blueprint.lineage.eventKind'),
    parentManifestRefs: normalizeReferences(value.parentManifestRefs, 'blueprint.lineage.parentManifestRefs', 8),
    continuityEvidenceRefs: normalizeReferences(value.continuityEvidenceRefs, 'blueprint.lineage.continuityEvidenceRefs', 64, false),
    humanDecisionReceiptRef: value.humanDecisionReceiptRef === null ? null : normalizeReference(value.humanDecisionReceiptRef, 'blueprint.lineage.humanDecisionReceiptRef'),
    disclosures
  };
}

function normalizeBlueprint(value) {
  exactKeys(value, ['schema', 'version', 'blueprintId', 'identityRoot', 'continuityPolicy', 'resourceEnvelope', 'slots', 'continuityReceiptRefs', 'expectedContinuityHeadDigest', 'lineage'], 'blueprint');
  if (value.schema !== SCHEMAS.blueprint || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'blueprint schema or version mismatch');
  const slots = boundedArray(value.slots, 'blueprint.slots', 128, 2).map(normalizeSlot).sort((left, right) => left.slotId.localeCompare(right.slotId));
  if (new Set(slots.map(slot => slot.slotId)).size !== slots.length) fail('DUPLICATE_ID', 'blueprint.slots contains duplicate slot ids');
  if (new Set(slots.map(slot => slot.descriptorId)).size !== slots.length) fail('DUPLICATE_ID', 'blueprint.slots may reference each descriptor id only once');
  if (!slots.some(slot => slot.kind === 'ADAPTER') || !slots.some(slot => slot.kind === 'BODY')) fail('EMPTY_OR_FAKE_SHELL', 'a shell requires at least one adapter and one body slot');
  const resource = normalizeResourceEnvelope(value.resourceEnvelope);
  const blueprint = {
    schema: SCHEMAS.blueprint,
    version: VERSION,
    blueprintId: stableId(value.blueprintId, 'blueprint.blueprintId'),
    identityRoot: normalizeIdentityRoot(value.identityRoot),
    continuityPolicy: normalizeContinuityPolicy(value.continuityPolicy),
    resourceEnvelope: resource.value,
    slots,
    continuityReceiptRefs: normalizeReferences(value.continuityReceiptRefs, 'blueprint.continuityReceiptRefs', 256, false),
    expectedContinuityHeadDigest: nullableDigest(value.expectedContinuityHeadDigest, 'blueprint.expectedContinuityHeadDigest'),
    lineage: normalizeLineage(value.lineage)
  };
  return { blueprint, resourceGaps: resource.gaps };
}

function blueprintDigest(value) {
  return sha256(normalizeBlueprint(value).blueprint);
}

function successionProposalDigest(value) {
  const blueprint = normalizeBlueprint(value).blueprint;
  return sha256({
    eventKind: blueprint.lineage.eventKind,
    proposedShellId: blueprint.identityRoot.shellId,
    parentManifestRefs: blueprint.lineage.parentManifestRefs,
    continuityEvidenceRefs: blueprint.lineage.continuityEvidenceRefs,
    disclosures: blueprint.lineage.disclosures
  });
}

function normalizeSwapDisclosure(value, label) {
  if (value === null) return null;
  exactKeys(value, ['disclosed', 'beforeDescriptorRef', 'afterDescriptorRef'], label);
  return {
    disclosed: boolean(value.disclosed, true, label + '.disclosed'),
    beforeDescriptorRef: normalizeReference(value.beforeDescriptorRef, label + '.beforeDescriptorRef'),
    afterDescriptorRef: normalizeReference(value.afterDescriptorRef, label + '.afterDescriptorRef')
  };
}

function continuityReceiptCore(value, label) {
  exactKeys(value, ['receiptId', 'policyId', 'sequence', 'previousReceiptDigest', 'eventType', 'status', 'payloadRef', 'candidateReceiptDigest', 'acceptanceReceiptRef', 'rollbackTargetDigest', 'modelSwapDisclosure', 'occurredAt'], label);
  const eventType = enumValue(value.eventType, EVENT_TYPES, label + '.eventType');
  const status = enumValue(value.status, ['CANDIDATE', 'ACCEPTED'], label + '.status');
  const core = {
    receiptId: stableId(value.receiptId, label + '.receiptId', 160),
    policyId: stableId(value.policyId, label + '.policyId'),
    sequence: safeInteger(value.sequence, label + '.sequence'),
    previousReceiptDigest: nullableDigest(value.previousReceiptDigest, label + '.previousReceiptDigest'),
    eventType,
    status,
    payloadRef: normalizeReference(value.payloadRef, label + '.payloadRef'),
    candidateReceiptDigest: nullableDigest(value.candidateReceiptDigest, label + '.candidateReceiptDigest'),
    acceptanceReceiptRef: value.acceptanceReceiptRef === null ? null : normalizeReference(value.acceptanceReceiptRef, label + '.acceptanceReceiptRef'),
    rollbackTargetDigest: nullableDigest(value.rollbackTargetDigest, label + '.rollbackTargetDigest'),
    modelSwapDisclosure: normalizeSwapDisclosure(value.modelSwapDisclosure, label + '.modelSwapDisclosure'),
    occurredAt: timestamp(value.occurredAt, label + '.occurredAt')
  };
  if (core.sequence === 0 && core.previousReceiptDigest !== null) fail('CHAIN_MISMATCH', label + ' first receipt cannot name a predecessor');
  if (core.sequence > 0 && core.previousReceiptDigest === null) fail('CHAIN_MISMATCH', label + ' non-first receipt requires a predecessor');
  if (eventType === 'MEMORY_CANDIDATE') {
    if (status !== 'CANDIDATE' || core.candidateReceiptDigest !== null || core.acceptanceReceiptRef !== null) fail('CANDIDATE_MEMORY_BOUNDARY', 'generated memory remains CANDIDATE until a separate acceptance event');
  } else if (status !== 'ACCEPTED' || core.acceptanceReceiptRef === null) {
    fail('ACCEPTANCE_REQUIRED', label + ' accepted continuity events require a human acceptance receipt reference');
  }
  if (status === 'ACCEPTED' && core.acceptanceReceiptRef.schema !== HUMAN_ACCEPTANCE_SCHEMA) fail('ACCEPTANCE_REQUIRED', label + ' accepted continuity events require an axm.human-acceptance/v1 reference');
  if (eventType === 'MEMORY_ACCEPTANCE' && core.candidateReceiptDigest === null) fail('CANDIDATE_MEMORY_BOUNDARY', 'MEMORY_ACCEPTANCE must bind an earlier candidate receipt');
  if (eventType !== 'MEMORY_ACCEPTANCE' && core.candidateReceiptDigest !== null) fail('CANDIDATE_MEMORY_BOUNDARY', 'candidateReceiptDigest is only valid for MEMORY_ACCEPTANCE');
  if (eventType === 'ROLLBACK' && core.rollbackTargetDigest === null) fail('ROLLBACK_MISMATCH', 'ROLLBACK requires a target digest');
  if (eventType !== 'ROLLBACK' && core.rollbackTargetDigest !== null) fail('ROLLBACK_MISMATCH', 'rollbackTargetDigest is only valid for ROLLBACK');
  if (eventType === 'MODEL_OR_CONNECTOR_SWAP' && core.modelSwapDisclosure === null) fail('MODEL_SWAP_UNDISCLOSED', 'model or connector swaps require explicit before/after disclosure');
  if (eventType !== 'MODEL_OR_CONNECTOR_SWAP' && core.modelSwapDisclosure !== null) fail('MODEL_SWAP_UNDISCLOSED', 'modelSwapDisclosure is only valid for a swap event');
  return core;
}

function createContinuityReceipt(input) {
  const core = continuityReceiptCore(input, 'continuityReceiptInput');
  const receipt = { schema: SCHEMAS.continuityEvent, version: VERSION, ...core, receiptDigest: null };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verifyContinuityReceipt(value) {
  exactKeys(value, ['schema', 'version', 'receiptId', 'policyId', 'sequence', 'previousReceiptDigest', 'eventType', 'status', 'payloadRef', 'candidateReceiptDigest', 'acceptanceReceiptRef', 'rollbackTargetDigest', 'modelSwapDisclosure', 'occurredAt', 'receiptDigest'], 'continuityReceipt');
  if (value.schema !== SCHEMAS.continuityEvent || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'continuityReceipt schema or version mismatch');
  const coreInput = clone(value);
  delete coreInput.schema;
  delete coreInput.version;
  delete coreInput.receiptDigest;
  const rebuilt = createContinuityReceipt(coreInput);
  if (rebuilt.receiptDigest !== value.receiptDigest || canonicalJson(rebuilt) !== canonicalJson(value)) fail('DIGEST_MISMATCH', 'continuity receipt content does not match its digest');
  return rebuilt;
}

function reconstructContinuity(policyValue, receiptValues, expectedHeadDigest) {
  const policy = normalizeContinuityPolicy(policyValue);
  const receipts = boundedArray(receiptValues, 'continuity receipts', 256).map(verifyContinuityReceipt);
  const ids = receipts.map(receipt => receipt.receiptId);
  if (new Set(ids).size !== ids.length) fail('DUPLICATE_ID', 'continuity history contains duplicate receipt ids');
  const allByDigest = new Map();
  const accepted = [];
  const candidates = [];
  let effective = [];
  let previous = null;
  receipts.forEach((receipt, index) => {
    if (receipt.policyId !== policy.policyId) fail('POLICY_MISMATCH', 'continuity receipt policy id mismatch');
    if (receipt.sequence !== index || receipt.previousReceiptDigest !== previous) fail('CHAIN_MISMATCH', 'continuity receipts are altered, missing, or reordered at sequence ' + index);
    if (!policy.acceptedEventTypes.includes(receipt.eventType)) fail('EVENT_NOT_ACCEPTED', 'continuity policy does not accept ' + receipt.eventType);
    if (receipt.status === 'CANDIDATE') {
      candidates.push(receipt.receiptDigest);
    } else {
      if (!policy.acceptance.allowedEventTypes.includes(receipt.eventType)) fail('EVENT_NOT_ACCEPTED', 'acceptance policy does not allow ' + receipt.eventType);
      if (receipt.eventType === 'MEMORY_ACCEPTANCE') {
        const candidate = allByDigest.get(receipt.candidateReceiptDigest);
        if (!candidate || candidate.eventType !== 'MEMORY_CANDIDATE' || candidate.status !== 'CANDIDATE') fail('CANDIDATE_MEMORY_BOUNDARY', 'memory acceptance does not bind an earlier candidate memory receipt');
      }
      if (receipt.eventType === 'ROLLBACK') {
        const targetIndex = effective.indexOf(receipt.rollbackTargetDigest);
        if (targetIndex < 0) fail('ROLLBACK_MISMATCH', 'rollback target is not in the effective accepted history');
        effective = effective.slice(0, targetIndex + 1);
      }
      accepted.push(receipt.receiptDigest);
      effective.push(receipt.receiptDigest);
    }
    allByDigest.set(receipt.receiptDigest, receipt);
    previous = receipt.receiptDigest;
  });
  if (accepted.length > policy.retention.maxAcceptedReceipts || candidates.length > policy.retention.maxCandidateReceipts) fail('RETENTION_BOUNDARY', 'continuity receipt count exceeds the declared policy');
  const expected = expectedHeadDigest === null ? null : digest(expectedHeadDigest, 'expectedContinuityHeadDigest');
  if (receipts.length && expected === null) fail('CONTINUITY_UNKNOWN', 'non-empty continuity history requires an expected head digest');
  if (expected !== previous) fail('CHAIN_MISMATCH', 'continuity head does not match expected head digest');
  const stateCore = {
    state: receipts.length ? 'RECONSTRUCTED' : 'EMPTY',
    headReceiptDigest: previous,
    acceptedReceiptDigests: accepted,
    candidateReceiptDigests: candidates,
    effectiveAcceptedReceiptDigests: effective
  };
  return { ...stateCore, stateDigest: sha256(stateCore) };
}

function humanDecisionCore(value, label) {
  exactKeys(value, ['decisionId', 'decisionAt', 'actor', 'subject', 'decision', 'consent', 'lineageEvidenceRefs', 'continuityEvidenceRefs', 'confirmation'], label);
  exactKeys(value.actor, ['kind', 'id', 'authorshipVerificationRef'], label + '.actor');
  exactKeys(value.subject, ['eventKind', 'parentShellId', 'parentManifestDigest', 'proposedShellId', 'proposalDigest'], label + '.subject');
  exactKeys(value.consent, ['explicit', 'scope', 'automatic'], label + '.consent');
  const decision = enumValue(value.decision, HUMAN_DECISIONS, label + '.decision');
  const confirmations = {
    AUTHORIZE_SUCCESSION_PROPOSAL: 'AUTHORIZE SUCCESSION PROPOSAL',
    AUTHORIZE_RETIREMENT_PROPOSAL: 'AUTHORIZE RETIREMENT PROPOSAL',
    HOLD: 'HOLD IDENTITY LINEAGE PROPOSAL',
    REJECT: 'REJECT IDENTITY LINEAGE PROPOSAL'
  };
  if (value.confirmation !== confirmations[decision]) fail('HUMAN_CONFIRMATION_MISMATCH', label + '.confirmation must exactly bind the decision');
  const subject = {
    eventKind: enumValue(value.subject.eventKind, ['SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL'], label + '.subject.eventKind'),
    parentShellId: stableId(value.subject.parentShellId, label + '.subject.parentShellId'),
    parentManifestDigest: digest(value.subject.parentManifestDigest, label + '.subject.parentManifestDigest'),
    proposedShellId: stableId(value.subject.proposedShellId, label + '.subject.proposedShellId'),
    proposalDigest: digest(value.subject.proposalDigest, label + '.subject.proposalDigest')
  };
  const expectedEvent = {
    AUTHORIZE_SUCCESSION_PROPOSAL: 'SUCCESSION_PROPOSAL',
    AUTHORIZE_RETIREMENT_PROPOSAL: 'RETIREMENT_PROPOSAL'
  }[decision];
  if (expectedEvent && subject.eventKind !== expectedEvent) fail('HUMAN_DECISION_MISMATCH', label + '.decision does not authorize the declared subject event');
  const lineageEvidenceRefs = normalizeReferences(value.lineageEvidenceRefs, label + '.lineageEvidenceRefs', 32);
  const continuityEvidenceRefs = normalizeReferences(value.continuityEvidenceRefs, label + '.continuityEvidenceRefs', 64);
  if (new Set(lineageEvidenceRefs.map(ref => ref.sha256)).size !== lineageEvidenceRefs.length || new Set(continuityEvidenceRefs.map(ref => ref.sha256)).size !== continuityEvidenceRefs.length) fail('DUPLICATE_REFERENCE', label + ' evidence references repeat a digest');
  lineageEvidenceRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.manifest) fail('SCHEMA_MISMATCH', label + '.lineageEvidenceRefs must reference manifests');
  });
  continuityEvidenceRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.continuityEvent) fail('SCHEMA_MISMATCH', label + '.continuityEvidenceRefs must reference continuity events');
  });
  if (expectedEvent) {
    if (lineageEvidenceRefs.length !== 1 || lineageEvidenceRefs[0].id !== subject.parentShellId || lineageEvidenceRefs[0].sha256 !== subject.parentManifestDigest) fail('HUMAN_DECISION_MISMATCH', label + ' authorization must bind one exact parent manifest');
    if (!continuityEvidenceRefs.length) fail('CONTINUITY_UNKNOWN', label + ' authorization requires explicit continuity evidence');
  }
  return {
    decisionId: stableId(value.decisionId, label + '.decisionId', 160),
    decisionAt: timestamp(value.decisionAt, label + '.decisionAt'),
    actor: {
      kind: enumValue(value.actor.kind, ['HUMAN'], label + '.actor.kind'),
      id: stableId(value.actor.id, label + '.actor.id'),
      authorshipVerificationRef: normalizeReference(value.actor.authorshipVerificationRef, label + '.actor.authorshipVerificationRef')
    },
    subject,
    decision,
    consent: {
      explicit: boolean(value.consent.explicit, true, label + '.consent.explicit'),
      scope: enumValue(value.consent.scope, ['SINGLE_LINEAGE_PROPOSAL'], label + '.consent.scope'),
      automatic: boolean(value.consent.automatic, false, label + '.consent.automatic')
    },
    lineageEvidenceRefs,
    continuityEvidenceRefs,
    confirmation: confirmations[decision]
  };
}

function createHumanDecisionReceipt(input) {
  const core = humanDecisionCore(input, 'humanDecisionInput');
  const receipt = {
    schema: SCHEMAS.humanDecisionReceipt,
    version: VERSION,
    ...core,
    truth: {
      humanAuthorshipVerifiedByCompiler: false,
      declarativeReceiptOnly: true,
      successionEffective: false,
      retirementEffective: false,
      automaticInheritance: false,
      automaticPromotion: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verifyHumanDecisionReceipt(value) {
  exactKeys(value, ['schema', 'version', 'decisionId', 'decisionAt', 'actor', 'subject', 'decision', 'consent', 'lineageEvidenceRefs', 'continuityEvidenceRefs', 'confirmation', 'truth', 'receiptDigest'], 'humanDecisionReceipt');
  if (value.schema !== SCHEMAS.humanDecisionReceipt || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'human decision receipt schema or version mismatch');
  exactKeys(value.truth, ['humanAuthorshipVerifiedByCompiler', 'declarativeReceiptOnly', 'successionEffective', 'retirementEffective', 'automaticInheritance', 'automaticPromotion'], 'humanDecisionReceipt.truth');
  boolean(value.truth.humanAuthorshipVerifiedByCompiler, false, 'humanDecisionReceipt.truth.humanAuthorshipVerifiedByCompiler');
  boolean(value.truth.declarativeReceiptOnly, true, 'humanDecisionReceipt.truth.declarativeReceiptOnly');
  ['successionEffective', 'retirementEffective', 'automaticInheritance', 'automaticPromotion'].forEach(key => boolean(value.truth[key], false, 'humanDecisionReceipt.truth.' + key));
  const coreInput = clone(value);
  delete coreInput.schema;
  delete coreInput.version;
  delete coreInput.truth;
  delete coreInput.receiptDigest;
  const rebuilt = createHumanDecisionReceipt(coreInput);
  if (canonicalJson(rebuilt) !== canonicalJson(value)) fail('DIGEST_MISMATCH', 'human decision receipt content does not match its digest');
  return rebuilt;
}

function unsafeExportFinding(value, trail = '$') {
  if (typeof value === 'string') {
    if (/(?:^|[\s'"(])[A-Za-z]:[\\/]/.test(value) || /(?:^|[\s'"(])\\\\/.test(value) || /(?:^|[\s'"(])file:/i.test(value) || /^\//.test(value)) return trail + ' contains a machine path';
    if (/\bBearer\s+[A-Za-z0-9._~-]{12,}/i.test(value) || /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(value) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) return trail + ' contains secret-shaped content';
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return trail + ' contains personal email-shaped content';
    if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(value)) return trail + ' contains session-or-record-id-shaped content';
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const finding = unsafeExportFinding(value[index], trail + '[' + index + ']');
      if (finding) return finding;
    }
    return null;
  }
  const bannedKeys = new Set(['sessionid', 'threadid', 'chatid', 'privatechat', 'rawprompt', 'transcript', 'hiddenreasoning', 'chainofthought', 'authorizationheader', 'apikey', 'secret', 'credential', 'machinepath']);
  for (const key of Object.keys(value)) {
    const alias = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (bannedKeys.has(alias)) return trail + '.' + key + ' is a forbidden export field';
    const finding = unsafeExportFinding(value[key], trail + '.' + key);
    if (finding) return finding;
  }
  return null;
}

function assertExportSafe(value) {
  const finding = unsafeExportFinding(value);
  if (finding) fail('PRIVATE_OR_MACHINE_DATA', finding);
  return true;
}

function referenceForDescriptor(descriptor) {
  return { id: descriptor.descriptorId, schema: descriptor.schema, sha256: sha256(descriptor) };
}

function normalizeLineageReceipt(value) {
  exactKeys(value, ['schema', 'version', 'lineageId', 'eventKind', 'shellId', 'parentManifestRefs', 'continuityEvidenceRefs', 'humanDecisionReceiptRef', 'disclosureKinds', 'state', 'truth', 'receiptDigest'], 'lineageReceipt');
  if (value.schema !== SCHEMAS.lineageReceipt || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'lineage receipt schema or version mismatch');
  exactKeys(value.truth, ['parentManifestBytesMutated', 'nameOrProfileResemblanceEstablishesContinuity', 'successionEffective', 'retirementEffective', 'automaticInheritance', 'automaticPromotion'], 'lineageReceipt.truth');
  const disclosureKinds = boundedArray(value.disclosureKinds, 'lineageReceipt.disclosureKinds', DISCLOSURE_KINDS.length).map((kind, index) => enumValue(kind, DISCLOSURE_KINDS, 'lineageReceipt.disclosureKinds[' + index + ']')).sort();
  if (new Set(disclosureKinds).size !== disclosureKinds.length) fail('DUPLICATE_ID', 'lineageReceipt.disclosureKinds contains duplicates');
  const receipt = {
    schema: SCHEMAS.lineageReceipt,
    version: VERSION,
    lineageId: stableId(value.lineageId, 'lineageReceipt.lineageId', 160),
    eventKind: enumValue(value.eventKind, LINEAGE_KINDS, 'lineageReceipt.eventKind'),
    shellId: stableId(value.shellId, 'lineageReceipt.shellId'),
    parentManifestRefs: normalizeReferences(value.parentManifestRefs, 'lineageReceipt.parentManifestRefs', 8),
    continuityEvidenceRefs: normalizeReferences(value.continuityEvidenceRefs, 'lineageReceipt.continuityEvidenceRefs', 64, false),
    humanDecisionReceiptRef: value.humanDecisionReceiptRef === null ? null : normalizeReference(value.humanDecisionReceiptRef, 'lineageReceipt.humanDecisionReceiptRef'),
    disclosureKinds,
    state: enumValue(value.state, ['ORIGIN_RECORDED', 'FORK_RECORDED', 'MIGRATION_RECORDED', 'RECONSTRUCTION_RECORDED', 'PROPOSED_FOR_EXTERNAL_GATE'], 'lineageReceipt.state'),
    truth: {
      parentManifestBytesMutated: boolean(value.truth.parentManifestBytesMutated, false, 'lineageReceipt.truth.parentManifestBytesMutated'),
      nameOrProfileResemblanceEstablishesContinuity: boolean(value.truth.nameOrProfileResemblanceEstablishesContinuity, false, 'lineageReceipt.truth.nameOrProfileResemblanceEstablishesContinuity'),
      successionEffective: boolean(value.truth.successionEffective, false, 'lineageReceipt.truth.successionEffective'),
      retirementEffective: boolean(value.truth.retirementEffective, false, 'lineageReceipt.truth.retirementEffective'),
      automaticInheritance: boolean(value.truth.automaticInheritance, false, 'lineageReceipt.truth.automaticInheritance'),
      automaticPromotion: boolean(value.truth.automaticPromotion, false, 'lineageReceipt.truth.automaticPromotion')
    },
    receiptDigest: digest(value.receiptDigest, 'lineageReceipt.receiptDigest')
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  if (sha256(payload) !== receipt.receiptDigest || canonicalJson(receipt) !== canonicalJson(value)) fail('DIGEST_MISMATCH', 'lineage receipt content does not match its digest or canonical form');
  return receipt;
}

function assertLineageReceiptSemantics(lineage) {
  const states = {
    ORIGIN: 'ORIGIN_RECORDED',
    FORK: 'FORK_RECORDED',
    MIGRATION: 'MIGRATION_RECORDED',
    RECONSTRUCTION: 'RECONSTRUCTION_RECORDED',
    SUCCESSION_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE',
    RETIREMENT_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE'
  };
  if (lineage.state !== states[lineage.eventKind]) fail('LINEAGE_MISMATCH', 'lineage state does not match its event kind');
  lineage.parentManifestRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.manifest) fail('SCHEMA_MISMATCH', 'lineage parent references must name manifests');
  });
  lineage.continuityEvidenceRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.continuityEvent) fail('SCHEMA_MISMATCH', 'lineage continuity evidence must name continuity events');
  });
  if (new Set(lineage.parentManifestRefs.map(ref => ref.sha256)).size !== lineage.parentManifestRefs.length || new Set(lineage.continuityEvidenceRefs.map(ref => ref.sha256)).size !== lineage.continuityEvidenceRefs.length) fail('DUPLICATE_REFERENCE', 'lineage references repeat a digest');
  if (lineage.humanDecisionReceiptRef && lineage.humanDecisionReceiptRef.schema !== SCHEMAS.humanDecisionReceipt) fail('SCHEMA_MISMATCH', 'lineage human decision reference schema mismatch');
  if (lineage.eventKind === 'ORIGIN') {
    if (lineage.parentManifestRefs.length || lineage.humanDecisionReceiptRef !== null) fail('LINEAGE_MISMATCH', 'ORIGIN lineage cannot name a parent or human decision');
  } else if (lineage.parentManifestRefs.length !== 1) fail('LINEAGE_MISMATCH', 'non-origin lineage requires one parent reference');
  const parent = lineage.parentManifestRefs[0] || null;
  if (lineage.eventKind === 'FORK' && (!parent || parent.id === lineage.shellId || !lineage.disclosureKinds.includes('FORK'))) fail('LINEAGE_MISMATCH', 'FORK lineage boundary mismatch');
  if (['MIGRATION', 'RECONSTRUCTION', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind) && parent && parent.id !== lineage.shellId) fail('LINEAGE_MISMATCH', 'continuation lineage must retain its parent shell id');
  if (lineage.eventKind === 'SUCCESSION_PROPOSAL' && parent && parent.id === lineage.shellId) fail('LINEAGE_MISMATCH', 'SUCCESSION_PROPOSAL requires a distinct shell id');
  if (['MIGRATION', 'RECONSTRUCTION', 'SUCCESSION_PROPOSAL'].includes(lineage.eventKind) && !lineage.continuityEvidenceRefs.length) fail('CONTINUITY_UNKNOWN', 'lineage event requires continuity evidence');
  const requiredDisclosure = { MIGRATION: 'MIGRATION', RECONSTRUCTION: 'RECONSTRUCTION', SUCCESSION_PROPOSAL: 'SUCCESSION', RETIREMENT_PROPOSAL: 'RETIREMENT' }[lineage.eventKind];
  if (requiredDisclosure && !lineage.disclosureKinds.includes(requiredDisclosure)) fail('LINEAGE_DISCLOSURE_REQUIRED', 'lineage event is missing its required disclosure');
  if (['SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind)) {
    if (!lineage.humanDecisionReceiptRef) fail('HUMAN_DECISION_REQUIRED', 'lineage proposal requires a human decision reference');
  } else if (lineage.humanDecisionReceiptRef !== null) fail('HUMAN_DECISION_MISMATCH', 'lineage event cannot consume a human decision reference');
}

function verifyLineageReceipt(value) {
  const receipt = normalizeLineageReceipt(value);
  assertLineageReceiptSemantics(receipt);
  assertExportSafe(receipt);
  return receipt;
}

function createLineageReceipt(blueprint) {
  const states = {
    ORIGIN: 'ORIGIN_RECORDED',
    FORK: 'FORK_RECORDED',
    MIGRATION: 'MIGRATION_RECORDED',
    RECONSTRUCTION: 'RECONSTRUCTION_RECORDED',
    SUCCESSION_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE',
    RETIREMENT_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE'
  };
  const receipt = {
    schema: SCHEMAS.lineageReceipt,
    version: VERSION,
    lineageId: blueprint.blueprintId,
    eventKind: blueprint.lineage.eventKind,
    shellId: blueprint.identityRoot.shellId,
    parentManifestRefs: blueprint.lineage.parentManifestRefs,
    continuityEvidenceRefs: blueprint.lineage.continuityEvidenceRefs,
    humanDecisionReceiptRef: blueprint.lineage.humanDecisionReceiptRef,
    disclosureKinds: [...new Set(blueprint.lineage.disclosures.map(item => item.kind))].sort(),
    state: states[blueprint.lineage.eventKind],
    truth: {
      parentManifestBytesMutated: false,
      nameOrProfileResemblanceEstablishesContinuity: false,
      successionEffective: false,
      retirementEffective: false,
      automaticInheritance: false,
      automaticPromotion: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return verifyLineageReceipt(receipt);
}

function normalizeContinuityState(value) {
  exactKeys(value, ['state', 'headReceiptDigest', 'acceptedReceiptDigests', 'candidateReceiptDigests', 'effectiveAcceptedReceiptDigests', 'stateDigest'], 'manifest.continuity');
  const core = {
    state: enumValue(value.state, ['EMPTY', 'RECONSTRUCTED'], 'manifest.continuity.state'),
    headReceiptDigest: nullableDigest(value.headReceiptDigest, 'manifest.continuity.headReceiptDigest'),
    acceptedReceiptDigests: boundedArray(value.acceptedReceiptDigests, 'manifest.continuity.acceptedReceiptDigests', 256).map((item, index) => digest(item, 'manifest.continuity.acceptedReceiptDigests[' + index + ']')),
    candidateReceiptDigests: boundedArray(value.candidateReceiptDigests, 'manifest.continuity.candidateReceiptDigests', 256).map((item, index) => digest(item, 'manifest.continuity.candidateReceiptDigests[' + index + ']')),
    effectiveAcceptedReceiptDigests: boundedArray(value.effectiveAcceptedReceiptDigests, 'manifest.continuity.effectiveAcceptedReceiptDigests', 256).map((item, index) => digest(item, 'manifest.continuity.effectiveAcceptedReceiptDigests[' + index + ']'))
  };
  ['acceptedReceiptDigests', 'candidateReceiptDigests', 'effectiveAcceptedReceiptDigests'].forEach(key => {
    if (new Set(core[key]).size !== core[key].length) fail('DUPLICATE_REFERENCE', 'manifest.continuity.' + key + ' contains duplicates');
  });
  const stateDigest = digest(value.stateDigest, 'manifest.continuity.stateDigest');
  if (sha256(core) !== stateDigest) fail('DIGEST_MISMATCH', 'manifest continuity state digest mismatch');
  return { ...core, stateDigest };
}

function normalizeManifestComponent(value, index) {
  const label = 'manifest.components[' + index + ']';
  exactKeys(value, ['slotId', 'kind', 'role', 'descriptorRef', 'descriptor'], label);
  const descriptor = normalizeDescriptor(value.descriptor);
  const descriptorRef = normalizeReference(value.descriptorRef, label + '.descriptorRef');
  if (descriptorRef.id !== descriptor.descriptorId || descriptorRef.schema !== descriptor.schema || descriptorRef.sha256 !== sha256(descriptor)) fail('DIGEST_MISMATCH', label + ' descriptor reference mismatch');
  const kind = enumValue(value.kind, ['ADAPTER', 'BODY'], label + '.kind');
  const role = enumValue(value.role, ADAPTER_ROLES, label + '.role');
  if ((descriptor.schema === SCHEMAS.bodyDescriptor) !== (kind === 'BODY') || (kind === 'BODY' && role !== 'BODY') || (kind === 'ADAPTER' && descriptor.role !== role)) fail('ROLE_MISMATCH', label + ' descriptor kind or role mismatch');
  return { slotId: stableId(value.slotId, label + '.slotId'), kind, role, descriptorRef, descriptor };
}

function assertManifestSemantics(manifest) {
  if (manifest.blueprintRef.schema !== SCHEMAS.blueprint) fail('SCHEMA_MISMATCH', 'manifest blueprint reference schema mismatch');
  if (!manifest.components.some(component => component.kind === 'ADAPTER') || !manifest.components.some(component => component.kind === 'BODY')) {
    fail('EMPTY_OR_FAKE_SHELL', 'a compiled shell requires at least one adapter and one body component');
  }
  const descriptorIds = manifest.components.map(component => component.descriptor.descriptorId);
  if (new Set(descriptorIds).size !== descriptorIds.length) fail('AMBIGUOUS_COMPONENT_VERSION', 'manifest components may embed each descriptor id only once');
  const permitted = new Set(manifest.identityRoot.authority.permittedPermissions);
  manifest.components.forEach(component => component.descriptor.requestedPermissions.forEach(permission => {
    if (!permitted.has(permission)) fail('AUTHORITY_EXPANSION', 'component ' + component.descriptor.descriptorId + ' requests unauthorized permission ' + permission);
  }));
  assertResources(manifest.components, manifest.resourceEnvelope);

  const continuity = manifest.continuity;
  const accepted = new Set(continuity.acceptedReceiptDigests);
  const candidates = new Set(continuity.candidateReceiptDigests);
  if (continuity.candidateReceiptDigests.some(item => accepted.has(item))) fail('CONTINUITY_STATE_MISMATCH', 'a continuity receipt cannot be both accepted and candidate');
  if (continuity.effectiveAcceptedReceiptDigests.some(item => !accepted.has(item))) fail('CONTINUITY_STATE_MISMATCH', 'effective continuity receipts must be accepted history');
  let effectiveCursor = -1;
  continuity.effectiveAcceptedReceiptDigests.forEach(item => {
    const next = continuity.acceptedReceiptDigests.indexOf(item, effectiveCursor + 1);
    if (next < 0) fail('CONTINUITY_STATE_MISMATCH', 'effective continuity must preserve accepted-history order');
    effectiveCursor = next;
  });
  if (continuity.state === 'EMPTY' && (continuity.headReceiptDigest !== null || accepted.size || candidates.size || continuity.effectiveAcceptedReceiptDigests.length)) {
    fail('CONTINUITY_STATE_MISMATCH', 'EMPTY continuity cannot contain history');
  }
  if (continuity.state === 'RECONSTRUCTED') {
    if (!accepted.size && !candidates.size) fail('CONTINUITY_STATE_MISMATCH', 'RECONSTRUCTED continuity requires history');
    if (!accepted.has(continuity.headReceiptDigest) && !candidates.has(continuity.headReceiptDigest)) fail('CONTINUITY_STATE_MISMATCH', 'continuity head must name declared history');
  }
  if (continuity.acceptedReceiptDigests.length > manifest.continuityPolicy.retention.maxAcceptedReceipts || continuity.candidateReceiptDigests.length > manifest.continuityPolicy.retention.maxCandidateReceipts) {
    fail('RETENTION_BOUNDARY', 'manifest continuity exceeds its declared retention policy');
  }

  const lineage = manifest.lineageReceipt;
  const states = {
    ORIGIN: 'ORIGIN_RECORDED',
    FORK: 'FORK_RECORDED',
    MIGRATION: 'MIGRATION_RECORDED',
    RECONSTRUCTION: 'RECONSTRUCTION_RECORDED',
    SUCCESSION_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE',
    RETIREMENT_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE'
  };
  const lifecycleStates = {
    ORIGIN: 'ACTIVE_PROPOSAL',
    FORK: 'ACTIVE_PROPOSAL',
    MIGRATION: 'ACTIVE_PROPOSAL',
    RECONSTRUCTION: 'ACTIVE_PROPOSAL',
    SUCCESSION_PROPOSAL: 'SUCCESSION_PROPOSED',
    RETIREMENT_PROPOSAL: 'RETIREMENT_PROPOSED'
  };
  if (lineage.shellId !== manifest.shellId || lineage.state !== states[lineage.eventKind] || manifest.lifecycleState !== lifecycleStates[lineage.eventKind]) {
    fail('LINEAGE_MISMATCH', 'manifest lifecycle, shell id, and lineage receipt must agree');
  }
  lineage.parentManifestRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.manifest) fail('SCHEMA_MISMATCH', 'lineage parent reference schema mismatch');
  });
  if (new Set(lineage.parentManifestRefs.map(ref => ref.sha256)).size !== lineage.parentManifestRefs.length) fail('DUPLICATE_REFERENCE', 'lineage parent references repeat a digest');
  lineage.continuityEvidenceRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.continuityEvent) fail('SCHEMA_MISMATCH', 'lineage continuity reference schema mismatch');
    if (!accepted.has(ref.sha256) && !candidates.has(ref.sha256)) fail('CONTINUITY_UNKNOWN', 'lineage continuity evidence is absent from manifest continuity history');
  });
  if (new Set(lineage.continuityEvidenceRefs.map(ref => ref.sha256)).size !== lineage.continuityEvidenceRefs.length) fail('DUPLICATE_REFERENCE', 'lineage continuity references repeat a digest');
  if (lineage.humanDecisionReceiptRef && lineage.humanDecisionReceiptRef.schema !== SCHEMAS.humanDecisionReceipt) fail('SCHEMA_MISMATCH', 'lineage human decision reference schema mismatch');
  if (lineage.eventKind === 'ORIGIN') {
    if (lineage.parentManifestRefs.length || lineage.humanDecisionReceiptRef !== null) fail('LINEAGE_MISMATCH', 'ORIGIN lineage cannot name a parent or human decision');
  } else if (lineage.parentManifestRefs.length !== 1) fail('LINEAGE_MISMATCH', 'non-origin lineage requires one exact parent reference');
  const parent = lineage.parentManifestRefs[0] || null;
  if (lineage.eventKind === 'FORK' && (!parent || parent.id === manifest.shellId || !lineage.disclosureKinds.includes('FORK'))) fail('LINEAGE_MISMATCH', 'FORK lineage boundary mismatch');
  if (['MIGRATION', 'RECONSTRUCTION', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind) && parent && parent.id !== manifest.shellId) fail('LINEAGE_MISMATCH', 'continuation lineage must retain the parent shell id');
  if (lineage.eventKind === 'SUCCESSION_PROPOSAL' && parent && parent.id === manifest.shellId) fail('LINEAGE_MISMATCH', 'SUCCESSION_PROPOSAL requires a distinct shell id');
  if (['MIGRATION', 'RECONSTRUCTION', 'SUCCESSION_PROPOSAL'].includes(lineage.eventKind) && !lineage.continuityEvidenceRefs.length) fail('CONTINUITY_UNKNOWN', 'lineage event requires continuity evidence');
  const requiredDisclosure = { MIGRATION: 'MIGRATION', RECONSTRUCTION: 'RECONSTRUCTION', SUCCESSION_PROPOSAL: 'SUCCESSION', RETIREMENT_PROPOSAL: 'RETIREMENT' }[lineage.eventKind];
  if (requiredDisclosure && !lineage.disclosureKinds.includes(requiredDisclosure)) fail('LINEAGE_DISCLOSURE_REQUIRED', 'lineage event is missing its required disclosure');
  if (['SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind)) {
    if (!lineage.humanDecisionReceiptRef) fail('HUMAN_DECISION_REQUIRED', 'lineage proposal requires a human decision receipt reference');
  } else if (lineage.humanDecisionReceiptRef !== null) fail('HUMAN_DECISION_MISMATCH', 'lineage event cannot consume a human decision receipt');
}

function verifyManifest(value) {
  exactKeys(value, ['schema', 'version', 'status', 'lifecycleState', 'shellId', 'blueprintRef', 'identityRoot', 'continuityPolicy', 'resourceEnvelope', 'components', 'continuity', 'lineageReceipt', 'portability', 'truth', 'manifestDigest'], 'manifest');
  if (value.schema !== SCHEMAS.manifest || value.version !== VERSION || value.status !== STATUS) fail('SCHEMA_MISMATCH', 'manifest schema, version, or status mismatch');
  const resource = normalizeResourceEnvelope(value.resourceEnvelope);
  if (resource.gaps.length) fail('UNKNOWN_NOT_UNLIMITED', 'compiled manifest cannot contain UNKNOWN resource ceilings');
  const components = boundedArray(value.components, 'manifest.components', 128, 2).map(normalizeManifestComponent).sort((left, right) => left.slotId.localeCompare(right.slotId));
  if (new Set(components.map(item => item.slotId)).size !== components.length) fail('DUPLICATE_ID', 'manifest components contain duplicate slots');
  exactKeys(value.portability, ['format', 'encoding', 'providerIndependent', 'valueFreeClaimed', 'machinePathsIncluded', 'secretsIncluded', 'privateChatsIncluded', 'hiddenReasoningIncluded', 'defaultsApplied'], 'manifest.portability');
  exactKeys(value.truth, ['inert', 'runtimeClaimed', 'adapterCodeLoaded', 'modelExecuted', 'networkUsed', 'filesystemMutated', 'actuationPerformed', 'identityStateExpandedByAttachment', 'memorySilentlyAccepted', 'consciousnessClaimed', 'subjectiveContinuityClaimed', 'installed', 'promoted', 'canon'], 'manifest.truth');
  const manifest = {
    schema: SCHEMAS.manifest,
    version: VERSION,
    status: STATUS,
    lifecycleState: enumValue(value.lifecycleState, ['ACTIVE_PROPOSAL', 'SUCCESSION_PROPOSED', 'RETIREMENT_PROPOSED'], 'manifest.lifecycleState'),
    shellId: stableId(value.shellId, 'manifest.shellId'),
    blueprintRef: normalizeReference(value.blueprintRef, 'manifest.blueprintRef'),
    identityRoot: normalizeIdentityRoot(value.identityRoot),
    continuityPolicy: normalizeContinuityPolicy(value.continuityPolicy),
    resourceEnvelope: resource.value,
    components,
    continuity: normalizeContinuityState(value.continuity),
    lineageReceipt: verifyLineageReceipt(value.lineageReceipt),
    portability: {
      format: enumValue(value.portability.format, ['CANONICAL_JSON'], 'manifest.portability.format'),
      encoding: enumValue(value.portability.encoding, ['UTF-8'], 'manifest.portability.encoding'),
      providerIndependent: boolean(value.portability.providerIndependent, true, 'manifest.portability.providerIndependent'),
      valueFreeClaimed: boolean(value.portability.valueFreeClaimed, false, 'manifest.portability.valueFreeClaimed'),
      machinePathsIncluded: boolean(value.portability.machinePathsIncluded, false, 'manifest.portability.machinePathsIncluded'),
      secretsIncluded: boolean(value.portability.secretsIncluded, false, 'manifest.portability.secretsIncluded'),
      privateChatsIncluded: boolean(value.portability.privateChatsIncluded, false, 'manifest.portability.privateChatsIncluded'),
      hiddenReasoningIncluded: boolean(value.portability.hiddenReasoningIncluded, false, 'manifest.portability.hiddenReasoningIncluded'),
      defaultsApplied: boundedArray(value.portability.defaultsApplied, 'manifest.portability.defaultsApplied', 0)
    },
    truth: {
      inert: boolean(value.truth.inert, true, 'manifest.truth.inert'),
      runtimeClaimed: boolean(value.truth.runtimeClaimed, false, 'manifest.truth.runtimeClaimed'),
      adapterCodeLoaded: boolean(value.truth.adapterCodeLoaded, false, 'manifest.truth.adapterCodeLoaded'),
      modelExecuted: boolean(value.truth.modelExecuted, false, 'manifest.truth.modelExecuted'),
      networkUsed: boolean(value.truth.networkUsed, false, 'manifest.truth.networkUsed'),
      filesystemMutated: boolean(value.truth.filesystemMutated, false, 'manifest.truth.filesystemMutated'),
      actuationPerformed: boolean(value.truth.actuationPerformed, false, 'manifest.truth.actuationPerformed'),
      identityStateExpandedByAttachment: boolean(value.truth.identityStateExpandedByAttachment, false, 'manifest.truth.identityStateExpandedByAttachment'),
      memorySilentlyAccepted: boolean(value.truth.memorySilentlyAccepted, false, 'manifest.truth.memorySilentlyAccepted'),
      consciousnessClaimed: boolean(value.truth.consciousnessClaimed, false, 'manifest.truth.consciousnessClaimed'),
      subjectiveContinuityClaimed: boolean(value.truth.subjectiveContinuityClaimed, false, 'manifest.truth.subjectiveContinuityClaimed'),
      installed: boolean(value.truth.installed, false, 'manifest.truth.installed'),
      promoted: boolean(value.truth.promoted, false, 'manifest.truth.promoted'),
      canon: boolean(value.truth.canon, false, 'manifest.truth.canon')
    },
    manifestDigest: digest(value.manifestDigest, 'manifest.manifestDigest')
  };
  if (manifest.shellId !== manifest.identityRoot.shellId) fail('IDENTITY_MISMATCH', 'manifest shell id does not match identity root');
  assertManifestSemantics(manifest);
  const payload = clone(manifest);
  delete payload.manifestDigest;
  if (sha256(payload) !== manifest.manifestDigest || canonicalJson(manifest) !== canonicalJson(value)) fail('DIGEST_MISMATCH', 'manifest content does not match its digest');
  assertExportSafe(manifest);
  return manifest;
}

function manifestReference(manifest) {
  return { id: manifest.shellId, schema: SCHEMAS.manifest, sha256: manifest.manifestDigest };
}

function gap(capabilityId, gapType, reason, cheapestEvidence) {
  return { capabilityId, gapType, state: 'UNKNOWN_HOLD', reason, cheapestEvidence };
}

function createBuildGapReceipt(blueprint, gaps, manifest, lineageReceipt) {
  const unique = new Map();
  gaps.forEach(item => unique.set(item.capabilityId + '|' + item.reason, item));
  const sortedGaps = Array.from(unique.values()).sort((left, right) => (left.capabilityId + left.reason).localeCompare(right.capabilityId + right.reason));
  const status = sortedGaps.length ? 'HOLD' : 'COMPILED';
  const receipt = {
    schema: SCHEMAS.buildGapReceipt,
    version: VERSION,
    status,
    blueprintRef: { id: blueprint.blueprintId, schema: SCHEMAS.blueprint, sha256: sha256(blueprint) },
    gaps: sortedGaps,
    outputs: {
      manifestRef: manifest ? manifestReference(manifest) : null,
      lineageReceiptRef: lineageReceipt ? { id: lineageReceipt.lineageId, schema: SCHEMAS.lineageReceipt, sha256: lineageReceipt.receiptDigest } : null
    },
    truth: {
      runtimeClaimFollows: false,
      executionPerformed: false,
      modelInvoked: false,
      networkUsed: false,
      filesystemMutated: false,
      actuationPerformed: false,
      humanDecisionAuthenticatedByCompiler: false,
      installed: false,
      promoted: false,
      canon: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return verifyBuildGapReceipt(receipt);
}

function verifyBuildGapReceipt(value) {
  exactKeys(value, ['schema', 'version', 'status', 'blueprintRef', 'gaps', 'outputs', 'truth', 'receiptDigest'], 'buildGapReceipt');
  if (value.schema !== SCHEMAS.buildGapReceipt || value.version !== VERSION) fail('SCHEMA_MISMATCH', 'build/gap receipt schema or version mismatch');
  const blueprintRef = normalizeReference(value.blueprintRef, 'buildGapReceipt.blueprintRef');
  if (blueprintRef.schema !== SCHEMAS.blueprint) fail('SCHEMA_MISMATCH', 'build/gap receipt blueprint reference schema mismatch');
  const gaps = boundedArray(value.gaps, 'buildGapReceipt.gaps', 128).map((item, index) => {
    const label = 'buildGapReceipt.gaps[' + index + ']';
    exactKeys(item, ['capabilityId', 'gapType', 'state', 'reason', 'cheapestEvidence'], label);
    return {
      capabilityId: stableId(item.capabilityId, label + '.capabilityId', 160),
      gapType: enumValue(item.gapType, ['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT', 'UNKNOWN'], label + '.gapType'),
      state: enumValue(item.state, ['UNKNOWN_HOLD'], label + '.state'),
      reason: safeText(item.reason, label + '.reason', 1200),
      cheapestEvidence: safeText(item.cheapestEvidence, label + '.cheapestEvidence', 1200)
    };
  }).sort((left, right) => (left.capabilityId + left.reason).localeCompare(right.capabilityId + right.reason));
  const gapKeys = gaps.map(item => item.capabilityId + '|' + item.reason);
  if (new Set(gapKeys).size !== gapKeys.length) fail('DUPLICATE_REFERENCE', 'build/gap receipt contains duplicate gaps');
  exactKeys(value.outputs, ['manifestRef', 'lineageReceiptRef'], 'buildGapReceipt.outputs');
  const manifestRef = value.outputs.manifestRef === null ? null : normalizeReference(value.outputs.manifestRef, 'buildGapReceipt.outputs.manifestRef');
  const lineageReceiptRef = value.outputs.lineageReceiptRef === null ? null : normalizeReference(value.outputs.lineageReceiptRef, 'buildGapReceipt.outputs.lineageReceiptRef');
  if (manifestRef && manifestRef.schema !== SCHEMAS.manifest) fail('SCHEMA_MISMATCH', 'build/gap manifest output reference schema mismatch');
  if (lineageReceiptRef && lineageReceiptRef.schema !== SCHEMAS.lineageReceipt) fail('SCHEMA_MISMATCH', 'build/gap lineage output reference schema mismatch');
  exactKeys(value.truth, ['runtimeClaimFollows', 'executionPerformed', 'modelInvoked', 'networkUsed', 'filesystemMutated', 'actuationPerformed', 'humanDecisionAuthenticatedByCompiler', 'installed', 'promoted', 'canon'], 'buildGapReceipt.truth');
  const truth = {};
  Object.keys(value.truth).forEach(key => { truth[key] = boolean(value.truth[key], false, 'buildGapReceipt.truth.' + key); });
  const status = enumValue(value.status, ['COMPILED', 'HOLD'], 'buildGapReceipt.status');
  if (status === 'COMPILED' && (gaps.length || !manifestRef || !lineageReceiptRef)) fail('BUILD_RECEIPT_MISMATCH', 'COMPILED build receipt requires no gaps and exact manifest plus lineage outputs');
  if (status === 'HOLD' && (!gaps.length || manifestRef !== null || lineageReceiptRef !== null)) fail('BUILD_RECEIPT_MISMATCH', 'HOLD build receipt requires typed gaps and no compiled outputs');
  const receipt = {
    schema: SCHEMAS.buildGapReceipt,
    version: VERSION,
    status,
    blueprintRef,
    gaps,
    outputs: { manifestRef, lineageReceiptRef },
    truth,
    receiptDigest: digest(value.receiptDigest, 'buildGapReceipt.receiptDigest')
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  if (sha256(payload) !== receipt.receiptDigest || canonicalJson(receipt) !== canonicalJson(value)) fail('DIGEST_MISMATCH', 'build/gap receipt content does not match its digest or canonical form');
  assertExportSafe(receipt);
  return receipt;
}

function assertResources(components, envelope) {
  const totals = components.reduce((sum, component) => {
    const request = component.descriptor.resourceRequest;
    sum.compute += request.computeUnits;
    sum.memory += request.memoryBytes;
    sum.storage += request.storageBytes;
    sum.time += request.timeMilliseconds;
    sum.energy += request.energyMilliwattHours;
    request.networkDomains.forEach(domain => sum.network.add(domain));
    sum.actuation += request.actuationOperations;
    return sum;
  }, { compute: 0, memory: 0, storage: 0, time: 0, energy: 0, network: new Set(), actuation: 0 });
  const pairs = [['compute', 'compute'], ['memory', 'memory'], ['storage', 'storage'], ['time', 'time'], ['energy', 'energy']];
  pairs.forEach(([totalKey, envelopeKey]) => {
    const ceiling = envelope[envelopeKey];
    if (ceiling.state === 'KNOWN' && (totals[totalKey] > ceiling.requested || totals[totalKey] > ceiling.permitted)) fail('RESOURCE_EXPANSION', 'component ' + totalKey + ' request exceeds the shell envelope');
  });
  if (envelope.network.state === 'KNOWN') {
    for (const domain of totals.network) {
      if (!envelope.network.requestedDomains.includes(domain) || !envelope.network.permittedDomains.includes(domain)) fail('AUTHORITY_EXPANSION', 'component network domain exceeds the shell envelope');
    }
  }
  if (totals.actuation !== 0) fail('ACTUATION_UNAVAILABLE', 'component attachment requests actuation');
}

function hasDisclosure(blueprint, kind) {
  return blueprint.lineage.disclosures.some(item => item.kind === kind);
}

function compareComponents(parent, components) {
  const before = new Map(parent.components.map(component => [component.slotId, component]));
  const after = new Map(components.map(component => [component.slotId, component]));
  const ids = Array.from(new Set([...before.keys(), ...after.keys()]));
  const changed = ids.filter(id => {
    const left = before.get(id);
    const right = after.get(id);
    return !left || !right || left.descriptorRef.sha256 !== right.descriptorRef.sha256;
  });
  return {
    anyAdapter: changed.some(id => (before.get(id) && before.get(id).kind === 'ADAPTER') || (after.get(id) && after.get(id).kind === 'ADAPTER')),
    anyBody: changed.some(id => (before.get(id) && before.get(id).kind === 'BODY') || (after.get(id) && after.get(id).kind === 'BODY')),
    neural: changed.some(id => (before.get(id) && before.get(id).role === 'NEURAL_REASONER') || (after.get(id) && after.get(id).role === 'NEURAL_REASONER'))
  };
}

function validateLineage(blueprint, parents, components, humanDecision) {
  const kind = blueprint.lineage.eventKind;
  const shellId = blueprint.identityRoot.shellId;
  const parent = parents[0] || null;
  if (kind === 'ORIGIN') {
    if (parents.length || blueprint.lineage.parentManifestRefs.length || blueprint.lineage.humanDecisionReceiptRef !== null) fail('LINEAGE_MISMATCH', 'ORIGIN cannot claim parents or a human lineage decision');
    return;
  }
  if (parents.length !== 1 || blueprint.lineage.parentManifestRefs.length !== 1) fail('LINEAGE_MISMATCH', kind + ' requires exactly one exact parent manifest');
  if (kind === 'FORK') {
    if (shellId === parent.shellId) fail('FORK_IDENTITY_REUSE', 'a copied shell is a FORK and must use a new shell id');
    if (!hasDisclosure(blueprint, 'FORK')) fail('LINEAGE_DISCLOSURE_REQUIRED', 'FORK requires explicit fork disclosure');
    return;
  }
  if (['MIGRATION', 'RECONSTRUCTION', 'RETIREMENT_PROPOSAL'].includes(kind) && shellId !== parent.shellId) fail('LINEAGE_MISMATCH', kind + ' must retain the exact parent shell id');
  if (kind === 'SUCCESSION_PROPOSAL' && shellId === parent.shellId) fail('SUCCESSION_NOT_FORK', 'SUCCESSION_PROPOSAL must name a distinct proposed shell id');
  if (['MIGRATION', 'RECONSTRUCTION', 'SUCCESSION_PROPOSAL'].includes(kind) && !blueprint.lineage.continuityEvidenceRefs.length) fail('CONTINUITY_UNKNOWN', kind + ' requires continuity evidence');
  if (kind === 'MIGRATION') {
    if (!hasDisclosure(blueprint, 'MIGRATION')) fail('LINEAGE_DISCLOSURE_REQUIRED', 'MIGRATION requires explicit migration disclosure');
    const changes = compareComponents(parent, components);
    if (changes.anyAdapter && !hasDisclosure(blueprint, 'ADAPTER_SWAP')) fail('MODEL_SWAP_UNDISCLOSED', 'adapter changes require ADAPTER_SWAP disclosure');
    if (changes.anyBody && !hasDisclosure(blueprint, 'BODY_SWAP')) fail('LINEAGE_DISCLOSURE_REQUIRED', 'body changes require BODY_SWAP disclosure');
    if (changes.neural && !hasDisclosure(blueprint, 'MODEL_OR_CONNECTOR_SWAP')) fail('MODEL_SWAP_UNDISCLOSED', 'neural adapter changes require MODEL_OR_CONNECTOR_SWAP disclosure');
  }
  if (kind === 'RECONSTRUCTION' && !hasDisclosure(blueprint, 'RECONSTRUCTION')) fail('LINEAGE_DISCLOSURE_REQUIRED', 'RECONSTRUCTION requires explicit reconstruction disclosure');
  if (kind === 'SUCCESSION_PROPOSAL' || kind === 'RETIREMENT_PROPOSAL') {
    const expectedDisclosure = kind === 'SUCCESSION_PROPOSAL' ? 'SUCCESSION' : 'RETIREMENT';
    const expectedDecision = kind === 'SUCCESSION_PROPOSAL' ? 'AUTHORIZE_SUCCESSION_PROPOSAL' : 'AUTHORIZE_RETIREMENT_PROPOSAL';
    if (!hasDisclosure(blueprint, expectedDisclosure)) fail('LINEAGE_DISCLOSURE_REQUIRED', kind + ' requires explicit disclosure');
    if (!humanDecision) fail('HUMAN_DECISION_REQUIRED', kind + ' requires a human decision receipt');
    if (humanDecision.decision !== expectedDecision || humanDecision.subject.eventKind !== kind || humanDecision.subject.parentShellId !== parent.shellId || humanDecision.subject.parentManifestDigest !== parent.manifestDigest || humanDecision.subject.proposedShellId !== shellId || humanDecision.subject.proposalDigest !== successionProposalDigest(blueprint)) fail('HUMAN_DECISION_MISMATCH', 'human decision receipt does not exactly bind the lineage proposal');
    if (canonicalJson(humanDecision.lineageEvidenceRefs) !== canonicalJson(blueprint.lineage.parentManifestRefs) || canonicalJson(humanDecision.continuityEvidenceRefs) !== canonicalJson(blueprint.lineage.continuityEvidenceRefs)) fail('HUMAN_DECISION_MISMATCH', 'human decision evidence references do not exactly bind the lineage proposal evidence');
  } else if (blueprint.lineage.humanDecisionReceiptRef !== null) {
    fail('HUMAN_DECISION_MISMATCH', kind + ' cannot consume a succession or retirement decision receipt');
  }
}

function compileShell(input) {
  exactKeys(input, ['blueprint', 'descriptors', 'parentManifests', 'continuityReceipts', 'humanDecisionReceipts'], 'compileInput');
  const normalized = normalizeBlueprint(input.blueprint);
  const blueprint = normalized.blueprint;
  assertExportSafe(blueprint);
  const gaps = normalized.resourceGaps.map(field => gap('shell.resource.ceiling.known', 'SUBSTRATE', field + ' is UNKNOWN; UNKNOWN is not unlimited', 'Provide explicit requested and permitted limits or keep compilation on HOLD.'));

  const descriptorValues = boundedArray(input.descriptors, 'compileInput.descriptors', 128).map(normalizeDescriptor);
  const descriptorIds = descriptorValues.map(item => item.descriptorId);
  if (new Set(descriptorIds).size !== descriptorIds.length) fail('AMBIGUOUS_COMPONENT_VERSION', 'each descriptor id may expose exactly one version per compilation');
  const declaredDescriptorIds = new Set(blueprint.slots.map(slot => slot.descriptorId));
  descriptorValues.forEach(item => {
    if (!declaredDescriptorIds.has(item.descriptorId)) fail('UNDECLARED_COMPONENT', 'descriptor input is not declared by the blueprint: ' + item.descriptorId);
  });
  const descriptorMap = new Map(descriptorValues.map(item => [item.descriptorId, item]));
  const components = [];
  blueprint.slots.forEach(slot => {
    const descriptor = descriptorMap.get(slot.descriptorId);
    if (!descriptor) {
      gaps.push(gap('shell.component.descriptor.exact', 'CONTRACT', 'exact descriptor is missing for slot ' + slot.slotId, 'Supply the declared descriptor id, version, and digest.'));
      return;
    }
    if (descriptor.descriptorVersion !== slot.descriptorVersion) fail('AMBIGUOUS_COMPONENT_VERSION', 'descriptor version does not match slot ' + slot.slotId);
    const actualDigest = sha256(descriptor);
    if (actualDigest !== slot.descriptorSha256) fail('DIGEST_MISMATCH', 'descriptor digest substitution detected for slot ' + slot.slotId);
    if ((slot.kind === 'BODY') !== (descriptor.schema === SCHEMAS.bodyDescriptor)) fail('ROLE_MISMATCH', 'descriptor kind mismatch for slot ' + slot.slotId);
    if (slot.kind === 'ADAPTER' && descriptor.role !== slot.role) fail('ROLE_MISMATCH', 'adapter role mismatch for slot ' + slot.slotId);
    components.push({ slotId: slot.slotId, kind: slot.kind, role: slot.role, descriptorRef: referenceForDescriptor(descriptor), descriptor });
  });
  const permissions = new Set(blueprint.identityRoot.authority.permittedPermissions);
  components.forEach(component => component.descriptor.requestedPermissions.forEach(permission => {
    if (!permissions.has(permission)) fail('AUTHORITY_EXPANSION', 'component ' + component.descriptor.descriptorId + ' requests unauthorized permission ' + permission);
  }));
  assertResources(components, blueprint.resourceEnvelope);

  const parentInputs = boundedArray(input.parentManifests, 'compileInput.parentManifests', 8).map(verifyManifest);
  if (new Set(parentInputs.map(item => item.manifestDigest)).size !== parentInputs.length) fail('DUPLICATE_REFERENCE', 'duplicate parent manifest inputs');
  const declaredParentDigests = new Set(blueprint.lineage.parentManifestRefs.map(ref => ref.sha256));
  parentInputs.forEach(parent => {
    if (!declaredParentDigests.has(parent.manifestDigest)) fail('UNDECLARED_COMPONENT', 'parent manifest input is not declared by the blueprint');
  });
  const parents = [];
  blueprint.lineage.parentManifestRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.manifest) fail('SCHEMA_MISMATCH', 'parent manifest reference schema mismatch');
    const parent = parentInputs.find(item => item.manifestDigest === ref.sha256 && item.shellId === ref.id);
    if (!parent) gaps.push(gap('shell.lineage.parent.exact', 'EVIDENCE', 'exact parent manifest is missing for ' + ref.id, 'Supply the parent manifest whose shell id and digest match the reference.'));
    else parents.push(parent);
  });

  const continuityInputs = boundedArray(input.continuityReceipts, 'compileInput.continuityReceipts', 256).map(verifyContinuityReceipt);
  if (new Set(continuityInputs.map(receipt => receipt.receiptDigest)).size !== continuityInputs.length) fail('DUPLICATE_REFERENCE', 'duplicate continuity receipt inputs');
  const declaredContinuityDigests = new Set(blueprint.continuityReceiptRefs.map(ref => ref.sha256));
  blueprint.lineage.continuityEvidenceRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.continuityEvent || !blueprint.continuityReceiptRefs.some(item => item.id === ref.id && item.schema === ref.schema && item.sha256 === ref.sha256)) {
      fail('CONTINUITY_UNKNOWN', 'lineage continuity evidence must be an exact declared continuity receipt');
    }
  });
  continuityInputs.forEach(receipt => {
    if (!declaredContinuityDigests.has(receipt.receiptDigest)) fail('UNDECLARED_COMPONENT', 'continuity receipt input is not declared by the blueprint');
  });
  const continuityReceipts = [];
  blueprint.continuityReceiptRefs.forEach(ref => {
    if (ref.schema !== SCHEMAS.continuityEvent) fail('SCHEMA_MISMATCH', 'continuity receipt reference schema mismatch');
    const receipt = continuityInputs.find(item => item.receiptDigest === ref.sha256 && item.receiptId === ref.id);
    if (!receipt) gaps.push(gap('shell.continuity.receipt.exact', 'EVIDENCE', 'exact continuity receipt is missing for ' + ref.id, 'Supply the digest-bound receipt or keep continuity UNKNOWN/HOLD.'));
    else continuityReceipts.push(receipt);
  });
  if (blueprint.continuityReceiptRefs.length && blueprint.expectedContinuityHeadDigest === null) gaps.push(gap('shell.continuity.head.exact', 'EVIDENCE', 'expected continuity head digest is UNKNOWN', 'Declare the expected last receipt digest.'));
  let continuityState = { state: 'EMPTY', headReceiptDigest: null, acceptedReceiptDigests: [], candidateReceiptDigests: [], effectiveAcceptedReceiptDigests: [] };
  continuityState.stateDigest = sha256(continuityState);
  if (continuityReceipts.length === blueprint.continuityReceiptRefs.length && (!continuityReceipts.length || blueprint.expectedContinuityHeadDigest !== null)) continuityState = reconstructContinuity(blueprint.continuityPolicy, continuityReceipts, blueprint.expectedContinuityHeadDigest);

  const humanInputs = boundedArray(input.humanDecisionReceipts, 'compileInput.humanDecisionReceipts', 8).map(verifyHumanDecisionReceipt);
  if (new Set(humanInputs.map(receipt => receipt.receiptDigest)).size !== humanInputs.length) fail('DUPLICATE_REFERENCE', 'duplicate human decision receipt inputs');
  const declaredHumanDigest = blueprint.lineage.humanDecisionReceiptRef && blueprint.lineage.humanDecisionReceiptRef.sha256;
  humanInputs.forEach(receipt => {
    if (receipt.receiptDigest !== declaredHumanDigest) fail('UNDECLARED_COMPONENT', 'human decision receipt input is not declared by the blueprint');
  });
  let humanDecision = null;
  if (blueprint.lineage.humanDecisionReceiptRef) {
    if (blueprint.lineage.humanDecisionReceiptRef.schema !== SCHEMAS.humanDecisionReceipt) fail('SCHEMA_MISMATCH', 'human decision receipt reference schema mismatch');
    humanDecision = humanInputs.find(receipt => receipt.receiptDigest === declaredHumanDigest && receipt.decisionId === blueprint.lineage.humanDecisionReceiptRef.id) || null;
    if (!humanDecision) gaps.push(gap('shell.lineage.human-decision.exact', 'AUTHORITY', 'exact human decision receipt is missing', 'Obtain an explicit digest-bound human decision receipt through an external authenticated gate.'));
  } else if (['SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL'].includes(blueprint.lineage.eventKind)) {
    gaps.push(gap('shell.lineage.human-decision.exact', 'AUTHORITY', blueprint.lineage.eventKind + ' has no human decision receipt', 'Obtain an explicit digest-bound human decision receipt through an external authenticated gate.'));
  }

  if (gaps.length) {
    const buildGapReceipt = createBuildGapReceipt(blueprint, gaps, null, null);
    return { status: 'HOLD', manifest: null, lineageReceipt: null, buildGapReceipt };
  }

  validateLineage(blueprint, parents, components, humanDecision);
  const lineageReceipt = createLineageReceipt(blueprint);
  const lifecycleState = blueprint.lineage.eventKind === 'SUCCESSION_PROPOSAL' ? 'SUCCESSION_PROPOSED' : blueprint.lineage.eventKind === 'RETIREMENT_PROPOSAL' ? 'RETIREMENT_PROPOSED' : 'ACTIVE_PROPOSAL';
  const manifest = {
    schema: SCHEMAS.manifest,
    version: VERSION,
    status: STATUS,
    lifecycleState,
    shellId: blueprint.identityRoot.shellId,
    blueprintRef: { id: blueprint.blueprintId, schema: SCHEMAS.blueprint, sha256: sha256(blueprint) },
    identityRoot: blueprint.identityRoot,
    continuityPolicy: blueprint.continuityPolicy,
    resourceEnvelope: blueprint.resourceEnvelope,
    components,
    continuity: continuityState,
    lineageReceipt,
    portability: {
      format: 'CANONICAL_JSON',
      encoding: 'UTF-8',
      providerIndependent: true,
      valueFreeClaimed: false,
      machinePathsIncluded: false,
      secretsIncluded: false,
      privateChatsIncluded: false,
      hiddenReasoningIncluded: false,
      defaultsApplied: []
    },
    truth: {
      inert: true,
      runtimeClaimed: false,
      adapterCodeLoaded: false,
      modelExecuted: false,
      networkUsed: false,
      filesystemMutated: false,
      actuationPerformed: false,
      identityStateExpandedByAttachment: false,
      memorySilentlyAccepted: false,
      consciousnessClaimed: false,
      subjectiveContinuityClaimed: false,
      installed: false,
      promoted: false,
      canon: false
    },
    manifestDigest: null
  };
  const payload = clone(manifest);
  delete payload.manifestDigest;
  manifest.manifestDigest = sha256(payload);
  assertExportSafe(manifest);
  verifyManifest(manifest);
  const buildGapReceipt = createBuildGapReceipt(blueprint, [], manifest, lineageReceipt);
  return { status: 'COMPILED', manifest, lineageReceipt, buildGapReceipt };
}

function verifyCompilation(input, result) {
  const errors = [];
  try {
    const rebuilt = compileShell(input);
    if (canonicalJson(rebuilt) !== canonicalJson(result)) errors.push('compilation result does not exact-rebuild');
  } catch (error) {
    errors.push(error.code ? error.code + ': ' + error.message : error.message);
  }
  return { pass: errors.length === 0, errors };
}

function exportManifest(value) {
  const manifest = verifyManifest(value);
  if (manifest.identityRoot.ownership.exportPolicy !== 'PORTABLE_REDACTED') fail('EXPORT_FORBIDDEN', 'identity root export policy forbids export');
  assertExportSafe(manifest);
  return canonicalJson(manifest);
}

function importManifest(serialized) {
  if (typeof serialized !== 'string') fail('COERCION_REFUSED', 'serialized manifest must be a string');
  let parsed;
  try { parsed = JSON.parse(serialized); }
  catch (error) { fail('INVALID_JSON', 'serialized manifest is not valid JSON'); }
  const manifest = verifyManifest(parsed);
  if (canonicalJson(manifest) !== serialized) fail('NON_CANONICAL_EXPORT', 'manifest import must use canonical JSON bytes');
  return manifest;
}

module.exports = {
  VERSION,
  STATUS,
  SCHEMAS,
  ADAPTER_ROLES,
  BODY_CLASSES,
  EVENT_TYPES,
  LINEAGE_KINDS,
  HUMAN_ACCEPTANCE_SCHEMA,
  ShellFabricError,
  canonicalJson,
  sha256,
  descriptorDigest,
  blueprintDigest,
  successionProposalDigest,
  normalizeIdentityRoot,
  normalizeContinuityPolicy,
  normalizeResourceEnvelope,
  normalizeAdapterDescriptor,
  normalizeBodyDescriptor,
  normalizeDescriptor,
  normalizeBlueprint,
  createContinuityReceipt,
  verifyContinuityReceipt,
  reconstructContinuity,
  createHumanDecisionReceipt,
  verifyHumanDecisionReceipt,
  verifyLineageReceipt,
  verifyBuildGapReceipt,
  assertExportSafe,
  compileShell,
  verifyManifest,
  verifyCompilation,
  exportManifest,
  importManifest,
  clone
};
