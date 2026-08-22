#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Evolution = require('../../../shared/verification-source-evolution-review/verification-source-evolution-review');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T19:45:00.000Z';
const CONTINUITY_PATH = 'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_CONTINUITY_PORTFOLIO.json';
const INVENTORY_PATH = 'docs/steward-runs/2026-08-19-verification-source-evolution-review/RECEIPT_INVENTORY.json';
const GAME_REPORT_PATH = 'exports/game-night-seam-report.json';
const SPINE_REPORT_PATH = 'exports/verification-spine-report.json';
const GAME_WRITER_STATEMENT = "fs.writeFileSync(path.join(ROOT, 'exports', 'game-night-seam-report.json'), JSON.stringify(gr, null, 2));";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function rawRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Evolution.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function loadContext() {
  const continuity = readJson(CONTINUITY_PATH);
  const inventory = readJson(INVENTORY_PATH);
  if (inventory.count !== inventory.receipts.length) throw new Error('receipt inventory count mismatch');
  const candidateEvidence = inventory.receipts.map(recordedRef => {
    const currentRef = rawRef(recordedRef.path);
    if (currentRef.sha256 !== recordedRef.sha256) {
      throw new Error('receipt inventory digest drift: ' + recordedRef.path);
    }
    return {
      receiptRef: currentRef,
      receipt: readJson(recordedRef.path),
      currentContinuityReceipt: continuity.entries.find(entry => entry.historicalReceipt.ref.path === recordedRef.path) || null
    };
  });
  return { continuity, inventory, candidateEvidence };
}

function buildReviewInput(entry, context) {
  return {
    reviewId: 'evolution-review:' + path.basename(path.dirname(entry.historicalReceipt.ref.path)),
    reviewedAt: GENERATED_AT,
    continuityReceipt: entry,
    historicalReceiptRef: rawRef(entry.historicalReceipt.ref.path),
    historicalReceipt: readJson(entry.historicalReceipt.ref.path),
    candidateEvidence: context.candidateEvidence.filter(candidate =>
      candidate.receiptRef.path !== entry.historicalReceipt.ref.path
    )
  };
}

function generatedViewEvidence(entry, historicalReceipt) {
  if (!entry.historicalReceipt.ref.path.includes('voluntary-phone-qa-campaign')) return null;
  const report = readJson(GAME_REPORT_PATH);
  const verifySource = fs.readFileSync(path.join(ROOT, 'verify.js'), 'utf8');
  return {
    kind: 'KNOWN_REGENERATED_GAME_NIGHT_VIEW',
    currentViewRef: rawRef(GAME_REPORT_PATH),
    schema: report.schema,
    generatorRef: rawRef('verify.js'),
    writerStatementSha256: Evolution.sha256(GAME_WRITER_STATEMENT),
    generatorWritesExactPath: verifySource.includes(GAME_WRITER_STATEMENT),
    volatileField: 'checkedAt',
    currentState: {
      games: Array.isArray(report.games) ? report.games.length : 0,
      pass: report.pass === true,
      failCount: Number(report.failCount),
      warningCount: Number(report.warningCount)
    },
    historicalRecordedState: {
      verifierGames: Number(historicalReceipt.currentCampaign.verifierGames),
      physicalPhoneWarnings: Number(historicalReceipt.currentCampaign.physicalPhoneWarnings),
      warningsStillOpen: Number(historicalReceipt.currentCampaign.warningsStillOpen)
    }
  };
}

function buildAnchorInput(entry) {
  const historicalReceipt = readJson(entry.historicalReceipt.ref.path);
  return {
    anchorId: 'legacy-anchor:' + path.basename(path.dirname(entry.historicalReceipt.ref.path)),
    anchoredAt: GENERATED_AT,
    continuityReceipt: entry,
    historicalReceiptRef: rawRef(entry.historicalReceipt.ref.path),
    historicalReceipt,
    generatedViewEvidence: generatedViewEvidence(entry, historicalReceipt)
  };
}

function buildBridgeInputs(reviews) {
  const inputs = [];
  reviews.forEach(targetReview => {
    targetReview.driftReviews
      .filter(row => row.state === 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN')
      .forEach(row => {
        const candidateMatch = row.matches.find(match =>
          match.laterThanHistorical && match.selfDigestState === 'VALID'
        );
        if (!candidateMatch) return;
        const candidateReview = reviews.find(review =>
          review.historicalReceipt.ref.path === candidateMatch.receiptRef.path
        );
        if (!candidateReview) return;
        inputs.push({
          bridgeId: 'candidate-evolution-bridge:' + path.basename(path.dirname(targetReview.historicalReceipt.ref.path)),
          builtAt: GENERATED_AT,
          targetReview,
          candidateReview,
          candidateReceiptRef: candidateMatch.receiptRef,
          targetPath: row.path
        });
      });
  });
  return inputs;
}

function buildPortfolio() {
  const context = loadContext();
  const spine = readJson(SPINE_REPORT_PATH);
  const reviewEntries = context.continuity.entries.filter(entry =>
    Array.isArray(entry.comparison.trackedSourceDrift) && entry.comparison.trackedSourceDrift.length > 0
  );
  const reviews = reviewEntries.map(entry => Evolution.buildReview(buildReviewInput(entry, context)));
  const bridgeInputs = buildBridgeInputs(reviews);
  const candidateEvolutionBridges = bridgeInputs.map(input => Evolution.buildCandidateEvolutionBridge(input));
  const anchorEntries = context.continuity.entries.filter(entry =>
    entry.decision.classification === 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED'
  );
  const anchors = anchorEntries.map(entry => Evolution.buildLegacyAnchor(buildAnchorInput(entry)));
  const driftRows = reviews.flatMap(review => review.driftReviews);
  const countState = state => driftRows.filter(row => row.state === state).length;
  const generatedSemanticMatches = anchors.filter(anchor => anchor.generatedViewReview &&
    anchor.generatedViewReview.semanticSnapshotMatch).length;
  const noLater = countState('NO_LATER_RECEIPT_ATTESTATION');
  const transitivelyRoutedCandidatePaths = candidateEvolutionBridges.map(bridge => bridge.target.path);
  const candidateCurrentnessReviewPaths = driftRows
    .filter(row => row.state === 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN' ||
      row.state === 'CURRENT_BYTES_ATTESTED_BY_LATER_UNANCHORED_RECEIPT')
    .map(row => row.path)
    .filter(rowPath => !transitivelyRoutedCandidatePaths.includes(rowPath));
  const unresolvedCurrentByteProvenance = Math.max(0, noLater - generatedSemanticMatches);

  const portfolio = {
    schema: 'axm.verification-source-evolution-review-portfolio/v1',
    version: '0.1.0',
    portfolioId: 'verification-source-evolution-review:2026-08-19',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    scope: 'CURRENT_CONTINUITY_DRIFT_ROWS_AND_LEGACY_INTEGRITY_HOLDS',
    sourceRefs: {
      continuityPortfolio: rawRef(CONTINUITY_PATH),
      receiptInventory: rawRef(INVENTORY_PATH),
      verifyGenerator: rawRef('verify.js'),
      currentGameNightView: rawRef(GAME_REPORT_PATH),
      currentVerificationSpine: rawRef(SPINE_REPORT_PATH)
    },
    counts: {
      receiptInventory: context.inventory.receipts.length,
      historicalReviews: reviews.length,
      driftRows: driftRows.length,
      laterCurrentTrackedReceiptCoverage: countState('CURRENT_BYTES_COVERED_BY_LATER_CURRENT_TRACKED_SOURCE_RECEIPT'),
      laterDigestValidAttestationOnly: countState('CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN'),
      laterUnanchoredAttestationOnly: countState('CURRENT_BYTES_ATTESTED_BY_LATER_UNANCHORED_RECEIPT'),
      noLaterReceiptAttestation: noLater,
      generatedViewSemanticMatches: generatedSemanticMatches,
      unresolvedCurrentByteProvenance,
      candidateScopeEvolutionBridges: candidateEvolutionBridges.length,
      unresolvedCandidateCurrentness: candidateCurrentnessReviewPaths.length,
      legacyExternalAnchors: anchors.length,
      legacyPreAnchorIntegrityUnknown: anchors.length,
      autonomousActions: 0
    },
    reviews,
    candidateEvolutionBridges,
    legacyAnchors: anchors,
    broadVerificationObservation: {
      schema: spine.schema,
      profile: spine.profile && spine.profile.id,
      verdict: spine.verdict,
      failures: Array.isArray(spine.failures) ? spine.failures.length : null,
      holds: Array.isArray(spine.holds) ? spine.holds.length : null,
      warningGroups: Array.isArray(spine.warnings) ? spine.warnings.length : null,
      invalidReceipts: Array.isArray(spine.invalid_receipts) ? spine.invalid_receipts.length : null,
      receiptCount: Number(spine.receipt_count),
      claimCount: Number(spine.claim_count),
      knownCoreWarningLines: 17,
      observedAfterRequiredChecks: true
    },
    decision: {
      currentBestAction: unresolvedCurrentByteProvenance
        ? 'REVIEW_CURRENT_BYTE_PROVENANCE_GAPS_AND_KEEP_LEGACY_HISTORY_HELD'
        : candidateCurrentnessReviewPaths.length
          ? 'REVIEW_CANDIDATE_CURRENTNESS_SEAM_AND_KEEP_LEGACY_PRE_ANCHOR_INTEGRITY_HELD'
        : 'PRESERVE_EVOLUTION_EVIDENCE_AND_KEEP_LEGACY_PRE_ANCHOR_INTEGRITY_HELD',
      currentByteProvenanceGaps: driftRows
        .filter(row => row.state === 'NO_LATER_RECEIPT_ATTESTATION')
        .filter(row => !anchors.some(anchor => anchor.generatedViewReview &&
          anchor.generatedViewReview.semanticSnapshotMatch &&
          anchor.generatedViewReview.evidence.currentViewRef.path === row.path))
        .map(row => row.path),
      candidateCurrentnessReviewPaths,
      transitivelyRoutedCandidatePaths,
      legacyIntegrityHoldIds: anchors.map(anchor => anchor.anchorId),
      autonomousActionCount: 0
    },
    declaredLimits: [
      'Later current receipt coverage establishes attestation of current bytes, not original intent, correctness, or absence of regression.',
      'A transitive candidate-scope route closes one byte-lineage review seam without claiming that the candidate receipt itself remains byte-current.',
      'The Game Night generated-view bridge compares a bounded semantic snapshot; it does not reconstruct or prove historical report bytes.',
      'External anchors make future receipt-byte changes detectable but do not establish integrity before the anchor time.',
      'No human-benefit, model-learning, production, promotion, merge, Foundation, or CANON claim is made.'
    ],
    truth: {
      currentBytesClaimedAsOriginallyIntended: false,
      currentBytesClaimedAsCorrect: false,
      currentBytesClaimedAsRegressionFree: false,
      transitiveRouteClaimedAsCandidateReceiptByteCurrentness: false,
      generatedViewSemanticMatchClaimedAsHistoricalByteMatch: false,
      legacyExternalAnchorClaimedAsPreAnchorIntegrity: false,
      historicalReceiptRewritten: false,
      sourceMutationPerformed: false,
      automaticActionTaken: false,
      broadVerificationClaimedBeyondRecordedObservation: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    portfolioDigest: null
  };
  const payload = Evolution.clone(portfolio);
  delete payload.portfolioDigest;
  portfolio.portfolioDigest = Evolution.sha256(payload);
  return portfolio;
}

function buildSummary(portfolio) {
  const summary = {
    schema: 'axm.verification-source-evolution-review-summary/v1',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    portfolioRef: { schema: portfolio.schema, digest: portfolio.portfolioDigest },
    counts: portfolio.counts,
    decision: portfolio.decision,
    limits: portfolio.declaredLimits,
    summaryDigest: null
  };
  const payload = Evolution.clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Evolution.sha256(payload);
  return summary;
}

function current() {
  const portfolio = buildPortfolio();
  return { portfolio, summary: buildSummary(portfolio) };
}

function write() {
  const result = current();
  fs.writeFileSync(path.join(__dirname, 'CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json'), JSON.stringify(result.portfolio, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(result.summary, null, 2) + '\n');
  return result;
}

module.exports = {
  ROOT,
  GENERATED_AT,
  CONTINUITY_PATH,
  INVENTORY_PATH,
  GAME_REPORT_PATH,
  SPINE_REPORT_PATH,
  GAME_WRITER_STATEMENT,
  readJson,
  rawRef,
  loadContext,
  buildReviewInput,
  generatedViewEvidence,
  buildAnchorInput,
  buildBridgeInputs,
  buildPortfolio,
  buildSummary,
  current,
  write
};

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : current();
  process.stdout.write(JSON.stringify({
    status: result.portfolio.status,
    counts: result.portfolio.counts,
    currentBestAction: result.portfolio.decision.currentBestAction,
    portfolioDigest: result.portfolio.portfolioDigest
  }, null, 2) + '\n');
}
