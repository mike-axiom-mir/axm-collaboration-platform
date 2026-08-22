#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const lines = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), 'utf8').trimEnd().split(/\r?\n/);
const events = lines.map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');

const segmentBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'));
check(seal.parseStatus === 'valid' && seal.eventLines === 12 && events.length === 12, 'sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'continuity_leaf_added') && events.some(event => event.event === 'fresh_process_comparisons_proven'), 'continuity leaf and independent-process comparisons remain durable');
check(events.some(event => event.event === 'deletion_and_replacement_counterevidence_preserved'), 'deletion and replacement counterevidence remains durable');
check(events.some(event => event.event === 'observer_authority_boundary_hardened'), 'observer-origin, time, and authority boundaries remain durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint is appended after the pending event');
check(events.some(event => event.event === 'absence_counterevidence_enriched'), 'whole-state missing-challenge counterevidence and rerun remain append-only durable evidence');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds the seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.temporaryMaterialDeleted.count === 0, 'curation retains compact evidence without raw log or capture claims');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves the sealed TEST evidence');
check(index.openEvidence.length === 10 && index.openEvidence.includes('actual external checkpoint retention') && index.openEvidence.includes('learning'), 'index preserves ten protected, authority, human and outcome seams');
check(sourceSnapshot.sources.length === 15 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 21 && results.summary.passed === 21, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 471, 'focused assertion count remains exact');

console.log('\nModel Shadow review challenge continuity verification evidence: PASS (' + checks + ' checks)');
