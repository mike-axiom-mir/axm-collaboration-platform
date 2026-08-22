#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SignedReview = require('./model-shadow-signed-review-evidence');
const Fixture = require('./selftest-fixture');
const ChallengerGate = require('../model-shadow-challenger-gate/model-shadow-challenger-gate');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function challengeRef(seed) {
  return {
    id: 'challenge:signed-review-fixture',
    schema: 'axm.review-challenge/v1',
    sha256: SignedReview.sha256(seed)
  };
}

function policyFor(fixture, pair, overrides) {
  const handoff = fixture.reviewedHandoff;
  const approval = handoff.reviewEvidence.approvals[0];
  const policy = Object.assign({
    schema: SignedReview.POLICY_SCHEMA,
    policyId: 'policy:signed-review-fixture',
    issuedAt: '2026-08-20T14:04:10.000Z',
    expiresAt: '2026-08-20T14:10:00.000Z',
    audience: SignedReview.AUDIENCE,
    scope: SignedReview.SCOPE,
    authorityOrigin: SignedReview.AUTHORITY_ORIGIN,
    reviewedHandoffRef: {
      id: handoff.handoffId,
      schema: handoff.schema,
      sha256: handoff.handoffDigest
    },
    planRef: {
      id: handoff.plan.planId,
      schema: handoff.plan.schema,
      sha256: handoff.plan.planDigest
    },
    challengeRef: challengeRef('single-use-not-proven-fixture'),
    requiredSignatures: 1,
    requiredDeclaredHumanSignatures: 1,
    maxAttestationAgeSeconds: 360,
    keys: [{
      keyId: 'fixture-review-key',
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      actorDigest: approval.actorDigest,
      actorKind: approval.actorKind,
      scope: SignedReview.SCOPE,
      enabled: true
    }],
    policyDigest: null
  }, overrides || {});
  policy.policyDigest = SignedReview.keyPolicyDigest(policy);
  return policy;
}

function attestationFor(fixture, policy, pair, overrides) {
  const handoff = fixture.reviewedHandoff;
  const approval = handoff.reviewEvidence.approvals[0];
  const attestation = Object.assign({
    schema: SignedReview.ATTESTATION_SCHEMA,
    attestationId: 'attestation:signed-review-fixture',
    keyId: policy.keys[0].keyId,
    actorDigest: approval.actorDigest,
    actorKind: approval.actorKind,
    verdict: 'APPROVE',
    scope: SignedReview.SCOPE,
    policyDigest: policy.policyDigest,
    challengeDigest: policy.challengeRef.sha256,
    reviewedHandoffDigest: handoff.handoffDigest,
    proposalDigest: handoff.proposalRef.sha256,
    planDigest: handoff.plan.planDigest,
    reviewEvidenceDigest: handoff.reviewEvidenceRef.sha256,
    reviewItemId: handoff.reviewEvidence.reviewItemId,
    reviewApprovalAt: approval.at,
    issuedAt: '2026-08-20T14:05:00.000Z',
    expiresAt: '2026-08-20T14:10:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, overrides || {});
  attestation.signature = crypto.sign(
    null,
    Buffer.from(SignedReview.stableStringify(SignedReview.attestationSigningPayload(attestation)), 'utf8'),
    pair.privateKey
  ).toString('base64');
  return attestation;
}

const fixture = Fixture.buildFixture();
check(ChallengerGate.verifyReviewedHandoff(fixture.reviewedHandoffInput, fixture.reviewedHandoff).pass, 'upstream reviewed handoff verifies by exact rebuild');
equal(fixture.reviewedHandoff.truth.reviewActorAuthenticated, false, 'upstream Review Inbox actor remains unauthenticated');
equal(fixture.reviewedHandoff.truth.executionAuthorized, false, 'upstream reviewed handoff grants no execution authority');

const pair = crypto.generateKeyPairSync('ed25519');
const policy = policyFor(fixture, pair);
const attestation = attestationFor(fixture, policy, pair);
const input = {
  receiptId: 'receipt:signed-review-fixture',
  verifiedAt: '2026-08-20T14:06:00.000Z',
  reviewedHandoffInput: fixture.reviewedHandoffInput,
  reviewedHandoff: fixture.reviewedHandoff,
  keyPolicy: policy,
  signedAttestations: [attestation]
};
const receipt = SignedReview.buildReceipt(input);
equal(receipt.state, 'DETACHED_SIGNATURES_VERIFIED_AGAINST_CALLER_KEY_POLICY_EXECUTION_NOT_AUTHORIZED', 'valid detached signature produces only bounded signature evidence');
equal(receipt.signatureEvidence.verifiedSignatures, 1, 'one exact Ed25519 signature is verified');
equal(receipt.signatureEvidence.verifiedDeclaredHumanSignatures, 1, 'declared-human key label is counted without authenticating a human');
equal(receipt.signatureEvidence.policyAuthorityOrigin, 'CALLER_SUPPLIED_UNAUTHENTICATED', 'caller policy origin remains explicit');
equal(receipt.truth.signingKeyPossessionVerified, true, 'valid signature proves possession of the policy-listed key');
equal(receipt.truth.callerPolicyAuthorityAuthenticated, false, 'valid signature does not authenticate the caller policy authority');
equal(receipt.truth.actorRealWorldIdentityProven, false, 'valid signature does not prove real-world actor identity');
equal(receipt.truth.actualHumanParticipationProven, false, 'synthetic signed fixture does not prove actual human participation');
equal(receipt.truth.challengeSingleUseProven, false, 'pure verifier does not claim nonce replay prevention');
equal(receipt.truth.executionAuthorized, false, 'signed receipt grants no execution authority');
equal(receipt.truth.adoptionAuthorized, false, 'signed receipt grants no adoption authority');
check(SignedReview.verifyReceipt(input, receipt).pass, 'signed review receipt verifies by exact rebuild');
check(receipt.receiptDigest.startsWith('sha256:'), 'signed review receipt has a deterministic digest');

const serializedReceipt = SignedReview.stableStringify(receipt);
check(!serializedReceipt.includes('fixture-human'), 'receipt retains no raw Review Inbox actor string');
check(!serializedReceipt.includes('Synthetic fixture note'), 'receipt retains no Review Inbox vote note');
check(!serializedReceipt.includes('BEGIN PUBLIC KEY'), 'receipt retains no raw public key');
check(!serializedReceipt.includes(attestation.signature), 'receipt retains no raw detached signature');

const receiptTamper = copy(receipt);
receiptTamper.truth.executionAuthorized = true;
equal(SignedReview.verifyReceipt(input, receiptTamper).pass, false, 'execution-authority receipt tampering is detected');

const signatureTamper = copy(attestation);
signatureTamper.signature = (signatureTamper.signature[0] === 'A' ? 'B' : 'A') + signatureTamper.signature.slice(1);
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [signatureTamper] })),
  /signature verification failed/,
  'invalid detached signature is refused'
);

const planTamper = attestationFor(fixture, policy, pair, { planDigest: SignedReview.sha256('wrong plan') });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [planTamper] })),
  /plan digest mismatch/,
  'signature over a different plan digest is refused'
);

const approvalTimeTamper = attestationFor(fixture, policy, pair, { reviewApprovalAt: '2026-08-20T14:03:31.000Z' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [approvalTimeTamper] })),
  /does not bind an approval retained/,
  'signature that does not bind the retained Review Inbox approval is refused'
);

const challengeTamper = attestationFor(fixture, policy, pair, { challengeDigest: SignedReview.sha256('wrong challenge') });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [challengeTamper] })),
  /challenge digest mismatch/,
  'signature over a different challenge is refused'
);

const expiredAttestation = attestationFor(fixture, policy, pair, { expiresAt: '2026-08-20T14:05:30.000Z' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [expiredAttestation] })),
  /expired or has an invalid validity window/,
  'expired signed attestation is refused'
);

const futureAttestation = attestationFor(fixture, policy, pair, { issuedAt: '2026-08-20T14:06:01.000Z', expiresAt: '2026-08-20T14:10:00.000Z' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [futureAttestation] })),
  /cannot be issued after verification/,
  'future signed attestation is refused'
);

const unlistedKeyAttestation = attestationFor(fixture, policy, pair, { keyId: 'unlisted-key' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [unlistedKeyAttestation] })),
  /keyId is not enabled/,
  'signature from an unlisted key id is refused'
);

const wrongActorAttestation = attestationFor(fixture, policy, pair, { actorDigest: SignedReview.sha256('wrong actor') });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [wrongActorAttestation] })),
  /actorDigest mismatch/,
  'signature with an actor digest outside the exact key binding is refused'
);

const duplicateInput = Object.assign({}, input, { signedAttestations: [attestation, copy(attestation)] });
throws(() => SignedReview.buildReceipt(duplicateInput), /attestationId must be unique/, 'one signed attestation cannot fill multiple review seats');

const trustedOriginPolicy = copy(policy);
trustedOriginPolicy.authorityOrigin = 'HOST_TRUSTED';
trustedOriginPolicy.policyDigest = SignedReview.keyPolicyDigest(trustedOriginPolicy);
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: trustedOriginPolicy })),
  /must admit its caller-supplied unauthenticated origin/,
  'caller policy cannot self-declare a trusted host authority'
);

const expiredPolicy = copy(policy);
expiredPolicy.expiresAt = '2026-08-20T14:05:59.000Z';
expiredPolicy.policyDigest = SignedReview.keyPolicyDigest(expiredPolicy);
throws(() => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: expiredPolicy })), /policy is expired/, 'expired caller key policy is refused');

const predatingPolicy = copy(policy);
predatingPolicy.issuedAt = '2026-08-20T14:03:59.000Z';
predatingPolicy.policyDigest = SignedReview.keyPolicyDigest(predatingPolicy);
throws(() => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: predatingPolicy })), /cannot predate the reviewed handoff/, 'key policy that claims to predate its exact handoff is refused');

const policyPredatingAttestation = attestationFor(fixture, policy, pair, { issuedAt: '2026-08-20T14:04:05.000Z' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [policyPredatingAttestation] })),
  /cannot predate its exact key policy/,
  'signed attestation that predates its exact key policy is refused'
);

const policyOutlivingAttestation = attestationFor(fixture, policy, pair, { expiresAt: '2026-08-20T14:10:01.000Z' });
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { signedAttestations: [policyOutlivingAttestation] })),
  /cannot outlive its exact key policy/,
  'signed attestation cannot outlive its exact key policy'
);

const policyDigestTamper = copy(policy);
policyDigestTamper.policyDigest = SignedReview.sha256('wrong policy');
throws(() => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: policyDigestTamper })), /policy digest mismatch/, 'tampered caller key policy is refused');

const machinePolicy = copy(policy);
machinePolicy.keys[0].actorKind = 'machine';
machinePolicy.policyDigest = SignedReview.keyPolicyDigest(machinePolicy);
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: machinePolicy })),
  /lacks enough keys declared as human/,
  'machine-labelled key cannot fill the policy declared-human threshold'
);

const otherAlgorithm = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const nonEdPolicy = copy(policy);
nonEdPolicy.keys[0].publicKeyPem = otherAlgorithm.publicKey.export({ type: 'spki', format: 'pem' });
nonEdPolicy.policyDigest = SignedReview.keyPolicyDigest(nonEdPolicy);
throws(() => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: nonEdPolicy })), /must be an Ed25519 public key/, 'non-Ed25519 public key is refused');

const privateMaterialPolicy = copy(policy);
privateMaterialPolicy.keys[0].publicKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
privateMaterialPolicy.policyDigest = SignedReview.keyPolicyDigest(privateMaterialPolicy);
throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { keyPolicy: privateMaterialPolicy })),
  /never private-key material/,
  'private-key PEM is refused before key parsing'
);

throws(
  () => SignedReview.buildReceipt(Object.assign({}, input, { surprise: true })),
  /unknown fields/,
  'unknown signed review input field is refused'
);
throws(() => SignedReview.stableStringify({ lost: undefined }), /undefined/, 'undefined state is refused at the deterministic boundary');
const cycle = {}; cycle.self = cycle;
throws(() => SignedReview.stableStringify(cycle), /cycle/, 'cyclic state is refused at the deterministic boundary');

const policySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-key-policy.schema.json'), 'utf8'));
const attestationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-signed-review-attestation.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-signed-review-receipt.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
equal(policySchema.$id, SignedReview.POLICY_SCHEMA, 'key policy schema identity matches implementation');
equal(attestationSchema.$id, SignedReview.ATTESTATION_SCHEMA, 'signed attestation schema identity matches implementation');
equal(receiptSchema.$id, SignedReview.RECEIPT_SCHEMA, 'signed receipt schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains TEST with zero permissions and writes');
check(contract.boundaries.refuses.includes('key-possession-as-real-world-identity'), 'contract refuses key-possession as identity substitution');
check(contract.boundaries.refuses.includes('signature-as-execution-authority'), 'contract refuses signature as execution-authority substitution');
check(contract.boundaries.refuses.includes('caller-challenge-as-proven-single-use'), 'contract refuses a stateless replay-prevention claim');

console.log('\nModel Shadow signed review evidence selftest: PASS (' + checks + ' checks)');
