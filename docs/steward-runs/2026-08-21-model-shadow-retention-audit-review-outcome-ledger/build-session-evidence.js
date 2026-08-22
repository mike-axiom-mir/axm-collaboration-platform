#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const seal = read('SESSION_SEGMENT.seal.json');
const results = read('CHECK_RESULTS.json');
if (seal.parseStatus !== 'valid' || seal.invalidJsonLines !== 0) throw new Error('session seal is not valid');
if (results.status !== 'PASS') throw new Error('verification results are not PASS');
const openEvidence = [
  'live host observation of persisted Review Inbox outcomes',
  'authenticated reviewer identity or actual human review',
  'authenticated steward remediation decision or retention-hold resolution',
  'raw actor-digest provenance re-verification after capture input loss',
  'independent external custody',
  'protected monotonic storage or full local rewrite detection',
  'directory-entry device hardware cache or power-loss durability',
  'externally trusted time',
  'independent Draft 2020-12 schema meta-validation',
  'provider execution evaluation human benefit or learning',
  'adoption execution promotion merge Foundation mutation or CANON decision'
];
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  status: 'TEST',
  sessionId: '2026-08-21-model-shadow-retention-audit-review-outcome-ledger-v3.2',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  sealDigest: 'sha256:' + seal.sha256,
  durableEventsPreserved: seal.eventLines,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    passedCommands: results.summary.passed,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    unchangedProgressPollsRetained: false
  },
  temporaryMaterialDeleted: {
    classification: 'SYNTHETIC_TEST_STATE',
    policy: 'focused selftests remove only verified descendants of their synthetic temporary roots; no browser capture was created',
    countKnown: false
  },
  explicitRetentionExceptions: [],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json', 'CAPABILITY_GAP_AFTER.json', 'CHECK_RESULTS.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic ledger ReviewService and upstream observation writes and removals stayed inside verified temporary descendants; unchanged v2.8 verification used its declared transient operation lock. No shared-main mutation, specialist ZIP intake, live host observation or mutation, external custody, provider, authenticated identity, actual human review, consequential decision, hold resolution, execution, adoption, install, promotion, merge, Foundation mutation, or CANON authority used.'
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
  capabilityBefore: 'CAPABILITY_GAP_BEFORE.json',
  capabilityAfter: 'CAPABILITY_GAP_AFTER.json',
  openEvidence
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt and session index');
