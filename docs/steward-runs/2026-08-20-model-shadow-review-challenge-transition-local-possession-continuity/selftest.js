#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-continuity');
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
const snapshotSchema = readModule('model-shadow-review-challenge-transition-local-possession-snapshot.schema.json');
const checkpointSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint.schema.json');
const auditSchema = readModule('model-shadow-review-challenge-transition-local-possession-continuity.schema.json');
const implementation = text('model-shadow-review-challenge-transition-local-possession-continuity.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 32, 'requirements inventory contains thirty-two exact routes');
check(requirements.requirements.filter(item => item.required).length === 14, 'fourteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before comparator is BLOCKED by thirteen missing bounded capabilities');
check(before.requirements.filter(item => item.required && item.status === 'READY').length === 1, 'v1.3 reload was the one ready bounded route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen required bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eighteen broader routes remain UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory retains one upstream available capability');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 14, 'after inventory declares fourteen bounded available capabilities including upstream');
const newAvailable = afterInventory.capabilities.filter(item => item.status === 'available' && item.id.includes('.local-possession-continuity.'));
check(newAvailable.length === 13 && newAvailable.every(item => contract.provides.includes(item.id)), 'contract provides every new bounded capability by exact id');
check(after.requirements.find(item => item.id === 'independently-retained-checkpoint').status === 'OPTIONAL_UNKNOWN', 'independent checkpoint retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'rollback-prevention').status === 'OPTIONAL_UNKNOWN', 'rollback prevention remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'externally trusted time remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-continuity' && contract.version === 'v1.4', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 1, 'contract is TEST with one bounded read permission');
check(contract.boundaries.reads.length === 2 && contract.boundaries.writes.length === 0, 'contract declares exact read-only surfaces');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('valid-response-artifact-copied-under-another-response-filename'), 'contract preserves copied-response filename counterexample');
check(contract.boundaries.refuses.includes('self-digest-as-authenticated-integrity'), 'contract refuses self-digest as authenticated integrity');
check(contract.boundaries.refuses.includes('snapshot-as-authenticated-observer-origin'), 'contract refuses snapshot as authenticated observer origin');
check(contract.boundaries.refuses.includes('caller-checkpoint-as-proven-external-retention'), 'contract refuses checkpoint as external retention proof');
check(contract.boundaries.refuses.includes('relative-rollback-detection-as-rollback-prevention'), 'contract refuses relative detection as prevention');
check(contract.boundaries.refuses.includes('relative-rollback-detection-as-protected-monotonic-state'), 'contract refuses relative detection as monotonic state');
check(contract.boundaries.refuses.includes('checkpoint-as-pre-checkpoint-history-proof'), 'contract refuses checkpoint as prior-history proof');
check(contract.boundaries.refuses.includes('private-key-ingestion-or-persistence'), 'contract refuses private keys');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(implementation.includes("const MAX_ENTRIES = 64"), 'runtime declares exact response inventory bound');
check(implementation.includes("const MAX_ERRORS = 64"), 'runtime declares exact error inventory bound');
check(implementation.includes("const MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024"), 'runtime declares exact artifact byte bound');
check(implementation.includes('return sha256({ challengeId, receiverId })'), 'runtime re-derives response filename from signed identity');
check(implementation.includes("CUSTODY_RECORD_ID.exec(ref.id)"), 'runtime re-derives custody filename from signed custody identity');
check(implementation.includes("service.reload({"), 'runtime composes unchanged v1.3 reload for every admitted response');
check(implementation.includes("RESPONSE_FILENAME_IDENTITY_MISMATCH"), 'runtime types deterministic filename mismatch');
check(implementation.includes("DUPLICATE_CHALLENGE_RESPONSE"), 'runtime types duplicate challenge responses');
check(implementation.includes("fs.readdirSync(answers).sort()"), 'runtime inventories response namespace in deterministic order');
check(implementation.includes("fs.lstatSync(filePath)"), 'runtime inspects file type without following entry symlinks');
check(!implementation.includes('fs.writeFileSync') && !implementation.includes('fs.openSync') && !implementation.includes('fs.mkdirSync'), 'runtime contains no filesystem write primitive');
check(!implementation.includes("require('child_process')"), 'runtime spawns no process');
check(!implementation.includes("require('http')") && !implementation.includes("require('https')") && !implementation.includes("require('net')") && !implementation.includes('fetch('), 'runtime opens no network route');
check(!implementation.includes('rollbackOrDeletionPrevented: true'), 'runtime never declares rollback prevention');
check(!implementation.includes('presentedCheckpointProvesExternalRetention: true'), 'runtime never declares external checkpoint retention');
check(!implementation.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

check(focusedTest.includes('fresh process sees exact checkpoint match'), 'focused test proves fresh-process exact comparison');
check(focusedTest.includes('second challenge is classified as checkpoint extension'), 'focused test proves valid checkpoint extension');
check(focusedTest.includes('missing response is detected relative to checkpoint'), 'focused test proves relative deletion detection');
check(focusedTest.includes('valid changed response is detected relative to checkpoint'), 'focused test proves relative signed replacement detection');
check(focusedTest.includes('v1.3 counterexample accepts valid response copied under another well-formed filename'), 'focused test reproduces v1.3 filename counterexample');
check(focusedTest.includes('v1.4 strict inventory rejects copied response under wrong filename'), 'focused test proves v1.4 strict filename refusal');
check(focusedTest.includes('whole namespace absence becomes checkpoint-relative hold'), 'focused test proves absence hold');
check(focusedTest.includes('configured identity drift becomes a hold'), 'focused test proves identity-drift hold');
check(focusedTest.includes('observer refuses private key input'), 'focused test proves private-key refusal');
check(focusedTest.includes('runtime performs no file write'), 'focused test checks read-only source boundary');
check(/controller that can\s+alter or withhold both/.test(readme), 'README preserves same-controller defeat counterexample');

check(snapshotSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-snapshot/v1', 'snapshot schema identity is exact');
check(checkpointSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint/v1', 'checkpoint schema identity is exact');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-continuity/v1', 'audit schema identity is exact');
check(snapshotSchema.additionalProperties === false && checkpointSchema.additionalProperties === false && auditSchema.additionalProperties === false, 'all three public schemas close unknown fields');
check(snapshotSchema.$defs.truth.properties.snapshotOriginAuthenticated.const === false, 'snapshot schema authenticates no observer origin');
check(snapshotSchema.$defs.truth.properties.rollbackOrDeletionPrevented.const === false, 'snapshot schema keeps rollback prevention false');
check(checkpointSchema.$defs.truth.properties.checkpointStoredByModule.const === false, 'checkpoint schema keeps module storage false');
check(checkpointSchema.$defs.truth.properties.checkpointRetentionProven.const === false, 'checkpoint schema keeps external retention false');
check(checkpointSchema.$defs.truth.properties.protectedMonotonicStateProven.const === false, 'checkpoint schema keeps protected monotonic state false');
check(auditSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous repair');
check(auditSchema.$defs.truth.properties.actualHumanParticipationProven.const === false, 'audit schema keeps actual human participation false');
check(auditSchema.$defs.truth.properties.providerExecutionProven.const === false, 'audit schema keeps provider execution false');
check(auditSchema.$defs.truth.properties.humanBenefitProven.const === false, 'audit schema keeps human benefit false');
check(auditSchema.$defs.truth.properties.automaticMerge.const === false && auditSchema.$defs.truth.properties.automaticCanon.const === false, 'audit schema keeps merge and CANON false');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 107, 'source snapshot declares one hundred seven normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 32 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1776, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession continuity evidence selftest: PASS (' + checks + ' checks)');
