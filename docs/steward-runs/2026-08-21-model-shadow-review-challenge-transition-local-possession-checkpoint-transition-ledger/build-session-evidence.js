#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'), 'utf8').trimEnd().split(/\r?\n/);
lines.forEach(line => JSON.parse(line));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
if (seal.parseStatus !== 'valid' || seal.eventLines !== lines.length) throw new Error('session seal does not match parsed segment');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: 'model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger:2026-08-21',
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
    summary: 'CHECK_RESULTS.json retains bounded command outcomes and diagnostics; passing stdout was not retained.'
  },
  temporaryMaterialDeleted: {
    count: null,
    countKnown: false,
    reason: 'Focused, corrected, lineage, counterexample, contention, and verification invocations used verified temporary roots removed by selftest cleanup. No incoming specialist ZIP, user source, raw command log, screenshot, recording, external transition, identity attestation, or provider artifact was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation and schemas are review candidates on a TEST branch, not disposable session evidence.',
    'CHECK_RESULTS.json, SOURCE_SNAPSHOT.json, comparator reports, claim routes, and the sealed segment are bounded review evidence.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated repository stewardship on an isolated codex branch. Synthetic writes were limited to verified temporary roots and the reviewable worktree. No merge, promotion, CANON, provider, identity, human-review, adoption, network, other-host, external-retention, protected-storage, rollback-prevention, package-intake, or specialist-ZIP authority used.'
};
fs.writeFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt for ' + lines.length + ' sealed durable events');
