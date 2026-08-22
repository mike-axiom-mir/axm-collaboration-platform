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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-ledger');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-ledger.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const receiptSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-consumption.schema.json'), 'utf8'));
const manifestSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-ledger-manifest.schema.json'), 'utf8'));

check(requirements.requirements.length === 14 && requirements.requirements.filter(item => item.required).length === 9, 'requirements separate nine bounded technical routes from five external or protected-state routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 8, 'before report records eight missing ledger capabilities');
check(before.requirements.find(item => item.id === 'exact-upstream-signed-review').status === 'READY', 'before report preserves exact upstream signed-review rebuild');
check(before.requirements.find(item => item.id === 'authority-boundary').status === 'READY', 'before report preserves the no-execution authority boundary');
check(before.requirements.filter(item => item.required && !['exact-upstream-signed-review', 'authority-boundary'].includes(item.id)).every(item => item.status === 'BLOCKED'), 'before report blocks every new required ledger route');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after report closes bounded technical routes while external routes keep the frontier degraded');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all protected-state, global, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'protected-ledger-state').status === 'OPTIONAL_UNKNOWN', 'deletion and rollback resistance remains explicitly unproven');
check(after.requirements.find(item => item.id === 'global-single-use').status === 'OPTIONAL_UNKNOWN', 'global challenge single-use remains explicitly unproven');
check(after.requirements.find(item => item.id === 'host-trust-anchor').status === 'OPTIONAL_UNKNOWN', 'host trust root remains explicitly unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains explicitly unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 2, 'module remains TEST with no claimed host permission integration and two fixed write patterns');
check(contract.boundaries.refuses.includes('caller-owned-state-as-deletion-or-rollback-resistant'), 'contract refuses caller-owned files as protected storage');
check(contract.boundaries.refuses.includes('caller-ledger-single-use-as-global-single-use'), 'contract refuses local state as global single-use');
check(contract.boundaries.refuses.includes('consumption-as-execution-authority'), 'contract refuses consumption as execution authority');
check(contract.boundaries.refuses.includes('corrupt-entry-as-absent-challenge'), 'contract declares corrupt state fail closed');
check(contract.boundaries.refuses.includes('missing-ledger-manifest-with-existing-state-as-new-ledger'), 'contract refuses manifest deletion as fresh initialization');
check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization') && contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract separates confirmation from host authorization and remains uninstalled and unpromoted');

check(implementation.includes("fs.openSync(entryPath, 'wx'") && implementation.includes('fs.fsyncSync(descriptor)'), 'implementation uses native exclusive create and file fsync');
check(implementation.includes('CHALLENGE_ALREADY_CONSUMED') && implementation.includes('CHALLENGE_ENTRY_CORRUPT'), 'implementation exposes typed replay and corruption refusals');
check(implementation.includes('LEDGER_MANIFEST_MISSING') && implementation.includes('LEDGER_ID_MISMATCH'), 'implementation exposes typed manifest deletion and identity refusals');
check(implementation.includes('challengeReplayRefusedWhileLedgerStatePreserved: true'), 'implementation limits replay claim to preserved state');
check(implementation.includes('ledgerDeletionOrRollbackResistanceProven: false') && implementation.includes('challengeGloballySingleUseProven: false'), 'implementation keeps protected-state and global claims false');
check(implementation.includes('hostAuthorizationAuthenticated: false') && implementation.includes('actualHumanParticipationProven: false'), 'implementation keeps host and human authentication claims false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes('fetch(') && !implementation.includes('child_process'), 'runtime implementation contains no network or process execution route');
check(focusedTest.includes('runChildAsync') && focusedTest.includes('winners.length, 1') && focusedTest.includes('replayLosers.length, 1'), 'focused test routes concurrent behavior through separate processes');
check(focusedTest.includes('deleting caller-owned ledger state demonstrably reopens'), 'focused test retains deletion as a counterexample to protected persistence');
check(receiptSchema.$id === 'axm.model-shadow-review-challenge-consumption/v1', 'receipt schema identity matches the emitted handoff');
check(manifestSchema.$id === 'axm.model-shadow-review-challenge-ledger-manifest/v1', 'manifest schema identity matches persistent ledger state');

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
  check(results.status === 'PASS' && results.summary.commands === 20 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 392, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge ledger evidence selftest: PASS (' + checks + ' checks)');
