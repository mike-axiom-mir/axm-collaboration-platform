#!/usr/bin/env node
'use strict';

const Anchor = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');

const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-separated-witness/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-separated-continuity/v1';
const VERSION = '1.7.0';
const STATUS = 'TEST';
const SEPARATION_SCOPE = 'OBSERVED_LOCAL_POSSESSION_CROSS_LAYER_KEY_FINGERPRINT_AND_DECLARED_PRINCIPAL_DIGEST_NONOVERLAP';
const NEXT_GATE = 'HOST_AUTHENTICATED_ANCHOR_PIN_INDEPENDENT_IDENTITY_ATTESTATION_AND_EXTERNALLY_RETAINED_OR_PROTECTED_STATE';
const MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function stableStringify(value) {
  return Anchor.stableStringify(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return Anchor.sha256(value);
}

function assertArtifactBound(value, label) {
  const bytes = Buffer.byteLength(stableStringify(value), 'utf8');
  if (bytes > MAX_ARTIFACT_CANONICAL_BYTES) {
    throw new Error(label + ' exceeds the 512 KiB canonical artifact bound');
  }
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function setDigest(domain, values) {
  const sorted = values.map(value => digest(value, domain + ' member')).sort();
  return sha256({
    schema: 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-separation-set/v1',
    domain,
    values: sorted
  });
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter(value => rightSet.has(value)))).sort();
}

function collectSeparation(witness, anchored) {
  const witnessSeats = witness.signatureEvidence.attestations;
  const anchorSeats = anchored.authorizationEvidence.authorizations;
  const witnessFingerprints = witnessSeats.map(seat => seat.keyFingerprint);
  const anchorFingerprints = anchorSeats.map(seat => seat.keyFingerprint);
  const witnessPrincipalDigests = witnessSeats.map(seat => seat.actorDigest);
  const anchorPrincipalDigests = anchorSeats.map(seat => seat.stewardDigest);
  const sharedFingerprints = intersection(witnessFingerprints, anchorFingerprints);
  if (sharedFingerprints.length) {
    throw new Error('local possession witness and anchor layers must not share an observed public key fingerprint');
  }
  const sharedPrincipalDigests = intersection(witnessPrincipalDigests, anchorPrincipalDigests);
  if (sharedPrincipalDigests.length) {
    throw new Error('local possession witness and anchor layers must not share a declared principal digest');
  }
  return {
    separationScope: SEPARATION_SCOPE,
    witnessVerifiedSeats: witnessSeats.length,
    anchorVerifiedSeats: anchorSeats.length,
    combinedVerifiedSeats: witnessSeats.length + anchorSeats.length,
    witnessKeyFingerprintSetDigest: setDigest('local-possession-witness-key-fingerprints', witnessFingerprints),
    anchorKeyFingerprintSetDigest: setDigest('local-possession-anchor-key-fingerprints', anchorFingerprints),
    witnessDeclaredPrincipalSetDigest: setDigest('local-possession-witness-declared-principal-digests', witnessPrincipalDigests),
    anchorDeclaredPrincipalSetDigest: setDigest('local-possession-anchor-declared-principal-digests', anchorPrincipalDigests),
    sharedKeyFingerprintCount: 0,
    sharedDeclaredPrincipalDigestCount: 0
  };
}

function separationTruth() {
  return {
    anchoredWitnessVerifiedByExactRebuild: true,
    witnessLayerSignatureSeatsCryptographicallyVerified: true,
    anchorLayerSignatureSeatsCryptographicallyVerified: true,
    noSharedPublicKeyFingerprintObserved: true,
    noSharedDeclaredPrincipalDigestObserved: true,
    observableCrossLayerSeparationVerified: true,
    keyCustodyIndependenceProven: false,
    realWorldControllerIndependenceProven: false,
    declaredPrincipalDigestsAuthenticated: false,
    sameControllerWithDistinctKeysStillPossible: true,
    sameControllerWithDistinctPrincipalDigestsStillPossible: true,
    crossLayerCollusionExcluded: false,
    witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true,
    witnessPolicyReplacementPrevented: false,
    jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    anchorOriginAuthenticatedByHost: false,
    actualHumanParticipationProven: false,
    separationVerificationTimeExternallyTrusted: false,
    separationReceiptExternallyRetained: false,
    checkpointExternallyRetained: false,
    protectedMonotonicStateProven: false,
    checkpointDeletionOrRollbackPrevented: false,
    currentResponseStateDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    rawPrincipalIdentityEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    rawConfiguredPartyLabelEmbedded: false,
    stateRootPathEmbedded: false,
    rawCustodyRecordEmbedded: false,
    rawAssessmentReceiptEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildSeparatedWitness(input) {
  assertArtifactBound(input, 'local possession separated witness input');
  exactKeys(input, ['receiptId', 'verifiedAt', 'anchoredWitnessInput', 'anchoredWitnessReceipt'], 'local possession separated witness input');
  const receiptId = exactText(input.receiptId, 'local possession separated witness receipt id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'local possession separated witness verifiedAt');
  const anchoredCheck = Anchor.verifyAnchoredWitness(clone(input.anchoredWitnessInput), clone(input.anchoredWitnessReceipt));
  if (!anchoredCheck.pass) throw new Error('local possession anchored witness is invalid: ' + anchoredCheck.errors.join('; '));
  const anchored = anchoredCheck.rebuilt;
  if (Date.parse(verifiedAt) < Date.parse(anchored.verifiedAt)) {
    throw new Error('local possession separation verification cannot predate anchored witness verification');
  }
  const witnessCheck = Witness.verifyWitness(
    clone(input.anchoredWitnessInput.witnessInput),
    clone(input.anchoredWitnessInput.witnessReceipt)
  );
  if (!witnessCheck.pass) throw new Error('local possession checkpoint witness is invalid: ' + witnessCheck.errors.join('; '));
  const witness = witnessCheck.rebuilt;
  if (witness.witnessDigest !== anchored.witnessRef.sha256) {
    throw new Error('local possession anchored witness does not reference the exact rebuilt checkpoint witness');
  }
  const separationEvidence = collectSeparation(witness, anchored);
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId,
    verifiedAt,
    status: STATUS,
    anchoredWitnessRef: { id: anchored.receiptId, schema: anchored.schema, sha256: anchored.receiptDigest },
    anchorRef: clone(anchored.anchorRef),
    witnessRef: clone(anchored.witnessRef),
    witnessPolicyRef: clone(anchored.witnessPolicyRef),
    checkpointRef: clone(anchored.checkpointRef),
    sourceSnapshotRef: clone(anchored.sourceSnapshotRef),
    receiverIdDigest: anchored.receiverIdDigest,
    challengerIdDigest: anchored.challengerIdDigest,
    receiverPolicyRef: clone(anchored.receiverPolicyRef),
    entriesDigest: anchored.entriesDigest,
    state: 'LOCAL_POSSESSION_OBSERVABLE_CROSS_LAYER_OVERLAP_ABSENT_CONTROLLER_INDEPENDENCE_NOT_PROVEN',
    separationEvidence,
    nextGate: NEXT_GATE,
    truth: separationTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  assertArtifactBound(receipt, 'local possession separated witness receipt');
  return receipt;
}

function verifySeparatedWitness(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    assertArtifactBound(receipt, 'local possession separated witness receipt');
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('local possession separated witness receipt schema mismatch');
    rebuilt = buildSeparatedWitness(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('local possession separated witness receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

function separatedAuditTruth(anchoredAudit) {
  return {
    separatedWitnessVerifiedByExactRebuild: true,
    anchoredWitnessVerifiedByExactRebuild: true,
    anchoredContinuityAuditVerifiedByExactRebuild: true,
    noSharedPublicKeyFingerprintObserved: true,
    noSharedDeclaredPrincipalDigestObserved: true,
    observableCrossLayerSeparationVerified: true,
    keyCustodyIndependenceProven: false,
    realWorldControllerIndependenceProven: false,
    declaredPrincipalDigestsAuthenticated: false,
    sameControllerWithDistinctKeysStillPossible: true,
    sameControllerWithDistinctPrincipalDigestsStillPossible: true,
    crossLayerCollusionExcluded: false,
    witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true,
    witnessPolicyReplacementPrevented: false,
    jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true,
    comparisonBoundToExactConfiguredIdentity: anchoredAudit.truth.comparisonBoundToExactConfiguredIdentity,
    responseFilenameIdentityVerifiedWhenAvailable: anchoredAudit.truth.responseFilenameIdentityVerifiedWhenAvailable,
    rollbackOrReplacementDetectedAgainstSeparatedCheckpoint: anchoredAudit.truth.rollbackOrReplacementDetectedAgainstAnchoredCheckpoint,
    currentAbsenceDetectedAgainstSeparatedCheckpoint: anchoredAudit.truth.currentAbsenceDetectedAgainstAnchoredCheckpoint,
    currentInvalidityDetected: anchoredAudit.truth.currentInvalidityDetected,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    anchorOriginAuthenticatedByHost: false,
    actualHumanParticipationProven: false,
    separatedAuditTimeExternallyTrusted: false,
    separationReceiptExternallyRetained: false,
    checkpointExternallyRetained: false,
    protectedMonotonicStateProven: false,
    checkpointDeletionOrRollbackPrevented: false,
    currentResponseStateDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildSeparatedAudit(input) {
  assertArtifactBound(input, 'local possession separated continuity audit input');
  exactKeys(input, ['auditId', 'checkedAt', 'separationInput', 'separationReceipt', 'currentSnapshot'], 'local possession separated continuity audit input');
  const auditId = exactText(input.auditId, 'local possession separated continuity audit id', 180);
  const checkedAt = timestamp(input.checkedAt, 'local possession separated continuity audit checkedAt');
  const separationCheck = verifySeparatedWitness(clone(input.separationInput), clone(input.separationReceipt));
  if (!separationCheck.pass) throw new Error('local possession separated witness is invalid: ' + separationCheck.errors.join('; '));
  const separated = separationCheck.rebuilt;
  if (Date.parse(checkedAt) < Date.parse(separated.verifiedAt)) {
    throw new Error('local possession separated continuity audit cannot predate separation verification');
  }
  const anchoredAudit = Anchor.buildAnchoredAudit({
    auditId,
    checkedAt,
    anchoredWitnessInput: clone(input.separationInput.anchoredWitnessInput),
    anchoredWitnessReceipt: clone(input.separationInput.anchoredWitnessReceipt),
    currentSnapshot: clone(input.currentSnapshot)
  });
  const audit = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    auditId,
    checkedAt,
    status: STATUS,
    separatedWitnessRef: { id: separated.receiptId, schema: separated.schema, sha256: separated.receiptDigest },
    anchoredWitnessRef: clone(separated.anchoredWitnessRef),
    anchorRef: clone(separated.anchorRef),
    witnessRef: clone(separated.witnessRef),
    witnessPolicyRef: clone(separated.witnessPolicyRef),
    checkpointRef: clone(separated.checkpointRef),
    sourceSnapshotRef: clone(separated.sourceSnapshotRef),
    receiverIdDigest: separated.receiverIdDigest,
    challengerIdDigest: separated.challengerIdDigest,
    receiverPolicyRef: clone(separated.receiverPolicyRef),
    entriesDigest: separated.entriesDigest,
    anchoredContinuityAuditRef: { id: anchoredAudit.auditId, schema: anchoredAudit.schema, sha256: anchoredAudit.auditDigest },
    currentSnapshot: clone(anchoredAudit.currentSnapshot),
    comparison: clone(anchoredAudit.comparison),
    decision: clone(anchoredAudit.decision),
    state: 'LOCAL_POSSESSION_SEPARATED_WITNESS_CHAIN_VERIFIED_AND_COMPARED_CONTROLLER_INDEPENDENCE_NOT_PROVEN',
    nextGate: NEXT_GATE,
    truth: separatedAuditTruth(anchoredAudit),
    auditDigest: null
  };
  audit.auditDigest = sha256(withoutField(audit, 'auditDigest'));
  assertArtifactBound(audit, 'local possession separated continuity audit');
  return audit;
}

function verifySeparatedAudit(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    assertArtifactBound(receipt, 'local possession separated continuity audit receipt');
    if (!receipt || receipt.schema !== AUDIT_SCHEMA) throw new Error('local possession separated continuity audit schema mismatch');
    rebuilt = buildSeparatedAudit(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('local possession separated continuity audit content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  RECEIPT_SCHEMA,
  AUDIT_SCHEMA,
  VERSION,
  STATUS,
  SEPARATION_SCOPE,
  NEXT_GATE,
  MAX_ARTIFACT_CANONICAL_BYTES,
  stableStringify,
  sha256,
  setDigest,
  buildSeparatedWitness,
  verifySeparatedWitness,
  buildSeparatedAudit,
  verifySeparatedAudit
};
