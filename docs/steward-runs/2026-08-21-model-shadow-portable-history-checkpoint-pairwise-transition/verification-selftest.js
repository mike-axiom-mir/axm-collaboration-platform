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

check(seal.parseStatus === 'valid' && seal.eventLines === 24 && seal.validJsonLines === 24 && events.length === 24, 'sealed segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact bytes');
check(events.every((event, i) => event.eventId === 'evt-' + String(i + 1).padStart(3, '0')), 'event identifiers are ordered');
check(events.every(event => event.status === 'TEST' && event.timeAuthority === 'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED'), 'events preserve TEST and untrusted-time boundaries');
[
  'v23_pairwise_seam_selected', 'capability_gap_before_compared', 'closed_pairwise_classification_contract_frozen',
  'normalized_policy_profile_design_frozen', 'all_fifteen_classifications_exercised',
  'two_real_independent_fork_candidates_proven', 'withheld_branch_nonexclusion_preserved',
  'joint_pair_replacement_counterexample_proven', 'fresh_process_and_read_only_behavior_proven',
  'capability_gap_after_compared', 'full_inherited_verification_passed', 'claim_routes_and_open_evidence_preserved',
  'policy_rotation_authority_remains_open', 'nonvisual_browser_boundary_recorded', 'mike_merge_and_canon_gate_preserved'
].forEach(name => check(events.some(event => event.event === name), name + ' remains durable'));
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 39, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2804, 'curation retains exact verification totals');
check(receipt.temporaryMaterialDeleted.countKnown === false && receipt.unclassifiedItems.length === 0, 'curation avoids invented cleanup count and has no unclassified item');
check(/No shared-main mutation/.test(receipt.authorityUsed) && /merge, or CANON authority used/.test(receipt.authorityUsed), 'curation preserves unused authority boundary');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'index resolves sealed TEST evidence');
check(index.openEvidence.length === 18, 'index preserves eighteen open evidence routes');
check(index.openEvidence.includes('authenticated checkpoint origin or pin'), 'authenticated checkpoint origin remains open');
check(index.openEvidence.includes('authenticated policy rotation'), 'authenticated rotation remains open');
check(index.openEvidence.includes('global transition uniqueness'), 'global uniqueness remains open');
check(index.openEvidence.includes('promotion, merge, or CANON decision'), 'promotion merge and CANON remain open');
check(sourceSnapshot.sources.length === 185 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 39 && results.summary.passed === 39 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 2804, 'focused assertion count remains exact');

console.log('\nPortable history-checkpoint pairwise verification evidence: PASS (' + checks + ' checks)');
