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

check(seal.parseStatus === 'valid' && seal.eventLines === 31 && seal.validJsonLines === 31 && events.length === 31, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(events.every((event, i) => event.eventId === 'evt-' + String(i + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v25_stateful_pin_settlement_ledger_seam_selected', 'capability_gap_before_compared', 'two_phase_settlement_contracts_frozen',
  'contract_lifecycle_vocabulary_defect_diagnosed_and_corrected', 'schema_truth_boundaries_closed',
  'ineligible_transition_preflight_no_write_proven', 'proposal_pending_settled_head_unchanged_proven',
  'fresh_process_pending_recovery_proven', 'separate_settlement_local_head_advance_proven',
  'persisted_caller_package_exact_verification_proven', 'concurrent_first_writer_resolution_proven',
  'stale_operation_lock_fails_closed', 'corruption_and_namespace_fail_closed_proven',
  'independent_root_divergence_counterexample_preserved', 'deletion_reopen_counterexample_preserved',
  'resource_path_and_symlink_boundaries_proven', 'public_artifact_minimization_proven',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'claim_routes_and_open_evidence_preserved',
  'authenticated_retention_durability_and_global_authority_remain_open', 'nonvisual_browser_boundary_recorded',
  'source_snapshot_sealed', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 41, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 3089, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /merge, or CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused authority boundary');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 19, 'index preserves nineteen open evidence routes');
check(index.openEvidence.includes('authenticated checkpoint origin or pin'), 'authenticated pin origin remains open');
check(index.openEvidence.includes('external independent retention'), 'external retention remains open');
check(index.openEvidence.includes('protected monotonic state'), 'protected monotonic state remains open');
check(index.openEvidence.includes('directory-entry or hardware power-loss durability'), 'directory and hardware durability remain open');
check(index.openEvidence.includes('global transition uniqueness'), 'global uniqueness remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');
check(sourceSnapshot.sources.length === 202 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 41 && results.summary.passed === 41 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 3089, 'focused assertion count remains exact');

console.log('\nPortable history-checkpoint pin-settlement-ledger verification evidence: PASS (' + checks + ' checks)');
