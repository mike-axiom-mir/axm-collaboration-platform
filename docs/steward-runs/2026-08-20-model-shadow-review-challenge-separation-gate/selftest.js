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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-separation-gate');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-separation-gate.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const receiptSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-separated-witness.schema.json'), 'utf8'));
const auditSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-separated-continuity.schema.json'), 'utf8'));

check(requirements.requirements.length === 18 && requirements.requirements.filter(item => item.required).length === 10, 'requirements separate ten bounded technical routes from eight protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 9, 'before report records nine missing separation-gate capabilities');
check(before.requirements.find(item => item.id === 'upstream-anchored-witness-integrity').status === 'READY', 'before report preserves upstream v0.5 anchored-witness rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-anchored-witness-integrity').every(item => item.status === 'BLOCKED'), 'before report blocks every new required separation-gate route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes required gaps while the real frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all ten bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eight protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-anchor-pin').status === 'OPTIONAL_UNKNOWN', 'authenticated host anchor pin remains unproven');
check(after.requirements.find(item => item.id === 'independently-attested-controller-separation').status === 'OPTIONAL_UNKNOWN', 'independently attested controller separation remains unproven');
check(after.requirements.find(item => item.id === 'actual-external-separation-retention').status === 'OPTIONAL_UNKNOWN', 'actual external separation retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'external trusted time remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('shared-public-key-fingerprint-across-witness-and-anchor-layers'), 'contract refuses exact cross-layer key reuse');
check(contract.boundaries.refuses.includes('shared-declared-principal-digest-across-witness-and-anchor-layers'), 'contract refuses exact cross-layer declared-principal reuse');
check(contract.boundaries.refuses.includes('distinct-key-fingerprints-as-independent-key-custody-proof'), 'contract refuses distinct keys as independent custody proof');
check(contract.boundaries.refuses.includes('distinct-declared-principal-digests-as-different-real-world-people'), 'contract refuses distinct digests as identity proof');
check(contract.boundaries.refuses.includes('observable-nonoverlap-as-independent-controller-proof'), 'contract refuses non-overlap as controller-independence proof');
check(contract.boundaries.refuses.includes('observable-nonoverlap-as-collusion-exclusion'), 'contract refuses non-overlap as collusion exclusion');
check(contract.boundaries.refuses.includes('separation-receipt-as-proven-external-retention'), 'contract refuses separation receipt as external retention proof');
check(contract.boundaries.refuses.includes('separation-receipt-as-execution-authority'), 'contract refuses separation receipt as execution authority');

check(implementation.includes('witness and anchor layers must not share an observed public key fingerprint'), 'implementation rejects an observed cross-layer key fingerprint');
check(implementation.includes('witness and anchor layers must not share a declared principal digest'), 'implementation rejects an observed cross-layer declared-principal digest');
check(implementation.includes("setDigest('witness-key-fingerprints'") && implementation.includes("setDigest('anchor-key-fingerprints'"), 'implementation retains domain-separated key-set digests');
check(implementation.includes("setDigest('witness-declared-principal-digests'") && implementation.includes("setDigest('anchor-declared-principal-digests'"), 'implementation retains domain-separated principal-set digests');
check(implementation.includes('realWorldControllerIndependenceProven: false'), 'implementation keeps controller independence false');
check(implementation.includes('keyCustodyIndependenceProven: false'), 'implementation keeps independent key custody false');
check(implementation.includes('sameControllerWithDistinctKeysStillPossible: true'), 'implementation exposes the same-controller distinct-key boundary');
check(implementation.includes('crossLayerCollusionExcluded: false'), 'implementation keeps collusion exclusion false');
check(implementation.includes('anchorPolicyAuthorityAuthenticated: false') && implementation.includes('expectedAnchorDigestAuthorityAuthenticated: false'), 'implementation keeps anchor and pin authority false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

check(focusedTest.includes('v0.5 accepts a cryptographically valid chain with one cross-layer key reused'), 'focused test proves the upstream cross-layer key-reuse gap');
check(focusedTest.includes('v0.6 refuses an exact public key fingerprint shared across layers'), 'focused test exercises cross-layer key rejection');
check(focusedTest.includes('v0.5 accepts a cryptographically valid chain with one declared principal reused'), 'focused test proves the upstream declared-principal-reuse gap');
check(focusedTest.includes('v0.6 refuses an exact declared principal digest shared across layers'), 'focused test exercises cross-layer declared-principal rejection');
check(focusedTest.includes('one synthetic process controlling all distinct fixture keys still passes observable separation'), 'focused test preserves same-controller distinct-key counterevidence');
check(focusedTest.includes('fresh process verifies separated chain and audits current ledger'), 'focused test routes separation reload through a fresh process');
check(focusedTest.includes('fresh separated audit performs no ledger write'), 'focused test compares ledger fingerprints around fresh-process audit');
check(focusedTest.includes('separated checkpoint detects relative rollback'), 'focused test detects rollback relative to the separated checkpoint');
check(/One\s+controller can generate different keys/.test(readme) && /does not exclude\s+collusion/.test(readme), 'README preserves same-controller and collusion boundaries');

check(receiptSchema.$id === 'axm.model-shadow-review-challenge-separated-witness/v1', 'separated witness schema identity matches contract');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-separated-continuity/v1', 'separated audit schema identity matches contract');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 37, 'source snapshot declares thirty-seven normalized TEST inputs');
  check(snapshot.sources.every(item => {
    const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
    return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
  }), 'source snapshot digests match current normalized source bytes');
}

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digestValue = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 24 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 764, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge separation gate evidence selftest: PASS (' + checks + ' checks)');
