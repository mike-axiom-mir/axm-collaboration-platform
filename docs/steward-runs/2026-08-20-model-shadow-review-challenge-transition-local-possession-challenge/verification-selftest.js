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

check(seal.parseStatus === 'valid' && seal.eventLines === 17 && seal.validJsonLines === 17 && events.length === 17, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'local_possession_challenge_leaf_added'), 'local possession challenge leaf remains durable');
check(events.some(event => event.event === 'signed_nonce_challenge_proven'), 'signed nonce challenge evidence remains durable');
check(events.some(event => event.event === 'custody_reread_and_response_fsync_proven'), 'custody reread and response fsync evidence remains durable');
check(events.some(event => event.event === 'bounded_replay_refusal_proven'), 'bounded replay refusal remains durable');
check(events.some(event => event.event === 'fresh_process_response_reload_proven'), 'fresh-process response reload remains durable');
check(events.some(event => event.event === 'public_receipt_minimization_proven'), 'public receipt minimization remains durable');
check(events.some(event => event.event === 'same_controller_counterevidence_preserved'), 'same-controller counterevidence remains durable');
check(events.some(event => event.event === 'focused_schema_inspection_failure'), 'first focused schema-inspection failure remains durable');
check(events.some(event => event.event === 'focused_schema_inspection_corrected'), 'focused schema-inspection correction remains durable');
check(events.some(event => event.event === 'post_test_source_hardening_added'), 'post-test source hardening remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 31, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 1621, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 7 && receipt.unclassifiedItems.length === 0, 'curation records seven bounded synthetic-root cleanups and no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 18 && index.openEvidence.includes('externally trusted time') && index.openEvidence.includes('deletion or rollback resistance'), 'index preserves eighteen open broader seams');
check(sourceSnapshot.sources.length === 98 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 31 && results.summary.passed === 31, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 1621, 'focused assertion count remains exact');

console.log('\nModel Shadow local possession challenge verification evidence: PASS (' + checks + ' checks)');
