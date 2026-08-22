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

check(seal.parseStatus === 'valid' && seal.eventLines === 39 && seal.validJsonLines === 39 && events.length === 39, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(events.every((event, i) => event.eventId === 'evt-' + String(i + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.some(event => event.event === 'frontier_routes_ranked'), 'frontier ranking remains durable');
check(events.some(event => event.event === 'relative_detection_state_machine_frozen'), 'relative state-machine decision remains durable');
check(events.some(event => event.event === 'capability_gap_before_compared'), 'before capability comparison remains durable');
check(events.some(event => event.event === 'staged_truth_review_found_validator_gap'), 'staged validator finding remains durable');
check(events.some(event => event.event === 'audit_validator_presence_and_count_invariants_added'), 'validator correction remains durable');
check(events.some(event => event.event === 'two_read_movement_adversary_added'), 'movement adversary remains durable');
check(events.some(event => event.event === 'strict_relative_rollback_proven'), 'relative rollback result remains durable');
check(events.some(event => event.event === 'same_identity_replacement_or_fork_proven'), 'replacement or fork result remains durable');
check(events.some(event => event.event === 'joint_checkpoint_and_root_replacement_counterexample_proven'), 'joint-replacement counterexample remains durable');
check(events.some(event => event.event === 'absence_and_invalidity_separated'), 'absence and invalidity separation remains durable');
check(events.some(event => event.event === 'fresh_process_rebuild_proven'), 'fresh-process rebuild remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'verification checkpoint remains durable');
check(events.some(event => event.event === 'authority_boundary_preserved'), 'authority boundary remains durable');
check(events.some(event => event.event === 'browser_scope_recorded'), 'nonvisual browser boundary remains durable');
check(events.some(event => event.event === 'staged_invalidity_configuration_ambiguity_found'), 'invalidity/configuration ambiguity finding remains durable');
check(events.some(event => event.event === 'invalidity_classification_widened_and_configuration_refusal_added'), 'ambiguous invalidity correction remains durable');
check(events.some(event => event.event === 'capability_report_overwrite_refusal_preserved'), 'capability-report overwrite refusal remains durable');
check(events.some(event => event.event === 'final_verification_after_semantic_correction_passed'), 'post-correction verification remains durable');
check(events.some(event => event.event === 'git_index_path_length_failure_preserved'), 'Git index path-length failure remains durable');
check(events.some(event => event.event === 'module_path_shortened_for_reviewability'), 'reviewable path correction remains durable');
check(events.some(event => event.event === 'final_verification_after_path_shortening_passed'), 'post-path-shortening verification remains durable');

check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 37, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2627, 'curation retains exact verification counts');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No merge, promotion, CANON/.test(receipt.authorityUsed), 'curation preserves unused authority boundary');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 18, 'index preserves eighteen open seams');
check(index.openEvidence.includes('atomic multi-file ledger snapshot'), 'atomic snapshot remains open');
check(index.openEvidence.includes('authenticated checkpoint origin or pin'), 'authenticated checkpoint pin remains open');
check(index.openEvidence.includes('deletion or rollback prevention'), 'rollback prevention remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');

check(sourceSnapshot.sources.length === 166 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 37 && results.summary.passed === 37 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 2627, 'focused assertion count remains exact');

console.log('\nPortable settlement-history checkpoint verification evidence: PASS (' + checks + ' checks)');
