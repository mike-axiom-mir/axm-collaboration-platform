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
const visual = read('VISUAL_RECEIPT.json');

check(seal.schema === 'session-seal/v1' && seal.parseStatus === 'valid', 'skill seal schema and parse status are exact');
check(seal.eventLines === 34 && seal.validJsonLines === 34 && seal.invalidJsonLines === 0 && events.length === 34, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(seal.byteLength === segmentBytes.length && seal.physicalLines === 34, 'seal byte and physical-line counts are exact');
check(seal.source === 'SESSION_SEGMENT.jsonl', 'seal stores a stable source label');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v29_review_request_frontier_audited', 'caller_directed_server_file_read_refused', 'v30_read_only_view_selected',
  'capability_gap_before_compared', 'strict_v29_shape_detection_proven', 'browser_canonical_digest_binding_proven',
  'malformed_oversized_and_inflated_items_held', 'raw_json_evidence_preserved', 'generic_review_nondisruption_proven',
  'stale_async_selection_ignored', 'desktop_exact_journey_observed', 'desktop_mismatch_journey_observed',
  'narrow_exact_journey_observed', 'rapid_selection_journey_observed', 'fullpage_sticky_capture_counterevidence_preserved',
  'read_only_visual_harness_proven', 'visual_temporary_material_cleaned', 'raw_visual_frames_not_retained',
  'global_tools_index_rewrite_refused', 'no_new_mutation_route_proven', 'assistive_technology_audit_unproven',
  'human_review_and_identity_unproven', 'authority_benefit_and_learning_unproven', 'capability_gap_after_compared',
  'full_inherited_verification_passed', 'source_snapshot_sealed', 'visual_receipt_recorded',
  'session_evidence_sealed', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.retainedRawBrowserTelemetry === false, 'curation retains no raw logs or browser telemetry');
check(receipt.telemetryAggregation.commandOutcomes === 48 && receipt.telemetryAggregation.failedCommands === 0, 'curation retains exact command outcomes');
check(receipt.telemetryAggregation.focusedAssertions === 4062, 'curation retains exact focused assertion count');
check(receipt.temporaryMaterialDeleted.browserScreenshotBuffers === 6 && receipt.temporaryMaterialDeleted.browserDomSnapshotBuffers === 3, 'curation records nine deleted browser buffers by class');
check(receipt.temporaryMaterialDeleted.localHarnessStateRoots === 1 && receipt.temporaryMaterialDeleted.browserTabs === 1, 'curation records harness and tab cleanup');
check(receipt.temporaryMaterialDeleted.screenshotsRetained === false && receipt.unclassifiedItems.length === 0, 'curation retains no screenshot or unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.visualReceipt === 'VISUAL_RECEIPT.json', 'index resolves sealed TEST and visual evidence');
check(index.openEvidence.length === 8, 'index preserves eight open evidence routes');
check(index.openEvidence.includes('coordinated global tools-index refresh without unrelated receipt churn'), 'shared tools-index refresh remains open');
check(index.openEvidence.includes('authenticated reviewer identity or actual human review'), 'human review and identity remain open');
check(index.openEvidence.includes('assistive-technology compatibility audit'), 'assistive-technology compatibility remains open');
check(index.openEvidence.includes('adoption, promotion, merge, Foundation mutation, or CANON decision'), 'consequential authority remains open');
check(visual.harness.temporaryReviewStateRemoved && visual.harness.browserTabClosed && visual.harness.viewportOverrideReset, 'visual receipt records bounded cleanup');
check(visual.retention.screenshotsRetained === false && visual.counterevidence.length === 3, 'visual receipt retains boundaries without frame bytes');
check(sourceSnapshot.sources.length === 251 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 48 && results.summary.passed === 48 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4062, 'focused assertion count remains exact');

console.log('\nLocal retention-audit Review Inbox view verification evidence: PASS (' + checks + ' checks)');
