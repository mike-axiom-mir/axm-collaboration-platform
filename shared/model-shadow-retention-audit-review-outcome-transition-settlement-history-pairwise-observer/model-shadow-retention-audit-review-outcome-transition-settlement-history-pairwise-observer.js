#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');

const RECEIPT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observation/v1';
const HISTORY_COMMITMENT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-commitment/v1';
const VERSION = '3.9.0';
const STATUS = 'TEST';
const MAX_INPUT_CANONICAL_BYTES = 256 * 1024;
const MAX_RECEIPT_CANONICAL_BYTES = 2 * 1024 * 1024;
const SIDE_OBSERVATIONS = Object.freeze([
  'EXACT_STABLE_COMPLETE_HISTORY',
  'ROOT_ABSENT',
  'ROOT_INVALID',
  'ROOT_CHANGED_DURING_CHECK',
  'HISTORY_CAPTURE_INVALID',
  'HISTORY_SNAPSHOT_MISMATCH'
]);
const CAPTURE_STATES = Object.freeze(['PRESENT', 'ABSENT', 'INVALID']);
const CLASSIFICATIONS = Object.freeze([
  'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY',
  'MATCHING_COMPLETE_TRANSITION_HISTORY_DISTINCT_LOCAL_ARTIFACTS',
  'RIGHT_COMPLETE_HISTORY_EXTENDS_LEFT_PREFIX',
  'LEFT_COMPLETE_HISTORY_EXTENDS_RIGHT_PREFIX',
  'COMPLETE_HISTORY_DIVERGES',
  'HOLD_SOURCE_IDENTITY_MISMATCH',
  'HOLD_HISTORY_OBSERVATION'
]);
const STATE = 'TWO_CALLER_PRESENTED_COMPLETE_LOCAL_SETTLEMENT_HISTORIES_COMPARED_WITHOUT_ATOMICITY_CUSTODY_GLOBALITY_OR_AUTHORITY';
const NEXT_GATE = 'AUTHENTICATED_EXTERNAL_CUSTODY_OR_PROTECTED_GLOBALLY_CONSISTENT_HISTORY_AND_STEWARD_RECONCILIATION';
const RECORD_FILE = /^([0-9]{12})\.json$/;

class SettlementHistoryPairwiseObserverError extends Error {
  constructor(code, message) { super(message); this.name = 'SettlementHistoryPairwiseObserverError'; this.code = code; }
}

function stableStringify(value) { return V37.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return V37.sha256(value); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function fail(code, message) { throw new SettlementHistoryPairwiseObserverError(code, message); }
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
function digest(value, label) {
  const result = text(value, label, 71);
  if (!/^sha256:[a-f0-9]{64}$/.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}
function reference(value, label, expectedSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
  if (expectedSchema && result.schema !== expectedSchema) fail('INVALID_INPUT', label + ' schema mismatch');
  return result;
}
function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function validateHead(value, label) {
  exactKeys(value, ['anchoredCheckpointRef', 'checkpointRef', 'anchorEpoch'], label);
  const result = {
    anchoredCheckpointRef: reference(value.anchoredCheckpointRef, label + '.anchoredCheckpointRef'),
    checkpointRef: reference(value.checkpointRef, label + '.checkpointRef'),
    anchorEpoch: value.anchorEpoch
  };
  if (!Number.isSafeInteger(result.anchorEpoch) || result.anchorEpoch < 1) fail('INVALID_INPUT', label + '.anchorEpoch must be a positive safe integer');
  return result;
}
function snapshotRef(snapshot) { return { id: snapshot.settlementLogId, schema: snapshot.schema, sha256: snapshot.snapshotDigest }; }
function manifestRef(manifest) { return { id: manifest.settlementLogId, schema: manifest.schema, sha256: manifest.manifestDigest }; }
function proposalRef(proposal) { return { id: proposal.proposalId, schema: proposal.schema, sha256: proposal.proposalDigest }; }
function settlementRef(settlement) { return { id: settlement.settlementId, schema: settlement.schema, sha256: settlement.settlementDigest }; }

function validateSideInput(value, label) {
  exactKeys(value, ['serviceOptions'], label);
  return clone(value);
}

function captureSnapshot(service) {
  try {
    const snapshot = service.inspect();
    return snapshot === null ? { state: 'ABSENT', snapshot: null } : { state: 'PRESENT', snapshot: clone(snapshot) };
  } catch (error) { return { state: 'INVALID', snapshot: null }; }
}

function assertRealDirectory(directoryPath, label) {
  const stat = fs.lstatSync(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(label + ' must be a real directory and not a symbolic link or junction');
}

function fixedPaths(stateRoot) {
  const root = path.resolve(text(stateRoot, 'settlement stateRoot', 32767));
  if (root === path.parse(root).root) throw new Error('filesystem root cannot be used as settlement stateRoot');
  assertRealDirectory(root, 'settlement stateRoot');
  const namespace = path.join(root, V37.NAMESPACE);
  return {
    namespace,
    manifest: path.join(namespace, V37.MANIFEST_FILE),
    proposals: path.join(namespace, V37.PROPOSALS_DIRECTORY),
    settlements: path.join(namespace, V37.SETTLEMENTS_DIRECTORY),
    lock: path.join(namespace, V37.LOCK_FILE)
  };
}

function readCanonical(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(label + ' must be a regular file and not a symbolic link');
  if (stat.size > V37.MAX_ARTIFACT_CANONICAL_BYTES + 1) throw new Error(label + ' exceeds the v3.7 canonical byte limit');
  const raw = fs.readFileSync(filePath, 'utf8');
  const value = JSON.parse(raw);
  if (raw !== stableStringify(value) + '\n') throw new Error(label + ' is not exact canonical JSON');
  return { value, bytes: stat.size };
}

function contiguousNames(directoryPath, label) {
  assertRealDirectory(directoryPath, label);
  const names = fs.readdirSync(directoryPath).sort();
  if (names.length > V37.MAX_RECORDS) throw new Error(label + ' exceeds the v3.7 record limit');
  names.forEach((name, index) => {
    const match = RECORD_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) throw new Error(label + ' is not one contiguous 12-digit sequence');
  });
  return names;
}

function selfDigest(value, field, label) {
  const observed = digest(value[field], label + '.' + field);
  if (sha256(withoutField(value, field)) !== observed) throw new Error(label + ' self-digest mismatch');
}

function normalizedProposal(proposal) {
  const value = clone(proposal);
  delete value.proposalId;
  delete value.proposedAt;
  delete value.manifestRef;
  delete value.previousProposalRef;
  delete value.proposalDigest;
  delete value.log.settlementLogId;
  return value;
}

function normalizedSettlement(settlement) {
  const value = clone(settlement);
  delete value.settlementId;
  delete value.settledAt;
  delete value.manifestRef;
  delete value.proposalRef;
  delete value.settlementDigest;
  delete value.log.settlementLogId;
  return value;
}

function buildCommitment(snapshot, manifest, proposals, settlements, events) {
  const proposalRefs = proposals.map(proposalRef);
  const settlementRefs = settlements.map(settlementRef);
  const commitment = {
    schema: HISTORY_COMMITMENT_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementLogId: manifest.settlementLogId,
    snapshotRef: snapshotRef(snapshot),
    manifestRef: manifestRef(manifest),
    proposalCount: proposals.length,
    settlementCount: settlements.length,
    eventCount: events.length,
    pendingProposalPresent: proposals.length > settlements.length,
    lastProposalRef: proposalRefs.length ? proposalRefs[proposalRefs.length - 1] : null,
    lastSettlementRef: settlementRefs.length ? settlementRefs[settlementRefs.length - 1] : null,
    proposalArtifactSequenceDigest: sha256(proposalRefs),
    settlementArtifactSequenceDigest: sha256(settlementRefs),
    normalizedEventHistoryDigest: sha256(events),
    historyCommitmentDigest: null
  };
  commitment.historyCommitmentDigest = sha256(withoutField(commitment, 'historyCommitmentDigest'));
  return commitment;
}

function captureHistory(stateRoot, snapshot) {
  const paths = fixedPaths(stateRoot);
  if (!fs.existsSync(paths.namespace)) return { state: 'ABSENT', history: null };
  assertRealDirectory(paths.namespace, 'v3.7 settlement namespace');
  if (fs.existsSync(paths.lock)) throw new Error('v3.7 settlement operation lock is present');
  const names = fs.readdirSync(paths.namespace).sort();
  const expected = [V37.MANIFEST_FILE, V37.PROPOSALS_DIRECTORY, V37.SETTLEMENTS_DIRECTORY].sort();
  if (!same(names, expected)) throw new Error('v3.7 settlement namespace has unexpected or missing items');
  const manifestRead = readCanonical(paths.manifest, 'v3.7 settlement manifest');
  const manifest = manifestRead.value;
  if (manifest.schema !== V37.MANIFEST_SCHEMA || manifest.version !== V37.VERSION || manifest.status !== V37.STATUS) throw new Error('v3.7 manifest identity mismatch');
  selfDigest(manifest, 'manifestDigest', 'v3.7 manifest');
  const proposalNames = contiguousNames(paths.proposals, 'v3.7 proposal directory');
  const settlementNames = contiguousNames(paths.settlements, 'v3.7 settlement directory');
  if (settlementNames.length > proposalNames.length || proposalNames.length - settlementNames.length > 1) throw new Error('v3.7 proposal and settlement counts are inconsistent');
  let totalBytes = manifestRead.bytes;
  const proposals = proposalNames.map((name, index) => {
    const read = readCanonical(path.join(paths.proposals, name), 'v3.7 proposal ' + name);
    totalBytes += read.bytes;
    const proposal = read.value;
    if (proposal.schema !== V37.PROPOSAL_SCHEMA || proposal.version !== V37.VERSION || proposal.status !== V37.STATUS || proposal.log.sequence !== index + 1) throw new Error('v3.7 proposal identity or sequence mismatch');
    selfDigest(proposal, 'proposalDigest', 'v3.7 proposal ' + name);
    return proposal;
  });
  const settlements = settlementNames.map((name, index) => {
    const read = readCanonical(path.join(paths.settlements, name), 'v3.7 settlement ' + name);
    totalBytes += read.bytes;
    const settlement = read.value;
    if (settlement.schema !== V37.SETTLEMENT_SCHEMA || settlement.version !== V37.VERSION || settlement.status !== V37.STATUS || settlement.log.sequence !== index + 1) throw new Error('v3.7 settlement identity or sequence mismatch');
    selfDigest(settlement, 'settlementDigest', 'v3.7 settlement ' + name);
    return settlement;
  });
  if (totalBytes > V37.MAX_LEDGER_BYTES) throw new Error('v3.7 history exceeds the aggregate byte limit');
  const events = [];
  proposals.forEach((proposal, index) => {
    events.push({ kind: 'PROPOSAL', sequence: index + 1, contentDigest: sha256(normalizedProposal(proposal)) });
    if (settlements[index]) events.push({ kind: 'SETTLEMENT', sequence: index + 1, contentDigest: sha256(normalizedSettlement(settlements[index])) });
  });
  const times = proposals.map(value => value.proposedAt).concat(settlements.map(value => value.settledAt));
  const latestLocalEventAt = times.reduce((latest, value) => !latest || Date.parse(value) > Date.parse(latest) ? value : latest, null);
  return {
    state: 'PRESENT',
    history: {
      commitment: buildCommitment(snapshot, manifest, proposals, settlements, events),
      events,
      latestLocalEventAt
    }
  };
}

function captureHistorySafe(stateRoot, snapshot) {
  try { return captureHistory(stateRoot, snapshot); }
  catch (error) { return { state: 'INVALID', history: null }; }
}

function historyMatchesSnapshot(history, snapshot) {
  if (!history || !snapshot) return false;
  const commitment = history.commitment;
  const pendingRef = commitment.pendingProposalPresent ? commitment.lastProposalRef : null;
  return commitment.settlementLogId === snapshot.settlementLogId &&
    sameReference(commitment.snapshotRef, snapshotRef(snapshot)) &&
    sameReference(commitment.manifestRef, snapshot.manifestRef) &&
    commitment.proposalCount === snapshot.proposalCount && commitment.settlementCount === snapshot.settlementCount &&
    same(commitment.lastProposalRef, snapshot.lastProposalRef) && same(commitment.lastSettlementRef, snapshot.lastSettlementRef) &&
    same(pendingRef, snapshot.pendingProposalRef);
}

function historyRef(history) {
  return history ? { id: history.commitment.settlementLogId, schema: history.commitment.schema, sha256: history.commitment.historyCommitmentDigest } : null;
}

function observeSide(side) {
  const service = V37.createService(clone(side.serviceOptions));
  const before = captureSnapshot(service);
  const firstHistory = captureHistorySafe(side.serviceOptions.stateRoot, before.snapshot);
  const middle = captureSnapshot(service);
  const secondHistory = captureHistorySafe(side.serviceOptions.stateRoot, middle.snapshot);
  const after = captureSnapshot(service);
  const snapshotCaptures = [before, middle, after];
  const historyCaptures = [firstHistory, secondHistory];
  const snapshotStates = snapshotCaptures.map(value => value.state);
  const historyStates = historyCaptures.map(value => value.state);
  const snapshotsPresent = snapshotStates.every(value => value === 'PRESENT');
  const snapshotsAbsent = snapshotStates.every(value => value === 'ABSENT');
  const snapshotsInvalid = snapshotStates.some(value => value === 'INVALID');
  const historiesPresent = historyStates.every(value => value === 'PRESENT');
  const historiesAbsent = historyStates.every(value => value === 'ABSENT');
  const historiesInvalid = historyStates.every(value => value === 'INVALID');
  const equalSnapshots = snapshotsPresent && same(before.snapshot, middle.snapshot) && same(middle.snapshot, after.snapshot);
  const equalHistories = historiesPresent && same(firstHistory.history.commitment, secondHistory.history.commitment) && same(firstHistory.history.events, secondHistory.history.events);
  const matchesEverySnapshot = snapshotsPresent && historiesPresent &&
    historyMatchesSnapshot(firstHistory.history, before.snapshot) && historyMatchesSnapshot(firstHistory.history, middle.snapshot) &&
    historyMatchesSnapshot(secondHistory.history, middle.snapshot) && historyMatchesSnapshot(secondHistory.history, after.snapshot);
  let classification;
  if (snapshotsInvalid) classification = 'ROOT_INVALID';
  else if (snapshotsAbsent && historiesAbsent) classification = 'ROOT_ABSENT';
  else if (!snapshotsPresent || (!historiesPresent && !historiesInvalid) || (historiesPresent && (!equalSnapshots || !equalHistories))) classification = 'ROOT_CHANGED_DURING_CHECK';
  else if (historiesInvalid) classification = 'HISTORY_CAPTURE_INVALID';
  else if (!matchesEverySnapshot) classification = 'HISTORY_SNAPSHOT_MISMATCH';
  else classification = 'EXACT_STABLE_COMPLETE_HISTORY';
  const selectedHistory = secondHistory.state === 'PRESENT' ? secondHistory.history : null;
  return {
    observation: {
      classification,
      snapshotCaptureStates: snapshotStates,
      historyCaptureStates: historyStates,
      snapshotRefs: snapshotCaptures.map(value => value.snapshot ? snapshotRef(value.snapshot) : null),
      historyCommitmentRefs: historyCaptures.map(value => historyRef(value.history)),
      equalBracketingSnapshots: equalSnapshots,
      equalCompleteHistoryCaptures: equalHistories,
      historyMatchesEverySnapshot: matchesEverySnapshot,
      completeHistoryCaptured: historiesPresent
    },
    snapshot: after.snapshot,
    history: selectedHistory
  };
}

function sideView(observed) {
  const snapshot = observed.snapshot;
  const exact = observed.observation.classification === 'EXACT_STABLE_COMPLETE_HISTORY';
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
    pendingProposalPresent: snapshot ? snapshot.pendingProposalRef !== null : null,
    historyCommitment: exact ? clone(observed.history.commitment) : null
  };
}

function sourceIdentityMatches(left, right) {
  return left.sourceLogId === right.sourceLogId && same(left.sourceManifestRef, right.sourceManifestRef) && same(left.genesisSettledHead, right.genesisSettledHead);
}

function eventMatches(left, right) { return left.kind === right.kind && left.sequence === right.sequence && left.contentDigest === right.contentDigest; }

function buildComparison(left, right, leftEvents, rightEvents) {
  const admitted = left.observation.classification === 'EXACT_STABLE_COMPLETE_HISTORY' && right.observation.classification === 'EXACT_STABLE_COMPLETE_HISTORY';
  const identityMatches = admitted && sourceIdentityMatches(left, right);
  let commonPrefix = 0;
  if (identityMatches) {
    const limit = Math.min(leftEvents.length, rightEvents.length);
    while (commonPrefix < limit && eventMatches(leftEvents[commonPrefix], rightEvents[commonPrefix])) commonPrefix += 1;
  }
  const normalizedMatch = identityMatches && leftEvents.length === rightEvents.length && commonPrefix === leftEvents.length;
  const exactReplay = normalizedMatch && same(left.historyCommitment, right.historyCommitment);
  const leftPrefix = identityMatches && leftEvents.length < rightEvents.length && commonPrefix === leftEvents.length;
  const rightPrefix = identityMatches && rightEvents.length < leftEvents.length && commonPrefix === rightEvents.length;
  const diverges = identityMatches && !normalizedMatch && !leftPrefix && !rightPrefix;
  let earliestDivergence = null;
  if (diverges) {
    const leftEvent = leftEvents[commonPrefix] || null;
    const rightEvent = rightEvents[commonPrefix] || null;
    earliestDivergence = {
      eventIndex: commonPrefix + 1,
      leftKind: leftEvent ? leftEvent.kind : null,
      leftSequence: leftEvent ? leftEvent.sequence : null,
      leftContentDigest: leftEvent ? leftEvent.contentDigest : null,
      rightKind: rightEvent ? rightEvent.kind : null,
      rightSequence: rightEvent ? rightEvent.sequence : null,
      rightContentDigest: rightEvent ? rightEvent.contentDigest : null
    };
  }
  return {
    bothCompleteHistoriesStable: admitted,
    sourceIdentityMatches: identityMatches,
    completeArtifactHistoryExactReplay: exactReplay,
    completeNormalizedEventHistoriesMatch: normalizedMatch,
    rightCompleteHistoryExtendsLeftPrefix: leftPrefix,
    leftCompleteHistoryExtendsRightPrefix: rightPrefix,
    completeHistoriesDiverge: diverges,
    commonNormalizedEventPrefixLength: identityMatches ? commonPrefix : 0,
    earliestDivergence,
    atomicTwoRootHistorySnapshotProven: false,
    transientMutationAndReversionExcluded: false,
    unpresentedOrWithheldHistoriesObserved: false
  };
}

function classify(comparison) {
  if (!comparison.bothCompleteHistoriesStable) return 'HOLD_HISTORY_OBSERVATION';
  if (!comparison.sourceIdentityMatches) return 'HOLD_SOURCE_IDENTITY_MISMATCH';
  if (comparison.completeArtifactHistoryExactReplay) return 'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY';
  if (comparison.completeNormalizedEventHistoriesMatch) return 'MATCHING_COMPLETE_TRANSITION_HISTORY_DISTINCT_LOCAL_ARTIFACTS';
  if (comparison.rightCompleteHistoryExtendsLeftPrefix) return 'RIGHT_COMPLETE_HISTORY_EXTENDS_LEFT_PREFIX';
  if (comparison.leftCompleteHistoryExtendsRightPrefix) return 'LEFT_COMPLETE_HISTORY_EXTENDS_RIGHT_PREFIX';
  return 'COMPLETE_HISTORY_DIVERGES';
}

function bestAction(classification) {
  if (classification === 'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY') return 'RETAIN_NO_NEW_PAIRWISE_STATE';
  if (classification === 'MATCHING_COMPLETE_TRANSITION_HISTORY_DISTINCT_LOCAL_ARTIFACTS') return 'REVIEW_MATCHING_NORMALIZED_HISTORY_WITHOUT_INFERRING_ROOT_INDEPENDENCE_OR_GLOBALITY';
  if (classification.includes('EXTENDS')) return 'REVIEW_COMPLETE_LOCAL_PREFIX_EXTENSION_WITHOUT_INFERRING_GLOBAL_ORDER_OR_CURRENTNESS';
  if (classification === 'COMPLETE_HISTORY_DIVERGES') return 'PRESERVE_BOTH_HISTORY_COMMITMENTS_AND_REQUEST_AUTHENTICATED_STEWARD_RECONCILIATION';
  if (classification === 'HOLD_SOURCE_IDENTITY_MISMATCH') return 'PRESERVE_BOTH_SOURCE_IDENTITIES_AND_HOLD_COMPARISON';
  return 'PRESERVE_CALLER_ROOTS_AND_RETRY_ONLY_AFTER_HISTORY_OBSERVATION_UNCERTAINTY_IS_EXPLICITLY_RESOLVED';
}

function truth(classification, comparison, left, right) {
  return {
    leftCompleteHistoryCapturedTwice: left.observation.equalCompleteHistoryCaptures,
    rightCompleteHistoryCapturedTwice: right.observation.equalCompleteHistoryCaptures,
    threeV37FullChainInspectionsRequiredPerAdmittedSide: true,
    storedArtifactSelfDigestsRecheckedTwicePerAdmittedSide: true,
    completeProposalAndSettlementArtifactHistoriesCompared: comparison.sourceIdentityMatches,
    normalizedProposalAndSettlementEventHistoriesCompared: comparison.sourceIdentityMatches,
    intermediateHeldSettlementOutcomesCompared: comparison.sourceIdentityMatches,
    exactPresentedArtifactHistoryReplayObserved: classification === 'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY',
    matchingCompleteNormalizedHistoryObserved: classification === 'MATCHING_COMPLETE_TRANSITION_HISTORY_DISTINCT_LOCAL_ARTIFACTS',
    completeLocalHistoryPrefixExtensionObserved: classification.includes('EXTENDS'),
    completeLocalHistoryDivergenceObserved: classification === 'COMPLETE_HISTORY_DIVERGES',
    earliestDivergentStoredEventLocated: classification === 'COMPLETE_HISTORY_DIVERGES',
    observationOrIdentityHoldRequired: classification.startsWith('HOLD_'),
    completeHistoryComparisonIsPairwiseAndCallerPresentedOnly: true,
    atomicSingleRootHistorySnapshotProven: false,
    atomicTwoRootHistorySnapshotProven: false,
    transientMutationAndReversionExcluded: false,
    settlementRootsMayChangeAfterFinalObservation: true,
    callerPackagesRebuilt: false,
    liveV36SourceRecaptured: false,
    sourceEntryCurrentnessReverified: false,
    rootsAuthenticatedIndependent: false,
    rootControllersIndependent: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    withheldHistoriesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    originalPairContinuityProven: false,
    jointPairReplacementStillPossible: true,
    comparisonTimeExternallyTrusted: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    rawStoredArtifactEmbedded: false,
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
  bound(value, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'transition settlement history pairwise observer input');
  const input = clone(value);
  exactKeys(input, ['observationId', 'observedAt', 'left', 'right'], 'transition settlement history pairwise observer input');
  const observationId = text(input.observationId, 'history pairwise observation id', 180);
  const observedAt = timestamp(input.observedAt, 'history pairwise observation time');
  const leftInput = validateSideInput(input.left, 'left complete settlement history input');
  const rightInput = validateSideInput(input.right, 'right complete settlement history input');
  const leftObserved = observeSide(leftInput);
  const rightObserved = observeSide(rightInput);
  const left = sideView(leftObserved);
  const right = sideView(rightObserved);
  const leftEvents = leftObserved.history ? leftObserved.history.events : [];
  const rightEvents = rightObserved.history ? rightObserved.history.events : [];
  if (leftObserved.observation.classification === 'EXACT_STABLE_COMPLETE_HISTORY' && Date.parse(observedAt) < Date.parse(leftObserved.history.latestLocalEventAt)) fail('OBSERVATION_TIME_INVALID', 'history observation time cannot predate the latest left local event');
  if (rightObserved.observation.classification === 'EXACT_STABLE_COMPLETE_HISTORY' && Date.parse(observedAt) < Date.parse(rightObserved.history.latestLocalEventAt)) fail('OBSERVATION_TIME_INVALID', 'history observation time cannot predate the latest right local event');
  const comparison = buildComparison(left, right, leftEvents, rightEvents);
  const classification = classify(comparison);
  if (!CLASSIFICATIONS.includes(classification)) fail('CLASSIFICATION_INVALID', 'history pairwise observation classification is outside the closed set');
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
      divergenceObserved: classification === 'COMPLETE_HISTORY_DIVERGES',
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
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'RECEIPT_TOO_LARGE', 'transition settlement history pairwise observation receipt');
  return receipt;
}

function verifyObservation(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'RECEIPT_TOO_LARGE', 'transition settlement history pairwise observation receipt');
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) fail('RECEIPT_INVALID', 'transition settlement history pairwise observation receipt schema mismatch');
    rebuilt = buildObservation(input);
    if (!same(rebuilt, receipt)) fail('RECEIPT_INVALID', 'transition settlement history pairwise observation receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  RECEIPT_SCHEMA, HISTORY_COMMITMENT_SCHEMA, VERSION, STATUS,
  MAX_INPUT_CANONICAL_BYTES, MAX_RECEIPT_CANONICAL_BYTES,
  SIDE_OBSERVATIONS, CAPTURE_STATES, CLASSIFICATIONS, STATE, NEXT_GATE,
  SettlementHistoryPairwiseObserverError, stableStringify, sha256, buildObservation, verifyObservation
};
