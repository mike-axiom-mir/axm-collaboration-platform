#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const ContractVerifier = require('../../../hub/module-contract-verifier');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-history-checkpoint-anchor');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-history-checkpoint-anchor.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 40, 'requirements inventory contains forty routes');
check(requirements.requirements.filter(item => item.required).length === 22, 'twenty-two bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 4, 'four upstream pattern capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 18, 'eighteen v2.2 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without a bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 22, 'all twenty-two required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 18, 'all eighteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 4, 'before inventory declares four available patterns');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 22, 'after inventory declares twenty-two bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(4, 22).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'authenticated-controller-independence', 'collusion-exclusion', 'authenticated-human-participation', 'authenticated-host-entrypoint',
  'externally-trusted-time', 'global-transition-uniqueness', 'globally-consistent-log', 'atomic-ledger-snapshot',
  'later-ledger-currentness', 'provider-execution', 'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches the Workshop contract shape');
check(contract.id === 'model-shadow-portable-history-checkpoint-anchor', 'contract identity is exact');
check(contract.version === 'v2.2' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.writes.length === 0, 'contract declares a read-only leaf');
check(contract.boundaries.refuses.includes('observable-key-and-digest-nonoverlap-as-controller-independence-or-collusion-exclusion'), 'contract refuses independence overclaim');
check(contract.boundaries.refuses.includes('joint-checkpoint-policy-signature-and-expected-anchor-replacement-as-original-continuity'), 'contract preserves joint-replacement counterevidence');
check(contract.boundaries.refuses.includes('execution-adoption-permission-install-promotion-merge-or-canon-authority'), 'contract refuses downstream authority');

check(source.includes("require('../model-shadow-two-phase-history-checkpoint/"), 'runtime composes exact v2.1 surface');
check(source.includes('History.validateCheckpoint('), 'runtime self-validates the v2.1 checkpoint');
check(source.includes('crypto.verify(') && !source.includes('crypto.sign('), 'runtime verifies but never creates a signature');
check(source.includes('must not share a verified public key fingerprint'), 'runtime refuses cross-layer verified key reuse');
check(source.includes('must not share a verified declared principal digest'), 'runtime refuses cross-layer declared-principal reuse');
check(source.includes('realWorldControllerIndependenceProven: false'), 'runtime refuses controller-independence claim');
check(source.includes('jointCheckpointPoliciesSignaturesAndExpectedAnchorReplacementStillPossible: true'), 'runtime preserves joint replacement in truth surface');
check(source.includes('History.auditCheckpoint('), 'runtime composes unchanged v2.1 read-only audit');
check(!source.includes("require('fs')") && !source.includes('writeFile') && !source.includes('.propose(') && !source.includes('.settle('), 'runtime contains no direct write path');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('generateKeyPair') && !source.includes('createPrivateKey'), 'runtime generates no key and accepts no private key API');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');

check(focused.includes('cross-layer verified key reuse fails closed'), 'focused test proves verified-key overlap refusal');
check(focused.includes('cross-layer declared principal reuse fails closed'), 'focused test proves declared-principal overlap refusal');
check(focused.includes('same-controller counterexample remains explicit'), 'focused test preserves same-controller counterexample');
check(focused.includes('jointly replaced checkpoint policies keys signatures and anchor still pass relatively'), 'focused test preserves joint-replacement counterexample');
check(focused.includes('fresh process rebuilds anchored checkpoint') && focused.includes('fresh process rebuilds anchored audit'), 'focused test proves fresh-process reconstruction');
check(focused.includes('anchored audit preserves v2.1 absence classification'), 'focused test preserves typed absent hold');
check(/One controller can generate all/.test(readme), 'README preserves same-controller boundary');
check(/jointly replace the/.test(readme), 'README preserves joint-replacement boundary');
check(/Browser render\/click evidence is not applicable/.test(routes), 'evidence routes preserve nonvisual browser boundary');

['witness-policy.schema.json', 'witness-attestation.schema.json', 'witness.schema.json', 'anchor-policy.schema.json',
  'anchor-authorization.schema.json', 'anchored-checkpoint.schema.json', 'anchored-audit.schema.json'].forEach(file => {
  check(readModule(file).additionalProperties === false, file + ' closes unknown top-level fields');
});

check(sourceSnapshot.sources.length === 178, 'source snapshot declares one hundred seventy-eight normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 38 && results.summary.passed === 38 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 2718, 'focused assertion count matches recorded outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable history-checkpoint anchor evidence selftest: PASS (' + checks + ' checks)');
