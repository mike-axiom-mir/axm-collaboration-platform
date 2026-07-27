'use strict';

const {
  fail,
  requireDigest,
  requireId,
  requireModuleId,
  requireText,
  parseSemver
} = require('./util');

const HANDOFF_SCHEMA = 'axm.module-evolution-ledger.module-installer-handoff/v1';

function normalizeWorkshopVersion(value) {
  const text = String(value || '').trim();
  const withoutPrefix = text.startsWith('v') ? text.slice(1) : text;
  const normalized = /^\d+\.\d+$/.test(withoutPrefix) ? `${withoutPrefix}.0` : withoutPrefix;
  return parseSemver(normalized).raw;
}

function createVersionRecordInput(input) {
  const candidateId = requireText(input.installerCandidateId, 'installerCandidateId', 256);
  const reviewRef = requireText(input.installerReviewRef, 'installerReviewRef', 512);
  return {
    schema: `${HANDOFF_SCHEMA}#record-version-input`,
    ledgerMethod: 'recordVersion',
    expectedRevision: input.expectedRevision,
    recordId: input.recordId ? requireId(input.recordId, 'recordId') : undefined,
    moduleId: requireModuleId(input.moduleId),
    semanticVersion: normalizeWorkshopVersion(input.manifestVersion),
    contentDigest: requireDigest(input.candidateDigest, 'candidateDigest'),
    parentRecordId: input.parentRecordId === null ? null : requireId(input.parentRecordId, 'parentRecordId'),
    recordKind: 'candidate',
    createdBy: requireText(input.actorId || 'module-installer-handoff', 'actorId', 120),
    actorKind: 'module-installer-observer',
    sourceRefs: [`installer-candidate:${candidateId}`, reviewRef],
    metadata: {
      workshopManifestVersion: String(input.manifestVersion),
      installerCandidateId: candidateId,
      installerReviewRef: reviewRef,
      observationOnly: true,
      installerInvoked: false
    }
  };
}

function createActivationPreparationInput(input) {
  return {
    schema: `${HANDOFF_SCHEMA}#prepare-activation-input`,
    ledgerMethod: 'prepareActivation',
    expectedRevision: input.expectedRevision,
    attemptId: input.attemptId ? requireId(input.attemptId, 'attemptId') : undefined,
    moduleId: requireModuleId(input.moduleId),
    fromRecordId: requireId(input.fromRecordId, 'fromRecordId'),
    toRecordId: requireId(input.toRecordId, 'toRecordId'),
    installerCandidateId: requireText(input.installerCandidateId, 'installerCandidateId', 256),
    installerReviewRef: requireText(input.installerReviewRef, 'installerReviewRef', 512),
    recoverySnapshotRef: requireText(input.recoverySnapshotRef, 'recoverySnapshotRef', 512),
    mikeApprovalRef: requireText(input.mikeApprovalRef, 'mikeApprovalRef', 512),
    confirmation: 'MIKE APPROVES ACTIVATION RECORD'
  };
}

function createActivationObservationInput(input) {
  const authority = String(input.observationAuthority || '');
  if (!['module-installer-receipt', 'independent-local-digest-observation'].includes(authority)) {
    fail('INVALID_OBSERVATION_AUTHORITY', 'Activation observations require an Installer receipt or independent local digest observation');
  }
  return {
    schema: `${HANDOFF_SCHEMA}#activation-observation-input`,
    ledgerMethod: 'recordActivationObservation',
    expectedRevision: input.expectedRevision,
    attemptId: requireId(input.attemptId, 'attemptId'),
    observedDigest: requireDigest(input.observedDigest, 'observedDigest'),
    observationRef: requireText(input.observationRef, 'observationRef', 512),
    actorId: authority,
    confirmation: 'RECORD ACTIVATION OBSERVATION'
  };
}

module.exports = { HANDOFF_SCHEMA, normalizeWorkshopVersion, createVersionRecordInput, createActivationPreparationInput, createActivationObservationInput };
