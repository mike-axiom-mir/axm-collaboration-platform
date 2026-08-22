#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const segmentPath = path.join(__dirname, 'SESSION_SEGMENT.jsonl');
const lines = fs.readFileSync(segmentPath, 'utf8').trimEnd().split(/\r?\n/);
lines.forEach(line => JSON.parse(line));
const bytes = fs.readFileSync(segmentPath);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
const seal = {
  schema: 'axm.session-segment-seal/v1',
  segment: 'SESSION_SEGMENT.jsonl',
  parseStatus: 'valid',
  eventLines: lines.length,
  byteLength: bytes.length,
  sha256,
  sealedAt: new Date().toISOString(),
  status: 'TEST'
};
fs.writeFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), JSON.stringify(seal, null, 2) + '\n', 'utf8');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: 'model-shadow-review-challenge-transition-reconciliation:2026-08-20',
  status: 'TEST',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  seal: 'SESSION_SEGMENT.seal.json',
  sealDigest: 'sha256:' + sha256,
  durableEventsPreserved: lines.length,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    summary: 'CHECK_RESULTS.json retains commands, phases, exit codes, verdicts and bounded failure diagnostics; passing stdout was not retained.'
  },
  temporaryMaterialDeleted: {
    count: 0,
    reason: 'Focused tests own and remove synthetic challenge roots, generated private keys, and serialized reconciliation packages. No raw caller package, screenshot, recording, raw log, private-key file, external receiver receipt, identity attestation, human review artifact, or incoming specialist ZIP was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation and schemas are review candidates on a TEST branch, not disposable session evidence.',
    'CHECK_RESULTS.json, SOURCE_SNAPSHOT.json, comparator reports and the sealed segment are retained as bounded review evidence.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated repository stewardship on an isolated stacked codex branch; no merge, promotion, CANON, provider, identity, human-review, execution, adoption, protected-storage, global-log, compelled-disclosure, external-retention, host-authorization, package-intake, or specialist-ZIP authority used.'
};
fs.writeFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS sealed ' + lines.length + ' durable events and wrote the curation receipt');
