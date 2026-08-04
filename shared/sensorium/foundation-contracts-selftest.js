#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Foundation = require('./foundation-contracts');
const Sensorium = require('./index');
const registrySource = require('./registry.json');
const adapters = require('./canonical/adapters.json').adapters;

function budget(overrides) {
  return Object.assign({
    budget_id: 'budget-test',
    max_bytes: 65536,
    max_items: 20,
    minimum_cadence_ms: 1000,
    max_duration_ms: 60000,
    max_cpu_percent: 20,
    max_gpu_percent: 10,
    max_memory_bytes: 16777216,
    max_battery_percent: 5,
    max_thermal_c: 82,
    max_network_bytes: 0
  }, overrides || {});
}
function request(overrides) {
  return Object.assign({
    request_id: 'request-test',
    session_id: 'session-test',
    purpose: 'Verify one bounded typed observation.',
    seat_id: 'seat-test',
    target_binding: { target_id: 'target-test', kind: 'ENVIRONMENT', isolation: 'EXACT_DECLARED_ITEMS', isolation_proven: true, scope: 'declared-items-only' },
    budget_ref: budget(),
    input_refs: ['input:fixture'],
    privacy_mode: 'INTERNAL_TYPED_ONLY',
    action_requested: false,
    publish_requested: false,
    install_requested: false,
    delete_requested: false,
    canon_requested: false
  }, overrides || {});
}

const descriptors = Foundation.descriptorsFromSensorium(registrySource, adapters);
const registry = Foundation.createCapabilityRegistry(descriptors);
assert.equal(descriptors.length, 13);
assert.equal(registry.count, 13);
assert.equal(registry.resolve('sense.time.ttl/v1').senseId, 'time-sense-ttl-verifier');
assert.equal(Sensorium.foundation, Foundation);
assert.deepEqual(Foundation.MODULE_IDS.slice().sort(), [
  'axm.sense.cadence-duration-controller',
  'axm.sense.capability-descriptor-registry',
  'axm.sense.host-adapter-negotiator',
  'axm.sense.observation-session-envelope',
  'axm.sense.resource-budget-contract',
  'axm.sense.target-identity-binder',
  'axm.sense.unit-reference-frame-contract'
]);

const target = Foundation.bindTarget(request().target_binding);
assert.equal(target.status, 'READY');
assert.equal(target.isolationProven, true);
assert.equal(target.identityInferred, false);
assert.equal(Foundation.bindTarget({ target_id: '*', kind: 'FILE', isolation: 'EXACT_FILE', isolation_proven: true, scope: 'one-file' }).status, 'BLOCKED');
assert.equal(Foundation.bindTarget({ target_id: 'person-1', kind: 'PERSON_CONSENTED_SOURCE', isolation: 'EXACT_SOURCE', isolation_proven: true, scope: 'voice' }).status, 'BLOCKED');

const acceptedBudget = Foundation.validateResourceBudget(budget());
assert.equal(acceptedBudget.status, 'READY');
assert.equal(acceptedBudget.networkDefaultDenied, true);
assert.equal(Foundation.validateResourceBudget(budget({ max_cpu_percent: 101 })).status, 'BLOCKED');
assert.equal(Foundation.validateCadence(null, acceptedBudget, { repeated: false }).status, 'READY');
assert.equal(Foundation.validateCadence({ interval_ms: 1000, duration_ms: 5000, max_samples: 5 }, acceptedBudget, { repeated: true, atMs: 1000, leaseExpiresAtMs: 7000 }).status, 'READY');
assert.equal(Foundation.validateCadence({ interval_ms: 100, duration_ms: 5000, max_samples: 50 }, acceptedBudget, { repeated: true, atMs: 1000, leaseExpiresAtMs: 2000 }).status, 'BLOCKED');

const frame = {
  frame_id: 'viewport-css-pixels', units: { x: 'css-px', y: 'css-px', time: 'ms' }, axes: ['x', 'y'], origin: 'declared-root-top-left',
  orientation: 'x-right-y-down', timestamp_basis: 'host-monotonic', calibration_state: 'NOT_APPLICABLE', conversion_rules: [{ from: 'css-px', to: 'css-px', scale: 1, offset: 0 }]
};
assert.equal(Foundation.validateReferenceFrame(frame, true).status, 'READY');
assert.equal(Foundation.validateReferenceFrame(null, true).status, 'BLOCKED');

const timeReady = Foundation.preflight(request(), { capability: 'sense.time.ttl/v1', registry, adapters });
assert.equal(timeReady.status, 'READY');
assert.equal(timeReady.allowedToObserve, true);
assert.equal(timeReady.rawRetainedBytes, 0);
assert.equal(timeReady.authoritySummary.gateIntegrated, false);
assert.deepEqual(timeReady.permissionsGranted, []);

const touchReady = Foundation.preflight(request(), { capability: 'sense.environment.touch/v1', registry, adapters });
assert.equal(touchReady.status, 'READY');
assert.equal(touchReady.negotiation.adapterResults[0].adapterId, 'exact-environment-probe');

const accessibilityReady = Foundation.preflight(request({
  target_binding: { target_id: 'root-main', kind: 'DECLARED_DOM_ROOT', isolation: 'EXACT_DECLARED_DOM_ROOT', isolation_proven: true, scope: 'declared-root-only' },
  budget_ref: budget({ max_bytes: 0, minimum_cadence_ms: 1000 })
}), { capability: 'visual.inspect.accessibility/v1', registry, adapters });
assert.equal(accessibilityReady.status, 'READY');
assert.equal(accessibilityReady.negotiation.adapterResults[0].adapterId, 'browser-computed-style-reader');

const authorityBlocked = Foundation.preflight(request({
  target_binding: { target_id: 'process-stream', kind: 'STREAM', isolation: 'EXACT_STREAM', isolation_proven: true, scope: 'named-stream-only' },
  budget_ref: budget({ max_bytes: 512000, minimum_cadence_ms: 1000 }),
  authority_lease_ref: 'lease-supplied-but-not-trusted'
}), { capability: 'sense.hearing.bounded-stream/v1', registry, adapters });
assert.equal(authorityBlocked.status, 'BLOCKED');
assert.equal(authorityBlocked.allowedToObserve, false);
assert.ok(authorityBlocked.holds.includes('AUTHORITY_LEASE_GATE_NOT_INTEGRATED'));
assert.equal(authorityBlocked.authoritySummary.referenceSupplied, true);
assert.equal(authorityBlocked.authoritySummary.authorityGranted, false);
assert.equal(JSON.stringify(authorityBlocked).includes('lease-supplied-but-not-trusted'), false);

const repeatedReady = Foundation.preflight(request({ observation_lease_expires_at_ms: 7000 }), {
  capability: 'sense.time.ttl/v1', registry, adapters, repeated: true, atMs: 1000,
  cadence: { interval_ms: 1000, duration_ms: 5000, max_samples: 5 }
});
assert.equal(repeatedReady.status, 'READY');
assert.equal(repeatedReady.cadence.maxSamples, 5);

const unknown = Foundation.preflight(request(), { capability: 'sense.smell.unavailable/v1', registry, adapters });
assert.equal(unknown.status, 'UNKNOWN');
assert.equal(unknown.allowedToObserve, false);
const actionBlocked = Foundation.preflight(request({ action_requested: true }), { capability: 'sense.time.ttl/v1', registry, adapters });
assert.equal(actionBlocked.status, 'BLOCKED');
assert.ok(actionBlocked.holds.includes('FORBIDDEN_EFFECT_REQUEST:action_requested'));
const publicBlocked = Foundation.preflight(request({ privacy_mode: 'PUBLIC_SAFE' }), { capability: 'sense.time.ttl/v1', registry, adapters });
assert.equal(publicBlocked.status, 'BLOCKED');
assert.ok(publicBlocked.holds.includes('PUBLIC_SAFE_SEMANTIC_REDACTION_UNPROVEN'));

console.log('Sensorium foundation contracts: PASS - 7 Run 101 candidates adapted into bounded preflight behavior; permission-bearing observation remains blocked');

