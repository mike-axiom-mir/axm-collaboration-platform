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

check(seal.parseStatus === 'valid' && seal.eventLines === 20 && seal.validJsonLines === 20 && events.length === 20, 'bundled-sealed session segment is valid and complete');
check(crypto.createHash('sha256').update(segmentBytes).digest('hex') === seal.sha256, 'session seal matches exact segment bytes');
check(events.every((event, indexValue) => event.eventId === 'evt-' + String(indexValue + 1).padStart(3, '0')), 'durable event identifiers are ordered');
check(events.some(event => event.event === 'replacement_policy_gap_selected'), 'selected policy gap remains durable');
check(events.some(event => event.event === 'existing_anchor_pattern_found'), 'existing anchor pattern decision remains durable');
check(events.some(event => event.event === 'anchor_contract_incompatibility_reproduced'), 'anchor contract incompatibility remains durable');
check(events.some(event => event.event === 'anchor_threshold_signatures_proven'), 'threshold signature evidence remains durable');
check(events.some(event => event.event === 'possession_identity_bindings_proven'), 'possession identity bindings remain durable');
check(events.some(event => event.event === 'relative_policy_substitution_detected'), 'relative policy-substitution detection remains durable');
check(events.some(event => event.event === 'original_anchor_policy_reauthorization_preserved'), 'original-anchor reauthorization remains durable');
check(events.some(event => event.event === 'joint_substitution_counterexample_preserved'), 'joint-substitution counterexample remains durable');
check(events.some(event => event.event === 'fresh_process_anchored_continuity_proven'), 'fresh-process anchored continuity remains durable');
check(events.some(event => event.event === 'all_continuity_decisions_preserved'), 'all continuity decision evidence remains durable');
check(events.some(event => event.event === 'privacy_purity_and_bounds_proven'), 'privacy purity and bounds evidence remains durable');
check(events.some(event => event.event === 'capability_gap_compared'), 'capability comparison remains durable');
check(events.some(event => event.event === 'verification_checkpoint_passed'), 'passing verification checkpoint follows implementation events');
check(events.some(event => event.event === 'evidence_route_linewrap_assertion_failed'), 'evidence route assertion failure remains durable');
check(events.some(event => event.event === 'evidence_route_assertion_corrected'), 'evidence route assertion correction remains durable');
check(receipt.sealDigest === 'sha256:' + seal.sha256 && receipt.durableEventsPreserved === events.length, 'curation receipt binds exact seal and event count');
check(receipt.telemetryAggregation.retainedRawLogs === false && receipt.telemetryAggregation.commandOutcomes === 34, 'curation retains bounded outcomes without raw logs');
check(receipt.telemetryAggregation.failedCommands === 0 && receipt.telemetryAggregation.focusedAssertions === 2218, 'curation receipt retains exact verification counts');
check(receipt.temporaryMaterialDeleted.count === 9 && receipt.unclassifiedItems.length === 0, 'curation records nine bounded continuity-lane cleanups and no unclassified item');
check(index.status === 'TEST' && index.seal === 'SESSION_SEGMENT.seal.json' && index.curationReceipt === 'CURATION_RECEIPT.json', 'session index resolves sealed TEST evidence');
check(index.openEvidence.length === 21 && index.openEvidence.includes('host-authenticated anchor pin') && index.openEvidence.includes('witness policy replacement prevention'), 'index preserves twenty-one open broader seams');
check(sourceSnapshot.sources.length === 125 && sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all normalized source digests still match');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'check-results digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 34 && results.summary.passed === 34, 'all recorded verification commands passed');
check(results.summary.focusedAssertions === 2218, 'focused assertion count remains exact');

console.log('\nModel Shadow local possession checkpoint anchor verification evidence: PASS (' + checks + ' checks)');
