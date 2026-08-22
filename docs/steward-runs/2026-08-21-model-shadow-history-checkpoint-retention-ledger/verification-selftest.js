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

check(seal.schema === 'session-seal/v1' && seal.parseStatus === 'valid', 'skill seal schema and parse status are exact');
check(seal.eventLines === 38 && seal.validJsonLines === 38 && seal.invalidJsonLines === 0 && events.length === 38, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(seal.byteLength === segmentBytes.length && seal.physicalLines === 38, 'seal byte and physical-line counts are exact');
check(seal.source === 'SESSION_SEGMENT.jsonl', 'seal stores stable source label');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v26_checkpoint_omission_frontier_audited',
  'existing_retention_hands_audited',
  'v27_local_checkpoint_retention_seam_selected',
  'capability_gap_before_compared',
  'distinct_nonnested_roots_proven',
  'exact_v26_origin_before_proposal_proven',
  'full_checkpoint_local_proposal_persistence_proven',
  'pending_observation_status_preserved',
  'separate_settlement_confirmation_proven',
  'forward_only_succession_proven',
  'non_forward_refusals_proven',
  'source_rollback_after_retention_proven',
  'source_absence_after_retention_proven',
  'fresh_process_reload_and_audit_proven',
  'concurrent_writer_exclusion_proven',
  'source_movement_between_preflight_and_lock_refused',
  'canonical_chain_and_corruption_refusals_proven',
  'no_durable_source_change_proven',
  'joint_source_and_retention_replacement_counterexample_preserved',
  'negative_truth_field_scan_overclaim_corrected',
  'side_effect_builder_export_hazard_corrected',
  'first_write_failure_path_tightened',
  'optional_json_schema_meta_validator_unavailable',
  'capability_gap_after_compared',
  'full_inherited_verification_passed',
  'source_snapshot_sealed',
  'claim_routes_and_open_evidence_preserved',
  'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 43, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 3480, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/transient source locks/.test(receipt.authorityUsed), 'curation preserves transient source-lock authority used');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /merge, or CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 19, 'index preserves nineteen open evidence routes');
check(index.openEvidence.includes('authenticated checkpoint origin or pin'), 'authenticated checkpoint origin remains open');
check(index.openEvidence.includes('external independent retention'), 'external retention remains open');
check(index.openEvidence.includes('protected monotonic state'), 'protected monotonic state remains open');
check(index.openEvidence.includes('atomic multi-file source snapshot'), 'atomic snapshot remains open');
check(index.openEvidence.includes('global transition uniqueness'), 'global uniqueness remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');
check(sourceSnapshot.sources.length === 221 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 43 && results.summary.passed === 43 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 3480, 'focused assertion count remains exact');

console.log('\nLocal history-checkpoint retention-ledger verification evidence: PASS (' + checks + ' checks)');
