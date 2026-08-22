#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const segmentPath = path.join(__dirname, 'SESSION_SEGMENT.jsonl');
const lines = fs.readFileSync(segmentPath, 'utf8').trimEnd().split(/\r?\n/);
lines.forEach(line => JSON.parse(line));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
if (seal.parseStatus !== 'valid' || seal.eventLines !== lines.length) throw new Error('bundled session seal does not match the parsed segment');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: 'model-shadow-review-challenge-transition-local-possession-continuity:2026-08-20',
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
    summary: 'CHECK_RESULTS.json retains commands, phases, exit codes, verdicts and bounded failure diagnostics; passing stdout was not retained.'
  },
  temporaryMaterialDeleted: {
    count: 10,
    reason: 'One filename-identity diagnostic root, five pre-verification focused/lineage roots and four full-verification roots in the v1.4/v1.3/v1.2/older-continuity lane were removed by their verified finally cleanup. No user source, raw command log, screenshot, recording, external checkpoint, independent receiver state, identity attestation or incoming specialist ZIP was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation and schemas are review candidates on a TEST branch, not disposable session evidence.',
    'CHECK_RESULTS.json, SOURCE_SNAPSHOT.json, comparator reports and the sealed segment are retained as bounded review evidence.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated repository stewardship on an isolated stacked codex branch; synthetic writes were limited to verified temporary roots and the explicit reviewable worktree. No merge, promotion, CANON, provider, identity, human-review, adoption, network, other-host, external-retention, protected-storage, rollback-prevention, package-intake or specialist-ZIP authority used.'
};
fs.writeFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt for ' + lines.length + ' bundled-sealed durable events');
