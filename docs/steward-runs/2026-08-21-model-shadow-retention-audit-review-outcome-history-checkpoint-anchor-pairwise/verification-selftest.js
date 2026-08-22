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
check(events.length === 34, 'segment retains thirty-four semantic events');
check(events.every((event, index) => event.eventId === 'evt-' + String(index + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events retain TEST and untrusted-time boundaries');
[
  'specialist_zip_lane_excluded', 'foreign_worktrees_and_global_index_untouched', 'promoted_trust_root_absent',
  'capability_gap_before_compared', 'same_next_epoch_counterexample_preserved', 'withheld_branch_counterexample_preserved',
  'joint_pair_replacement_counterexample_preserved', 'first_focused_classifier_failure_preserved',
  'strict_prefix_predicate_corrected', 'post_green_snapshot_coherence_gap_found', 'inverse_snapshot_history_hold_added',
  'optional_schema_validator_unavailable', 'browser_verification_not_applicable',
  'full_inherited_verification_passed', 'authority_and_benefit_boundaries_preserved',
  'evidence_readme_matcher_first_correction_failed', 'evidence_readme_matcher_second_correction',
  'evidence_frontier_matcher_corrected', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 53, 'curation retains outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 4829, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused consequential authority');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 11, 'index preserves eleven open evidence routes');
check(index.openEvidence.includes('authenticated witness or anchor policy authority'), 'policy authority remains open');
check(index.openEvidence.includes('real-world signer identity actual human participation or independent controllers'), 'identity and controller independence remain open');
check(index.openEvidence.includes('actual separate retention of either checkpoint package or transition receipt'), 'separate retention remains open');
check(index.openEvidence.includes('withheld branch exclusion global transition uniqueness or globally consistent log'), 'withheld branches and global consistency remain open');
check(index.openEvidence.includes('human benefit or learning proof'), 'benefit and learning remain open');
check(index.openEvidence.includes('execution adoption promotion merge Foundation mutation or CANON decision'), 'consequential authority remains open');

check(sources.sources.length === 293 && sources.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 53 && results.summary.passed === 53 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4829, 'focused assertion count remains exact');
check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five evidence routes retain PASS verdicts');

console.log('\nAnchored pairwise checkpoint verification evidence: PASS (' + checks + ' checks)');
