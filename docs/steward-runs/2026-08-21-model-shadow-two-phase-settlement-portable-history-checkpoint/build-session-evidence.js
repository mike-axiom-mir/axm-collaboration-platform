#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'), 'utf8').trimEnd().split(/\r?\n/);
lines.forEach(line => JSON.parse(line));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
if (seal.parseStatus !== 'valid' || seal.eventLines !== lines.length) throw new Error('session seal mismatch');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: 'model-shadow-two-phase-settlement-portable-history-checkpoint:2026-08-21',
  status: 'TEST',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  seal: 'SESSION_SEGMENT.seal.json',
  sealDigest: 'sha256:' + seal.sha256,
  durableEventsPreserved: lines.length,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    summary: 'CHECK_RESULTS.json retains bounded command outcomes and diagnostics; passing stdout and three healthy repeat logs were not retained.'
  },
  temporaryMaterialDeleted: {
    count: null,
    countKnown: false,
    reason: 'Focused, adversarial-movement, restart, rollback, replacement, identity, absence, invalidity, and verification invocations used verified temporary roots removed by selftest cleanup. No incoming specialist ZIP, user source, raw log, screenshot, recording, external transition, identity attestation, or provider artifact was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation and schemas are TEST review candidates, not disposable session evidence.',
    'Check results, source snapshot, comparator reports, claim routes, and sealed segment are bounded review evidence.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. No merge, promotion, CANON, provider, identity, human-review, adoption, network, other-host, external-retention, protected-storage, rollback-prevention, package-intake, or specialist-ZIP authority used.'
};
fs.writeFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt for ' + lines.length + ' sealed durable events');
