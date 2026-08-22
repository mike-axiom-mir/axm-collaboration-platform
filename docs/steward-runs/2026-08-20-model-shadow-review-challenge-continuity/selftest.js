#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-continuity');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-continuity.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const snapshotSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-ledger-snapshot.schema.json'), 'utf8'));
const checkpointSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-checkpoint.schema.json'), 'utf8'));
const auditSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-continuity.schema.json'), 'utf8'));

check(requirements.requirements.length === 17 && requirements.requirements.filter(item => item.required).length === 10, 'requirements separate ten bounded technical routes from seven protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 11, 'before report records eleven missing continuity capabilities');
check(before.requirements.find(item => item.id === 'upstream-ledger-replay-boundary').status === 'READY', 'before report preserves the upstream state-preserving replay boundary');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-ledger-replay-boundary').every(item => item.status === 'BLOCKED'), 'before report blocks every new required continuity route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes required gaps while the real frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all ten bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all seven protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'actual-external-checkpoint-retention').status === 'OPTIONAL_UNKNOWN', 'actual external checkpoint retention remains unproven');
check(after.requirements.find(item => item.id === 'authenticated-checkpoint-authority').status === 'OPTIONAL_UNKNOWN', 'authenticated checkpoint authority remains unproven');
check(after.requirements.find(item => item.id === 'protected-ledger-state').status === 'OPTIONAL_UNKNOWN', 'protected ledger state remains unproven');
check(after.requirements.find(item => item.id === 'host-trust-anchor').status === 'OPTIONAL_UNKNOWN', 'host trust remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains read-only TEST with no claimed host permission integration');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('relative-rollback-detection-as-rollback-prevention'), 'contract refuses relative detection as prevention');
check(contract.boundaries.refuses.includes('caller-checkpoint-as-proven-external-retention'), 'contract refuses caller checkpoint as retention evidence');
check(contract.boundaries.refuses.includes('caller-checkpoint-as-authenticated-authority'), 'contract refuses caller checkpoint as authenticated authority');
check(contract.boundaries.refuses.includes('self-digested-snapshot-as-authenticated-observer-origin'), 'contract refuses snapshot self-digest as authenticated observer origin');
check(contract.boundaries.refuses.includes('continuity-observation-as-execution-authority'), 'contract refuses continuity evidence as execution authority');

check(implementation.includes('fs.lstatSync') && implementation.includes('Ledger.validateStoredReceipt'), 'implementation reads and validates native ledger files');
check(implementation.includes('ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT'), 'implementation preserves relative rollback and replacement classification');
check(implementation.includes('HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT') && implementation.includes('HOLD_LEDGER_IDENTITY_CHANGED'), 'implementation preserves deletion and identity-drift holds');
check(implementation.includes('CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT') && implementation.includes('CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT'), 'implementation distinguishes exact and forward-extension states');
check(implementation.includes('checkpointExternalRetentionProven: false') && implementation.includes('checkpointAuthorityAuthenticated: false'), 'implementation keeps retention and authority claims false');
check(implementation.includes('snapshotOriginAuthenticated: false') && implementation.includes('auditTimeExternallyTrusted: false'), 'implementation keeps observer origin and caller time unauthenticated');
check(implementation.includes('ledgerDeletionOrRollbackPrevented: false') && implementation.includes('globalSingleUseProven: false'), 'implementation keeps prevention and global scope false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
check(!implementation.includes('fetch(') && !implementation.includes('child_process'), 'runtime implementation contains no network or process execution route');
check(focusedTest.includes('runChild') && focusedTest.includes('whole namespace deletion'), 'focused test routes deletion comparison through a fresh process');
check(focusedTest.includes('replacement receipt has a distinct exact digest') && focusedTest.includes('valid replacement is detected'), 'focused test preserves valid replacement as counterevidence');
check(focusedTest.includes('ledger capture performs no filesystem write'), 'focused test compares state fingerprints around capture');
check(snapshotSchema.$id === 'axm.model-shadow-review-challenge-ledger-snapshot/v1', 'snapshot schema identity matches contract');
check(checkpointSchema.$id === 'axm.model-shadow-review-challenge-checkpoint/v1', 'checkpoint schema identity matches contract');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-continuity/v1', 'audit schema identity matches contract');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 15, 'source snapshot declares fifteen normalized TEST inputs');
  check(snapshot.sources.every(item => {
    const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
    return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
  }), 'source snapshot digests match current normalized source bytes');
}

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 21 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 471, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge continuity evidence selftest: PASS (' + checks + ' checks)');
