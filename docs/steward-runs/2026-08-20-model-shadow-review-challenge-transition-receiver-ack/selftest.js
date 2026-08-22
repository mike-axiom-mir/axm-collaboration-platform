#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-receiver-ack');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
const text = name => fs.readFileSync(path.join(moduleDir, name), 'utf8');
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const contract = readModule('module.contract.json');
const policySchema = readModule('model-shadow-review-challenge-transition-receiver-policy.schema.json');
const ackSchema = readModule('model-shadow-review-challenge-transition-receiver-acknowledgement.schema.json');
const receiptSchema = readModule('model-shadow-review-challenge-transition-receiver-acknowledgement-witness.schema.json');
const implementation = text('model-shadow-review-challenge-transition-receiver-ack.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 32, 'requirements inventory contains thirty-two exact routes');
check(requirements.requirements.filter(item => item.required).length === 14, 'fourteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen external authority human and outcome routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before comparator is BLOCKED by thirteen missing bounded capabilities');
check(before.requirements.find(item => item.id === 'upstream-v1.0-assessment-exact-rebuild').status === 'READY', 'v1.0 upstream assessment rebuild was ready before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen required bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eighteen optional external routes remain UNKNOWN');
check(beforeInventory.capabilities.some(item => item.id.endsWith('declared-disclosure-exact-rebuild') && item.status === 'available'), 'before inventory retains exact v1.0 upstream capability');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 14, 'after inventory declares fourteen bounded available capabilities including upstream');
check(after.requirements.find(item => item.id === 'actual-transport-delivery').status === 'OPTIONAL_UNKNOWN', 'actual transport delivery remains unproven');
check(after.requirements.find(item => item.id === 'actual-receiver-read-or-application').status === 'OPTIONAL_UNKNOWN', 'actual receiver read remains unproven');
check(after.requirements.find(item => item.id === 'independently-operated-receivers').status === 'OPTIONAL_UNKNOWN', 'real-world receiver independence remains unproven');
check(after.requirements.find(item => item.id === 'independent-external-retention').status === 'OPTIONAL_UNKNOWN', 'independent external retention remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-receiver-ack' && contract.version === 'v1.1', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract is permissionless TEST material');
check(contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares no runtime read or write route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
const requiredAvailable = afterInventory.capabilities.filter(item => item.status === 'available' && !item.id.endsWith('declared-disclosure-exact-rebuild'));
check(requiredAvailable.every(item => contract.provides.includes(item.id)), 'contract provides every new bounded available capability by exact id');
check(contract.boundaries.refuses.includes('distinct-signing-keys-as-independent-operators'), 'contract refuses keys as independent operators');
check(contract.boundaries.refuses.includes('signature-threshold-as-actual-network-delivery'), 'contract refuses threshold as transport proof');
check(contract.boundaries.refuses.includes('signature-as-proof-receiver-read-or-applied-assessment'), 'contract refuses signature as receiver-read proof');
check(contract.boundaries.refuses.includes('threshold-receipt-as-independent-external-retention'), 'contract refuses threshold as external retention proof');
check(contract.boundaries.refuses.includes('receipt-as-branch-adoption-or-execution-authority'), 'contract refuses witness as adoption or execution authority');

check(!implementation.includes("require('fs')") && !implementation.includes("require('path')") && !implementation.includes("require('child_process')") && !implementation.includes('fetch('), 'runtime imports no filesystem process path or network capability');
check(implementation.includes('MAX_RECEIVERS = 10'), 'runtime declares exact receiver bound');
check(implementation.includes('MIN_REQUIRED_ACKNOWLEDGEMENTS = 2'), 'runtime declares exact minimum threshold');
check(implementation.includes('MAX_POLICY_CANONICAL_BYTES = 256 * 1024'), 'runtime declares exact policy byte bound');
check(implementation.includes('MAX_WITNESS_CANONICAL_BYTES = 48 * 1024 * 1024'), 'runtime declares exact witness byte bound');
check(implementation.includes("RETENTION_CLAIM = 'NO_DURABLE_RETENTION_CLAIM'"), 'runtime requires explicit no-retention claim');
check(implementation.includes('HOLD_DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_INCOMPLETE'), 'runtime has typed incomplete-threshold hold');
check(implementation.includes('DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_MET'), 'runtime has bounded threshold-met classification');
check(implementation.includes('realWorldReceiverIndependenceProven: false') && implementation.includes('actualTransportDeliveryProven: false'), 'runtime keeps independence and transport false');
check(implementation.includes('independentExternalRetentionProven: false') && implementation.includes('deletionOrRollbackPrevented: false'), 'runtime keeps retention and rollback prevention false');

check(focusedTest.includes('same-process two-key counterexample meets threshold without independence proof'), 'focused test proves same-process multikey counterexample');
check(focusedTest.includes('signature from another receiver key is refused'), 'focused test proves wrong-key signature refusal');
check(focusedTest.includes('one valid acknowledgement produces typed incomplete-threshold hold'), 'focused test proves incomplete threshold hold');
check(focusedTest.includes('undeclared durable retention claim is refused even when signed'), 'focused test refuses invented retention claim');
check(focusedTest.includes('maximum bounded witness verifies all ten acknowledgements'), 'focused test proves maximum acknowledgement bound');
check(focusedTest.includes('fresh process derives exact witness digest'), 'focused test routes reload through fresh process');
check(focusedTest.includes('witness over canonical byte limit is refused'), 'focused test proves witness canonical-byte refusal');
check(focusedTest.includes('receipt embeds no raw receiver label') && focusedTest.includes('receipt embeds no raw signature'), 'focused test checks witness data minimization');
check(/two distinct keys in\s+one process/.test(readme) && /not evidence of independent real-world receivers/.test(readme), 'README preserves same-controller counterexample boundary');

check(policySchema.$id === 'axm.model-shadow-review-challenge-transition-receiver-policy/v1', 'policy schema identity is exact');
check(policySchema.properties.receivers.minItems === 2 && policySchema.properties.receivers.maxItems === 10, 'policy schema mirrors receiver bounds');
check(policySchema.properties.truth.properties.realWorldReceiverIndependenceProven.const === false, 'policy schema keeps receiver independence false');
check(ackSchema.$id === 'axm.model-shadow-review-challenge-transition-receiver-acknowledgement/v1', 'acknowledgement schema identity is exact');
check(ackSchema.properties.retentionClaim.const === 'NO_DURABLE_RETENTION_CLAIM', 'acknowledgement schema makes no retention claim');
check(receiptSchema.$id === 'axm.model-shadow-review-challenge-transition-receiver-acknowledgement-witness/v1', 'witness schema identity is exact');
check(receiptSchema.properties.acknowledgementEvidence.properties.acknowledgements.maxItems === 10, 'witness schema mirrors acknowledgement bound');
check(receiptSchema.properties.truth.properties.actualTransportDeliveryProven.const === false, 'witness schema keeps actual transport false');
check(receiptSchema.properties.truth.properties.independentExternalRetentionProven.const === false, 'witness schema keeps external retention false');
check(receiptSchema.properties.truth.properties.automaticCanon.const === false, 'witness schema keeps automatic CANON false');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 77, 'source snapshot declares seventy-seven normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 29 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1308, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow review challenge transition receiver acknowledgement evidence selftest: PASS (' + checks + ' checks)');
