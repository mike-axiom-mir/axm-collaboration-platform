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
check(events.some(event => event.event === 'existing_continuity_pattern_reused'), 'existing continuity reuse decision remains durable');
check(events.some(event => event.event === 'v1.3_filename_identity_counterexample_reproduced'), 'v1.3 filename counterexample remains durable');
check(events.some(event => event.event === 'strict_filename_and_inventory_proven'), 'strict filename inventory evidence remains durable');
check(events.some(event => event.event === 'unchanged_v1.3_reload_composed'), 'unchanged v1.3 reload composition remains durable');
check(events.some(event => event.event === 'read_only_snapshot_and_checkpoint_proven'), 'read-only snapshot and checkpoint evidence remains durable');
check(events.some(event => event.event === 'fresh_process_comparison_proven'), 'fresh-process comparison evidence remains durable');
check(events.some(event => event.event === 'relative_deletion_detection_proven'), 'relative deletion detection remains durable');
check(events.some(event => event.event === 'relative_signed_replacement_detection_proven'), 'relative signed replacement detection remains durable');
check(events.some(event => event.event === 'absence_invalidity_identity_holds_proven'), 'typed hold evidence remains durable');
check(events.some(event => event.event === 'same_controller_counterevidence_preserved'), 'same-controller counterevidence remains durable');
check(events.some(event => event.event === 'focused_lineage_checkpoint_passed'), 'focused lineage checkpoint remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 32, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 1776, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 10 && receipt.unclassifiedItems.length === 0, 'curation records ten bounded synthetic-root cleanups and no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 18 && index.openEvidence.includes('independently retained checkpoint') && index.openEvidence.includes('rollback prevention'), 'index preserves eighteen open broader seams');
check(sourceSnapshot.sources.length === 107 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 32 && results.summary.passed === 32, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 1776, 'focused assertion count remains exact');

console.log('\nModel Shadow local possession continuity verification evidence: PASS (' + checks + ' checks)');
