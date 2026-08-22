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

const bytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'));
const events = bytes.toString('utf8').trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sources = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const routes = read('EVIDENCE_ROUTES.json');

check(seal.schema === 'session-seal/v1' && seal.parseStatus === 'valid', 'seal schema and parse status are exact');
check(seal.invalidJsonLines === 0 && seal.eventLines === events.length && seal.validJsonLines === events.length, 'sealed segment is fully valid');
check(crypto.createHash('sha256').update(bytes).digest('hex') === seal.sha256, 'seal matches exact session bytes');
check(seal.byteLength === bytes.length && seal.physicalLines === events.length, 'seal byte and line counts are exact');
check(events.length === 42, 'segment retains forty-two semantic events');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events retain TEST and untrusted-time boundaries');
[
  'specialist_zip_lane_excluded', 'foreign_worktrees_and_global_index_untouched', 'capability_gap_before_compared',
  'first_focused_fixture_shape_failure_preserved', 'second_focused_fixture_time_failure_preserved',
  'third_focused_rollback_expectation_failure_preserved', 'fourth_focused_namespace_failure_preserved',
  'post_green_settlement_truth_gap_found', 'settlement_truth_narrowed', 'all_held_classifications_added',
  'post_green_capture_state_gap_found', 'capture_state_model_added', 'focused_final_green',
  'source_advance_between_phases_verified', 'concurrency_and_lock_boundaries_verified', 'fsync_uncertainty_verified',
  'independent_root_counterexample_preserved', 'joint_replacement_counterexample_preserved',
  'capability_comparator_path_failure_preserved', 'capability_comparator_path_corrected',
  'optional_schema_validator_unavailable', 'browser_verification_not_applicable', 'full_inherited_verification_passed',
  'authority_retention_and_benefit_boundaries_preserved', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 55, 'curation retains outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 5134, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 12, 'index preserves twelve open evidence routes');
check(index.openEvidence.includes('actual external retention or independent custody of local source settlement state or upstream packages'), 'external retention remains open');
check(index.openEvidence.includes('protected monotonic storage rollback prevention or a globally consistent settlement log'), 'monotonic storage and consistency remain open');
check(index.openEvidence.includes('atomic source observation and settlement write or postwrite source currentness'), 'atomicity and postwrite currentness remain open');
check(index.openEvidence.includes('directory-entry hardware or power-loss durability'), 'hardware durability remains open');
check(index.openEvidence.includes('human benefit or learning proof'), 'benefit and learning remain open');
check(index.openEvidence.includes('execution adoption promotion merge Foundation mutation or CANON decision'), 'consequential authority remains open');

check(sources.sources.length === 312 && sources.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 55 && results.summary.passed === 55 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5134, 'focused assertion count remains exact');
check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five evidence routes retain PASS verdicts');

console.log('\nTransition-settlement verification evidence: PASS (' + checks + ' checks)');
