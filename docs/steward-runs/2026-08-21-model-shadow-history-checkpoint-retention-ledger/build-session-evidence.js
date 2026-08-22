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
  'authenticated checkpoint origin or pin',
  'external independent retention',
  'protected monotonic state',
  'deletion or rollback prevention',
  'directory-entry hardware and power-loss durability',
  'authenticated policy rotation',
  'authenticated independent controllers',
  'collusion exclusion',
  'authenticated human participation',
  'authenticated host entrypoint',
  'externally trusted time',
  'global transition uniqueness',
  'globally consistent log',
  'atomic multi-file source snapshot',
  'provider shadow execution',
  'held-out evaluation',
  'held-out human benefit',
  'held-out learning',
  'promotion, merge, or CANON decision'
];
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  status: 'TEST',
  sessionId: '2026-08-21-model-shadow-history-checkpoint-retention-ledger-v2.7',
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
    classification: 'TEMPORARY_CAPTURE_AND_SYNTHETIC_TEST_STATE',
    policy: 'focused selftests delete only verified descendants of their synthetic temporary roots; detached replay cleanup is recorded at handoff',
    countKnown: false
  },
  explicitRetentionExceptions: [],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json', 'CAPABILITY_GAP_AFTER.json', 'CHECK_RESULTS.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. Composed v2.6 and v2.5 calls used declared transient source locks. No shared-main mutation, package intake, provider, identity, authenticated human review, external retention, protected storage, rollback prevention, atomic snapshot, policy rotation, permission, adoption, install, promotion, merge, or CANON authority used.'
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
