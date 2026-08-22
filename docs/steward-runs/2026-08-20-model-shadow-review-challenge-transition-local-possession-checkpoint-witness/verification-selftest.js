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

check(seal.parseStatus === 'valid' && seal.eventLines === 24 && seal.validJsonLines === 24 && events.length === 24, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'existing_threshold_witness_pattern_found'), 'existing witness pattern decision remains durable');
check(events.some(event => event.event === 'checkpoint_contract_incompatibility_reproduced'), 'checkpoint contract incompatibility remains durable');
check(events.some(event => event.event === 'threshold_signature_verification_proven'), 'threshold signature evidence remains durable');
check(events.some(event => event.event === 'fresh_process_witnessed_continuity_proven'), 'fresh-process witnessed continuity remains durable');
check(events.some(event => event.event === 'witnessed_deletion_and_replacement_detected'), 'witnessed deletion and replacement evidence remains durable');
check(events.some(event => event.event === 'self_digest_counterexample_preserved'), 'self-digest counterexample remains durable');
check(events.some(event => event.event === 'replacement_policy_counterexample_preserved'), 'replacement-policy counterexample remains durable');
check(events.some(event => event.event === 'first_focused_diagnostic_expectation_failure'), 'first focused failure remains durable');
check(events.some(event => event.event === 'first_focused_failure_corrected'), 'first focused correction remains durable');
check(events.some(event => event.event === 'second_focused_source_assertion_failure'), 'second focused failure remains durable');
check(events.some(event => event.event === 'second_focused_failure_corrected'), 'second focused correction remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(events.some(event => event.event === 'evidence_selftest_dynamic_label_failure'), 'evidence selftest failure remains durable');
check(events.some(event => event.event === 'evidence_selftest_dynamic_label_corrected'), 'evidence selftest correction remains durable');
check(events.some(event => event.event === 'derived_seal_overwrite_refused'), 'derived seal overwrite refusal remains durable');
check(events.some(event => event.event === 'stale_derived_seal_removed_for_regeneration'), 'stale derived seal removal remains durable');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 33, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 1988, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 11 && receipt.unclassifiedItems.length === 0, 'curation records eleven bounded continuity-lane cleanups and no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 18 && index.openEvidence.includes('host-trusted witness policy') && index.openEvidence.includes('caller-policy continuity and replacement prevention'), 'index preserves eighteen open broader seams');
check(sourceSnapshot.sources.length === 116 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 33 && results.summary.passed === 33, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 1988, 'focused assertion count remains exact');

console.log('\nModel Shadow local possession checkpoint witness verification evidence: PASS (' + checks + ' checks)');
