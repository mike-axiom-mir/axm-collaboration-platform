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

const segmentBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'));
const lines = segmentBytes.toString('utf8').trimEnd().split(/\r?\n/);
const events = lines.map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');

check(seal.parseStatus === 'valid' && seal.eventLines === 24 && seal.validJsonLines === 24 && events.length === 24, 'sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'frontier_routes_ranked'), 'frontier route ranking remains durable');
check(events.some(event => event.event === 'focused_pem_normalization_failure_preserved'), 'PEM integration failure remains durable');
check(events.some(event => event.event === 'pem_boundary_corrected'), 'PEM boundary correction remains durable');
check(events.some(event => event.event === 'persisted_currentness_truth_failure_preserved'), 'currentness truth-route failure remains durable');
check(events.some(event => event.event === 'currentness_truth_route_corrected'), 'currentness truth-route correction remains durable');
check(events.some(event => event.event === 'source_currentness_counterevidence_proven'), 'source extension and rollback counterevidence remains durable');
check(events.some(event => event.event === 'independent_root_counterexample_proven'), 'independent-root counterexample remains durable');
check(events.some(event => event.event === 'deletion_counterexample_proven'), 'deletion counterexample remains durable');
check(events.some(event => event.event === 'capability_gap_after_compared'), 'capability comparison remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint remains durable');
check(events.some(event => event.event === 'authority_boundary_preserved'), 'authority boundary remains durable');

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 35, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2417, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids an invented cleanup count and leaves no unclassified item');
check(/No merge, promotion, CANON/.test(receipt.authorityUsed), 'curation receipt preserves unused authority boundary');

check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 16, 'session index preserves sixteen open broader seams');
check(index.openEvidence.includes('atomic source-capture and ledger-append binding'), 'atomic source binding remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');

check(sourceSnapshot.sources.length === 149 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 35 && results.summary.passed === 35 && results.summary.failed === 0, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 2417, 'focused assertion count remains exact');

console.log('\nLocal-possession checkpoint transition ledger verification evidence: PASS (' + checks + ' checks)');
