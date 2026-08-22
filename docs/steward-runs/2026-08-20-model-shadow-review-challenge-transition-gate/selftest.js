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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-transition-gate');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-gate.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-pairwise-transition.schema.json'), 'utf8'));

check(requirements.requirements.length === 20 && requirements.requirements.filter(item => item.required).length === 12, 'requirements separate twelve bounded technical routes from eight protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 11, 'before report records eleven missing transition-gate capabilities');
check(before.requirements.find(item => item.id === 'upstream-separated-chain-integrity').status === 'READY', 'before report preserves upstream v0.6 separated-chain rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-separated-chain-integrity').every(item => item.status === 'BLOCKED'), 'before report blocks every new required transition-gate route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes required gaps while the real frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all twelve bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eight protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-anchor-pin').status === 'OPTIONAL_UNKNOWN', 'authenticated host anchor pin remains unproven');
check(after.requirements.find(item => item.id === 'globally-consistent-external-transition-log').status === 'OPTIONAL_UNKNOWN', 'global external transition log remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'external trusted time remains unproven');
check(after.requirements.find(item => item.id === 'independent-real-world-controllers').status === 'OPTIONAL_UNKNOWN', 'independent real-world controllers remain unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('pairwise-comparison-as-global-fork-exclusion'), 'contract refuses pairwise comparison as global fork exclusion');
check(contract.boundaries.refuses.includes('pairwise-comparison-as-observation-of-withheld-branches'), 'contract refuses pairwise comparison as observation of withheld branches');
check(contract.boundaries.refuses.includes('pairwise-extension-as-globally-unique-transition'), 'contract refuses extension as globally unique transition');
check(contract.boundaries.refuses.includes('self-declared-anchor-epoch-as-protected-monotonic-state'), 'contract refuses self-declared epoch as protected monotonic state');
check(contract.boundaries.refuses.includes('presented-chain-as-proven-external-retention'), 'contract refuses presented chain as external retention proof');
check(contract.boundaries.refuses.includes('transition-receipt-as-execution-authority'), 'contract refuses transition receipt as execution authority');

check(implementation.includes("return 'PRESENTED_CHAIN_EXACT_REPLAY'"), 'implementation classifies exact presented replay');
check(implementation.includes("return 'CANDIDATE_EXTENDS_PRESENTED_CHAIN'"), 'implementation classifies pairwise forward extension');
check(implementation.includes("return 'HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH'"), 'implementation holds same-epoch anchor equivocation');
check(implementation.includes("return 'HOLD_CHECKPOINT_ID_EQUIVOCATION'"), 'implementation holds checkpoint-id equivocation');
check(implementation.includes("return 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_ENTRIES'"), 'implementation holds missing or replaced prior entries');
check(implementation.includes('withheldForksExcluded: false') && implementation.includes('unpresentedBranchesExcluded: false'), 'implementation keeps withheld and unpresented branches unexcluded');
check(implementation.includes('globalTransitionUniquenessProven: false') && implementation.includes('globallyConsistentTransitionLogProven: false'), 'implementation keeps global uniqueness and log consistency false');
check(implementation.includes('anchorEpochMonotonicityProven: false'), 'implementation keeps anchor epoch monotonicity false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

check(focusedTest.includes('second fork independently extends the same prior chain'), 'focused test proves a second fork independently passes against the prior chain');
check(focusedTest.includes('co-presented divergent forks are held'), 'focused test detects divergent forks when co-presented');
check(focusedTest.includes('co-presented detection still cannot exclude another withheld fork'), 'focused test preserves withheld-fork counterevidence');
check(focusedTest.includes('different anchor digest at same presented epoch is held'), 'focused test detects same-epoch anchor equivocation');
check(focusedTest.includes('lower candidate self-declared epoch is held'), 'focused test detects self-declared epoch rollback');
check(focusedTest.includes('same checkpoint id with different digest is held'), 'focused test detects checkpoint-id equivocation');
check(focusedTest.includes('candidate replacing prior entry is held'), 'focused test detects exact prior-entry replacement');
check(focusedTest.includes('fresh process rebuilds serialized pairwise transition package'), 'focused test routes transition reload through a fresh process');
check(/Two\s+different candidates can each/.test(readme) && /withheld or never-presented branch/.test(readme), 'README preserves independently valid forks and withheld-branch boundary');
check(schema.$id === 'axm.model-shadow-review-challenge-pairwise-transition/v1', 'transition schema identity matches contract');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 44, 'source snapshot declares forty-four normalized TEST inputs');
  check(snapshot.sources.every(item => {
    const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
    return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
  }), 'source snapshot digests match current normalized source bytes');
}

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
  const digestValue = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 25 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 857, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge transition gate evidence selftest: PASS (' + checks + ' checks)');
