'use strict';

const Anchor = require('../model-shadow-history-checkpoint-anchor/model-shadow-history-checkpoint-anchor');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');
const Pairwise = require('../model-shadow-history-checkpoint-pairwise/model-shadow-history-checkpoint-pairwise');

const PIN_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-portable-pin/v1';
const TRANSITION_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-portable-pin-transition/v1';
const LEDGER_IDENTITY_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-portable-pin-ledger-identity/v1';
const HISTORY_COMMITMENT_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-portable-pin-history-commitment/v1';
const VERSION = '2.4.0';
const STATUS = 'TEST';
const MAX_PIN_BUILD_INPUT_CANONICAL_BYTES = 71303168;
const MAX_PIN_CANONICAL_BYTES = 1048576;
const MAX_TRANSITION_INPUT_CANONICAL_BYTES = 141557760;
const MAX_TRANSITION_RECEIPT_CANONICAL_BYTES = 2097152;
const CLASSIFICATIONS = Object.freeze([
  'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN',
  'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY',
  'PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT',
  'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY',
  'PIN_MATCH_UPSTREAM_PAIRWISE_HOLD'
]);
const PIN_BINDING_DIMENSIONS = Object.freeze([
  'anchoredCheckpointRef',
  'checkpointRef',
  'anchorRef',
  'anchorPolicyRef',
  'anchorProfileDigest',
  'witnessPolicyRef',
  'witnessProfileDigest',
  'ledgerIdentityDigest',
  'snapshotBinding',
  'proposalHistoryDigest',
  'settlementHistoryDigest',
  'proposalCount',
  'settlementCount'
]);

function stableStringify(value) { return Pairwise.stableStringify(value); }
function sha256(value) { return Pairwise.sha256(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function bound(value, maximum, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value)); }
  catch (error) { throw new Error(label + ' must be strict canonical JSON: ' + error.message); }
  if (bytes > maximum) throw new Error(label + ' exceeds ' + maximum + ' canonical bytes');
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const actual = Object.keys(value).sort();
  const expected = allowed.slice().sort();
  if (!same(actual, expected)) throw new Error(label + ' must contain exactly: ' + expected.join(', '));
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(label + ' must be bounded non-control text');
  }
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(label + ' must be an exact SHA-256 digest');
  return value;
}
function timestamp(value, label) {
  text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(label + ' must be canonical UTC milliseconds');
  }
  return value;
}
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(label + ' is outside the safe integer range');
  return value;
}
function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: text(value.id, label + '.id', 180),
    schema: text(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}
function snapshotBinding(value, label) {
  exactKeys(value, ['schema', 'sha256'], label);
  return { schema: text(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}
function pinRef(pin) { return { id: pin.pinId, schema: pin.schema, sha256: pin.pinDigest }; }

function ledgerIdentity(checkpoint) {
  return {
    schema: LEDGER_IDENTITY_SCHEMA,
    logIdDigest: checkpoint.logIdDigest,
    manifestRef: clone(checkpoint.manifestRef),
    genesisSeparatedWitnessRef: clone(checkpoint.genesisSeparatedWitnessRef),
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyRef: clone(checkpoint.receiverPolicyRef)
  };
}
function historyDigest(kind, refs) {
  return sha256({ schema: HISTORY_COMMITMENT_SCHEMA, kind, refs: clone(refs) });
}
function exactAnchoredPackage(input, receipt, label) {
  bound(input, Anchor.MAX_INPUT_CANONICAL_BYTES, label + ' input');
  bound(receipt, Anchor.MAX_RECEIPT_CANONICAL_BYTES, label + ' receipt');
  const check = Anchor.verifyAnchoredCheckpoint(clone(input), clone(receipt));
  if (!check.pass) throw new Error(label + ' does not exact-rebuild: ' + check.errors.join('; '));
  const checkpoint = History.validateCheckpoint(clone(input.witnessInput.checkpoint));
  if (check.rebuilt.checkpointRef.sha256 !== checkpoint.checkpointDigest) throw new Error(label + ' checkpoint reference mismatch');
  const anchorProfileDigest = sha256(Pairwise.anchorContinuityProfile(input.anchorPolicy));
  const witnessProfileDigest = sha256(Pairwise.witnessContinuityProfile(input.witnessInput.witnessPolicy));
  return { anchored: check.rebuilt, checkpoint, anchorProfileDigest, witnessProfileDigest };
}
function bindingFromExactPackage(exact) {
  const checkpoint = exact.checkpoint;
  return {
    anchoredCheckpointRef: { id: exact.anchored.receiptId, schema: exact.anchored.schema, sha256: exact.anchored.receiptDigest },
    checkpointRef: clone(exact.anchored.checkpointRef),
    anchorRef: clone(exact.anchored.anchorRef),
    anchorPolicyRef: clone(exact.anchored.anchorPolicyRef),
    anchorProfileDigest: exact.anchorProfileDigest,
    witnessPolicyRef: clone(exact.anchored.witnessPolicyRef),
    witnessProfileDigest: exact.witnessProfileDigest,
    ledgerIdentityDigest: sha256(ledgerIdentity(checkpoint)),
    snapshotBinding: clone(checkpoint.snapshotBinding),
    proposalHistoryDigest: historyDigest('PROPOSAL_REFERENCES', checkpoint.history.proposalRefs),
    settlementHistoryDigest: historyDigest('SETTLEMENT_REFERENCES', checkpoint.history.settlementRefs),
    proposalCount: checkpoint.state.proposalCount,
    settlementCount: checkpoint.state.settlementCount
  };
}

function pinTruth() {
  return {
    anchoredCheckpointVerifiedByExactRebuildWhenDerived: true,
    completeCheckpointHistoryBound: true,
    normalizedPolicyProfilesBound: true,
    pinSelfDigestValidWhenDerived: true,
    pinOriginAuthenticated: false,
    pinAuthorityAuthenticated: false,
    pinExternallyRetainedByModule: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    globalCurrentnessProven: false,
    hostAuthorizationAuthenticated: false,
    callerTimeExternallyTrusted: false,
    providerInvoked: false,
    evaluationPerformed: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticAdoption: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function assemblePin(metadata, exact) {
  const pin = {
    schema: PIN_SCHEMA,
    version: VERSION,
    status: STATUS,
    pinId: metadata.pinId,
    pinnedAt: metadata.pinnedAt,
    pinKind: metadata.pinKind,
    pinGeneration: metadata.pinGeneration,
    previousPinRef: metadata.previousPinRef,
    binding: bindingFromExactPackage(exact),
    state: 'PORTABLE_CALLER_RETAINED_PIN_DERIVED_FROM_EXACT_ANCHORED_PACKAGE_ORIGIN_RETENTION_AND_AUTHORITY_NOT_PROVEN',
    truth: pinTruth(),
    pinDigest: null
  };
  pin.pinDigest = sha256(withoutField(pin, 'pinDigest'));
  bound(pin, MAX_PIN_CANONICAL_BYTES, 'portable checkpoint pin');
  return pin;
}
function buildGenesisPin(input) {
  bound(input, MAX_PIN_BUILD_INPUT_CANONICAL_BYTES, 'genesis pin input');
  exactKeys(input, ['pinId', 'pinnedAt', 'anchoredInput', 'anchoredReceipt'], 'genesis pin input');
  const pinId = text(input.pinId, 'genesis pin id', 180);
  const pinnedAt = timestamp(input.pinnedAt, 'genesis pin time');
  const exact = exactAnchoredPackage(input.anchoredInput, input.anchoredReceipt, 'genesis pinned checkpoint');
  if (Date.parse(pinnedAt) < Date.parse(exact.anchored.verifiedAt)) throw new Error('genesis pin time cannot predate anchored checkpoint verification');
  return assemblePin({ pinId, pinnedAt, pinKind: 'GENESIS', pinGeneration: 0, previousPinRef: null }, exact);
}

function validateBinding(value, label) {
  exactKeys(value, PIN_BINDING_DIMENSIONS, label);
  return {
    anchoredCheckpointRef: reference(value.anchoredCheckpointRef, label + '.anchoredCheckpointRef'),
    checkpointRef: reference(value.checkpointRef, label + '.checkpointRef'),
    anchorRef: reference(value.anchorRef, label + '.anchorRef'),
    anchorPolicyRef: reference(value.anchorPolicyRef, label + '.anchorPolicyRef'),
    anchorProfileDigest: digest(value.anchorProfileDigest, label + '.anchorProfileDigest'),
    witnessPolicyRef: reference(value.witnessPolicyRef, label + '.witnessPolicyRef'),
    witnessProfileDigest: digest(value.witnessProfileDigest, label + '.witnessProfileDigest'),
    ledgerIdentityDigest: digest(value.ledgerIdentityDigest, label + '.ledgerIdentityDigest'),
    snapshotBinding: snapshotBinding(value.snapshotBinding, label + '.snapshotBinding'),
    proposalHistoryDigest: digest(value.proposalHistoryDigest, label + '.proposalHistoryDigest'),
    settlementHistoryDigest: digest(value.settlementHistoryDigest, label + '.settlementHistoryDigest'),
    proposalCount: integer(value.proposalCount, label + '.proposalCount', 0, 10000),
    settlementCount: integer(value.settlementCount, label + '.settlementCount', 0, 10000)
  };
}
function validatePin(value) {
  bound(value, MAX_PIN_CANONICAL_BYTES, 'portable checkpoint pin');
  exactKeys(value, [
    'schema', 'version', 'status', 'pinId', 'pinnedAt', 'pinKind', 'pinGeneration', 'previousPinRef',
    'binding', 'state', 'truth', 'pinDigest'
  ], 'portable checkpoint pin');
  if (value.schema !== PIN_SCHEMA || value.version !== VERSION || value.status !== STATUS) throw new Error('portable checkpoint pin identity mismatch');
  const pinId = text(value.pinId, 'portable checkpoint pin id', 180);
  const pinnedAt = timestamp(value.pinnedAt, 'portable checkpoint pin time');
  if (!['GENESIS', 'SUCCESSOR'].includes(value.pinKind)) throw new Error('portable checkpoint pin kind is outside the closed set');
  const pinGeneration = integer(value.pinGeneration, 'portable checkpoint pin generation', 0, Number.MAX_SAFE_INTEGER);
  const previousPinRef = value.previousPinRef === null ? null : reference(value.previousPinRef, 'portable checkpoint previous pin ref');
  if (value.pinKind === 'GENESIS' && (pinGeneration !== 0 || previousPinRef !== null)) throw new Error('genesis pin must have generation zero and no predecessor');
  if (value.pinKind === 'SUCCESSOR' && (pinGeneration < 1 || previousPinRef === null)) throw new Error('successor pin must have positive generation and a predecessor');
  const binding = validateBinding(value.binding, 'portable checkpoint pin binding');
  const expectedState = 'PORTABLE_CALLER_RETAINED_PIN_DERIVED_FROM_EXACT_ANCHORED_PACKAGE_ORIGIN_RETENTION_AND_AUTHORITY_NOT_PROVEN';
  if (value.state !== expectedState) throw new Error('portable checkpoint pin state mismatch');
  if (!same(value.truth, pinTruth())) throw new Error('portable checkpoint pin truth boundary mismatch');
  const pinDigest = digest(value.pinDigest, 'portable checkpoint pin digest');
  if (sha256(withoutField(value, 'pinDigest')) !== pinDigest) throw new Error('portable checkpoint pin self-digest mismatch');
  return { schema: PIN_SCHEMA, version: VERSION, status: STATUS, pinId, pinnedAt, pinKind: value.pinKind, pinGeneration, previousPinRef, binding, state: expectedState, truth: pinTruth(), pinDigest };
}
function verifyGenesisPin(input, pin) {
  const errors = []; let rebuilt = null;
  try {
    validatePin(pin);
    rebuilt = buildGenesisPin(input);
    if (!same(rebuilt, pin)) throw new Error('genesis pin content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

function comparePinBinding(pin, exactPrevious) {
  const expected = bindingFromExactPackage(exactPrevious);
  const dimensions = {};
  PIN_BINDING_DIMENSIONS.forEach(name => { dimensions[name] = same(pin.binding[name], expected[name]); });
  dimensions.pinnedAtNotBeforeAnchoredVerification = Date.parse(pin.pinnedAt) >= Date.parse(exactPrevious.anchored.verifiedAt);
  const driftDimensions = Object.keys(dimensions).filter(name => !dimensions[name]).sort();
  return { matches: driftDimensions.length === 0, dimensions, driftDimensions };
}
function overallClassification(pinComparison, pairwiseClassification) {
  if (!pinComparison.matches) return 'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN';
  if (pairwiseClassification === 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY') return 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY';
  if (pairwiseClassification === 'PRESENTED_HISTORY_EXACT_RECHECKPOINT') return 'PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT';
  if (pairwiseClassification === 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY') return 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY';
  return 'PIN_MATCH_UPSTREAM_PAIRWISE_HOLD';
}
function bestAction(classification) {
  if (classification === 'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN') return 'PRESERVE_PIN_AND_BOTH_PACKAGES_AND_REQUEST_STEWARD_RECONCILIATION';
  if (classification === 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY') return 'RETAIN_NO_NEW_PIN_STATE';
  if (classification === 'PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT') return 'REVIEW_SUCCESSOR_PIN_PROPOSAL_WITHOUT_TREATING_IT_AS_HISTORY_EXTENSION';
  if (classification === 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY') return 'REVIEW_SUCCESSOR_PIN_PROPOSAL_WITHOUT_AUTOMATIC_ADOPTION';
  return 'PRESERVE_PIN_AND_BOTH_PACKAGES_AND_HOLD_FOR_STEWARD_REVIEW';
}
function transitionTruth(pinComparison) {
  return {
    presentedPinSelfDigestValidated: true,
    previousAnchoredCheckpointVerifiedByExactRebuild: true,
    candidateAnchoredCheckpointVerifiedByExactRebuild: true,
    v23PairwiseTransitionComposedUnchanged: true,
    presentedPinBindingComparedToPreviousPackage: true,
    presentedPinMatchesPreviousPackage: pinComparison.matches,
    completeCheckpointHistoryBindingsCompared: true,
    normalizedPolicyProfileBindingsCompared: true,
    continuityRelativeToPresentedPinOnly: true,
    retainedOriginalPinCanExposeJointPairReplacement: true,
    pinOriginAuthenticated: false,
    pinAuthorityAuthenticated: false,
    pinRetentionPerformedByModule: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    jointPairAndPinReplacementStillPossible: true,
    originalPinContinuityProven: false,
    withheldBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    policyRotationAuthenticated: false,
    realWorldControllerIndependenceProven: false,
    crossLayerCollusionExcluded: false,
    actualHumanParticipationProven: false,
    hostAuthorizationAuthenticated: false,
    comparisonTimeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildTransition(input) {
  bound(input, MAX_TRANSITION_INPUT_CANONICAL_BYTES, 'portable pin transition input');
  exactKeys(input, [
    'transitionId', 'comparedAt', 'successorPinId', 'expectedPreviousPin',
    'previousAnchoredInput', 'previousAnchoredReceipt', 'candidateAnchoredInput', 'candidateAnchoredReceipt'
  ], 'portable pin transition input');
  const transitionId = text(input.transitionId, 'portable pin transition id', 180);
  const comparedAt = timestamp(input.comparedAt, 'portable pin transition time');
  const successorPinId = text(input.successorPinId, 'successor pin id', 180);
  const expectedPreviousPin = validatePin(clone(input.expectedPreviousPin));
  const previous = exactAnchoredPackage(input.previousAnchoredInput, input.previousAnchoredReceipt, 'previous pinned checkpoint');
  const candidate = exactAnchoredPackage(input.candidateAnchoredInput, input.candidateAnchoredReceipt, 'candidate pinned checkpoint');
  if (Date.parse(comparedAt) < Date.parse(previous.anchored.verifiedAt) || Date.parse(comparedAt) < Date.parse(candidate.anchored.verifiedAt)) {
    throw new Error('portable pin transition time cannot predate either anchored checkpoint verification');
  }
  const pairwiseInput = {
    transitionId,
    comparedAt,
    previousAnchoredInput: clone(input.previousAnchoredInput),
    previousAnchoredReceipt: clone(input.previousAnchoredReceipt),
    candidateAnchoredInput: clone(input.candidateAnchoredInput),
    candidateAnchoredReceipt: clone(input.candidateAnchoredReceipt)
  };
  const pairwise = Pairwise.buildTransition(pairwiseInput);
  const pinComparison = comparePinBinding(expectedPreviousPin, previous);
  const classification = overallClassification(pinComparison, pairwise.classification);
  if (!CLASSIFICATIONS.includes(classification)) throw new Error('portable pin transition classification is outside the closed set');
  const successorEligible = classification === 'PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT' ||
    classification === 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY';
  if (successorEligible && expectedPreviousPin.pinGeneration === Number.MAX_SAFE_INTEGER) {
    throw new Error('portable checkpoint pin generation cannot advance beyond the safe integer range');
  }
  const successorPinProposal = successorEligible ? assemblePin({
    pinId: successorPinId,
    pinnedAt: comparedAt,
    pinKind: 'SUCCESSOR',
    pinGeneration: expectedPreviousPin.pinGeneration + 1,
    previousPinRef: pinRef(expectedPreviousPin)
  }, candidate) : null;
  const holdRequired = classification === 'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN' || classification === 'PIN_MATCH_UPSTREAM_PAIRWISE_HOLD';
  const receipt = {
    schema: TRANSITION_SCHEMA,
    version: VERSION,
    status: STATUS,
    transitionId,
    comparedAt,
    expectedPreviousPinRef: pinRef(expectedPreviousPin),
    previousAnchoredCheckpointRef: bindingFromExactPackage(previous).anchoredCheckpointRef,
    candidateAnchoredCheckpointRef: bindingFromExactPackage(candidate).anchoredCheckpointRef,
    pairwiseTransitionRef: { id: pairwise.transitionId, schema: pairwise.schema, sha256: pairwise.transitionDigest },
    pairwiseClassification: pairwise.classification,
    pinComparison,
    classification,
    successorPinProposal,
    decision: {
      reviewRequired: true,
      holdRequired,
      successorPinProposed: successorPinProposal !== null,
      successorPinAdoptionAuthorized: false,
      autonomousActionCount: 0,
      bestAction: bestAction(classification)
    },
    state: 'PRESENTED_PIN_AND_PAIRWISE_HISTORY_CLASSIFIED_SUCCESSOR_IS_PROPOSAL_ONLY_AUTHORITY_AND_RETENTION_NOT_PROVEN',
    truth: transitionTruth(pinComparison),
    transitionDigest: null
  };
  receipt.transitionDigest = sha256(withoutField(receipt, 'transitionDigest'));
  bound(receipt, MAX_TRANSITION_RECEIPT_CANONICAL_BYTES, 'portable pin transition receipt');
  return receipt;
}
function verifyTransition(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_TRANSITION_RECEIPT_CANONICAL_BYTES, 'portable pin transition receipt');
    if (!receipt || receipt.schema !== TRANSITION_SCHEMA) throw new Error('portable pin transition receipt schema mismatch');
    rebuilt = buildTransition(input);
    if (!same(rebuilt, receipt)) throw new Error('portable pin transition receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  PIN_SCHEMA,
  TRANSITION_SCHEMA,
  LEDGER_IDENTITY_SCHEMA,
  HISTORY_COMMITMENT_SCHEMA,
  VERSION,
  STATUS,
  MAX_PIN_BUILD_INPUT_CANONICAL_BYTES,
  MAX_PIN_CANONICAL_BYTES,
  MAX_TRANSITION_INPUT_CANONICAL_BYTES,
  MAX_TRANSITION_RECEIPT_CANONICAL_BYTES,
  CLASSIFICATIONS,
  PIN_BINDING_DIMENSIONS,
  stableStringify,
  sha256,
  buildGenesisPin,
  validatePin,
  verifyGenesisPin,
  buildTransition,
  verifyTransition
};
