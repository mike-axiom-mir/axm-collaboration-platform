#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const schemas = [
  ['code-capability-provider.schema.json', Fabric.PROVIDER_SCHEMA],
  ['code-capability-request.schema.json', Fabric.REQUEST_SCHEMA],
  ['code-provider-host-observation.schema.json', Fabric.OBSERVATION_SCHEMA],
  ['code-capability-route-plan.schema.json', Fabric.PLAN_SCHEMA]
];
check(schemas.every(([file, id]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schema.$id === id && schema.additionalProperties === false;
}), 'portable schemas bind exact identities and reject extra top-level fields');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract remains permissionless TEST');
check(contract.boundaries.writes.length === 0, 'contract declares no writes');
check(['provider-code-execution', 'permission-grant', 'automatic-install', 'automatic-canon']
  .every((item) => contract.boundaries.refuses.includes(item)), 'authority ceiling is explicit');

const provider = {
  schema: Fabric.PROVIDER_SCHEMA,
  id: 'node-static-inspector',
  version: '1.0.0',
  status: 'TEST',
  capabilities: ['code.inspect'],
  accepts: ['axm.code-source-ref/v1'],
  produces: ['axm.code-inspection/v1'],
  permissions: ['storage.read'],
  network: { mode: 'disabled', domains: [] },
  mutability: 'read-only',
  executionBoundary: 'external-explicit-executor',
  evidenceCeiling: 'File inventory and digests only; no semantic or runtime correctness.'
};
const providerTwo = { ...provider, id: 'portable-static-inspector', version: '1.1.0' };
const request = {
  schema: Fabric.REQUEST_SCHEMA,
  id: 'inspect-detached-candidate',
  capability: 'code.inspect',
  inputSchema: 'axm.code-source-ref/v1',
  outputSchema: 'axm.code-inspection/v1',
  preferredProviderId: null,
  policy: {
    authority: 'PLAN_ONLY',
    allowedPermissions: ['storage.read'],
    allowedNetworkDomains: [],
    allowedMutability: ['read-only']
  }
};
function observation(forProvider, overrides = {}) {
  return {
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: {
      id: forProvider.id,
      version: forProvider.version,
      descriptorSha256: Fabric.providerDigest(forProvider)
    },
    observedAt: '2026-08-22T09:00:00.000Z',
    availability: 'AVAILABLE',
    grantedPermissions: ['storage.read'],
    allowedNetworkDomains: [],
    executorRef: {
      id: 'explicit-local-executor',
      schema: 'axm.executor-reference/v1',
      sha256: 'sha256:' + '1'.repeat(64)
    },
    verificationRefs: [{
      id: 'provider-static-verification',
      schema: 'axm.verification-reference/v1',
      sha256: 'sha256:' + '2'.repeat(64)
    }],
    ...overrides
  };
}

const plannedInput = { request, providers: [provider], hostObservations: [observation(provider)] };
const planned = Fabric.buildRoutePlan(plannedInput);
check(planned.status === 'ROUTE_PLANNED', 'one exact available provider produces a route plan');
check(planned.selected.descriptorSha256 === Fabric.providerDigest(provider), 'route binds the canonical descriptor contract');
check(planned.truth.providerCodeExecuted === false && planned.authority === 'NONE', 'plan grants no runtime authority');
check(Fabric.verifyRoutePlan(planned, plannedInput).pass, 'route plan rebuild verifies exactly');

const missing = Fabric.buildRoutePlan({ ...plannedInput, providers: [] });
check(missing.status === 'MISSING_HAND', 'missing provider is explicit');

const multiple = Fabric.buildRoutePlan({
  request,
  providers: [providerTwo, provider],
  hostObservations: [observation(provider), observation(providerTwo)]
});
check(multiple.status === 'SELECTION_REQUIRED' && multiple.selected === null, 'multiple providers require explicit selection');

const preferredRequest = { ...request, preferredProviderId: providerTwo.id };
const preferred = Fabric.buildRoutePlan({
  request: preferredRequest,
  providers: [providerTwo, provider],
  hostObservations: [observation(provider), observation(providerTwo)]
});
check(preferred.status === 'ROUTE_PLANNED' && preferred.selected.id === providerTwo.id, 'explicit preference selects exact provider');

const staleObservation = observation(provider);
staleObservation.provider.descriptorSha256 = 'sha256:' + '3'.repeat(64);
const stale = Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [staleObservation] });
check(stale.status === 'HOST_OBSERVATION_STALE', 'descriptor drift invalidates host observation');

const permissionRequest = clone(request);
permissionRequest.policy.allowedPermissions = [];
const permissionHold = Fabric.buildRoutePlan({
  request: permissionRequest,
  providers: [provider],
  hostObservations: [observation(provider)]
});
check(permissionHold.status === 'AUTHORITY_HOLD' && permissionHold.holds[0].startsWith('REQUEST_PERMISSION_NOT_ALLOWED'), 'request permission ceiling is enforced');

const mutated = Fabric.clone(planned);
mutated.status = 'WORKING';
check(!Fabric.verifyRoutePlan(mutated, plannedInput).pass, 'tampered plan is rejected');
assert.throws(() => Fabric.canonicalJson({ lost: undefined }), /unsupported undefined/i);
checks += 1;
process.stdout.write('PASS unsafe JSON state is refused\n');
assert.throws(() => Fabric.buildRoutePlan({ ...plannedInput, surprise: true }), /unsupported fields/i);
checks += 1;
process.stdout.write('PASS undeclared route input fields are refused\n');
assert.throws(() => Fabric.normalizeProvider({ ...provider, capabilities: [] }), /at least one capability/i);
checks += 1;
process.stdout.write('PASS inert provider descriptors are refused\n');
assert.throws(() => Fabric.buildRoutePlan({
  request,
  providers: [provider, { ...provider, version: '2.0.0' }],
  hostObservations: []
}), /only one version/i);
checks += 1;
process.stdout.write('PASS ambiguous versions of one provider id are refused\n');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

process.stdout.write('Code Capability Fabric self-test: ' + checks + ' PASS\n');
