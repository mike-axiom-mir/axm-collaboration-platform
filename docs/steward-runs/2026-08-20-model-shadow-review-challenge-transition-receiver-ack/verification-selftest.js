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
const supplementLines = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT_SUPPLEMENT.jsonl'), 'utf8').trimEnd().split(/\r?\n/);
const supplementEvents = supplementLines.map(line => JSON.parse(line));
const supplementSeal = read('SESSION_SEGMENT_SUPPLEMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const segmentBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'));
const supplementBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT_SUPPLEMENT.jsonl'));

check(seal.parseStatus === 'valid' && seal.eventLines === 13 && seal.validJsonLines === 13 && events.length === 13, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(supplementSeal.parseStatus === 'valid' && supplementSeal.eventLines === 3 && supplementEvents.length === 3, 'supplemental segment is valid and complete');
check(crypto.createHash('sha256').update(supplementBytes).digest('hex') === supplementSeal.sha256, 'supplemental seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'receiver_acknowledgement_leaf_added'), 'receiver-acknowledgement leaf remains a durable event');
check(events.some(event => event.event === 'signed_acknowledgement_binding_proven'), 'signature binding evidence remains durable');
check(events.some(event => event.event === 'threshold_and_incomplete_hold_proven'), 'threshold and incomplete hold evidence remains durable');
check(events.some(event => event.event === 'same_process_multikey_counterevidence_preserved'), 'same-process counterevidence remains durable');
check(events.some(event => event.event === 'canonical_pem_fixture_failure'), 'corrected canonical PEM failure remains durable');
check(events.some(event => event.event === 'canonical_pem_validation_corrected'), 'canonical PEM correction remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(supplementEvents.some(event => event.event === 'evidence_readme_predicate_failure'), 'post-seal evidence predicate failure remains durable');
check(supplementEvents.some(event => event.event === 'evidence_package_selftest_passed'), 'corrected evidence package pass remains durable');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length + supplementEvents.length, 'curation receipt binds primary seal and total event count');
check(receipt.supplementalSegments.length === 1 && receipt.supplementalSegments[0].sealDigest === 'sha256:' + supplementSeal.sha256, 'curation receipt binds exact supplemental seal');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 29, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 1308, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 0 && receipt.unclassifiedItems.length === 0, 'curation makes no unsupported deletion and leaves no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.supplementalSegments.length === 1 && index.supplementalSegments[0].seal === 'SESSION_SEGMENT_SUPPLEMENT.seal.json', 'session index resolves supplemental seal');
check(index.openEvidence.length === 18 && index.openEvidence.includes('actual transport delivery') && index.openEvidence.includes('learning'), 'index preserves eighteen open transport authority human and outcome seams');
check(sourceSnapshot.sources.length === 77 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 29 && results.summary.passed === 29, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 1308, 'focused assertion count remains exact');

console.log('\nModel Shadow review challenge transition receiver acknowledgement verification evidence: PASS (' + checks + ' checks)');
