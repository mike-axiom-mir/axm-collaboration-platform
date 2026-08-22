#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const segmentPath = path.join(__dirname, 'SESSION_SEGMENT.jsonl');
const lines = fs.readFileSync(segmentPath, 'utf8').trimEnd().split(/\r?\n/);
lines.forEach(line => JSON.parse(line));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const supplementPath = path.join(__dirname, 'SESSION_SEGMENT_SUPPLEMENT.jsonl');
const supplementLines = fs.readFileSync(supplementPath, 'utf8').trimEnd().split(/\r?\n/);
supplementLines.forEach(line => JSON.parse(line));
const supplementSeal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT_SUPPLEMENT.seal.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
if (seal.parseStatus !== 'valid' || seal.eventLines !== lines.length) throw new Error('bundled session seal does not match the parsed segment');
if (supplementSeal.parseStatus !== 'valid' || supplementSeal.eventLines !== supplementLines.length) throw new Error('bundled supplemental seal does not match the parsed segment');
const receipt = {
  schema: 'axm.session-curation-receipt/v1',
  sessionId: 'model-shadow-review-challenge-transition-receiver-ack:2026-08-20',
  status: 'TEST',
  sealedSegment: 'SESSION_SEGMENT.jsonl',
  seal: 'SESSION_SEGMENT.seal.json',
  sealDigest: 'sha256:' + seal.sha256,
  supplementalSegments: [{
    segment: 'SESSION_SEGMENT_SUPPLEMENT.jsonl',
    seal: 'SESSION_SEGMENT_SUPPLEMENT.seal.json',
    sealDigest: 'sha256:' + supplementSeal.sha256,
    durableEvents: supplementLines.length
  }],
  durableEventsPreserved: lines.length + supplementLines.length,
  telemetryAggregation: {
    retainedRawLogs: false,
    commandOutcomes: results.summary.commands,
    failedCommands: results.summary.failed,
    focusedAssertions: results.summary.focusedAssertions,
    summary: 'CHECK_RESULTS.json retains commands, phases, exit codes, verdicts and bounded failure diagnostics; passing stdout was not retained.'
  },
  temporaryMaterialDeleted: {
    count: 0,
    reason: 'Focused tests own and remove synthetic temporary roots and generate private keys in memory. No raw caller package, private-key file, external receiver receipt, identity attestation, raw log, screenshot, recording, or incoming specialist ZIP was retained.'
  },
  explicitRetentionExceptions: [
    'Implementation and schemas are review candidates on a TEST branch, not disposable session evidence.',
    'CHECK_RESULTS.json, SOURCE_SNAPSHOT.json, comparator reports and the sealed segment are retained as bounded review evidence.'
  ],
  derivedViewsUpdated: ['SESSION_SUMMARY.md', 'SESSION_INDEX.json'],
  unclassifiedItems: [],
  authorityUsed: 'Delegated repository stewardship on an isolated stacked codex branch; no merge, promotion, CANON, provider, identity, human-review, execution, adoption, transport, external-retention, protected-storage, host-authorization, package-intake, or specialist-ZIP authority used.'
};
fs.writeFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt for ' + (lines.length + supplementLines.length) + ' events across two bundled sealed segments');
