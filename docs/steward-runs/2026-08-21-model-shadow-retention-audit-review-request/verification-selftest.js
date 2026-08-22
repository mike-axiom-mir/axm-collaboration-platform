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
check(seal.eventLines === 34 && seal.validJsonLines === 34 && seal.invalidJsonLines === 0 && events.length === 34, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(seal.byteLength === segmentBytes.length && seal.physicalLines === 34, 'seal byte and physical-line counts are exact');
check(seal.source === 'SESSION_SEGMENT.jsonl', 'seal stores stable source label');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v28_retained_observation_frontier_audited', 'review_inbox_surface_audited', 'direct_service_import_refused',
  'v29_data_only_bridge_selected', 'capability_gap_before_compared', 'held_observation_exact_reload_proven',
  'nonheld_and_altered_observations_refused', 'minimized_review_artifact_proven', 'artifact_candidate_digest_binding_proven',
  'runtime_submission_absent', 'synthetic_reviewservice_compatibility_proven', 'fresh_process_receiver_reload_proven',
  'pending_zero_vote_zero_discussion_proven', 'receiver_mismatch_and_state_movement_refused', 'no_durable_upstream_change_proven',
  'public_artifact_minimization_proven', 'optional_json_schema_meta_validator_unavailable', 'receiver_durability_counterevidence_preserved',
  'host_authorization_unproven', 'human_review_and_identity_unproven', 'authority_and_benefit_unproven',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'source_snapshot_sealed',
  'session_evidence_sealed', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 45, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 3869, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/transient verification lock/.test(receipt.authorityUsed), 'curation preserves transient-lock authority used');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 11, 'index preserves eleven open evidence routes');
check(index.openEvidence.includes('host API mutation authorization for a real submission'), 'host submission authorization remains open');
check(index.openEvidence.includes('authenticated reviewer identity or actual human review'), 'human review and identity remain open');
check(index.openEvidence.includes('ReviewService state-file fsync or corruption resistance'), 'receiver fsync and corruption resistance remain open');
check(index.openEvidence.includes('independent receiver operation or custody'), 'independent receiver operation remains open');
check(index.openEvidence.includes('adoption, promotion, merge, Foundation mutation, or CANON decision'), 'promotion merge Foundation and CANON remain open');
check(sourceSnapshot.sources.length === 239 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 45 && results.summary.passed === 45 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 3869, 'focused assertion count remains exact');

console.log('\nLocal retention-audit review-request verification evidence: PASS (' + checks + ' checks)');
