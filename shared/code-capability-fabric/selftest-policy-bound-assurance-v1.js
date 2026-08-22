#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Readiness = require('./code-capability-readiness-v1');
const Independent = require('./code-independent-assurance-review-v1');
const Bound = require('./code-policy-bound-assurance-review-v1');

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

function keyEntry(id) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const key = {
    schema: Readiness.TRUST_KEY_SCHEMA,
    id,
    algorithm: 'Ed25519',
    publicKeySpkiDerBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  };
  return { pair, key, ref: Readiness.buildTrustKeyRef(key) };
}

const observer = keyEntry('local-host-observer');
const verifierA = keyEntry('independent-verifier-a');
const verifierB = keyEntry('independent-verifier-b');

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
  requiredAssuranceSchemas: ['axm.private-evidence-policy/v1'],
  executionBoundary: 'external-explicit-executor',
  evidenceCeiling: 'Opaque references and digests only.',
  lineage: { parents: [] }
};

function selector(value) {
  return { id: value.id, version: value.version, descriptorSha256: Fabric.providerDigest(value) };
}

function makeRequest() {
  return {
    schema: Fabric.REQUEST_SCHEMA,
    id: 'inspect-detached-candidate',
    capability: 'code.inspect',
    inputSchema: 'axm.code-source-ref/v1',
    outputSchema: 'axm.code-inspection/v1',
    selection: selector(provider),
    inputArtifacts: [{ id: 'source-bundle', schema: 'axm.code-source-bundle/v1', sha256: digest('b'), byteLength: 4096 }],
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
        trustedObserverRefs: [observer.ref],
        selectedRecordDigest: null
      },
      requiredAssuranceSchemas: []
    }
  };
}

function observation(request, assuranceRefs) {
  return Fabric.sealHostObservation({
    schema: Fabric.OBSERVATION_SCHEMA,
    provider: selector(provider),
    observerRef: observer.ref,
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

function signObservation(hostObservation) {
  const core = {
    schema: Readiness.OBSERVATION_ATTESTATION_SCHEMA,
    observationRecordDigest: hostObservation.recordDigest,
    keyRef: observer.ref,
    signedAt: '2026-08-22T09:00:10.000Z'
  };
  return {
    ...core,
    signatureBase64: crypto.sign(null, Readiness.buildObservationAttestationPayload(core), observer.pair.privateKey).toString('base64')
  };
}

function makeBaseReadiness() {
  const request = makeRequest();
  const assuranceSchemas = [Fabric.RESOURCE_ENFORCEMENT_SCHEMA, ...provider.requiredAssuranceSchemas].sort();
  const provisionalRefs = assuranceSchemas.map((schema, index) => ref('assurance-' + (index + 1), schema, String(index + 1)));
  const provisionalObservation = observation(request, provisionalRefs);
  const provisionalInput = { request, providers: [provider], hostObservations: [provisionalObservation] };
  const provisionalPlan = Fabric.buildRoutePlan(provisionalInput);
  const subjectDigest = Readiness.sha256(Readiness.buildReadinessSubject(provisionalPlan));
  const assuranceRecords = assuranceSchemas.map((schema, index) => Readiness.sealAssuranceRecord({
    schema: Readiness.ASSURANCE_RECORD_SCHEMA,
    id: 'assurance-' + (index + 1),
    assuranceSchema: schema,
    subjectDigest,
    verifierRef: observer.ref,
    verdict: 'PASS',
    observedAt: '2026-08-22T08:59:59.000Z',
    expiresAt: '2026-08-22T09:01:00.000Z',
    evidenceArtifacts: [{
      id: 'evidence-' + (index + 1),
      schema: 'axm.verification-evidence/v1',
      sha256: digest(index === 0 ? 'd' : 'e'),
      byteLength: 512 + index
    }],
    authority: 'VERIFY_ONLY'
  }));
  const hostObservation = observation(request, assuranceRecords.map(Readiness.assuranceRecordRef));
  const routeInput = { request, providers: [provider], hostObservations: [hostObservation] };
  const routePlan = Fabric.buildRoutePlan(routeInput);
  const readinessInput = {
    routePlan,
    routeInput,
    observerKey: observer.key,
    observationAttestation: signObservation(hostObservation),
    assuranceRecords
  };
  return { readinessInput, readinessAssessment: Readiness.assessExecutionReadiness(readinessInput) };
}

function makePolicy(records) {
  return Independent.sealTrustPolicy({
    schema: Independent.TRUST_POLICY_SCHEMA,
    id: 'independent-assurance-policy',
    evaluatedAt: '2026-08-22T09:00:30.000Z',
    validFrom: '2026-08-22T08:55:00.000Z',
    expiresAt: '2026-08-22T09:05:00.000Z',
    rules: records.map((record) => ({
      assuranceSchema: record.assuranceSchema,
      trustedVerifierRefs: [verifierB.ref, verifierA.ref],
      minimumSignatures: 2
    })),
    observerMayCount: false,
    authority: 'REVIEW_ONLY'
  });
}

let base;
function signAssurance(record, policy, key, id) {
  const payload = {
    schema: Independent.ASSURANCE_ATTESTATION_SCHEMA,
    id,
    assuranceRecordRef: Readiness.assuranceRecordRef(record),
    readinessDigest: base.readinessAssessment.readinessDigest,
    trustPolicyDigest: policy.policyDigest,
    keyRef: key.ref,
    signedAt: '2026-08-22T09:00:20.000Z'
  };
  return Independent.sealAssuranceAttestation({
    ...payload,
    signatureBase64: crypto.sign(
      null,
      Independent.buildAssuranceAttestationPayload(payload),
      key.pair.privateKey
    ).toString('base64')
  });
}

base = makeBaseReadiness();
const policy = makePolicy(base.readinessInput.assuranceRecords);
const assuranceAttestations = base.readinessInput.assuranceRecords.flatMap((record, index) => [
  signAssurance(record, policy, verifierA, 'attestation-' + (index + 1) + '-a'),
  signAssurance(record, policy, verifierB, 'attestation-' + (index + 1) + '-b')
]);
const independentReviewInput = {
  readinessInput: base.readinessInput,
  readinessAssessment: base.readinessAssessment,
  trustPolicy: policy,
  verifierKeys: [verifierB.key, verifierA.key],
  assuranceAttestations
};
const independentReview = Independent.assessIndependentAssurance(independentReviewInput);

function bindingCore(overrides = {}) {
  return {
    schema: Bound.POLICY_BINDING_SCHEMA,
    id: 'inspect-request-assurance-policy-binding',
    baseRequestRef: Bound.baseRequestRef(base.readinessInput.routePlan.request),
    trustPolicyRef: Independent.trustPolicyRef(policy),
    assuranceSchemas: policy.rules.map((rule) => rule.assuranceSchema).reverse(),
    rootsGate: Bound.ROOTS_GATE.slice(),
    boundAt: '2026-08-22T09:00:15.000Z',
    expiresAt: '2026-08-22T09:04:00.000Z',
    scope: 'INDEPENDENT_ASSURANCE_REVIEW_ONLY',
    authority: 'NONE',
    ...overrides
  };
}

function resealBinding(binding, mutate) {
  const core = clone(binding);
  delete core.bindingDigest;
  mutate(core);
  return Bound.sealPolicyBinding(core);
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

const schemaFiles = [
  ['code-policy-bound-assurance-request.schema.json', Bound.POLICY_BINDING_SCHEMA],
  ['code-policy-bound-assurance-review.schema.json', Bound.REVIEW_SCHEMA]
];
for (const [file, id] of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  check(schema.$id === id && schema.additionalProperties === false,
    file + ' binds exact identity and closes top-level fields');
  check(schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file),
    file + ' closes object nodes and resolves local references');
}

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-policy-bound-assurance-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0,
  'policy-bound contract remains permissionless, write-free TEST');
check(JSON.stringify(contract.rootsGate) === JSON.stringify(Bound.ROOTS_GATE),
  'the four roots remain the ordered technical acceptance gate');
check(contract.boundaries.refuses.includes('structural-binding-as-requester-authorship-proof') &&
  contract.boundaries.refuses.includes('structural-binding-as-human-acceptance-proof') &&
  contract.boundaries.refuses.includes('structural-binding-as-execution-authorization'),
  'authorship, human acceptance, and execution authority stay separate');

const implementationSource = fs.readFileSync(path.join(__dirname, 'code-policy-bound-assurance-review-v1.js'), 'utf8');
check(!/require\(['"](?:fs|child_process|worker_threads|net|http|https|dgram|tls|cluster)['"]\)/.test(implementationSource) &&
  !/process\./.test(implementationSource),
  'implementation imports no filesystem, process, worker, or network capability');

const baseV2Schema = fs.readFileSync(path.join(__dirname, 'code-capability-request-v2.schema.json'), 'utf8');
check(!baseV2Schema.includes('trustPolicyRef') && !baseV2Schema.includes('policyBinding'),
  'base v2 request remains unchanged and does not pretend to bind the new policy');

const policyBinding = Bound.sealPolicyBinding(bindingCore());
const boundInput = { independentReviewInput, independentReview, policyBinding };
const result = Bound.assessPolicyBoundAssurance(boundInput);
check(result.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' && result.authority === 'NONE',
  'complete structural binding stops at authenticated human decision');
check(result.nextGate === 'MIKE_AUTHENTICATED_POLICY_DECISION_OUTSIDE_FABRIC',
  'Mike remains outside the Fabric as the later human decision gate');
check(result.truth.baseIndependentReviewVerified && result.truth.policyBindingIntegrityVerified &&
  result.truth.baseRequestDigestBound && result.truth.trustPolicyDigestBound &&
  result.truth.assuranceSchemaSetBound && result.truth.rootsGateBound &&
  result.truth.bindingTimeWindowVerified,
  'review truth records each structural binding actually verified');
check(!result.truth.requesterAuthorshipVerified && !result.truth.humanPolicyAcceptanceVerified &&
  !result.truth.organizationalIndependenceProven,
  'structural binding does not become identity, consent, or social proof');
check(!result.truth.executorAuthorized && !result.truth.providerCodeLoaded &&
  !result.truth.providerCodeExecuted && !result.truth.workspaceContentRead &&
  !result.truth.permissionGranted && !result.truth.networkUsed &&
  !result.truth.outputWritten && !result.truth.installed &&
  !result.truth.promoted && !result.truth.canonChanged,
  'review truth ceiling refuses runtime and lifecycle authority');
check(Bound.normalizeReview(result).reviewDigest === result.reviewDigest,
  'policy-bound output passes strict standalone normalization');
check(Bound.verifyPolicyBoundAssuranceReview(result, boundInput).pass,
  'policy-bound output verifies against deterministic rebuild');

const reordered = clone(boundInput);
reordered.policyBinding = Bound.sealPolicyBinding({
  ...bindingCore(),
  assuranceSchemas: clone(policyBinding.assuranceSchemas).reverse()
});
check(Bound.assessPolicyBoundAssurance(reordered).reviewDigest === result.reviewDigest,
  'assurance-schema input ordering cannot alter valid review bytes');

const forgedBase = clone(boundInput);
forgedBase.independentReview.reviewDigest = digest('f');
check(Bound.assessPolicyBoundAssurance(forgedBase).status === 'BASE_REVIEW_HOLD',
  'forged independent review is held before binding evaluation');

const nonterminalBase = clone(boundInput);
nonterminalBase.independentReview = Independent.assessIndependentAssurance({
  ...clone(independentReviewInput),
  assuranceAttestations: clone(independentReviewInput.assuranceAttestations).slice(0, 1)
});
check(Bound.assessPolicyBoundAssurance(nonterminalBase).status === 'BASE_REVIEW_HOLD',
  'a nonterminal base review cannot be upgraded by a policy envelope');

const bindingDigestDrift = clone(boundInput);
bindingDigestDrift.policyBinding.boundAt = '2026-08-22T09:00:16.000Z';
check(Bound.assessPolicyBoundAssurance(bindingDigestDrift).status === 'POLICY_BINDING_HOLD',
  'policy binding digest drift is rejected');

const extraBindingField = clone(boundInput);
extraBindingField.policyBinding.accepted = true;
check(Bound.assessPolicyBoundAssurance(extraBindingField).status === 'POLICY_BINDING_HOLD',
  'unknown acceptance fields cannot enter the binding');

const fakeSignerField = clone(boundInput);
fakeSignerField.policyBinding.requesterSignature = 'not-a-proof';
check(Bound.assessPolicyBoundAssurance(fakeSignerField).status === 'POLICY_BINDING_HOLD',
  'unsigned requester identity claims are rejected rather than trusted');

const wrongRequestDigest = clone(boundInput);
wrongRequestDigest.policyBinding = resealBinding(policyBinding, (core) => { core.baseRequestRef.sha256 = digest('f'); });
check(Bound.assessPolicyBoundAssurance(wrongRequestDigest).status === 'REQUEST_BINDING_HOLD',
  'binding cannot substitute a different base request digest');

const wrongRequestIdentity = clone(boundInput);
wrongRequestIdentity.policyBinding = resealBinding(policyBinding, (core) => { core.baseRequestRef.id = 'other-request'; });
check(Bound.assessPolicyBoundAssurance(wrongRequestIdentity).status === 'REQUEST_BINDING_HOLD',
  'binding cannot substitute a different base request identity');

const changedRequest = clone(base.readinessInput.routePlan.request);
changedRequest.policy.resourceCeilings.maxDurationMs += 1;
check(Bound.baseRequestRef(changedRequest).sha256 !== policyBinding.baseRequestRef.sha256,
  'resource-ceiling drift changes the exact base request reference');

const changedSelection = clone(base.readinessInput.routePlan.request);
changedSelection.selection.descriptorSha256 = digest('f');
check(Bound.baseRequestRef(changedSelection).sha256 !== policyBinding.baseRequestRef.sha256,
  'provider-selection drift changes the exact base request reference');

const wrongPolicyDigest = clone(boundInput);
wrongPolicyDigest.policyBinding = resealBinding(policyBinding, (core) => { core.trustPolicyRef.sha256 = digest('f'); });
check(Bound.assessPolicyBoundAssurance(wrongPolicyDigest).status === 'TRUST_POLICY_BINDING_HOLD',
  'binding cannot substitute a different trust policy digest');

const wrongPolicyIdentity = clone(boundInput);
wrongPolicyIdentity.policyBinding = resealBinding(policyBinding, (core) => { core.trustPolicyRef.id = 'other-policy'; });
check(Bound.assessPolicyBoundAssurance(wrongPolicyIdentity).status === 'TRUST_POLICY_BINDING_HOLD',
  'binding cannot substitute a different trust policy identity');

const missingAssuranceSchema = clone(boundInput);
missingAssuranceSchema.policyBinding = resealBinding(policyBinding, (core) => { core.assuranceSchemas.pop(); });
check(Bound.assessPolicyBoundAssurance(missingAssuranceSchema).status === 'ASSURANCE_SCOPE_HOLD',
  'binding cannot omit a policy assurance schema');

const extraAssuranceSchema = clone(boundInput);
extraAssuranceSchema.policyBinding = resealBinding(policyBinding, (core) => { core.assuranceSchemas.push('axm.unrequested-assurance/v1'); });
check(Bound.assessPolicyBoundAssurance(extraAssuranceSchema).status === 'ASSURANCE_SCOPE_HOLD',
  'binding cannot widen the policy assurance schema set');

rejects(() => Bound.sealPolicyBinding({
  ...bindingCore(),
  assuranceSchemas: [policyBinding.assuranceSchemas[0], policyBinding.assuranceSchemas[0]]
}), /duplicates/, 'duplicate assurance schemas are rejected');

rejects(() => Bound.sealPolicyBinding({
  ...bindingCore(),
  rootsGate: ['agency-non-domination', 'truth', 'continuity', 'wisdom-over-speed']
}), /exact order/, 'root precedence cannot be reordered');

rejects(() => Bound.sealPolicyBinding({
  ...bindingCore(),
  scope: 'EXECUTION'
}), /scope/, 'binding scope cannot expand to execution');

rejects(() => Bound.sealPolicyBinding({
  ...bindingCore(),
  authority: 'EXECUTE'
}), /authority/, 'binding authority cannot rise above NONE');

const retrospective = clone(boundInput);
retrospective.policyBinding = resealBinding(policyBinding, (core) => {
  core.boundAt = '2026-08-22T09:00:31.000Z';
});
check(Bound.assessPolicyBoundAssurance(retrospective).status === 'TIME_WINDOW_HOLD',
  'binding cannot be created retrospectively after evaluation');

const afterAssuranceSignatures = clone(boundInput);
afterAssuranceSignatures.policyBinding = resealBinding(policyBinding, (core) => {
  core.boundAt = '2026-08-22T09:00:21.000Z';
});
check(Bound.assessPolicyBoundAssurance(afterAssuranceSignatures).status === 'TIME_WINDOW_HOLD',
  'binding cannot be created after the assurance signatures it governs');

const expiredAtEvaluation = clone(boundInput);
expiredAtEvaluation.policyBinding = resealBinding(policyBinding, (core) => {
  core.boundAt = '2026-08-22T09:00:00.000Z';
  core.expiresAt = '2026-08-22T09:00:29.000Z';
});
check(Bound.assessPolicyBoundAssurance(expiredAtEvaluation).status === 'TIME_WINDOW_HOLD',
  'binding must remain active at the route evaluation instant');

const exceedsPolicyWindow = clone(boundInput);
exceedsPolicyWindow.policyBinding = resealBinding(policyBinding, (core) => {
  core.expiresAt = '2026-08-22T09:05:01.000Z';
});
check(Bound.assessPolicyBoundAssurance(exceedsPolicyWindow).status === 'TIME_WINDOW_HOLD',
  'binding cannot outlive its trust policy');

const predatesPolicyWindow = clone(boundInput);
predatesPolicyWindow.policyBinding = resealBinding(policyBinding, (core) => {
  core.boundAt = '2026-08-22T08:54:59.000Z';
});
check(Bound.assessPolicyBoundAssurance(predatesPolicyWindow).status === 'TIME_WINDOW_HOLD',
  'binding cannot predate its trust policy window');

rejects(() => Bound.sealPolicyBinding({
  ...bindingCore(),
  boundAt: '2026-08-22T09:00:15.000Z',
  expiresAt: '2026-08-22T09:00:15.000Z'
}), /after boundAt/, 'binding expiry must be later than creation');

const authorityMutation = clone(result);
authorityMutation.authority = 'EXECUTE';
delete authorityMutation.reviewDigest;
authorityMutation.reviewDigest = Bound.sha256(authorityMutation);
rejects(() => Bound.normalizeReview(authorityMutation), /authority/,
  'review output cannot be mutated into execution authority');

const authorshipMutation = clone(result);
authorshipMutation.truth.requesterAuthorshipVerified = true;
delete authorshipMutation.reviewDigest;
authorshipMutation.reviewDigest = Bound.sha256(authorshipMutation);
rejects(() => Bound.normalizeReview(authorshipMutation), /truth ceiling/,
  'even a recomputed digest cannot manufacture requester authorship');

const acceptanceMutation = clone(result);
acceptanceMutation.truth.humanPolicyAcceptanceVerified = true;
delete acceptanceMutation.reviewDigest;
acceptanceMutation.reviewDigest = Bound.sha256(acceptanceMutation);
rejects(() => Bound.normalizeReview(acceptanceMutation), /truth ceiling/,
  'even a recomputed digest cannot manufacture human acceptance');

const socialMutation = clone(result);
socialMutation.truth.organizationalIndependenceProven = true;
delete socialMutation.reviewDigest;
socialMutation.reviewDigest = Bound.sha256(socialMutation);
rejects(() => Bound.normalizeReview(socialMutation), /truth ceiling/,
  'even a recomputed digest cannot turn key review into social proof');

const stageMutation = clone(result);
stageMutation.status = 'TIME_WINDOW_HOLD';
stageMutation.holds = ['FORGED_TIME_HOLD'];
stageMutation.nextGate = 'REPAIR_POLICY_BINDING_THEN_REASSESS';
delete stageMutation.reviewDigest;
stageMutation.reviewDigest = Bound.sha256(stageMutation);
rejects(() => Bound.normalizeReview(stageMutation), /status conflicts with truth/,
  'a recomputed digest cannot contradict the typed hold stage');

const executionInput = clone(boundInput);
executionInput.execute = true;
rejects(() => Bound.assessPolicyBoundAssurance(executionInput), /unsupported fields/,
  'top-level execution requests are rejected as malformed input');

console.log('Code Capability Fabric policy-bound assurance selftest: ' + checks + ' checks passed');
