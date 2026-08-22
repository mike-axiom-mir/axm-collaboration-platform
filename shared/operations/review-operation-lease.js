'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Redaction = require('../readiness/diagnostic-redaction');

const OWNER_SCHEMA = 'axm.review-operation-lease-owner/v1';
const STATUS_SCHEMA = 'axm.review-operation-lease-status/v1';
const RETIREMENT_PLAN_SCHEMA = 'axm.review-operation-lease-retirement-plan/v1';
const RETIREMENT_REQUEST_SCHEMA = 'axm.review-operation-lease-retirement-request/v1';
const RETIREMENT_INTENT_SCHEMA = 'axm.review-operation-lease-retirement-intent/v1';
const RETIREMENT_DECISION_SCHEMA = 'axm.review-operation-lease-retirement-decision/v1';
const RETIREMENT_RESULT_SCHEMA = 'axm.review-operation-lease-retirement-result/v1';
const RETIREMENT_RECOVERY_STATUS_SCHEMA = 'axm.review-operation-lease-retirement-recovery-status/v1';
const RETIREMENT_PUBLICATION_STATUS_SCHEMA = 'axm.review-operation-lease-retirement-publication-status/v1';
const RETIREMENT_PUBLICATION_STAGE_PLAN_SCHEMA = 'axm.review-operation-lease-retirement-publication-stage-plan/v1';
const RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA = 'axm.review-operation-lease-retirement-publication-archival-request/v1';
const RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1 = 'axm.review-operation-lease-retirement-publication-archival-intent/v1';
const RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA = 'axm.review-operation-lease-retirement-publication-archival-intent/v2';
const RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA_V1 = 'axm.review-operation-lease-retirement-publication-archival-authorization-status/v1';
const RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA = 'axm.review-operation-lease-retirement-publication-archival-authorization-status/v2';
const RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA_V2 = 'axm.review-operation-lease-retirement-publication-archival-result/v2';
const RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA = 'axm.review-operation-lease-retirement-publication-archival-result/v3';
const RETIREMENT_RECOVERY_REQUEST_SCHEMA = 'axm.review-operation-lease-retirement-recovery-request/v1';
const RETIREMENT_RECOVERY_RESULT_SCHEMA = 'axm.review-operation-lease-retirement-recovery-result/v1';
const RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA = 'axm.review-operation-lease-retirement-withdrawal-request/v1';
const RETIREMENT_WITHDRAWAL_RESULT_SCHEMA = 'axm.review-operation-lease-retirement-withdrawal-result/v1';
const RETIREMENT_ASSERTION = 'HOLDER_TERMINATED_OR_ABANDONED';
const RETIREMENT_WITHDRAWAL_ASSERTION = 'DO_NOT_CONTINUE_REVIEW_OPERATION_LEASE_RETIREMENT';
const RETIREMENT_CONFIRMATION_PREFIX = 'RETIRE REVIEW OPERATION LEASE ';
const RETIREMENT_RECOVERY_CONFIRMATION_PREFIX = 'RECOVER REVIEW OPERATION LEASE RETIREMENT ';
const RETIREMENT_WITHDRAWAL_CONFIRMATION_PREFIX = 'WITHDRAW REVIEW OPERATION LEASE RETIREMENT ';
const RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION = 'I_ASSERT_THE_RETIREMENT_PUBLICATION_STAGE_PUBLISHER_TERMINATED_OR_ABANDONED_THIS_STAGE';
const RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX = 'ARCHIVE REVIEW OPERATION LEASE RETIREMENT PUBLICATION STAGE ';
const RETIREMENT_RECOVERY_ACTIONS = Object.freeze(['RESUME_RETIREMENT','FINALIZE_RESULT']);
const RETIREMENT_DECISIONS = Object.freeze(['PROCEED_RETIREMENT','WITHDRAW_RETIREMENT_INTENT']);
const MAX_RETIREMENT_RECOVERY_RECORDS = 200;
const MAX_RETIREMENT_PUBLICATION_RECORDS = 200;
const MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES = 200;
const MAX_RETIREMENT_EVIDENCE_BYTES = 64 * 1024;
const DEFAULT_RECOVERY_CHECKPOINT_OBSERVE_MS = 250;
const DEFAULT_RECOVERY_CHECKPOINT_RETRY_MS = 5;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_MS = 20;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, milliseconds));
}

function monotonicMilliseconds() { return Number(process.hrtime.bigint() / 1000000n); }
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }

function validOwner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['acquiredAt','leaseId','processId','schema'])) return false;
  return value.schema === OWNER_SCHEMA &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.leaseId) &&
    Number.isInteger(value.processId) && value.processId > 0 &&
    Number.isFinite(Date.parse(value.acquiredAt)) && new Date(value.acquiredAt).toISOString() === value.acquiredAt;
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected.slice().sort());
}

function exactScalarObject(value, expected) {
  return exactKeys(value, Object.keys(expected)) && Object.keys(expected).every(key => value[key] === expected[key]);
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDigest(value) { return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value); }

function publicationStageIdentity(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(intent\.json|decision\.json|result\.json)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.stage$/i.exec(value);
  if (!match || value !== value.toLowerCase()) return null;
  return {
    retirementId:match[1].toLowerCase(), artifactKind:match[2].toLowerCase(), stageId:match[3].toLowerCase(),
    targetFile:match[1].toLowerCase() + '.' + match[2].toLowerCase(), archiveFile:value + '.archived'
  };
}

function publicationArchivalIntentFile(stageFile) {
  return publicationStageIdentity(stageFile) ? stageFile + '.archival-intent.json' : null;
}

function publicationArchivalIntentStageIdentity(value) {
  if (typeof value !== 'string' || value !== value.toLowerCase()) return null;
  const suffix = '.archival-intent.json';
  const match = /^(.+)\.archival-intent\.json\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.stage$/.exec(value);
  if (!match || !publicationStageIdentity(match[1])) return null;
  return { stageFile:match[1], intentFile:match[1] + suffix, publicationStageId:match[2] };
}

function publicationArchivalRequestDigest(input) {
  if (!input || typeof input !== 'object') return null;
  const closed = {
    schema:input.schema, stageFile:input.stageFile, stageDigest:input.stageDigest,
    assertion:input.assertion, confirmation:input.confirmation,
    reasonDigest:input.reasonDigest || publicationArchivalReasonDigest(input.reason)
  };
  return sha256(Buffer.from(JSON.stringify(closed), 'utf8'));
}

function publicationArchivalRequestDigestV1(input) {
  if (!input || typeof input !== 'object') return null;
  const closed = {
    schema:input.schema, stageFile:input.stageFile, stageDigest:input.stageDigest,
    assertion:input.assertion, confirmation:input.confirmation, reason:input.reason
  };
  return sha256(Buffer.from(JSON.stringify(closed), 'utf8'));
}

function publicationArchivalReasonDigest(reason) {
  return typeof reason === 'string' ? sha256(Buffer.from(reason, 'utf8')) : null;
}

function publicationArchivalReasonSummary(reason, stateRoot) {
  if (typeof reason !== 'string') return null;
  const redacted = Redaction.redactDiagnostic(reason, { workspaceRoot:stateRoot }).slice(0, 1000);
  return redacted === reason ? '<REASON_WITHHELD>' : redacted;
}

function validRetirementIntent(value, retirementId) {
  const keys = ['callerAssertion','confirmationMatched','observedAcquiredAt','observedProcessId','ownerDigest','ownerEvidenceValid','reason','recordedAt','retirementId','schema','state','status','truth'];
  return exactKeys(value, keys) && value.schema === RETIREMENT_INTENT_SCHEMA && value.status === 'TEST' &&
    value.state === 'AUTHORIZED_PENDING_RETIREMENT' && validUuid(value.retirementId) &&
    (!retirementId || value.retirementId === retirementId) && validIso(value.recordedAt) &&
    validDigest(value.ownerDigest) && typeof value.ownerEvidenceValid === 'boolean' &&
    (value.observedProcessId === null || (Number.isInteger(value.observedProcessId) && value.observedProcessId > 0)) &&
    (value.observedAcquiredAt === null || validIso(value.observedAcquiredAt)) &&
    value.callerAssertion === RETIREMENT_ASSERTION && typeof value.reason === 'string' &&
    value.reason.trim() === value.reason && value.reason.length >= 20 && value.reason.length <= 500 &&
    value.confirmationMatched === true &&
    exactScalarObject(value.truth, retirementTruth(false));
}

function validRetirementDecision(value, retirementId) {
  const keys = ['callerAssertion','decisionFile','intentDigest','intentFile','ownerDigest','reason','recordedAt','retirementId','schema','state','status','truth'];
  const assertion = value && value.state === 'PROCEED_RETIREMENT' ? RETIREMENT_ASSERTION : RETIREMENT_WITHDRAWAL_ASSERTION;
  return exactKeys(value, keys) && value.schema === RETIREMENT_DECISION_SCHEMA && value.status === 'TEST' &&
    RETIREMENT_DECISIONS.includes(value.state) && validUuid(value.retirementId) &&
    (!retirementId || value.retirementId === retirementId) && validIso(value.recordedAt) &&
    validDigest(value.ownerDigest) && validDigest(value.intentDigest) && value.callerAssertion === assertion &&
    typeof value.reason === 'string' && value.reason.trim() === value.reason && value.reason.length >= 20 && value.reason.length <= 500 &&
    value.intentFile === value.retirementId + '.intent.json' && value.decisionFile === value.retirementId + '.decision.json' &&
    exactScalarObject(value.truth, retirementDecisionTruth(value.state));
}

function validRetirementResult(value, retirementId) {
  const keys = ['callerAssertion','intentFile','observedAcquiredAt','observedProcessId','ownerDigest','ownerEvidenceValid','quarantinedOwnerEvidenceFile','reason','recordedAt','resultFile','retirementId','schema','state','status','truth'];
  return exactKeys(value, keys) && value.schema === RETIREMENT_RESULT_SCHEMA && value.status === 'TEST' &&
    value.state === 'RETIRED' && validUuid(value.retirementId) && (!retirementId || value.retirementId === retirementId) &&
    validIso(value.recordedAt) && validDigest(value.ownerDigest) && typeof value.ownerEvidenceValid === 'boolean' &&
    (value.observedProcessId === null || (Number.isInteger(value.observedProcessId) && value.observedProcessId > 0)) &&
    (value.observedAcquiredAt === null || validIso(value.observedAcquiredAt)) &&
    value.callerAssertion === RETIREMENT_ASSERTION && typeof value.reason === 'string' &&
    value.reason.trim() === value.reason && value.reason.length >= 20 && value.reason.length <= 500 &&
    value.intentFile === value.retirementId + '.intent.json' &&
    value.quarantinedOwnerEvidenceFile === value.retirementId + '.owner-evidence' &&
    value.resultFile === value.retirementId + '.result.json' &&
    exactScalarObject(value.truth, retirementTruth(true));
}

function validPublicationStageArtifact(value, identity) {
  if (!identity) return false;
  if (identity.artifactKind === 'intent.json') return validRetirementIntent(value, identity.retirementId);
  if (identity.artifactKind === 'decision.json') return validRetirementDecision(value, identity.retirementId);
  if (identity.artifactKind === 'result.json') return validRetirementResult(value, identity.retirementId);
  return false;
}

function validPublicationArchivalIntent(value, identity) {
  if (!value || !identity) return false;
  if (value.schema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1) {
    return validPublicationArchivalIntentV1(value, identity);
  }
  const keys = ['archiveFile','callerAssertion','confirmation','intentFile','reasonDigest','reasonRedacted','reasonRedactionApplied','recordedAt','requestDigest','schema','stageBytes','stageDigest','stageFile','state','status','targetFile','targetStateAtAuthorization','truth'];
  return exactKeys(value, keys) && value.schema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA &&
    value.status === 'TEST' && value.state === 'AUTHORIZED_PENDING_ARCHIVAL' && validIso(value.recordedAt) &&
    value.stageFile === identity.stageFile && validDigest(value.stageDigest) && Number.isInteger(value.stageBytes) &&
    value.stageBytes >= 0 && value.stageBytes <= MAX_RETIREMENT_EVIDENCE_BYTES &&
    value.targetFile === identity.targetFile && value.archiveFile === identity.archiveFile &&
    ['ABSENT','EXACT_MATCH'].includes(value.targetStateAtAuthorization) &&
    value.callerAssertion === RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION &&
    value.confirmation === RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + value.stageFile + ' ' + value.stageDigest &&
    validDigest(value.reasonDigest) && typeof value.reasonRedacted === 'string' &&
    value.reasonRedacted === value.reasonRedacted.trim() && value.reasonRedacted.length >= 1 && value.reasonRedacted.length <= 1000 &&
    Redaction.redactDiagnostic(value.reasonRedacted) === value.reasonRedacted && typeof value.reasonRedactionApplied === 'boolean' &&
    validDigest(value.requestDigest) && value.requestDigest === publicationArchivalRequestDigest({
      schema:RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA, stageFile:value.stageFile, stageDigest:value.stageDigest,
      assertion:value.callerAssertion, confirmation:value.confirmation, reasonDigest:value.reasonDigest
    }) && value.intentFile === publicationArchivalIntentFile(value.stageFile) &&
    exactScalarObject(value.truth, retirementPublicationArchivalIntentTruth());
}

function validPublicationArchivalIntentV1(value, identity) {
  const keys = ['archiveFile','callerAssertion','confirmation','intentFile','reason','recordedAt','requestDigest','schema','stageBytes','stageDigest','stageFile','state','status','targetFile','targetStateAtAuthorization','truth'];
  return exactKeys(value, keys) && value.schema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1 &&
    value.status === 'TEST' && value.state === 'AUTHORIZED_PENDING_ARCHIVAL' && validIso(value.recordedAt) &&
    value.stageFile === identity.stageFile && validDigest(value.stageDigest) && Number.isInteger(value.stageBytes) &&
    value.stageBytes >= 0 && value.stageBytes <= MAX_RETIREMENT_EVIDENCE_BYTES &&
    value.targetFile === identity.targetFile && value.archiveFile === identity.archiveFile &&
    ['ABSENT','EXACT_MATCH'].includes(value.targetStateAtAuthorization) &&
    value.callerAssertion === RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION &&
    value.confirmation === RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + value.stageFile + ' ' + value.stageDigest &&
    typeof value.reason === 'string' && value.reason === value.reason.trim() && value.reason.length >= 20 && value.reason.length <= 500 &&
    validDigest(value.requestDigest) && value.requestDigest === publicationArchivalRequestDigestV1({
      schema:RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA, stageFile:value.stageFile, stageDigest:value.stageDigest,
      assertion:value.callerAssertion, confirmation:value.confirmation, reason:value.reason
    }) && value.intentFile === publicationArchivalIntentFile(value.stageFile) &&
    exactScalarObject(value.truth, retirementPublicationArchivalIntentTruthV1());
}

function busyError(status) {
  const error = new Error('Review Inbox operation lease is held; it is never stolen automatically');
  error.code = 'REVIEW_OPERATION_BUSY';
  error.leaseStatus = status;
  return error;
}

function retirementError(message, plan) {
  const error = new Error(message);
  error.code = 'REVIEW_OPERATION_RETIREMENT_REFUSED';
  error.retirementPlan = plan || null;
  return error;
}

function retirementRecoveryError(message, status) {
  const error = new Error(message);
  error.code = 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED';
  error.retirementRecoveryStatus = status || null;
  return error;
}

function retirementWithdrawalError(message, status) {
  const error = new Error(message);
  error.code = 'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED';
  error.retirementRecoveryStatus = status || null;
  return error;
}

function retirementPublicationArchivalError(message, plan, authorizationStatus) {
  const error = new Error(message);
  error.code = 'REVIEW_OPERATION_RETIREMENT_PUBLICATION_ARCHIVAL_REFUSED';
  error.retirementPublicationStagePlan = plan || null;
  error.retirementPublicationArchivalAuthorizationStatus = authorizationStatus || null;
  return error;
}

function retirementTruth(ownerEvidenceQuarantined) {
  return {
    holderTerminatedOrAbandonedProven:false,
    retirementSafetyProven:false,
    falseAssertionCanViolateSerialization:true,
    callerAssertionRequired:true,
    exactOwnerDigestRequired:true,
    ownerEvidenceQuarantineRequired:true,
    ownerEvidenceQuarantined:ownerEvidenceQuarantined === true,
    currentProcessOwnerRetirementRefused:true,
    automaticRetirement:false,
    processLivenessInference:false,
    browserRoute:false,
    apiRoute:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementDecisionTruth(state) {
  return {
    exactIntentDigestRequired:true,
    exactOwnerDigestRequired:true,
    exclusiveDecisionCreateRequired:true,
    cooperatingSingleHostProceedWithdrawArbitration:true,
    withdrawalDecisionRecorded:state === 'WITHDRAW_RETIREMENT_INTENT',
    ownerLockMutationByDecision:false,
    ownerEvidenceQuarantinedByDecision:false,
    retirementCompletedByDecision:false,
    holderTerminatedOrAbandonedProven:false,
    holderLivenessProven:false,
    generalRetirementCancellationSafetyProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementWithdrawalTruth(values) {
  const input = values || {};
  return {
    intentExact:input.intentExact === true,
    decisionExact:input.decisionExact === true,
    ownerEvidenceDigestVerifiedAtObservation:input.ownerEvidenceDigestVerifiedAtObservation === true,
    appendOnlyWithdrawalEvidence:true,
    ownerLockMutatedByWithdrawal:false,
    cooperatingSingleHostProceedWithdrawArbitration:true,
    generalRetirementCancellationSafetyProven:false,
    holderTerminatedOrAbandonedProven:false,
    holderLivenessProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    realWorldIdentityProven:false,
    actualHumanParticipationProven:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementPublicationTruth() {
  return {
    cooperatingSingleHostHardLinkAtomicVisibility:true,
    completeBytesFsyncedBeforeHardLink:true,
    hardLinkPublicationNoOverwrite:true,
    authoritativePathNeverOpenedForWriteByPublisher:true,
    sameFilesystemHardLinkRequired:true,
    processCrashBeforeLinkLeavesAuthoritativePathAbsent:true,
    processCrashAfterLinkLeavesCompleteAuthoritativeBytes:true,
    stagingBytesAuthoritative:false,
    nonAuthoritativeStagingVisibleViaHostLocalStatus:true,
    staleStageReclamationProvided:false,
    hardLinkFreeAtomicFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementPublicationArchivalTruth(values) {
  const input = values || {};
  return {
    stageArtifactExact:input.stageArtifactExact === true,
    stageDigestVerified:input.stageDigestVerified === true,
    authoritativeTargetClassified:input.authoritativeTargetClassified === true,
    archiveDigestVerified:input.archiveDigestVerified === true,
    losslessArchiveBytesPreserved:input.losslessArchiveBytesPreserved === true,
    stagePathRemoved:input.stagePathRemoved === true,
    authoritativeTargetMutatedByArchival:false,
    ownerLockMutatedByArchival:false,
    explicitPublisherAbandonmentAssertionRequired:true,
    exactStageDigestConfirmationRequired:true,
    cooperatingSingleHostArchiveCheckpointConvergence:true,
    archiveHardLinkNoOverwrite:true,
    sameFilesystemHardLinkRequired:true,
    automaticArchival:false,
    processLivenessInference:false,
    publisherTerminatedOrAbandonedProven:false,
    falseAssertionCanInterruptLivePublication:true,
    durableArchivalAuthorizationRecordProvided:input.durableArchivalAuthorizationRecordProvided === true,
    stageBytesDeletedByArchival:false,
    storageSpaceReclaimed:false,
    archiveRetentionBounded:false,
    livePublisherSafetyProven:false,
    hardLinkFreeArchiveFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    realWorldIdentityProven:false,
    actualHumanParticipationProven:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementPublicationArchivalIntentTruthV1() {
  return {
    exactRequestDigestRequired:true,
    exactStageArtifactRequired:true,
    exactStageDigestRequired:true,
    exactTargetClassificationRecorded:true,
    appendOnlyIntentPublication:true,
    exclusiveIntentPublicationNoOverwrite:true,
    completeIntentBytesFsyncedBeforeHardLink:true,
    sameFilesystemHardLinkRequired:true,
    intentPublishedBeforeActiveStagePathRemoval:true,
    cooperatingSingleHostIntentPublicationConvergence:true,
    residualIntentPublicationStagesNonAuthoritative:true,
    residualIntentPublicationStagesVisibleViaHostLocalStatus:true,
    automaticIntentStageReclamation:false,
    durableArchivalAuthorizationRecordProvided:true,
    callerAssertionAuthenticated:false,
    processLivenessInference:false,
    publisherTerminatedOrAbandonedProven:false,
    falseAssertionCanInterruptLivePublication:true,
    livePublisherSafetyProven:false,
    stageBytesDeletedByAuthorization:false,
    storageSpaceReclaimed:false,
    hardLinkFreeIntentPublicationFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    realWorldIdentityProven:false,
    actualHumanParticipationProven:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementPublicationArchivalIntentTruth() {
  return Object.assign({}, retirementPublicationArchivalIntentTruthV1(), {
    exactReasonDigestRequired:true,
    exactRawReasonPersisted:false,
    recognizedCredentialRedactionPolicyApplied:true,
    machinePathRedactionPolicyApplied:true,
    arbitrarySecretAbsenceProven:false,
    commandLineHistorySanitized:false
  });
}

function retirementPublicationArchivalResultTruth(values) {
  return Object.assign({}, retirementPublicationArchivalTruth(values), {
    exactRawReasonReturned:false,
    recognizedCredentialRedactionPolicyApplied:true,
    machinePathRedactionPolicyApplied:true,
    arbitrarySecretAbsenceProven:false,
    commandLineHistorySanitized:false
  });
}

function retirementPublicationArchivalAuthorizationTruth(values) {
  const input = values || {};
  return {
    stageArtifactExact:input.stageArtifactExact === true,
    stageDigestVerified:input.stageDigestVerified === true,
    intentExact:input.intentExact === true,
    intentStageDigestBindingVerified:input.intentStageDigestBindingVerified === true,
    requestDigestStructurallyValid:input.requestDigestStructurallyValid === true,
    requestDigestRecomputedFromIntentFields:input.requestDigestRecomputedFromIntentFields === true,
    reasonDigestStructurallyValid:input.reasonDigestStructurallyValid === true,
    reasonDigestBoundToRequestDigest:input.reasonDigestBoundToRequestDigest === true,
    exactRawReasonPersisted:input.exactRawReasonPersisted === true,
    legacyRawReasonRecord:input.legacyRawReasonRecord === true,
    recognizedCredentialRedactionPolicyApplied:input.recognizedCredentialRedactionPolicyApplied === true,
    machinePathRedactionPolicyApplied:input.machinePathRedactionPolicyApplied === true,
    arbitrarySecretAbsenceProven:false,
    commandLineHistorySanitized:false,
    durableArchivalAuthorizationRecordProvided:input.intentExact === true,
    intentPublishedBeforeActiveStagePathRemoval:input.intentExact === true,
    boundedIntentPublicationStageStatus:true,
    residualIntentPublicationStagesAuthoritative:false,
    automaticIntentStageReclamation:false,
    callerAssertionAuthenticated:false,
    publisherTerminatedOrAbandonedProven:false,
    falseAssertionCanInterruptLivePublication:true,
    livePublisherSafetyProven:false,
    stageBytesDeletedByAuthorization:false,
    storageSpaceReclaimed:false,
    sameFilesystemHardLinkRequired:true,
    hardLinkFreeIntentPublicationFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    realWorldIdentityProven:false,
    actualHumanParticipationProven:false,
    browserRoute:false,
    apiRoute:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function retirementRecoveryTruth(values) {
  const input = values || {};
  return {
    intentExact:input.intentExact === true,
    retirementDecisionExact:input.retirementDecisionExact === true,
    withdrawalDecisionExact:input.withdrawalDecisionExact === true,
    ownerEvidenceDigestVerified:input.ownerEvidenceDigestVerified === true,
    retirementResultExact:input.retirementResultExact === true,
    explicitRecoveryConfirmationRequired:true,
    callerAssertionRequired:true,
    explicitIntentWithdrawalConfirmationRequired:true,
    cooperatingSingleHostProceedWithdrawDecisionArbitration:true,
    withdrawalOwnerLockMutation:false,
    cooperatingSingleHostRecoveryCheckpointConvergence:true,
    recoveryCheckpointObservationBounded:true,
    generalRecoverySerializationProven:false,
    retirementCancellationSafetyProven:false,
    generalRetirementCancellationSafetyProven:false,
    cooperatingSingleHostHardLinkAtomicVisibility:true,
    completeBytesFsyncedBeforeHardLink:true,
    hardLinkPublicationNoOverwrite:true,
    sameFilesystemHardLinkRequired:true,
    staleStageReclamationProvided:false,
    hardLinkFreeAtomicFallbackProvided:false,
    powerLossDurabilityProven:false,
    holderTerminatedOrAbandonedProven:false,
    recoverySafetyProven:false,
    falseAssertionCanViolateSerialization:true,
    automaticRecovery:false,
    processLivenessInference:false,
    browserRoute:false,
    apiRoute:false,
    crossFileAtomicityProven:false,
    nonCooperatingExternalWritersExcluded:false,
    protectedStorageOrRollbackPreventionProven:false,
    realWorldIdentityProven:false,
    actualHumanParticipationProven:false,
    executionAuthorized:false,
    adoptionAuthorized:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  };
}

function writeExclusiveJson(file, value, stagingDirectory, targetNameValidator) {
  if (!stagingDirectory) throw new Error('exclusive JSON publication requires a same-filesystem staging directory');
  const targetName = path.basename(file);
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(intent\.json|decision\.json|result\.json)$/i.exec(targetName);
  const targetAccepted = typeof targetNameValidator === 'function' ? targetNameValidator(targetName) === true : Boolean(match);
  if (!targetAccepted) throw new Error('exclusive JSON publication target is not an accepted retirement artifact');
  fs.mkdirSync(stagingDirectory, { recursive:true });
  const stageName = targetName + '.' + crypto.randomUUID() + '.stage';
  const stageFile = path.join(stagingDirectory, stageName);
  const bytes = JSON.stringify(value, null, 2) + '\n';
  let handle = null;
  try {
    handle = fs.openSync(stageFile, 'wx', 0o600);
    fs.writeFileSync(handle, bytes, 'utf8');
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    fs.linkSync(stageFile, file);
  } catch (error) {
    if (handle !== null) try { fs.closeSync(handle); } catch (_) {}
    try { fs.unlinkSync(stageFile); } catch (_) {}
    throw error;
  }
  try { fs.unlinkSync(stageFile); } catch (_) {}
}

function create(options) {
  if (!options || !options.stateRoot) throw new Error('review operation lease requires stateRoot');
  const stateRoot = path.resolve(String(options.stateRoot));
  const directory = path.join(stateRoot, 'review-inbox');
  const leaseFile = path.join(directory, 'operation.lock');
  const retirementsDirectory = path.join(directory, 'operation-lease-retirements');
  const retirementPublicationDirectory = path.join(directory, '.operation-lease-retirement-publication-staging');
  const retirementPublicationArchiveDirectory = path.join(directory, 'operation-lease-retirement-publication-archives');
  const retirementPublicationArchivalIntentDirectory = path.join(directory, 'operation-lease-retirement-publication-archival-intents');
  const retirementPublicationArchivalIntentStagingDirectory = path.join(directory, '.operation-lease-retirement-publication-archival-intent-staging');
  const timeoutMs = Number.isInteger(options.timeoutMs) ? Math.max(0, options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const retryMs = Number.isInteger(options.retryMs) ? Math.max(1, options.retryMs) : DEFAULT_RETRY_MS;
  const recoveryCheckpointObserveMs = Number.isInteger(options.recoveryCheckpointObserveMs) ? Math.max(0, Math.min(5000, options.recoveryCheckpointObserveMs)) : DEFAULT_RECOVERY_CHECKPOINT_OBSERVE_MS;
  const recoveryCheckpointRetryMs = Number.isInteger(options.recoveryCheckpointRetryMs) ? Math.max(1, Math.min(100, options.recoveryCheckpointRetryMs)) : DEFAULT_RECOVERY_CHECKPOINT_RETRY_MS;
  const processId = Number.isInteger(options.processId) && options.processId > 0 ? options.processId : process.pid;
  let depth = 0;
  let owned = null;

  function readEvidence() {
    let bytes;
    try { bytes = fs.readFileSync(leaseFile); }
    catch (error) {
      if (error.code === 'ENOENT') return { state:'FREE' };
      return { state:'UNREADABLE', errorCode:String(error.code || 'UNKNOWN') };
    }
    let owner = null, valid = false;
    try { owner = JSON.parse(bytes.toString('utf8')); valid = validOwner(owner); } catch (_) {}
    return { state:'PRESENT', bytes, digest:sha256(bytes), owner, valid };
  }

  function inspect() {
    const evidence = readEvidence();
    if (evidence.state === 'FREE') return {
        schema:STATUS_SCHEMA, state:'FREE', reasonCode:'NO_REVIEW_OPERATION_LEASE', acquiredAt:null,
        truth:truth(false, false)
      };
    if (evidence.state === 'UNREADABLE') return {
        schema:STATUS_SCHEMA, state:'HELD', reasonCode:'LEASE_EVIDENCE_UNREADABLE', acquiredAt:null,
        truth:truth(false, false)
      };
    return {
      schema:STATUS_SCHEMA, state:'HELD', reasonCode:evidence.valid ? 'REVIEW_OPERATION_LEASE_PRESENT' : 'LEASE_EVIDENCE_INVALID',
      acquiredAt:evidence.valid ? evidence.owner.acquiredAt : null,
      truth:truth(evidence.valid, owned && evidence.valid && evidence.owner.leaseId === owned.leaseId)
    };
  }

  function retirementPlan() {
    const evidence = readEvidence(), base = {
      schema:RETIREMENT_PLAN_SCHEMA, status:'TEST', ownerDigest:null, ownerEvidenceValid:false,
      processId:null, acquiredAt:null, assertionRequired:null, exactConfirmation:null,
      truth:retirementTruth(false)
    };
    if (evidence.state === 'FREE') return Object.assign(base, { state:'FREE', reasonCode:'NO_REVIEW_OPERATION_LEASE' });
    if (evidence.state === 'UNREADABLE') return Object.assign(base, { state:'HELD_UNREADABLE', reasonCode:'LEASE_EVIDENCE_UNREADABLE' });
    const currentProcess = evidence.valid && (
      evidence.owner.processId === process.pid ||
      (owned && evidence.owner.leaseId === owned.leaseId)
    );
    return Object.assign(base, {
      state:currentProcess ? 'HELD_BY_CURRENT_PROCESS' : 'RETIREMENT_REQUIRES_OPERATOR_ASSERTION',
      reasonCode:currentProcess ? 'CURRENT_PROCESS_OWNER_RETIREMENT_REFUSED' : (evidence.valid ? 'EXACT_OWNER_EVIDENCE_REQUIRES_ASSERTION' : 'INVALID_OWNER_EVIDENCE_REQUIRES_ASSERTION'),
      ownerDigest:evidence.digest,
      ownerEvidenceValid:evidence.valid,
      processId:evidence.valid ? evidence.owner.processId : null,
      acquiredAt:evidence.valid ? evidence.owner.acquiredAt : null,
      assertionRequired:currentProcess ? null : RETIREMENT_ASSERTION,
      exactConfirmation:currentProcess ? null : RETIREMENT_CONFIRMATION_PREFIX + evidence.digest
    });
  }

  function retireWithOperatorAssertion(input) {
    const plan = retirementPlan();
    if (plan.state !== 'RETIREMENT_REQUIRES_OPERATOR_ASSERTION') {
      throw retirementError('review operation lease is not eligible for explicit retirement', plan);
    }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(['assertion','confirmation','ownerDigest','reason','schema']) ||
      input.schema !== RETIREMENT_REQUEST_SCHEMA) {
      throw retirementError('review operation lease retirement requires the closed assertion input', plan);
    }
    const reason = String(input.reason || '').trim();
    if (reason.length < 20 || reason.length > 500) throw retirementError('retirement reason must contain 20 to 500 characters', plan);
    if (input.assertion !== RETIREMENT_ASSERTION) throw retirementError('exact holder termination or abandonment assertion is required', plan);
    if (input.ownerDigest !== plan.ownerDigest) throw retirementError('retirement owner digest does not match current evidence', plan);
    if (input.confirmation !== plan.exactConfirmation) throw retirementError('exact review operation lease retirement confirmation is required', plan);

    fs.mkdirSync(retirementsDirectory, { recursive:true });
    const retirementId = crypto.randomUUID(), recordedAt = new Date().toISOString();
    const intentName = retirementId + '.intent.json';
    const evidenceName = retirementId + '.owner-evidence';
    const resultName = retirementId + '.result.json';
    const intentFile = path.join(retirementsDirectory, intentName);
    const evidenceFile = path.join(retirementsDirectory, evidenceName);
    const resultFile = path.join(retirementsDirectory, resultName);
    const intent = {
      schema:RETIREMENT_INTENT_SCHEMA, status:'TEST', state:'AUTHORIZED_PENDING_RETIREMENT',
      retirementId, recordedAt, ownerDigest:plan.ownerDigest, ownerEvidenceValid:plan.ownerEvidenceValid,
      observedProcessId:plan.processId, observedAcquiredAt:plan.acquiredAt,
      callerAssertion:RETIREMENT_ASSERTION, reason, confirmationMatched:true,
      truth:retirementTruth(false)
    };
    writeExclusiveJson(intentFile, intent, retirementPublicationDirectory);
    const current = readEvidence();
    if (current.state !== 'PRESENT' || current.digest !== plan.ownerDigest) {
      throw retirementError('review operation owner evidence changed after retirement authorization', retirementPlan());
    }
    const decision = claimRetirementDecision(retirementArtifacts(retirementId), 'PROCEED_RETIREMENT', RETIREMENT_ASSERTION, reason);
    if (decision.state !== 'PROCEED_RETIREMENT') {
      throw retirementError('review operation lease retirement intent was withdrawn before owner evidence quarantine', retirementPlan());
    }
    const afterDecision = readEvidence();
    if (afterDecision.state !== 'PRESENT' || afterDecision.digest !== plan.ownerDigest) {
      throw retirementError('review operation owner evidence changed after proceed decision', retirementPlan());
    }
    fs.renameSync(leaseFile, evidenceFile);
    const quarantinedDigest = sha256(fs.readFileSync(evidenceFile));
    if (quarantinedDigest !== plan.ownerDigest) {
      throw retirementError('quarantined owner evidence does not match the authorized digest', retirementPlan());
    }
    const result = {
      schema:RETIREMENT_RESULT_SCHEMA, status:'TEST', state:'RETIRED', retirementId, recordedAt,
      ownerDigest:plan.ownerDigest, ownerEvidenceValid:plan.ownerEvidenceValid,
      observedProcessId:plan.processId, observedAcquiredAt:plan.acquiredAt,
      callerAssertion:RETIREMENT_ASSERTION, reason, intentFile:intentName,
      quarantinedOwnerEvidenceFile:evidenceName, resultFile:resultName,
      truth:retirementTruth(true)
    };
    writeExclusiveJson(resultFile, result, retirementPublicationDirectory);
    return result;
  }

  function recoveryConfirmation(action, retirementId, ownerDigest) {
    return RETIREMENT_RECOVERY_CONFIRMATION_PREFIX + action + ' ' + retirementId + ' ' + ownerDigest;
  }

  function withdrawalConfirmation(retirementId, ownerDigest) {
    return RETIREMENT_WITHDRAWAL_CONFIRMATION_PREFIX + retirementId + ' ' + ownerDigest;
  }

  function completedRecoveryResult(input, reason, artifact) {
    return {
      schema:RETIREMENT_RECOVERY_RESULT_SCHEMA, status:'TEST', state:'ALREADY_COMPLETE', retirementId:input.retirementId,
      action:input.action, ownerDigest:input.ownerDigest, recordedAt:new Date().toISOString(), reason,
      retirementResult:artifact.resultEvidence.value,
      truth:retirementRecoveryTruth({ intentExact:true, retirementDecisionExact:artifact.retirementDecisionExact, ownerEvidenceDigestVerified:true, retirementResultExact:true })
    };
  }

  function readRetirementFile(file) {
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) return { state:'INVALID_FILE_KIND' };
      if (stat.size > MAX_RETIREMENT_EVIDENCE_BYTES) return { state:'TOO_LARGE' };
      const bytes = fs.readFileSync(file);
      if (bytes.length > MAX_RETIREMENT_EVIDENCE_BYTES) return { state:'TOO_LARGE' };
      return { state:'PRESENT', bytes, digest:sha256(bytes) };
    } catch (error) {
      if (error.code === 'ENOENT') return { state:'MISSING' };
      return { state:'UNREADABLE', errorCode:String(error.code || 'UNKNOWN') };
    }
  }

  function parsedRetirementFile(file) {
    const evidence = readRetirementFile(file);
    if (evidence.state !== 'PRESENT') return evidence;
    try { return Object.assign(evidence, { value:JSON.parse(evidence.bytes.toString('utf8')) }); }
    catch (_) { return Object.assign(evidence, { state:'INVALID_JSON' }); }
  }

  function retirementArtifacts(retirementId) {
    const intentFile = retirementId + '.intent.json';
    const decisionFile = retirementId + '.decision.json';
    const evidenceFile = retirementId + '.owner-evidence';
    const resultFile = retirementId + '.result.json';
    const intentEvidence = parsedRetirementFile(path.join(retirementsDirectory, intentFile));
    const decisionEvidence = parsedRetirementFile(path.join(retirementsDirectory, decisionFile));
    const ownerEvidence = readRetirementFile(path.join(retirementsDirectory, evidenceFile));
    const resultEvidence = parsedRetirementFile(path.join(retirementsDirectory, resultFile));
    const intentExact = intentEvidence.state === 'PRESENT' && validRetirementIntent(intentEvidence.value, retirementId);
    const retirementDecisionExact = intentExact && decisionEvidence.state === 'PRESENT' && validRetirementDecision(decisionEvidence.value, retirementId) &&
      decisionEvidence.value.ownerDigest === intentEvidence.value.ownerDigest && decisionEvidence.value.intentDigest === intentEvidence.digest;
    const proceedDecisionExact = retirementDecisionExact && decisionEvidence.value.state === 'PROCEED_RETIREMENT';
    const withdrawalDecisionExact = retirementDecisionExact && decisionEvidence.value.state === 'WITHDRAW_RETIREMENT_INTENT';
    const ownerEvidenceDigestVerified = intentExact && ownerEvidence.state === 'PRESENT' && ownerEvidence.digest === intentEvidence.value.ownerDigest;
    const retirementResultExact = intentExact && ownerEvidenceDigestVerified && resultEvidence.state === 'PRESENT' &&
      (decisionEvidence.state === 'MISSING' || proceedDecisionExact) &&
      validRetirementResult(resultEvidence.value, retirementId) &&
      resultEvidence.value.ownerDigest === intentEvidence.value.ownerDigest &&
      resultEvidence.value.ownerEvidenceValid === intentEvidence.value.ownerEvidenceValid &&
      resultEvidence.value.observedProcessId === intentEvidence.value.observedProcessId &&
      resultEvidence.value.observedAcquiredAt === intentEvidence.value.observedAcquiredAt &&
      resultEvidence.value.callerAssertion === intentEvidence.value.callerAssertion &&
      resultEvidence.value.reason === intentEvidence.value.reason;
    return {
      retirementId, intentFile, decisionFile, evidenceFile, resultFile,
      intentEvidence, decisionEvidence, ownerEvidence, resultEvidence,
      intentExact, retirementDecisionExact, proceedDecisionExact, withdrawalDecisionExact, ownerEvidenceDigestVerified, retirementResultExact,
      ownerDigest:intentExact ? intentEvidence.value.ownerDigest : null
    };
  }

  function observeRetirementDecision(retirementId, ownerDigest) {
    const deadline = monotonicMilliseconds() + recoveryCheckpointObserveMs;
    let artifact;
    do {
      artifact = retirementArtifacts(retirementId);
      if (artifact.retirementDecisionExact && artifact.ownerDigest === ownerDigest) return artifact;
      if (artifact.decisionEvidence.state !== 'MISSING' && !['PRESENT','INVALID_JSON'].includes(artifact.decisionEvidence.state)) return artifact;
      const remaining = deadline - monotonicMilliseconds();
      if (remaining <= 0) break;
      sleep(Math.min(recoveryCheckpointRetryMs, remaining));
    } while (true);
    return artifact;
  }

  function claimRetirementDecision(artifact, state, assertion, reason) {
    if (!artifact.intentExact || !RETIREMENT_DECISIONS.includes(state)) return { state:'HELD', artifact };
    if (artifact.retirementDecisionExact) return { state:artifact.decisionEvidence.value.state, artifact, decision:artifact.decisionEvidence.value, created:false };
    if (artifact.decisionEvidence.state !== 'MISSING') return { state:'HELD', artifact };
    const decision = {
      schema:RETIREMENT_DECISION_SCHEMA, status:'TEST', state, retirementId:artifact.retirementId,
      recordedAt:new Date().toISOString(), ownerDigest:artifact.ownerDigest, intentDigest:artifact.intentEvidence.digest,
      callerAssertion:assertion, reason, intentFile:artifact.intentFile, decisionFile:artifact.decisionFile,
      truth:retirementDecisionTruth(state)
    };
    try { writeExclusiveJson(path.join(retirementsDirectory, artifact.decisionFile), decision, retirementPublicationDirectory); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const observed = observeRetirementDecision(artifact.retirementId, artifact.ownerDigest);
      if (observed.retirementDecisionExact) return { state:observed.decisionEvidence.value.state, artifact:observed, decision:observed.decisionEvidence.value, created:false };
      return { state:'HELD', artifact:observed };
    }
    const recorded = retirementArtifacts(artifact.retirementId);
    if (!recorded.retirementDecisionExact || recorded.decisionEvidence.value.state !== state) return { state:'HELD', artifact:recorded };
    return { state, artifact:recorded, decision:recorded.decisionEvidence.value, created:true };
  }

  function observeRecoveryCheckpoint(retirementId, ownerDigest, requireComplete) {
    const deadline = monotonicMilliseconds() + recoveryCheckpointObserveMs;
    let artifact;
    do {
      artifact = retirementArtifacts(retirementId);
      if (artifact.retirementResultExact && artifact.ownerDigest === ownerDigest) return { state:'COMPLETE', artifact };
      const exactQuarantine = artifact.intentExact && artifact.ownerDigest === ownerDigest && artifact.ownerEvidenceDigestVerified &&
        !artifact.withdrawalDecisionExact && (artifact.decisionEvidence.state === 'MISSING' || artifact.proceedDecisionExact) && artifact.resultEvidence.state === 'MISSING';
      if (!requireComplete && exactQuarantine) return { state:'QUARANTINED', artifact };
      const remaining = deadline - monotonicMilliseconds();
      if (remaining <= 0) break;
      sleep(Math.min(recoveryCheckpointRetryMs, remaining));
    } while (true);
    return { state:'HELD', artifact };
  }

  function recoveryRecord(artifact, state, reasonCode, actionRequired, values, withdrawalAvailable) {
    const ownerDigest = artifact && artifact.ownerDigest || null;
    return {
      retirementId:artifact && artifact.retirementId || null,
      state,
      reasonCode,
      ownerDigest,
      actionRequired:actionRequired || null,
      confirmationRequired:actionRequired && artifact.retirementId && ownerDigest ? recoveryConfirmation(actionRequired, artifact.retirementId, ownerDigest) : null,
      withdrawalConfirmationRequired:withdrawalAvailable && artifact.retirementId && ownerDigest ? withdrawalConfirmation(artifact.retirementId, ownerDigest) : null,
      intentFile:artifact && artifact.intentFile || null,
      decisionFile:artifact && artifact.decisionFile || null,
      decisionState:artifact && artifact.retirementDecisionExact ? artifact.decisionEvidence.value.state : null,
      quarantinedOwnerEvidenceFile:artifact && artifact.evidenceFile || null,
      resultFile:artifact && artifact.resultFile || null,
      truth:retirementRecoveryTruth(values)
    };
  }

  function retirementPublicationStatus() {
    let entries = [], directoryHandle = null;
    try {
      directoryHandle = fs.opendirSync(retirementPublicationDirectory);
      while (entries.length <= MAX_RETIREMENT_PUBLICATION_RECORDS) {
        const entry = directoryHandle.readSync();
        if (!entry) break;
        entries.push(entry);
      }
      entries.sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      if (error.code === 'ENOENT') entries = [];
      else return {
        schema:RETIREMENT_PUBLICATION_STATUS_SCHEMA, status:'TEST', state:'HELD', reasonCode:'RETIREMENT_PUBLICATION_STAGING_UNREADABLE',
        stagedCandidates:0, invalidEntries:1, records:[], recordsTruncated:false, truth:retirementPublicationTruth()
      };
    } finally { if (directoryHandle) try { directoryHandle.closeSync(); } catch (_) {} }
    const truncated = entries.length > MAX_RETIREMENT_PUBLICATION_RECORDS;
    const selected = entries.slice(0, MAX_RETIREMENT_PUBLICATION_RECORDS);
    const records = selected.map(entry => {
      const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(intent\.json|decision\.json|result\.json)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.stage$/i.exec(entry.name);
      const valid = Boolean(match && entry.isFile() && !entry.isSymbolicLink());
      return {
        file:entry.name,
        state:valid ? 'STAGED_NON_AUTHORITATIVE' : 'INVALID_STAGING_ENTRY',
        targetFile:valid ? match[1].toLowerCase() + '.' + match[2].toLowerCase() : null
      };
    });
    const invalidEntries = records.filter(record => record.state === 'INVALID_STAGING_ENTRY').length + (truncated ? 1 : 0);
    const stagedCandidates = records.filter(record => record.state === 'STAGED_NON_AUTHORITATIVE').length;
    return {
      schema:RETIREMENT_PUBLICATION_STATUS_SCHEMA, status:'TEST',
      state:invalidEntries ? 'HELD' : stagedCandidates ? 'STAGED' : 'CURRENT',
      reasonCode:truncated ? 'RETIREMENT_PUBLICATION_STAGING_LIMIT_EXCEEDED' : invalidEntries ? 'RETIREMENT_PUBLICATION_STAGING_INVALID' : stagedCandidates ? 'NON_AUTHORITATIVE_STAGED_PUBLICATIONS_PRESENT' : 'NO_STAGED_PUBLICATIONS',
      stagedCandidates, invalidEntries, records, recordsTruncated:truncated, truth:retirementPublicationTruth()
    };
  }

  function archivalConfirmation(stageFile, stageDigest) {
    return RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX + stageFile + ' ' + stageDigest;
  }

  function publicationArtifactEvidence(file, identity) {
    const evidence = parsedRetirementFile(file);
    if (evidence.state === 'PRESENT') evidence.artifactExact = validPublicationStageArtifact(evidence.value, identity);
    return evidence;
  }

  function retirementPublicationStagePlan(stageFile) {
    const identity = publicationStageIdentity(stageFile);
    const base = {
      schema:RETIREMENT_PUBLICATION_STAGE_PLAN_SCHEMA, status:'TEST', state:'HELD', reasonCode:'PUBLICATION_STAGE_NAME_INVALID',
      stageFile:typeof stageFile === 'string' ? stageFile : null, targetFile:null, archiveFile:null,
      stageDigest:null, stageBytes:null, targetState:null, archiveState:null,
      assertionRequired:null, confirmationRequired:null, truth:retirementPublicationArchivalTruth()
    };
    if (!identity) return base;
    base.targetFile = identity.targetFile;
    base.archiveFile = identity.archiveFile;
    const stagePath = path.join(retirementPublicationDirectory, stageFile);
    const archivePath = path.join(retirementPublicationArchiveDirectory, identity.archiveFile);
    const targetPath = path.join(retirementsDirectory, identity.targetFile);
    const stage = publicationArtifactEvidence(stagePath, identity);
    const archive = publicationArtifactEvidence(archivePath, identity);
    let source = null;
    if (stage.state === 'PRESENT') {
      if (!stage.artifactExact) return Object.assign(base, { reasonCode:'PUBLICATION_STAGE_ARTIFACT_INVALID' });
      source = stage;
    } else if (stage.state === 'MISSING') {
      if (archive.state !== 'PRESENT') {
        return Object.assign(base, { reasonCode:archive.state === 'MISSING' ? 'PUBLICATION_STAGE_AND_ARCHIVE_MISSING' : 'PUBLICATION_STAGE_ARCHIVE_EVIDENCE_HELD' });
      }
      if (!archive.artifactExact) return Object.assign(base, { reasonCode:'PUBLICATION_STAGE_ARCHIVE_ARTIFACT_INVALID' });
      source = archive;
    } else {
      return Object.assign(base, { reasonCode:'PUBLICATION_STAGE_EVIDENCE_HELD' });
    }
    base.stageDigest = source.digest;
    base.stageBytes = source.bytes.length;
    if (archive.state === 'MISSING') base.archiveState = 'MISSING';
    else if (archive.state === 'PRESENT' && archive.artifactExact && archive.digest === source.digest) base.archiveState = 'EXACT_MATCH';
    else if (archive.state === 'PRESENT' && archive.artifactExact) base.archiveState = 'CONFLICT';
    else if (archive.state === 'UNREADABLE') base.archiveState = 'UNREADABLE';
    else base.archiveState = 'INVALID';
    const target = readRetirementFile(targetPath);
    if (target.state === 'MISSING') base.targetState = 'ABSENT';
    else if (target.state === 'PRESENT' && target.digest === source.digest) base.targetState = 'EXACT_MATCH';
    else if (target.state === 'PRESENT') base.targetState = 'CONFLICT';
    else if (target.state === 'UNREADABLE') base.targetState = 'UNREADABLE';
    else base.targetState = 'INVALID';
    const values = {
      stageArtifactExact:true, stageDigestVerified:true, authoritativeTargetClassified:true,
      archiveDigestVerified:base.archiveState === 'EXACT_MATCH', losslessArchiveBytesPreserved:base.archiveState === 'EXACT_MATCH',
      stagePathRemoved:stage.state === 'MISSING' && base.archiveState === 'EXACT_MATCH'
    };
    base.truth = retirementPublicationArchivalTruth(values);
    if (['CONFLICT','INVALID','UNREADABLE'].includes(base.archiveState)) {
      base.reasonCode = base.archiveState === 'CONFLICT' ? 'PUBLICATION_STAGE_ARCHIVE_CONFLICT' : 'PUBLICATION_STAGE_ARCHIVE_EVIDENCE_HELD';
      return base;
    }
    if (['CONFLICT','INVALID','UNREADABLE'].includes(base.targetState)) {
      base.reasonCode = base.targetState === 'CONFLICT' ? 'AUTHORITATIVE_PUBLICATION_TARGET_CONFLICT' : 'AUTHORITATIVE_PUBLICATION_TARGET_EVIDENCE_HELD';
      return base;
    }
    if (stage.state === 'MISSING' && base.archiveState === 'EXACT_MATCH') {
      return Object.assign(base, { state:'ALREADY_ARCHIVED', reasonCode:'EXACT_PUBLICATION_STAGE_ALREADY_ARCHIVED' });
    }
    base.assertionRequired = RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION;
    base.confirmationRequired = archivalConfirmation(stageFile, source.digest);
    if (base.archiveState === 'EXACT_MATCH') {
      return Object.assign(base, { state:'ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK', reasonCode:'EXACT_ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK' });
    }
    return Object.assign(base, {
      state:'ARCHIVAL_REQUIRES_OPERATOR_ASSERTION',
      reasonCode:base.targetState === 'EXACT_MATCH' ? 'EXACT_REDUNDANT_STAGE_REQUIRES_ARCHIVAL_ASSERTION' : 'EXACT_UNPUBLISHED_STAGE_REQUIRES_ARCHIVAL_ASSERTION'
    });
  }

  function publicationArchivalIntentEvidence(stageFile) {
    const identity = publicationStageIdentity(stageFile), intentFile = publicationArchivalIntentFile(stageFile);
    if (!identity || !intentFile) return { state:'MISSING', intentExact:false };
    const evidence = parsedRetirementFile(path.join(retirementPublicationArchivalIntentDirectory, intentFile));
    evidence.intentExact = evidence.state === 'PRESENT' && validPublicationArchivalIntent(evidence.value, Object.assign({ stageFile }, identity));
    return evidence;
  }

  function publicationArchivalIntentStagingStatus(stageFile) {
    const intentFile = publicationArchivalIntentFile(stageFile);
    let entries = [], directoryHandle = null;
    try {
      directoryHandle = fs.opendirSync(retirementPublicationArchivalIntentStagingDirectory);
      while (entries.length <= MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES) {
        const entry = directoryHandle.readSync();
        if (!entry) break;
        entries.push(entry);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') return { residualIntentStages:0, invalidIntentStages:1, truncated:false, unreadable:true };
    } finally {
      if (directoryHandle) try { directoryHandle.closeSync(); } catch (_) {}
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    const truncated = entries.length > MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES;
    const visible = entries.slice(0, MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES);
    let residualIntentStages = 0, invalidIntentStages = truncated ? 1 : 0;
    for (const entry of visible) {
      const stageIdentity = publicationArchivalIntentStageIdentity(entry.name);
      if (!entry.isFile() || !stageIdentity) { invalidIntentStages += 1; continue; }
      const evidence = parsedRetirementFile(path.join(retirementPublicationArchivalIntentStagingDirectory, entry.name));
      const publicationIdentity = publicationStageIdentity(stageIdentity.stageFile);
      const exact = evidence.state === 'PRESENT' && validPublicationArchivalIntent(evidence.value, Object.assign({ stageFile:stageIdentity.stageFile }, publicationIdentity));
      if (!exact) { invalidIntentStages += 1; continue; }
      if (stageIdentity.intentFile === intentFile) residualIntentStages += 1;
    }
    return { residualIntentStages, invalidIntentStages, truncated, unreadable:false };
  }

  function retirementPublicationArchivalAuthorizationStatus(stageFile) {
    const plan = retirementPublicationStagePlan(stageFile);
    const identity = publicationStageIdentity(stageFile);
    const intentFile = publicationArchivalIntentFile(stageFile);
    const base = {
      schema:RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA, status:'TEST', state:'HELD', reasonCode:'PUBLICATION_STAGE_NAME_INVALID',
      stageFile:typeof stageFile === 'string' ? stageFile : null, targetFile:plan.targetFile, archiveFile:plan.archiveFile,
      stageDigest:plan.stageDigest, stageBytes:plan.stageBytes, stageState:plan.state, targetState:plan.targetState,
      intentFile, intentState:null, intentSchema:null, intentDigest:null, intentRecordedAt:null, requestDigest:null,
      reasonDigest:null, reasonRedactionApplied:null, exactRawReasonPersisted:null,
      residualIntentStages:0, invalidIntentStages:0, intentStagesTruncated:false,
      truth:retirementPublicationArchivalAuthorizationTruth({
        stageArtifactExact:plan.truth.stageArtifactExact, stageDigestVerified:plan.truth.stageDigestVerified
      })
    };
    if (!identity || !intentFile) return base;
    const staged = publicationArchivalIntentStagingStatus(stageFile);
    base.residualIntentStages = staged.residualIntentStages;
    base.invalidIntentStages = staged.invalidIntentStages;
    base.intentStagesTruncated = staged.truncated;
    const evidence = publicationArchivalIntentEvidence(stageFile);
    if (evidence.state === 'MISSING') base.intentState = 'MISSING';
    else if (evidence.state === 'PRESENT' && evidence.intentExact && evidence.value.stageDigest === plan.stageDigest) base.intentState = 'EXACT_STAGE_BINDING';
    else if (evidence.state === 'PRESENT' && evidence.intentExact) base.intentState = 'CONFLICT';
    else if (evidence.state === 'UNREADABLE') base.intentState = 'UNREADABLE';
    else base.intentState = 'INVALID';
    if (evidence.state === 'PRESENT') {
      base.intentDigest = evidence.digest;
      if (evidence.intentExact) {
        base.intentSchema = evidence.value.schema;
        base.intentRecordedAt = evidence.value.recordedAt;
        base.requestDigest = evidence.value.requestDigest;
        if (evidence.value.schema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA) {
          base.reasonDigest = evidence.value.reasonDigest;
          base.reasonRedactionApplied = evidence.value.reasonRedactionApplied;
          base.exactRawReasonPersisted = false;
        } else {
          base.exactRawReasonPersisted = true;
        }
      }
    }
    const intentExact = base.intentState === 'EXACT_STAGE_BINDING';
    const privateIntent = intentExact && base.intentSchema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA;
    const legacyRawIntent = intentExact && base.intentSchema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1;
    base.truth = retirementPublicationArchivalAuthorizationTruth({
      stageArtifactExact:plan.truth.stageArtifactExact, stageDigestVerified:plan.truth.stageDigestVerified,
      intentExact, intentStageDigestBindingVerified:intentExact,
      requestDigestStructurallyValid:intentExact && validDigest(base.requestDigest),
      requestDigestRecomputedFromIntentFields:intentExact,
      reasonDigestStructurallyValid:privateIntent && validDigest(base.reasonDigest),
      reasonDigestBoundToRequestDigest:privateIntent,
      exactRawReasonPersisted:legacyRawIntent, legacyRawReasonRecord:legacyRawIntent,
      recognizedCredentialRedactionPolicyApplied:privateIntent,
      machinePathRedactionPolicyApplied:privateIntent
    });
    if (staged.unreadable || staged.truncated) {
      return Object.assign(base, { reasonCode:staged.unreadable ? 'ARCHIVAL_INTENT_STAGING_UNREADABLE' : 'ARCHIVAL_INTENT_STAGING_LIMIT_EXCEEDED' });
    }
    if (plan.state === 'HELD') return Object.assign(base, { reasonCode:'PUBLICATION_STAGE_PLAN_HELD' });
    if (['CONFLICT','INVALID','UNREADABLE'].includes(base.intentState)) {
      return Object.assign(base, { reasonCode:base.intentState === 'CONFLICT' ? 'ARCHIVAL_INTENT_STAGE_DIGEST_CONFLICT' : 'ARCHIVAL_INTENT_EVIDENCE_HELD' });
    }
    if (privateIntent) return Object.assign(base, { state:'AUTHORIZED', reasonCode:'EXACT_DURABLE_PRIVATE_ARCHIVAL_INTENT_PRESENT' });
    if (legacyRawIntent) return Object.assign(base, { state:'LEGACY_AUTHORIZED_RAW_REASON', reasonCode:'EXACT_LEGACY_ARCHIVAL_INTENT_RETAINS_RAW_REASON' });
    if (['ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK','ALREADY_ARCHIVED'].includes(plan.state)) {
      return Object.assign(base, {
        state:'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN',
        reasonCode:plan.state === 'ALREADY_ARCHIVED'
          ? 'ARCHIVE_EXISTS_WITHOUT_DURABLE_ARCHIVAL_INTENT'
          : 'ARCHIVE_CHECKPOINT_EXISTS_WITHOUT_DURABLE_ARCHIVAL_INTENT'
      });
    }
    return Object.assign(base, {
      state:'AUTHORIZATION_REQUIRED',
      reasonCode:base.residualIntentStages || base.invalidIntentStages ? 'DURABLE_ARCHIVAL_INTENT_REQUIRED_WITH_NON_AUTHORITATIVE_STAGES' : 'DURABLE_ARCHIVAL_INTENT_REQUIRED'
    });
  }

  function archivalIntentMatchesRequest(value, input, identity) {
    if (!validPublicationArchivalIntent(value, Object.assign({ stageFile:input.stageFile }, identity)) ||
      value.stageDigest !== input.stageDigest || value.callerAssertion !== input.assertion || value.confirmation !== input.confirmation) return false;
    if (value.schema === RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1) {
      return value.reason === input.reason && value.requestDigest === publicationArchivalRequestDigestV1(input);
    }
    const reasonDigest = publicationArchivalReasonDigest(input.reason);
    const reasonRedacted = publicationArchivalReasonSummary(input.reason, stateRoot);
    return value.reasonDigest === reasonDigest && value.reasonRedacted === reasonRedacted &&
      value.reasonRedactionApplied === (reasonRedacted !== input.reason) &&
      value.requestDigest === publicationArchivalRequestDigest(Object.assign({}, input, { reasonDigest }));
  }

  function ensureRetirementPublicationArchivalIntent(input, plan) {
    const identity = publicationStageIdentity(input.stageFile), intentFile = publicationArchivalIntentFile(input.stageFile);
    let authorization = retirementPublicationArchivalAuthorizationStatus(input.stageFile);
    if (authorization.state === 'HELD') throw retirementPublicationArchivalError('durable archival intent evidence is held', plan, authorization);
    let evidence = publicationArchivalIntentEvidence(input.stageFile);
    if (evidence.state === 'PRESENT') {
      if (!archivalIntentMatchesRequest(evidence.value, input, identity)) {
        throw retirementPublicationArchivalError('durable archival intent conflicts with this exact request', plan, authorization);
      }
      return { evidence, authorization };
    }
    if (authorization.state === 'LEGACY_ARCHIVE_AUTHORIZATION_UNKNOWN') return null;
    const intent = {
      schema:RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA, status:'TEST', state:'AUTHORIZED_PENDING_ARCHIVAL', recordedAt:new Date().toISOString(),
      stageFile:input.stageFile, stageDigest:input.stageDigest, stageBytes:plan.stageBytes,
      targetFile:plan.targetFile, archiveFile:plan.archiveFile, targetStateAtAuthorization:plan.targetState,
      callerAssertion:input.assertion, confirmation:input.confirmation,
      reasonDigest:publicationArchivalReasonDigest(input.reason),
      reasonRedacted:publicationArchivalReasonSummary(input.reason, stateRoot),
      reasonRedactionApplied:publicationArchivalReasonSummary(input.reason, stateRoot) !== input.reason,
      requestDigest:publicationArchivalRequestDigest(input), intentFile,
      truth:retirementPublicationArchivalIntentTruth()
    };
    fs.mkdirSync(retirementPublicationArchivalIntentDirectory, { recursive:true });
    try {
      writeExclusiveJson(
        path.join(retirementPublicationArchivalIntentDirectory, intentFile), intent,
        retirementPublicationArchivalIntentStagingDirectory,
        targetName => targetName === intentFile
      );
    } catch (error) {
      if (error.code !== 'EEXIST') throw retirementPublicationArchivalError('durable archival intent publication failed: ' + String(error.code || 'UNKNOWN'), plan, retirementPublicationArchivalAuthorizationStatus(input.stageFile));
    }
    authorization = retirementPublicationArchivalAuthorizationStatus(input.stageFile);
    evidence = publicationArchivalIntentEvidence(input.stageFile);
    if (authorization.state !== 'AUTHORIZED' || evidence.state !== 'PRESENT' || !archivalIntentMatchesRequest(evidence.value, input, identity)) {
      throw retirementPublicationArchivalError('durable archival intent publication did not converge to the exact request', plan, authorization);
    }
    return { evidence, authorization };
  }

  function publicationArchivalResult(reason, plan, state, durableAuthorization) {
    const reasonRedacted = publicationArchivalReasonSummary(reason, stateRoot);
    return {
      schema:RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA, status:'TEST', state,
      recordedAt:new Date().toISOString(), stageFile:plan.stageFile, targetFile:plan.targetFile, archiveFile:plan.archiveFile,
      stageDigest:plan.stageDigest, stageBytes:plan.stageBytes, targetState:plan.targetState,
      reasonDigest:publicationArchivalReasonDigest(reason), reasonRedacted,
      reasonRedactionApplied:reasonRedacted !== reason,
      truth:retirementPublicationArchivalResultTruth({
        stageArtifactExact:true, stageDigestVerified:true, authoritativeTargetClassified:true,
        archiveDigestVerified:true, losslessArchiveBytesPreserved:true, stagePathRemoved:true,
        durableArchivalAuthorizationRecordProvided:durableAuthorization === true
      })
    };
  }

  function archiveRetirementPublicationStage(input) {
    const initial = retirementPublicationStagePlan(input && input.stageFile);
    const authorizationInitial = retirementPublicationArchivalAuthorizationStatus(input && input.stageFile);
    const expectedKeys = ['assertion','confirmation','reason','schema','stageDigest','stageFile'];
    if (!exactKeys(input, expectedKeys) || input.schema !== RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA ||
      !publicationStageIdentity(input.stageFile) || !validDigest(input.stageDigest) ||
      input.assertion !== RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION || typeof input.reason !== 'string' || input.reason !== input.reason.trim()) {
      throw retirementPublicationArchivalError('publication stage archival requires the closed exact assertion input', initial, authorizationInitial);
    }
    const reason = input.reason;
    if (reason.length < 20 || reason.length > 500) {
      throw retirementPublicationArchivalError('publication stage archival reason must contain 20 to 500 characters', initial, authorizationInitial);
    }
    if (initial.stageDigest !== input.stageDigest) {
      throw retirementPublicationArchivalError('publication stage digest does not match exact observed bytes', initial, authorizationInitial);
    }
    if (input.confirmation !== archivalConfirmation(input.stageFile, input.stageDigest)) {
      throw retirementPublicationArchivalError('exact publication stage archival confirmation is required', initial, authorizationInitial);
    }
    if (initial.state === 'HELD') throw retirementPublicationArchivalError('publication stage evidence is not eligible for lossless archival', initial, authorizationInitial);
    const durableIntent = ensureRetirementPublicationArchivalIntent(input, initial);
    if (!durableIntent) {
      if (initial.state !== 'ALREADY_ARCHIVED') {
        throw retirementPublicationArchivalError(
          'legacy archive checkpoint has no durable pre-mutation intent; active stage unlink is refused',
          initial,
          retirementPublicationArchivalAuthorizationStatus(input.stageFile)
        );
      }
      return publicationArchivalResult(reason, initial, 'LEGACY_ALREADY_ARCHIVED_AUTHORIZATION_UNKNOWN', false);
    }
    if (initial.state === 'ALREADY_ARCHIVED') return publicationArchivalResult(reason, initial, 'ALREADY_ARCHIVED', true);
    const identity = publicationStageIdentity(input.stageFile);
    const stagePath = path.join(retirementPublicationDirectory, input.stageFile);
    const archivePath = path.join(retirementPublicationArchiveDirectory, identity.archiveFile);
    let archiveCreated = false;
    const recoveringCheckpoint = initial.state === 'ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK';
    if (!recoveringCheckpoint) {
      fs.mkdirSync(retirementPublicationArchiveDirectory, { recursive:true });
      try { fs.linkSync(stagePath, archivePath); archiveCreated = true; }
      catch (error) {
        const observed = retirementPublicationStagePlan(input.stageFile);
        if (!['EEXIST','ENOENT'].includes(error.code) || observed.stageDigest !== input.stageDigest ||
          !['ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK','ALREADY_ARCHIVED'].includes(observed.state)) {
          throw retirementPublicationArchivalError('lossless publication stage archive hard-link checkpoint failed: ' + String(error.code || 'UNKNOWN'), observed, retirementPublicationArchivalAuthorizationStatus(input.stageFile));
        }
      }
    }
    const checkpoint = retirementPublicationStagePlan(input.stageFile);
    if (checkpoint.stageDigest !== input.stageDigest || checkpoint.archiveState !== 'EXACT_MATCH' ||
      !['ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK','ALREADY_ARCHIVED'].includes(checkpoint.state)) {
      throw retirementPublicationArchivalError('publication stage archive checkpoint did not converge to exact bytes', checkpoint, retirementPublicationArchivalAuthorizationStatus(input.stageFile));
    }
    if (checkpoint.state === 'ARCHIVE_CHECKPOINT_REQUIRES_STAGE_UNLINK') {
      try { fs.unlinkSync(stagePath); }
      catch (error) { if (error.code !== 'ENOENT') throw retirementPublicationArchivalError('publication stage unlink checkpoint failed: ' + String(error.code || 'UNKNOWN'), retirementPublicationStagePlan(input.stageFile), retirementPublicationArchivalAuthorizationStatus(input.stageFile)); }
    }
    const finalPlan = retirementPublicationStagePlan(input.stageFile);
    if (finalPlan.state !== 'ALREADY_ARCHIVED' || finalPlan.stageDigest !== input.stageDigest || finalPlan.archiveState !== 'EXACT_MATCH') {
      throw retirementPublicationArchivalError('publication stage archival did not converge to exact preserved archive bytes', finalPlan, retirementPublicationArchivalAuthorizationStatus(input.stageFile));
    }
    const finalAuthorization = retirementPublicationArchivalAuthorizationStatus(input.stageFile);
    if (!['AUTHORIZED','LEGACY_AUTHORIZED_RAW_REASON'].includes(finalAuthorization.state)) {
      throw retirementPublicationArchivalError('publication stage archival lost its exact durable authorization binding', finalPlan, finalAuthorization);
    }
    return publicationArchivalResult(reason, finalPlan, archiveCreated ? 'ARCHIVED' : 'RECOVERED_ARCHIVE_CHECKPOINT', true);
  }

  function retirementRecoveryStatus() {
    let entries = [], directoryHandle = null;
    try {
      directoryHandle = fs.opendirSync(retirementsDirectory);
      while (entries.length <= MAX_RETIREMENT_RECOVERY_RECORDS) {
        const entry = directoryHandle.readSync();
        if (!entry) break;
        entries.push(entry);
      }
      entries.sort((left, right) => left.name.localeCompare(right.name));
    }
    catch (error) {
      if (error.code === 'ENOENT') entries = [];
      else return {
        schema:RETIREMENT_RECOVERY_STATUS_SCHEMA, status:'TEST', state:'HELD', reasonCode:'RETIREMENT_EVIDENCE_DIRECTORY_UNREADABLE',
        totalRetirements:0, completeRetirements:0, recoveryRequiredRetirements:0, heldRetirements:1,
        records:[], recordsTruncated:false, truth:retirementRecoveryTruth()
      };
    }
    finally { if (directoryHandle) try { directoryHandle.closeSync(); } catch (_) {} }
    const truncated = entries.length > MAX_RETIREMENT_RECOVERY_RECORDS;
    const selected = entries.slice(0, MAX_RETIREMENT_RECOVERY_RECORDS);
    const groups = new Map(), invalidEntries = [];
    selected.forEach(entry => {
      const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(intent\.json|decision\.json|owner-evidence|result\.json)$/i.exec(entry.name);
      if (!match || !entry.isFile() || entry.isSymbolicLink()) { invalidEntries.push(entry.name); return; }
      const id = match[1].toLowerCase();
      if (!groups.has(id)) groups.set(id, retirementArtifacts(id));
    });
    const artifacts = Array.from(groups.values());
    const completeDigests = new Set(artifacts.filter(item => item.retirementResultExact).map(item => item.ownerDigest));
    const current = readEvidence();
    const resumableDigestCounts = new Map();
    artifacts.forEach(item => {
      if (item.intentExact && !item.withdrawalDecisionExact && item.ownerEvidence.state === 'MISSING' && item.resultEvidence.state === 'MISSING' &&
        current.state === 'PRESENT' && current.digest === item.ownerDigest && !completeDigests.has(item.ownerDigest)) {
        resumableDigestCounts.set(item.ownerDigest, (resumableDigestCounts.get(item.ownerDigest) || 0) + 1);
      }
    });
    const records = artifacts.map(item => {
      const values = { intentExact:item.intentExact, retirementDecisionExact:item.retirementDecisionExact, withdrawalDecisionExact:item.withdrawalDecisionExact, ownerEvidenceDigestVerified:item.ownerEvidenceDigestVerified, retirementResultExact:item.retirementResultExact };
      if (!item.intentExact) return recoveryRecord(item, 'HELD', item.intentEvidence.state === 'MISSING' ? 'RETIREMENT_INTENT_MISSING' : 'RETIREMENT_INTENT_INVALID', null, values);
      if (item.decisionEvidence.state !== 'MISSING' && !item.retirementDecisionExact) return recoveryRecord(item, 'HELD', 'RETIREMENT_DECISION_INVALID', null, values);
      if (item.withdrawalDecisionExact) {
        if (item.ownerEvidence.state !== 'MISSING' || item.resultEvidence.state !== 'MISSING') return recoveryRecord(item, 'HELD', 'WITHDRAWN_RETIREMENT_HAS_LATER_EVIDENCE', null, values);
        return recoveryRecord(item, 'WITHDRAWN', 'RETIREMENT_INTENT_EXPLICITLY_WITHDRAWN', null, values);
      }
      if (item.retirementResultExact) return recoveryRecord(item, 'COMPLETE', 'EXACT_RETIREMENT_EVIDENCE_COMPLETE', null, values);
      if (item.ownerEvidence.state === 'PRESENT') {
        if (!item.ownerEvidenceDigestVerified) return recoveryRecord(item, 'HELD', 'QUARANTINED_OWNER_DIGEST_MISMATCH', null, values);
        if (item.resultEvidence.state !== 'MISSING') return recoveryRecord(item, 'HELD', 'RETIREMENT_RESULT_INVALID', null, values);
        return recoveryRecord(item, 'RECOVERY_REQUIRED', 'QUARANTINED_OWNER_EVIDENCE_REQUIRES_RESULT', 'FINALIZE_RESULT', values);
      }
      if (item.ownerEvidence.state !== 'MISSING') return recoveryRecord(item, 'HELD', 'QUARANTINED_OWNER_EVIDENCE_INVALID', null, values);
      if (item.resultEvidence.state !== 'MISSING') return recoveryRecord(item, 'HELD', 'RESULT_WITHOUT_QUARANTINED_OWNER_EVIDENCE', null, values);
      if (completeDigests.has(item.ownerDigest)) return recoveryRecord(item, 'SUPERSEDED', 'SAME_OWNER_RETIREMENT_COMPLETED_ELSEWHERE', null, values);
      if (current.state === 'UNREADABLE') return recoveryRecord(item, 'HELD', 'CURRENT_OWNER_EVIDENCE_UNREADABLE', null, values);
      if (current.state === 'FREE') return recoveryRecord(item, 'HELD', 'CURRENT_OWNER_EVIDENCE_MISSING', null, values);
      if (current.digest !== item.ownerDigest) return recoveryRecord(item, 'HELD', 'CURRENT_OWNER_EVIDENCE_CHANGED', null, values);
      const withdrawalAvailable = item.decisionEvidence.state === 'MISSING';
      if (resumableDigestCounts.get(item.ownerDigest) > 1) return recoveryRecord(item, 'HELD', 'AMBIGUOUS_PENDING_RETIREMENT_INTENTS', null, values, withdrawalAvailable);
      if (current.valid && (current.owner.processId === process.pid || (owned && current.owner.leaseId === owned.leaseId))) {
        return recoveryRecord(item, 'HELD', 'CURRENT_PROCESS_OWNER_RECOVERY_REFUSED', null, values, withdrawalAvailable);
      }
      return recoveryRecord(item, 'RECOVERY_REQUIRED', item.proceedDecisionExact ? 'EXACT_PROCEED_DECISION_REQUIRES_RESUME' : 'EXACT_OWNER_EVIDENCE_REQUIRES_DECISION', 'RESUME_RETIREMENT', values, withdrawalAvailable);
    });
    invalidEntries.forEach(name => records.push({
      retirementId:null, state:'HELD', reasonCode:'UNRECOGNIZED_RETIREMENT_EVIDENCE', ownerDigest:null,
      actionRequired:null, confirmationRequired:null, withdrawalConfirmationRequired:null, intentFile:name, decisionFile:null, decisionState:null, quarantinedOwnerEvidenceFile:null, resultFile:null,
      truth:retirementRecoveryTruth()
    }));
    const held = records.filter(record => record.state === 'HELD').length + (truncated ? 1 : 0);
    const required = records.filter(record => record.state === 'RECOVERY_REQUIRED').length;
    const complete = records.filter(record => ['COMPLETE','SUPERSEDED'].includes(record.state)).length;
    const aggregateTruth = records.length ? {
      intentExact:records.every(record => record.truth.intentExact),
      retirementDecisionExact:records.every(record => record.truth.retirementDecisionExact),
      withdrawalDecisionExact:records.every(record => record.truth.withdrawalDecisionExact),
      ownerEvidenceDigestVerified:records.every(record => record.truth.ownerEvidenceDigestVerified),
      retirementResultExact:records.every(record => record.truth.retirementResultExact)
    } : {};
    return {
      schema:RETIREMENT_RECOVERY_STATUS_SCHEMA, status:'TEST',
      state:held ? 'HELD' : required ? 'RECOVERY_REQUIRED' : 'CURRENT',
      reasonCode:truncated ? 'RETIREMENT_RECOVERY_EVIDENCE_LIMIT_EXCEEDED' : held ? 'RETIREMENT_RECOVERY_EVIDENCE_HELD' : required ? 'INTERRUPTED_RETIREMENT_RECOVERY_REQUIRED' : records.some(record => record.state === 'WITHDRAWN') ? 'WITHDRAWN_RETIREMENT_INTENTS_CURRENT' : 'ALL_RETIREMENT_EVIDENCE_COMPLETE',
      totalRetirements:records.length + (truncated ? 1 : 0), completeRetirements:complete, recoveryRequiredRetirements:required,
      heldRetirements:held, records, recordsTruncated:truncated,
      truth:retirementRecoveryTruth(aggregateTruth)
    };
  }

  function recoverRetirement(input) {
    const status = retirementRecoveryStatus();
    const expectedKeys = ['action','assertion','confirmation','ownerDigest','reason','retirementId','schema'];
    if (!exactKeys(input, expectedKeys) || input.schema !== RETIREMENT_RECOVERY_REQUEST_SCHEMA ||
      !validUuid(input.retirementId) || !RETIREMENT_RECOVERY_ACTIONS.includes(input.action) ||
      !validDigest(input.ownerDigest) || input.assertion !== RETIREMENT_ASSERTION || typeof input.reason !== 'string') {
      throw retirementRecoveryError('interrupted retirement recovery requires the closed exact assertion input', status);
    }
    const reason = String(input.reason || '').trim();
    if (reason.length < 20 || reason.length > 500) throw retirementRecoveryError('recovery reason must contain 20 to 500 characters', status);
    const expectedConfirmation = recoveryConfirmation(input.action, input.retirementId, input.ownerDigest);
    if (input.confirmation !== expectedConfirmation) throw retirementRecoveryError('exact interrupted retirement recovery confirmation is required', status);
    const record = status.records.find(item => item.retirementId === input.retirementId);
    if (!record) throw retirementRecoveryError('interrupted retirement evidence was not found', status);
    if (record.ownerDigest !== input.ownerDigest) throw retirementRecoveryError('recovery owner digest does not match the interrupted retirement evidence', status);
    if (record.state === 'COMPLETE') {
      const complete = retirementArtifacts(input.retirementId);
      return completedRecoveryResult(input, reason, complete);
    }
    if (record.state !== 'RECOVERY_REQUIRED' || record.actionRequired !== input.action) {
      throw retirementRecoveryError('interrupted retirement evidence is not recoverable by the requested action', status);
    }
    let artifact = retirementArtifacts(input.retirementId);
    if (!artifact.intentExact || artifact.ownerDigest !== input.ownerDigest) {
      throw retirementRecoveryError('retirement intent changed after recovery authorization', retirementRecoveryStatus());
    }
    if (input.action === 'RESUME_RETIREMENT') {
      const current = readEvidence();
      if (current.state !== 'PRESENT' || current.digest !== input.ownerDigest) {
        throw retirementRecoveryError('current owner evidence changed after recovery authorization', retirementRecoveryStatus());
      }
      if (current.valid && (current.owner.processId === process.pid || (owned && current.owner.leaseId === owned.leaseId))) {
        throw retirementRecoveryError('current-process owner retirement recovery is refused', retirementRecoveryStatus());
      }
      if (artifact.ownerEvidence.state !== 'MISSING' || artifact.resultEvidence.state !== 'MISSING') {
        throw retirementRecoveryError('retirement recovery targets changed after authorization', retirementRecoveryStatus());
      }
      const decision = claimRetirementDecision(artifact, 'PROCEED_RETIREMENT', RETIREMENT_ASSERTION, reason);
      if (decision.state !== 'PROCEED_RETIREMENT') {
        throw retirementRecoveryError('retirement recovery proceed decision conflicts with exact withdrawal or invalid decision evidence', retirementRecoveryStatus());
      }
      artifact = decision.artifact;
      const afterDecision = readEvidence();
      if (afterDecision.state !== 'PRESENT' || afterDecision.digest !== input.ownerDigest) {
        throw retirementRecoveryError('current owner evidence changed after recovery proceed decision', retirementRecoveryStatus());
      }
      try { fs.renameSync(leaseFile, path.join(retirementsDirectory, artifact.evidenceFile)); }
      catch (error) {
        if (!['ENOENT','EEXIST','EPERM'].includes(error.code)) throw error;
        const observed = observeRecoveryCheckpoint(input.retirementId, input.ownerDigest, false);
        if (observed.state === 'COMPLETE') return completedRecoveryResult(input, reason, observed.artifact);
        if (observed.state !== 'QUARANTINED') {
          throw retirementRecoveryError('concurrent retirement recovery quarantine checkpoint did not converge to exact evidence', retirementRecoveryStatus());
        }
        artifact = observed.artifact;
      }
    }
    const quarantined = readRetirementFile(path.join(retirementsDirectory, artifact.evidenceFile));
    if (quarantined.state !== 'PRESENT' || quarantined.digest !== input.ownerDigest) {
      throw retirementRecoveryError('quarantined owner evidence does not match the recovery digest', retirementRecoveryStatus());
    }
    const intent = artifact.intentEvidence.value;
    const result = {
      schema:RETIREMENT_RESULT_SCHEMA, status:'TEST', state:'RETIRED', retirementId:input.retirementId,
      recordedAt:new Date().toISOString(), ownerDigest:intent.ownerDigest, ownerEvidenceValid:intent.ownerEvidenceValid,
      observedProcessId:intent.observedProcessId, observedAcquiredAt:intent.observedAcquiredAt,
      callerAssertion:intent.callerAssertion, reason:intent.reason, intentFile:artifact.intentFile,
      quarantinedOwnerEvidenceFile:artifact.evidenceFile, resultFile:artifact.resultFile,
      truth:retirementTruth(true)
    };
    try { writeExclusiveJson(path.join(retirementsDirectory, artifact.resultFile), result, retirementPublicationDirectory); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const observed = observeRecoveryCheckpoint(input.retirementId, input.ownerDigest, true);
      if (observed.state === 'COMPLETE') return completedRecoveryResult(input, reason, observed.artifact);
      throw retirementRecoveryError('concurrent retirement recovery result checkpoint did not converge to exact evidence', retirementRecoveryStatus());
    }
    return {
      schema:RETIREMENT_RECOVERY_RESULT_SCHEMA, status:'TEST', state:'RECOVERED', retirementId:input.retirementId,
      action:input.action, ownerDigest:input.ownerDigest, recordedAt:new Date().toISOString(), reason,
      retirementResult:result,
      truth:retirementRecoveryTruth({ intentExact:true, retirementDecisionExact:artifact.retirementDecisionExact, ownerEvidenceDigestVerified:true, retirementResultExact:true })
    };
  }

  function withdrawalResult(input, reason, artifact, state, ownerEvidenceDigestVerifiedAtObservation) {
    return {
      schema:RETIREMENT_WITHDRAWAL_RESULT_SCHEMA, status:'TEST', state, retirementId:input.retirementId,
      ownerDigest:input.ownerDigest, recordedAt:new Date().toISOString(), reason,
      retirementDecision:artifact.decisionEvidence.value,
      truth:retirementWithdrawalTruth({ intentExact:true, decisionExact:true, ownerEvidenceDigestVerifiedAtObservation })
    };
  }

  function withdrawRetirement(input) {
    const status = retirementRecoveryStatus();
    const expectedKeys = ['assertion','confirmation','ownerDigest','reason','retirementId','schema'];
    if (!exactKeys(input, expectedKeys) || input.schema !== RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA ||
      !validUuid(input.retirementId) || !validDigest(input.ownerDigest) ||
      input.assertion !== RETIREMENT_WITHDRAWAL_ASSERTION || typeof input.reason !== 'string') {
      throw retirementWithdrawalError('retirement intent withdrawal requires the closed exact assertion input', status);
    }
    const reason = String(input.reason || '').trim();
    if (reason.length < 20 || reason.length > 500) throw retirementWithdrawalError('withdrawal reason must contain 20 to 500 characters', status);
    if (input.confirmation !== withdrawalConfirmation(input.retirementId, input.ownerDigest)) {
      throw retirementWithdrawalError('exact retirement intent withdrawal confirmation is required', status);
    }
    const record = status.records.find(item => item.retirementId === input.retirementId);
    if (!record) throw retirementWithdrawalError('retirement intent evidence was not found', status);
    if (record.ownerDigest !== input.ownerDigest) throw retirementWithdrawalError('withdrawal owner digest does not match the retirement intent', status);
    let artifact = retirementArtifacts(input.retirementId);
    if (artifact.withdrawalDecisionExact && artifact.ownerDigest === input.ownerDigest &&
      artifact.ownerEvidence.state === 'MISSING' && artifact.resultEvidence.state === 'MISSING') {
      const current = readEvidence();
      return withdrawalResult(input, reason, artifact, 'ALREADY_WITHDRAWN', current.state === 'PRESENT' && current.digest === input.ownerDigest);
    }
    if (!artifact.intentExact || artifact.ownerDigest !== input.ownerDigest || artifact.decisionEvidence.state !== 'MISSING' ||
      artifact.ownerEvidence.state !== 'MISSING' || artifact.resultEvidence.state !== 'MISSING') {
      throw retirementWithdrawalError('retirement evidence is not an undecided intent-only withdrawal candidate', status);
    }
    const current = readEvidence();
    if (current.state !== 'PRESENT' || current.digest !== input.ownerDigest) {
      throw retirementWithdrawalError('current owner evidence does not match the retirement intent withdrawal digest', status);
    }
    const decision = claimRetirementDecision(artifact, 'WITHDRAW_RETIREMENT_INTENT', RETIREMENT_WITHDRAWAL_ASSERTION, reason);
    if (decision.state !== 'WITHDRAW_RETIREMENT_INTENT') {
      throw retirementWithdrawalError('retirement intent already has a proceed decision or invalid decision evidence', retirementRecoveryStatus());
    }
    artifact = decision.artifact;
    const afterDecision = readEvidence();
    const ownerExact = afterDecision.state === 'PRESENT' && afterDecision.digest === input.ownerDigest;
    return withdrawalResult(input, reason, artifact, decision.created ? 'WITHDRAWN' : 'ALREADY_WITHDRAWN', ownerExact);
  }

  function truth(ownerEvidenceValid, heldByThisInstance) {
    return {
      ownerEvidenceValid:ownerEvidenceValid === true,
      heldByThisServiceInstance:heldByThisInstance === true,
      cooperatingSingleHostReviewMutationsSerialized:true,
      nonCooperatingExternalWritersExcluded:false,
      crossFileAtomicityProven:false,
      multiHostOrNetworkFilesystemSafetyProven:false,
      staleOwnerOrProcessDeathProven:false,
      automaticStaleLeaseTheft:false,
      browserRecoveryRoute:false,
      protectedStorageOrRollbackPreventionProven:false,
      executionAuthorized:false,
      adoptionAuthorized:false,
      promotionAuthorized:false,
      mergeAuthorized:false,
      canonAuthorized:false
    };
  }

  function acquire() {
    if (depth > 0 && owned) { depth += 1; return; }
    fs.mkdirSync(directory, { recursive:true });
    const deadline = monotonicMilliseconds() + timeoutMs;
    let handle = null;
    while (handle === null) {
      try { handle = fs.openSync(leaseFile, 'wx', 0o600); }
      catch (error) {
        if (!['EEXIST','EPERM'].includes(error.code)) throw error;
        const remaining = deadline - monotonicMilliseconds();
        if (remaining <= 0) {
          const status = inspect();
          throw busyError(status.state === 'FREE' && error.code === 'EPERM' ? {
            schema:STATUS_SCHEMA, state:'HELD', reasonCode:'LEASE_EVIDENCE_UNREADABLE', acquiredAt:null,
            truth:truth(false, false)
          } : status);
        }
        sleep(Math.min(retryMs, remaining));
      }
    }
    const owner = { schema:OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId, acquiredAt:new Date().toISOString() };
    try {
      fs.writeFileSync(handle, JSON.stringify(owner) + '\n', 'utf8');
      fs.fsyncSync(handle);
    } catch (error) {
      try { fs.closeSync(handle); } catch (_) {}
      try {
        const current = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
        if (validOwner(current) && current.leaseId === owner.leaseId) fs.unlinkSync(leaseFile);
      } catch (_) {}
      throw error;
    }
    owned = { handle, leaseId:owner.leaseId };
    depth = 1;
  }

  function release() {
    if (!owned || depth < 1) throw new Error('review operation lease release has no matching acquire');
    depth -= 1;
    if (depth > 0) return;
    const current = owned;
    owned = null;
    try { fs.closeSync(current.handle); } catch (_) {}
    try {
      const value = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
      if (validOwner(value) && value.leaseId === current.leaseId) fs.unlinkSync(leaseFile);
    } catch (_) {
      // Missing or altered evidence stays fail-closed for explicit operator inspection.
    }
  }

  function withExclusive(callback) {
    if (typeof callback !== 'function') throw new Error('review operation lease requires a synchronous callback');
    acquire();
    try {
      const result = callback();
      if (result && typeof result.then === 'function') throw new Error('review operation lease callback must be synchronous');
      return result;
    } finally { release(); }
  }

  return {
    OWNER_SCHEMA, STATUS_SCHEMA, RETIREMENT_PLAN_SCHEMA, RETIREMENT_REQUEST_SCHEMA, RETIREMENT_INTENT_SCHEMA, RETIREMENT_DECISION_SCHEMA, RETIREMENT_RESULT_SCHEMA,
    RETIREMENT_RECOVERY_STATUS_SCHEMA, RETIREMENT_PUBLICATION_STATUS_SCHEMA, RETIREMENT_PUBLICATION_STAGE_PLAN_SCHEMA, RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
    RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1, RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA,
    RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA_V1, RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA,
    RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA_V2, RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA,
    RETIREMENT_RECOVERY_REQUEST_SCHEMA, RETIREMENT_RECOVERY_RESULT_SCHEMA,
    RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA, RETIREMENT_WITHDRAWAL_RESULT_SCHEMA,
    RETIREMENT_ASSERTION, RETIREMENT_WITHDRAWAL_ASSERTION, RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,
    RETIREMENT_CONFIRMATION_PREFIX, RETIREMENT_RECOVERY_CONFIRMATION_PREFIX, RETIREMENT_WITHDRAWAL_CONFIRMATION_PREFIX, RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX,
    RETIREMENT_RECOVERY_ACTIONS, RETIREMENT_DECISIONS,
    stateRoot, directory, leaseFile, retirementsDirectory, retirementPublicationDirectory, retirementPublicationArchiveDirectory,
    retirementPublicationArchivalIntentDirectory, retirementPublicationArchivalIntentStagingDirectory,
    inspect, retirementPlan, retireWithOperatorAssertion, retirementRecoveryStatus, retirementPublicationStatus, retirementPublicationStagePlan,
    retirementPublicationArchivalAuthorizationStatus, archiveRetirementPublicationStage,
    recoverRetirement, withdrawRetirement, withExclusive
  };
}

module.exports = {
  OWNER_SCHEMA, STATUS_SCHEMA, RETIREMENT_PLAN_SCHEMA, RETIREMENT_REQUEST_SCHEMA, RETIREMENT_INTENT_SCHEMA, RETIREMENT_DECISION_SCHEMA, RETIREMENT_RESULT_SCHEMA,
  RETIREMENT_RECOVERY_STATUS_SCHEMA, RETIREMENT_PUBLICATION_STATUS_SCHEMA, RETIREMENT_PUBLICATION_STAGE_PLAN_SCHEMA, RETIREMENT_PUBLICATION_ARCHIVAL_REQUEST_SCHEMA,
  RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA_V1, RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_SCHEMA,
  RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA_V1, RETIREMENT_PUBLICATION_ARCHIVAL_AUTHORIZATION_STATUS_SCHEMA,
  RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA_V2, RETIREMENT_PUBLICATION_ARCHIVAL_RESULT_SCHEMA,
  RETIREMENT_RECOVERY_REQUEST_SCHEMA, RETIREMENT_RECOVERY_RESULT_SCHEMA,
  RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA, RETIREMENT_WITHDRAWAL_RESULT_SCHEMA,
  RETIREMENT_ASSERTION, RETIREMENT_WITHDRAWAL_ASSERTION, RETIREMENT_PUBLICATION_ARCHIVAL_ASSERTION,
  RETIREMENT_CONFIRMATION_PREFIX, RETIREMENT_RECOVERY_CONFIRMATION_PREFIX, RETIREMENT_WITHDRAWAL_CONFIRMATION_PREFIX, RETIREMENT_PUBLICATION_ARCHIVAL_CONFIRMATION_PREFIX,
  RETIREMENT_RECOVERY_ACTIONS, RETIREMENT_DECISIONS,
  MAX_RETIREMENT_RECOVERY_RECORDS, MAX_RETIREMENT_PUBLICATION_RECORDS, MAX_RETIREMENT_PUBLICATION_ARCHIVAL_INTENT_STAGES, MAX_RETIREMENT_EVIDENCE_BYTES,
  DEFAULT_RECOVERY_CHECKPOINT_OBSERVE_MS, DEFAULT_RECOVERY_CHECKPOINT_RETRY_MS,
  DEFAULT_TIMEOUT_MS, DEFAULT_RETRY_MS, validOwner, validRetirementIntent, validRetirementDecision, validRetirementResult,
  publicationStageIdentity, publicationArchivalIntentFile, publicationArchivalIntentStageIdentity,
  publicationArchivalRequestDigestV1, publicationArchivalRequestDigest, publicationArchivalReasonDigest, publicationArchivalReasonSummary,
  validPublicationStageArtifact, validPublicationArchivalIntent, create
};
