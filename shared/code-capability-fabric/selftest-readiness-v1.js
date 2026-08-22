#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Readiness = require('./code-capability-readiness-v1');

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

const pair = crypto.generateKeyPairSync('ed25519');
const otherPair = crypto.generateKeyPairSync('ed25519');
const observerKey = {
  schema: Readiness.TRUST_KEY_SCHEMA,
  id: 'local-host-observer',
  algorithm: 'Ed25519',
  publicKeySpkiDerBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
};
const observerRef = Readiness.buildTrustKeyRef(observerKey);
const otherObserverKey = {
  schema: Readiness.TRUST_KEY_SCHEMA,
  id: 'other-host-observer',
  algorithm: 'Ed25519',
  publicKeySpkiDerBase64: otherPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
};
const otherObserverRef = Readiness.buildTrustKeyRef(otherObserverKey);

const boundaryRef = Fabric.buildWorkspaceBoundaryRef({
  schema: Fabric.BOUNDARY_SCHEMA,
  id: 'detached-workspace-boundary',
  sourceRoots: ['sources/private-candidate'],
  outputRoot: 'candidates/run-001',
  evidenceRoot: 'evidence/run-001'
});

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
  evidenceCeiling: 'Opaque references and digests only; no source, stdout, stderr, or machine paths.',
  lineage: { parents: [] }
};

function providerSelector(value) {
  return { id: value.id, version: value.version, descriptorSha256: Fabric.providerDigest(value) };
}

function makeRequest() {
  return {
    schema: Fabric.REQUEST_SCHEMA,
    id: 'inspect-detached-candidate',
    capability: 'code.inspect',
    inputSchema: 'axm.code-source-ref/v1',
    outputSchema: 'axm.code-inspection/v1',
    selection: providerSelector(provider),
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
}

function assuranceSchemas(request) {
  return Array.from(new Set([
    Fabric.RESOURCE_ENFORCEMENT_SCHEMA,
    ...provider.requiredAssuranceSchemas,
    ...request.policy.requiredAssuranceSchemas
  ])).sort();
}

function observation(request, assuranceRefs) {
  return Fabric.sealHostObservation({
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: providerSelector(provider),
    observerRef,
    observedAt: '2026-08-22T09:00:00.000Z',
    expiresAt: '2026-08-22T09:01:00.000Z',
    availability: 'AVAILABLE',
    workspaceBoundaryRef: request.workspaceBoundaryRef,
    executorRef: ref('repaired-disposable-executor', 'axm.executor-reference/v1', 'c'),
    authorityEnvelope: clone(provider.authority),
    resourceEnvelope: clone(provider.resources),
    assuranceRefs
  });
}

function signObservation(hostObservation, keyRef = observerRef, privateKey = pair.privateKey, signedAt = '2026-08-22T09:00:10.000Z') {
  const core = {
    schema: Readiness.OBSERVATION_ATTESTATION_SCHEMA,
    observationRecordDigest: hostObservation.recordDigest,
    keyRef,
    signedAt
  };
  return {
    ...core,
    signatureBase64: crypto.sign(null, Readiness.buildObservationAttestationPayload(core), privateKey).toString('base64')
  };
}

function makeFixture(mutateRecordCore) {
  const request = makeRequest();
  const schemas = assuranceSchemas(request);
  const provisionalRefs = schemas.map((schema, index) => ref('assurance-' + (index + 1), schema, String(index + 1)));
  const provisionalObservation = observation(request, provisionalRefs);
  const provisionalInput = { request, providers: [provider], hostObservations: [provisionalObservation] };
  const provisionalPlan = Fabric.buildRoutePlan(provisionalInput);
  const provisionalSubject = Readiness.buildReadinessSubject(provisionalPlan);
  const subjectDigest = Readiness.sha256(provisionalSubject);
  const assuranceRecords = schemas.map((schema, index) => {
    const core = {
      schema: Readiness.ASSURANCE_RECORD_SCHEMA,
      id: 'assurance-' + (index + 1),
      assuranceSchema: schema,
      subjectDigest,
      verifierRef: observerRef,
      verdict: 'PASS',
      observedAt: '2026-08-22T08:59:59.000Z',
      expiresAt: '2026-08-22T09:01:00.000Z',
      evidenceArtifacts: [{
        id: 'evidence-' + (index + 1),
        schema: 'axm.verification-evidence/v1',
        sha256: digest(String.fromCharCode(100 + index)),
        byteLength: 512 + index
      }],
      authority: 'VERIFY_ONLY'
    };
    if (mutateRecordCore) mutateRecordCore(core, index);
    return Readiness.sealAssuranceRecord(core);
  });
  const hostObservation = observation(request, assuranceRecords.map(Readiness.assuranceRecordRef));
  const routeInput = { request, providers: [provider], hostObservations: [hostObservation] };
  const routePlan = Fabric.buildRoutePlan(routeInput);
  const finalSubject = Readiness.buildReadinessSubject(routePlan);
  const input = {
    routePlan,
    routeInput,
    observerKey,
    observationAttestation: signObservation(hostObservation),
    assuranceRecords
  };
  return { input, provisionalSubject, finalSubject };
}

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
      const target = targetFile ? JSON.parse(fs.readFileSync(path.join(__dirname, targetFile), 'utf8')) : current;
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

const schemas = [
  ['code-trust-key.schema.json', Readiness.TRUST_KEY_SCHEMA],
  ['code-host-observation-attestation.schema.json', Readiness.OBSERVATION_ATTESTATION_SCHEMA],
  ['code-external-assurance-record.schema.json', Readiness.ASSURANCE_RECORD_SCHEMA],
  ['code-capability-readiness-subject.schema.json', Readiness.READINESS_SUBJECT_SCHEMA],
  ['code-capability-readiness.schema.json', Readiness.READINESS_SCHEMA]
];
check(schemas.every(([file, id]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schema.$id === id && schema.additionalProperties === false;
}), 'readiness schemas bind exact identities and close top-level fields');
check(schemas.every(([file]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file);
}), 'readiness schema object nodes are closed and every local reference resolves');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-readiness-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0,
  'readiness contract remains permissionless, write-free TEST');
check(['provider-code-execution', 'executor-authorization', 'trust-key-promotion', 'automatic-canon']
  .every((item) => contract.boundaries.refuses.includes(item)), 'readiness authority ceiling is explicit');
const readinessSource = fs.readFileSync(path.join(__dirname, 'code-capability-readiness-v1.js'), 'utf8');
check(!/require\(['"](?:fs|child_process|http|https|net|worker_threads)['"]\)/.test(readinessSource),
  'readiness implementation imports no filesystem, process, worker, or network capability');

const fixture = makeFixture();
const ready = Readiness.assessExecutionReadiness(fixture.input);
check(ready.status === 'AUTHORIZATION_REQUIRED' && ready.authority === 'NONE' && ready.holds.length === 0,
  'valid signed evidence reaches the human authorization gate and no further');
check(ready.nextGate === 'MIKE_DECISION_AND_REPAIRED_DISPOSABLE_SANDBOX_EXECUTOR',
  'the next gate names Mike and the still-missing repaired sandbox executor');
check(ready.truth.routePlanVerified && ready.truth.hostObservationSignatureVerified &&
  ready.truth.assuranceRecordIntegrityVerified && ready.truth.assuranceScopeVerified &&
  ready.truth.assurancePassVerdictsAccepted, 'readiness truth records only checks actually performed');
check(!ready.truth.resourceEnforcementObserved && !ready.truth.executorAuthorized &&
  !ready.truth.providerCodeLoaded && !ready.truth.providerCodeExecuted &&
  !ready.truth.workspaceContentRead && !ready.truth.permissionGranted && !ready.truth.networkUsed &&
  !ready.truth.outputWritten && !ready.truth.installed && !ready.truth.promoted && !ready.truth.canonChanged,
  'readiness truth ceiling refuses execution, authority, resource-observation, and lifecycle claims');
check(Readiness.normalizeAssessment(ready).readinessDigest === ready.readinessDigest,
  'readiness output passes strict standalone validation');
check(Readiness.verifyReadinessAssessment(ready, fixture.input).pass,
  'readiness output verifies against an exact deterministic rebuild');
check(Readiness.canonicalJson(fixture.provisionalSubject) === Readiness.canonicalJson(fixture.finalSubject),
  'readiness subject avoids the assurance-reference hash cycle without losing execution scope');

const reversedInput = clone(fixture.input);
reversedInput.assuranceRecords.reverse();
const reversed = Readiness.assessExecutionReadiness(reversedInput);
check(reversed.readinessDigest === ready.readinessDigest, 'assurance record input ordering cannot alter readiness bytes');

const damagedPlan = clone(fixture.input);
damagedPlan.routePlan.planDigest = digest('f');
check(Readiness.assessExecutionReadiness(damagedPlan).status === 'PLAN_INVALID',
  'forged or damaged route plan is held before trust evaluation');

const driftedInput = clone(fixture.input);
driftedInput.routeInput.request.inputArtifacts[0].byteLength += 1;
check(Readiness.assessExecutionReadiness(driftedInput).status === 'PLAN_INVALID',
  'route input digest or byte-length drift invalidates the deterministic plan proof');

const noRouteInput = { request: makeRequest(), providers: [], hostObservations: [] };
const noRoute = clone(fixture.input);
noRoute.routeInput = noRouteInput;
noRoute.routePlan = Fabric.buildRoutePlan(noRouteInput);
check(Readiness.assessExecutionReadiness(noRoute).status === 'ROUTE_NOT_PLANNED',
  'a valid non-planned route cannot be upgraded by later evidence');

const wrongKey = clone(fixture.input);
wrongKey.observerKey = otherObserverKey;
check(Readiness.assessExecutionReadiness(wrongKey).status === 'OBSERVER_KEY_HOLD',
  'a valid but unreferenced observer key is rejected');

const malformedKey = clone(fixture.input);
malformedKey.observerKey.publicKeySpkiDerBase64 = 'not-base64';
check(Readiness.assessExecutionReadiness(malformedKey).status === 'OBSERVER_KEY_HOLD',
  'malformed public-key bytes produce an explicit observer-key hold');

const extraKeyField = clone(fixture.input);
extraKeyField.observerKey.privateKey = 'forbidden';
check(Readiness.assessExecutionReadiness(extraKeyField).status === 'OBSERVER_KEY_HOLD',
  'unknown trust-key fields are rejected rather than ignored');

const wrongAlgorithm = clone(fixture.input);
wrongAlgorithm.observerKey.algorithm = 'ed25519';
check(Readiness.assessExecutionReadiness(wrongAlgorithm).status === 'OBSERVER_KEY_HOLD',
  'trust-key algorithm spelling is exact and unambiguous');

const wrongAttestationKey = clone(fixture.input);
wrongAttestationKey.observationAttestation = signObservation(
  fixture.input.routePlan.hostObservation,
  otherObserverRef,
  otherPair.privateKey
);
check(Readiness.assessExecutionReadiness(wrongAttestationKey).status === 'OBSERVATION_ATTESTATION_HOLD',
  'an attestation from a different key cannot replace the trusted observer');

const digestDriftAttestation = clone(fixture.input);
digestDriftAttestation.observationAttestation.observationRecordDigest = digest('e');
check(Readiness.assessExecutionReadiness(digestDriftAttestation).status === 'OBSERVATION_ATTESTATION_HOLD',
  'attestation record-digest drift is rejected before signature acceptance');

const expiredSignatureTime = clone(fixture.input);
expiredSignatureTime.observationAttestation = signObservation(
  fixture.input.routePlan.hostObservation,
  observerRef,
  pair.privateKey,
  '2026-08-22T09:01:01.000Z'
);
check(Readiness.assessExecutionReadiness(expiredSignatureTime).status === 'OBSERVATION_ATTESTATION_HOLD',
  'signature timestamps outside the observation window are rejected');

const futureSignatureTime = clone(fixture.input);
futureSignatureTime.observationAttestation = signObservation(
  fixture.input.routePlan.hostObservation,
  observerRef,
  pair.privateKey,
  '2026-08-22T09:00:40.000Z'
);
check(Readiness.assessExecutionReadiness(futureSignatureTime).status === 'OBSERVATION_ATTESTATION_HOLD',
  'signatures later than the route evaluation instant are rejected even inside the observation window');

const tamperedSignature = clone(fixture.input);
tamperedSignature.observationAttestation.signatureBase64 = Buffer.alloc(64, 7).toString('base64');
check(Readiness.assessExecutionReadiness(tamperedSignature).status === 'OBSERVATION_ATTESTATION_HOLD',
  'cryptographically invalid observation signatures are rejected');

const wrongSigner = clone(fixture.input);
wrongSigner.observationAttestation = signObservation(
  fixture.input.routePlan.hostObservation,
  observerRef,
  otherPair.privateKey
);
check(Readiness.assessExecutionReadiness(wrongSigner).status === 'OBSERVATION_ATTESTATION_HOLD',
  'matching key metadata cannot hide a signature from the wrong private key');

const extraAttestationField = clone(fixture.input);
extraAttestationField.observationAttestation.note = 'ignore me';
check(Readiness.assessExecutionReadiness(extraAttestationField).status === 'OBSERVATION_ATTESTATION_HOLD',
  'unknown attestation fields are rejected rather than unsigned');

const missingAssurance = clone(fixture.input);
missingAssurance.assuranceRecords.pop();
check(Readiness.assessExecutionReadiness(missingAssurance).status === 'ASSURANCE_RECORD_HOLD',
  'missing assurance content cannot satisfy an opaque signed reference');

const duplicateAssurance = clone(fixture.input);
duplicateAssurance.assuranceRecords.push(clone(duplicateAssurance.assuranceRecords[0]));
check(Readiness.assessExecutionReadiness(duplicateAssurance).status === 'ASSURANCE_RECORD_HOLD',
  'duplicate assurance records are rejected');

const duplicateAssuranceIdFixture = makeFixture((core, index) => {
  if (index === 1) core.id = 'assurance-1';
});
check(Readiness.assessExecutionReadiness(duplicateAssuranceIdFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'assurance identifiers must remain unique even across different schemas');

const driftedAssurance = clone(fixture.input);
driftedAssurance.assuranceRecords[0].recordDigest = digest('9');
check(Readiness.assessExecutionReadiness(driftedAssurance).status === 'ASSURANCE_RECORD_HOLD',
  'assurance record digest drift is rejected');

const extraAssuranceField = clone(fixture.input);
extraAssuranceField.assuranceRecords[0].stdout = 'private material';
check(Readiness.assessExecutionReadiness(extraAssuranceField).status === 'ASSURANCE_RECORD_HOLD',
  'malformed assurance records cannot smuggle private stdout or extra fields');

const noEvidence = clone(fixture.input);
noEvidence.assuranceRecords[0].evidenceArtifacts = [];
check(Readiness.assessExecutionReadiness(noEvidence).status === 'ASSURANCE_RECORD_HOLD',
  'assurance records require byte-bound evidence references');

const badEvidenceLength = clone(fixture.input);
badEvidenceLength.assuranceRecords[0].evidenceArtifacts[0].byteLength = 0;
check(Readiness.assessExecutionReadiness(badEvidenceLength).status === 'ASSURANCE_RECORD_HOLD',
  'zero-length evidence artifacts are rejected');

const duplicateEvidence = clone(fixture.input);
duplicateEvidence.assuranceRecords[0].evidenceArtifacts.push(clone(duplicateEvidence.assuranceRecords[0].evidenceArtifacts[0]));
check(Readiness.assessExecutionReadiness(duplicateEvidence).status === 'ASSURANCE_RECORD_HOLD',
  'duplicate byte-bound evidence references are rejected');

const wrongSubjectFixture = makeFixture((core, index) => {
  if (index === 0) core.subjectDigest = digest('7');
});
check(Readiness.assessExecutionReadiness(wrongSubjectFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'signed assurance content for a different readiness subject is rejected');

const wrongVerifierFixture = makeFixture((core, index) => {
  if (index === 0) core.verifierRef = otherObserverRef;
});
check(Readiness.assessExecutionReadiness(wrongVerifierFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'assurance verifier must bind to the signed trusted observer');

const staleAssuranceFixture = makeFixture((core, index) => {
  if (index === 0) core.expiresAt = '2026-08-22T09:00:20.000Z';
});
check(Readiness.assessExecutionReadiness(staleAssuranceFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'stale assurance records are rejected at the route evaluation instant');

const futureAssuranceFixture = makeFixture((core, index) => {
  if (index === 0) core.observedAt = '2026-08-22T09:00:31.000Z';
});
check(Readiness.assessExecutionReadiness(futureAssuranceFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'future-dated assurance records are rejected');

const postSignatureAssuranceFixture = makeFixture((core, index) => {
  if (index === 0) core.observedAt = '2026-08-22T09:00:20.000Z';
});
check(Readiness.assessExecutionReadiness(postSignatureAssuranceFixture.input).status === 'ASSURANCE_RECORD_HOLD',
  'an assurance record cannot claim observation after the signature that authenticates it');

const failedAssuranceFixture = makeFixture((core, index) => {
  if (index === 0) core.verdict = 'FAIL';
});
check(Readiness.assessExecutionReadiness(failedAssuranceFixture.input).status === 'ASSURANCE_VERDICT_HOLD',
  'an authenticated FAIL verdict remains a hold');

const unknownAssuranceFixture = makeFixture((core, index) => {
  if (index === 0) core.verdict = 'UNKNOWN';
});
check(Readiness.assessExecutionReadiness(unknownAssuranceFixture.input).status === 'ASSURANCE_VERDICT_HOLD',
  'uncertainty is preserved instead of promoted to PASS');

const tamperedOutput = clone(ready);
tamperedOutput.authority = 'EXECUTE';
check(!Readiness.verifyReadinessAssessment(tamperedOutput, fixture.input).pass,
  'a readiness record cannot be mutated into execution authority');

const liedOutput = clone(ready);
liedOutput.truth.providerCodeExecuted = true;
const liedCore = clone(liedOutput);
delete liedCore.readinessDigest;
liedOutput.readinessDigest = Readiness.sha256(liedCore);
check(!Readiness.verifyReadinessAssessment(liedOutput, fixture.input).pass,
  'even a recomputed digest cannot raise the readiness-only truth ceiling');

rejects(() => Readiness.assessExecutionReadiness({ ...fixture.input, execute: true }), /unsupported fields/,
  'top-level execution requests are rejected as malformed readiness input');
rejects(() => Readiness.sealAssuranceRecord({
  schema: Readiness.ASSURANCE_RECORD_SCHEMA,
  id: 'bad-assurance',
  assuranceSchema: Fabric.RESOURCE_ENFORCEMENT_SCHEMA,
  subjectDigest: ready.readinessSubjectDigest,
  verifierRef: observerRef,
  verdict: 'PASS',
  observedAt: '2026-08-22T09:00:00.000Z',
  expiresAt: '2026-08-22T09:01:00.000Z',
  evidenceArtifacts: [{ id: 'evidence', schema: 'axm.evidence/v1', sha256: digest('a'), byteLength: 1 }],
  authority: 'EXECUTE'
}), /VERIFY_ONLY/, 'assurance records cannot acquire execution authority');

console.log('Code Capability Fabric readiness v1 selftest: ' + checks + ' checks passed');
