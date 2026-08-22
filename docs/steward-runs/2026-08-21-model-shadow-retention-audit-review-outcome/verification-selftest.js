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
check(seal.eventLines === 32 && seal.validJsonLines === 32 && seal.invalidJsonLines === 0 && events.length === 32, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(seal.byteLength === segmentBytes.length && seal.physicalLines === 32, 'seal byte and physical-line counts are exact');
check(seal.source === 'SESSION_SEGMENT.jsonl', 'seal stores stable source label');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v30_review_view_frontier_audited', 'specialist_zip_lane_excluded', 'capability_gap_before_compared',
  'v31_data_only_outcome_leaf_selected', 'approved_outcome_observed', 'held_outcome_observed',
  'rejected_outcome_observed', 'immutable_transition_binding_proven', 'vote_integrity_proven',
  'pseudonymous_minimization_proven', 'standalone_actor_digest_provenance_limit_discovered',
  'exact_rebuild_provenance_boundary_added', 'contract_lifecycle_failure_corrected',
  'state_vote_contradictions_refused', 'authority_inflation_refused', 'fresh_process_rebuild_proven',
  'source_and_receiver_bytes_stable', 'runtime_authority_absent', 'resource_bounds_proven',
  'optional_json_schema_meta_validator_unavailable',
  'browser_verification_not_applicable', 'global_tools_index_untouched',
  'human_review_identity_and_host_state_unproven', 'hold_resolution_benefit_and_learning_unproven',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'source_snapshot_sealed',
  'session_segment_closed_for_sealing', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 49, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 4224, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/transient operation lock/.test(receipt.authorityUsed), 'curation preserves transient-lock authority used');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 10, 'index preserves ten open evidence routes');
check(index.openEvidence.includes('live host observation of a persisted Review Inbox outcome'), 'live host observation remains open');
check(index.openEvidence.includes('standalone actor-digest provenance without exact caller-package rebuild'), 'standalone actor-digest provenance remains open');
check(index.openEvidence.includes('authenticated reviewer identity or actual human review'), 'human review and identity remain open');
check(index.openEvidence.includes('authenticated steward remediation decision or retention-hold resolution'), 'remediation and hold resolution remain open');
check(index.openEvidence.includes('independent Draft 2020-12 schema meta-validation'), 'independent schema meta-validation remains open');
check(index.openEvidence.includes('adoption, execution, promotion, merge, Foundation mutation, or CANON decision'), 'execution promotion merge Foundation and CANON remain open');
check(sourceSnapshot.sources.length === 258 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 49 && results.summary.passed === 49 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4224, 'focused assertion count remains exact');

console.log('\nLocal retention-audit review-outcome verification evidence: PASS (' + checks + ' checks)');
