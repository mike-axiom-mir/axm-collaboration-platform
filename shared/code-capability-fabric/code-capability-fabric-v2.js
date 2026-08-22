'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const VERSION = '0.2.0';
const PROVIDER_SCHEMA = 'axm.code-capability-provider/v2';
const REQUEST_SCHEMA = 'axm.code-capability-request/v2';
const OBSERVATION_SCHEMA = 'axm.code-provider-host-observation/v2';
const PLAN_SCHEMA = 'axm.code-capability-route-plan/v2';
const BOUNDARY_SCHEMA = 'axm.code-workspace-boundary-declaration/v1';
const RESOURCE_ENFORCEMENT_SCHEMA = 'axm.resource-enforcement-verification/v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTRACT_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,179}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PORTABLE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,127}$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\..*)?$/i;
const PROVIDER_STATUSES = new Set(['EXPERIMENTAL', 'TEST', 'WORKING']);
const AVAILABILITY = new Set(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN']);
const MUTABILITY = new Set(['read-only', 'candidate-only', 'process-observation']);
const SOURCE_USE = new Set(['inspect-only', 'derive-concepts', 'transform-bytes', 'copy-bytes']);
const DIRECT_REUSE = new Set(['transform-bytes', 'copy-bytes']);
const REUSE_MODES = new Set(['RESEARCH_ONLY', 'DECLARED_REUSE_ALLOWED']);
const STATUSES = new Set([
  'MISSING_HAND',
  'SELECTED_PROVIDER_UNAVAILABLE',
  'SELECTED_PROVIDER_STALE',
  'SELECTION_REQUIRED',
  'HOST_OBSERVATION_REQUIRED',
  'HOST_OBSERVATION_AMBIGUOUS',
  'HOST_OBSERVATION_STALE',
  'HOST_OBSERVATION_UNTRUSTED',
  'HOST_UNAVAILABLE',
  'BOUNDARY_HOLD',
  'ASSURANCE_HOLD',
  'AUTHORITY_HOLD',
  'RESOURCE_HOLD',
  'REUSE_RIGHTS_HOLD',
  'ROUTE_PLANNED'
]);
const RESOURCE_FIELDS = [
  'maxInputBytes',
  'maxOutputBytes',
  'maxMemoryBytes',
  'maxDurationMs',
  'maxProcesses'
];

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

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
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

function strictText(value, label, maximum = 240) {
  if (typeof value !== 'string') throw new Error(label + ' must be a string');
  if (!value || value.trim() !== value || /\s{2,}/.test(value)) throw new Error(label + ' must be non-empty canonical text');
  if (value.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return value;
}

function identifier(value, label) {
  const result = strictText(value, label, 128);
  if (!ID.test(result)) throw new Error(label + ' is not a stable identifier');
  return result;
}

function contractToken(value, label) {
  const result = strictText(value, label, 180);
  if (!CONTRACT_TOKEN.test(result)) throw new Error(label + ' is not a portable contract token');
  return result;
}

function semanticVersion(value, label) {
  const result = strictText(value, label, 80);
  if (!SEMVER.test(result)) throw new Error(label + ' is not strict semantic version text');
  return result;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
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

function unique(values, label, normalizer, minimum = 0, maximum = 64, key = canonicalJson) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new Error(label + ' must contain from ' + minimum + ' to ' + maximum + ' items');
  }
  const result = values.map((value, index) => normalizer(value, label + '[' + index + ']'));
  const keys = result.map(key);
  if (new Set(keys).size !== keys.length) throw new Error(label + ' contains duplicates');
  return result.sort((left, right) => compareText(key(left), key(right)));
}

function identifiers(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, identifier, minimum, maximum, (value) => value);
}

function contractTokens(values, label, minimum = 0, maximum = 64) {
  return unique(values, label, contractToken, minimum, maximum, (value) => value);
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    schema: contractToken(value.schema, label + '.schema'),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function references(values, label, minimum = 0, maximum = 32) {
  return unique(values, label, reference, minimum, maximum);
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

function artifactReferences(values, label, minimum = 0, maximum = 32) {
  return unique(values, label, artifactReference, minimum, maximum);
}

function normalizeNetwork(value, label) {
  exactKeys(value, ['mode', 'domains'], label);
  const mode = strictText(value.mode, label + '.mode', 20);
  if (!['disabled', 'allowlist'].includes(mode)) throw new Error(label + '.mode is unsupported');
  const domains = identifiers(value.domains, label + '.domains', 0, 32);
  if (mode === 'disabled' && domains.length) throw new Error(label + ' disabled mode cannot declare domains');
  if (mode === 'allowlist' && !domains.length) throw new Error(label + ' allowlist mode needs a domain');
  return { mode, domains };
}

function normalizeResources(value, label) {
  exactKeys(value, RESOURCE_FIELDS, label);
  return {
    maxInputBytes: boundedInteger(value.maxInputBytes, label + '.maxInputBytes', 1),
    maxOutputBytes: boundedInteger(value.maxOutputBytes, label + '.maxOutputBytes', 1),
    maxMemoryBytes: boundedInteger(value.maxMemoryBytes, label + '.maxMemoryBytes', 1),
    maxDurationMs: boundedInteger(value.maxDurationMs, label + '.maxDurationMs', 1),
    maxProcesses: boundedInteger(value.maxProcesses, label + '.maxProcesses', 1, 1024)
  };
}

function normalizeRoute(value, label) {
  exactKeys(value, ['capability', 'inputSchema', 'outputSchema', 'minimumInputArtifacts'], label);
  return {
    capability: identifier(value.capability, label + '.capability'),
    inputSchema: contractToken(value.inputSchema, label + '.inputSchema'),
    outputSchema: contractToken(value.outputSchema, label + '.outputSchema'),
    minimumInputArtifacts: boundedInteger(value.minimumInputArtifacts, label + '.minimumInputArtifacts', 0, 32)
  };
}

function normalizeAuthority(value, label) {
  exactKeys(value, ['permissions', 'network', 'mutability', 'sourceUse'], label);
  const mutability = strictText(value.mutability, label + '.mutability', 40);
  const sourceUse = strictText(value.sourceUse, label + '.sourceUse', 40);
  if (!MUTABILITY.has(mutability)) throw new Error(label + '.mutability is unsupported');
  if (!SOURCE_USE.has(sourceUse)) throw new Error(label + '.sourceUse is unsupported');
  return {
    permissions: identifiers(value.permissions, label + '.permissions'),
    network: normalizeNetwork(value.network, label + '.network'),
    mutability,
    sourceUse
  };
}

function normalizeProviderSelector(value, label) {
  exactKeys(value, ['id', 'version', 'descriptorSha256'], label);
  return {
    id: identifier(value.id, label + '.id'),
    version: semanticVersion(value.version, label + '.version'),
    descriptorSha256: digest(value.descriptorSha256, label + '.descriptorSha256')
  };
}

function normalizeLineage(value, label) {
  exactKeys(value, ['parents'], label);
  return { parents: unique(value.parents, label + '.parents', normalizeProviderSelector, 0, 8) };
}

function normalizeProvider(value) {
  exactKeys(value, [
    'schema', 'id', 'version', 'status', 'routes', 'authority', 'resources',
    'requiresWorkspaceBoundary', 'requiredAssuranceSchemas', 'executionBoundary',
    'evidenceCeiling', 'lineage'
  ], 'provider');
  if (value.schema !== PROVIDER_SCHEMA) throw new Error('provider schema mismatch');
  const status = strictText(value.status, 'provider.status', 20);
  if (!PROVIDER_STATUSES.has(status)) throw new Error('provider.status is unsupported');
  if (typeof value.requiresWorkspaceBoundary !== 'boolean') {
    throw new Error('provider.requiresWorkspaceBoundary must be boolean');
  }
  const result = {
    schema: PROVIDER_SCHEMA,
    id: identifier(value.id, 'provider.id'),
    version: semanticVersion(value.version, 'provider.version'),
    status,
    routes: unique(value.routes, 'provider.routes', normalizeRoute, 1, 64),
    authority: normalizeAuthority(value.authority, 'provider.authority'),
    resources: normalizeResources(value.resources, 'provider.resources'),
    requiresWorkspaceBoundary: value.requiresWorkspaceBoundary,
    requiredAssuranceSchemas: contractTokens(value.requiredAssuranceSchemas, 'provider.requiredAssuranceSchemas', 0, 32),
    executionBoundary: identifier(value.executionBoundary, 'provider.executionBoundary'),
    evidenceCeiling: strictText(value.evidenceCeiling, 'provider.evidenceCeiling', 600),
    lineage: normalizeLineage(value.lineage, 'provider.lineage')
  };
  if (result.lineage.parents.some((parent) => parent.id === result.id && parent.version === result.version)) {
    throw new Error('provider lineage cannot name the same provider version as its parent');
  }
  return result;
}

function providerDigest(value) {
  return sha256(normalizeProvider(value));
}

function normalizeReuseRights(value, label) {
  exactKeys(value, ['mode', 'authorityRef'], label);
  const mode = strictText(value.mode, label + '.mode', 40);
  if (!REUSE_MODES.has(mode)) throw new Error(label + '.mode is unsupported');
  const authorityRef = value.authorityRef == null ? null : reference(value.authorityRef, label + '.authorityRef');
  if (mode === 'RESEARCH_ONLY' && authorityRef) throw new Error(label + ' research-only mode cannot declare reuse authority');
  if (mode === 'DECLARED_REUSE_ALLOWED' && !authorityRef) throw new Error(label + ' reuse-allowed mode needs an authority reference');
  return { mode, authorityRef };
}

function normalizeObservationPolicy(value, label) {
  exactKeys(value, ['evaluatedAt', 'maximumAgeMs', 'trustedObserverRefs', 'selectedRecordDigest'], label);
  return {
    evaluatedAt: timestamp(value.evaluatedAt, label + '.evaluatedAt'),
    maximumAgeMs: boundedInteger(value.maximumAgeMs, label + '.maximumAgeMs', 1, 31 * 24 * 60 * 60 * 1000),
    trustedObserverRefs: references(value.trustedObserverRefs, label + '.trustedObserverRefs', 1, 32),
    selectedRecordDigest: value.selectedRecordDigest == null
      ? null
      : digest(value.selectedRecordDigest, label + '.selectedRecordDigest')
  };
}

function normalizeRequest(value) {
  exactKeys(value, [
    'schema', 'id', 'capability', 'inputSchema', 'outputSchema', 'selection',
    'inputArtifacts', 'workspaceBoundaryRef', 'reuseRights', 'policy'
  ], 'request');
  if (value.schema !== REQUEST_SCHEMA) throw new Error('request schema mismatch');
  exactKeys(value.policy, [
    'authority', 'allowedPermissions', 'allowedNetworkDomains', 'allowedMutability',
    'allowedSourceUse', 'resourceCeilings', 'observation', 'requiredAssuranceSchemas'
  ], 'request.policy');
  if (value.policy.authority !== 'PLAN_ONLY') throw new Error('request authority must remain PLAN_ONLY');
  const allowedMutability = identifiers(value.policy.allowedMutability, 'request.policy.allowedMutability', 0, 3);
  allowedMutability.forEach((item) => {
    if (!MUTABILITY.has(item)) throw new Error('request.policy.allowedMutability is unsupported');
  });
  const allowedSourceUse = identifiers(value.policy.allowedSourceUse, 'request.policy.allowedSourceUse', 0, 4);
  allowedSourceUse.forEach((item) => {
    if (!SOURCE_USE.has(item)) throw new Error('request.policy.allowedSourceUse is unsupported');
  });
  return {
    schema: REQUEST_SCHEMA,
    id: identifier(value.id, 'request.id'),
    capability: identifier(value.capability, 'request.capability'),
    inputSchema: contractToken(value.inputSchema, 'request.inputSchema'),
    outputSchema: contractToken(value.outputSchema, 'request.outputSchema'),
    selection: value.selection == null ? null : normalizeProviderSelector(value.selection, 'request.selection'),
    inputArtifacts: artifactReferences(value.inputArtifacts, 'request.inputArtifacts'),
    workspaceBoundaryRef: value.workspaceBoundaryRef == null
      ? null
      : reference(value.workspaceBoundaryRef, 'request.workspaceBoundaryRef'),
    reuseRights: normalizeReuseRights(value.reuseRights, 'request.reuseRights'),
    policy: {
      authority: 'PLAN_ONLY',
      allowedPermissions: identifiers(value.policy.allowedPermissions, 'request.policy.allowedPermissions'),
      allowedNetworkDomains: identifiers(value.policy.allowedNetworkDomains, 'request.policy.allowedNetworkDomains', 0, 32),
      allowedMutability,
      allowedSourceUse,
      resourceCeilings: normalizeResources(value.policy.resourceCeilings, 'request.policy.resourceCeilings'),
      observation: normalizeObservationPolicy(value.policy.observation, 'request.policy.observation'),
      requiredAssuranceSchemas: contractTokens(value.policy.requiredAssuranceSchemas, 'request.policy.requiredAssuranceSchemas', 0, 32)
    }
  };
}

function normalizeObservationCore(value) {
  exactKeys(value, [
    'schema', 'provider', 'observerRef', 'observedAt', 'expiresAt', 'availability',
    'workspaceBoundaryRef', 'executorRef', 'authorityEnvelope', 'resourceEnvelope',
    'assuranceRefs'
  ], 'observation');
  if (value.schema !== OBSERVATION_SCHEMA) throw new Error('observation schema mismatch');
  const availability = strictText(value.availability, 'observation.availability', 20);
  if (!AVAILABILITY.has(availability)) throw new Error('observation.availability is unsupported');
  const executorRef = value.executorRef == null ? null : reference(value.executorRef, 'observation.executorRef');
  const assuranceRefs = references(value.assuranceRefs, 'observation.assuranceRefs', availability === 'AVAILABLE' ? 1 : 0, 32);
  const assuranceSchemas = assuranceRefs.map((item) => item.schema);
  if (new Set(assuranceSchemas).size !== assuranceSchemas.length) {
    throw new Error('observation.assuranceRefs must contain at most one reference per schema');
  }
  if (availability === 'AVAILABLE' && !executorRef) throw new Error('AVAILABLE observation needs an executorRef');
  const observedAt = timestamp(value.observedAt, 'observation.observedAt');
  const expiresAt = timestamp(value.expiresAt, 'observation.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error('observation.expiresAt must be after observedAt');
  return {
    schema: OBSERVATION_SCHEMA,
    provider: normalizeProviderSelector(value.provider, 'observation.provider'),
    observerRef: reference(value.observerRef, 'observation.observerRef'),
    observedAt,
    expiresAt,
    availability,
    workspaceBoundaryRef: value.workspaceBoundaryRef == null
      ? null
      : reference(value.workspaceBoundaryRef, 'observation.workspaceBoundaryRef'),
    executorRef,
    authorityEnvelope: normalizeAuthority(value.authorityEnvelope, 'observation.authorityEnvelope'),
    resourceEnvelope: normalizeResources(value.resourceEnvelope, 'observation.resourceEnvelope'),
    assuranceRefs
  };
}

function sealHostObservation(value) {
  const core = normalizeObservationCore(value);
  return { ...core, recordDigest: sha256(core) };
}

function normalizeObservation(value) {
  exactKeys(value, [
    'schema', 'provider', 'observerRef', 'observedAt', 'expiresAt', 'availability',
    'workspaceBoundaryRef', 'executorRef', 'authorityEnvelope', 'resourceEnvelope',
    'assuranceRefs', 'recordDigest'
  ], 'observation');
  const { recordDigest, ...candidateCore } = value;
  const sealed = sealHostObservation(candidateCore);
  const suppliedDigest = digest(recordDigest, 'observation.recordDigest');
  if (sealed.recordDigest !== suppliedDigest) throw new Error('observation record digest mismatch');
  return sealed;
}

function normalizePortableRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || !value || value.length > 512) throw new Error(label + ' must be a bounded string');
  if (value.normalize('NFC') !== value) throw new Error(label + ' must use NFC text');
  if (value.startsWith('/') || value.startsWith('\\') || value.includes('\\') || value.includes(':')) {
    throw new Error(label + ' must be a slash-separated relative path without drive, UNC, or ADS syntax');
  }
  const segments = value.split('/');
  if (!segments.length || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(label + ' contains an empty or traversal segment');
  }
  segments.forEach((segment) => {
    if (!PORTABLE_SEGMENT.test(segment) || /[. ]$/.test(segment)) {
      throw new Error(label + ' contains a non-portable segment');
    }
    if (WINDOWS_DEVICE.test(segment)) throw new Error(label + ' contains a Windows reserved device segment');
  });
  return segments.join('/');
}

function windowsPathKey(value) {
  return value.normalize('NFC').toLowerCase();
}

function pathsOverlap(left, right) {
  const leftKey = windowsPathKey(left);
  const rightKey = windowsPathKey(right);
  return leftKey === rightKey || leftKey.startsWith(rightKey + '/') || rightKey.startsWith(leftKey + '/');
}

function buildWorkspaceBoundaryRef(value) {
  exactKeys(value, ['schema', 'id', 'sourceRoots', 'outputRoot', 'evidenceRoot'], 'workspace boundary');
  if (value.schema !== BOUNDARY_SCHEMA) throw new Error('workspace boundary schema mismatch');
  const sourceRoots = unique(
    value.sourceRoots,
    'workspace boundary.sourceRoots',
    normalizePortableRelativePath,
    1,
    32,
    windowsPathKey
  );
  for (let left = 0; left < sourceRoots.length; left += 1) {
    for (let right = left + 1; right < sourceRoots.length; right += 1) {
      if (pathsOverlap(sourceRoots[left], sourceRoots[right])) {
        throw new Error('workspace boundary source roots overlap under Windows path semantics');
      }
    }
  }
  const declaration = {
    schema: BOUNDARY_SCHEMA,
    id: identifier(value.id, 'workspace boundary.id'),
    sourceRoots,
    outputRoot: normalizePortableRelativePath(value.outputRoot, 'workspace boundary.outputRoot'),
    evidenceRoot: normalizePortableRelativePath(value.evidenceRoot, 'workspace boundary.evidenceRoot')
  };
  const destinations = [declaration.outputRoot, declaration.evidenceRoot];
  for (const sourceRoot of sourceRoots) {
    for (const destination of destinations) {
      if (pathsOverlap(sourceRoot, destination)) throw new Error('workspace boundary source and destination roots overlap');
    }
  }
  if (pathsOverlap(declaration.outputRoot, declaration.evidenceRoot)) {
    throw new Error('workspace boundary output and evidence roots overlap');
  }
  return { id: declaration.id, schema: BOUNDARY_SCHEMA, sha256: sha256(declaration) };
}

function providerRef(provider, route) {
  return {
    id: provider.id,
    version: provider.version,
    descriptorSha256: providerDigest(provider),
    status: provider.status,
    route,
    authority: provider.authority,
    resources: provider.resources,
    requiresWorkspaceBoundary: provider.requiresWorkspaceBoundary,
    requiredAssuranceSchemas: provider.requiredAssuranceSchemas,
    executionBoundary: provider.executionBoundary,
    evidenceCeilingSha256: sha256(Buffer.from(provider.evidenceCeiling, 'utf8')),
    lineage: provider.lineage
  };
}

function providerRefKey(value) {
  return value.id + '@' + value.version + '@' + value.descriptorSha256;
}

function normalizeProviderRef(value, label) {
  exactKeys(value, [
    'id', 'version', 'descriptorSha256', 'status', 'route', 'authority', 'resources',
    'requiresWorkspaceBoundary', 'requiredAssuranceSchemas', 'executionBoundary',
    'evidenceCeilingSha256', 'lineage'
  ], label);
  const status = strictText(value.status, label + '.status', 20);
  if (!PROVIDER_STATUSES.has(status)) throw new Error(label + '.status is unsupported');
  if (typeof value.requiresWorkspaceBoundary !== 'boolean') throw new Error(label + '.requiresWorkspaceBoundary must be boolean');
  return {
    id: identifier(value.id, label + '.id'),
    version: semanticVersion(value.version, label + '.version'),
    descriptorSha256: digest(value.descriptorSha256, label + '.descriptorSha256'),
    status,
    route: normalizeRoute(value.route, label + '.route'),
    authority: normalizeAuthority(value.authority, label + '.authority'),
    resources: normalizeResources(value.resources, label + '.resources'),
    requiresWorkspaceBoundary: value.requiresWorkspaceBoundary,
    requiredAssuranceSchemas: contractTokens(value.requiredAssuranceSchemas, label + '.requiredAssuranceSchemas', 0, 32),
    executionBoundary: identifier(value.executionBoundary, label + '.executionBoundary'),
    evidenceCeilingSha256: digest(value.evidenceCeilingSha256, label + '.evidenceCeilingSha256'),
    lineage: normalizeLineage(value.lineage, label + '.lineage')
  };
}

function missingValues(required, allowed) {
  const set = new Set(allowed);
  return required.filter((item) => !set.has(item));
}

function extraValues(actual, required) {
  const set = new Set(required);
  return actual.filter((item) => !set.has(item));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function matchingRoute(provider, request) {
  return provider.routes.find((route) =>
    route.capability === request.capability &&
    route.inputSchema === request.inputSchema &&
    route.outputSchema === request.outputSchema &&
    request.inputArtifacts.length >= route.minimumInputArtifacts) || null;
}

function resourceHolds(required, requestCeilings, hostEnvelope) {
  const holds = [];
  RESOURCE_FIELDS.forEach((field) => {
    if (required[field] > requestCeilings[field]) holds.push('REQUEST_RESOURCE_TOO_LOW:' + field);
    if (hostEnvelope && required[field] > hostEnvelope[field]) holds.push('HOST_RESOURCE_TOO_LOW:' + field);
    if (hostEnvelope && hostEnvelope[field] > required[field]) holds.push('HOST_RESOURCE_OVERBROAD:' + field);
  });
  return holds;
}

function requiredAssuranceSchemas(provider, request) {
  return Array.from(new Set([
    RESOURCE_ENFORCEMENT_SCHEMA,
    ...provider.requiredAssuranceSchemas,
    ...request.policy.requiredAssuranceSchemas
  ])).sort(compareText);
}

function buildRoutePlan(input) {
  exactKeys(input, ['request', 'providers', 'hostObservations'], 'route input');
  const request = normalizeRequest(input.request);
  if (!Array.isArray(input.providers) || input.providers.length > 128) throw new Error('providers must be a bounded array');
  if (!Array.isArray(input.hostObservations) || input.hostObservations.length > 128) throw new Error('hostObservations must be a bounded array');
  const providers = input.providers.map(normalizeProvider);
  const observations = input.hostObservations.map(normalizeObservation);
  const providerSelectors = providers.map((provider) => provider.id + '@' + provider.version + '@' + providerDigest(provider));
  if (new Set(providerSelectors).size !== providerSelectors.length) throw new Error('route catalog contains a duplicate exact provider descriptor');
  const observationDigests = observations.map((observation) => observation.recordDigest);
  if (new Set(observationDigests).size !== observationDigests.length) throw new Error('route input contains a duplicate host observation record');

  const compatible = providers.map((provider) => ({ provider, route: matchingRoute(provider, request) }))
    .filter((item) => item.route)
    .sort((left, right) => {
      const leftRef = providerRef(left.provider, left.route);
      const rightRef = providerRef(right.provider, right.route);
      return compareText(leftRef.id, rightRef.id) ||
        compareText(leftRef.version, rightRef.version) ||
        compareText(leftRef.descriptorSha256, rightRef.descriptorSha256);
    });
  const candidates = compatible.map((item) => providerRef(item.provider, item.route));
  let status = 'MISSING_HAND';
  let selected = null;
  let selectedProvider = null;
  let observation = null;
  let plannedEnvelope = null;
  const holds = [];

  if (request.selection) {
    const exact = compatible.find((item) => {
      const candidate = providerRef(item.provider, item.route);
      return candidate.id === request.selection.id &&
        candidate.version === request.selection.version &&
        candidate.descriptorSha256 === request.selection.descriptorSha256;
    });
    if (exact) {
      selectedProvider = exact.provider;
      selected = providerRef(exact.provider, exact.route);
    } else {
      const exactDescriptor = providers.some((provider) =>
        provider.id === request.selection.id &&
        provider.version === request.selection.version &&
        providerDigest(provider) === request.selection.descriptorSha256);
      const sameVersion = providers.some((provider) =>
        provider.id === request.selection.id && provider.version === request.selection.version);
      status = exactDescriptor || !sameVersion
        ? 'SELECTED_PROVIDER_UNAVAILABLE'
        : 'SELECTED_PROVIDER_STALE';
    }
  } else if (compatible.length) {
    if (compatible.length > 1) {
      status = 'SELECTION_REQUIRED';
    } else {
      selectedProvider = compatible[0].provider;
      selected = providerRef(compatible[0].provider, compatible[0].route);
    }
  }

  if (selectedProvider) {
    const matchingObservations = observations.filter((item) =>
      item.provider.id === selected.id &&
      item.provider.version === selected.version &&
      item.provider.descriptorSha256 === selected.descriptorSha256);
    if (request.policy.observation.selectedRecordDigest) {
      observation = matchingObservations.find((item) =>
        item.recordDigest === request.policy.observation.selectedRecordDigest) || null;
    } else if (matchingObservations.length === 1) {
      observation = matchingObservations[0];
    }
    if (!observation) {
      const sameIdentity = observations.some((item) =>
        item.provider.id === selected.id && item.provider.version === selected.version);
      status = matchingObservations.length > 1
        ? 'HOST_OBSERVATION_AMBIGUOUS'
        : sameIdentity
          ? 'HOST_OBSERVATION_STALE'
          : 'HOST_OBSERVATION_REQUIRED';
    } else {
      const evaluatedAt = Date.parse(request.policy.observation.evaluatedAt);
      const observedAt = Date.parse(observation.observedAt);
      const expiresAt = Date.parse(observation.expiresAt);
      const stale = observedAt > evaluatedAt || evaluatedAt > expiresAt ||
        evaluatedAt - observedAt > request.policy.observation.maximumAgeMs;
      if (stale) {
        status = 'HOST_OBSERVATION_STALE';
      } else if (!request.policy.observation.trustedObserverRefs.some((item) => same(item, observation.observerRef))) {
        status = 'HOST_OBSERVATION_UNTRUSTED';
      } else if (observation.availability !== 'AVAILABLE') {
        status = 'HOST_UNAVAILABLE';
      } else if (selected.requiresWorkspaceBoundary && !request.workspaceBoundaryRef) {
        holds.push('WORKSPACE_BOUNDARY_REQUIRED');
        status = 'BOUNDARY_HOLD';
      } else if (!same(request.workspaceBoundaryRef, observation.workspaceBoundaryRef)) {
        holds.push('WORKSPACE_BOUNDARY_MISMATCH');
        status = 'BOUNDARY_HOLD';
      } else {
        const requiredAssurances = requiredAssuranceSchemas(selectedProvider, request);
        const observedAssurances = observation.assuranceRefs.map((item) => item.schema).sort(compareText);
        const missingAssurances = missingValues(requiredAssurances, observedAssurances);
        const extraAssurances = extraValues(observedAssurances, requiredAssurances);
        if (missingAssurances.length) holds.push('ASSURANCE_REQUIRED:' + missingAssurances.join(','));
        if (extraAssurances.length) holds.push('ASSURANCE_UNREQUESTED:' + extraAssurances.join(','));
        if (holds.length) {
          status = 'ASSURANCE_HOLD';
        } else {
          const authority = selected.authority;
          const hostAuthority = observation.authorityEnvelope;
          const requestPermissionGap = missingValues(authority.permissions, request.policy.allowedPermissions);
          const hostPermissionGap = missingValues(authority.permissions, hostAuthority.permissions);
          const hostPermissionExcess = extraValues(hostAuthority.permissions, authority.permissions);
          const requestNetworkGap = authority.network.mode === 'allowlist'
            ? missingValues(authority.network.domains, request.policy.allowedNetworkDomains)
            : [];
          const hostNetworkGap = authority.network.mode === 'allowlist'
            ? missingValues(authority.network.domains, hostAuthority.network.domains)
            : [];
          const hostNetworkExcess = extraValues(hostAuthority.network.domains, authority.network.domains);
          if (!request.policy.allowedMutability.includes(authority.mutability)) holds.push('MUTABILITY_NOT_ALLOWED');
          if (!request.policy.allowedSourceUse.includes(authority.sourceUse)) holds.push('SOURCE_USE_NOT_ALLOWED');
          if (hostAuthority.mutability !== authority.mutability) holds.push('HOST_MUTABILITY_NOT_EXACT');
          if (hostAuthority.sourceUse !== authority.sourceUse) holds.push('HOST_SOURCE_USE_NOT_EXACT');
          if (hostAuthority.network.mode !== authority.network.mode) holds.push('HOST_NETWORK_MODE_NOT_EXACT');
          if (requestPermissionGap.length) holds.push('REQUEST_PERMISSION_NOT_ALLOWED:' + requestPermissionGap.join(','));
          if (hostPermissionGap.length) holds.push('HOST_PERMISSION_NOT_GRANTED:' + hostPermissionGap.join(','));
          if (hostPermissionExcess.length) holds.push('HOST_PERMISSION_OVERBROAD:' + hostPermissionExcess.join(','));
          if (requestNetworkGap.length) holds.push('REQUEST_NETWORK_NOT_ALLOWED:' + requestNetworkGap.join(','));
          if (hostNetworkGap.length) holds.push('HOST_NETWORK_NOT_ALLOWED:' + hostNetworkGap.join(','));
          if (hostNetworkExcess.length) holds.push('HOST_NETWORK_OVERBROAD:' + hostNetworkExcess.join(','));
          if (holds.length) {
            status = 'AUTHORITY_HOLD';
          } else {
            holds.push(...resourceHolds(selected.resources, request.policy.resourceCeilings, observation.resourceEnvelope));
            if (holds.length) {
              status = 'RESOURCE_HOLD';
            } else if (DIRECT_REUSE.has(authority.sourceUse) && request.reuseRights.mode !== 'DECLARED_REUSE_ALLOWED') {
              holds.push('DIRECT_REUSE_RIGHTS_REQUIRED');
              status = 'REUSE_RIGHTS_HOLD';
            } else {
              status = 'ROUTE_PLANNED';
              plannedEnvelope = {
                authority: clone(authority),
                resources: clone(selected.resources),
                workspaceBoundaryRef: clone(request.workspaceBoundaryRef),
                assuranceRefs: clone(observation.assuranceRefs)
              };
            }
          }
        }
      }
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
    plannedEnvelope,
    nextGate: status === 'ROUTE_PLANNED'
      ? 'EXPLICIT_EXECUTOR_AUTHORIZATION_AND_EXTERNAL_ASSURANCE_VERIFICATION'
      : 'REPAIR_OR_EXPLICIT_SELECTION_THEN_REPLAN',
    truth: {
      planOnly: true,
      providerDeclarationIsAvailabilityProof: false,
      hostObservationIsExecutionProof: false,
      hostObserverAuthenticityProven: false,
      providerCodeLoaded: false,
      providerCodeExecuted: false,
      inputContentRead: false,
      inputArtifactBytesProven: false,
      rawInputContentRetained: false,
      machinePathsRetained: false,
      workspaceBoundaryHostVerified: false,
      outputWritten: false,
      outputArtifactDigestProven: false,
      permissionGranted: false,
      networkUsed: false,
      resourceEnforcementProven: false,
      externalAssurancesVerified: false,
      directReuseRightsProven: false,
      installed: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  return { ...planCore, planDigest: sha256(planCore) };
}

function normalizeHolds(values, label) {
  if (!Array.isArray(values) || values.length > 32) throw new Error(label + ' must be a bounded array');
  return values.map((value, index) => strictText(value, label + '[' + index + ']', 300));
}

function normalizeTruth(value, label) {
  const fields = [
    'planOnly', 'providerDeclarationIsAvailabilityProof', 'hostObservationIsExecutionProof',
    'hostObserverAuthenticityProven', 'providerCodeLoaded', 'providerCodeExecuted',
    'inputContentRead', 'inputArtifactBytesProven', 'rawInputContentRetained',
    'machinePathsRetained', 'workspaceBoundaryHostVerified', 'outputWritten',
    'outputArtifactDigestProven', 'permissionGranted', 'networkUsed',
    'resourceEnforcementProven', 'externalAssurancesVerified', 'directReuseRightsProven',
    'installed', 'promoted', 'canonChanged'
  ];
  exactKeys(value, fields, label);
  const result = {};
  fields.forEach((field) => {
    const expected = field === 'planOnly';
    if (value[field] !== expected) throw new Error(label + '.' + field + ' violates the plan-only truth ceiling');
    result[field] = expected;
  });
  return result;
}

function normalizePlannedEnvelope(value, label) {
  if (value == null) return null;
  exactKeys(value, ['authority', 'resources', 'workspaceBoundaryRef', 'assuranceRefs'], label);
  return {
    authority: normalizeAuthority(value.authority, label + '.authority'),
    resources: normalizeResources(value.resources, label + '.resources'),
    workspaceBoundaryRef: value.workspaceBoundaryRef == null
      ? null
      : reference(value.workspaceBoundaryRef, label + '.workspaceBoundaryRef'),
    assuranceRefs: references(value.assuranceRefs, label + '.assuranceRefs', 1, 32)
  };
}

function normalizeRoutePlan(plan) {
  exactKeys(plan, [
    'schema', 'version', 'request', 'status', 'candidates', 'selected', 'hostObservation',
    'holds', 'plannedEnvelope', 'nextGate', 'truth', 'authority', 'planDigest'
  ], 'route plan');
  if (plan.schema !== PLAN_SCHEMA) throw new Error('route plan schema mismatch');
  if (plan.version !== VERSION) throw new Error('route plan version mismatch');
  if (!STATUSES.has(plan.status)) throw new Error('route plan status is unsupported');
  const nextGates = [
    'EXPLICIT_EXECUTOR_AUTHORIZATION_AND_EXTERNAL_ASSURANCE_VERIFICATION',
    'REPAIR_OR_EXPLICIT_SELECTION_THEN_REPLAN'
  ];
  if (!nextGates.includes(plan.nextGate)) throw new Error('route plan nextGate is unsupported');
  if (plan.authority !== 'NONE') throw new Error('route plan authority must remain NONE');
  const resultCore = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    request: normalizeRequest(plan.request),
    status: plan.status,
    candidates: unique(plan.candidates, 'route plan.candidates', normalizeProviderRef, 0, 128, providerRefKey),
    selected: plan.selected == null ? null : normalizeProviderRef(plan.selected, 'route plan.selected'),
    hostObservation: plan.hostObservation == null ? null : normalizeObservation(plan.hostObservation),
    holds: normalizeHolds(plan.holds, 'route plan.holds'),
    plannedEnvelope: normalizePlannedEnvelope(plan.plannedEnvelope, 'route plan.plannedEnvelope'),
    nextGate: plan.nextGate,
    truth: normalizeTruth(plan.truth, 'route plan.truth'),
    authority: 'NONE'
  };
  const planDigest = digest(plan.planDigest, 'route plan.planDigest');
  if (sha256(resultCore) !== planDigest) throw new Error('route plan digest mismatch');
  const normalized = { ...resultCore, planDigest };
  if (canonicalJson(normalized) !== canonicalJson(plan)) throw new Error('route plan is not in canonical normalized form');
  if ((normalized.status === 'ROUTE_PLANNED') !== (normalized.plannedEnvelope !== null)) {
    throw new Error('route plan envelope must exist only for ROUTE_PLANNED');
  }
  const expectedNextGate = normalized.status === 'ROUTE_PLANNED'
    ? 'EXPLICIT_EXECUTOR_AUTHORIZATION_AND_EXTERNAL_ASSURANCE_VERIFICATION'
    : 'REPAIR_OR_EXPLICIT_SELECTION_THEN_REPLAN';
  if (normalized.nextGate !== expectedNextGate) throw new Error('route plan nextGate conflicts with status');
  if (normalized.status === 'ROUTE_PLANNED' && normalized.holds.length) {
    throw new Error('ROUTE_PLANNED cannot retain holds');
  }
  if (normalized.selected && !normalized.candidates.some((candidate) => same(candidate, normalized.selected))) {
    throw new Error('route plan selected provider is not one of its candidates');
  }
  if (normalized.hostObservation) {
    if (!normalized.selected) throw new Error('host observation requires a selected provider');
    const observedProvider = normalized.hostObservation.provider;
    if (observedProvider.id !== normalized.selected.id ||
      observedProvider.version !== normalized.selected.version ||
      observedProvider.descriptorSha256 !== normalized.selected.descriptorSha256) {
      throw new Error('host observation does not bind the selected provider');
    }
  }
  return normalized;
}

function verifyRoutePlan(plan, input) {
  const errors = [];
  try {
    const normalized = normalizeRoutePlan(plan);
    const rebuilt = buildRoutePlan(input);
    if (canonicalJson(rebuilt) !== canonicalJson(normalized)) throw new Error('route plan content differs from deterministic rebuild');
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
  BOUNDARY_SCHEMA,
  RESOURCE_ENFORCEMENT_SCHEMA,
  canonicalJson,
  sha256,
  normalizeProvider,
  normalizeRequest,
  normalizeObservation,
  normalizeRoutePlan,
  normalizePortableRelativePath,
  buildWorkspaceBoundaryRef,
  sealHostObservation,
  providerDigest,
  buildRoutePlan,
  verifyRoutePlan,
  clone
};
