#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Evolution = require('../../../shared/verification-source-evolution-review/verification-source-evolution-review');
const Current = require('./build-current-evolution-review');
const Verification = require('./build-verification-receipt');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }

const recordedPortfolio = Current.readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json');
const recordedSummary = Current.readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_SUMMARY.json');
const recordedVerification = Current.readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/VERIFICATION_RECEIPT.json');
const rebuilt = Current.current();

equal(Evolution.stableStringify(recordedPortfolio), Evolution.stableStringify(rebuilt.portfolio), 'portfolio exact rebuild');
equal(Evolution.stableStringify(recordedSummary), Evolution.stableStringify(rebuilt.summary), 'summary exact rebuild');
equal(rebuilt.portfolio.schema, 'axm.verification-source-evolution-review-portfolio/v1', 'portfolio schema');
equal(rebuilt.portfolio.status, 'TEST', 'portfolio status');
equal(rebuilt.portfolio.counts.receiptInventory, 22, 'frozen receipt inventory count');
equal(rebuilt.portfolio.counts.historicalReviews, 5, 'five drift-bearing historical receipts');
equal(rebuilt.portfolio.counts.driftRows, 19, 'nineteen drift rows');
equal(rebuilt.portfolio.counts.laterCurrentTrackedReceiptCoverage, 17, 'seventeen strong later receipt routes');
equal(rebuilt.portfolio.counts.laterDigestValidAttestationOnly, 1, 'one attestation-only row');
equal(rebuilt.portfolio.counts.laterUnanchoredAttestationOnly, 0, 'no unanchored later row');
equal(rebuilt.portfolio.counts.noLaterReceiptAttestation, 1, 'one row lacks later receipt');
equal(rebuilt.portfolio.counts.generatedViewSemanticMatches, 1, 'generated view provides bounded route');
equal(rebuilt.portfolio.counts.unresolvedCurrentByteProvenance, 0, 'no current-byte provenance gap remains');
equal(rebuilt.portfolio.counts.candidateScopeEvolutionBridges, 1, 'one candidate-scope evolution bridge');
equal(rebuilt.portfolio.counts.unresolvedCandidateCurrentness, 0, 'no candidate currentness seam remains');
equal(rebuilt.portfolio.counts.legacyExternalAnchors, 2, 'two legacy anchors');
equal(rebuilt.portfolio.counts.legacyPreAnchorIntegrityUnknown, 2, 'two pre-anchor integrity holds');
equal(rebuilt.portfolio.counts.autonomousActions, 0, 'no autonomous action');
equal(rebuilt.portfolio.decision.currentByteProvenanceGaps.length, 0, 'no current byte gap listed');
equal(rebuilt.portfolio.decision.candidateCurrentnessReviewPaths.length, 0, 'candidate currentness seam routed');
equal(rebuilt.portfolio.decision.transitivelyRoutedCandidatePaths.length, 1, 'one transitive route listed');
equal(rebuilt.portfolio.decision.transitivelyRoutedCandidatePaths[0], 'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/selftest.js', 'transitive route path exact');
equal(rebuilt.portfolio.decision.legacyIntegrityHoldIds.length, 2, 'legacy holds listed');
equal(rebuilt.portfolio.broadVerificationObservation.schema, 'axm.verification-spine-report/v2', 'broad observation schema');
equal(rebuilt.portfolio.broadVerificationObservation.verdict, 'VERIFIED_WITH_LIMITS', 'broad observation verdict');
equal(rebuilt.portfolio.broadVerificationObservation.failures, 0, 'broad observation failures');
equal(rebuilt.portfolio.broadVerificationObservation.holds, 0, 'broad observation holds');
equal(rebuilt.portfolio.broadVerificationObservation.warningGroups, 2, 'broad warning groups visible');
equal(rebuilt.portfolio.broadVerificationObservation.invalidReceipts, 0, 'no invalid broad receipts');
equal(rebuilt.portfolio.broadVerificationObservation.observedAfterRequiredChecks, true, 'broad observation timing declared');
equal(rebuilt.portfolio.truth.broadVerificationClaimedBeyondRecordedObservation, false, 'broad observation not overclaimed');
check(/^sha256:[0-9a-f]{64}$/.test(rebuilt.portfolio.portfolioDigest), 'portfolio digest');
check(/^sha256:[0-9a-f]{64}$/.test(rebuilt.summary.summaryDigest), 'summary digest');

const context = Current.loadContext();
equal(context.inventory.receipts.length, 22, 'inventory loads exactly');
context.inventory.receipts.forEach(ref => {
  equal(Current.rawRef(ref.path).sha256, ref.sha256, 'inventory raw digest ' + ref.path);
});

const reviewEntries = context.continuity.entries.filter(entry => entry.comparison.trackedSourceDrift.length > 0);
reviewEntries.forEach((entry, index) => {
  check(Evolution.verifyReview(Current.buildReviewInput(entry, context), rebuilt.portfolio.reviews[index]).pass, 'review exact rebuild ' + index);
});
const bridgeInputs = Current.buildBridgeInputs(rebuilt.portfolio.reviews);
equal(bridgeInputs.length, 1, 'one bridge input rebuilds');
equal(rebuilt.portfolio.candidateEvolutionBridges.length, 1, 'one bridge recorded');
check(Evolution.verifyCandidateEvolutionBridge(bridgeInputs[0], rebuilt.portfolio.candidateEvolutionBridges[0]).pass, 'bridge exact rebuild');
equal(rebuilt.portfolio.candidateEvolutionBridges[0].candidate.originalReceiptByteCurrent, false, 'candidate receipt not called current');
equal(rebuilt.portfolio.candidateEvolutionBridges[0].truth.transitiveRouteClaimedAsCorrectness, false, 'transitive route not correctness');
const anchorEntries = context.continuity.entries.filter(entry => entry.decision.classification === 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED');
anchorEntries.forEach((entry, index) => {
  check(Evolution.verifyLegacyAnchor(Current.buildAnchorInput(entry), rebuilt.portfolio.legacyAnchors[index]).pass, 'anchor exact rebuild ' + index);
});

const gameAnchor = rebuilt.portfolio.legacyAnchors.find(anchor => anchor.generatedViewReview);
check(Boolean(gameAnchor), 'game generated-view anchor present');
equal(gameAnchor.generatedViewReview.identityRecognized, true, 'game generator identity exact');
equal(gameAnchor.generatedViewReview.semanticSnapshotMatch, true, 'game semantic snapshot matches');
equal(gameAnchor.generatedViewReview.evidence.currentState.games, 19, 'nineteen current games');
equal(gameAnchor.generatedViewReview.evidence.currentState.failCount, 0, 'zero current game failures');
equal(gameAnchor.generatedViewReview.evidence.currentState.warningCount, 17, 'seventeen current warnings remain');
equal(gameAnchor.truth.generatedViewSemanticMatchClaimedAsHistoricalByteMatch, false, 'semantic match not byte equality');
equal(gameAnchor.decision.historicalIntegrityBeforeAnchorEstablished, false, 'pre-anchor integrity unknown');

equal(rebuilt.portfolio.truth.currentBytesClaimedAsOriginallyIntended, false, 'intent not inferred');
equal(rebuilt.portfolio.truth.currentBytesClaimedAsCorrect, false, 'correctness not inferred');
equal(rebuilt.portfolio.truth.currentBytesClaimedAsRegressionFree, false, 'regression absence not inferred');
equal(rebuilt.portfolio.truth.transitiveRouteClaimedAsCandidateReceiptByteCurrentness, false, 'transitive route not candidate byte currentness');
equal(rebuilt.portfolio.truth.historicalReceiptRewritten, false, 'history not rewritten');
equal(rebuilt.portfolio.truth.authorityGranted, false, 'no authority');
equal(rebuilt.portfolio.truth.canonicalStateTouched, false, 'no canon');

const contract = Current.readJson('shared/verification-source-evolution-review/module.contract.json');
equal(contract.status, 'TEST', 'contract status');
equal(contract.permissions.length, 0, 'permissionless contract');
check(contract.boundaries.refuses.includes('later-attestation-as-correctness'), 'correctness refusal');
check(contract.boundaries.refuses.includes('external-anchor-as-pre-anchor-integrity'), 'pre-anchor refusal');
check(contract.boundaries.refuses.includes('transitive-route-as-candidate-byte-currentness'), 'transitive currentness refusal');

const gap = Current.readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_GAP_REPORT.json');
equal(gap.before.overall, 'BLOCKED', 'before blocked');
equal(gap.after.overall, 'READY', 'after ready');
equal(gap.after.missingCapabilities.length, 0, 'required capabilities complete');
equal(gap.after.optionalEvidence['historical-pre-anchor-integrity'], 'DEGRADED', 'pre-anchor gap retained');

const serialized = JSON.stringify(rebuilt);
equal(/[A-Za-z]:[\\/]/.test(serialized), false, 'no machine path');
equal(serialized.includes('bridge-token'), false, 'no bridge token path');
const source = fs.readFileSync(path.join(__dirname, 'build-current-evolution-review.js'), 'utf8');
check(source.includes("process.argv.includes('--write')"), 'writes require explicit flag');
equal(rebuilt.summary.portfolioRef.digest, rebuilt.portfolio.portfolioDigest, 'summary binds portfolio');
check(Verification.verify(recordedVerification).pass, 'verification receipt exact rebuild');
equal(recordedVerification.result, 'PASS_WITH_DECLARED_LIMITS', 'verification result');
equal(recordedVerification.requiredChecks.failed, 0, 'required checks recorded without failure');
equal(recordedVerification.currentState.legacyPreAnchorIntegrityUnknown, 2, 'verification retains two legacy holds');

console.log('PASS verification source evolution review audit selftest (' + assertions + ' assertions)');
