#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const Separation = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
const Transition = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');

const PROPOSAL_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-proposal/v1';
const SETTLEMENT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-settlement/v1';
const MANIFEST_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-manifest/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-snapshot/v1';
const VERSION = '2.0.0';
const STATUS = 'TEST';
const PROPOSE_CONFIRMATION = 'PROPOSE EXACT CURRENT LOCAL POSSESSION TRANSITION ONCE';
const SETTLE_CONFIRMATION = 'SETTLE EXACT PENDING LOCAL POSSESSION TRANSITION ONCE';
const AUTHORITY_ORIGIN = 'CALLER_STATE_ROOT_AND_CONFIRMATIONS_UNAUTHENTICATED';
const STORAGE_MODE = 'PREWRITE_MATCHED_PROPOSAL_THEN_POSTWRITE_RECAPTURED_EXCLUSIVE_SETTLEMENT';
const NAMESPACE = 'model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger';
const PROPOSALS_DIRECTORY = 'proposals';
const SETTLEMENTS_DIRECTORY = 'settlements';
const MANIFEST_FILE = 'ledger.json';
const NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_LOG_OR_PROTECTED_MONOTONIC_TRANSACTION_SPANNING_SOURCE_AND_SETTLEMENT';
const MAX_ARTIFACT_CANONICAL_BYTES = 1024 * 1024;
const MAX_PROPOSALS = 10000;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SEQUENCE_FILE = /^([0-9]{12})\.json$/;

class TwoPhaseSettlementLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TwoPhaseSettlementLedgerError';
    this.code = code;
  }
}

function stableStringify(value) { return Transition.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Transition.sha256(value); }
function fail(code, message) { throw new TwoPhaseSettlementLedgerError(code, message); }

function assertBound(value, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); } catch (error) { fail('INVALID_INPUT', label + ' is not canonical JSON data'); }
  if (bytes > MAX_ARTIFACT_CANONICAL_BYTES) fail('ARTIFACT_TOO_LARGE', label + ' exceeds the bounded canonical byte limit');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_INPUT', label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function boundedString(value, label, maximum) {
  if (typeof value !== 'string' || !value) fail('INVALID_INPUT', label + ' must be a non-empty string');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_INPUT', label + ' must be a positive safe integer');
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function manifestDigest(value) { return sha256(withoutField(value, 'manifestDigest')); }
function proposalDigest(value) { return sha256(withoutField(value, 'proposalDigest')); }
function settlementDigest(value) { return sha256(withoutField(value, 'settlementDigest')); }
function snapshotDigest(value) { return sha256(withoutField(value, 'snapshotDigest')); }
function manifestRef(value) { return { id: value.logId, schema: value.schema, sha256: value.manifestDigest }; }
function proposalRef(value) { return { id: value.proposalId, schema: value.schema, sha256: value.proposalDigest }; }
function settlementRef(value) { return { id: value.settlementId, schema: value.schema, sha256: value.settlementDigest }; }
function sourceSnapshotRef(value) { return { id: value.observationId, schema: value.schema, sha256: value.snapshotDigest }; }

function contextFromOptions(options) {
  const receiverId = exactText(options.receiverId, 'configured receiver id', 120);
  const challengerId = exactText(options.challengerId, 'configured challenger id', 120);
  const policy = options.receiverPolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('INVALID_INPUT', 'configured receiver policy must be an object');
  return {
    receiverId,
    challengerId,
    receiverIdDigest: sha256({ receiverId }),
    challengerIdDigest: sha256({ challengerId }),
    receiverPolicyRef: {
      id: exactText(policy.policyId, 'configured receiver policy id', 180),
      schema: exactText(policy.schema, 'configured receiver policy schema', 180),
      sha256: digest(policy.policyDigest, 'configured receiver policy digest')
    }
  };
}

function proposalTruth() {
  return {
    transitionReceiptVerifiedByExactRebuildBeforeProposal: true,
    forwardPairwiseExtensionRequired: true,
    candidateSourceCapturedBeforeProposal: true,
    candidateSeparatedAuditVerifiedByExactRebuildBeforeProposal: true,
    candidateResponseSetMatchedPresentedCheckpointBeforeProposal: true,
    currentResponseSignaturesStrictlyReloadedBeforeProposal: true,
    localManifestVerified: true,
    exactSettledHeadMatchedBeforeProposal: true,
    explicitProposalConfirmationRequired: true,
    exclusiveProposalCreateWon: true,
    proposalFileFsyncCompleted: true,
    proposalAdvancesSettledHead: false,
    postwriteSettlementRequired: true,
    sourceCaptureAndProposalWriteAtomic: false,
    sourceUnchangedUntilSettlementProven: false,
    persistedRawPrewriteSnapshot: false,
    persistedUpstreamRebuildInputs: false,
    independentStateRootsExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    directoryEntryDurabilityProven: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function settlementTruth(classification) {
  const matched = classification === 'SETTLED_POSTWRITE_SOURCE_MATCH';
  return {
    persistedProposalVerifiedFromCallerPackageBeforeSettlement: true,
    postwriteCandidateSourceCaptured: true,
    postwriteSeparatedAuditVerifiedByExactRebuild: true,
    postwriteSourceMatchedRecordedCandidate: matched,
    observedPostwriteDriftHeld: !matched,
    settledHeadAdvanced: matched,
    explicitSettlementConfirmationRequired: true,
    exclusiveSettlementCreateWon: true,
    settlementFileFsyncCompleted: true,
    proposalCaptureAndWriteAtomic: false,
    sourceCaptureAndSettlementWriteAtomic: false,
    intermediateOrRevertedSourceChangesExcluded: false,
    candidateStillCurrentAfterSettlementProven: false,
    pendingCrashWindowEliminated: false,
    persistedRawPostwriteSnapshot: false,
    persistedUpstreamRebuildInputs: false,
    independentStateRootsExcluded: false,
    withheldForksExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    directoryEntryDurabilityProven: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function snapshotTruth() {
  return {
    manifestVerified: true,
    proposalSequenceValidated: true,
    proposalDigestChainValidated: true,
    settlementSequenceValidated: true,
    settlementBindingsValidated: true,
    settledHeadDerivedOnlyFromMatchingSettlements: true,
    oneTrailingPendingProposalRepresentable: true,
    upstreamArtifactsReverifiedWithoutCallerPackages: false,
    currentSourceStateRecapturedOnInspect: false,
    independentStateRootsExcluded: false,
    globallyConsistentTransitionLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function buildManifest(logId, genesisSeparatedWitnessRef, context) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: exactText(logId, 'two-phase settlement log id', 180),
    genesisSeparatedWitnessRef: reference(genesisSeparatedWitnessRef, 'genesis separated witness reference'),
    receiverIdDigest: digest(context.receiverIdDigest, 'configured receiver id digest'),
    challengerIdDigest: digest(context.challengerIdDigest, 'configured challenger id digest'),
    receiverPolicyRef: reference(context.receiverPolicyRef, 'configured receiver policy reference'),
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  manifest.manifestDigest = manifestDigest(manifest);
  return manifest;
}

function validateTransition(input) {
  const check = Transition.verifyTransition(clone(input.transitionInput), clone(input.transitionReceipt));
  if (!check.pass) fail('TRANSITION_INVALID', 'v1.8 pairwise transition is invalid: ' + check.errors.join('; '));
  const receipt = check.rebuilt;
  if (receipt.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN' ||
      receipt.decision.forwardTransitionAdmissible !== true || receipt.decision.reviewRequired !== false) {
    fail('TRANSITION_NOT_FORWARD_EXTENSION', 'only an exact v1.8 forward response extension may be proposed');
  }
  if (receipt.truth.globalTransitionUniquenessProven !== false || receipt.truth.globallyConsistentTransitionLogProven !== false ||
      receipt.truth.executionAuthorized !== false || receipt.truth.adoptionAuthorized !== false) {
    fail('UPSTREAM_AUTHORITY_MISMATCH', 'v1.8 transition authority boundary mismatch');
  }
  return receipt;
}

function validateProposalInput(input) {
  assertBound(input, 'two-phase proposal input');
  exactKeys(input, [
    'proposalId', 'proposedAt', 'confirmation', 'transitionInput', 'transitionReceipt',
    'observationId', 'observedAt', 'auditId', 'checkedAt'
  ], 'two-phase proposal input');
  if (input.confirmation !== PROPOSE_CONFIRMATION) fail('PROPOSAL_CONFIRMATION_REQUIRED', 'exact proposal confirmation is required');
  const result = {
    proposalId: exactText(input.proposalId, 'proposal id', 180),
    proposedAt: timestamp(input.proposedAt, 'proposal time'),
    observationId: exactText(input.observationId, 'prewrite observation id', 180),
    observedAt: timestamp(input.observedAt, 'prewrite observation time'),
    auditId: exactText(input.auditId, 'prewrite audit id', 180),
    checkedAt: timestamp(input.checkedAt, 'prewrite audit time'),
    transition: validateTransition(input)
  };
  if (Date.parse(result.observedAt) < Date.parse(result.transition.comparedAt) ||
      Date.parse(result.checkedAt) < Date.parse(result.observedAt) || Date.parse(result.proposedAt) < Date.parse(result.checkedAt)) {
    fail('INVALID_INPUT', 'comparison, prewrite observation, audit, and proposal times must be nondecreasing');
  }
  return result;
}

function currentnessEvidence(input, metadata, evidence, requireExactMatch) {
  exactKeys(evidence, ['currentSnapshot', 'currentnessAuditReceipt'], metadata.label + ' evidence');
  if (!Continuity.verifySnapshot(clone(evidence.currentSnapshot)).pass) fail('CURRENT_SNAPSHOT_INVALID', metadata.label + ' snapshot is invalid');
  const current = clone(evidence.currentSnapshot);
  if (current.observationId !== metadata.observationId || current.observedAt !== metadata.observedAt) {
    fail('CURRENT_SNAPSHOT_MISMATCH', metadata.label + ' snapshot identity or time mismatch');
  }
  const auditInput = {
    auditId: metadata.auditId,
    checkedAt: metadata.checkedAt,
    separationInput: clone(input.transitionInput.candidateSeparationInput),
    separationReceipt: clone(input.transitionInput.candidateSeparationReceipt),
    currentSnapshot: current
  };
  const check = Separation.verifySeparatedAudit(auditInput, clone(evidence.currentnessAuditReceipt));
  if (!check.pass) fail('CURRENTNESS_AUDIT_INVALID', metadata.label + ' audit is invalid: ' + check.errors.join('; '));
  const audit = check.rebuilt;
  const candidateRef = reference(metadata.transition.candidateSeparatedWitnessRef, 'candidate transition separated witness reference');
  if (!sameReference(candidateRef, reference(audit.separatedWitnessRef, metadata.label + ' separated witness reference'))) {
    fail('CURRENTNESS_AUDIT_MISMATCH', metadata.label + ' audit is not bound to the transition candidate');
  }
  if (requireExactMatch && (audit.decision.classification !== 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT' ||
      audit.decision.reviewRequired !== false || audit.currentSnapshot.availability !== 'AVAILABLE')) {
    fail('CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'candidate source must exactly match the presented candidate checkpoint before proposal');
  }
  return { current, audit };
}

function buildProposal(input, evidence, context) {
  const validated = validateProposalInput(input);
  const prewrite = currentnessEvidence(input, { ...validated, label: 'prewrite candidate currentness' }, evidence, true);
  exactKeys(context, ['manifest', 'sequence', 'previousProposalRef', 'currentSettledHead'], 'proposal context');
  const manifest = context.manifest;
  const sequence = positiveInteger(context.sequence, 'proposal sequence');
  const previousProposalRef = context.previousProposalRef === null ? null : reference(context.previousProposalRef, 'previous proposal reference');
  const currentSettledHead = reference(context.currentSettledHead, 'current settled head');
  if (prewrite.current.receiverIdDigest !== manifest.receiverIdDigest || prewrite.current.challengerIdDigest !== manifest.challengerIdDigest ||
      !sameReference(reference(prewrite.current.receiverPolicyRef, 'prewrite receiver policy reference'), manifest.receiverPolicyRef)) {
    fail('SOURCE_CONTEXT_MISMATCH', 'prewrite source identity does not match manifest context');
  }
  if (!sameReference(reference(validated.transition.previousSeparatedWitnessRef, 'proposal previous witness'), currentSettledHead)) {
    fail('STALE_SETTLED_HEAD', 'proposal transition does not start at the exact current settled head');
  }
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    proposalId: validated.proposalId,
    proposedAt: validated.proposedAt,
    status: STATUS,
    log: { logId: manifest.logId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence },
    manifestRef: manifestRef(manifest),
    previousProposalRef,
    transitionReceipt: clone(validated.transition),
    prewriteCurrentnessAuditReceipt: clone(prewrite.audit),
    prewriteSnapshotRef: sourceSnapshotRef(prewrite.current),
    previousSettledWitnessRef: clone(validated.transition.previousSeparatedWitnessRef),
    candidateSeparatedWitnessRef: clone(validated.transition.candidateSeparatedWitnessRef),
    state: 'PROPOSED_AFTER_EXACT_PREWRITE_SOURCE_MATCH_SETTLED_HEAD_NOT_ADVANCED',
    nextGate: 'EXACT_POSTWRITE_SOURCE_RECAPTURE_AND_EXCLUSIVE_SETTLEMENT',
    truth: proposalTruth(),
    proposalDigest: null
  };
  proposal.proposalDigest = proposalDigest(proposal);
  assertBound(proposal, 'two-phase proposal');
  return proposal;
}

function settlementClassification(upstream) {
  const map = {
    CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT: 'SETTLED_POSTWRITE_SOURCE_MATCH',
    CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT: 'HELD_POSTWRITE_SOURCE_EXTENDED_CANDIDATE',
    ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT: 'HELD_POSTWRITE_SOURCE_ROLLBACK_OR_REPLACEMENT',
    HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT: 'HELD_POSTWRITE_SOURCE_ABSENT',
    HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID: 'HELD_POSTWRITE_SOURCE_INVALID',
    HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED: 'HELD_POSTWRITE_SOURCE_IDENTITY_CHANGED'
  };
  if (!Object.prototype.hasOwnProperty.call(map, upstream)) fail('CURRENTNESS_CLASSIFICATION_INVALID', 'unknown v1.7 postwrite classification');
  return map[upstream];
}

function bestAction(classification) {
  return classification === 'SETTLED_POSTWRITE_SOURCE_MATCH'
    ? 'ADVANCE_ONLY_THIS_CALLER_OWNED_SETTLED_HEAD'
    : 'PRESERVE_HELD_SETTLEMENT_AND_KEEP_PREVIOUS_SETTLED_HEAD';
}

function validateSettlementInput(input) {
  assertBound(input, 'two-phase settlement input');
  exactKeys(input, [
    'settlementId', 'settledAt', 'confirmation', 'proposalInput', 'prewriteEvidence', 'proposalReceipt',
    'observationId', 'observedAt', 'auditId', 'checkedAt'
  ], 'two-phase settlement input');
  if (input.confirmation !== SETTLE_CONFIRMATION) fail('SETTLEMENT_CONFIRMATION_REQUIRED', 'exact settlement confirmation is required');
  return {
    settlementId: exactText(input.settlementId, 'settlement id', 180),
    settledAt: timestamp(input.settledAt, 'settlement time'),
    observationId: exactText(input.observationId, 'postwrite observation id', 180),
    observedAt: timestamp(input.observedAt, 'postwrite observation time'),
    auditId: exactText(input.auditId, 'postwrite audit id', 180),
    checkedAt: timestamp(input.checkedAt, 'postwrite audit time')
  };
}

function buildSettlement(input, evidence, proposal, manifest) {
  const validated = validateSettlementInput(input);
  const transition = validateTransition(input.proposalInput);
  if (!sameReference(reference(transition.candidateSeparatedWitnessRef, 'settlement candidate witness'), proposal.candidateSeparatedWitnessRef)) {
    fail('PROPOSAL_PACKAGE_MISMATCH', 'settlement proposal package candidate does not match persisted proposal');
  }
  if (Date.parse(validated.observedAt) < Date.parse(proposal.proposedAt) ||
      Date.parse(validated.checkedAt) < Date.parse(validated.observedAt) || Date.parse(validated.settledAt) < Date.parse(validated.checkedAt)) {
    fail('INVALID_INPUT', 'proposal, postwrite observation, audit, and settlement times must be nondecreasing');
  }
  const postwrite = currentnessEvidence(input.proposalInput, { ...validated, transition, label: 'postwrite candidate currentness' }, evidence, false);
  const classification = settlementClassification(postwrite.audit.decision.classification);
  const advanced = classification === 'SETTLED_POSTWRITE_SOURCE_MATCH';
  const settlement = {
    schema: SETTLEMENT_SCHEMA,
    version: VERSION,
    settlementId: validated.settlementId,
    settledAt: validated.settledAt,
    status: STATUS,
    log: { logId: manifest.logId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence: proposal.log.sequence },
    manifestRef: manifestRef(manifest),
    proposalRef: proposalRef(proposal),
    postwriteCurrentnessAuditReceipt: clone(postwrite.audit),
    postwriteSnapshotRef: sourceSnapshotRef(postwrite.current),
    previousSettledWitnessRef: clone(proposal.previousSettledWitnessRef),
    candidateSeparatedWitnessRef: clone(proposal.candidateSeparatedWitnessRef),
    decision: {
      classification,
      upstreamCurrentnessClassification: postwrite.audit.decision.classification,
      settledHeadAdvanced: advanced,
      reviewRequired: !advanced,
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: advanced
      ? 'POSTWRITE_SOURCE_MATCH_SETTLED_LOCAL_HEAD_ADVANCED_NO_LATER_OR_GLOBAL_CURRENTNESS'
      : 'POSTWRITE_SOURCE_DRIFT_HELD_PREVIOUS_LOCAL_SETTLED_HEAD_PRESERVED',
    nextGate: NEXT_GATE,
    truth: settlementTruth(classification),
    settlementDigest: null
  };
  settlement.settlementDigest = settlementDigest(settlement);
  assertBound(settlement, 'two-phase settlement');
  return settlement;
}

function validateManifest(value, expectedLogId, expectedGenesisRef, expectedContext) {
  try {
    const manifest = clone(value);
    exactKeys(manifest, [
      'schema', 'version', 'status', 'logId', 'genesisSeparatedWitnessRef', 'receiverIdDigest', 'challengerIdDigest',
      'receiverPolicyRef', 'authorityOrigin', 'storageMode', 'manifestDigest'
    ], 'two-phase manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) throw new Error('manifest identity mismatch');
    exactText(manifest.logId, 'stored log id', 180);
    const genesis = reference(manifest.genesisSeparatedWitnessRef, 'stored genesis witness reference');
    digest(manifest.receiverIdDigest, 'stored receiver id digest');
    digest(manifest.challengerIdDigest, 'stored challenger id digest');
    reference(manifest.receiverPolicyRef, 'stored receiver policy reference');
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) throw new Error('manifest boundary mismatch');
    if (digest(manifest.manifestDigest, 'stored manifest digest') !== manifestDigest(manifest)) throw new Error('manifest digest mismatch');
    if (manifest.logId !== expectedLogId) fail('LOG_ID_MISMATCH', 'state root is bound to a different log id');
    if (!sameReference(genesis, reference(expectedGenesisRef, 'expected genesis witness reference'))) fail('GENESIS_MISMATCH', 'state root is bound to a different genesis witness');
    if (manifest.receiverIdDigest !== expectedContext.receiverIdDigest || manifest.challengerIdDigest !== expectedContext.challengerIdDigest ||
        !sameReference(manifest.receiverPolicyRef, expectedContext.receiverPolicyRef)) fail('SOURCE_CONTEXT_MISMATCH', 'state root is bound to a different source context');
    return manifest;
  } catch (error) {
    if (error instanceof TwoPhaseSettlementLedgerError && ['LOG_ID_MISMATCH', 'GENESIS_MISMATCH', 'SOURCE_CONTEXT_MISMATCH'].includes(error.code)) throw error;
    fail('SETTLEMENT_LEDGER_MANIFEST_CORRUPT', 'two-phase manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateStoredTransition(value) {
  const receipt = clone(value);
  exactKeys(receipt, [
    'schema', 'version', 'transitionId', 'comparedAt', 'status', 'previousSeparatedWitnessRef', 'candidateSeparatedWitnessRef',
    'anchorTransition', 'witnessPolicyTransition', 'receiverContextTransition', 'previousCheckpointRef', 'candidateCheckpointRef',
    'comparison', 'decision', 'state', 'nextGate', 'truth', 'receiptDigest'
  ], 'stored v1.8 transition receipt');
  if (receipt.schema !== Transition.RECEIPT_SCHEMA || receipt.version !== Transition.VERSION || receipt.status !== STATUS) throw new Error('stored transition identity mismatch');
  timestamp(receipt.comparedAt, 'stored transition comparison time');
  reference(receipt.previousSeparatedWitnessRef, 'stored previous witness reference');
  reference(receipt.candidateSeparatedWitnessRef, 'stored candidate witness reference');
  if (!receipt.decision || receipt.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN' ||
      receipt.decision.forwardTransitionAdmissible !== true || receipt.decision.reviewRequired !== false) throw new Error('stored transition is not a forward extension');
  if (!receipt.truth || receipt.truth.forwardExtensionObserved !== true || receipt.truth.globalTransitionUniquenessProven !== false ||
      receipt.truth.executionAuthorized !== false || receipt.truth.adoptionAuthorized !== false) throw new Error('stored transition truth boundary mismatch');
  if (receipt.nextGate !== Transition.NEXT_GATE || digest(receipt.receiptDigest, 'stored transition digest') !== sha256(withoutField(receipt, 'receiptDigest'))) throw new Error('stored transition digest or gate mismatch');
  return receipt;
}

function validateStoredAudit(value, requireMatch, label) {
  const audit = clone(value);
  exactKeys(audit, [
    'schema', 'version', 'auditId', 'checkedAt', 'status', 'separatedWitnessRef', 'anchoredWitnessRef', 'anchorRef',
    'witnessRef', 'witnessPolicyRef', 'checkpointRef', 'sourceSnapshotRef', 'receiverIdDigest', 'challengerIdDigest',
    'receiverPolicyRef', 'entriesDigest', 'anchoredContinuityAuditRef', 'currentSnapshot', 'comparison', 'decision',
    'state', 'nextGate', 'truth', 'auditDigest'
  ], label);
  if (audit.schema !== Separation.AUDIT_SCHEMA || audit.version !== Separation.VERSION || audit.status !== STATUS) throw new Error(label + ' identity mismatch');
  timestamp(audit.checkedAt, label + ' time');
  reference(audit.separatedWitnessRef, label + ' separated witness reference');
  if (!audit.decision || typeof audit.decision.classification !== 'string') throw new Error(label + ' decision missing');
  if (requireMatch && (audit.decision.classification !== 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT' || audit.currentSnapshot.availability !== 'AVAILABLE')) throw new Error(label + ' is not an exact match');
  if (!audit.truth || audit.truth.currentResponseStateDeletionOrRollbackPrevented !== false || audit.truth.hostAuthorizationAuthenticated !== false ||
      audit.truth.executionAuthorized !== false || audit.truth.adoptionAuthorized !== false) throw new Error(label + ' truth boundary mismatch');
  if (audit.nextGate !== Separation.NEXT_GATE || digest(audit.auditDigest, label + ' digest') !== sha256(withoutField(audit, 'auditDigest'))) throw new Error(label + ' digest or gate mismatch');
  return audit;
}

function validateStoredProposal(value, context) {
  try {
    const proposal = clone(value);
    exactKeys(proposal, [
      'schema', 'version', 'proposalId', 'proposedAt', 'status', 'log', 'manifestRef', 'previousProposalRef',
      'transitionReceipt', 'prewriteCurrentnessAuditReceipt', 'prewriteSnapshotRef', 'previousSettledWitnessRef',
      'candidateSeparatedWitnessRef', 'state', 'nextGate', 'truth', 'proposalDigest'
    ], 'stored proposal');
    if (proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || proposal.status !== STATUS) throw new Error('proposal identity mismatch');
    exactText(proposal.proposalId, 'stored proposal id', 180);
    timestamp(proposal.proposedAt, 'stored proposal time');
    exactKeys(proposal.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored proposal log binding');
    if (proposal.log.logId !== context.manifest.logId || proposal.log.authorityOrigin !== AUTHORITY_ORIGIN || proposal.log.storageMode !== STORAGE_MODE ||
        positiveInteger(proposal.log.sequence, 'stored proposal sequence') !== context.sequence) throw new Error('proposal log binding mismatch');
    if (!sameReference(reference(proposal.manifestRef, 'stored manifest reference'), manifestRef(context.manifest))) throw new Error('proposal manifest reference mismatch');
    if (context.previousProposalRef === null ? proposal.previousProposalRef !== null :
      !sameReference(reference(proposal.previousProposalRef, 'stored previous proposal reference'), context.previousProposalRef)) throw new Error('previous proposal reference mismatch');
    const transition = validateStoredTransition(proposal.transitionReceipt);
    const audit = validateStoredAudit(proposal.prewriteCurrentnessAuditReceipt, true, 'stored prewrite audit');
    if (Date.parse(audit.checkedAt) < Date.parse(transition.comparedAt) || Date.parse(proposal.proposedAt) < Date.parse(audit.checkedAt)) {
      throw new Error('proposal chronology mismatch');
    }
    const previous = reference(proposal.previousSettledWitnessRef, 'stored previous settled witness reference');
    const candidate = reference(proposal.candidateSeparatedWitnessRef, 'stored candidate witness reference');
    if (!sameReference(previous, transition.previousSeparatedWitnessRef) || !sameReference(candidate, transition.candidateSeparatedWitnessRef) ||
        !sameReference(candidate, audit.separatedWitnessRef) || !sameReference(previous, context.currentSettledHead)) throw new Error('proposal transition/head binding mismatch');
    const snapshot = reference(proposal.prewriteSnapshotRef, 'stored prewrite snapshot reference');
    if (snapshot.id !== audit.currentSnapshot.id || snapshot.schema !== audit.currentSnapshot.schema || snapshot.sha256 !== audit.currentSnapshot.sha256) throw new Error('proposal snapshot binding mismatch');
    if (proposal.state !== 'PROPOSED_AFTER_EXACT_PREWRITE_SOURCE_MATCH_SETTLED_HEAD_NOT_ADVANCED' || proposal.nextGate !== 'EXACT_POSTWRITE_SOURCE_RECAPTURE_AND_EXCLUSIVE_SETTLEMENT') throw new Error('proposal state boundary mismatch');
    if (stableStringify(proposal.truth) !== stableStringify(proposalTruth())) throw new Error('proposal truth boundary mismatch');
    if (digest(proposal.proposalDigest, 'stored proposal digest') !== proposalDigest(proposal)) throw new Error('proposal digest mismatch');
    return proposal;
  } catch (error) { fail('SETTLEMENT_LEDGER_PROPOSAL_CORRUPT', 'proposal is corrupt or boundary-invalid: ' + error.message); }
}

function validateStoredSettlement(value, context) {
  try {
    const settlement = clone(value);
    exactKeys(settlement, [
      'schema', 'version', 'settlementId', 'settledAt', 'status', 'log', 'manifestRef', 'proposalRef',
      'postwriteCurrentnessAuditReceipt', 'postwriteSnapshotRef', 'previousSettledWitnessRef', 'candidateSeparatedWitnessRef',
      'decision', 'state', 'nextGate', 'truth', 'settlementDigest'
    ], 'stored settlement');
    if (settlement.schema !== SETTLEMENT_SCHEMA || settlement.version !== VERSION || settlement.status !== STATUS) throw new Error('settlement identity mismatch');
    exactText(settlement.settlementId, 'stored settlement id', 180);
    timestamp(settlement.settledAt, 'stored settlement time');
    exactKeys(settlement.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored settlement log binding');
    if (settlement.log.logId !== context.manifest.logId || settlement.log.authorityOrigin !== AUTHORITY_ORIGIN || settlement.log.storageMode !== STORAGE_MODE ||
        settlement.log.sequence !== context.sequence) throw new Error('settlement log binding mismatch');
    if (!sameReference(reference(settlement.manifestRef, 'stored settlement manifest reference'), manifestRef(context.manifest)) ||
        !sameReference(reference(settlement.proposalRef, 'stored settlement proposal reference'), proposalRef(context.proposal))) throw new Error('settlement manifest or proposal binding mismatch');
    const audit = validateStoredAudit(settlement.postwriteCurrentnessAuditReceipt, false, 'stored postwrite audit');
    if (Date.parse(audit.checkedAt) < Date.parse(context.proposal.proposedAt) || Date.parse(settlement.settledAt) < Date.parse(audit.checkedAt)) {
      throw new Error('settlement chronology mismatch');
    }
    const classification = settlementClassification(audit.decision.classification);
    exactKeys(settlement.decision, ['classification', 'upstreamCurrentnessClassification', 'settledHeadAdvanced', 'reviewRequired', 'bestAction', 'autonomousActionCount'], 'stored settlement decision');
    const advanced = classification === 'SETTLED_POSTWRITE_SOURCE_MATCH';
    if (settlement.decision.classification !== classification || settlement.decision.upstreamCurrentnessClassification !== audit.decision.classification ||
        settlement.decision.settledHeadAdvanced !== advanced || settlement.decision.reviewRequired !== !advanced ||
        settlement.decision.bestAction !== bestAction(classification) || settlement.decision.autonomousActionCount !== 0) throw new Error('settlement decision mismatch');
    const previous = reference(settlement.previousSettledWitnessRef, 'stored settlement previous witness reference');
    const candidate = reference(settlement.candidateSeparatedWitnessRef, 'stored settlement candidate witness reference');
    if (!sameReference(previous, context.proposal.previousSettledWitnessRef) || !sameReference(candidate, context.proposal.candidateSeparatedWitnessRef) ||
        !sameReference(candidate, audit.separatedWitnessRef)) throw new Error('settlement witness binding mismatch');
    const snapshot = reference(settlement.postwriteSnapshotRef, 'stored postwrite snapshot reference');
    if (snapshot.id !== audit.currentSnapshot.id || snapshot.schema !== audit.currentSnapshot.schema || snapshot.sha256 !== audit.currentSnapshot.sha256) throw new Error('settlement snapshot binding mismatch');
    const expectedState = advanced ? 'POSTWRITE_SOURCE_MATCH_SETTLED_LOCAL_HEAD_ADVANCED_NO_LATER_OR_GLOBAL_CURRENTNESS' : 'POSTWRITE_SOURCE_DRIFT_HELD_PREVIOUS_LOCAL_SETTLED_HEAD_PRESERVED';
    if (settlement.state !== expectedState || settlement.nextGate !== NEXT_GATE) throw new Error('settlement state boundary mismatch');
    if (stableStringify(settlement.truth) !== stableStringify(settlementTruth(classification))) throw new Error('settlement truth boundary mismatch');
    if (digest(settlement.settlementDigest, 'stored settlement digest') !== settlementDigest(settlement)) throw new Error('settlement digest mismatch');
    return settlement;
  } catch (error) { fail('SETTLEMENT_LEDGER_SETTLEMENT_CORRUPT', 'settlement is corrupt or boundary-invalid: ' + error.message); }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); } catch (error) { fail('STATE_ROOT_INVALID', label + ' cannot be inspected: ' + error.message); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link or junction');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); } catch (error) { if (error.code !== 'EEXIST') fail('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message); }
  assertDirectoryNotLink(directoryPath, label);
}

function resolvePaths(stateRoot) {
  const root = path.resolve(exactText(stateRoot, 'settlement ledger stateRoot', 32767));
  if (root === path.parse(root).root) fail('STATE_ROOT_INVALID', 'filesystem root cannot be a settlement ledger stateRoot');
  assertDirectoryNotLink(root, 'settlement ledger stateRoot');
  return {
    root,
    namespace: path.join(root, NAMESPACE),
    proposals: path.join(root, NAMESPACE, PROPOSALS_DIRECTORY),
    settlements: path.join(root, NAMESPACE, SETTLEMENTS_DIRECTORY)
  };
}

function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) { if (error.code === 'ENOENT') return null; fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, label + ' must be a regular file and not a symbolic link');
  if (stat.size > MAX_ARTIFACT_CANONICAL_BYTES + 1) fail(code, label + ' exceeds the bounded canonical byte limit');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (raw !== stableStringify(parsed) + '\n') fail(code, label + ' is not exact canonical JSON');
    return parsed;
  } catch (error) {
    if (error instanceof TwoPhaseSettlementLedgerError) throw error;
    fail(code, label + ' is unreadable or invalid JSON');
  }
}

function writeExclusive(filePath, value, prefix) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') return false; fail(prefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message); }
  let problem = null;
  try { fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' }); fs.fsyncSync(descriptor); }
  catch (error) { problem = error; }
  finally { try { fs.closeSync(descriptor); } catch (error) { if (!problem) problem = error; } }
  if (problem) fail(prefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; retained state requires steward inspection: ' + problem.message);
  return true;
}

function sequenceFile(sequence) { return String(sequence).padStart(12, '0') + '.json'; }

function readManifest(filePath, logId, genesisRef, context) {
  const parsed = readJsonFile(filePath, 'SETTLEMENT_LEDGER_MANIFEST_CORRUPT', 'two-phase manifest');
  return parsed === null ? null : validateManifest(parsed, logId, genesisRef, context);
}

function ensureManifest(paths, logId, genesisRef, context) {
  const filePath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(filePath, logId, genesisRef, context);
  if (existing) return existing;
  if (fs.readdirSync(paths.namespace).length) {
    const raced = readManifest(filePath, logId, genesisRef, context);
    if (raced) return raced;
    fail('SETTLEMENT_LEDGER_MANIFEST_MISSING', 'non-empty settlement namespace has no manifest');
  }
  const manifest = buildManifest(logId, genesisRef, context);
  if (!writeExclusive(filePath, manifest, 'SETTLEMENT_LEDGER_MANIFEST')) return readManifest(filePath, logId, genesisRef, context);
  return manifest;
}

function prepare(paths, logId, genesisRef, context) {
  createFixedDirectory(paths.namespace, 'settlement ledger namespace');
  const manifest = ensureManifest(paths, logId, genesisRef, context);
  createFixedDirectory(paths.proposals, 'settlement ledger proposals directory');
  createFixedDirectory(paths.settlements, 'settlement ledger settlements directory');
  return manifest;
}

function buildSnapshot(manifest, proposals, settlements, currentSettledHead, pendingProposal, heldCount) {
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: manifest.logId,
    manifestRef: manifestRef(manifest),
    genesisSeparatedWitnessRef: clone(manifest.genesisSeparatedWitnessRef),
    currentSettledHeadSeparatedWitnessRef: clone(currentSettledHead),
    receiverIdDigest: manifest.receiverIdDigest,
    challengerIdDigest: manifest.challengerIdDigest,
    receiverPolicyRef: clone(manifest.receiverPolicyRef),
    proposalCount: proposals.length,
    settlementCount: settlements.length,
    heldSettlementCount: heldCount,
    pendingProposalRef: pendingProposal ? proposalRef(pendingProposal) : null,
    lastProposalRef: proposals.length ? proposalRef(proposals[proposals.length - 1]) : null,
    lastSettlementRef: settlements.length ? settlementRef(settlements[settlements.length - 1]) : null,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = snapshotDigest(snapshot);
  return snapshot;
}

function contiguousNames(directory, label) {
  if (!fs.existsSync(directory)) return [];
  assertDirectoryNotLink(directory, label);
  const names = fs.readdirSync(directory).sort();
  if (names.length > MAX_PROPOSALS) fail('SETTLEMENT_LEDGER_RESOURCE_BOUND', label + ' exceeds proposal bound');
  names.forEach((name, index) => {
    const match = SEQUENCE_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) fail('SETTLEMENT_LEDGER_SEQUENCE_CORRUPT', label + ' filenames must be one contiguous 12-digit sequence');
  });
  return names;
}

function loadState(paths, logId, genesisRef, context) {
  assertDirectoryNotLink(paths.namespace, 'settlement ledger namespace');
  const namespaceItems = fs.readdirSync(paths.namespace).sort();
  const unexpected = namespaceItems.filter(name => ![MANIFEST_FILE, PROPOSALS_DIRECTORY, SETTLEMENTS_DIRECTORY].includes(name));
  if (unexpected.length) fail('SETTLEMENT_LEDGER_NAMESPACE_CORRUPT', 'unexpected settlement namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), logId, genesisRef, context);
  if (!manifest) { if (namespaceItems.length) fail('SETTLEMENT_LEDGER_MANIFEST_MISSING', 'non-empty settlement namespace has no manifest'); return null; }
  const proposalNames = contiguousNames(paths.proposals, 'proposal directory');
  const settlementNames = contiguousNames(paths.settlements, 'settlement directory');
  if (settlementNames.length > proposalNames.length || proposalNames.length - settlementNames.length > 1) {
    fail('SETTLEMENT_LEDGER_SEQUENCE_CORRUPT', 'settlements must cover every proposal except at most one trailing pending proposal');
  }
  const proposals = [];
  const settlements = [];
  const headBeforeProposal = [];
  let currentSettledHead = clone(manifest.genesisSeparatedWitnessRef);
  let previousProposalRef = null;
  let heldCount = 0;
  proposalNames.forEach((name, index) => {
    headBeforeProposal.push(clone(currentSettledHead));
    const proposal = validateStoredProposal(readJsonFile(path.join(paths.proposals, name), 'SETTLEMENT_LEDGER_PROPOSAL_CORRUPT', 'proposal ' + name), {
      manifest, sequence: index + 1, previousProposalRef, currentSettledHead
    });
    proposals.push(proposal);
    previousProposalRef = proposalRef(proposal);
    if (index < settlementNames.length) {
      const settlement = validateStoredSettlement(readJsonFile(path.join(paths.settlements, settlementNames[index]), 'SETTLEMENT_LEDGER_SETTLEMENT_CORRUPT', 'settlement ' + settlementNames[index]), {
        manifest, sequence: index + 1, proposal
      });
      settlements.push(settlement);
      if (settlement.decision.settledHeadAdvanced) currentSettledHead = clone(proposal.candidateSeparatedWitnessRef);
      else heldCount += 1;
    }
  });
  const pendingProposal = proposals.length > settlements.length ? proposals[proposals.length - 1] : null;
  return {
    manifest, proposals, settlements, headBeforeProposal, currentSettledHead, pendingProposal, heldCount,
    snapshot: buildSnapshot(manifest, proposals, settlements, currentSettledHead, pendingProposal, heldCount)
  };
}

function createService(options) {
  exactKeys(options, [
    'stateRoot', 'sourceStateRoot', 'logId', 'genesisSeparatedWitnessRef', 'receiverId', 'challengerId',
    'challengerPublicKeyPem', 'receiverPolicy'
  ], 'two-phase settlement service options');
  const paths = resolvePaths(options.stateRoot);
  const sourceStateRoot = path.resolve(exactText(options.sourceStateRoot, 'source state root', 32767));
  const logId = exactText(options.logId, 'two-phase settlement log id', 180);
  const genesisRef = reference(options.genesisSeparatedWitnessRef, 'genesis separated witness reference');
  const sourceContext = contextFromOptions(options);
  const challengerPublicKeyPem = boundedString(options.challengerPublicKeyPem, 'configured challenger public key', 16384);
  const receiverPolicy = clone(options.receiverPolicy);

  function capture(metadata) {
    return Continuity.captureState({
      stateRoot: sourceStateRoot,
      receiverId: sourceContext.receiverId,
      challengerId: sourceContext.challengerId,
      challengerPublicKeyPem,
      receiverPolicy: clone(receiverPolicy),
      observationId: metadata.observationId,
      observedAt: metadata.observedAt
    });
  }

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    const state = loadState(paths, logId, genesisRef, sourceContext);
    return state ? clone(state.snapshot) : null;
  }

  function proposalContext(state, sequence) {
    return {
      manifest: state.manifest,
      sequence,
      previousProposalRef: sequence === 1 ? null : proposalRef(state.proposals[sequence - 2]),
      currentSettledHead: clone(state.headBeforeProposal[sequence - 1])
    };
  }

  function verifyProposalPackage(state, input, evidence, receipt) {
    const candidate = clone(receipt);
    const sequence = candidate && candidate.log && candidate.log.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal sequence is absent');
    const rebuilt = buildProposal(input, evidence, proposalContext(state, sequence));
    const stored = state.proposals[sequence - 1];
    if (stableStringify(rebuilt) !== stableStringify(candidate) || stableStringify(stored) !== stableStringify(rebuilt)) {
      fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal does not exact-rebuild from caller package or match stored proposal');
    }
    return { rebuilt, stored, sequence };
  }

  function propose(input) {
    const validated = validateProposalInput(input);
    if (fs.existsSync(paths.namespace)) {
      const before = loadState(paths, logId, genesisRef, sourceContext);
      if (before.pendingProposal) fail('PENDING_SETTLEMENT', 'the trailing proposal must be settled before another proposal');
      if (!sameReference(validated.transition.previousSeparatedWitnessRef, before.currentSettledHead)) fail('STALE_SETTLED_HEAD', 'transition does not start at current settled head');
    } else if (!sameReference(validated.transition.previousSeparatedWitnessRef, genesisRef)) {
      fail('STALE_SETTLED_HEAD', 'first transition does not start at configured genesis');
    }
    const currentSnapshot = capture(validated);
    const currentnessAuditReceipt = Separation.buildSeparatedAudit({
      auditId: validated.auditId,
      checkedAt: validated.checkedAt,
      separationInput: clone(input.transitionInput.candidateSeparationInput),
      separationReceipt: clone(input.transitionInput.candidateSeparationReceipt),
      currentSnapshot: clone(currentSnapshot)
    });
    const evidence = { currentSnapshot, currentnessAuditReceipt };
    currentnessEvidence(input, { ...validated, label: 'prewrite candidate currentness' }, evidence, true);
    const manifest = prepare(paths, logId, genesisRef, sourceContext);
    const state = loadState(paths, logId, genesisRef, sourceContext);
    if (state.pendingProposal) fail('PENDING_SETTLEMENT', 'another process left a trailing pending proposal');
    if (!sameReference(validated.transition.previousSeparatedWitnessRef, state.currentSettledHead)) fail('STALE_SETTLED_HEAD', 'another settlement changed the local settled head');
    const sequence = state.proposals.length + 1;
    const proposal = buildProposal(input, evidence, {
      manifest,
      sequence,
      previousProposalRef: state.proposals.length ? proposalRef(state.proposals[state.proposals.length - 1]) : null,
      currentSettledHead: state.currentSettledHead
    });
    const filePath = path.join(paths.proposals, sequenceFile(sequence));
    if (!writeExclusive(filePath, proposal, 'SETTLEMENT_LEDGER_PROPOSAL')) {
      const after = loadState(paths, logId, genesisRef, sourceContext);
      const existing = after.proposals[sequence - 1];
      if (existing && existing.proposalDigest === proposal.proposalDigest) fail('PROPOSAL_ALREADY_RECORDED', 'exact proposal is already recorded');
      if (after.pendingProposal || !sameReference(after.currentSettledHead, state.currentSettledHead)) fail('PROPOSAL_CONTENTION', 'another local proposal or settlement won first');
      fail('SETTLEMENT_LEDGER_SEQUENCE_CONFLICT', 'next proposal sequence exists with different content');
    }
    return { proposal, prewriteEvidence: clone(evidence) };
  }

  function settle(input) {
    const validated = validateSettlementInput(input);
    if (!fs.existsSync(paths.namespace)) fail('NO_PENDING_PROPOSAL', 'settlement ledger is absent');
    const state = loadState(paths, logId, genesisRef, sourceContext);
    if (!state.pendingProposal) fail('NO_PENDING_PROPOSAL', 'there is no trailing pending proposal');
    const packageResult = verifyProposalPackage(state, input.proposalInput, input.prewriteEvidence, input.proposalReceipt);
    if (packageResult.sequence !== state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'caller package is not the trailing pending proposal');
    const currentSnapshot = capture(validated);
    const currentnessAuditReceipt = Separation.buildSeparatedAudit({
      auditId: validated.auditId,
      checkedAt: validated.checkedAt,
      separationInput: clone(input.proposalInput.transitionInput.candidateSeparationInput),
      separationReceipt: clone(input.proposalInput.transitionInput.candidateSeparationReceipt),
      currentSnapshot: clone(currentSnapshot)
    });
    const evidence = { currentSnapshot, currentnessAuditReceipt };
    const settlement = buildSettlement(input, evidence, packageResult.rebuilt, state.manifest);
    const filePath = path.join(paths.settlements, sequenceFile(packageResult.sequence));
    if (!writeExclusive(filePath, settlement, 'SETTLEMENT_LEDGER_SETTLEMENT')) {
      const after = loadState(paths, logId, genesisRef, sourceContext);
      const existing = after.settlements[packageResult.sequence - 1];
      if (existing && existing.settlementDigest === settlement.settlementDigest) fail('SETTLEMENT_ALREADY_RECORDED', 'exact settlement is already recorded');
      fail('SETTLEMENT_CONTENTION', 'another local settlement won first');
    }
    return { settlement, postwriteEvidence: clone(evidence) };
  }

  function verifyProposalPersisted(input, evidence, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const state = loadState(paths, logId, genesisRef, sourceContext);
      if (!state) throw new Error('settlement ledger is absent');
      const result = verifyProposalPackage(state, input, evidence, receipt);
      rebuilt = result.rebuilt;
      stored = result.stored;
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  function verifySettlementPersisted(input, evidence, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const state = loadState(paths, logId, genesisRef, sourceContext);
      if (!state) throw new Error('settlement ledger is absent');
      const candidate = clone(receipt);
      const sequence = candidate && candidate.log && candidate.log.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.settlements.length) throw new Error('settlement sequence is absent');
      const proposalResult = verifyProposalPackage(state, input.proposalInput, input.prewriteEvidence, input.proposalReceipt);
      if (proposalResult.sequence !== sequence) throw new Error('settlement proposal sequence mismatch');
      rebuilt = buildSettlement(input, evidence, proposalResult.rebuilt, state.manifest);
      stored = state.settlements[sequence - 1];
      if (stableStringify(rebuilt) !== stableStringify(candidate)) throw new Error('presented settlement does not exact-rebuild from caller package');
      if (stableStringify(stored) !== stableStringify(rebuilt)) throw new Error('stored settlement does not match exact rebuilt settlement');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  return Object.freeze({
    logId,
    genesisSeparatedWitnessRef: clone(genesisRef),
    propose,
    settle,
    inspect,
    verifyProposalPersisted,
    verifySettlementPersisted
  });
}

module.exports = {
  PROPOSAL_SCHEMA,
  SETTLEMENT_SCHEMA,
  MANIFEST_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  PROPOSE_CONFIRMATION,
  SETTLE_CONFIRMATION,
  AUTHORITY_ORIGIN,
  STORAGE_MODE,
  NAMESPACE,
  PROPOSALS_DIRECTORY,
  SETTLEMENTS_DIRECTORY,
  MANIFEST_FILE,
  NEXT_GATE,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_PROPOSALS,
  TwoPhaseSettlementLedgerError,
  stableStringify,
  sha256,
  createService
};
