#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const seal = read('SESSION_SEGMENT.seal.json');
const results = read('CHECK_RESULTS.json');
const visual = read('VISUAL_RECEIPT.json');
if (seal.parseStatus !== 'valid' || seal.invalidJsonLines !== 0) throw new Error('session seal is not valid');
if (results.status !== 'PASS' || visual.status !== 'PASS') throw new Error('verification receipts are not PASS');
const openEvidence = [
  'coordinated global tools-index refresh without unrelated receipt churn',
  'live host submission authorization for a real held-audit candidate',
  'authenticated reviewer identity or actual human review',
  'review vote, decision, approval, or retention-hold resolution',
  'assistive-technology compatibility audit',
  'provider shadow execution or evaluation',
  'held-out human benefit or learning',
  'adoption, promotion, merge, Foundation mutation, or CANON decision'
];
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  status: 'TEST',
  sessionId: '2026-08-21-model-shadow-retention-audit-review-view-v3.0',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  sealDigest: 'sha256:' + seal.sha256,
  durableEventsPreserved: seal.eventLines,
  telemetryAggregation: {
    retainedRawLogs: false,
    retainedRawBrowserTelemetry: false,
    commandOutcomes: results.summary.commands,
    passedCommands: results.summary.passed,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    unchangedProgressPollsRetained: false
  },
  temporaryMaterialDeleted: {
    classification: 'TEMPORARY_CAPTURE_AND_SYNTHETIC_TEST_STATE',
    browserScreenshotBuffers: 6,
    browserDomSnapshotBuffers: 3,
    localHarnessStateRoots: 1,
    browserTabs: 1,
    screenshotsRetained: false,
    policy: 'only current-run browser buffers tab and verified harness-owned temporary descendants were removed after semantic receipt extraction'
  },
  explicitRetentionExceptions: [],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json', 'CAPABILITY_GAP_AFTER.json', 'CHECK_RESULTS.json', 'VISUAL_RECEIPT.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Browser clicks only selected local synthetic items; no vote button was clicked. Harness writes and cleanup stayed inside its verified temporary root. No shared-main mutation, package intake, live API submission, provider, authenticated identity, actual human review, vote, approval, hold resolution, execution, adoption, install, promotion, merge, Foundation mutation, or CANON authority used.'
};
const index = {
  schema: 'axm.session-index/v1',
  status: 'TEST',
  sessionId: receipt.sessionId,
  summary: 'SESSION_SUMMARY.md',
  segment: receipt.sealedSegment,
  seal: 'SESSION_SEGMENT.seal.json',
  curationReceipt: 'CURATION_RECEIPT.json',
  sourceSnapshot: 'SOURCE_SNAPSHOT.json',
  checkResults: 'CHECK_RESULTS.json',
  visualReceipt: 'VISUAL_RECEIPT.json',
  capabilityBefore: 'CAPABILITY_GAP_BEFORE.json',
  capabilityAfter: 'CAPABILITY_GAP_AFTER.json',
  openEvidence
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt and session index');
