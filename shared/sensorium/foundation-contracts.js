'use strict';

const C = require('./core');
const Adapter = require('./adapter-contract');

const SCHEMA = 'axm.sensorium-foundation-preflight/v1';
const MODULE_IDS = Object.freeze([
  'axm.sense.observation-session-envelope',
  'axm.sense.target-identity-binder',
  'axm.sense.capability-descriptor-registry',
  'axm.sense.host-adapter-negotiator',
  'axm.sense.resource-budget-contract',
  'axm.sense.cadence-duration-controller',
  'axm.sense.unit-reference-frame-contract'
]);
const ALLOWED_REQUEST_FIELDS = Object.freeze([
  'request_id', 'session_id', 'purpose', 'seat_id', 'target_binding', 'budget_ref', 'input_refs',
  'authority_lease_ref', 'unit_reference_frame_ref', 'privacy_mode', 'observation_lease_expires_at_ms',
  'extensions', 'action_requested', 'publish_requested', 'install_requested', 'delete_requested', 'canon_requested'
]);
const REQUIRED_REQUEST_FIELDS = Object.freeze(['request_id', 'session_id', 'purpose', 'seat_id', 'target_binding', 'budget_ref', 'input_refs']);
const EFFECT_FIELDS = Object.freeze(['action_requested', 'publish_requested', 'install_requested', 'delete_requested', 'canon_requested']);
const TARGET_KINDS = Object.freeze(['WINDOW', 'DEVICE', 'STREAM', 'FILE', 'REGION', 'PERSON_CONSENTED_SOURCE', 'ENVIRONMENT', 'DECLARED_DOM_ROOT', 'EXPLICIT_SHARED_SURFACE']);
const PRIVACY_MODES = Object.freeze(['INTERNAL_TYPED_ONLY', 'PRIVATE_SOURCE_BOUND', 'PUBLIC_SAFE']);
const STATES = Object.freeze(['READY', 'DEGRADED', 'BLOCKED', 'UNKNOWN']);

function unique(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }
function exact(value, label, holds) {
  try { return C.assertExactIdentifier(value, label); }
  catch (error) { holds.push('INVALID_' + String(label || 'IDENTIFIER').toUpperCase().replace(/[^A-Z0-9]+/g, '_')); return null; }
}
function stateOf(values) {
  values = values || [];
  if (values.includes('BLOCKED')) return 'BLOCKED';
  if (values.includes('UNKNOWN')) return 'UNKNOWN';
  if (values.includes('DEGRADED')) return 'DEGRADED';
  return 'READY';
}
function finish(schema, status, holds, value) {
  return Object.assign({ schema, status, holds: unique(holds).sort(), authorityInherited: false, automaticAction: false, automaticPromotion: false }, value || {});
}

function validateRequest(request) {
  request = request || {};
  const holds = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) return finish('axm.observation-session-request-validation/v1', 'BLOCKED', ['REQUEST_OBJECT_REQUIRED']);
  Object.keys(request).filter(function (key) { return !ALLOWED_REQUEST_FIELDS.includes(key); }).forEach(function (key) { holds.push('UNSUPPORTED_REQUEST_FIELD:' + key); });
  REQUIRED_REQUEST_FIELDS.filter(function (key) { return request[key] == null; }).forEach(function (key) { holds.push('MISSING_REQUIRED_FIELD:' + key); });
  EFFECT_FIELDS.filter(function (key) { return request[key] === true; }).forEach(function (key) { holds.push('FORBIDDEN_EFFECT_REQUEST:' + key); });
  ['request_id', 'session_id', 'purpose', 'seat_id'].forEach(function (key) { if (request[key] != null) exact(request[key], key, holds); });
  if (!Array.isArray(request.input_refs) || request.input_refs.length < 1 || request.input_refs.length > 32) holds.push('INPUT_REFS_MUST_BE_BOUNDED_NONEMPTY_ARRAY');
  else request.input_refs.forEach(function (item) { exact(item, 'input_ref', holds); });
  const privacyMode = String(request.privacy_mode || 'INTERNAL_TYPED_ONLY');
  if (!PRIVACY_MODES.includes(privacyMode)) holds.push('INVALID_PRIVACY_MODE');
  if (privacyMode === 'PUBLIC_SAFE') holds.push('PUBLIC_SAFE_SEMANTIC_REDACTION_UNPROVEN');
  if (request.extensions != null && (!request.extensions || typeof request.extensions !== 'object' || Array.isArray(request.extensions))) holds.push('EXTENSIONS_MUST_BE_OBJECT');
  return finish('axm.observation-session-request-validation/v1', holds.length ? 'BLOCKED' : 'READY', holds, { privacyMode });
}

function bindTarget(binding) {
  binding = binding || {};
  const holds = [];
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return finish('axm.target-binding-receipt/v1', 'BLOCKED', ['TARGET_BINDING_OBJECT_REQUIRED']);
  const allowed = ['target_id', 'kind', 'isolation', 'isolation_proven', 'scope', 'consent_ref'];
  Object.keys(binding).filter(function (key) { return !allowed.includes(key); }).forEach(function (key) { holds.push('UNSUPPORTED_TARGET_FIELD:' + key); });
  const targetId = exact(binding.target_id, 'target_id', holds);
  const kind = String(binding.kind || '');
  if (!TARGET_KINDS.includes(kind)) holds.push('UNSUPPORTED_TARGET_KIND');
  const isolation = exact(binding.isolation, 'target_isolation', holds);
  if (binding.isolation_proven !== true) holds.push('EXACT_TARGET_ISOLATION_UNPROVEN');
  const scope = exact(binding.scope, 'target_scope', holds);
  if (kind === 'PERSON_CONSENTED_SOURCE') holds.push('PERSON_SOURCE_REQUIRES_HELD_AUTHORITY_GATE');
  return finish('axm.target-binding-receipt/v1', holds.length ? 'BLOCKED' : 'READY', holds, {
    targetId,
    kind: kind || null,
    isolation,
    isolationProven: binding.isolation_proven === true,
    scopeDigest: scope ? C.digest(scope) : null,
    consentReferenceSupplied: Boolean(binding.consent_ref),
    identityInferred: false,
    scopeWidened: false
  });
}

const BUDGET_FIELDS = Object.freeze({
  max_bytes: [0, 67108864, true],
  max_items: [1, 10000, true],
  minimum_cadence_ms: [0, 31536000000, true],
  max_duration_ms: [1, 86400000, true],
  max_cpu_percent: [0, 100, false],
  max_gpu_percent: [0, 100, false],
  max_memory_bytes: [0, 1073741824, true],
  max_battery_percent: [0, 100, false],
  max_thermal_c: [1, 120, false],
  max_network_bytes: [0, 67108864, true]
});

function validateResourceBudget(budget) {
  budget = budget || {};
  const holds = [];
  if (!budget || typeof budget !== 'object' || Array.isArray(budget)) return finish('axm.resource-budget-receipt/v1', 'BLOCKED', ['RESOURCE_BUDGET_OBJECT_REQUIRED']);
  const budgetId = exact(budget.budget_id, 'budget_id', holds);
  const allowed = ['budget_id'].concat(Object.keys(BUDGET_FIELDS));
  Object.keys(budget).filter(function (key) { return !allowed.includes(key); }).forEach(function (key) { holds.push('UNSUPPORTED_BUDGET_FIELD:' + key); });
  const normalized = {};
  for (const [key, bounds] of Object.entries(BUDGET_FIELDS)) {
    const number = Number(budget[key]);
    if (!Number.isFinite(number) || number < bounds[0] || number > bounds[1] || (bounds[2] && !Number.isInteger(number))) holds.push('INVALID_BUDGET_VALUE:' + key);
    else normalized[key.replace(/_([a-z])/g, function (_, letter) { return letter.toUpperCase(); })] = number;
  }
  return finish('axm.resource-budget-receipt/v1', holds.length ? 'BLOCKED' : 'READY', holds, Object.assign({ budgetId, finiteHardStop: holds.length === 0, networkDefaultDenied: normalized.maxNetworkBytes === 0 }, normalized));
}

function validateCadence(cadence, budgetReceipt, options) {
  options = options || {};
  const repeated = options.repeated === true;
  if (!repeated) return finish('axm.cadence-duration-receipt/v1', 'READY', [], { repeated: false, intervalMs: null, durationMs: 0, maxSamples: 1, leaseExpiresAtMs: null });
  cadence = cadence || {};
  const holds = [];
  const intervalMs = Number(cadence.interval_ms), durationMs = Number(cadence.duration_ms), maxSamples = Number(cadence.max_samples);
  if (!Number.isInteger(intervalMs) || intervalMs < 1) holds.push('INVALID_CADENCE_INTERVAL');
  if (!Number.isInteger(durationMs) || durationMs < 1) holds.push('INVALID_OBSERVATION_DURATION');
  if (!Number.isInteger(maxSamples) || maxSamples < 1) holds.push('INVALID_MAX_SAMPLES');
  if (budgetReceipt.status !== 'READY') holds.push('VALID_RESOURCE_BUDGET_REQUIRED');
  else {
    if (intervalMs < budgetReceipt.minimumCadenceMs) holds.push('CADENCE_EXCEEDS_RATE_BUDGET');
    if (durationMs > budgetReceipt.maxDurationMs) holds.push('DURATION_EXCEEDS_BUDGET');
    if (maxSamples > budgetReceipt.maxItems) holds.push('SAMPLES_EXCEED_ITEM_BUDGET');
    if (Number.isFinite(intervalMs) && Number.isFinite(durationMs) && Math.ceil(durationMs / intervalMs) > maxSamples) holds.push('CADENCE_SAMPLE_COUNT_INCONSISTENT');
  }
  const atMs = Number(options.atMs == null ? Date.now() : options.atMs), leaseExpiresAtMs = Number(options.leaseExpiresAtMs);
  if (!Number.isFinite(leaseExpiresAtMs) || leaseExpiresAtMs <= atMs || (Number.isFinite(durationMs) && leaseExpiresAtMs < atMs + durationMs)) holds.push('FINITE_OBSERVATION_LEASE_REQUIRED');
  return finish('axm.cadence-duration-receipt/v1', holds.length ? 'BLOCKED' : 'READY', holds, { repeated, intervalMs, durationMs, maxSamples, leaseExpiresAtMs: Number.isFinite(leaseExpiresAtMs) ? leaseExpiresAtMs : null });
}

function validateReferenceFrame(reference, required) {
  if (reference == null && required !== true) return finish('axm.unit-reference-frame-receipt/v1', 'READY', [], { required: false, supplied: false });
  reference = reference || {};
  const holds = [];
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return finish('axm.unit-reference-frame-receipt/v1', 'BLOCKED', ['REFERENCE_FRAME_OBJECT_REQUIRED']);
  const allowed = ['frame_id', 'units', 'axes', 'origin', 'orientation', 'timestamp_basis', 'calibration_state', 'conversion_rules'];
  Object.keys(reference).filter(function (key) { return !allowed.includes(key); }).forEach(function (key) { holds.push('UNSUPPORTED_REFERENCE_FRAME_FIELD:' + key); });
  const frameId = exact(reference.frame_id, 'frame_id', holds), origin = exact(reference.origin, 'origin', holds), orientation = exact(reference.orientation, 'orientation', holds), timestampBasis = exact(reference.timestamp_basis, 'timestamp_basis', holds);
  const units = reference.units;
  if (!units || typeof units !== 'object' || Array.isArray(units) || Object.keys(units).length < 1 || Object.keys(units).length > 16) holds.push('BOUNDED_UNITS_OBJECT_REQUIRED');
  else Object.entries(units).forEach(function (entry) { exact(entry[0], 'unit_dimension', holds); exact(entry[1], 'unit_symbol', holds); });
  const axes = Array.isArray(reference.axes) ? reference.axes.map(function (axis) { return exact(axis, 'axis', holds); }).filter(Boolean) : [];
  if (!Array.isArray(reference.axes) || axes.length < 1 || axes.length > 8 || unique(axes).length !== axes.length) holds.push('BOUNDED_UNIQUE_AXES_REQUIRED');
  const calibrationState = String(reference.calibration_state || '');
  if (!['CALIBRATED', 'UNCALIBRATED', 'UNKNOWN', 'NOT_APPLICABLE'].includes(calibrationState)) holds.push('INVALID_CALIBRATION_STATE');
  const rules = Array.isArray(reference.conversion_rules) ? reference.conversion_rules : [];
  if (!Array.isArray(reference.conversion_rules) || rules.length > 16) holds.push('BOUNDED_CONVERSION_RULES_REQUIRED');
  else rules.forEach(function (rule) {
    if (!rule || typeof rule !== 'object' || !exact(rule.from, 'conversion_from', holds) || !exact(rule.to, 'conversion_to', holds) || !Number.isFinite(Number(rule.scale)) || !Number.isFinite(Number(rule.offset))) holds.push('INVALID_CONVERSION_RULE');
  });
  return finish('axm.unit-reference-frame-receipt/v1', holds.length ? 'BLOCKED' : 'READY', holds, {
    required: required === true,
    supplied: true,
    frameId,
    units: units && typeof units === 'object' && !Array.isArray(units) ? C.clone(units) : {},
    axes,
    origin,
    orientation,
    timestampBasis,
    calibrationState: calibrationState || null,
    conversionRules: rules.map(function (rule) { return { from: rule.from, to: rule.to, scale: Number(rule.scale), offset: Number(rule.offset) }; })
  });
}

function descriptorsFromSensorium(sensoriumRegistry, adapters) {
  sensoriumRegistry = sensoriumRegistry || {};
  adapters = Array.isArray(adapters) ? adapters : [];
  return (sensoriumRegistry.senses || []).map(function (sense) {
    const capability = sense.capability || (sense.capabilityId + '/' + (sense.capabilityVersion || 'v1'));
    const requiredHostCapabilities = unique(sense.requiredHostCapabilities || []);
    const matchingAdapters = adapters.filter(function (adapter) { return (adapter.capabilities || []).some(function (item) { return item === capability || requiredHostCapabilities.includes(item); }); });
    return {
      capability,
      senseId: sense.id,
      version: sense.capabilityVersion || String(capability).split('/').pop(),
      executorStatus: sense.executorStatus,
      requiredHostCapabilities,
      adapterIds: matchingAdapters.map(function (adapter) { return adapter.adapterId; }),
      authorityRequired: matchingAdapters.some(function (adapter) { return adapter.authorityRequired === true; }),
      requiresReferenceFrame: false,
      constraints: unique(sense.constraints || []),
      resourceBudget: C.clone(sense.resourceBudget || {})
    };
  });
}

function createCapabilityRegistry(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length > 256) throw new Error('capability descriptors must be a bounded array');
  const rows = [], seen = new Set();
  descriptors.forEach(function (descriptor) {
    const capability = C.assertExactIdentifier(descriptor && descriptor.capability, 'capability');
    if (seen.has(capability)) throw new Error('duplicate capability descriptor: ' + capability);
    seen.add(capability);
    rows.push({
      capability,
      senseId: C.assertExactIdentifier(descriptor.senseId, 'senseId'),
      version: C.assertExactIdentifier(descriptor.version || 'v1', 'version'),
      executorStatus: String(descriptor.executorStatus || 'UNKNOWN'),
      requiredHostCapabilities: unique(descriptor.requiredHostCapabilities).map(function (item) { return C.assertExactIdentifier(item, 'host capability'); }),
      adapterIds: unique(descriptor.adapterIds),
      authorityRequired: descriptor.authorityRequired === true,
      requiresReferenceFrame: descriptor.requiresReferenceFrame === true,
      constraints: unique(descriptor.constraints).slice(0, 32),
      resourceBudget: C.clone(descriptor.resourceBudget || {})
    });
  });
  rows.sort(function (a, b) { return a.capability.localeCompare(b.capability); });
  return {
    schema: 'axm.capability-descriptor-registry/v1',
    count: rows.length,
    digest: C.digest(rows),
    list: function () { return C.clone(rows); },
    resolve: function (capability) { const row = rows.find(function (item) { return item.capability === capability; }); return row ? C.clone(row) : null; }
  };
}

function negotiate(input) {
  input = input || {};
  const registry = input.registry, adapters = Array.isArray(input.adapters) ? input.adapters : [];
  const capability = C.assertExactIdentifier(input.capability, 'capability');
  const descriptor = registry && typeof registry.resolve === 'function' ? registry.resolve(capability) : null;
  if (!descriptor) return finish('axm.sensorium-foundation-negotiation/v1', 'UNKNOWN', ['CAPABILITY_DESCRIPTOR_NOT_FOUND'], { capability, descriptor: null, adapterResults: [], authorityGateIntegrated: false });
  const required = descriptor.requiredHostCapabilities || [];
  if (!required.length) return finish('axm.sensorium-foundation-negotiation/v1', 'READY', [], { capability, descriptor, adapterResults: [], authorityGateIntegrated: false, dependencyInstallAttempted: false });
  const adapterResults = required.map(function (hostCapability) {
    const result = Adapter.negotiate({ capability: hostCapability, targetIsolation: input.targetIsolation, repeated: input.repeated === true, cheapestAlternative: 'Supply typed evidence or use a capability that needs no host adapter.' }, adapters);
    const adapter = result.adapterId ? adapters.find(function (item) { return item.adapterId === result.adapterId; }) : null;
    const holds = (result.reasons || []).slice();
    let state = result.state;
    if (adapter && adapter.authorityRequired === true) {
      state = 'BLOCKED';
      holds.push('AUTHORITY_LEASE_GATE_NOT_INTEGRATED');
    }
    if (adapter && input.budget && input.budget.status === 'READY') {
      const declared = adapter.resourceBudget || {};
      if (Number(declared.maxBytes || 0) > input.budget.maxBytes) { state = 'BLOCKED'; holds.push('ADAPTER_BYTES_EXCEED_SESSION_BUDGET'); }
      if (Number(declared.maxThermalC || 0) > input.budget.maxThermalC) { state = 'BLOCKED'; holds.push('ADAPTER_THERMAL_CEILING_EXCEEDS_SESSION_BUDGET'); }
      if (input.repeated === true && input.cadence && Number(input.cadence.intervalMs) < Number(declared.minimumCadenceMs || 0)) { state = 'BLOCKED'; holds.push('ADAPTER_CANNOT_MEET_REQUESTED_CADENCE'); }
    }
    return Object.assign({}, result, { state, reasons: unique(holds).sort(), authorityInherited: false });
  });
  const state = stateOf(adapterResults.map(function (result) { return result.state; }));
  const holds = adapterResults.flatMap(function (result) { return result.reasons || []; });
  return finish('axm.sensorium-foundation-negotiation/v1', state, holds, { capability, descriptor, adapterResults, authorityGateIntegrated: false, dependencyInstallAttempted: false });
}

function preflight(request, options) {
  request = request || {}; options = options || {};
  const requestCheck = validateRequest(request);
  const target = bindTarget(request.target_binding);
  const budget = validateResourceBudget(request.budget_ref);
  const cadence = validateCadence(options.cadence, budget, { repeated: options.repeated === true, atMs: options.atMs, leaseExpiresAtMs: request.observation_lease_expires_at_ms });
  const registry = options.registry || createCapabilityRegistry(options.descriptors || []);
  let descriptor = null;
  try { descriptor = registry.resolve(C.assertExactIdentifier(options.capability, 'capability')); } catch (_) {}
  const referenceFrame = validateReferenceFrame(request.unit_reference_frame_ref, descriptor && descriptor.requiresReferenceFrame === true);
  let negotiation;
  try {
    negotiation = negotiate({ capability: options.capability, registry, adapters: options.adapters, targetIsolation: target.isolation, repeated: options.repeated, cadence, budget });
  } catch (_) {
    negotiation = finish('axm.sensorium-foundation-negotiation/v1', 'BLOCKED', ['INVALID_CAPABILITY_REQUEST'], { capability: null, descriptor: null, adapterResults: [], authorityGateIntegrated: false });
  }
  const components = [requestCheck, target, budget, cadence, referenceFrame, negotiation];
  const status = stateOf(components.map(function (item) { return item.status; }));
  const holds = components.flatMap(function (item) { return item.holds || []; });
  const inputRefDigests = Array.isArray(request.input_refs) ? request.input_refs.slice(0, 32).map(function (item) { return C.digest(String(item)); }) : [];
  const material = {
    requestId: request.request_id || null,
    sessionId: request.session_id || null,
    purpose: C.compact(request.purpose, 500),
    seatId: request.seat_id || null,
    targetBinding: target,
    budget,
    cadence,
    referenceFrame,
    negotiation,
    privacyMode: requestCheck.privacyMode || null,
    inputRefDigests,
    extensionsDigest: request.extensions ? C.digest(request.extensions) : null,
    authoritySummary: { referenceSupplied: Boolean(request.authority_lease_ref), gateIntegrated: false, authorityGranted: false, authorityInherited: false }
  };
  return Object.assign({
    schema: SCHEMA,
    preflightId: 'sensorium-preflight-' + C.digest(material).slice(0, 24),
    status,
    allowedToObserve: status === 'READY',
    holds: unique(holds).sort(),
    sourceContractStatus: 'WORKING_CANDIDATE',
    candidateModuleIds: MODULE_IDS.slice(),
    automaticAction: false,
    automaticInstall: false,
    automaticPromotion: false,
    authorityInherited: false,
    permissionsGranted: [],
    rawRetainedBytes: 0,
    rawRetainedItems: 0,
    cleanupComplete: true,
    allowedEffect: 'bounded-observation-preflight-receipt-only',
    refusedEffects: ['capture', 'observe', 'click', 'write-source', 'publish', 'promote', 'install', 'delete-source', 'grant-authority']
  }, material);
}

module.exports = {
  SCHEMA,
  MODULE_IDS,
  STATES,
  ALLOWED_REQUEST_FIELDS,
  validateRequest,
  bindTarget,
  validateResourceBudget,
  validateCadence,
  validateReferenceFrame,
  descriptorsFromSensorium,
  createCapabilityRegistry,
  negotiate,
  preflight
};

