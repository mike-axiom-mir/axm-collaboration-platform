#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Evolution = require('./verification-source-evolution-review');
const Continuity = require('../verification-snapshot-continuity/verification-snapshot-continuity');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }

function seal(value, field) {
  const result = Evolution.clone(value);
  const payload = Evolution.clone(result);
  delete payload[field];
  result[field] = Evolution.sha256(payload);
  return result;
}

function verificationReceipt(generatedAt, sourceDigest, options) {
  const opts = options || {};
  const receipt = {
    schema: 'axm.synthetic-verification/v1',
    generatedAt,
    status: 'TEST',
    sourceRefs: [{ path: 'shared/example/index.js', sha256: sourceDigest }],
    verificationDigest: null
  };
  if (opts.noDigest) delete receipt.verificationDigest;
  else return seal(receipt, 'verificationDigest');
  return receipt;
}

function continuityReceipt(ref, classification, drift) {
  return seal({
    schema: Continuity.RECEIPT_SCHEMA,
    status: 'TEST',
    historicalReceipt: { ref, schema: 'axm.synthetic-verification/v1', selfDigest: { state: classification.startsWith('HOLD_') ? 'NOT_DECLARED' : 'VALID' } },
    comparison: {
      missingCurrentPaths: [],
      extraCurrentPaths: [],
      trackedSourceDrift: drift || []
    },
    decision: { classification },
    continuityDigest: null
  }, 'continuityDigest');
}

const oldDigest = 'sha256:' + '1'.repeat(64);
const currentDigest = 'sha256:' + '2'.repeat(64);
const historical = verificationReceipt('2026-08-19T10:00:00.000Z', oldDigest);
const historicalRef = { path: 'docs/old/VERIFICATION_RECEIPT.json', sha256: 'sha256:' + '3'.repeat(64) };
const historicalContinuity = continuityReceipt(historicalRef, 'TRACKED_SOURCE_DRIFT', [{
  path: 'shared/example/index.js', historicalSha256: oldDigest, currentSha256: currentDigest
}]);
const candidate = verificationReceipt('2026-08-19T11:00:00.000Z', currentDigest);
const candidateRef = { path: 'docs/new/VERIFICATION_RECEIPT.json', sha256: 'sha256:' + '4'.repeat(64) };
const candidateContinuity = continuityReceipt(candidateRef, 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY', []);

const strongInput = {
  reviewId: 'review:synthetic',
  reviewedAt: '2026-08-19T12:00:00.000Z',
  continuityReceipt: historicalContinuity,
  historicalReceiptRef: historicalRef,
  historicalReceipt: historical,
  candidateEvidence: [{ receiptRef: candidateRef, receipt: candidate, currentContinuityReceipt: candidateContinuity }]
};
const strong = Evolution.buildReview(strongInput);
equal(strong.schema, Evolution.REVIEW_SCHEMA, 'review schema');
equal(strong.status, 'TEST', 'review status');
equal(strong.historicalReceipt.selfDigest.state, 'VALID', 'historical self digest valid');
equal(strong.counts.driftRows, 1, 'one drift row');
equal(strong.counts.laterCurrentTrackedReceiptCoverage, 1, 'strong later coverage');
equal(strong.driftReviews[0].state, 'CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT', 'strong state');
equal(strong.driftReviews[0].matches[0].laterThanHistorical, true, 'candidate is later');
equal(strong.driftReviews[0].matches[0].selfDigestState, 'VALID', 'candidate self digest valid');
equal(strong.driftReviews[0].matches[0].currentnessState, 'CURRENT_TRACKED_SOURCES_MATCH', 'candidate currentness bound');
equal(strong.decision.reviewRequired, false, 'strong path needs no byte-lineage review');
equal(strong.truth.laterReceiptAttestationClaimedAsOriginalIntent, false, 'intent not inferred');
equal(strong.truth.laterReceiptAttestationClaimedAsCorrectness, false, 'correctness not inferred');
equal(strong.truth.laterReceiptAttestationClaimedAsHumanBenefit, false, 'human benefit not inferred');
check(/^sha256:[0-9a-f]{64}$/.test(strong.reviewDigest), 'review digest');
check(Evolution.verifyReview(strongInput, strong).pass, 'review exact rebuild');

const noCurrentness = Evolution.buildReview({
  ...strongInput,
  candidateEvidence: [{ receiptRef: candidateRef, receipt: candidate, currentContinuityReceipt: null }]
});
equal(noCurrentness.driftReviews[0].state, 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN', 'attestation-only state');
equal(noCurrentness.decision.reviewRequired, true, 'attestation-only needs review');

const candidateEvolution = Evolution.clone(strong);
candidateEvolution.reviewId = 'review:candidate-scope';
candidateEvolution.historicalReceipt.ref = candidateRef;
delete candidateEvolution.reviewDigest;
candidateEvolution.reviewDigest = Evolution.sha256(candidateEvolution);
const bridgeInput = {
  bridgeId: 'bridge:synthetic',
  builtAt: '2026-08-19T12:30:00.000Z',
  targetReview: noCurrentness,
  candidateReview: candidateEvolution,
  candidateReceiptRef: candidateRef,
  targetPath: 'shared/example/index.js'
};
const bridge = Evolution.buildCandidateEvolutionBridge(bridgeInput);
equal(bridge.schema, Evolution.BRIDGE_SCHEMA, 'bridge schema');
equal(bridge.decision.classification, 'TARGET_BYTES_ATTESTED_AND_CANDIDATE_SCOPE_EVOLUTION_FULLY_ROUTED', 'bridge classification');
equal(bridge.decision.targetCurrentByteLineageRouted, true, 'target lineage routed');
equal(bridge.candidate.routedDriftRows, 1, 'candidate drift rows routed');
equal(bridge.candidate.originalReceiptByteCurrent, false, 'candidate original receipt not called current');
equal(bridge.decision.reviewRequiredForByteLineage, false, 'byte lineage review resolved');
equal(bridge.truth.transitiveRouteClaimedAsCorrectness, false, 'bridge not correctness');
equal(bridge.truth.transitiveRouteClaimedAsHumanBenefit, false, 'bridge not human benefit');
check(Evolution.verifyCandidateEvolutionBridge(bridgeInput, bridge).pass, 'bridge exact rebuild');

const unanchoredCandidate = verificationReceipt('2026-08-19T11:00:00.000Z', currentDigest, { noDigest: true });
const weak = Evolution.buildReview({
  ...strongInput,
  candidateEvidence: [{ receiptRef: candidateRef, receipt: unanchoredCandidate, currentContinuityReceipt: null }]
});
equal(weak.driftReviews[0].state, 'CURRENT_BYTES_ATTESTED_BY_LATER_UNANCHORED_RECEIPT', 'unanchored state');

const none = Evolution.buildReview({ ...strongInput, candidateEvidence: [] });
equal(none.driftReviews[0].state, 'NO_LATER_RECEIPT_ATTESTATION', 'missing attestation visible');
equal(none.decision.unresolvedPaths[0], 'shared/example/index.js', 'unresolved path retained');

const earlier = verificationReceipt('2026-08-19T09:00:00.000Z', currentDigest);
const notLater = Evolution.buildReview({
  ...strongInput,
  candidateEvidence: [{ receiptRef: candidateRef, receipt: earlier, currentContinuityReceipt: null }]
});
equal(notLater.driftReviews[0].state, 'NO_LATER_RECEIPT_ATTESTATION', 'earlier receipt is not later evidence');

const legacy = verificationReceipt('2026-08-19T10:00:00.000Z', oldDigest, { noDigest: true });
const legacyRef = { path: 'docs/legacy/VERIFICATION_RECEIPT.json', sha256: 'sha256:' + '5'.repeat(64) };
const legacyContinuity = continuityReceipt(legacyRef, 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED', [{
  path: 'exports/game-night-seam-report.json', historicalSha256: oldDigest, currentSha256: currentDigest
}]);
const writerStatement = "fs.writeFileSync(path.join(ROOT, 'exports', 'game-night-seam-report.json'), JSON.stringify(gr, null, 2));";
const anchorInput = {
  anchorId: 'anchor:legacy',
  anchoredAt: '2026-08-19T12:00:00.000Z',
  continuityReceipt: legacyContinuity,
  historicalReceiptRef: legacyRef,
  historicalReceipt: legacy,
  generatedViewEvidence: {
    kind: 'KNOWN_REGENERATED_GAME_NIGHT_VIEW',
    currentViewRef: { path: 'exports/game-night-seam-report.json', sha256: currentDigest },
    schema: 'axm.game-package-verification/v1',
    generatorRef: { path: 'verify.js', sha256: 'sha256:' + '6'.repeat(64) },
    writerStatementSha256: Evolution.sha256(writerStatement),
    generatorWritesExactPath: true,
    volatileField: 'checkedAt',
    currentState: { games: 19, pass: true, failCount: 0, warningCount: 17 },
    historicalRecordedState: { verifierGames: 19, physicalPhoneWarnings: 17, warningsStillOpen: 17 }
  }
};
const anchor = Evolution.buildLegacyAnchor(anchorInput);
equal(anchor.schema, Evolution.ANCHOR_SCHEMA, 'anchor schema');
equal(anchor.historicalReceipt.declaredSelfDigest, 'NOT_DECLARED', 'legacy missing self digest visible');
equal(anchor.decision.futureTamperDetectableFromAnchor, true, 'future tamper detectable');
equal(anchor.decision.historicalIntegrityBeforeAnchorEstablished, false, 'pre-anchor integrity unknown');
equal(anchor.generatedViewReview.identityRecognized, true, 'generated view identity recognized');
equal(anchor.generatedViewReview.semanticSnapshotMatch, true, 'semantic snapshot matches');
equal(anchor.generatedViewReview.classification, 'KNOWN_REGENERATED_VIEW_CURRENT_SEMANTICS_MATCH_ANCHORED_LEGACY_SNAPSHOT', 'generated view state');
equal(anchor.truth.generatedViewSemanticMatchClaimedAsHistoricalByteMatch, false, 'semantic match not byte match');
equal(anchor.truth.historicalReceiptRewritten, false, 'legacy receipt not rewritten');
equal(anchor.truth.authorityGranted, false, 'anchor grants no authority');
check(Evolution.verifyLegacyAnchor(anchorInput, anchor).pass, 'anchor exact rebuild');

const semanticMismatch = Evolution.buildLegacyAnchor({
  ...anchorInput,
  generatedViewEvidence: {
    ...anchorInput.generatedViewEvidence,
    currentState: { games: 20, pass: true, failCount: 0, warningCount: 17 }
  }
});
equal(semanticMismatch.generatedViewReview.semanticSnapshotMatch, false, 'semantic mismatch visible');
equal(semanticMismatch.generatedViewReview.classification, 'KNOWN_REGENERATED_VIEW_SEMANTIC_OR_IDENTITY_MISMATCH', 'mismatch classification');

const tamperedContinuity = Evolution.clone(historicalContinuity);
tamperedContinuity.decision.classification = 'CURRENT_SOURCE_SET_EXACT';
assert.throws(() => Evolution.buildReview({ ...strongInput, continuityReceipt: tamperedContinuity }), /digest must be valid/, 'tampered continuity refused'); assertions += 1;
assert.throws(() => Evolution.buildReview({ ...strongInput, surprise: true }), /unsupported field/, 'extra input refused'); assertions += 1;
assert.throws(() => Evolution.buildLegacyAnchor({ ...anchorInput, anchoredAt: 'bad-time' }), /ISO date-time/, 'invalid anchor time refused'); assertions += 1;
equal(Evolution.sha256({ b: 1, a: 2 }), Evolution.sha256({ a: 2, b: 1 }), 'stable digest ordering');

console.log('PASS verification source evolution review selftest (' + assertions + ' assertions)');
