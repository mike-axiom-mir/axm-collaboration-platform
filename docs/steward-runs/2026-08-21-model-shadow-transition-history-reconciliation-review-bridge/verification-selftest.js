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
const addendumBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT_ADDENDUM.jsonl'));
const addendumEvents = addendumBytes.toString('utf8').trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const addendumSeal = read('SESSION_SEGMENT_ADDENDUM.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sources = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const routes = read('EVIDENCE_ROUTES.json');
const visual = read('VISUAL_RECEIPT.json');

check(seal.schema === 'session-seal/v1' && seal.parseStatus === 'valid', 'seal schema and parse status are exact');
check(seal.invalidJsonLines === 0 && seal.eventLines === events.length && seal.validJsonLines === events.length, 'sealed segment is fully valid');
check(crypto.createHash('sha256').update(bytes).digest('hex') === seal.sha256, 'seal matches exact session bytes');
check(seal.byteLength === bytes.length && seal.physicalLines === events.length, 'seal byte and line counts are exact');
check(events.length === 48, 'segment retains forty-eight semantic events');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events retain TEST and untrusted-time boundaries');
check(addendumSeal.schema === 'session-seal/v1' && addendumSeal.parseStatus === 'valid' && addendumSeal.invalidJsonLines === 0, 'addendum seal is valid');
check(crypto.createHash('sha256').update(addendumBytes).digest('hex') === addendumSeal.sha256, 'addendum seal matches exact continuation bytes');
check(addendumEvents.length === 8 && addendumSeal.eventLines === 8 && addendumSeal.byteLength === addendumBytes.length, 'addendum retains eight exact events');
check(addendumEvents.every((event, index) => event.eventId === 'evt-' + String(index + 49).padStart(3, '0')), 'addendum event identifiers continue primary order');
check(addendumEvents.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'addendum retains TEST and untrusted-time boundaries');
[
  'stable_workspace_snapshot_observed','specialist_zip_lane_excluded','foreign_worktrees_and_global_index_untouched',
  'review_inbox_contract_audited','human_context_capability_gap_found','bounded_review_bridge_selected',
  'v39_exact_rebuild_required','divergence_only_admission_added','minimized_reconciliation_artifact_added',
  'zero_reconciliation_action_added','synthetic_receiver_compatibility_verified','bridge_focused_green',
  'browser_renderer_added','renderer_corruption_suite_green','multi_renderer_routing_added',
  'review_inbox_v04_contract_updated','shared_ui_regressions_green','read_only_visual_harness_started',
  'unsupported_networkidle_wait_observed','browser_exact_selection_verified','browser_mismatch_selection_verified',
  'legacy_and_generic_browser_paths_verified','rapid_selection_stale_result_guard_verified','narrow_layout_verified',
  'browser_console_clean','visual_harness_cleanup_verified','temporary_frames_curated',
  'static_evidence_generator_syntax_failure_found','static_evidence_generator_corrected',
  'capability_gap_before_compared','capability_gap_after_compared','full_inherited_verification_passed',
  'required_agents_checks_passed','independent_schema_validator_unavailable','authority_identity_reconciliation_boundaries_preserved',
  'reviewable_branch_and_lane_boundaries_preserved','mike_merge_and_canon_gate_preserved','broad_grounded_growth_goal_remains_active'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
[
  'evidence_selftest_renderer_boundary_phrase_mismatch_found','evidence_selftest_renderer_boundary_phrase_corrected',
  'evidence_selftest_renderer_label_mismatch_found','evidence_selftest_renderer_label_corrected',
  'frontier_boundary_assertion_phrase_mismatch_found','frontier_boundary_made_explicit',
  'evidence_selftest_final_green','verification_evidence_selftest_green'
].forEach(name => check(addendumEvents.some(event => event.event === name), name + ' remains durable in continuation'));

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length + addendumEvents.length, 'curation receipt binds primary seal and total event count');
check(receipt.continuationSegments.length === 1 && receipt.continuationSegments[0].sealDigest === 'sha256:' + addendumSeal.sha256 && receipt.continuationSegments[0].durableEventsPreserved === addendumEvents.length, 'curation receipt binds append-only continuation seal');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 59, 'curation retains outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 5708, 'curation retains exact verification totals');
check(receipt.telemetryAggregation.rawBrowserTelemetryRetained === false, 'curation retains no raw browser telemetry');
check(receipt.temporaryMaterialDeleted.inMemoryScreenshotBuffersCleared === 7 && receipt.temporaryMaterialDeleted.selectedScreenshotDigestsRetained === 5, 'curation records temporary frame cleanup and selected digests');
check(receipt.temporaryMaterialDeleted.visualHarnessRootsRemoved === 1 && receipt.temporaryMaterialDeleted.browserTabsClosed === 1 && receipt.temporaryMaterialDeleted.viewportOverridesReset === 1, 'curation records harness tab and viewport cleanup');
check(receipt.unclassifiedItems.length === 0 && receipt.explicitRetentionExceptions.length === 0, 'curation has no unclassified or exceptional retention');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.continuationSegments.length === 1 && index.continuationSegments[0].seal === 'SESSION_SEGMENT_ADDENDUM.seal.json', 'index resolves append-only continuation seal');
check(index.visualReceipt === 'VISUAL_RECEIPT.json', 'index resolves visual receipt separately');
check(index.openEvidence.length === 11, 'index preserves eleven open evidence routes');
check(index.openEvidence.includes('live host submission independent receiver reload and external retention'), 'live submission and retention remain open');
check(index.openEvidence.includes('authenticated submitter reviewer steward controller policy or real-world identity'), 'authenticated identity remains open');
check(index.openEvidence.includes('actual human review or participation'), 'actual human review remains open');
check(index.openEvidence.includes('authenticated steward reconciliation and recorded reconciliation result'), 'authenticated reconciliation remains open');
check(index.openEvidence.includes('atomic current capture later currentness independent custody protected monotonic storage or globally consistent history'), 'custody and globality remain open');
check(index.openEvidence.includes('human benefit or learning proof'), 'benefit and learning remain open');
check(index.openEvidence.includes('execution adoption promotion merge Foundation mutation or CANON decision'), 'consequential authority remains open');
check(index.openEvidence.includes('independent Draft 2020-12 schema meta-validation'), 'independent schema validation remains open');
check(index.openEvidence.includes('assistive-technology compatibility or human usability study'), 'assistive technology and usability remain open');

check(sources.sources.length === 335 && sources.sources.every(item => { const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n'); return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex'); }), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 59 && results.summary.passed === 59 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5708, 'focused assertion count remains exact');
check(routes.routes.length === 6 && routes.routes.every(route => route.verdict === 'PASS'), 'all six evidence routes retain PASS verdicts');
check(visual.status === 'PASS' && visual.harness.temporaryReviewStateRemoved && visual.retention.screenshotsRetained === false, 'visual receipt remains PASS and curated');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'sealed evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'sealed evidence JSON contains no credential pattern');

console.log('\nTransition-history reconciliation-review verification evidence: PASS (' + checks + ' checks)');
