#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Continuity = require('../../../shared/verification-snapshot-continuity/verification-snapshot-continuity');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T20:20:00.000Z';
const HISTORICAL_RECEIPTS = [
  'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-evidence-frontier/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/VERIFICATION_RECEIPT.json'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function rawSourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Continuity.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function currentSourceRefs(historicalReceipt) {
  const collected = Continuity.collectHistoricalSourceRefs(historicalReceipt);
  return collected.refs.flatMap(ref => {
    const full = path.join(ROOT, ...ref.path.split('/'));
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [];
    return [{ path: ref.path, sha256: Continuity.sha256(fs.readFileSync(full)) }];
  });
}

function currentDerivedView() {
  const relativePath = Continuity.MUTABLE_DERIVED_PATH;
  const report = readJson(relativePath);
  return {
    path: relativePath,
    sha256: rawSourceRef(relativePath).sha256,
    schema: report.schema,
    verdict: report.verdict,
    failures: Array.isArray(report.failures) ? report.failures.length : 0,
    holds: Array.isArray(report.holds) ? report.holds.length : 0,
    warningGroups: Array.isArray(report.warnings) ? report.warnings.length : 0,
    invalidReceipts: Array.isArray(report.invalid_receipts) ? report.invalid_receipts.length : 0
  };
}

function buildInputFor(relativePath) {
  const historicalReceipt = readJson(relativePath);
  return {
    continuityId: 'continuity:' + path.basename(path.dirname(relativePath)),
    checkedAt: GENERATED_AT,
    historicalReceiptRef: rawSourceRef(relativePath),
    historicalReceipt,
    currentSources: currentSourceRefs(historicalReceipt),
    currentDerivedView: currentDerivedView()
  };
}

function buildPortfolio() {
  const entries = HISTORICAL_RECEIPTS.map(relativePath => Continuity.build(buildInputFor(relativePath)));
  const classificationMap = new Map();
  entries.forEach(entry => {
    const key = entry.decision.classification;
    classificationMap.set(key, (classificationMap.get(key) || 0) + 1);
  });
  const classifications = Object.fromEntries(Array.from(classificationMap.entries()).sort((a, b) => a[0].localeCompare(b[0])));
  const trackedSourceDriftEntries = entries.filter(entry => entry.decision.classification === 'TRACKED_SOURCE_DRIFT');
  const heldEntries = entries.filter(entry => entry.decision.classification.startsWith('HOLD_'));
  const mutableOnlyEntries = entries.filter(entry => entry.decision.classification === 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY');
  const exactEntries = entries.filter(entry => entry.decision.classification === 'CURRENT_SOURCE_SET_EXACT');

  const portfolio = {
    schema: 'axm.verification-snapshot-continuity-portfolio/v1',
    version: '0.1.0',
    portfolioId: 'verification-snapshot-continuity:2026-08-19',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    scope: 'EIGHT_CURRENT_WORKSHOP_VERIFICATION_RECEIPTS_WITH_MUTABLE_DERIVED_VIEW_COUPLING',
    sourceRefs: {
      historicalReceipts: HISTORICAL_RECEIPTS.map(rawSourceRef),
      currentDerivedView: rawSourceRef(Continuity.MUTABLE_DERIVED_PATH)
    },
    counts: {
      historicalReceipts: entries.length,
      currentSourceSetExact: exactEntries.length,
      mutableDerivedViewDriftOnly: mutableOnlyEntries.length,
      trackedSourceDrift: trackedSourceDriftEntries.length,
      held: heldEntries.length,
      trackedSourceDriftPaths: entries.reduce((sum, entry) => sum + entry.comparison.trackedSourceDrift.length, 0),
      autonomousActions: 0
    },
    classifications,
    entries,
    decision: {
      currentBestAction: heldEntries.length || trackedSourceDriftEntries.length
        ? 'PRESERVE_SEALED_RECEIPTS_AND_REVIEW_TRACKED_SOURCE_OR_INTEGRITY_DRIFT'
        : 'PRESERVE_SEALED_RECEIPTS_AND_USE_CURRENT_DERIVED_VIEW',
      reviewEntryIds: entries
        .filter(entry => entry.decision.reviewRequired || entry.decision.classification.startsWith('HOLD_'))
        .map(entry => entry.continuityId),
      autonomousActionCount: 0
    },
    declaredLimits: [
      'Tracked-source drift is an exact byte difference, not by itself a regression, defect, or unsafe change.',
      'A valid receipt self-digest establishes the retained receipt body, not availability of the historical derived-view bytes.',
      'Receipts without a declared self-digest remain held even when their current source bytes can be measured.',
      'The current broad report is observed as data; this portfolio does not rerun or claim broad verification.',
      'No historical receipt is rewritten and no promotion, merge, Foundation, human-benefit, or CANON claim is made.'
    ],
    truth: {
      historicalReceiptBytesRewritten: false,
      mutableReportDriftBlanketIgnored: false,
      trackedSourceDriftHidden: false,
      trackedSourceDriftClaimedAsRegression: false,
      historicalDerivedBytesRecovered: false,
      currentBroadVerificationClaimed: false,
      automaticActionTaken: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    portfolioDigest: null
  };
  const payload = Continuity.clone(portfolio);
  delete payload.portfolioDigest;
  portfolio.portfolioDigest = Continuity.sha256(payload);
  return portfolio;
}

function buildSummary(portfolio) {
  const summary = {
    schema: 'axm.verification-snapshot-continuity-summary/v1',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    portfolioRef: {
      schema: portfolio.schema,
      digest: portfolio.portfolioDigest
    },
    counts: portfolio.counts,
    classifications: portfolio.classifications,
    decision: portfolio.decision,
    limits: portfolio.declaredLimits,
    summaryDigest: null
  };
  const payload = Continuity.clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Continuity.sha256(payload);
  return summary;
}

function current() {
  const portfolio = buildPortfolio();
  return { portfolio, summary: buildSummary(portfolio) };
}

function write() {
  const result = current();
  fs.writeFileSync(path.join(__dirname, 'CURRENT_CONTINUITY_PORTFOLIO.json'), JSON.stringify(result.portfolio, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(result.summary, null, 2) + '\n');
  return result;
}

module.exports = {
  ROOT,
  GENERATED_AT,
  HISTORICAL_RECEIPTS,
  readJson,
  rawSourceRef,
  currentSourceRefs,
  currentDerivedView,
  buildInputFor,
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
    classifications: result.portfolio.classifications,
    currentBestAction: result.portfolio.decision.currentBestAction,
    portfolioDigest: result.portfolio.portfolioDigest
  }, null, 2) + '\n');
}

