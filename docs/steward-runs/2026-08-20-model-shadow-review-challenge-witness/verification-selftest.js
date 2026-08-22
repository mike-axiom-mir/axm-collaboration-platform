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
check(seal.parseStatus === 'valid' && seal.eventLines === 13 && events.length === 13, 'sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'checkpoint_witness_leaf_added'), 'checkpoint witness leaf remains a durable event');
check(events.some(event => event.event === 'focused_assertion_failure_preserved'), 'focused assertion failure and repair remain durable');
check(events.some(event => event.event === 'policy_substitution_counterevidence_preserved'), 'caller-policy substitution counterevidence remains durable');
check(events.some(event => event.event === 'fresh_process_witnessed_continuity_proven'), 'fresh-process witnessed continuity remains durable');
check(events.some(event => event.event === 'privacy_boundary_hardened'), 'digested attestation-id hardening remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint is appended after implementation events');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds the seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.temporaryMaterialDeleted.count === 0, 'curation retains compact evidence without raw log or capture claims');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves the sealed TEST evidence');
check(index.openEvidence.length === 11 && index.openEvidence.includes('host-promoted checkpoint witness trust root') && index.openEvidence.includes('learning'), 'index preserves eleven protected, authority, human and outcome seams');
check(sourceSnapshot.sources.length === 20 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 22 && results.summary.passed === 22, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 561, 'focused assertion count remains exact');

console.log('\nModel Shadow review challenge checkpoint witness verification evidence: PASS (' + checks + ' checks)');
