'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Continuity = require('../verification-snapshot-continuity/verification-snapshot-continuity');
const DeterministicJson = require('../../tools/deterministic-json-core');

const REVIEW_SCHEMA = 'axm.verification-source-evolution-review/v1';
const ANCHOR_SCHEMA = 'axm.verification-legacy-external-anchor/v1';
const BRIDGE_SCHEMA = 'axm.verification-candidate-evolution-bridge/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CURRENT_TRACKED_CLASSIFICATIONS = new Set([
  'CURRENT_SOURCE_SET_EXACT',
  'MUTABLE_DERIVED_VIEW_DRIFT_ONLY'
]);

function clone(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableValue(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.join(', '));
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 240)) throw new Error(label + ' is too long');
  return result;
}

function requiredTime(value, label) {
  const result = requiredText(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(label + ' must be an ISO date-time');
  return result;
}

function normalizePath(value, label) {
  const result = requiredText(value, label, 500).replace(/\\/g, '/');
  if (result.startsWith('/') || /^[A-Za-z]:\//.test(result)) throw new Error(label + ' must be workspace-relative');
  if (result.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(label + ' contains an unsafe segment');
  }
  return result;
}

function normalizeDigest(value, label) {
  const result = requiredText(value, label, 80);
  if (!DIGEST_PATTERN.test(result)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return result;
}

function normalizeRef(value, label) {
  exactKeys(value, ['path', 'sha256'], label);
  return {
    path: normalizePath(value.path, label + '.path'),
    sha256: normalizeDigest(value.sha256, label + '.sha256')
  };
}

function verifyDeclaredDigest(value, field, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { state: 'INVALID_OBJECT', field, declared: null, rebuilt: null, pass: false };
  }
  if (!Object.prototype.hasOwnProperty.call(value, field)) {
    return { state: 'NOT_DECLARED', field, declared: null, rebuilt: null, pass: false };
  }
  let declared;
  try {
    declared = normalizeDigest(value[field], label + '.' + field);
  } catch (error) {
    return { state: 'INVALID_DECLARATION', field, declared: value[field], rebuilt: null, pass: false };
  }
  const payload = clone(value);
  delete payload[field];
  const rebuilt = sha256(payload);
  return {
    state: rebuilt === declared ? 'VALID' : 'INVALID',
    field,
    declared,
    rebuilt,
    pass: rebuilt === declared
  };
}

function continuityState(receipt, expectedReceiptRef) {
  if (receipt == null) return { state: 'NOT_SUPPLIED', classification: null, pass: false };
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { state: 'INVALID_OBJECT', classification: null, pass: false };
  }
  const digest = verifyDeclaredDigest(receipt, 'continuityDigest', 'currentContinuityReceipt');
  const classification = receipt.decision && receipt.decision.classification;
  const tracked = receipt.comparison && Array.isArray(receipt.comparison.trackedSourceDrift)
    ? receipt.comparison.trackedSourceDrift : [];
  const missing = receipt.comparison && Array.isArray(receipt.comparison.missingCurrentPaths)
    ? receipt.comparison.missingCurrentPaths : [];
  const extra = receipt.comparison && Array.isArray(receipt.comparison.extraCurrentPaths)
    ? receipt.comparison.extraCurrentPaths : [];
  const ref = receipt.historicalReceipt && receipt.historicalReceipt.ref;
  const refMatches = Boolean(ref && ref.path === expectedReceiptRef.path && ref.sha256 === expectedReceiptRef.sha256);
  const currentTracked = digest.pass && refMatches && CURRENT_TRACKED_CLASSIFICATIONS.has(classification) &&
    tracked.length === 0 && missing.length === 0 && extra.length === 0;
  return {
    state: currentTracked ? 'CURRENT_TRACKED_SOURCES_MATCH' : 'NOT_CURRENT_OR_NOT_BOUND',
    classification: classification || null,
    digest,
    refMatches,
    trackedSourceDrift: tracked.length,
    missingCurrentPaths: missing.length,
    extraCurrentPaths: extra.length,
    pass: currentTracked
  };
}

function normalizeCandidate(value, index) {
  const label = 'candidateEvidence[' + index + ']';
  exactKeys(value, ['receiptRef', 'receipt', 'currentContinuityReceipt'], label);
  if (!value.receipt || typeof value.receipt !== 'object' || Array.isArray(value.receipt)) {
    throw new Error(label + '.receipt must be an object');
  }
  const receiptRef = normalizeRef(value.receiptRef, label + '.receiptRef');
  return {
    receiptRef,
    receipt: value.receipt,
    currentContinuityReceipt: value.currentContinuityReceipt == null ? null : value.currentContinuityReceipt
  };
}

function buildReview(input) {
  exactKeys(input, [
    'reviewId', 'reviewedAt', 'continuityReceipt', 'historicalReceiptRef',
    'historicalReceipt', 'candidateEvidence'
  ], 'input');
  const reviewId = requiredText(input.reviewId, 'reviewId', 180);
  const reviewedAt = requiredTime(input.reviewedAt, 'reviewedAt');
  const historicalReceiptRef = normalizeRef(input.historicalReceiptRef, 'historicalReceiptRef');
  if (!input.historicalReceipt || typeof input.historicalReceipt !== 'object' || Array.isArray(input.historicalReceipt)) {
    throw new Error('historicalReceipt must be an object');
  }
  if (!input.continuityReceipt || typeof input.continuityReceipt !== 'object' || Array.isArray(input.continuityReceipt)) {
    throw new Error('continuityReceipt must be an object');
  }
  if (!Array.isArray(input.candidateEvidence)) throw new Error('candidateEvidence must be an array');

  const continuityDigest = verifyDeclaredDigest(input.continuityReceipt, 'continuityDigest', 'continuityReceipt');
  if (!continuityDigest.pass) throw new Error('continuityReceipt digest must be valid');
  const continuityRef = input.continuityReceipt.historicalReceipt && input.continuityReceipt.historicalReceipt.ref;
  if (!continuityRef || continuityRef.path !== historicalReceiptRef.path || continuityRef.sha256 !== historicalReceiptRef.sha256) {
    throw new Error('continuityReceipt does not bind historicalReceiptRef');
  }
  const continuityClassification = input.continuityReceipt.decision && input.continuityReceipt.decision.classification;
  if (!['TRACKED_SOURCE_DRIFT', 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED'].includes(continuityClassification)) {
    throw new Error('continuityReceipt is not a reviewable tracked-source state');
  }
  const historicalDigest = Continuity.verifyHistoricalSelfDigest(input.historicalReceipt);
  if (continuityClassification === 'TRACKED_SOURCE_DRIFT' && historicalDigest.state !== 'VALID') {
    throw new Error('tracked-source review requires a valid historical self-digest');
  }
  if (continuityClassification === 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED' && historicalDigest.state !== 'NOT_DECLARED') {
    throw new Error('legacy anchored review requires an absent historical self-digest');
  }
  if (input.historicalReceipt.schema !== input.continuityReceipt.historicalReceipt.schema) {
    throw new Error('historical receipt schema does not match continuity receipt');
  }
  const historicalGeneratedAt = requiredTime(input.historicalReceipt.generatedAt, 'historicalReceipt.generatedAt');
  const drifts = input.continuityReceipt.comparison && input.continuityReceipt.comparison.trackedSourceDrift;
  if (!Array.isArray(drifts) || !drifts.length) throw new Error('continuityReceipt has no tracked source drift');
  const candidates = input.candidateEvidence.map(normalizeCandidate);

  const driftReviews = drifts.map(drift => {
    const path = normalizePath(drift.path, 'trackedSourceDrift.path');
    const historicalSha256 = normalizeDigest(drift.historicalSha256, 'trackedSourceDrift.historicalSha256');
    const currentSha256 = normalizeDigest(drift.currentSha256, 'trackedSourceDrift.currentSha256');
    const matches = [];
    candidates.forEach(candidate => {
      const source = Continuity.collectHistoricalSourceRefs(candidate.receipt).refs
        .find(ref => ref.path === path && ref.sha256 === currentSha256);
      if (!source) return;
      const generatedAt = typeof candidate.receipt.generatedAt === 'string' ? candidate.receipt.generatedAt : null;
      const laterThanHistorical = Boolean(generatedAt && Number.isFinite(Date.parse(generatedAt)) &&
        Date.parse(generatedAt) > Date.parse(historicalGeneratedAt));
      const selfDigest = Continuity.verifyHistoricalSelfDigest(candidate.receipt);
      const currentness = continuityState(candidate.currentContinuityReceipt, candidate.receiptRef);
      matches.push({
        receiptRef: candidate.receiptRef,
        receiptSchema: typeof candidate.receipt.schema === 'string' ? candidate.receipt.schema : null,
        generatedAt,
        laterThanHistorical,
        selfDigestState: selfDigest.state,
        currentnessState: currentness.state,
        currentContinuityClassification: currentness.classification
      });
    });
    matches.sort((a, b) => a.receiptRef.path.localeCompare(b.receiptRef.path));

    const strong = matches.filter(match => match.laterThanHistorical && match.selfDigestState === 'VALID' &&
      match.currentnessState === 'CURRENT_TRACKED_SOURCES_MATCH');
    const attested = matches.filter(match => match.laterThanHistorical && match.selfDigestState === 'VALID');
    const weak = matches.filter(match => match.laterThanHistorical);
    let state;
    if (strong.length) state = 'CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT';
    else if (attested.length) state = 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN';
    else if (weak.length) state = 'CURRENT_BYTES_ATTESTED_BY_LATER_UNANCHORED_RECEIPT';
    else state = 'NO_LATER_RECEIPT_ATTESTATION';
    return { path, historicalSha256, currentSha256, state, matches };
  });

  const countState = state => driftReviews.filter(item => item.state === state).length;
  const historicalIntegrity = historicalDigest.state === 'VALID'
    ? 'DECLARED_SELF_DIGEST_VALID'
    : 'EXTERNALLY_ANCHORED_CURRENT_RECEIPT_BYTES_PRE_ANCHOR_UNKNOWN';
  const unresolved = driftReviews.filter(item => item.state !== 'CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT');
  const receipt = {
    schema: REVIEW_SCHEMA,
    version: VERSION,
    reviewId,
    reviewedAt,
    status: STATUS,
    scope: 'CURRENT_TRACKED_SOURCE_BYTES_TO_LATER_VERIFICATION_RECEIPT_EVIDENCE',
    historicalReceipt: {
      ref: historicalReceiptRef,
      schema: input.historicalReceipt.schema,
      generatedAt: historicalGeneratedAt,
      selfDigest: historicalDigest,
      integrity: historicalIntegrity
    },
    continuity: {
      digest: input.continuityReceipt.continuityDigest,
      classification: continuityClassification
    },
    counts: {
      driftRows: driftReviews.length,
      laterCurrentTrackedReceiptCoverage: countState('CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT'),
      laterDigestValidAttestationOnly: countState('CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN'),
      laterUnanchoredAttestationOnly: countState('CURRENT_BYTES_ATTESTED_BY_LATER_UNANCHORED_RECEIPT'),
      noLaterReceiptAttestation: countState('NO_LATER_RECEIPT_ATTESTATION')
    },
    driftReviews,
    decision: {
      currentBestAction: unresolved.length
        ? 'REVIEW_UNATTESTED_OR_WEAKLY_ATTESTED_SOURCE_DRIFT'
        : historicalDigest.state === 'VALID'
          ? 'PRESERVE_HISTORY_AND_USE_LATER_CURRENT_RECEIPTS_AS_EVOLUTION_EVIDENCE'
          : 'PRESERVE_EXTERNAL_ANCHOR_AND_KEEP_PRE_ANCHOR_INTEGRITY_UNKNOWN',
      unresolvedPaths: unresolved.map(item => item.path),
      reviewRequired: unresolved.length > 0 || historicalDigest.state !== 'VALID',
      autonomousActionCount: 0
    },
    truth: {
      laterReceiptAttestationClaimedAsOriginalIntent: false,
      laterReceiptAttestationClaimedAsCorrectness: false,
      laterReceiptAttestationClaimedAsRegressionAbsence: false,
      laterReceiptAttestationClaimedAsHumanBenefit: false,
      legacyExternalAnchorClaimedAsPreAnchorIntegrity: false,
      historicalReceiptRewritten: false,
      sourceMutationPerformed: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    reviewDigest: null
  };
  const payload = clone(receipt);
  delete payload.reviewDigest;
  receipt.reviewDigest = sha256(payload);
  return receipt;
}

function normalizeGeneratedViewEvidence(value) {
  if (value == null) return null;
  exactKeys(value, [
    'kind', 'currentViewRef', 'schema', 'generatorRef', 'writerStatementSha256',
    'generatorWritesExactPath', 'volatileField', 'currentState', 'historicalRecordedState'
  ], 'generatedViewEvidence');
  exactKeys(value.currentState, ['games', 'pass', 'failCount', 'warningCount'], 'generatedViewEvidence.currentState');
  exactKeys(value.historicalRecordedState, [
    'verifierGames', 'physicalPhoneWarnings', 'warningsStillOpen'
  ], 'generatedViewEvidence.historicalRecordedState');
  const result = {
    kind: requiredText(value.kind, 'generatedViewEvidence.kind', 120),
    currentViewRef: normalizeRef(value.currentViewRef, 'generatedViewEvidence.currentViewRef'),
    schema: requiredText(value.schema, 'generatedViewEvidence.schema', 160),
    generatorRef: normalizeRef(value.generatorRef, 'generatedViewEvidence.generatorRef'),
    writerStatementSha256: normalizeDigest(value.writerStatementSha256, 'generatedViewEvidence.writerStatementSha256'),
    generatorWritesExactPath: value.generatorWritesExactPath === true,
    volatileField: requiredText(value.volatileField, 'generatedViewEvidence.volatileField', 120),
    currentState: {
      games: Number(value.currentState.games),
      pass: value.currentState.pass === true,
      failCount: Number(value.currentState.failCount),
      warningCount: Number(value.currentState.warningCount)
    },
    historicalRecordedState: {
      verifierGames: Number(value.historicalRecordedState.verifierGames),
      physicalPhoneWarnings: Number(value.historicalRecordedState.physicalPhoneWarnings),
      warningsStillOpen: Number(value.historicalRecordedState.warningsStillOpen)
    }
  };
  for (const field of ['games', 'failCount', 'warningCount']) {
    if (!Number.isInteger(result.currentState[field]) || result.currentState[field] < 0) {
      throw new Error('generatedViewEvidence.currentState.' + field + ' must be a non-negative integer');
    }
  }
  for (const field of ['verifierGames', 'physicalPhoneWarnings', 'warningsStillOpen']) {
    if (!Number.isInteger(result.historicalRecordedState[field]) || result.historicalRecordedState[field] < 0) {
      throw new Error('generatedViewEvidence.historicalRecordedState.' + field + ' must be a non-negative integer');
    }
  }
  return result;
}

function buildLegacyAnchor(input) {
  exactKeys(input, [
    'anchorId', 'anchoredAt', 'continuityReceipt', 'historicalReceiptRef',
    'historicalReceipt', 'generatedViewEvidence'
  ], 'input');
  const anchorId = requiredText(input.anchorId, 'anchorId', 180);
  const anchoredAt = requiredTime(input.anchoredAt, 'anchoredAt');
  const historicalReceiptRef = normalizeRef(input.historicalReceiptRef, 'historicalReceiptRef');
  if (!input.historicalReceipt || typeof input.historicalReceipt !== 'object' || Array.isArray(input.historicalReceipt)) {
    throw new Error('historicalReceipt must be an object');
  }
  const continuityDigest = verifyDeclaredDigest(input.continuityReceipt, 'continuityDigest', 'continuityReceipt');
  if (!continuityDigest.pass) throw new Error('continuityReceipt digest must be valid');
  const classification = input.continuityReceipt.decision && input.continuityReceipt.decision.classification;
  if (classification !== 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED') {
    throw new Error('legacy anchor requires missing historical self-digest hold');
  }
  const continuityRef = input.continuityReceipt.historicalReceipt && input.continuityReceipt.historicalReceipt.ref;
  if (!continuityRef || continuityRef.path !== historicalReceiptRef.path || continuityRef.sha256 !== historicalReceiptRef.sha256) {
    throw new Error('continuityReceipt does not bind historicalReceiptRef');
  }
  const historicalSelfDigest = Continuity.verifyHistoricalSelfDigest(input.historicalReceipt);
  if (historicalSelfDigest.state !== 'NOT_DECLARED') throw new Error('historical receipt unexpectedly declares a self-digest');
  const generated = normalizeGeneratedViewEvidence(input.generatedViewEvidence);
  let generatedReview = null;
  if (generated) {
    const correctIdentity = generated.kind === 'KNOWN_REGENERATED_GAME_NIGHT_VIEW' &&
      generated.currentViewRef.path === 'exports/game-night-seam-report.json' &&
      generated.schema === 'axm.game-package-verification/v1' &&
      generated.generatorRef.path === 'verify.js' &&
      generated.volatileField === 'checkedAt' && generated.generatorWritesExactPath;
    const semanticMatch = correctIdentity && generated.currentState.pass && generated.currentState.failCount === 0 &&
      generated.currentState.games === generated.historicalRecordedState.verifierGames &&
      generated.currentState.warningCount === generated.historicalRecordedState.physicalPhoneWarnings &&
      generated.currentState.warningCount === generated.historicalRecordedState.warningsStillOpen;
    generatedReview = {
      evidence: generated,
      identityRecognized: correctIdentity,
      semanticSnapshotMatch: semanticMatch,
      classification: semanticMatch
        ? 'KNOWN_REGENERATED_VIEW_CURRENT_SEMANTICS_MATCH_ANCHORED_LEGACY_SNAPSHOT'
        : 'KNOWN_REGENERATED_VIEW_SEMANTIC_OR_IDENTITY_MISMATCH'
    };
  }

  const anchor = {
    schema: ANCHOR_SCHEMA,
    version: VERSION,
    anchorId,
    anchoredAt,
    status: STATUS,
    scope: 'CURRENT_EXTERNAL_ANCHOR_FOR_LEGACY_RECEIPT_WITHOUT_SELF_DIGEST',
    historicalReceipt: {
      ref: historicalReceiptRef,
      schema: typeof input.historicalReceipt.schema === 'string' ? input.historicalReceipt.schema : null,
      declaredSelfDigest: historicalSelfDigest.state,
      continuityClassification: classification
    },
    generatedViewReview: generatedReview,
    decision: {
      classification: 'CURRENT_RECEIPT_BYTES_EXTERNALLY_ANCHORED_PRE_ANCHOR_HISTORY_UNKNOWN',
      futureTamperDetectableFromAnchor: true,
      historicalIntegrityBeforeAnchorEstablished: false,
      currentBestAction: 'PRESERVE_ANCHOR_AND_DO_NOT_RETROACTIVELY_UPGRADE_HISTORY',
      autonomousActionCount: 0
    },
    truth: {
      historicalSelfDigestAdded: false,
      historicalReceiptRewritten: false,
      preAnchorIntegrityClaimed: false,
      generatedViewSemanticMatchClaimedAsHistoricalByteMatch: false,
      generatedViewSemanticMatchClaimedAsHumanBenefit: false,
      sourceMutationPerformed: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    anchorDigest: null
  };
  const payload = clone(anchor);
  delete payload.anchorDigest;
  anchor.anchorDigest = sha256(payload);
  return anchor;
}

function buildCandidateEvolutionBridge(input) {
  exactKeys(input, [
    'bridgeId', 'builtAt', 'targetReview', 'candidateReview',
    'candidateReceiptRef', 'targetPath'
  ], 'input');
  const bridgeId = requiredText(input.bridgeId, 'bridgeId', 180);
  const builtAt = requiredTime(input.builtAt, 'builtAt');
  const candidateReceiptRef = normalizeRef(input.candidateReceiptRef, 'candidateReceiptRef');
  const targetPath = normalizePath(input.targetPath, 'targetPath');
  const targetDigest = verifyDeclaredDigest(input.targetReview, 'reviewDigest', 'targetReview');
  const candidateDigest = verifyDeclaredDigest(input.candidateReview, 'reviewDigest', 'candidateReview');
  if (!targetDigest.pass || !candidateDigest.pass) throw new Error('both evolution review digests must be valid');
  if (input.targetReview.schema !== REVIEW_SCHEMA || input.candidateReview.schema !== REVIEW_SCHEMA) {
    throw new Error('both inputs must be evolution reviews');
  }
  const targetRow = input.targetReview.driftReviews.find(row => row.path === targetPath);
  if (!targetRow || targetRow.state !== 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN') {
    throw new Error('target path is not an attestation-only currentness seam');
  }
  const targetMatch = targetRow.matches.find(match =>
    match.receiptRef.path === candidateReceiptRef.path &&
    match.receiptRef.sha256 === candidateReceiptRef.sha256 &&
    match.laterThanHistorical && match.selfDigestState === 'VALID'
  );
  if (!targetMatch) throw new Error('target review does not bind the candidate receipt');
  const candidateHistoricalRef = input.candidateReview.historicalReceipt && input.candidateReview.historicalReceipt.ref;
  if (!candidateHistoricalRef || candidateHistoricalRef.path !== candidateReceiptRef.path ||
    candidateHistoricalRef.sha256 !== candidateReceiptRef.sha256) {
    throw new Error('candidate review does not bind candidateReceiptRef');
  }
  const candidateRows = Array.isArray(input.candidateReview.driftReviews) ? input.candidateReview.driftReviews : [];
  const candidateFullyRouted = candidateRows.length > 0 && candidateRows.every(row =>
    row.state === 'CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT'
  ) && input.candidateReview.decision && input.candidateReview.decision.reviewRequired === false &&
    Array.isArray(input.candidateReview.decision.unresolvedPaths) &&
    input.candidateReview.decision.unresolvedPaths.length === 0;
  if (!candidateFullyRouted) throw new Error('candidate evolution review is not fully routed');

  const bridge = {
    schema: BRIDGE_SCHEMA,
    version: VERSION,
    bridgeId,
    builtAt,
    status: STATUS,
    scope: 'TARGET_ATTESTATION_TO_FULLY_ROUTED_CANDIDATE_SCOPE_EVOLUTION',
    target: {
      reviewId: input.targetReview.reviewId,
      reviewDigest: input.targetReview.reviewDigest,
      path: targetRow.path,
      currentSha256: targetRow.currentSha256,
      originalState: targetRow.state
    },
    candidate: {
      receiptRef: candidateReceiptRef,
      reviewId: input.candidateReview.reviewId,
      reviewDigest: input.candidateReview.reviewDigest,
      routedDriftRows: candidateRows.length,
      originalReceiptByteCurrent: false,
      scopeEvolutionFullyRouted: true
    },
    decision: {
      classification: 'TARGET_BYTES_ATTESTED_AND_CANDIDATE_SCOPE_EVOLUTION_FULLY_ROUTED',
      targetCurrentByteLineageRouted: true,
      candidateOriginalReceiptPromotedToCurrent: false,
      reviewRequiredForByteLineage: false,
      autonomousActionCount: 0
    },
    truth: {
      transitiveRouteClaimedAsCandidateByteCurrentness: false,
      transitiveRouteClaimedAsOriginalIntent: false,
      transitiveRouteClaimedAsCorrectness: false,
      transitiveRouteClaimedAsRegressionAbsence: false,
      transitiveRouteClaimedAsHumanBenefit: false,
      sourceMutationPerformed: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    bridgeDigest: null
  };
  const payload = clone(bridge);
  delete payload.bridgeDigest;
  bridge.bridgeDigest = sha256(payload);
  return bridge;
}

function verifyReview(input, receipt) {
  try {
    return { pass: stableStringify(buildReview(input)) === stableStringify(receipt), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

function verifyLegacyAnchor(input, receipt) {
  try {
    return { pass: stableStringify(buildLegacyAnchor(input)) === stableStringify(receipt), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

function verifyCandidateEvolutionBridge(input, receipt) {
  try {
    return { pass: stableStringify(buildCandidateEvolutionBridge(input)) === stableStringify(receipt), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

module.exports = {
  REVIEW_SCHEMA,
  ANCHOR_SCHEMA,
  BRIDGE_SCHEMA,
  VERSION,
  STATUS,
  CURRENT_TRACKED_CLASSIFICATIONS,
  clone,
  stableValue,
  stableStringify,
  sha256,
  verifyDeclaredDigest,
  continuityState,
  buildReview,
  buildLegacyAnchor,
  buildCandidateEvolutionBridge,
  verifyReview,
  verifyLegacyAnchor,
  verifyCandidateEvolutionBridge
};
