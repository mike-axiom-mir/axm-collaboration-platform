#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Continuity = require('../../../shared/verification-snapshot-continuity/verification-snapshot-continuity');
const Current = require('./build-current-continuity');
const Verification = require('./build-verification-receipt');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }

const recordedPortfolio = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_CONTINUITY_PORTFOLIO.json');
const recordedSummary = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_SUMMARY.json');
const rebuilt = Current.current();

equal(Continuity.stableStringify(recordedPortfolio), Continuity.stableStringify(rebuilt.portfolio), 'portfolio exact rebuild');
equal(Continuity.stableStringify(recordedSummary), Continuity.stableStringify(rebuilt.summary), 'summary exact rebuild');
equal(rebuilt.portfolio.schema, 'axm.verification-snapshot-continuity-portfolio/v1', 'portfolio schema');
equal(rebuilt.portfolio.status, 'TEST', 'portfolio status');
equal(rebuilt.portfolio.entries.length, 8, 'eight affected receipts');
equal(rebuilt.portfolio.counts.historicalReceipts, 8, 'count matches entries');
equal(rebuilt.portfolio.sourceRefs.historicalReceipts.length, 8, 'eight historical refs');
check(/^sha256:[0-9a-f]{64}$/.test(rebuilt.portfolio.portfolioDigest), 'portfolio digest');
check(/^sha256:[0-9a-f]{64}$/.test(rebuilt.summary.summaryDigest), 'summary digest');

Current.HISTORICAL_RECEIPTS.forEach((relativePath, index) => {
  const entry = rebuilt.portfolio.entries[index];
  check(Continuity.verify(Current.buildInputFor(relativePath), entry).pass, 'entry exact rebuild ' + index);
  equal(entry.historicalReceipt.ref.path, relativePath, 'entry path ' + index);
  equal(entry.truth.historicalReceiptRewritten, false, 'history preserved ' + index);
});

const knowledge = rebuilt.portfolio.entries.find(entry => entry.continuityId.includes('grounded-growth-knowledge-frontier'));
check(Boolean(knowledge), 'knowledge receipt present');
equal(knowledge.decision.classification, 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY', 'knowledge drift isolated');
equal(knowledge.comparison.trackedSourceDrift.length, 0, 'knowledge tracked sources exact');
equal(knowledge.historicalReceipt.selfDigest.state, 'VALID', 'knowledge historical self-digest valid');

const participation = rebuilt.portfolio.entries.find(entry => entry.continuityId.includes('grounded-growth-participation-frontier'));
check(Boolean(participation), 'participation receipt present');
check(['CURRENT_SOURCE_SET_EXACT', 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY'].includes(participation.decision.classification), 'participation has no tracked-source drift');
equal(participation.comparison.trackedSourceDrift.length, 0, 'participation tracked sources exact');

check(rebuilt.portfolio.counts.trackedSourceDrift > 0, 'tracked source drift remains visible');
check(rebuilt.portfolio.counts.trackedSourceDriftPaths > 0, 'tracked drift paths retained');
check(rebuilt.portfolio.counts.held > 0, 'integrity holds remain visible');
equal(rebuilt.portfolio.counts.autonomousActions, 0, 'no autonomous actions');
equal(rebuilt.portfolio.truth.trackedSourceDriftHidden, false, 'drift not hidden');
equal(rebuilt.portfolio.truth.trackedSourceDriftClaimedAsRegression, false, 'drift not overclaimed');
equal(rebuilt.portfolio.truth.currentBroadVerificationClaimed, false, 'broad not claimed');
equal(rebuilt.portfolio.truth.historicalReceiptBytesRewritten, false, 'portfolio preserves history');
equal(rebuilt.portfolio.truth.authorityGranted, false, 'no authority');
equal(rebuilt.portfolio.truth.canonicalStateTouched, false, 'no canon');

const contract = Current.readJson('shared/verification-snapshot-continuity/module.contract.json');
equal(contract.status, 'TEST', 'contract status');
equal(contract.permissions.length, 0, 'permissionless contract');
check(contract.boundaries.refuses.includes('historical-receipt-rewrite'), 'rewrite refusal');
check(contract.boundaries.refuses.includes('mutable-derived-drift-as-product-pass'), 'greenwashing refusal');

const gap = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_GAP_REPORT.json');
equal(gap.before.overall, 'BLOCKED', 'before capability gap blocked');
equal(gap.after.overall, 'READY', 'after required capabilities ready');
equal(gap.after.missingCapabilities.length, 0, 'no missing required capability after');
equal(gap.after.optionalEvidence['historical-derived-bytes-retained'], 'DEGRADED', 'historical bytes gap preserved');
equal(gap.truth.trackedSourceDriftHidden, false, 'capability report preserves drift');

const schema = Current.readJson('shared/verification-snapshot-continuity/verification-snapshot-continuity-receipt.schema.json');
equal(schema.$id, Continuity.RECEIPT_SCHEMA, 'schema identity');
equal(schema.additionalProperties, false, 'schema closed at top level');
check(schema.required.includes('continuityDigest'), 'schema requires digest');

const serialized = JSON.stringify(rebuilt);
equal(/[A-Za-z]:[\\/]/.test(serialized), false, 'no machine path in current artifacts');
equal(serialized.includes('bridge-token'), false, 'no bridge token path');
equal(serialized.includes('authorization'), false, 'no authorization material');

const source = fs.readFileSync(path.join(__dirname, 'build-current-continuity.js'), 'utf8');
check(source.includes("process.argv.includes('--write')"), 'writes require explicit flag');
equal(rebuilt.summary.portfolioRef.digest, rebuilt.portfolio.portfolioDigest, 'summary binds portfolio');

const verificationReceipt = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/VERIFICATION_RECEIPT.json');
check(Verification.verify(verificationReceipt).pass, 'verification receipt exact rebuild');
equal(verificationReceipt.requiredChecks.passed, 10, 'ten required checks recorded');
equal(verificationReceipt.requiredChecks.failed, 0, 'no required check failures');
equal(verificationReceipt.broadVerification.verdict, 'VERIFIED_WITH_LIMITS', 'broad limits preserved');
equal(verificationReceipt.broadVerification.rawDigestIncludedInStableSourceRefs, false, 'mutable report excluded from stable refs');
equal(verificationReceipt.sourceRefs.some(ref => ref.path === Continuity.MUTABLE_DERIVED_PATH), false, 'no direct mutable report source ref');
equal(verificationReceipt.preservedContradictions[0].continuityClassification, 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY', 'historical contradiction classified');
equal(verificationReceipt.boundaries.historicalReceiptRewritten, false, 'verification preserves history');
equal(verificationReceipt.truth.authorityGranted, false, 'verification grants no authority');

const seal = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/SESSION_SEAL.json');
const precheckSeal = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/SESSION_SEAL_PRECHECK.json');
const curation = Current.readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURATION_RECEIPT.json');
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
equal(seal.parseStatus, 'valid', 'session segment parse valid');
equal(seal.eventLines, 12, 'twelve durable session events');
equal('sha256:' + seal.sha256, Continuity.sha256(segmentBytes), 'session seal matches segment bytes');
check(Date.parse(seal.generatedAt) > Date.parse(seal.lastTimestamp), 'final seal follows final event');
equal(precheckSeal.eventLines, 10, 'superseded precheck retained');
equal(curation.seal_digest, 'sha256:' + seal.sha256, 'curation binds final seal');
equal(curation.temporary_material_deleted.length, 0, 'no material deleted');
equal(curation.truth.historicalReceiptRewritten, false, 'curation preserves historical receipts');

console.log('PASS verification snapshot continuity audit selftest (' + assertions + ' assertions)');
