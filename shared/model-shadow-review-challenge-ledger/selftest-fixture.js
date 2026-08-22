'use strict';

const crypto = require('crypto');
const SignedReview = require('../model-shadow-signed-review-evidence/model-shadow-signed-review-evidence');
const SignedFixture = require('../model-shadow-signed-review-evidence/selftest-fixture');

function buildRequest(tag) {
  const suffix = String(tag || 'default').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const fixture = SignedFixture.buildFixture();
  const handoff = fixture.reviewedHandoff;
  const approval = handoff.reviewEvidence.approvals[0];
  const pair = crypto.generateKeyPairSync('ed25519');
  const policy = {
    schema: SignedReview.POLICY_SCHEMA,
    policyId: 'policy:challenge-ledger-' + suffix,
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
    challengeRef: {
      id: 'challenge:challenge-ledger-' + suffix,
      schema: 'axm.review-challenge/v1',
      sha256: SignedReview.sha256('challenge-ledger:' + suffix)
    },
    requiredSignatures: 1,
    requiredDeclaredHumanSignatures: 1,
    maxAttestationAgeSeconds: 360,
    keys: [{
      keyId: 'fixture-review-key-' + suffix,
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      actorDigest: approval.actorDigest,
      actorKind: approval.actorKind,
      scope: SignedReview.SCOPE,
      enabled: true
    }],
    policyDigest: null
  };
  policy.policyDigest = SignedReview.keyPolicyDigest(policy);

  const attestation = {
    schema: SignedReview.ATTESTATION_SCHEMA,
    attestationId: 'attestation:challenge-ledger-' + suffix,
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
  };
  attestation.signature = crypto.sign(
    null,
    Buffer.from(SignedReview.stableStringify(SignedReview.attestationSigningPayload(attestation)), 'utf8'),
    pair.privateKey
  ).toString('base64');

  const signedReviewInput = {
    receiptId: 'receipt:challenge-ledger-' + suffix,
    verifiedAt: '2026-08-20T14:06:00.000Z',
    reviewedHandoffInput: fixture.reviewedHandoffInput,
    reviewedHandoff: fixture.reviewedHandoff,
    keyPolicy: policy,
    signedAttestations: [attestation]
  };
  const signedReviewReceipt = SignedReview.buildReceipt(signedReviewInput);
  return {
    consumptionId: 'consumption:challenge-ledger-' + suffix,
    consumedAt: '2026-08-20T14:06:30.000Z',
    confirmation: 'CONSUME SIGNED REVIEW CHALLENGE ONCE',
    signedReviewInput,
    signedReviewReceipt
  };
}

module.exports = { buildRequest };
