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

const lines = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), 'utf8').trimEnd().split(/\r?\n/);
const events = lines.map(line => JSON.parse(line));
const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const segmentBytes = fs.readFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'));

check(seal.parseStatus === 'valid' && seal.eventLines === 25 && seal.validJsonLines === 25 && events.length === 25, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'frontier_routes_ranked'), 'frontier route ranking remains durable');
check(events.some(event => event.event === 'pairwise_contract_incompatibility_reproduced'), 'old contract incompatibility remains durable');
check(events.some(event => event.event === 'source_recap_gap_made_explicit'), 'source-recapture gap remains durable');
check(events.some(event => event.event === 'exact_replay_proven'), 'exact replay evidence remains durable');
check(events.some(event => event.event === 'forward_response_extension_proven'), 'response-extension evidence remains durable');
check(events.some(event => event.event === 'witness_policy_digest_semantics_proven'), 'witness-policy digest semantics remain durable');
check(events.some(event => event.event === 'withheld_fork_counterexample_preserved'), 'withheld-fork counterexample remains durable');
check(events.some(event => event.event === 'copresented_response_fork_detected'), 'co-presented fork detection remains durable');
check(events.some(event => event.event === 'declared_identity_and_policy_drifts_proven'), 'declared identity and policy holds remain durable');
check(events.some(event => event.event === 'checkpoint_and_response_contradictions_proven'), 'checkpoint and response holds remain durable');
check(events.some(event => event.event === 'fresh_process_transition_rebuild_proven'), 'fresh-process evidence remains durable');
check(events.some(event => event.event === 'capability_gap_compared'), 'capability comparison remains durable');
check(events.some(event => event.event === 'focused_fixture_reference_failed'), 'focused fixture failure remains durable');
check(events.some(event => event.event === 'focused_fixture_reference_corrected'), 'focused fixture correction remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint remains durable');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 36, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2565, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 15 && receipt.unclassifiedItems.length === 0, 'curation records fifteen bounded lineage cleanups and no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 31 && index.openEvidence.includes('live source-state recapture') && index.openEvidence.includes('withheld branch observation'), 'index preserves thirty-one open broader seams');
check(sourceSnapshot.sources.length === 140 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 36 && results.summary.passed === 36, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 2565, 'focused assertion count remains exact');

console.log('\nModel Shadow local possession checkpoint pairwise transition verification evidence: PASS (' + checks + ' checks)');
