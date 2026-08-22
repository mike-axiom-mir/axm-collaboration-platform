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
const events = segmentBytes.toString('utf8').trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');

check(seal.parseStatus === 'valid' && seal.eventLines === 30 && seal.validJsonLines === 30 && events.length === 30, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(events.every((event, i) => event.eventId === 'evt-' + String(i + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.some(event => event.event === 'frontier_routes_ranked'), 'frontier ranking remains durable');
check(events.some(event => event.event === 'state_machine_frozen'), 'state-machine decision remains durable');
check(events.some(event => event.event === 'receiver_policy_expiry_fixture_failure_preserved'), 'receiver-policy fixture failure remains durable');
check(events.some(event => event.event === 'witness_minute_overflow_failure_preserved'), 'witness rollover failure remains durable');
check(events.some(event => event.event === 'anchor_minute_overflow_failure_preserved'), 'anchor rollover failure remains durable');
check(events.some(event => event.event === 'reload_chronology_and_native_prewrite_checks_added'), 'reload chronology tightening remains durable');
check(events.some(event => event.event === 'pending_crash_recovery_proven'), 'pending recovery remains durable');
check(events.some(event => event.event === 'postwrite_drift_holds_proven'), 'postwrite drift holds remain durable');
check(events.some(event => event.event === 'held_transition_recovery_proven'), 'held transition recovery remains durable');
check(events.some(event => event.event === 'independent_root_counterexample_proven'), 'independent-root counterexample remains durable');
check(events.some(event => event.event === 'deletion_counterexample_proven'), 'deletion counterexample remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'verification checkpoint remains durable');
check(events.some(event => event.event === 'authority_boundary_preserved'), 'authority boundary remains durable');
check(events.some(event => event.event === 'public_builder_truth_surface_removed'), 'public builder truth-surface correction remains durable');
check(events.some(event => event.event === 'seal_overwrite_refusal_preserved'), 'seal overwrite refusal and explicit refresh remain durable');

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 36, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2523, 'curation retains exact verification counts');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No merge, promotion, CANON/.test(receipt.authorityUsed), 'curation preserves unused authority boundary');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 17, 'index preserves seventeen open seams');
check(index.openEvidence.includes('atomic source and file transaction'), 'atomic transaction remains open');
check(index.openEvidence.includes('intermediate or reverted source-change exclusion'), 'intermediate change exclusion remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');

check(sourceSnapshot.sources.length === 159 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 36 && results.summary.passed === 36 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 2523, 'focused assertion count remains exact');

console.log('\nTwo-phase settlement ledger verification evidence: PASS (' + checks + ' checks)');
