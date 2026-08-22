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
const routes = read('EVIDENCE_ROUTES.json');

check(seal.schema === 'session-seal/v1' && seal.parseStatus === 'valid', 'skill seal schema and parse status are exact');
check(seal.eventLines === 43 && seal.validJsonLines === 43 && seal.invalidJsonLines === 0 && events.length === 43, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(seal.byteLength === segmentBytes.length && seal.physicalLines === 43, 'seal byte and physical-line counts are exact');
check(seal.source === 'SESSION_SEGMENT.jsonl', 'seal stores stable source label');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v32_replacement_frontier_audited', 'specialist_zip_lane_excluded', 'global_tools_index_untouched',
  'capability_gap_before_compared', 'portable_checkpoint_adapter_selected', 'v32_single_load_read_added',
  'v32_single_load_read_verified', 'checkpoint_origin_exact_rebuild_proven',
  'checkpoint_minimized_history_committed', 'checkpoint_self_validation_proven',
  'exact_history_classified', 'forward_history_classified', 'rollback_history_classified',
  'fork_history_classified', 'identity_drift_classified', 'absence_classified',
  'invalid_ledger_and_configuration_classified', 'bracketing_movement_refused',
  'resource_and_corruption_bounds_proven', 'initial_absence_test_boundary_corrected',
  'focused_v33_verification_passed', 'durable_v32_bytes_stable',
  'fresh_process_self_validation_proven', 'origin_rebuild_after_loss_refused',
  'retained_checkpoint_rewrite_detection_proven', 'joint_replacement_counterexample_preserved',
  'runtime_authority_surface_bounded', 'optional_json_schema_meta_validator_unavailable',
  'browser_verification_not_applicable', 'human_review_identity_and_host_state_unproven',
  'retention_durability_and_origin_unproven', 'hold_resolution_benefit_learning_and_authority_unproven',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'evidence_readme_match_corrected',
  'evidence_reseal_guard_and_second_match_corrected',
  'evidence_remaining_prose_matches_corrected',
  'evidence_summary_wording_match_corrected',
  'generic_machine_path_pattern_removed',
  'source_and_session_evidence_closed'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 51, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 4520, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/transient operation locks/.test(receipt.authorityUsed), 'curation preserves transient-lock authority used');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 11, 'index preserves eleven open evidence routes');
check(index.openEvidence.includes('actual separate retention of the caller-portable checkpoint'), 'checkpoint retention remains open');
check(index.openEvidence.includes('authenticated checkpoint origin or original-history proof'), 'authenticated origin remains open');
check(index.openEvidence.includes('independent external custody or protected monotonic storage'), 'external custody remains open');
check(index.openEvidence.includes('atomic filesystem snapshot trusted time or exclusion of post-read movement'), 'atomicity and trusted time remain open');
check(index.openEvidence.includes('withheld branch exclusion global uniqueness or globally consistent log'), 'global consistency remains open');
check(index.openEvidence.includes('authenticated remediation retention-hold resolution provider evaluation human benefit or learning'), 'remediation benefit and learning remain open');
check(index.openEvidence.includes('execution adoption promotion merge Foundation mutation or CANON decision'), 'execution promotion merge Foundation and CANON remain open');
check(sourceSnapshot.sources.length === 274 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 51 && results.summary.passed === 51 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4520, 'focused assertion count remains exact');
check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes retain PASS verdicts');

console.log('\nPortable review-outcome history checkpoint verification evidence: PASS (' + checks + ' checks)');
