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

check(seal.parseStatus === 'valid' && seal.eventLines === 14 && seal.validJsonLines === 14 && events.length === 14, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'declared_disclosure_leaf_added'), 'declared-disclosure leaf remains a durable event');
check(events.some(event => event.event === 'missing_and_mismatched_commitments_proven'), 'missing and mismatch evidence remains durable');
check(events.some(event => event.event === 'all_pairs_reconciliation_proven'), 'all-pairs reconciliation remains durable');
check(events.some(event => event.event === 'maximum_pair_bound_proven'), 'maximum pair bound remains durable');
check(events.some(event => event.event === 'unlisted_root_counterevidence_preserved'), 'unlisted-root counterevidence remains durable');
check(events.some(event => event.event === 'expanded_bound_test_fixture_failure'), 'corrected fixture failure remains durable');
check(events.some(event => event.event === 'fixture_failure_corrected_and_focused_suite_passed'), 'fixture correction and focused pass remain durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 28, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 1174, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 0 && receipt.unclassifiedItems.length === 0, 'curation makes no unsupported deletion and leaves no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 16 && index.openEvidence.includes('authenticated append-only root registry') && index.openEvidence.includes('learning'), 'index preserves sixteen open global authority human and outcome seams');
check(sourceSnapshot.sources.length === 68 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 28 && results.summary.passed === 28, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 1174, 'focused assertion count remains exact');

console.log('\nModel Shadow review challenge transition declared disclosure verification evidence: PASS (' + checks + ' checks)');
