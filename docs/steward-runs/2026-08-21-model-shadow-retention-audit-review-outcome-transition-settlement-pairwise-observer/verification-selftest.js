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
check(events.length === 36, 'segment retains thirty-six semantic events');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events retain TEST and untrusted-time boundaries');
[
  'stable_workspace_snapshot_observed', 'specialist_zip_lane_excluded', 'foreign_worktrees_and_global_index_untouched',
  'independent_schema_validator_checked_unavailable', 'capability_gap_before_compared', 'focused_initial_green',
  'post_green_exactness_and_surface_gap_found', 'exactness_and_surface_truth_narrowed', 'focused_second_green',
  'post_green_different_head_overclaim_found', 'same_epoch_and_unresolved_epoch_split', 'focused_final_green',
  'all_side_and_pairwise_classifications_verified', 'same_epoch_contradiction_verified', 'different_epoch_relation_unresolved_verified',
  'fresh_process_and_read_only_behavior_verified', 'withheld_frontier_counterexample_preserved', 'joint_pair_replacement_counterexample_preserved',
  'browser_verification_not_applicable', 'full_inherited_verification_passed', 'authority_retention_and_benefit_boundaries_preserved',
  'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 56, 'curation retains outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 5237, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 13, 'index preserves thirteen open evidence routes');
check(index.openEvidence.includes('complete proposal and settlement history comparison'), 'complete history comparison remains open');
check(index.openEvidence.includes('live v3.6 source recapture and source-entry currentness'), 'live source currentness remains open');
check(index.openEvidence.includes('authenticated independent roots controllers host actors humans policies or origins'), 'authenticated independence remains open');
check(index.openEvidence.includes('atomic two-root observation or later currentness'), 'atomicity remains open');
check(index.openEvidence.includes('withheld frontier exclusion global uniqueness or globally consistent log'), 'globality remains open');
check(index.openEvidence.includes('independent Draft 2020-12 schema meta-validation'), 'independent schema validation remains open');
check(index.openEvidence.includes('human benefit or learning proof'), 'benefit and learning remain open');
check(index.openEvidence.includes('execution adoption promotion merge Foundation mutation or CANON decision'), 'consequential authority remains open');

check(sources.sources.length === 319 && sources.sources.every(item => { const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n'); return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex'); }), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 56 && results.summary.passed === 56 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5237, 'focused assertion count remains exact');
check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five evidence routes retain PASS verdicts');

console.log('\nSettlement pairwise-observer verification evidence: PASS (' + checks + ' checks)');
