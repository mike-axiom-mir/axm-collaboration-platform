'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const VERSION = '0.1.0';
const PROVIDER_SCHEMA = 'axm.code-capability-provider/v1';
const REQUEST_SCHEMA = 'axm.code-capability-request/v1';
const OBSERVATION_SCHEMA = 'axm.code-provider-host-observation/v1';
const PLAN_SCHEMA = 'axm.code-capability-route-plan/v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const VERSION_ID = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const PROVIDER_STATUSES = new Set(['EXPERIMENTAL', 'TEST', 'WORKING']);
const AVAILABILITY = new Set(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']);
const MUTABILITY = new Set(['read-only', 'candidate-only', 'process-observation']);

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

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported fields: ' + extras.sort().join(', '));
}

function text(value, label, maximum = 240) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function identifier(value, label) {
  const result = text(value, label, 128);
  if (!ID.test(result)) throw new Error(label + ' is not a stable identifier');
  return result;
}

function contractToken(value, label) {
  const result = text(value, label, 180);
  if (!CONTRACT_TOKEN.test(result)) throw new Error(label + ' is not a portable contract token');
  return result;
}

function version(value, label) {
  const result = text(value, label, 80);
  if (!VERSION_ID.test(result)) throw new Error(label + ' is not semantic version text');
  return result;
}

function digest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function timestamp(value, label) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' must be a valid timestamp');
  return parsed.toISOString();
}

function uniqueStrings(values, label, maximum = 64) {
  if (!Array.isArray(values) || values.length > maximum) throw new Error(label + ' must be a bounded array');
  const result = values.map((value, index) => identifier(value, label + '[' + index + ']'));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicates');
  return result.sort();
}

function uniqueContractTokens(values, label, maximum = 64) {
  if (!Array.isArray(values) || values.length > maximum) throw new Error(label + ' must be a bounded array');
  const result = values.map((value, index) => contractToken(value, label + '[' + index + ']'));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicates');
  return result.sort();
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function references(values, label, required = false) {
  if (!Array.isArray(values) || values.length > 32) throw new Error(label + ' must be a bounded array');
  if (required && !values.length) throw new Error(label + ' needs at least one reference');
  return values.map((value, index) => reference(value, label + '[' + index + ']'))
    .sort((left, right) => left.id.localeCompare(right.id) || left.sha256.localeCompare(right.sha256));
}

function normalizeNetwork(value, label) {
  exactKeys(value, ['mode', 'domains'], label);
  const mode = text(value.mode, label + '.mode', 20);
  if (!['disabled', 'allowlist'].includes(mode)) throw new Error(label + '.mode is unsupported');
  const domains = uniqueStrings(value.domains, label + '.domains', 32);
  if (mode === 'disabled' && domains.length) throw new Error(label + ' disabled mode cannot declare domains');
  if (mode === 'allowlist' && !domains.length) throw new Error(label + ' allowlist mode needs a domain');
  return { mode, domains };
}

function normalizeProvider(value) {
  exactKeys(value, [
    'schema', 'id', 'version', 'status', 'capabilities', 'accepts', 'produces',
    'permissions', 'network', 'mutability', 'executionBoundary', 'evidenceCeiling'
  ], 'provider');
  if (value.schema !== PROVIDER_SCHEMA) throw new Error('provider schema mismatch');
  const status = text(value.status, 'provider.status', 20).toUpperCase();
  if (!PROVIDER_STATUSES.has(status)) throw new Error('provider.status is unsupported');
  const mutability = text(value.mutability, 'provider.mutability', 40);
  if (!MUTABILITY.has(mutability)) throw new Error('provider.mutability is unsupported');
  const capabilities = uniqueStrings(value.capabilities, 'provider.capabilities');
  const accepts = uniqueContractTokens(value.accepts, 'provider.accepts');
  const produces = uniqueContractTokens(value.produces, 'provider.produces');
  if (!capabilities.length || !accepts.length || !produces.length) {
    throw new Error('provider needs at least one capability, accepted schema, and produced schema');
  }
  return {
    schema: PROVIDER_SCHEMA,
    id: identifier(value.id, 'provider.id'),
    version: version(value.version, 'provider.version'),
    status,
    capabilities,
    accepts,
    produces,
    permissions: uniqueStrings(value.permissions, 'provider.permissions'),
    network: normalizeNetwork(value.network, 'provider.network'),
    mutability,
    executionBoundary: identifier(value.executionBoundary, 'provider.executionBoundary'),
    evidenceCeiling: text(value.evidenceCeiling, 'provider.evidenceCeiling', 600)
  };
}

function providerDigest(value) {
  return sha256(normalizeProvider(value));
}

function normalizeRequest(value) {
  exactKeys(value, [
    'schema', 'id', 'capability', 'inputSchema', 'outputSchema',
    'preferredProviderId', 'policy'
  ], 'request');
  if (value.schema !== REQUEST_SCHEMA) throw new Error('request schema mismatch');
  exactKeys(value.policy, [
    'authority', 'allowedPermissions', 'allowedNetworkDomains', 'allowedMutability'
  ], 'request.policy');
  if (value.policy.authority !== 'PLAN_ONLY') throw new Error('request authority must remain PLAN_ONLY');
  const allowedMutability = uniqueStrings(value.policy.allowedMutability, 'request.policy.allowedMutability');
  allowedMutability.forEach((item) => {
    if (!MUTABILITY.has(item)) throw new Error('request.policy.allowedMutability is unsupported');
  });
  return {
    schema: REQUEST_SCHEMA,
    id: identifier(value.id, 'request.id'),
    capability: identifier(value.capability, 'request.capability'),
    inputSchema: contractToken(value.inputSchema, 'request.inputSchema'),
    outputSchema: contractToken(value.outputSchema, 'request.outputSchema'),
    preferredProviderId: value.preferredProviderId == null
      ? null
      : identifier(value.preferredProviderId, 'request.preferredProviderId'),
    policy: {
      authority: 'PLAN_ONLY',
      allowedPermissions: uniqueStrings(value.policy.allowedPermissions, 'request.policy.allowedPermissions'),
      allowedNetworkDomains: uniqueStrings(value.policy.allowedNetworkDomains, 'request.policy.allowedNetworkDomains', 32),
      allowedMutability
    }
  };
}

function normalizeObservation(value) {
  exactKeys(value, [
    'schema', 'provider', 'observedAt', 'availability', 'grantedPermissions',
    'allowedNetworkDomains', 'executorRef', 'verificationRefs'
  ], 'observation');
  if (value.schema !== OBSERVATION_SCHEMA) throw new Error('observation schema mismatch');
  exactKeys(value.provider, ['id', 'version', 'descriptorSha256'], 'observation.provider');
  const availability = text(value.availability, 'observation.availability', 20).toUpperCase();
  if (!AVAILABILITY.has(availability)) throw new Error('observation.availability is unsupported');
  const executorRef = value.executorRef == null ? null : reference(value.executorRef, 'observation.executorRef');
  const verificationRefs = references(value.verificationRefs, 'observation.verificationRefs', availability === 'AVAILABLE');
  if (availability === 'AVAILABLE' && !executorRef) throw new Error('AVAILABLE observation needs an executorRef');
  return {
    schema: OBSERVATION_SCHEMA,
    provider: {
      id: identifier(value.provider.id, 'observation.provider.id'),
      version: version(value.provider.version, 'observation.provider.version'),
      descriptorSha256: digest(value.provider.descriptorSha256, 'observation.provider.descriptorSha256')
    },
    observedAt: timestamp(value.observedAt, 'observation.observedAt'),
    availability,
    grantedPermissions: uniqueStrings(value.grantedPermissions, 'observation.grantedPermissions'),
    allowedNetworkDomains: uniqueStrings(value.allowedNetworkDomains, 'observation.allowedNetworkDomains', 32),
    executorRef,
    verificationRefs
  };
}

function providerRef(provider) {
  return {
    id: provider.id,
    version: provider.version,
    descriptorSha256: providerDigest(provider),
    status: provider.status,
    permissions: provider.permissions,
    network: provider.network,
    mutability: provider.mutability,
    executionBoundary: provider.executionBoundary,
    evidenceCeiling: provider.evidenceCeiling
  };
}

function missingValues(required, allowed) {
  const set = new Set(allowed);
  return required.filter((item) => !set.has(item));
}

function buildRoutePlan(input) {
  exactKeys(input, ['request', 'providers', 'hostObservations'], 'route input');
  const request = normalizeRequest(input.request);
  if (!Array.isArray(input.providers) || input.providers.length > 128) throw new Error('providers must be a bounded array');
  if (!Array.isArray(input.hostObservations) || input.hostObservations.length > 128) throw new Error('hostObservations must be a bounded array');
  const providers = input.providers.map(normalizeProvider);
  const observations = input.hostObservations.map(normalizeObservation);
  const providerIds = providers.map((item) => item.id);
  if (new Set(providerIds).size !== providerIds.length) {
    throw new Error('each route catalog must expose only one version for a provider id');
  }
  const observationKeys = observations.map((item) =>
    item.provider.id + '@' + item.provider.version + '@' + item.provider.descriptorSha256);
  if (new Set(observationKeys).size !== observationKeys.length) throw new Error('host observation binding must be unique');

  const compatible = providers.filter((provider) =>
    provider.capabilities.includes(request.capability) &&
    provider.accepts.includes(request.inputSchema) &&
    provider.produces.includes(request.outputSchema))
    .sort((left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version));
  const candidates = compatible.map(providerRef);
  let status = 'MISSING_HAND';
  let selected = null;
  let selectedProvider = null;
  let observation = null;
  const holds = [];

  if (compatible.length) {
    if (request.preferredProviderId) {
      selectedProvider = compatible.find((provider) => provider.id === request.preferredProviderId) || null;
      if (!selectedProvider) status = 'PREFERRED_PROVIDER_UNAVAILABLE';
    } else if (compatible.length > 1) {
      status = 'SELECTION_REQUIRED';
    } else {
      selectedProvider = compatible[0];
    }
  }

  if (selectedProvider) {
    selected = providerRef(selectedProvider);
    const sameIdentity = observations.filter((item) =>
      item.provider.id === selected.id && item.provider.version === selected.version);
    observation = sameIdentity.find((item) => item.provider.descriptorSha256 === selected.descriptorSha256) || null;
    if (!observation) {
      status = sameIdentity.length ? 'HOST_OBSERVATION_STALE' : 'HOST_OBSERVATION_REQUIRED';
    } else if (observation.availability !== 'AVAILABLE') {
      status = 'HOST_UNAVAILABLE';
    } else {
      const requestPermissionGap = missingValues(selected.permissions, request.policy.allowedPermissions);
      const hostPermissionGap = missingValues(selected.permissions, observation.grantedPermissions);
      const requestNetworkGap = selected.network.mode === 'allowlist'
        ? missingValues(selected.network.domains, request.policy.allowedNetworkDomains)
        : [];
      const hostNetworkGap = selected.network.mode === 'allowlist'
        ? missingValues(selected.network.domains, observation.allowedNetworkDomains)
        : [];
      if (!request.policy.allowedMutability.includes(selected.mutability)) holds.push('MUTABILITY_NOT_ALLOWED');
      if (requestPermissionGap.length) holds.push('REQUEST_PERMISSION_NOT_ALLOWED:' + requestPermissionGap.join(','));
      if (hostPermissionGap.length) holds.push('HOST_PERMISSION_NOT_GRANTED:' + hostPermissionGap.join(','));
      if (requestNetworkGap.length) holds.push('REQUEST_NETWORK_NOT_ALLOWED:' + requestNetworkGap.join(','));
      if (hostNetworkGap.length) holds.push('HOST_NETWORK_NOT_ALLOWED:' + hostNetworkGap.join(','));
      status = holds.length ? 'AUTHORITY_HOLD' : 'ROUTE_PLANNED';
    }
  }

  const planCore = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    request,
    status,
    candidates,
    selected,
    hostObservation: observation,
    holds,
    nextGate: status === 'ROUTE_PLANNED'
      ? 'EXPLICIT_EXECUTOR_AUTHORIZATION_AND_INDEPENDENT_VERIFICATION'
      : 'REPAIR_OR_EXPLICIT_SELECTION_THEN_REPLAN',
    truth: {
      planOnly: true,
      providerCodeLoaded: false,
      providerCodeExecuted: false,
      inputContentRead: false,
      outputWritten: false,
      permissionGranted: false,
      networkUsed: false,
      hostObservationIsExecutionProof: false,
      installed: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  return { ...planCore, planDigest: sha256(planCore) };
}

function verifyRoutePlan(plan, input) {
  const errors = [];
  try {
    if (!plan || plan.schema !== PLAN_SCHEMA) throw new Error('route plan schema mismatch');
    const rebuilt = buildRoutePlan(input);
    if (canonicalJson(rebuilt) !== canonicalJson(plan)) throw new Error('route plan content or digest mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  VERSION,
  PROVIDER_SCHEMA,
  REQUEST_SCHEMA,
  OBSERVATION_SCHEMA,
  PLAN_SCHEMA,
  canonicalJson,
  sha256,
  normalizeProvider,
  normalizeRequest,
  normalizeObservation,
  providerDigest,
  buildRoutePlan,
  verifyRoutePlan,
  clone
};
