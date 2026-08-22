#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(char) {
  return 'sha256:' + char.repeat(64);
}

function ref(id, schema, char) {
  return { id, schema, sha256: digest(char) };
}

function resources(overrides = {}) {
  return {
    maxInputBytes: 1048576,
    maxOutputBytes: 262144,
    maxMemoryBytes: 67108864,
    maxDurationMs: 10000,
    maxProcesses: 1,
    ...overrides
  };
}

const boundaryDeclaration = {
  schema: Fabric.BOUNDARY_SCHEMA,
  id: 'detached-workspace-boundary',
  sourceRoots: ['sources/private-candidate'],
  outputRoot: 'candidates/run-001',
  evidenceRoot: 'evidence/run-001'
};
const boundaryRef = Fabric.buildWorkspaceBoundaryRef(boundaryDeclaration);
const observerRef = ref('local-host-observer', 'axm.host-observer-identity/v1', 'a');

const provider = {
  schema: Fabric.PROVIDER_SCHEMA,
  id: 'node-static-inspector',
  version: '1.0.0',
  status: 'TEST',
  routes: [{
    capability: 'code.inspect',
    inputSchema: 'axm.code-source-ref/v1',
    outputSchema: 'axm.code-inspection/v1',
    minimumInputArtifacts: 1
  }],
  authority: {
    permissions: ['storage.read'],
    network: { mode: 'disabled', domains: [] },
    mutability: 'read-only',
    sourceUse: 'inspect-only'
  },
  resources: resources(),
  requiresWorkspaceBoundary: true,
  requiredAssuranceSchemas: [
    'axm.private-evidence-policy/v1',
    'axm.source-output-disjointness-verification/v1'
  ],
  executionBoundary: 'external-explicit-executor',
  evidenceCeiling: 'Opaque references, artifact sizes, and digests only; no content, path, execution, or semantic correctness.',
  lineage: { parents: [] }
};

const request = {
  schema: Fabric.REQUEST_SCHEMA,
  id: 'inspect-detached-candidate',
  capability: 'code.inspect',
  inputSchema: 'axm.code-source-ref/v1',
  outputSchema: 'axm.code-inspection/v1',
  selection: null,
  inputArtifacts: [{
    id: 'detached-source-bundle',
    schema: 'axm.code-source-bundle/v1',
    sha256: digest('b'),
    byteLength: 4096
  }],
  workspaceBoundaryRef: boundaryRef,
  reuseRights: { mode: 'RESEARCH_ONLY', authorityRef: null },
  policy: {
    authority: 'PLAN_ONLY',
    allowedPermissions: ['storage.read'],
    allowedNetworkDomains: [],
    allowedMutability: ['read-only'],
    allowedSourceUse: ['inspect-only'],
    resourceCeilings: resources({
      maxInputBytes: 2097152,
      maxOutputBytes: 524288,
      maxMemoryBytes: 134217728,
      maxDurationMs: 20000,
      maxProcesses: 2
    }),
    observation: {
      evaluatedAt: '2026-08-22T09:00:30.000Z',
      maximumAgeMs: 60000,
      trustedObserverRefs: [observerRef],
      selectedRecordDigest: null
    },
    requiredAssuranceSchemas: []
  }
};

function providerSelector(value) {
  return { id: value.id, version: value.version, descriptorSha256: Fabric.providerDigest(value) };
}

function assuranceRefs(value, requestValue = request) {
  return Array.from(new Set([
    Fabric.RESOURCE_ENFORCEMENT_SCHEMA,
    ...value.requiredAssuranceSchemas,
    ...requestValue.policy.requiredAssuranceSchemas
  ])).sort().map((schema, index) => ref('assurance-' + (index + 1), schema, String(index + 1)));
}

function observation(value, overrides = {}, requestValue = request) {
  const core = {
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: providerSelector(value),
    observerRef,
    observedAt: '2026-08-22T09:00:00.000Z',
    expiresAt: '2026-08-22T09:01:00.000Z',
    availability: 'AVAILABLE',
    workspaceBoundaryRef: requestValue.workspaceBoundaryRef,
    executorRef: ref('explicit-local-executor', 'axm.executor-reference/v1', 'c'),
    authorityEnvelope: clone(value.authority),
    resourceEnvelope: clone(value.resources),
    assuranceRefs: assuranceRefs(value, requestValue),
    ...overrides
  };
  return Fabric.sealHostObservation(core);
}

const v2Schemas = [
  ['code-capability-provider-v2.schema.json', Fabric.PROVIDER_SCHEMA],
  ['code-capability-request-v2.schema.json', Fabric.REQUEST_SCHEMA],
  ['code-provider-host-observation-v2.schema.json', Fabric.OBSERVATION_SCHEMA],
  ['code-capability-route-plan-v2.schema.json', Fabric.PLAN_SCHEMA],
  ['code-workspace-boundary-declaration.schema.json', Fabric.BOUNDARY_SCHEMA]
];
function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}
function localSchemaRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, current) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current));
    if (typeof value.$ref === 'string') {
      const [targetFile, fragment] = value.$ref.split('#');
      const target = targetFile
        ? JSON.parse(fs.readFileSync(path.join(__dirname, targetFile), 'utf8'))
        : current;
      if (fragment) {
        const parts = fragment.replace(/^\//, '').split('/').filter(Boolean);
        let cursor = target;
        for (const part of parts) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        if (cursor === undefined) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current));
  }
  return visit(schema, schema);
}
check(v2Schemas.every(([file, id]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schema.$id === id && schema.additionalProperties === false;
}), 'v2 and workspace-boundary schemas bind exact identities and close top-level fields');
check(v2Schemas.every(([file]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file);
}), 'v2 schema object nodes are closed and every local schema reference resolves');
check([
  ['code-capability-provider.schema.json', 'axm.code-capability-provider/v1'],
  ['code-capability-request.schema.json', 'axm.code-capability-request/v1'],
  ['code-provider-host-observation.schema.json', 'axm.code-provider-host-observation/v1'],
  ['code-capability-route-plan.schema.json', 'axm.code-capability-route-plan/v1']
].every(([file, id]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === id),
'v1 intake schemas remain available as immutable historical contracts');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-v2.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract remains permissionless TEST');
check(contract.boundaries.writes.length === 0, 'contract declares no writes');
check(['provider-code-execution', 'permission-grant', 'automatic-install', 'automatic-canon']
  .every((item) => contract.boundaries.refuses.includes(item)), 'authority ceiling remains explicit');

const plannedInput = { request, providers: [provider], hostObservations: [observation(provider)] };
const planned = Fabric.buildRoutePlan(plannedInput);
check(planned.status === 'ROUTE_PLANNED', 'one exact provider and bounded host observation produce a route plan');
check(planned.selected.descriptorSha256 === Fabric.providerDigest(provider), 'route binds the canonical descriptor contract');
check(planned.request.inputArtifacts[0].sha256 === digest('b') && planned.request.inputArtifacts[0].byteLength === 4096,
  'input lineage is bound to declared artifact bytes and byte length');
check(planned.plannedEnvelope.resources.maxMemoryBytes === provider.resources.maxMemoryBytes,
  'planned resources use the provider minimum rather than the broader request ceiling');
check(planned.truth.providerCodeExecuted === false && planned.truth.resourceEnforcementProven === false &&
  planned.truth.externalAssurancesVerified === false && planned.truth.inputArtifactBytesProven === false &&
  planned.truth.hostObserverAuthenticityProven === false && planned.authority === 'NONE',
  'route distinguishes planning, resource declarations, and proven execution');
check(planned.truth.rawInputContentRetained === false && planned.truth.machinePathsRetained === false &&
  !Fabric.canonicalJson(planned).includes('sources/private-candidate') &&
  !Fabric.canonicalJson(planned).includes(provider.evidenceCeiling),
  'route retains opaque boundary and evidence-policy digests rather than content or machine paths');
check(Fabric.normalizeRoutePlan(planned).planDigest === planned.planDigest, 'emitted route plan passes strict standalone validation');
check(Fabric.verifyRoutePlan(planned, plannedInput).pass, 'route plan verifies against an exact deterministic rebuild');

const reorderedProvider = clone(provider);
reorderedProvider.requiredAssuranceSchemas.reverse();
const reorderedRequest = clone(request);
reorderedRequest.policy.allowedPermissions.reverse();
const reorderedObservation = observation(reorderedProvider, {}, reorderedRequest);
const reordered = Fabric.buildRoutePlan({
  request: reorderedRequest,
  providers: [reorderedProvider],
  hostObservations: [reorderedObservation]
});
check(reordered.planDigest === planned.planDigest, 'set ordering does not alter deterministic plan bytes');

const missing = Fabric.buildRoutePlan({ request, providers: [], hostObservations: [] });
check(missing.status === 'MISSING_HAND', 'missing provider is explicit');
const declaredOnly = Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [] });
check(declaredOnly.status === 'HOST_OBSERVATION_REQUIRED', 'provider declaration is not availability evidence');

const providerTwo = clone(provider);
providerTwo.id = 'portable-static-inspector';
const multiple = Fabric.buildRoutePlan({
  request,
  providers: [providerTwo, provider],
  hostObservations: [observation(provider), observation(providerTwo)]
});
check(multiple.status === 'SELECTION_REQUIRED' && multiple.selected === null, 'ambiguous providers require explicit exact selection');

const providerVersionTwo = clone(provider);
providerVersionTwo.version = '2.0.0';
providerVersionTwo.lineage.parents = [providerSelector(provider)];
const versionAmbiguous = Fabric.buildRoutePlan({
  request,
  providers: [providerVersionTwo, provider],
  hostObservations: [observation(provider), observation(providerVersionTwo)]
});
check(versionAmbiguous.status === 'SELECTION_REQUIRED' && versionAmbiguous.candidates.length === 2,
  'multiple versions remain visible instead of being rejected or silently ranked');
const exactVersionRequest = clone(request);
exactVersionRequest.selection = providerSelector(providerVersionTwo);
const exactVersionObservation = observation(providerVersionTwo, {}, exactVersionRequest);
const exactVersion = Fabric.buildRoutePlan({
  request: exactVersionRequest,
  providers: [providerVersionTwo, provider],
  hostObservations: [observation(provider), exactVersionObservation]
});
check(exactVersion.status === 'ROUTE_PLANNED' && exactVersion.selected.version === '2.0.0' &&
  exactVersion.selected.lineage.parents[0].descriptorSha256 === Fabric.providerDigest(provider),
  'exact version selection preserves byte-bound parent descriptor lineage');

const staleSelectionRequest = clone(exactVersionRequest);
staleSelectionRequest.selection.descriptorSha256 = digest('d');
const staleSelection = Fabric.buildRoutePlan({
  request: staleSelectionRequest,
  providers: [providerVersionTwo],
  hostObservations: []
});
check(staleSelection.status === 'SELECTED_PROVIDER_STALE', 'selected descriptor digest drift is held');
const incompatibleSelectionRequest = clone(request);
incompatibleSelectionRequest.selection = providerSelector(tupleProviderPlaceholder());
function tupleProviderPlaceholder() {
  const value = clone(provider);
  value.routes = [{
    capability: 'code.transform',
    inputSchema: 'axm.source-b/v1',
    outputSchema: 'axm.output-b/v1',
    minimumInputArtifacts: 1
  }];
  return value;
}
const incompatibleSelectedProvider = tupleProviderPlaceholder();
check(Fabric.buildRoutePlan({
  request: incompatibleSelectionRequest,
  providers: [incompatibleSelectedProvider],
  hostObservations: []
}).status === 'SELECTED_PROVIDER_UNAVAILABLE', 'an exact but incompatible provider is unavailable rather than mislabeled stale');

const staleObservationCore = clone(observation(provider));
delete staleObservationCore.recordDigest;
staleObservationCore.provider.descriptorSha256 = digest('d');
const staleObservation = Fabric.sealHostObservation(staleObservationCore);
const staleHost = Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [staleObservation] });
check(staleHost.status === 'HOST_OBSERVATION_STALE', 'host observation descriptor drift is held');

const expiredObservation = observation(provider, {
  observedAt: '2026-08-22T08:58:00.000Z',
  expiresAt: '2026-08-22T08:59:00.000Z'
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [expiredObservation] }).status === 'HOST_OBSERVATION_STALE',
  'expired host observations are held using explicit evaluation time');
const futureObservation = observation(provider, {
  observedAt: '2026-08-22T09:00:45.000Z',
  expiresAt: '2026-08-22T09:01:45.000Z'
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [futureObservation] }).status === 'HOST_OBSERVATION_STALE',
  'future-dated host observations are held');

const forgedObservation = clone(observation(provider));
forgedObservation.availability = 'UNAVAILABLE';
rejects(() => Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [forgedObservation] }),
  /record digest mismatch/i, 'tampered observation content is rejected by its self-binding digest');
const untrustedObservation = observation(provider, {
  observerRef: ref('untrusted-observer', 'axm.host-observer-identity/v1', 'e')
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [untrustedObservation] }).status === 'HOST_OBSERVATION_UNTRUSTED',
  'observer references outside the explicit trust policy are held');

const newerObservation = observation(provider, {
  observedAt: '2026-08-22T09:00:10.000Z',
  expiresAt: '2026-08-22T09:01:10.000Z'
});
const ambiguousObservation = Fabric.buildRoutePlan({
  request,
  providers: [provider],
  hostObservations: [observation(provider), newerObservation]
});
check(ambiguousObservation.status === 'HOST_OBSERVATION_AMBIGUOUS', 'multiple observations are never silently ranked');
const selectedObservationRequest = clone(request);
selectedObservationRequest.policy.observation.selectedRecordDigest = newerObservation.recordDigest;
const selectedObservation = Fabric.buildRoutePlan({
  request: selectedObservationRequest,
  providers: [provider],
  hostObservations: [observation(provider), newerObservation]
});
check(selectedObservation.status === 'ROUTE_PLANNED' && selectedObservation.hostObservation.recordDigest === newerObservation.recordDigest,
  'an exact observation digest resolves observation ambiguity');

const unavailable = observation(provider, { availability: 'UNAVAILABLE', executorRef: null, assuranceRefs: [] });
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [unavailable] }).status === 'HOST_UNAVAILABLE',
  'host unavailability remains separate from declared capability');

const noBoundaryRequest = clone(request);
noBoundaryRequest.workspaceBoundaryRef = null;
const noBoundaryObservation = observation(provider, { workspaceBoundaryRef: null }, noBoundaryRequest);
check(Fabric.buildRoutePlan({ request: noBoundaryRequest, providers: [provider], hostObservations: [noBoundaryObservation] }).status === 'BOUNDARY_HOLD',
  'workspace providers require an exact source/output/evidence boundary reference');
const otherBoundary = Fabric.buildWorkspaceBoundaryRef({
  ...boundaryDeclaration,
  id: 'other-workspace-boundary',
  outputRoot: 'candidates/run-002',
  evidenceRoot: 'evidence/run-002'
});
const boundaryMismatch = observation(provider, { workspaceBoundaryRef: otherBoundary });
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [boundaryMismatch] }).status === 'BOUNDARY_HOLD',
  'host and request boundary digest drift is held');

const missingAssuranceRefs = assuranceRefs(provider).slice(1);
const missingAssurance = observation(provider, { assuranceRefs: missingAssuranceRefs });
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [missingAssurance] }).status === 'ASSURANCE_HOLD',
  'missing external assurance references are held');
const extraAssurance = observation(provider, {
  assuranceRefs: [...assuranceRefs(provider), ref('unrequested-assurance', 'axm.unrequested-assurance/v1', 'f')]
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [extraAssurance] }).status === 'ASSURANCE_HOLD',
  'unrequested assurance references cannot silently widen a route record');

const requestPermissionHold = clone(request);
requestPermissionHold.policy.allowedPermissions = [];
check(Fabric.buildRoutePlan({
  request: requestPermissionHold,
  providers: [provider],
  hostObservations: [observation(provider, {}, requestPermissionHold)]
}).status === 'AUTHORITY_HOLD', 'request permission ceiling is enforced');
const hostPermissionNarrow = observation(provider, {
  authorityEnvelope: { ...clone(provider.authority), permissions: [] }
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [hostPermissionNarrow] }).status === 'AUTHORITY_HOLD',
  'missing host permission is held');
const hostPermissionWide = observation(provider, {
  authorityEnvelope: { ...clone(provider.authority), permissions: ['storage.read', 'process.spawn'] }
});
const overbroadAuthority = Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [hostPermissionWide] });
check(overbroadAuthority.status === 'AUTHORITY_HOLD' && overbroadAuthority.holds.some((item) => item.startsWith('HOST_PERMISSION_OVERBROAD')),
  'overbroad host permission is rejected rather than inherited');

const networkProvider = clone(provider);
networkProvider.id = 'network-static-inspector';
networkProvider.authority.network = { mode: 'allowlist', domains: ['api.example.com'] };
const networkRequest = clone(request);
networkRequest.policy.allowedNetworkDomains = ['api.example.com'];
const networkObservation = observation(networkProvider, {}, networkRequest);
check(Fabric.buildRoutePlan({ request: networkRequest, providers: [networkProvider], hostObservations: [networkObservation] }).status === 'ROUTE_PLANNED',
  'exact request/provider/host network intersection can be planned');
const noNetworkRequest = clone(networkRequest);
noNetworkRequest.policy.allowedNetworkDomains = [];
check(Fabric.buildRoutePlan({
  request: noNetworkRequest,
  providers: [networkProvider],
  hostObservations: [observation(networkProvider, {}, noNetworkRequest)]
}).status === 'AUTHORITY_HOLD', 'request network ceiling is enforced');
const wideNetworkObservation = observation(networkProvider, {
  authorityEnvelope: {
    ...clone(networkProvider.authority),
    network: { mode: 'allowlist', domains: ['api.example.com', 'extra.example.com'] }
  }
}, networkRequest);
check(Fabric.buildRoutePlan({ request: networkRequest, providers: [networkProvider], hostObservations: [wideNetworkObservation] }).status === 'AUTHORITY_HOLD',
  'overbroad host network access is rejected');

const lowResourceRequest = clone(request);
lowResourceRequest.policy.resourceCeilings.maxMemoryBytes = provider.resources.maxMemoryBytes - 1;
check(Fabric.buildRoutePlan({
  request: lowResourceRequest,
  providers: [provider],
  hostObservations: [observation(provider, {}, lowResourceRequest)]
}).status === 'RESOURCE_HOLD', 'request resource ceilings are enforced by planning');
const lowHostResources = observation(provider, {
  resourceEnvelope: resources({ maxMemoryBytes: provider.resources.maxMemoryBytes - 1 })
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [lowHostResources] }).status === 'RESOURCE_HOLD',
  'host resource envelope must meet provider needs');
const broadHostResources = observation(provider, {
  resourceEnvelope: resources({ maxMemoryBytes: provider.resources.maxMemoryBytes + 1 })
});
check(Fabric.buildRoutePlan({ request, providers: [provider], hostObservations: [broadHostResources] }).status === 'RESOURCE_HOLD',
  'host resource envelope must be exact rather than silently overbroad');

const copyProvider = clone(provider);
copyProvider.id = 'exact-byte-copy-provider';
copyProvider.authority.sourceUse = 'copy-bytes';
const copyRequest = clone(request);
copyRequest.policy.allowedSourceUse = ['copy-bytes'];
const copyObservation = observation(copyProvider, {}, copyRequest);
check(Fabric.buildRoutePlan({ request: copyRequest, providers: [copyProvider], hostObservations: [copyObservation] }).status === 'REUSE_RIGHTS_HOLD',
  'direct byte reuse remains held under research-only rights');
const rightsRequest = clone(copyRequest);
rightsRequest.reuseRights = {
  mode: 'DECLARED_REUSE_ALLOWED',
  authorityRef: ref('reviewed-reuse-rights', 'axm.reuse-rights-authority/v1', '9')
};
check(Fabric.buildRoutePlan({
  request: rightsRequest,
  providers: [copyProvider],
  hostObservations: [observation(copyProvider, {}, rightsRequest)]
}).status === 'ROUTE_PLANNED', 'an exact declared rights reference can clear the planning hold without proving legal sufficiency');

const tupleProvider = clone(provider);
tupleProvider.routes = [
  { capability: 'code.inspect', inputSchema: 'axm.source-a/v1', outputSchema: 'axm.output-a/v1', minimumInputArtifacts: 1 },
  { capability: 'code.transform', inputSchema: 'axm.source-b/v1', outputSchema: 'axm.output-b/v1', minimumInputArtifacts: 1 }
];
const mixedTupleRequest = clone(request);
mixedTupleRequest.inputSchema = 'axm.source-b/v1';
mixedTupleRequest.outputSchema = 'axm.output-b/v1';
check(Fabric.buildRoutePlan({ request: mixedTupleRequest, providers: [tupleProvider], hostObservations: [] }).status === 'MISSING_HAND',
  'capability routes are matched as tuples rather than an unsafe Cartesian product');
const noArtifactRequest = clone(request);
noArtifactRequest.inputArtifacts = [];
check(Fabric.buildRoutePlan({ request: noArtifactRequest, providers: [provider], hostObservations: [] }).status === 'MISSING_HAND',
  'provider minimum input artifact declarations are enforced');

const safeBoundaryAgain = Fabric.buildWorkspaceBoundaryRef({
  ...boundaryDeclaration,
  sourceRoots: ['sources/zeta', 'sources/alpha']
});
const safeBoundaryReordered = Fabric.buildWorkspaceBoundaryRef({
  ...boundaryDeclaration,
  sourceRoots: ['sources/alpha', 'sources/zeta']
});
check(safeBoundaryAgain.sha256 === safeBoundaryReordered.sha256 && !Fabric.canonicalJson(safeBoundaryAgain).includes('sources/alpha'),
  'workspace boundary reference is deterministic and path-minimizing');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['C:/source'] }), /relative path/i,
  'Windows drive paths are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['\\\\server\\share'] }), /relative path/i,
  'UNC paths are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/file.js:secret'] }), /relative path/i,
  'Windows alternate-data-stream syntax is rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/CON.txt'] }), /reserved device/i,
  'Windows reserved device aliases are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/file.'] }), /non-portable segment/i,
  'trailing-dot aliases are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/file '] }), /non-portable segment/i,
  'trailing-space aliases are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/cafe\u0301'] }), /NFC text/i,
  'Unicode-normalization aliases are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source/../private'] }), /traversal segment/i,
  'path traversal is rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['Source'], outputRoot: 'source/output' }), /overlap/i,
  'case-folded source/output overlap is rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['source', 'source/nested'] }), /overlap/i,
  'nested source aliases are rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, outputRoot: 'candidate', evidenceRoot: 'candidate/evidence' }), /overlap/i,
  'output/evidence overlap is rejected');
rejects(() => Fabric.buildWorkspaceBoundaryRef({ ...boundaryDeclaration, sourceRoots: ['Source', 'source'] }), /duplicates/i,
  'case-folded source collisions are rejected');

rejects(() => Fabric.normalizeProvider({ ...provider, id: 42 }), /must be a string/i,
  'malformed numeric identifiers are rejected rather than coerced');
rejects(() => Fabric.normalizeProvider({ ...provider, version: '01.0.0' }), /strict semantic version/i,
  'ambiguous semantic versions are rejected');
rejects(() => Fabric.normalizeProvider({ ...provider, routes: [] }), /1 to 64 items/i,
  'inert provider descriptors are rejected');
rejects(() => Fabric.normalizeProvider({ ...provider, routes: [provider.routes[0], clone(provider.routes[0])] }), /duplicates/i,
  'duplicate provider route tuples are rejected');
const selfParent = clone(provider);
selfParent.lineage.parents = [{ id: provider.id, version: provider.version, descriptorSha256: digest('8') }];
rejects(() => Fabric.normalizeProvider(selfParent), /same provider version/i,
  'provider lineage cannot self-parent the same semantic version');
rejects(() => Fabric.normalizeRequest({ ...request, inputArtifacts: [request.inputArtifacts[0], clone(request.inputArtifacts[0])] }), /duplicates/i,
  'duplicate artifact byte references are rejected');
const uppercaseArtifact = clone(request);
uppercaseArtifact.inputArtifacts[0].sha256 = 'sha256:' + 'A'.repeat(64);
rejects(() => Fabric.normalizeRequest(uppercaseArtifact), /lowercase SHA-256/i,
  'non-canonical digests are rejected rather than normalized');
const numericTimestamp = clone(request);
numericTimestamp.policy.observation.evaluatedAt = 0;
rejects(() => Fabric.normalizeRequest(numericTimestamp), /canonical UTC timestamp/i,
  'non-string timestamps are rejected');
rejects(() => Fabric.buildRoutePlan({ ...plannedInput, surprise: true }), /unsupported fields/i,
  'undeclared route input fields are rejected');
const duplicateAssuranceObservation = clone(observation(provider));
delete duplicateAssuranceObservation.recordDigest;
duplicateAssuranceObservation.assuranceRefs[1].schema = duplicateAssuranceObservation.assuranceRefs[0].schema;
rejects(() => Fabric.sealHostObservation(duplicateAssuranceObservation), /at most one reference per schema/i,
  'ambiguous assurance records are rejected');

const mutatedPlan = clone(planned);
mutatedPlan.status = 'WORKING';
check(!Fabric.verifyRoutePlan(mutatedPlan, plannedInput).pass, 'tampered plan status is rejected');
const recomputedContradiction = clone(planned);
recomputedContradiction.status = 'AUTHORITY_HOLD';
const contradictionCore = clone(recomputedContradiction);
delete contradictionCore.planDigest;
recomputedContradiction.planDigest = Fabric.sha256(contradictionCore);
rejects(() => Fabric.normalizeRoutePlan(recomputedContradiction), /envelope must exist only/i,
  'self-consistent digest cannot hide contradictory emitted plan fields');
const extraNestedPlan = clone(planned);
extraNestedPlan.request.policy.surprise = true;
const extraNestedCore = clone(extraNestedPlan);
delete extraNestedCore.planDigest;
extraNestedPlan.planDigest = Fabric.sha256(extraNestedCore);
rejects(() => Fabric.normalizeRoutePlan(extraNestedPlan), /unsupported fields/i,
  'strict emitted-record validation rejects unknown nested fields');
rejects(() => Fabric.canonicalJson({ lost: undefined }), /unsupported undefined/i,
  'unsafe JSON state is refused by deterministic-json-core');

process.stdout.write('Code Capability Fabric self-test: ' + checks + ' PASS\n');
