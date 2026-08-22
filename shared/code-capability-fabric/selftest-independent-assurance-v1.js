#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Fabric = require('./code-capability-fabric-v2');
const Readiness = require('./code-capability-readiness-v1');
const Review = require('./code-independent-assurance-review-v1');

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
const verifierC = keyEntry('independent-verifier-c');

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
  return Review.sealTrustPolicy({
    schema: Review.TRUST_POLICY_SCHEMA,
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

function signAssurance(record, policy, key, id, overrides = {}, signingPair = key.pair) {
  const payload = {
    schema: Review.ASSURANCE_ATTESTATION_SCHEMA,
    id,
    assuranceRecordRef: Readiness.assuranceRecordRef(record),
    readinessDigest: overrides.readinessDigest || base.readinessAssessment.readinessDigest,
    trustPolicyDigest: overrides.trustPolicyDigest || policy.policyDigest,
    keyRef: overrides.keyRef || key.ref,
    signedAt: overrides.signedAt || '2026-08-22T09:00:20.000Z'
  };
  const signatureBase64 = crypto.sign(
    null,
    Review.buildAssuranceAttestationPayload(payload),
    signingPair.privateKey
  ).toString('base64');
  return Review.sealAssuranceAttestation({ ...payload, signatureBase64 });
}

const base = makeBaseReadiness();
const policy = makePolicy(base.readinessInput.assuranceRecords);
const assuranceAttestations = base.readinessInput.assuranceRecords.flatMap((record, index) => [
  signAssurance(record, policy, verifierA, 'attestation-' + (index + 1) + '-a'),
  signAssurance(record, policy, verifierB, 'attestation-' + (index + 1) + '-b')
]);
const input = {
  readinessInput: base.readinessInput,
  readinessAssessment: base.readinessAssessment,
  trustPolicy: policy,
  verifierKeys: [verifierB.key, verifierA.key],
  assuranceAttestations
};

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
  ['code-assurance-trust-policy.schema.json', Review.TRUST_POLICY_SCHEMA],
  ['code-assurance-attestation.schema.json', Review.ASSURANCE_ATTESTATION_SCHEMA],
  ['code-independent-assurance-review.schema.json', Review.REVIEW_SCHEMA]
];
check(schemas.every(([file, id]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schema.$id === id && schema.additionalProperties === false;
}), 'independent assurance schemas bind exact identities and close top-level fields');
check(schemas.every(([file]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file);
}), 'independent assurance schema object nodes are closed and local references resolve');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-independent-assurance-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0,
  'Workshop contract remains permissionless, write-free TEST');
check(JSON.stringify(contract.rootsGate) === JSON.stringify(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']),
  'the four roots are the ordered technical acceptance gate');
check(['host-observer-counting-as-independent-assurance-verifier', 'distinct-keys-as-organizational-independence-proof',
  'unbound-trust-policy-as-request-authority', 'provider-code-execution', 'automatic-canon']
  .every((item) => contract.boundaries.refuses.includes(item)), 'non-domination and truth ceilings are explicit');
const implementationSource = fs.readFileSync(path.join(__dirname, 'code-independent-assurance-review-v1.js'), 'utf8');
check(!/require\(['"](?:fs|child_process|http|https|net|worker_threads)['"]\)/.test(implementationSource),
  'implementation imports no filesystem, process, worker, or network capability');

const review = Review.assessIndependentAssurance(input);
check(review.status === 'HUMAN_POLICY_ACCEPTANCE_REQUIRED' && review.authority === 'NONE' && review.holds.length === 0,
  'complete independent quorums stop at human policy acceptance');
check(review.nextGate === 'MIKE_ACCEPT_TRUST_POLICY_BEFORE_ANY_EXECUTOR_DECISION',
  'Mike acts only after the four-root technical gate exposes the exact policy');
check(review.truth.baseReadinessVerified && review.truth.trustPolicyIntegrityVerified &&
  review.truth.verifierKeysBound && review.truth.verifierKeysDistinctFromObserver &&
  review.truth.assuranceSignaturesVerified && review.truth.assuranceQuorumsSatisfied,
  'review truth records the cryptographic checks actually performed');
check(!review.truth.trustPolicyRequestBound && !review.truth.organizationalIndependenceProven &&
  review.limitations.includes('TRUST_POLICY_NOT_BOUND_BY_V2_REQUEST') &&
  review.limitations.includes('ORGANIZATIONAL_INDEPENDENCE_NOT_PROVEN'),
  'review preserves request-binding and social-independence limitations');
check(!review.truth.resourceEnforcementObserved && !review.truth.executorAuthorized &&
  !review.truth.providerCodeExecuted && !review.truth.workspaceContentRead &&
  !review.truth.permissionGranted && !review.truth.networkUsed && !review.truth.outputWritten &&
  !review.truth.installed && !review.truth.promoted && !review.truth.canonChanged,
  'review truth ceiling refuses runtime and lifecycle authority');
check(Review.normalizeReview(review).reviewDigest === review.reviewDigest,
  'independent assurance output passes strict standalone validation');
check(Review.verifyIndependentAssuranceReview(review, input).pass,
  'independent assurance output verifies against deterministic rebuild');

const reordered = clone(input);
reordered.verifierKeys.reverse();
reordered.assuranceAttestations.reverse();
reordered.trustPolicy.rules.reverse();
check(Review.assessIndependentAssurance(reordered).reviewDigest === review.reviewDigest,
  'policy, key, and attestation ordering cannot alter valid review bytes');

const damagedBase = clone(input);
damagedBase.readinessAssessment.readinessDigest = digest('f');
check(Review.assessIndependentAssurance(damagedBase).status === 'BASE_READINESS_HOLD',
  'forged base readiness is held before policy evaluation');

const nonterminalBase = clone(input);
nonterminalBase.readinessInput.assuranceRecords.pop();
nonterminalBase.readinessAssessment = Readiness.assessExecutionReadiness(nonterminalBase.readinessInput);
check(Review.assessIndependentAssurance(nonterminalBase).status === 'BASE_READINESS_HOLD',
  'a valid nonterminal readiness hold cannot be upgraded by external signatures');

const damagedPolicy = clone(input);
damagedPolicy.trustPolicy.policyDigest = digest('f');
check(Review.assessIndependentAssurance(damagedPolicy).status === 'TRUST_POLICY_HOLD',
  'trust policy digest drift is rejected');

const extraPolicyField = clone(input);
extraPolicyField.trustPolicy.merge = true;
check(Review.assessIndependentAssurance(extraPolicyField).status === 'TRUST_POLICY_HOLD',
  'unknown policy authority fields are rejected');

const wrongPolicyTime = clone(input);
const wrongTimeCore = clone(wrongPolicyTime.trustPolicy);
delete wrongTimeCore.policyDigest;
wrongTimeCore.evaluatedAt = '2026-08-22T09:00:29.000Z';
wrongPolicyTime.trustPolicy = Review.sealTrustPolicy(wrongTimeCore);
check(Review.assessIndependentAssurance(wrongPolicyTime).status === 'TRUST_POLICY_HOLD',
  'policy evaluation time must equal the route evaluation instant');

const missingPolicyRule = clone(input);
const missingRuleCore = clone(missingPolicyRule.trustPolicy);
delete missingRuleCore.policyDigest;
missingRuleCore.rules.pop();
missingPolicyRule.trustPolicy = Review.sealTrustPolicy(missingRuleCore);
check(Review.assessIndependentAssurance(missingPolicyRule).status === 'TRUST_POLICY_HOLD',
  'policy must cover every assurance schema exactly');

const observerPolicy = clone(input);
const observerPolicyCore = clone(observerPolicy.trustPolicy);
delete observerPolicyCore.policyDigest;
observerPolicyCore.rules[0].trustedVerifierRefs[0] = observer.ref;
observerPolicy.trustPolicy = Review.sealTrustPolicy(observerPolicyCore);
check(Review.assessIndependentAssurance(observerPolicy).status === 'TRUST_POLICY_HOLD',
  'host observer cannot count in an independent assurance verifier set');

const observerMayCount = clone(input);
observerMayCount.trustPolicy.observerMayCount = true;
check(Review.assessIndependentAssurance(observerMayCount).status === 'TRUST_POLICY_HOLD',
  'observerMayCount cannot be enabled even with a recomputed caller payload');

const inactivePolicy = clone(input);
inactivePolicy.trustPolicy.validFrom = '2026-08-22T09:00:31.000Z';
check(Review.assessIndependentAssurance(inactivePolicy).status === 'TRUST_POLICY_HOLD',
  'policy must be active at evaluation time');

const missingKey = clone(input);
missingKey.verifierKeys.pop();
check(Review.assessIndependentAssurance(missingKey).status === 'VERIFIER_KEY_HOLD',
  'missing verifier key bytes cannot satisfy a policy reference');

const extraKey = clone(input);
extraKey.verifierKeys.push(verifierC.key);
check(Review.assessIndependentAssurance(extraKey).status === 'VERIFIER_KEY_HOLD',
  'unrequested verifier keys cannot widen the review input');

const duplicateKey = clone(input);
duplicateKey.verifierKeys.push(clone(verifierA.key));
check(Review.assessIndependentAssurance(duplicateKey).status === 'VERIFIER_KEY_HOLD',
  'duplicate verifier key references are rejected');

const driftedKey = clone(input);
driftedKey.verifierKeys[0].publicKeySpkiDerBase64 = verifierC.key.publicKeySpkiDerBase64;
check(Review.assessIndependentAssurance(driftedKey).status === 'VERIFIER_KEY_HOLD',
  'verifier key byte drift cannot retain a trusted reference');

const observerKeyAlias = clone(input);
const aliasedObserverKey = { ...clone(observer.key), id: 'aliased-host-observer-key' };
const aliasedObserverRef = Readiness.buildTrustKeyRef(aliasedObserverKey);
const observerAliasPolicyCore = clone(observerKeyAlias.trustPolicy);
delete observerAliasPolicyCore.policyDigest;
for (const rule of observerAliasPolicyCore.rules) {
  rule.trustedVerifierRefs = rule.trustedVerifierRefs.map((ref) =>
    ref.id === verifierA.ref.id ? aliasedObserverRef : ref);
}
observerKeyAlias.trustPolicy = Review.sealTrustPolicy(observerAliasPolicyCore);
observerKeyAlias.verifierKeys = [aliasedObserverKey, clone(verifierB.key)];
check(Review.assessIndependentAssurance(observerKeyAlias).status === 'VERIFIER_KEY_HOLD',
  'host observer key bytes cannot re-enter under a different key id');

const duplicateKeyMaterial = clone(input);
const aliasedVerifierKey = { ...clone(verifierA.key), id: 'aliased-independent-verifier-a' };
const aliasedVerifierRef = Readiness.buildTrustKeyRef(aliasedVerifierKey);
const duplicateMaterialPolicyCore = clone(duplicateKeyMaterial.trustPolicy);
delete duplicateMaterialPolicyCore.policyDigest;
for (const rule of duplicateMaterialPolicyCore.rules) {
  rule.trustedVerifierRefs = rule.trustedVerifierRefs.map((ref) =>
    ref.id === verifierB.ref.id ? aliasedVerifierRef : ref);
}
duplicateKeyMaterial.trustPolicy = Review.sealTrustPolicy(duplicateMaterialPolicyCore);
duplicateKeyMaterial.verifierKeys = [clone(verifierA.key), aliasedVerifierKey];
check(Review.assessIndependentAssurance(duplicateKeyMaterial).status === 'VERIFIER_KEY_HOLD',
  'one public key cannot masquerade as multiple quorum members');

const noAttestations = clone(input);
noAttestations.assuranceAttestations = [];
check(Review.assessIndependentAssurance(noAttestations).status === 'ASSURANCE_ATTESTATION_HOLD',
  'an empty attestation set is held');

const duplicateAttestation = clone(input);
duplicateAttestation.assuranceAttestations.push(clone(duplicateAttestation.assuranceAttestations[0]));
check(Review.assessIndependentAssurance(duplicateAttestation).status === 'ASSURANCE_ATTESTATION_HOLD',
  'duplicate attestation identifiers are rejected');

const duplicateTuple = clone(input);
duplicateTuple.assuranceAttestations.push(signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'duplicate-record-key-attestation'
));
check(Review.assessIndependentAssurance(duplicateTuple).status === 'ASSURANCE_ATTESTATION_HOLD',
  'one verifier cannot count twice for the same assurance record');

const driftedAttestation = clone(input);
driftedAttestation.assuranceAttestations[0].attestationDigest = digest('f');
check(Review.assessIndependentAssurance(driftedAttestation).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestation digest drift is rejected');

const extraAttestationField = clone(input);
extraAttestationField.assuranceAttestations[0].organization = 'unproven';
check(Review.assessIndependentAssurance(extraAttestationField).status === 'ASSURANCE_ATTESTATION_HOLD',
  'unsigned organizational claims cannot enter an attestation');

const unknownRecord = clone(input);
unknownRecord.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'unknown-record',
  {}, verifierA.pair
);
const unknownPayload = clone(unknownRecord.assuranceAttestations[0]);
delete unknownPayload.attestationDigest;
delete unknownPayload.signatureBase64;
unknownPayload.assuranceRecordRef = ref('unknown-assurance', Fabric.RESOURCE_ENFORCEMENT_SCHEMA, 'f');
unknownRecord.assuranceAttestations[0] = Review.sealAssuranceAttestation({
  ...unknownPayload,
  signatureBase64: crypto.sign(null, Review.buildAssuranceAttestationPayload(unknownPayload), verifierA.pair.privateKey).toString('base64')
});
check(Review.assessIndependentAssurance(unknownRecord).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestations for records outside the readiness result are rejected');

const wrongReadiness = clone(input);
wrongReadiness.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'wrong-readiness', { readinessDigest: digest('f') }
);
check(Review.assessIndependentAssurance(wrongReadiness).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestations cannot replay across readiness records');

const wrongPolicy = clone(input);
wrongPolicy.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'wrong-policy', { trustPolicyDigest: digest('f') }
);
check(Review.assessIndependentAssurance(wrongPolicy).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestations cannot replay across trust policies');

const untrustedSigner = clone(input);
untrustedSigner.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierC, 'untrusted-signer'
);
check(Review.assessIndependentAssurance(untrustedSigner).status === 'ASSURANCE_ATTESTATION_HOLD',
  'a valid signature from an untrusted key cannot count');

const earlyAttestation = clone(input);
earlyAttestation.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'early-attestation', { signedAt: '2026-08-22T08:59:58.000Z' }
);
check(Review.assessIndependentAssurance(earlyAttestation).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestations cannot predate the assurance record');

const futureAttestation = clone(input);
futureAttestation.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'future-attestation', { signedAt: '2026-08-22T09:00:31.000Z' }
);
check(Review.assessIndependentAssurance(futureAttestation).status === 'ASSURANCE_ATTESTATION_HOLD',
  'attestations later than evaluation time are rejected');

const wrongSigner = clone(input);
wrongSigner.assuranceAttestations[0] = signAssurance(
  base.readinessInput.assuranceRecords[0], policy, verifierA, 'wrong-private-key', {}, verifierB.pair
);
check(Review.assessIndependentAssurance(wrongSigner).status === 'ASSURANCE_ATTESTATION_HOLD',
  'matching key metadata cannot hide a signature from the wrong private key');

const tamperedSignature = clone(input);
const tamperedCore = clone(tamperedSignature.assuranceAttestations[0]);
delete tamperedCore.attestationDigest;
tamperedCore.signatureBase64 = Buffer.alloc(64, 3).toString('base64');
tamperedSignature.assuranceAttestations[0] = Review.sealAssuranceAttestation(tamperedCore);
check(Review.assessIndependentAssurance(tamperedSignature).status === 'ASSURANCE_ATTESTATION_HOLD',
  'cryptographically invalid assurance signatures are rejected');

const quorumMissing = clone(input);
quorumMissing.assuranceAttestations = quorumMissing.assuranceAttestations.filter((item) =>
  !(item.assuranceRecordRef.id === 'assurance-1' && item.keyRef.id === verifierB.ref.id));
const quorumHold = Review.assessIndependentAssurance(quorumMissing);
check(quorumHold.status === 'QUORUM_HOLD' && quorumHold.quorumResults.some((item) => !item.satisfied),
  'valid signatures below the declared quorum remain a typed hold');

const mutatedAuthority = clone(review);
mutatedAuthority.authority = 'EXECUTE';
check(!Review.verifyIndependentAssuranceReview(mutatedAuthority, input).pass,
  'review output cannot be mutated into execution authority');

const socialLie = clone(review);
socialLie.truth.organizationalIndependenceProven = true;
const socialLieCore = clone(socialLie);
delete socialLieCore.reviewDigest;
socialLie.reviewDigest = Review.sha256(socialLieCore);
check(!Review.verifyIndependentAssuranceReview(socialLie, input).pass,
  'even a recomputed digest cannot turn key separation into social proof');

rejects(() => Review.assessIndependentAssurance({ ...input, execute: true }), /unsupported fields/,
  'top-level execution requests are rejected as malformed review input');

console.log('Code Capability Fabric independent assurance selftest: ' + checks + ' checks passed');
