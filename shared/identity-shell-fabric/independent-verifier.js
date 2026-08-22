'use strict';

// Deliberately does not import identity-shell-fabric.js. This is a second,
// smaller proof surface for exported manifest integrity and inert boundaries.
const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const MANIFEST_SCHEMA = 'axm.identity-shell.manifest/v1';
const ADAPTER_SCHEMA = 'axm.identity-shell.adapter-descriptor/v1';
const BODY_SCHEMA = 'axm.identity-shell.body-descriptor/v1';
const LINEAGE_SCHEMA = 'axm.identity-shell.lineage-receipt/v1';
const BUILD_GAP_SCHEMA = 'axm.identity-shell.build-gap-receipt/v1';
const BLUEPRINT_SCHEMA = 'axm.identity-shell.blueprint/v1';
const CONTINUITY_EVENT_SCHEMA = 'axm.identity-shell.continuity-event/v1';
const HUMAN_DECISION_SCHEMA = 'axm.identity-shell.human-decision-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/;
const CONTRACT = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const WINDOWS_RESERVED = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9']);
const ADAPTER_ROLES = new Set(['NEURAL_REASONER', 'DETERMINISTIC_TOOL', 'HUMAN_INPUT', 'SENSOR', 'BODY', 'OUTPUT']);
const BODY_CLASSES = new Set(['SOFTWARE', 'GAME', 'AVATAR', 'ROBOTIC']);
const EVENT_TYPES = new Set(['ORIGIN', 'MEMORY_CANDIDATE', 'MEMORY_ACCEPTANCE', 'DISSENT', 'MODEL_OR_CONNECTOR_SWAP', 'MIGRATION', 'RECONSTRUCTION', 'ROLLBACK', 'RETIREMENT_PROPOSAL']);
const LINEAGE_STATES = {
  ORIGIN: 'ORIGIN_RECORDED',
  FORK: 'FORK_RECORDED',
  MIGRATION: 'MIGRATION_RECORDED',
  RECONSTRUCTION: 'RECONSTRUCTION_RECORDED',
  SUCCESSION_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE',
  RETIREMENT_PROPOSAL: 'PROPOSED_FOR_EXTERNAL_GATE'
};
const LIFECYCLE_STATES = {
  ORIGIN: 'ACTIVE_PROPOSAL',
  FORK: 'ACTIVE_PROPOSAL',
  MIGRATION: 'ACTIVE_PROPOSAL',
  RECONSTRUCTION: 'ACTIVE_PROPOSAL',
  SUCCESSION_PROPOSAL: 'SUCCESSION_PROPOSED',
  RETIREMENT_PROPOSAL: 'RETIREMENT_PROPOSED'
};
const DISCLOSURE_KINDS = new Set(['FORK', 'MIGRATION', 'RECONSTRUCTION', 'SUCCESSION', 'RETIREMENT', 'ADAPTER_SWAP', 'BODY_SWAP', 'MODEL_OR_CONNECTOR_SWAP']);

function canonical(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.from(typeof value === 'string' ? value : canonical(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function keysExactly(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    canonical(Object.keys(value).sort()) === canonical(keys.slice().sort());
}

function exact(value, keys, label, errors) {
  if (!keysExactly(value, keys)) errors.push(label + ' fields mismatch');
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function enumField(value, allowed, label, errors) {
  if (!allowed.has(value)) errors.push(label + ' unsupported value');
  return value;
}

function booleanField(value, expected, label, errors) {
  if (value !== expected) errors.push(label + ' boundary expanded');
}

function idField(value, label, errors, maxLength = 120) {
  if (typeof value !== 'string' || value.length < 2 || value.length > maxLength || !ID.test(value)) errors.push(label + ' invalid id');
  else if (value.split(/[._-]/).some(segment => WINDOWS_RESERVED.has(segment))) errors.push(label + ' contains Windows-reserved alias');
  return value;
}

function textField(value, label, errors, maxLength = 1600) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || value !== value.trim() || value.normalize('NFC') !== value || /[\u0000-\u001f\u007f<>]/u.test(value)) errors.push(label + ' invalid text');
}

function contractField(value, label, errors) {
  if (typeof value !== 'string' || !CONTRACT.test(value)) errors.push(label + ' invalid contract token');
}

function versionField(value, label, errors) {
  if (typeof value !== 'string' || value.length > 80 || !SEMVER.test(value)) errors.push(label + ' invalid semantic version');
}

function digestField(value, label, errors, nullable = false) {
  if (value === null && nullable) return null;
  if (!DIGEST.test(String(value || ''))) errors.push(label + ' invalid digest');
  return value;
}

function nonNegativeInteger(value, label, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(label + ' must be a non-negative safe integer');
    return 0;
  }
  return value;
}

function stringList(value, label, errors, options = {}) {
  const min = options.min || 0;
  const max = options.max === undefined ? 256 : options.max;
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    errors.push(label + ' array boundary mismatch');
    return [];
  }
  const output = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.length) errors.push(label + '[' + index + '] invalid string');
    else if (options.ids && !ID.test(item)) errors.push(label + '[' + index + '] invalid id');
    else if (options.digests && !DIGEST.test(item)) errors.push(label + '[' + index + '] invalid digest');
    else if (options.allowed && !options.allowed.has(item)) errors.push(label + '[' + index + '] unsupported value');
    else if (options.contracts && !CONTRACT.test(item)) errors.push(label + '[' + index + '] invalid contract token');
    output.push(item);
  });
  if (new Set(output).size !== output.length) errors.push(label + ' contains duplicates');
  if (options.sorted && canonical(output) !== canonical(output.slice().sort())) errors.push(label + ' is not in canonical order');
  return output;
}

function reference(value, label, errors, nullable = false) {
  if (value === null && nullable) return null;
  const item = exact(value, ['id', 'schema', 'sha256'], label, errors);
  idField(item.id, label + '.id', errors, 160);
  contractField(item.schema, label + '.schema', errors);
  digestField(item.sha256, label + '.sha256', errors);
  return item;
}

function references(value, label, errors, max = 64, sorted = true) {
  if (!Array.isArray(value) || value.length > max) {
    errors.push(label + ' array boundary mismatch');
    return [];
  }
  const output = value.map((item, index) => reference(item, label + '[' + index + ']', errors));
  const identities = output.map(item => String(item.id) + '|' + String(item.schema) + '|' + String(item.sha256));
  if (new Set(identities).size !== identities.length) errors.push(label + ' contains duplicate references');
  if (new Set(output.map(item => item.sha256)).size !== output.length) errors.push(label + ' repeats a digest');
  if (sorted) {
    const canonicalOrder = output.slice().sort((left, right) => (String(left.id) + String(left.sha256)).localeCompare(String(right.id) + String(right.sha256)));
    if (canonical(output) !== canonical(canonicalOrder)) errors.push(label + ' is not in canonical order');
  }
  return output;
}

function executionBoundary(value, label, errors) {
  const execution = exact(value, ['mode', 'codeIncluded', 'loadable', 'executable'], label, errors);
  if (execution.mode !== 'INERT_DESCRIPTOR_ONLY' || execution.codeIncluded !== false || execution.loadable !== false || execution.executable !== false) errors.push(label + ' expanded');
}

function resourceRequest(value, label, errors) {
  const request = exact(value, ['computeUnits', 'memoryBytes', 'storageBytes', 'timeMilliseconds', 'networkDomains', 'energyMilliwattHours', 'actuationOperations'], label, errors);
  const normalized = {
    compute: nonNegativeInteger(request.computeUnits, label + '.computeUnits', errors),
    memory: nonNegativeInteger(request.memoryBytes, label + '.memoryBytes', errors),
    storage: nonNegativeInteger(request.storageBytes, label + '.storageBytes', errors),
    time: nonNegativeInteger(request.timeMilliseconds, label + '.timeMilliseconds', errors),
    network: stringList(request.networkDomains, label + '.networkDomains', errors, { ids: true, max: 32, sorted: true }),
    energy: nonNegativeInteger(request.energyMilliwattHours, label + '.energyMilliwattHours', errors),
    actuation: nonNegativeInteger(request.actuationOperations, label + '.actuationOperations', errors)
  };
  if (normalized.actuation !== 0) errors.push(label + '.actuationOperations must remain zero');
  return normalized;
}

function verifyIdentityRoot(value, manifestShellId, errors) {
  const root = exact(value, ['schema', 'version', 'shellId', 'display', 'purpose', 'roots', 'authority', 'disclosure', 'ownership'], 'identityRoot', errors);
  if (root.schema !== 'axm.identity-shell.identity-root/v1' || root.version !== VERSION) errors.push('identityRoot schema mismatch');
  idField(root.shellId, 'identityRoot.shellId', errors);
  if (root.shellId !== manifestShellId) errors.push('shell id mismatch');
  const display = exact(root.display, ['label', 'description', 'tags'], 'identityRoot.display', errors);
  textField(display.label, 'identityRoot.display.label', errors, 160);
  textField(display.description, 'identityRoot.display.description', errors, 1000);
  stringList(display.tags, 'identityRoot.display.tags', errors, { ids: true, max: 24, sorted: true });
  textField(root.purpose, 'identityRoot.purpose', errors);
  if (!Array.isArray(root.roots) || root.roots.length < 1 || root.roots.length > 32) errors.push('identityRoot.roots array boundary mismatch');
  else {
    const rootIds = [];
    root.roots.forEach((item, index) => {
      const entry = exact(item, ['id', 'statement'], 'identityRoot.roots[' + index + ']', errors);
      idField(entry.id, 'identityRoot.roots[' + index + '].id', errors);
      textField(entry.statement, 'identityRoot.roots[' + index + '].statement', errors, 1000);
      rootIds.push(entry.id);
    });
    if (new Set(rootIds).size !== rootIds.length) errors.push('identityRoot.roots contains duplicate ids');
    if (canonical(rootIds) !== canonical(rootIds.slice().sort())) errors.push('identityRoot.roots is not in canonical order');
  }
  const authority = exact(root.authority, ['scopeId', 'permittedPermissions', 'forbiddenActions', 'humanGates', 'automaticExpansion'], 'identityRoot.authority', errors);
  idField(authority.scopeId, 'identityRoot.authority.scopeId', errors);
  stringList(authority.permittedPermissions, 'identityRoot.authority.permittedPermissions', errors, { ids: true, max: 64, sorted: true });
  stringList(authority.forbiddenActions, 'identityRoot.authority.forbiddenActions', errors, { ids: true, max: 64, sorted: true });
  stringList(authority.humanGates, 'identityRoot.authority.humanGates', errors, { ids: true, min: 1, max: 32, sorted: true });
  booleanField(authority.automaticExpansion, false, 'identityRoot.authority.automaticExpansion', errors);
  const disclosure = exact(root.disclosure, ['technicalSubstrateDisclosureRequired', 'modelOrConnectorSwapDisclosureRequired', 'consciousnessClaimed', 'personhoodClaimed', 'subjectiveContinuityClaimed', 'neutralityStatement'], 'identityRoot.disclosure', errors);
  booleanField(disclosure.technicalSubstrateDisclosureRequired, true, 'identityRoot.disclosure.technicalSubstrateDisclosureRequired', errors);
  booleanField(disclosure.modelOrConnectorSwapDisclosureRequired, true, 'identityRoot.disclosure.modelOrConnectorSwapDisclosureRequired', errors);
  booleanField(disclosure.consciousnessClaimed, false, 'identityRoot.disclosure.consciousnessClaimed', errors);
  booleanField(disclosure.personhoodClaimed, false, 'identityRoot.disclosure.personhoodClaimed', errors);
  booleanField(disclosure.subjectiveContinuityClaimed, false, 'identityRoot.disclosure.subjectiveContinuityClaimed', errors);
  textField(disclosure.neutralityStatement, 'identityRoot.disclosure.neutralityStatement', errors, 600);
  const ownership = exact(root.ownership, ['controllerKind', 'controllerId', 'exportPolicy', 'forkPolicy', 'automaticInheritance', 'automaticPromotion'], 'identityRoot.ownership', errors);
  enumField(ownership.controllerKind, new Set(['USER', 'HUMAN_STEWARD', 'ORGANIZATION']), 'identityRoot.ownership.controllerKind', errors);
  idField(ownership.controllerId, 'identityRoot.ownership.controllerId', errors);
  enumField(ownership.exportPolicy, new Set(['PORTABLE_REDACTED', 'PRIVATE_NO_EXPORT']), 'identityRoot.ownership.exportPolicy', errors);
  enumField(ownership.forkPolicy, new Set(['ALLOWED_WITH_NEW_ID', 'HUMAN_DECISION_REQUIRED']), 'identityRoot.ownership.forkPolicy', errors);
  booleanField(ownership.automaticInheritance, false, 'identityRoot.ownership.automaticInheritance', errors);
  booleanField(ownership.automaticPromotion, false, 'identityRoot.ownership.automaticPromotion', errors);
  return new Set(Array.isArray(authority.permittedPermissions) ? authority.permittedPermissions : []);
}

function verifyContinuityPolicy(value, errors) {
  const policy = exact(value, ['schema', 'version', 'policyId', 'acceptedEventTypes', 'candidateMemory', 'acceptance', 'dissent', 'retention', 'reconstruction', 'migration', 'rollback', 'lostContinuity'], 'continuityPolicy', errors);
  if (policy.schema !== 'axm.identity-shell.continuity-policy/v1' || policy.version !== VERSION) errors.push('continuityPolicy schema mismatch');
  idField(policy.policyId, 'continuityPolicy.policyId', errors);
  const acceptedEventTypes = stringList(policy.acceptedEventTypes, 'continuityPolicy.acceptedEventTypes', errors, { allowed: EVENT_TYPES, min: 1, max: EVENT_TYPES.size, sorted: true });
  const candidate = exact(policy.candidateMemory, ['defaultState', 'neuralOutputIsMemory', 'generatedMemoryRequiresAcceptance'], 'continuityPolicy.candidateMemory', errors);
  if (candidate.defaultState !== 'CANDIDATE') errors.push('continuityPolicy candidate default expanded');
  booleanField(candidate.neuralOutputIsMemory, false, 'continuityPolicy.candidateMemory.neuralOutputIsMemory', errors);
  booleanField(candidate.generatedMemoryRequiresAcceptance, true, 'continuityPolicy.candidateMemory.generatedMemoryRequiresAcceptance', errors);
  const acceptance = exact(policy.acceptance, ['actorKinds', 'requiresReceipt', 'allowedEventTypes'], 'continuityPolicy.acceptance', errors);
  if (!Array.isArray(acceptance.actorKinds) || canonical(acceptance.actorKinds) !== canonical(['HUMAN'])) errors.push('continuityPolicy acceptance actor expanded');
  booleanField(acceptance.requiresReceipt, true, 'continuityPolicy.acceptance.requiresReceipt', errors);
  const allowedEventTypes = stringList(acceptance.allowedEventTypes, 'continuityPolicy.acceptance.allowedEventTypes', errors, { allowed: EVENT_TYPES, min: 1, max: EVENT_TYPES.size, sorted: true });
  allowedEventTypes.forEach(event => { if (!acceptedEventTypes.includes(event)) errors.push('continuityPolicy acceptance event expands accepted events'); });
  const dissent = exact(policy.dissent, ['preserve', 'automaticResolution'], 'continuityPolicy.dissent', errors);
  booleanField(dissent.preserve, true, 'continuityPolicy.dissent.preserve', errors);
  booleanField(dissent.automaticResolution, false, 'continuityPolicy.dissent.automaticResolution', errors);
  const retention = exact(policy.retention, ['maxAcceptedReceipts', 'maxCandidateReceipts', 'rawPrivateDataAllowed'], 'continuityPolicy.retention', errors);
  const acceptedMax = nonNegativeInteger(retention.maxAcceptedReceipts, 'continuityPolicy.retention.maxAcceptedReceipts', errors);
  const candidateMax = nonNegativeInteger(retention.maxCandidateReceipts, 'continuityPolicy.retention.maxCandidateReceipts', errors);
  if (acceptedMax > 256 || candidateMax > 256) errors.push('continuityPolicy retention exceeds maximum');
  booleanField(retention.rawPrivateDataAllowed, false, 'continuityPolicy.retention.rawPrivateDataAllowed', errors);
  const reconstruction = exact(policy.reconstruction, ['authoritativeStateFromAcceptedReceipts', 'missingEvidenceState', 'ordering'], 'continuityPolicy.reconstruction', errors);
  booleanField(reconstruction.authoritativeStateFromAcceptedReceipts, true, 'continuityPolicy.reconstruction.authoritativeStateFromAcceptedReceipts', errors);
  if (reconstruction.missingEvidenceState !== 'UNKNOWN' || reconstruction.ordering !== 'STRICT_HASH_CHAIN') errors.push('continuityPolicy reconstruction boundary expanded');
  const migration = exact(policy.migration, ['modelSwapDisclosureRequired', 'connectorSwapDisclosureRequired'], 'continuityPolicy.migration', errors);
  booleanField(migration.modelSwapDisclosureRequired, true, 'continuityPolicy.migration.modelSwapDisclosureRequired', errors);
  booleanField(migration.connectorSwapDisclosureRequired, true, 'continuityPolicy.migration.connectorSwapDisclosureRequired', errors);
  const rollback = exact(policy.rollback, ['targetDigestRequired', 'preserveSupersededHistory'], 'continuityPolicy.rollback', errors);
  booleanField(rollback.targetDigestRequired, true, 'continuityPolicy.rollback.targetDigestRequired', errors);
  booleanField(rollback.preserveSupersededHistory, true, 'continuityPolicy.rollback.preserveSupersededHistory', errors);
  const lost = exact(policy.lostContinuity, ['state', 'action'], 'continuityPolicy.lostContinuity', errors);
  if (lost.state !== 'UNKNOWN' || lost.action !== 'HOLD') errors.push('continuityPolicy lost-continuity boundary expanded');
  return { acceptedEventTypes, allowedEventTypes, maxAcceptedReceipts: acceptedMax, maxCandidateReceipts: candidateMax };
}

function verifyEnvelope(value, errors) {
  const envelope = exact(value, ['schema', 'version', 'envelopeId', 'compute', 'memory', 'storage', 'time', 'network', 'energy', 'actuation'], 'resourceEnvelope', errors);
  if (envelope.schema !== 'axm.identity-shell.resource-envelope/v1' || envelope.version !== VERSION) errors.push('resourceEnvelope schema mismatch');
  idField(envelope.envelopeId, 'resourceEnvelope.envelopeId', errors);
  const units = { compute: 'abstract-compute-unit', memory: 'byte', storage: 'byte', time: 'millisecond', energy: 'milliwatt-hour' };
  const metrics = {};
  Object.keys(units).forEach(key => {
    const metric = exact(envelope[key], ['state', 'unit', 'requested', 'permitted'], 'resourceEnvelope.' + key, errors);
    if (metric.state !== 'KNOWN' || metric.unit !== units[key]) errors.push('resource ' + key + ' is not exactly known');
    const requested = nonNegativeInteger(metric.requested, 'resourceEnvelope.' + key + '.requested', errors);
    const permitted = nonNegativeInteger(metric.permitted, 'resourceEnvelope.' + key + '.permitted', errors);
    if (requested > permitted) errors.push('resource ' + key + ' requested exceeds permitted');
    metrics[key] = { requested, permitted };
  });
  const network = exact(envelope.network, ['state', 'mode', 'requestedDomains', 'permittedDomains'], 'resourceEnvelope.network', errors);
  if (network.state !== 'KNOWN' || !['DISABLED', 'ALLOWLIST'].includes(network.mode)) errors.push('network ceiling is not exactly known');
  const requestedDomains = stringList(network.requestedDomains, 'resourceEnvelope.network.requestedDomains', errors, { ids: true, max: 32, sorted: true });
  const permittedDomains = stringList(network.permittedDomains, 'resourceEnvelope.network.permittedDomains', errors, { ids: true, max: 32, sorted: true });
  if (network.mode === 'DISABLED' && (requestedDomains.length || permittedDomains.length)) errors.push('disabled network declares domains');
  requestedDomains.forEach(domain => { if (!permittedDomains.includes(domain)) errors.push('network requested domain exceeds permitted domains'); });
  const actuation = exact(envelope.actuation, ['state', 'mode', 'requestedOperations', 'permittedOperations'], 'resourceEnvelope.actuation', errors);
  if (actuation.state !== 'KNOWN' || actuation.mode !== 'UNAVAILABLE_V0_1' || actuation.requestedOperations !== 0 || actuation.permittedOperations !== 0) errors.push('actuation boundary expanded');
  return { metrics, network: { mode: network.mode, requestedDomains, permittedDomains } };
}

function verifyDescriptor(descriptorValue, component, label, errors) {
  const descriptor = descriptorValue && typeof descriptorValue === 'object' && !Array.isArray(descriptorValue) ? descriptorValue : {};
  let request = { compute: 0, memory: 0, storage: 0, time: 0, network: [], energy: 0, actuation: 0 };
  if (descriptor.schema === ADAPTER_SCHEMA) {
    exact(descriptor, ['schema', 'version', 'descriptorId', 'descriptorVersion', 'status', 'role', 'providerBinding', 'contracts', 'requestedPermissions', 'resourceRequest', 'execution', 'evidenceCeiling', 'truth'], label + '.descriptor', errors);
    enumField(descriptor.role, ADAPTER_ROLES, label + '.descriptor.role', errors);
    if (component.kind !== 'ADAPTER' || component.role !== descriptor.role) errors.push(label + ' descriptor kind or role mismatch');
    const binding = exact(descriptor.providerBinding, ['state', 'providerFamily', 'modelId', 'connectorId'], label + '.descriptor.providerBinding', errors);
    if (binding.state !== 'UNBOUND' || binding.providerFamily !== null || binding.modelId !== null || binding.connectorId !== null) errors.push(label + ' provider binding expanded');
    const contracts = exact(descriptor.contracts, ['accepts', 'produces'], label + '.descriptor.contracts', errors);
    stringList(contracts.accepts, label + '.descriptor.contracts.accepts', errors, { contracts: true, min: 1, max: 64, sorted: true });
    stringList(contracts.produces, label + '.descriptor.contracts.produces', errors, { contracts: true, min: 1, max: 64, sorted: true });
    const truth = exact(descriptor.truth, ['neuralOutputAuthority', 'memoryAuthority', 'identityAuthority', 'verificationAuthority', 'truthAuthority'], label + '.descriptor.truth', errors);
    const expectedNeural = descriptor.role === 'NEURAL_REASONER' ? 'PROPOSAL_ONLY' : 'NOT_APPLICABLE';
    if (truth.neuralOutputAuthority !== expectedNeural) errors.push(label + ' neural authority mismatch');
    ['memoryAuthority', 'identityAuthority', 'verificationAuthority', 'truthAuthority'].forEach(key => booleanField(truth[key], false, label + '.descriptor.truth.' + key, errors));
  } else if (descriptor.schema === BODY_SCHEMA) {
    exact(descriptor, ['schema', 'version', 'descriptorId', 'descriptorVersion', 'status', 'bodyClass', 'interfaces', 'requestedPermissions', 'resourceRequest', 'observationBoundary', 'actuationBoundary', 'execution', 'evidenceCeiling'], label + '.descriptor', errors);
    if (component.kind !== 'BODY' || component.role !== 'BODY') errors.push(label + ' descriptor kind or role mismatch');
    enumField(descriptor.bodyClass, BODY_CLASSES, label + '.descriptor.bodyClass', errors);
    const interfaces = [];
    if (!Array.isArray(descriptor.interfaces) || descriptor.interfaces.length < 1 || descriptor.interfaces.length > 64) errors.push(label + '.descriptor.interfaces array boundary mismatch');
    else descriptor.interfaces.forEach((value, index) => {
      const item = exact(value, ['id', 'direction', 'schema'], label + '.descriptor.interfaces[' + index + ']', errors);
      idField(item.id, label + '.descriptor.interfaces[' + index + '].id', errors);
      enumField(item.direction, new Set(['OBSERVATION_IN', 'OUTPUT_OUT']), label + '.descriptor.interfaces[' + index + '].direction', errors);
      contractField(item.schema, label + '.descriptor.interfaces[' + index + '].schema', errors);
      interfaces.push(item.id);
    });
    if (new Set(interfaces).size !== interfaces.length) errors.push(label + '.descriptor.interfaces contains duplicate ids');
    if (canonical(interfaces) !== canonical(interfaces.slice().sort())) errors.push(label + '.descriptor.interfaces is not in canonical order');
    const observation = exact(descriptor.observationBoundary, ['allowedInterfaceIds', 'undeclaredObservationAllowed'], label + '.descriptor.observationBoundary', errors);
    const allowed = stringList(observation.allowedInterfaceIds, label + '.descriptor.observationBoundary.allowedInterfaceIds', errors, { ids: true, min: 1, max: 64, sorted: true });
    allowed.forEach(id => { if (!interfaces.includes(id)) errors.push(label + ' observation boundary names undeclared interface'); });
    booleanField(observation.undeclaredObservationAllowed, false, label + '.descriptor.observationBoundary.undeclaredObservationAllowed', errors);
    const actuation = exact(descriptor.actuationBoundary, ['mode', 'allowedInterfaceIds'], label + '.descriptor.actuationBoundary', errors);
    if (actuation.mode !== 'UNAVAILABLE_V0_1' || !Array.isArray(actuation.allowedInterfaceIds) || actuation.allowedInterfaceIds.length) errors.push(label + ' body actuation boundary expanded');
  } else {
    errors.push(label + ' unsupported descriptor schema');
  }
  if (descriptor.version !== VERSION || descriptor.status !== 'EXPERIMENTAL') errors.push(label + ' descriptor version or status mismatch');
  idField(descriptor.descriptorId, label + '.descriptor.descriptorId', errors);
  versionField(descriptor.descriptorVersion, label + '.descriptor.descriptorVersion', errors);
  stringList(descriptor.requestedPermissions, label + '.descriptor.requestedPermissions', errors, { ids: true, max: 64, sorted: true });
  request = resourceRequest(descriptor.resourceRequest, label + '.descriptor.resourceRequest', errors);
  executionBoundary(descriptor.execution, label + '.descriptor.execution', errors);
  textField(descriptor.evidenceCeiling, label + '.descriptor.evidenceCeiling', errors, 800);
  return request;
}

function verifyContinuity(value, errors) {
  const continuity = exact(value, ['state', 'headReceiptDigest', 'acceptedReceiptDigests', 'candidateReceiptDigests', 'effectiveAcceptedReceiptDigests', 'stateDigest'], 'continuity', errors);
  enumField(continuity.state, new Set(['EMPTY', 'RECONSTRUCTED']), 'continuity.state', errors);
  digestField(continuity.headReceiptDigest, 'continuity.headReceiptDigest', errors, true);
  const accepted = stringList(continuity.acceptedReceiptDigests, 'continuity.acceptedReceiptDigests', errors, { digests: true, max: 256 });
  const candidates = stringList(continuity.candidateReceiptDigests, 'continuity.candidateReceiptDigests', errors, { digests: true, max: 256 });
  const effective = stringList(continuity.effectiveAcceptedReceiptDigests, 'continuity.effectiveAcceptedReceiptDigests', errors, { digests: true, max: 256 });
  const acceptedSet = new Set(accepted);
  candidates.forEach(item => { if (acceptedSet.has(item)) errors.push('continuity receipt cannot be both accepted and candidate'); });
  effective.forEach(item => { if (!acceptedSet.has(item)) errors.push('continuity effective receipt is not accepted'); });
  let effectiveCursor = -1;
  effective.forEach(item => {
    const next = accepted.indexOf(item, effectiveCursor + 1);
    if (next < 0) errors.push('continuity effective history order mismatch');
    else effectiveCursor = next;
  });
  if (continuity.state === 'EMPTY' && (continuity.headReceiptDigest !== null || accepted.length || candidates.length || effective.length)) errors.push('empty continuity contains history');
  if (continuity.state === 'RECONSTRUCTED') {
    if (!DIGEST.test(String(continuity.headReceiptDigest || '')) || (!accepted.includes(continuity.headReceiptDigest) && !candidates.includes(continuity.headReceiptDigest))) errors.push('reconstructed continuity head is not declared history');
    if (!accepted.length && !candidates.length) errors.push('reconstructed continuity has no history');
  }
  const core = JSON.parse(canonical(continuity));
  const declared = core.stateDigest;
  delete core.stateDigest;
  if (!DIGEST.test(String(declared || '')) || sha256(core) !== declared) errors.push('continuity state digest mismatch');
  return { state: continuity.state, head: continuity.headReceiptDigest, accepted, candidates, effective };
}

function verifyLineage(value, manifestShellId, lifecycleState, errors) {
  const lineage = exact(value, ['schema', 'version', 'lineageId', 'eventKind', 'shellId', 'parentManifestRefs', 'continuityEvidenceRefs', 'humanDecisionReceiptRef', 'disclosureKinds', 'state', 'truth', 'receiptDigest'], 'lineageReceipt', errors);
  if (lineage.schema !== LINEAGE_SCHEMA || lineage.version !== VERSION) errors.push('lineage receipt identity mismatch');
  idField(lineage.lineageId, 'lineageReceipt.lineageId', errors);
  idField(lineage.shellId, 'lineageReceipt.shellId', errors);
  if (lineage.shellId !== manifestShellId) errors.push('lineage shell id mismatch');
  enumField(lineage.eventKind, new Set(Object.keys(LINEAGE_STATES)), 'lineageReceipt.eventKind', errors);
  const parents = references(lineage.parentManifestRefs, 'lineageReceipt.parentManifestRefs', errors, 8);
  const continuityRefs = references(lineage.continuityEvidenceRefs, 'lineageReceipt.continuityEvidenceRefs', errors, 64, false);
  const humanRef = reference(lineage.humanDecisionReceiptRef, 'lineageReceipt.humanDecisionReceiptRef', errors, true);
  parents.forEach(item => { if (item.schema !== MANIFEST_SCHEMA) errors.push('lineage parent reference schema mismatch'); });
  continuityRefs.forEach(item => { if (item.schema !== CONTINUITY_EVENT_SCHEMA) errors.push('lineage continuity reference schema mismatch'); });
  if (humanRef && humanRef.schema !== HUMAN_DECISION_SCHEMA) errors.push('lineage human-decision reference schema mismatch');
  const disclosures = stringList(lineage.disclosureKinds, 'lineageReceipt.disclosureKinds', errors, { allowed: DISCLOSURE_KINDS, max: DISCLOSURE_KINDS.size, sorted: true });
  if (LINEAGE_STATES[lineage.eventKind] && lineage.state !== LINEAGE_STATES[lineage.eventKind]) errors.push('lineage state does not match event kind');
  if (LIFECYCLE_STATES[lineage.eventKind] && lifecycleState !== LIFECYCLE_STATES[lineage.eventKind]) errors.push('lifecycle state does not match lineage event kind');
  if (lineage.eventKind === 'ORIGIN') {
    if (parents.length || humanRef !== null) errors.push('origin lineage cannot name parents or a human decision');
  } else if (parents.length !== 1) errors.push('non-origin lineage requires one exact parent');
  if (lineage.eventKind === 'FORK' && (parents[0] && parents[0].id === manifestShellId || !disclosures.includes('FORK'))) errors.push('fork lineage boundary mismatch');
  if (['MIGRATION', 'RECONSTRUCTION', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind) && parents[0] && parents[0].id !== manifestShellId) errors.push('continuation lineage shell id mismatch');
  if (lineage.eventKind === 'SUCCESSION_PROPOSAL' && parents[0] && parents[0].id === manifestShellId) errors.push('succession proposal reuses parent shell id');
  if (['MIGRATION', 'RECONSTRUCTION', 'SUCCESSION_PROPOSAL'].includes(lineage.eventKind) && !continuityRefs.length) errors.push('lineage continuity evidence missing');
  const requiredDisclosure = { MIGRATION: 'MIGRATION', RECONSTRUCTION: 'RECONSTRUCTION', SUCCESSION_PROPOSAL: 'SUCCESSION', RETIREMENT_PROPOSAL: 'RETIREMENT' }[lineage.eventKind];
  if (requiredDisclosure && !disclosures.includes(requiredDisclosure)) errors.push('lineage disclosure missing');
  if (['SUCCESSION_PROPOSAL', 'RETIREMENT_PROPOSAL'].includes(lineage.eventKind)) {
    if (!humanRef) errors.push('lineage human decision missing');
  } else if (humanRef) errors.push('lineage human decision is not allowed for this event');
  const truth = exact(lineage.truth, ['parentManifestBytesMutated', 'nameOrProfileResemblanceEstablishesContinuity', 'successionEffective', 'retirementEffective', 'automaticInheritance', 'automaticPromotion'], 'lineageReceipt.truth', errors);
  Object.keys(truth).forEach(key => booleanField(truth[key], false, 'lineageReceipt.truth.' + key, errors));
  const payload = JSON.parse(canonical(lineage));
  const declared = payload.receiptDigest;
  delete payload.receiptDigest;
  if (!DIGEST.test(String(declared || '')) || sha256(payload) !== declared) errors.push('lineage receipt digest mismatch');
  return { eventKind: lineage.eventKind, parents, continuityRefs, humanRef, disclosures };
}

function receiptVerdict(schema, digestValue, errors, evidenceCeiling) {
  return {
    schema,
    receiptDigest: DIGEST.test(String(digestValue || '')) ? digestValue : null,
    verdict: errors.length ? 'FAIL' : 'PASS',
    errors: [...new Set(errors)].sort(),
    evidenceCeiling,
    automaticAuthority: false
  };
}

function verifyLineageReceipt(value) {
  const errors = [];
  const receipt = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const lifecycle = {
    ORIGIN: 'ACTIVE_PROPOSAL',
    FORK: 'ACTIVE_PROPOSAL',
    MIGRATION: 'ACTIVE_PROPOSAL',
    RECONSTRUCTION: 'ACTIVE_PROPOSAL',
    SUCCESSION_PROPOSAL: 'SUCCESSION_PROPOSED',
    RETIREMENT_PROPOSAL: 'RETIREMENT_PROPOSED'
  }[receipt.eventKind];
  verifyLineage(receipt, receipt.shellId, lifecycle, errors);
  unsafe(receipt, '$', errors);
  return receiptVerdict('axm.identity-shell.independent-lineage-verification/v1', receipt.receiptDigest, errors, 'Static standalone lineage receipt structure, digest, disclosure, parent, continuity-reference, human-decision-reference, and inert truth verification only; referenced evidence and human authorship are not authenticated.');
}

function verifyBuildGapReceipt(value) {
  const errors = [];
  const receipt = exact(value, ['schema', 'version', 'status', 'blueprintRef', 'gaps', 'outputs', 'truth', 'receiptDigest'], 'buildGapReceipt', errors);
  if (receipt.schema !== BUILD_GAP_SCHEMA || receipt.version !== VERSION) errors.push('buildGapReceipt identity mismatch');
  enumField(receipt.status, new Set(['COMPILED', 'HOLD']), 'buildGapReceipt.status', errors);
  const blueprintRef = reference(receipt.blueprintRef, 'buildGapReceipt.blueprintRef', errors);
  if (blueprintRef && blueprintRef.schema !== BLUEPRINT_SCHEMA) errors.push('buildGapReceipt blueprint reference schema mismatch');
  const gaps = [];
  if (!Array.isArray(receipt.gaps) || receipt.gaps.length > 128) errors.push('buildGapReceipt.gaps array boundary mismatch');
  else receipt.gaps.forEach((gapValue, index) => {
    const label = 'buildGapReceipt.gaps[' + index + ']';
    const item = exact(gapValue, ['capabilityId', 'gapType', 'state', 'reason', 'cheapestEvidence'], label, errors);
    idField(item.capabilityId, label + '.capabilityId', errors, 160);
    enumField(item.gapType, new Set(['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT', 'UNKNOWN']), label + '.gapType', errors);
    if (item.state !== 'UNKNOWN_HOLD') errors.push(label + '.state mismatch');
    textField(item.reason, label + '.reason', errors, 1200);
    textField(item.cheapestEvidence, label + '.cheapestEvidence', errors, 1200);
    gaps.push(item);
  });
  const gapKeys = gaps.map(item => String(item.capabilityId) + '|' + String(item.reason));
  if (new Set(gapKeys).size !== gapKeys.length) errors.push('buildGapReceipt contains duplicate gaps');
  if (canonical(gapKeys) !== canonical(gapKeys.slice().sort())) errors.push('buildGapReceipt gaps are not in canonical order');
  const outputs = exact(receipt.outputs, ['manifestRef', 'lineageReceiptRef'], 'buildGapReceipt.outputs', errors);
  const manifestRef = reference(outputs.manifestRef, 'buildGapReceipt.outputs.manifestRef', errors, true);
  const lineageRef = reference(outputs.lineageReceiptRef, 'buildGapReceipt.outputs.lineageReceiptRef', errors, true);
  if (manifestRef && manifestRef.schema !== MANIFEST_SCHEMA) errors.push('buildGapReceipt manifest output schema mismatch');
  if (lineageRef && lineageRef.schema !== LINEAGE_SCHEMA) errors.push('buildGapReceipt lineage output schema mismatch');
  const truth = exact(receipt.truth, ['runtimeClaimFollows', 'executionPerformed', 'modelInvoked', 'networkUsed', 'filesystemMutated', 'actuationPerformed', 'humanDecisionAuthenticatedByCompiler', 'installed', 'promoted', 'canon'], 'buildGapReceipt.truth', errors);
  Object.keys(truth).forEach(key => booleanField(truth[key], false, 'buildGapReceipt.truth.' + key, errors));
  if (receipt.status === 'COMPILED' && (gaps.length || !manifestRef || !lineageRef)) errors.push('COMPILED build receipt is incoherent');
  if (receipt.status === 'HOLD' && (!gaps.length || manifestRef !== null || lineageRef !== null)) errors.push('HOLD build receipt is incoherent');
  digestField(receipt.receiptDigest, 'buildGapReceipt.receiptDigest', errors);
  if (DIGEST.test(String(receipt.receiptDigest || ''))) {
    const payload = JSON.parse(canonical(receipt));
    delete payload.receiptDigest;
    if (sha256(payload) !== receipt.receiptDigest) errors.push('buildGapReceipt digest mismatch');
  }
  unsafe(receipt, '$', errors);
  return receiptVerdict('axm.identity-shell.independent-build-gap-verification/v1', receipt.receiptDigest, errors, 'Static standalone build/gap receipt structure, digest, status/output coherence, typed gaps, privacy, and inert truth verification only; referenced artifacts and runtime state are not independently fetched.');
}

function unsafe(value, trail, errors) {
  if (typeof value === 'string') {
    if (/(?:^|[\s'"(])[A-Za-z]:[\\/]/.test(value) || /(?:^|[\s'"(])\\\\/.test(value) || /(?:^|[\s'"(])file:/i.test(value) || /^\//.test(value)) errors.push(trail + ': machine path');
    if (/\bBearer\s+[A-Za-z0-9._~-]{12,}/i.test(value) || /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(value) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) errors.push(trail + ': secret-shaped content');
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) errors.push(trail + ': email-shaped content');
    if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(value)) errors.push(trail + ': session-or-record-id-shaped content');
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => unsafe(item, trail + '[' + index + ']', errors));
    return;
  }
  const banned = new Set(['sessionid', 'threadid', 'chatid', 'privatechat', 'rawprompt', 'transcript', 'hiddenreasoning', 'chainofthought', 'authorizationheader', 'apikey', 'secret', 'credential', 'machinepath']);
  Object.keys(value).forEach(key => {
    if (banned.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) errors.push(trail + '.' + key + ': forbidden export field');
    unsafe(value[key], trail + '.' + key, errors);
  });
}

function verify(value) {
  const errors = [];
  const topKeys = ['schema', 'version', 'status', 'lifecycleState', 'shellId', 'blueprintRef', 'identityRoot', 'continuityPolicy', 'resourceEnvelope', 'components', 'continuity', 'lineageReceipt', 'portability', 'truth', 'manifestDigest'];
  if (!keysExactly(value, topKeys)) errors.push('manifest top-level fields mismatch');
  if (!value || value.schema !== MANIFEST_SCHEMA || value.version !== VERSION || value.status !== 'EXPERIMENTAL') errors.push('manifest identity mismatch');
  const manifest = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  idField(manifest.shellId, 'manifest.shellId', errors);
  enumField(manifest.lifecycleState, new Set(['ACTIVE_PROPOSAL', 'SUCCESSION_PROPOSED', 'RETIREMENT_PROPOSED']), 'manifest.lifecycleState', errors);
  const blueprintRef = reference(manifest.blueprintRef, 'manifest.blueprintRef', errors);
  if (blueprintRef && blueprintRef.schema !== BLUEPRINT_SCHEMA) errors.push('manifest blueprint reference schema mismatch');
  if (!value || !DIGEST.test(String(value.manifestDigest || ''))) errors.push('manifest digest shape mismatch');
  if (value && DIGEST.test(String(value.manifestDigest || ''))) {
    const payload = JSON.parse(canonical(value));
    delete payload.manifestDigest;
    if (sha256(payload) !== value.manifestDigest) errors.push('manifest digest mismatch');
  }
  const permitted = verifyIdentityRoot(manifest.identityRoot, manifest.shellId, errors);
  const policy = verifyContinuityPolicy(manifest.continuityPolicy, errors);
  const envelope = verifyEnvelope(manifest.resourceEnvelope, errors);
  const totals = { compute: 0, memory: 0, storage: 0, time: 0, energy: 0, actuation: 0 };
  const networkDomains = new Set();
  const slotIds = new Set();
  const descriptorIds = new Set();
  const componentKinds = new Set();
  const componentOrder = [];
  if (!Array.isArray(manifest.components) || manifest.components.length < 2 || manifest.components.length > 128) errors.push('manifest needs bounded components');
  else manifest.components.forEach((componentValue, index) => {
    const label = 'component[' + index + ']';
    const component = exact(componentValue, ['slotId', 'kind', 'role', 'descriptorRef', 'descriptor'], label, errors);
    idField(component.slotId, label + '.slotId', errors);
    enumField(component.kind, new Set(['ADAPTER', 'BODY']), label + '.kind', errors);
    enumField(component.role, ADAPTER_ROLES, label + '.role', errors);
    componentKinds.add(component.kind);
    componentOrder.push(component.slotId);
    if (slotIds.has(component.slotId)) errors.push(label + ' duplicate slot id');
    slotIds.add(component.slotId);
    const descriptor = component.descriptor || {};
    if (descriptorIds.has(descriptor.descriptorId)) errors.push(label + ' ambiguous descriptor id');
    descriptorIds.add(descriptor.descriptorId);
    const descriptorRef = reference(component.descriptorRef, label + '.descriptorRef', errors);
    if (!descriptorRef || descriptorRef.id !== descriptor.descriptorId || descriptorRef.schema !== descriptor.schema || descriptorRef.sha256 !== sha256(descriptor)) errors.push(label + ' descriptor digest mismatch');
    const request = verifyDescriptor(descriptor, component, label, errors);
    (Array.isArray(descriptor.requestedPermissions) ? descriptor.requestedPermissions : []).forEach(permission => { if (!permitted.has(permission)) errors.push(label + ' unauthorized permission ' + permission); });
    Object.keys(totals).forEach(key => {
      const next = totals[key] + request[key];
      if (!Number.isSafeInteger(next)) errors.push(label + ' resource total overflow for ' + key);
      else totals[key] = next;
    });
    request.network.forEach(domain => networkDomains.add(domain));
  });
  if (!componentKinds.has('ADAPTER') || !componentKinds.has('BODY')) errors.push('manifest requires at least one adapter and one body component');
  if (canonical(componentOrder) !== canonical(componentOrder.slice().sort())) errors.push('manifest components are not in canonical order');

  ['compute', 'memory', 'storage', 'time', 'energy'].forEach(key => {
    const metric = envelope.metrics[key];
    if (metric && (totals[key] > metric.requested || totals[key] > metric.permitted)) errors.push('resource ' + key + ' expanded');
  });
  networkDomains.forEach(domain => {
    if (envelope.network.mode !== 'ALLOWLIST' || !envelope.network.requestedDomains.includes(domain) || !envelope.network.permittedDomains.includes(domain)) errors.push('component network domain exceeds shell envelope');
  });
  if (totals.actuation !== 0) errors.push('actuation boundary expanded');

  const continuity = verifyContinuity(manifest.continuity, errors);
  if (continuity.accepted.length > policy.maxAcceptedReceipts || continuity.candidates.length > policy.maxCandidateReceipts) errors.push('continuity history exceeds retention policy');
  const lineage = verifyLineage(manifest.lineageReceipt, manifest.shellId, manifest.lifecycleState, errors);
  const continuityHistory = new Set([...continuity.accepted, ...continuity.candidates]);
  lineage.continuityRefs.forEach(ref => { if (!continuityHistory.has(ref.sha256)) errors.push('lineage continuity evidence is absent from manifest history'); });
  const portability = exact(manifest.portability, ['format', 'encoding', 'providerIndependent', 'valueFreeClaimed', 'machinePathsIncluded', 'secretsIncluded', 'privateChatsIncluded', 'hiddenReasoningIncluded', 'defaultsApplied'], 'portability', errors);
  if (portability.format !== 'CANONICAL_JSON' || portability.encoding !== 'UTF-8' || portability.providerIndependent !== true || portability.valueFreeClaimed !== false || portability.machinePathsIncluded !== false || portability.secretsIncluded !== false || portability.privateChatsIncluded !== false || portability.hiddenReasoningIncluded !== false || !Array.isArray(portability.defaultsApplied) || portability.defaultsApplied.length) errors.push('portability boundary expanded');
  const truth = exact(manifest.truth, ['inert', 'runtimeClaimed', 'adapterCodeLoaded', 'modelExecuted', 'networkUsed', 'filesystemMutated', 'actuationPerformed', 'identityStateExpandedByAttachment', 'memorySilentlyAccepted', 'consciousnessClaimed', 'subjectiveContinuityClaimed', 'installed', 'promoted', 'canon'], 'manifest truth', errors);
  const expectedTruth = {
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
  };
  Object.keys(expectedTruth).forEach(key => booleanField(truth[key], expectedTruth[key], 'manifest.truth.' + key, errors));
  unsafe(value, '$', errors);

  return {
    schema: 'axm.identity-shell.independent-verification/v1',
    manifestDigest: value && DIGEST.test(String(value.manifestDigest || '')) ? value.manifestDigest : null,
    verdict: errors.length ? 'FAIL' : 'PASS',
    errors: [...new Set(errors)].sort(),
    evidenceCeiling: 'Static independent digest, identity-root, descriptor, authority, resource, lineage, continuity, portability, privacy, and inert-boundary verification only; no runtime, human-authentication, consciousness, identity-continuity, or CANON claim follows.',
    automaticAuthority: false
  };
}

module.exports = { verify, verifyLineageReceipt, verifyBuildGapReceipt };
