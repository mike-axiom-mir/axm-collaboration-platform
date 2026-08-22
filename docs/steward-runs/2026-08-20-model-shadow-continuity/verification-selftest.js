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
check(seal.parseStatus === 'valid' && seal.eventLines === 7 && events.length === 7, 'sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'truth_boundary_decided') && events.some(event => event.event === 'open_evidence_preserved'), 'truth boundary and open evidence remain durable');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds the seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.temporaryMaterialDeleted.count === 0, 'curation retains compact evidence without raw log or capture claims');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves the sealed TEST evidence');
check(index.openEvidence.length === 4 && index.openEvidence.includes('model-learning improvement'), 'index preserves four unrun evidence seams');
check(sourceSnapshot.sources.length === 8 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');

const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 17 && results.summary.passed === 17, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 260, 'focused assertion count remains exact');

console.log('\nModel Shadow Continuity verification evidence: PASS (' + checks + ' checks)');
