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
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v24_portable_pin_transition_seam_selected', 'capability_gap_before_compared', 'portable_pin_and_transition_contracts_frozen',
  'recheckpoint_fixture_package_count_failure_diagnosed_and_reordered', 'schema_reference_assertion_path_failure_diagnosed_and_corrected',
  'all_five_v24_classifications_exercised', 'thirteen_pin_binding_dimensions_exercised',
  'replay_hold_and_successor_eligibility_proven', 'successor_predecessor_and_generation_binding_proven',
  'retained_original_pin_exposes_joint_pair_replacement', 'joint_pin_and_pair_replacement_counterexample_preserved',
  'fresh_process_and_read_only_behavior_proven', 'assertion_aggregator_checkpoint_false_positive_repaired',
  'machine_path_scan_url_false_positive_diagnosed_and_rerun',
  'optional_json_schema_meta_validator_unavailable_no_dependency_installed',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'claim_routes_and_open_evidence_preserved',
  'authenticated_pin_retention_and_monotonic_state_remain_open', 'nonvisual_browser_boundary_recorded',
  'source_snapshot_sealed', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 40, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2920, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /merge, or CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused authority boundary');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 18, 'index preserves eighteen open evidence routes');
check(index.openEvidence.includes('authenticated checkpoint origin or pin'), 'authenticated pin origin remains open');
check(index.openEvidence.includes('external independent retention'), 'external retention remains open');
check(index.openEvidence.includes('protected monotonic state'), 'protected monotonic state remains open');
check(index.openEvidence.includes('global transition uniqueness'), 'global uniqueness remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');
check(sourceSnapshot.sources.length === 192 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 40 && results.summary.passed === 40 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 2920, 'focused assertion count remains exact');

console.log('\nPortable history-checkpoint pin-transition verification evidence: PASS (' + checks + ' checks)');
