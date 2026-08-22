#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-challenge');
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
const challengeSchema = readModule('model-shadow-review-challenge-transition-local-possession-challenge.schema.json');
const responseSchema = readModule('model-shadow-review-challenge-transition-local-possession-response-record.schema.json');
const receiptSchema = readModule('model-shadow-review-challenge-transition-local-possession-receipt.schema.json');
const reloadSchema = readModule('model-shadow-review-challenge-transition-local-possession-reload-receipt.schema.json');
const implementation = text('model-shadow-review-challenge-transition-local-possession-challenge.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 30, 'requirements inventory contains thirty exact routes');
check(requirements.requirements.filter(item => item.required).length === 12, 'twelve bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen external authority human and outcome routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 11, 'before comparator is BLOCKED by eleven missing bounded capabilities');
check(before.requirements.filter(item => item.required && item.status === 'READY').length === 1, 'v1.2 signed custody was the one ready bounded route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all twelve required bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eighteen optional routes remain UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory retains one upstream available capability');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 12, 'after inventory declares twelve bounded available capabilities including upstream');
check(after.requirements.find(item => item.id === 'independently-operated-parties').status === 'OPTIONAL_UNKNOWN', 'independent parties remain unproven');
check(after.requirements.find(item => item.id === 'actual-network-transport').status === 'OPTIONAL_UNKNOWN', 'actual network transport remains unproven');
check(after.requirements.find(item => item.id === 'other-host-delivery').status === 'OPTIONAL_UNKNOWN', 'other-host delivery remains unproven');
check(after.requirements.find(item => item.id === 'independent-external-retention').status === 'OPTIONAL_UNKNOWN', 'independent external retention remains unproven');
check(after.requirements.find(item => item.id === 'external-retention-duration').status === 'OPTIONAL_UNKNOWN', 'external retention duration remains unproven');
check(after.requirements.find(item => item.id === 'durability-beyond-file-fsync').status === 'OPTIONAL_UNKNOWN', 'durability beyond file fsync remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'deletion-or-rollback-resistance').status === 'OPTIONAL_UNKNOWN', 'rollback resistance remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'externally trusted time remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-challenge' && contract.version === 'v1.3', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 2, 'contract is TEST with two bounded filesystem permissions');
check(contract.boundaries.reads.length === 2 && contract.boundaries.writes.length === 1, 'contract declares exact read and write surfaces');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
const newAvailable = afterInventory.capabilities.filter(item => item.status === 'available' && item.id.includes('.local-possession.'));
check(newAvailable.length === 11 && newAvailable.every(item => contract.provides.includes(item.id)), 'contract provides every new bounded capability by exact id');
check(contract.boundaries.refuses.includes('caller-times-as-externally-trusted-time-or-retention-duration-proof'), 'contract refuses caller time as trusted retention proof');
check(contract.boundaries.refuses.includes('existing-response-refusal-as-protected-monotonic-state-or-deletion-rollback-resistance'), 'contract refuses local replay file as protected state');
check(contract.boundaries.refuses.includes('one-controller-processes-as-independent-challenger-or-receiver'), 'contract refuses child processes as independent parties');
check(contract.boundaries.refuses.includes('local-files-as-network-or-other-host-transport'), 'contract refuses local files as external transport');
check(contract.boundaries.refuses.includes('private-key-persistence'), 'contract refuses private-key persistence');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(implementation.includes("require('fs')") && implementation.includes("require('path')"), 'runtime explicitly imports local filesystem capabilities');
check(!implementation.includes("require('http')") && !implementation.includes("require('https')") && !implementation.includes("require('net')") && !implementation.includes('fetch('), 'runtime opens no network route');
check(!implementation.includes("require('child_process')"), 'runtime spawns no process');
check(implementation.includes("fs.openSync(filePath, 'wx', 0o600)"), 'runtime uses exclusive response create');
check(implementation.includes('fs.fsyncSync(descriptor)'), 'runtime fsyncs each reported successful response file');
check(implementation.includes('Custody.validateCustodyRecord'), 'runtime reuses unchanged v1.2 custody validation');
check((implementation.match(/assertDirectoryNotLink\(stateRoot/g) || []).length >= 3, 'runtime rechecks state-root symlink status per operation');
check(implementation.includes("MAX_CHALLENGE_WINDOW_MS = 24 * 60 * 60 * 1000"), 'runtime declares exact 24-hour challenge bound');
check(implementation.includes('MAX_CHALLENGE_CANONICAL_BYTES = 64 * 1024'), 'runtime declares exact challenge byte bound');
check(implementation.includes('MAX_RESPONSE_CANONICAL_BYTES = 4 * 1024 * 1024'), 'runtime declares exact response byte bound');
check(implementation.includes('replayRefusedWhileResponseFilePresent: true'), 'runtime scopes replay refusal to response-file presence');
check(implementation.includes('challengeTimeExternallyTrusted: false'), 'runtime keeps trusted time false');
check(implementation.includes('retentionDurationProven: false'), 'runtime keeps retention duration false');
check(implementation.includes('protectedMonotonicStateProven: false') && implementation.includes('deletionOrRollbackPrevented: false'), 'runtime keeps monotonic state and rollback prevention false');
check(implementation.includes('independentlyOperatedChallengerProven: false') && implementation.includes('independentlyOperatedReceiverProven: false'), 'runtime keeps party independence false');

check(focusedTest.includes('answer executed in a distinct child process'), 'focused test routes answer through a child process');
check(focusedTest.includes('reload executed in another child process'), 'focused test routes reload through another child process');
check(focusedTest.includes('same challenge cannot overwrite existing response'), 'focused test proves exact replay refusal');
check(focusedTest.includes('same logical challenge cannot conflict on response time'), 'focused test proves conflicting replay refusal');
check(focusedTest.includes('distinct nonce produces distinct response identity'), 'focused test proves distinct nonce route');
check(focusedTest.includes('tampered challenger signature is refused'), 'focused test proves challenge signature refusal');
check(focusedTest.includes('tampered response signature is refused'), 'focused test proves response signature refusal');
check(focusedTest.includes('noncanonical custody record is refused'), 'focused test proves custody canonicality refusal');
check(focusedTest.includes('oversized response file is refused'), 'focused test proves response byte bound');
check(focusedTest.includes('public receipt omits response signature'), 'focused test proves public signature minimization');
check(/controlled by one synthetic test/.test(readme) && /deleting or\s+rolling back/.test(readme), 'README preserves same-controller and rollback counterexamples');

check(challengeSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-challenge/v1', 'challenge schema identity is exact');
check(responseSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-response-record/v1', 'response schema identity is exact');
check(receiptSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-receipt/v1', 'receipt schema identity is exact');
check(reloadSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-reload-receipt/v1', 'reload schema identity is exact');
check(challengeSchema.properties.truth.properties.challengeTimeExternallyTrusted.const === false, 'challenge schema keeps trusted time false');
check(responseSchema.$defs.truth.properties.retentionDurationProven.const === false, 'response schema keeps retention duration false');
check(responseSchema.$defs.truth.properties.deletionOrRollbackPrevented.const === false, 'response schema keeps rollback prevention false');
check(receiptSchema.$defs.truth.properties.rawSignatureEmbedded.const === false, 'public receipt schema omits raw signatures');
check(receiptSchema.$defs.truth.properties.independentPartiesProven.const === false, 'public receipt schema keeps independence false');
check(reloadSchema.properties.truth.properties.freshProcessProvenByReceipt.const === false, 'reload schema separates PID harness evidence from receipt');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 98, 'source snapshot declares ninety-eight normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 31 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1621, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession challenge evidence selftest: PASS (' + checks + ' checks)');
