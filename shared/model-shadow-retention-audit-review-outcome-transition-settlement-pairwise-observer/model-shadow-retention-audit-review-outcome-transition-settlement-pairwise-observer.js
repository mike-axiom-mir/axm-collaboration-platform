#!/usr/bin/env node
'use strict';

const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');

const RECEIPT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observation/v1';
const VERSION = '3.8.0';
const STATUS = 'TEST';
const MAX_INPUT_CANONICAL_BYTES = 300 * 1024 * 1024;
const MAX_RECEIPT_CANONICAL_BYTES = 2 * 1024 * 1024;
const SIDE_OBSERVATIONS = Object.freeze([
  'EXACT_CURRENT_SETTLEMENT_PACKAGE',
  'ROOT_ABSENT',
  'ROOT_INVALID',
  'ROOT_CHANGED_DURING_CHECK',
  'PENDING_PROPOSAL_PRESENT',
  'SETTLEMENT_PACKAGE_NOT_EXACT',
  'SETTLEMENT_PACKAGE_NOT_CURRENT'
]);
const CAPTURE_STATES = Object.freeze(['PRESENT', 'ABSENT', 'INVALID']);
const CLASSIFICATIONS = Object.freeze([
  'PRESENTED_FRONTIER_EXACT_REPLAY',
  'MATCHING_SETTLED_HEAD_DISTINCT_LOCAL_FRONTIERS',
  'RIGHT_LAST_EXACT_SETTLEMENT_EXTENDS_LEFT_HEAD',
  'LEFT_LAST_EXACT_SETTLEMENT_EXTENDS_RIGHT_HEAD',
  'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS',
  'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED',
  'HOLD_SOURCE_IDENTITY_MISMATCH',
  'HOLD_FRONTIER_OBSERVATION'
]);
const STATE = 'TWO_CALLER_PRESENTED_LOCAL_SETTLEMENT_FRONTIERS_OBSERVED_PAIRWISE_WITHOUT_GLOBALITY_RETENTION_INDEPENDENCE_OR_AUTHORITY';
const NEXT_GATE = 'AUTHENTICATED_EXTERNAL_CUSTODY_OR_GLOBALLY_CONSISTENT_LOG_AND_STEWARD_REVIEW';

class SettlementPairwiseObserverError extends Error {
  constructor(code, message) { super(message); this.name = 'SettlementPairwiseObserverError'; this.code = code; }
}

function stableStringify(value) { return V37.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return V37.sha256(value); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function fail(code, message) { throw new SettlementPairwiseObserverError(code, message); }
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}
function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' must be canonical JSON data'); }
  if (bytes > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
  return bytes;
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_INPUT', label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}
function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || Number.isNaN(Date.parse(result))) fail('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  return result;
}
function reference(value, label, expectedSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180), sha256: text(value.sha256, label + '.sha256', 71) };
  if (!/^sha256:[a-f0-9]{64}$/.test(result.sha256)) fail('INVALID_INPUT', label + '.sha256 must be an exact SHA-256 digest');
  if (expectedSchema && result.schema !== expectedSchema) fail('INVALID_INPUT', label + ' schema mismatch');
  return result;
}
function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function validateHead(value, label) {
  exactKeys(value, ['anchoredCheckpointRef', 'checkpointRef', 'anchorEpoch'], label);
  const head = {
    anchoredCheckpointRef: reference(value.anchoredCheckpointRef, label + '.anchoredCheckpointRef'),
    checkpointRef: reference(value.checkpointRef, label + '.checkpointRef'),
    anchorEpoch: value.anchorEpoch
  };
  if (!Number.isSafeInteger(head.anchorEpoch) || head.anchorEpoch < 1) fail('INVALID_INPUT', label + '.anchorEpoch must be a positive safe integer');
  return head;
}
function sameHead(left, right) { return same(left, right); }
function snapshotRef(snapshot) { return { id: snapshot.settlementLogId, schema: snapshot.schema, sha256: snapshot.snapshotDigest }; }
function settlementRef(settlement) { return { id: settlement.settlementId, schema: settlement.schema, sha256: settlement.settlementDigest }; }

function validateSideInput(value, label) {
  exactKeys(value, ['serviceOptions', 'settlementInput', 'settlementEvidence', 'settlementReceipt'], label);
  return clone(value);
}

function capture(service) {
  try {
    const snapshot = service.inspect();
    return snapshot === null ? { state: 'ABSENT', snapshot: null } : { state: 'PRESENT', snapshot: clone(snapshot) };
  } catch (error) { return { state: 'INVALID', snapshot: null }; }
}

function sameSnapshot(left, right) { return left && right && same(left, right); }

function currentPackageMatches(snapshot, receipt) {
  try {
    if (!snapshot || snapshot.pendingProposalRef !== null || !snapshot.lastSettlementRef) return false;
    const candidateRef = settlementRef(receipt);
    return sameReference(candidateRef, snapshot.lastSettlementRef) && receipt.log.sequence === snapshot.settlementCount &&
      sameHead(validateHead(receipt.resultingSettledHead, 'presented settlement resulting head'), validateHead(snapshot.currentSettledHead, 'current settled head'));
  } catch (error) { return false; }
}

function observeSide(side) {
  const service = V37.createService(clone(side.serviceOptions));
  const before = capture(service);
  let exactRebuild = false;
  try { exactRebuild = service.verifySettlementPersisted(clone(side.settlementInput), clone(side.settlementEvidence), clone(side.settlementReceipt)).pass === true; }
  catch (error) { exactRebuild = false; }
  const after = capture(service);
  const equalSnapshots = before.state === 'PRESENT' && after.state === 'PRESENT' && sameSnapshot(before.snapshot, after.snapshot);
  const pending = after.state === 'PRESENT' && after.snapshot.pendingProposalRef !== null;
  const currentMatch = after.state === 'PRESENT' && exactRebuild && currentPackageMatches(after.snapshot, side.settlementReceipt);
  let classification;
  if (before.state === 'INVALID' || after.state === 'INVALID') classification = 'ROOT_INVALID';
  else if (before.state !== after.state || (before.state === 'PRESENT' && !equalSnapshots)) classification = 'ROOT_CHANGED_DURING_CHECK';
  else if (before.state === 'ABSENT') classification = 'ROOT_ABSENT';
  else if (pending) classification = 'PENDING_PROPOSAL_PRESENT';
  else if (!exactRebuild) classification = 'SETTLEMENT_PACKAGE_NOT_EXACT';
  else if (!currentMatch) classification = 'SETTLEMENT_PACKAGE_NOT_CURRENT';
  else classification = 'EXACT_CURRENT_SETTLEMENT_PACKAGE';
  const observation = {
    classification,
    beforeCaptureState: before.state,
    afterCaptureState: after.state,
    beforeSnapshotRef: before.snapshot ? snapshotRef(before.snapshot) : null,
    afterSnapshotRef: after.snapshot ? snapshotRef(after.snapshot) : null,
    equalBracketingSnapshots: equalSnapshots,
    settlementPackageExactRebuild: exactRebuild,
    settlementPackageMatchesCurrentReceipt: currentMatch,
    pendingProposalPresent: pending
  };
  return { beforeSnapshot: before.snapshot, afterSnapshot: after.snapshot, observation };
}

function sideView(observed, side) {
  const snapshot = observed.afterSnapshot;
  const exact = observed.observation.classification === 'EXACT_CURRENT_SETTLEMENT_PACKAGE';
  return {
    observation: clone(observed.observation),
    snapshotRef: snapshot ? snapshotRef(snapshot) : null,
    settlementLogId: snapshot ? snapshot.settlementLogId : null,
    sourceLogId: snapshot ? snapshot.sourceLogId : null,
    sourceManifestRef: snapshot ? clone(snapshot.sourceManifestRef) : null,
    genesisSettledHead: snapshot ? clone(snapshot.genesisSettledHead) : null,
    currentSettledHead: snapshot ? clone(snapshot.currentSettledHead) : null,
    proposalCount: snapshot ? snapshot.proposalCount : null,
    settlementCount: snapshot ? snapshot.settlementCount : null,
    heldSettlementCount: snapshot ? snapshot.heldSettlementCount : null,
    lastProposalRef: snapshot ? clone(snapshot.lastProposalRef) : null,
    lastSettlementRef: snapshot ? clone(snapshot.lastSettlementRef) : null,
    presentedSettlementRef: exact ? settlementRef(side.settlementReceipt) : null,
    presentedSettlementClassification: exact ? side.settlementReceipt.classification : null,
    presentedSettlementAdvanced: exact ? side.settlementReceipt.decision.settledHeadAdvanced : null
  };
}

function sourceIdentityMatches(left, right) {
  return left.sourceLogId === right.sourceLogId && same(left.sourceManifestRef, right.sourceManifestRef) && sameHead(left.genesisSettledHead, right.genesisSettledHead);
}

function buildComparison(left, right, leftInput, rightInput) {
  const admitted = left.observation.classification === 'EXACT_CURRENT_SETTLEMENT_PACKAGE' && right.observation.classification === 'EXACT_CURRENT_SETTLEMENT_PACKAGE';
  const identityMatches = admitted && sourceIdentityMatches(left, right);
  const exactReplay = identityMatches && same(left.snapshotRef, right.snapshotRef);
  const headsMatch = identityMatches && sameHead(left.currentSettledHead, right.currentSettledHead);
  const rightExtendsLeft = identityMatches && !headsMatch && rightInput.settlementReceipt.decision.settledHeadAdvanced === true &&
    sameHead(rightInput.settlementReceipt.previousSettledHead, left.currentSettledHead) && sameHead(rightInput.settlementReceipt.resultingSettledHead, right.currentSettledHead);
  const leftExtendsRight = identityMatches && !headsMatch && leftInput.settlementReceipt.decision.settledHeadAdvanced === true &&
    sameHead(leftInput.settlementReceipt.previousSettledHead, right.currentSettledHead) && sameHead(leftInput.settlementReceipt.resultingSettledHead, left.currentSettledHead);
  const sameEpochDifferentHeads = identityMatches && !headsMatch && !rightExtendsLeft && !leftExtendsRight && left.currentSettledHead.anchorEpoch === right.currentSettledHead.anchorEpoch;
  return {
    bothCurrentSettlementPackagesExact: admitted,
    sourceIdentityMatches: identityMatches,
    exactSnapshotReplay: exactReplay,
    settledHeadsMatch: headsMatch,
    rightLastExactSettlementExtendsLeftHead: rightExtendsLeft,
    leftLastExactSettlementExtendsRightHead: leftExtendsRight,
    sameLocalEpochDifferentSettledHeads: sameEpochDifferentHeads,
    differentLocalEpochHeadRelationUnresolved: identityMatches && !headsMatch && !rightExtendsLeft && !leftExtendsRight && !sameEpochDifferentHeads,
    completeProposalAndSettlementHistoriesCompared: false,
    unpresentedOrWithheldFrontiersObserved: false
  };
}

function classify(comparison) {
  if (!comparison.bothCurrentSettlementPackagesExact) return 'HOLD_FRONTIER_OBSERVATION';
  if (!comparison.sourceIdentityMatches) return 'HOLD_SOURCE_IDENTITY_MISMATCH';
  if (comparison.exactSnapshotReplay) return 'PRESENTED_FRONTIER_EXACT_REPLAY';
  if (comparison.settledHeadsMatch) return 'MATCHING_SETTLED_HEAD_DISTINCT_LOCAL_FRONTIERS';
  if (comparison.rightLastExactSettlementExtendsLeftHead) return 'RIGHT_LAST_EXACT_SETTLEMENT_EXTENDS_LEFT_HEAD';
  if (comparison.leftLastExactSettlementExtendsRightHead) return 'LEFT_LAST_EXACT_SETTLEMENT_EXTENDS_RIGHT_HEAD';
  if (comparison.sameLocalEpochDifferentSettledHeads) return 'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS';
  return 'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED';
}

function bestAction(classification) {
  if (classification === 'PRESENTED_FRONTIER_EXACT_REPLAY') return 'RETAIN_NO_NEW_PAIRWISE_STATE';
  if (classification === 'MATCHING_SETTLED_HEAD_DISTINCT_LOCAL_FRONTIERS') return 'REVIEW_MATCHING_HEAD_WITHOUT_INFERRING_SHARED_HISTORY_OR_INDEPENDENCE';
  if (classification.includes('EXTENDS')) return 'REVIEW_RELATIVE_ONE_SETTLEMENT_EXTENSION_WITHOUT_INFERRING_GLOBAL_ORDER';
  if (classification === 'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS') return 'PRESERVE_BOTH_CALLER_PACKAGES_AND_REQUEST_AUTHENTICATED_STEWARD_RECONCILIATION';
  if (classification === 'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED') return 'PRESERVE_BOTH_CALLER_PACKAGES_AND_REQUEST_COMPLETE_HISTORY_COMPARISON';
  if (classification === 'HOLD_SOURCE_IDENTITY_MISMATCH') return 'PRESERVE_BOTH_SOURCE_IDENTITIES_AND_HOLD_COMPARISON';
  return 'PRESERVE_CALLER_PACKAGES_AND_RETRY_ONLY_AFTER_OBSERVATION_UNCERTAINTY_IS_EXPLICITLY_RESOLVED';
}

function truth(classification, comparison, left, right) {
  return {
    leftSettlementPackageExactRebuilt: left.observation.settlementPackageExactRebuild,
    rightSettlementPackageExactRebuilt: right.observation.settlementPackageExactRebuild,
    leftSettlementPackageMatchesCurrentReceipt: left.observation.settlementPackageMatchesCurrentReceipt,
    rightSettlementPackageMatchesCurrentReceipt: right.observation.settlementPackageMatchesCurrentReceipt,
    equalBracketingSnapshotsRequiredForAdmittedSide: true,
    currentLastSettlementReceiptRequiredForAdmittedSide: true,
    sourceIdentityCompared: comparison.bothCurrentSettlementPackagesExact,
    currentSettledHeadsCompared: comparison.sourceIdentityMatches,
    latestPresentedSettlementReceiptsCompared: comparison.sourceIdentityMatches,
    exactPresentedFrontierReplayObserved: classification === 'PRESENTED_FRONTIER_EXACT_REPLAY',
    matchingSettledHeadObserved: classification === 'MATCHING_SETTLED_HEAD_DISTINCT_LOCAL_FRONTIERS',
    relativeOneSettlementExtensionObserved: classification.includes('EXTENDS'),
    sameLocalEpochDifferentSettledHeadsObserved: classification === 'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS',
    differentLocalEpochHeadRelationUnresolved: classification === 'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED',
    observationOrIdentityHoldRequired: classification.startsWith('HOLD_'),
    pairwiseObservationOnly: true,
    completeProposalAndSettlementHistoriesCompared: false,
    sameSettledHeadProvesSameHistory: false,
    settlementRootObservationAtomicAcrossBothRoots: false,
    settlementRootsMayChangeAfterEitherFinalObservation: true,
    liveV36SourceRecaptured: false,
    sourceEntryCurrentnessReverified: false,
    rootsAuthenticatedIndependent: false,
    rootControllersIndependent: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    withheldBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    originalPairContinuityProven: false,
    jointPairReplacementStillPossible: true,
    comparisonTimeExternallyTrusted: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    rawCallerPackageEmbedded: false,
    sourceOrSettlementPathEmbedded: false,
    rawReviewMaterialEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    retentionOrSettlementResolved: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    autonomousActionCount: 0,
    automaticWrite: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildObservation(value) {
  bound(value, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'transition settlement pairwise observer input');
  const input = clone(value);
  exactKeys(input, ['observationId', 'observedAt', 'left', 'right'], 'transition settlement pairwise observer input');
  const observationId = text(input.observationId, 'pairwise observation id', 180);
  const observedAt = timestamp(input.observedAt, 'pairwise observation time');
  const leftInput = validateSideInput(input.left, 'left settlement frontier input');
  const rightInput = validateSideInput(input.right, 'right settlement frontier input');
  const leftObserved = observeSide(leftInput);
  const rightObserved = observeSide(rightInput);
  const left = sideView(leftObserved, leftInput);
  const right = sideView(rightObserved, rightInput);
  const comparison = buildComparison(left, right, leftInput, rightInput);
  if (left.observation.settlementPackageExactRebuild && Date.parse(observedAt) < Date.parse(leftInput.settlementReceipt.settledAt)) fail('OBSERVATION_TIME_INVALID', 'pairwise observation time cannot predate the exact-rebuilt left settlement receipt');
  if (right.observation.settlementPackageExactRebuild && Date.parse(observedAt) < Date.parse(rightInput.settlementReceipt.settledAt)) fail('OBSERVATION_TIME_INVALID', 'pairwise observation time cannot predate the exact-rebuilt right settlement receipt');
  const classification = classify(comparison);
  if (!CLASSIFICATIONS.includes(classification)) fail('CLASSIFICATION_INVALID', 'pairwise observation classification is outside the closed set');
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: STATUS,
    observationId,
    observedAt,
    left,
    right,
    comparison,
    classification,
    decision: {
      reviewRequired: true,
      holdRequired: classification.startsWith('HOLD_'),
      contradictionObserved: classification === 'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS',
      relativeExtensionCandidate: classification.includes('EXTENDS'),
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: STATE,
    nextGate: NEXT_GATE,
    truth: truth(classification, comparison, left, right),
    observationDigest: null
  };
  receipt.observationDigest = sha256(withoutField(receipt, 'observationDigest'));
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'RECEIPT_TOO_LARGE', 'transition settlement pairwise observation receipt');
  return receipt;
}

function verifyObservation(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'RECEIPT_TOO_LARGE', 'transition settlement pairwise observation receipt');
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) fail('RECEIPT_INVALID', 'transition settlement pairwise observation receipt schema mismatch');
    rebuilt = buildObservation(input);
    if (!same(rebuilt, receipt)) fail('RECEIPT_INVALID', 'transition settlement pairwise observation receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  RECEIPT_SCHEMA, VERSION, STATUS, MAX_INPUT_CANONICAL_BYTES, MAX_RECEIPT_CANONICAL_BYTES,
  SIDE_OBSERVATIONS, CAPTURE_STATES, CLASSIFICATIONS, STATE, NEXT_GATE,
  SettlementPairwiseObserverError, stableStringify, sha256, buildObservation, verifyObservation
};
