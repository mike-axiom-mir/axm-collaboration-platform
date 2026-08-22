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
  'v31_ephemeral_outcome_frontier_audited', 'specialist_zip_lane_excluded', 'capability_gap_before_compared',
  'minimized_outcome_only_storage_selected', 'v32_local_append_only_ledger_selected',
  'explicit_confirmation_and_exact_rebuild_proven', 'root_separation_proven', 'approved_outcome_persisted',
  'held_outcome_persisted', 'rejected_outcome_persisted', 'contiguous_digest_chain_proven',
  'duplicate_and_time_refusal_proven', 'concurrent_writer_exclusion_proven', 'ordinary_corruption_refused',
  'resource_bounds_proven', 'fresh_process_reload_proven', 'reload_after_upstream_loss_proven',
  'actor_digest_reload_boundary_preserved', 'full_local_rewrite_counterexample_preserved',
  'replacement_manifest_identity_counterexample_preserved', 'joint_loss_counterexample_preserved',
  'evidence_route_rewrite_contradiction_corrected', 'durable_upstream_bytes_stable',
  'runtime_authority_surface_bounded', 'optional_json_schema_meta_validator_unavailable',
  'browser_verification_not_applicable', 'global_tools_index_untouched',
  'human_review_identity_and_host_state_unproven', 'external_custody_and_hardware_durability_unproven',
  'hold_resolution_benefit_learning_and_authority_unproven', 'capability_gap_after_compared',
  'full_inherited_verification_passed', 'source_snapshot_sealed', 'session_segment_closed_for_sealing',
  'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 50, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 4381, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/transient operation lock/.test(receipt.authorityUsed), 'curation preserves transient-lock authority used');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 11, 'index preserves eleven open evidence routes');
check(index.openEvidence.includes('live host observation of persisted Review Inbox outcomes'), 'live host observation remains open');
check(index.openEvidence.includes('raw actor-digest provenance re-verification after capture input loss'), 'reload actor provenance remains open');
check(index.openEvidence.includes('independent external custody'), 'external custody remains open');
check(index.openEvidence.includes('protected monotonic storage or full local rewrite detection'), 'protected monotonic storage remains open');
check(index.openEvidence.includes('directory-entry device hardware cache or power-loss durability'), 'hardware durability remains open');
check(index.openEvidence.includes('authenticated steward remediation decision or retention-hold resolution'), 'remediation and hold resolution remain open');
check(index.openEvidence.includes('adoption execution promotion merge Foundation mutation or CANON decision'), 'execution promotion merge Foundation and CANON remain open');
check(sourceSnapshot.sources.length === 267 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 50 && results.summary.passed === 50 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4381, 'focused assertion count remains exact');

console.log('\nLocal retention-audit review-outcome-ledger verification evidence: PASS (' + checks + ' checks)');
