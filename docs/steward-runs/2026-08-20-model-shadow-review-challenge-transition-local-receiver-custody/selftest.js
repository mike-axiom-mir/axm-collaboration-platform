#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-receiver-custody');
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
const envelopeSchema = readModule('model-shadow-review-challenge-transition-local-receiver-envelope.schema.json');
const senderSchema = readModule('model-shadow-review-challenge-transition-local-receiver-sender-receipt.schema.json');
const recordSchema = readModule('model-shadow-review-challenge-transition-local-receiver-custody-record.schema.json');
const receiverSchema = readModule('model-shadow-review-challenge-transition-local-receiver-receipt.schema.json');
const reloadSchema = readModule('model-shadow-review-challenge-transition-local-receiver-reload-receipt.schema.json');
const implementation = text('model-shadow-review-challenge-transition-local-receiver-custody.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 33, 'requirements inventory contains thirty-three exact routes');
check(requirements.requirements.filter(item => item.required).length === 15, 'fifteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen external authority human and outcome routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before comparator is BLOCKED by thirteen missing bounded capabilities');
check(before.requirements.filter(item => item.required && item.status === 'READY').length === 2, 'both v1.0 and v1.1 upstream routes were ready before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fifteen required bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eighteen optional external routes remain UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory retains exactly two upstream available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 15, 'after inventory declares fifteen bounded available capabilities including upstream');
check(after.requirements.find(item => item.id === 'independently-operated-receivers').status === 'OPTIONAL_UNKNOWN', 'independent receiver operation remains unproven');
check(after.requirements.find(item => item.id === 'actual-network-transport').status === 'OPTIONAL_UNKNOWN', 'actual network transport remains unproven');
check(after.requirements.find(item => item.id === 'other-host-delivery').status === 'OPTIONAL_UNKNOWN', 'other-host delivery remains unproven');
check(after.requirements.find(item => item.id === 'independent-external-retention').status === 'OPTIONAL_UNKNOWN', 'independent external retention remains unproven');
check(after.requirements.find(item => item.id === 'durability-beyond-file-fsync').status === 'OPTIONAL_UNKNOWN', 'durability beyond file fsync remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'deletion-or-rollback-resistance').status === 'OPTIONAL_UNKNOWN', 'rollback resistance remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-local-receiver-custody' && contract.version === 'v1.2', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 2, 'contract is TEST and declares both bounded filesystem permissions');
check(contract.boundaries.reads.length === 2 && contract.boundaries.writes.length === 2, 'contract declares exact read and write surfaces');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
const requiredAvailable = afterInventory.capabilities.filter(item => item.status === 'available' && item.id.includes('.local-receiver-'));
check(requiredAvailable.length === 13 && requiredAvailable.every(item => contract.provides.includes(item.id)), 'contract provides every new bounded available capability by exact id');
check(contract.boundaries.refuses.includes('local-child-processes-as-independent-real-world-receivers'), 'contract refuses child processes as independent receivers');
check(contract.boundaries.refuses.includes('local-file-handoff-as-network-or-other-host-delivery'), 'contract refuses local handoff as network delivery');
check(contract.boundaries.refuses.includes('caller-owned-custody-root-as-independent-external-retention'), 'contract refuses caller root as external retention');
check(contract.boundaries.refuses.includes('local-files-as-protected-monotonic-state-or-deletion-rollback-resistance'), 'contract refuses local files as protected monotonic state');
check(contract.boundaries.refuses.includes('private-key-persistence'), 'contract refuses private-key persistence');

check(implementation.includes("require('fs')") && implementation.includes("require('path')"), 'runtime explicitly imports local filesystem capabilities');
check(!implementation.includes("require('http')") && !implementation.includes("require('https')") && !implementation.includes("require('net')") && !implementation.includes('fetch('), 'runtime opens no network route');
check(!implementation.includes("require('child_process')"), 'runtime spawns no process');
check(implementation.includes("fs.openSync(filePath, 'wx', 0o600)"), 'runtime uses exclusive file create');
check(implementation.includes('fs.fsyncSync(descriptor)'), 'runtime fsyncs each reported successful file');
check(implementation.includes('assertSeparatedRoots'), 'runtime enforces nonnested transport and custody roots');
check(implementation.includes('MAX_ENVELOPE_CANONICAL_BYTES = 48 * 1024 * 1024'), 'runtime declares exact envelope byte bound');
check(implementation.includes('MAX_RECORD_CANONICAL_BYTES = 48 * 1024 * 1024'), 'runtime declares exact custody byte bound');
check(implementation.includes('fullAssessmentInputPersistedInCustody: false'), 'runtime distinguishes receipt custody from full assessment input persistence');
check(implementation.includes('independentExternalRetentionProven: false'), 'runtime keeps external retention false');
check(implementation.includes('durabilityBeyondReportedFileFsyncProven: false'), 'runtime keeps durability beyond file fsync false');
check(implementation.includes('protectedMonotonicStateProven: false') && implementation.includes('deletionOrRollbackPrevented: false'), 'runtime keeps monotonic state and rollback prevention false');

check(focusedTest.includes('both receiver writes execute in child processes distinct from the sender test process'), 'focused test proves receiver process separation in the test route');
check(focusedTest.includes('two locally delivered receiver acknowledgements meet exact v1.1 threshold'), 'focused test composes acknowledgements through v1.1');
check(focusedTest.includes('alpha custody reload executes in a new process instance'), 'focused test routes persistence through fresh-process reload');
check(focusedTest.includes('sender refuses conflicting payload reuse of one delivery and receiver identity'), 'focused test proves conflicting delivery refusal');
check(focusedTest.includes('receiver refuses traversal envelope filename'), 'focused test proves traversal refusal');
check(focusedTest.includes('custody validation refuses altered custody signature'), 'focused test proves custody signature refusal');
check(focusedTest.includes('oversized custody record is refused before field processing'), 'focused test proves custody byte bound');
check(focusedTest.includes('public receiver receipt embeds no raw acknowledgement signature'), 'focused test proves public receipt signature minimization');
check(/remain controlled\s+by one self-test/.test(readme) && /do not establish independently operated receivers/.test(readme), 'README preserves same-controller process counterexample');

check(envelopeSchema.$id === 'axm.model-shadow-review-challenge-transition-local-receiver-envelope/v1', 'envelope schema identity is exact');
check(senderSchema.$id === 'axm.model-shadow-review-challenge-transition-local-receiver-sender-receipt/v1', 'sender schema identity is exact');
check(recordSchema.$id === 'axm.model-shadow-review-challenge-transition-local-receiver-custody-record/v1', 'custody record schema identity is exact');
check(receiverSchema.$id === 'axm.model-shadow-review-challenge-transition-local-receiver-receipt/v1', 'receiver receipt schema identity is exact');
check(reloadSchema.$id === 'axm.model-shadow-review-challenge-transition-local-receiver-reload-receipt/v1', 'reload receipt schema identity is exact');
check(recordSchema.properties.truth.properties.fullAssessmentInputPersistedInCustody.const === false, 'custody schema keeps full assessment input persistence false');
check(recordSchema.properties.truth.properties.independentExternalRetentionProven.const === false, 'custody schema keeps external retention false');
check(receiverSchema.properties.truth.properties.actualLocalFileHandoffObserved.const === true, 'receiver schema records bounded local file handoff');
check(receiverSchema.properties.truth.properties.independentlyOperatedReceiverProven.const === false, 'receiver schema keeps independent operation false');
check(reloadSchema.properties.truth.properties.assessmentUpstreamExactReverifiedWithoutInput.const === false, 'reload schema keeps upstream re-verification without input false');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 88, 'source snapshot declares eighty-eight normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 30 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1461, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local receiver custody evidence selftest: PASS (' + checks + ' checks)');
