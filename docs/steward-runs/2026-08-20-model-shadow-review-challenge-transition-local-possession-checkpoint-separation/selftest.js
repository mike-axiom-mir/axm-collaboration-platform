#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
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
const receiptSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-separated-witness.schema.json');
const auditSchema = readModule('model-shadow-review-challenge-transition-local-possession-separated-continuity.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-review-challenge-transition-local-possession-checkpoint-separation.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 37, 'requirements inventory contains thirty-seven exact routes');
check(requirements.requirements.filter(item => item.required).length === 12, 'twelve bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 25, 'twenty-five broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 10, 'before comparator is BLOCKED by ten missing adapter capabilities');
check(before.requirements.filter(item => item.status === 'READY').length === 2, 'v1.6 anchor and v0.6 separation pattern were the two ready inputs');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 25, 'before comparator preserves twenty-five optional unknown routes');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.status === 'READY').length === 12, 'all twelve bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 25, 'all twenty-five broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory retains two reusable capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 12, 'after inventory declares twelve bounded capabilities');
const contractCapabilities = new Set(contract.provides);
const newRequired = requirements.requirements.filter(item => item.required && !['upstream-v1.6-anchored-witness', 'existing-v0.6-separation-pattern'].includes(item.id));
check(newRequired.every(item => item.capabilities.every(capability => contractCapabilities.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'independent-key-custody', 'independent-real-world-controllers',
  'authenticated-principal-mapping', 'cross-layer-collusion-exclusion',
  'host-authenticated-anchor-pin', 'anchor-policy-authority',
  'witness-policy-authority', 'witness-policy-replacement-prevention',
  'independently-operated-anchor-signers', 'authenticated-human-anchor',
  'independently-retained-anchor', 'independently-retained-separation-receipt',
  'independently-retained-checkpoint', 'actual-network-transport',
  'other-host-delivery', 'externally-trusted-time', 'protected-monotonic-state',
  'rollback-prevention', 'authenticated-host-entrypoint', 'provider-execution',
  'held-out-evaluation', 'branch-adoption', 'held-out-human-benefit',
  'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-separation', 'contract identity is exact');
check(contract.version === 'v1.7' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares a pure read/write boundary');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('distinct-key-fingerprints-as-independent-key-custody-proof'), 'contract refuses distinct keys as custody independence');
check(contract.boundaries.refuses.includes('distinct-declared-principal-digests-as-different-real-world-people'), 'contract refuses declared digests as real-world identity');
check(contract.boundaries.refuses.includes('observable-nonoverlap-as-independent-controller-proof'), 'contract refuses non-overlap as controller independence');
check(contract.boundaries.refuses.includes('observable-nonoverlap-as-collusion-exclusion'), 'contract refuses non-overlap as anti-collusion proof');
check(contract.boundaries.refuses.includes('separation-receipt-as-proven-external-retention'), 'contract refuses separation as external retention');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/"), 'runtime composes the exact v1.6 validator');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/"), 'runtime composes the exact v1.5 validator');
check(source.includes('MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024'), 'runtime declares exact artifact byte bound');
check(source.includes("setDigest('local-possession-witness-key-fingerprints'"), 'runtime uses witness-key domain separation');
check(source.includes("setDigest('local-possession-anchor-key-fingerprints'"), 'runtime uses anchor-key domain separation');
check(source.includes("setDigest('local-possession-witness-declared-principal-digests'"), 'runtime uses witness-principal domain separation');
check(source.includes("setDigest('local-possession-anchor-declared-principal-digests'"), 'runtime uses anchor-principal domain separation');
check(source.includes('if (sharedFingerprints.length)'), 'runtime refuses exact cross-layer key overlap');
check(source.includes('if (sharedPrincipalDigests.length)'), 'runtime refuses exact cross-layer principal overlap');
check(source.includes('realWorldControllerIndependenceProven: false'), 'runtime keeps controller independence false');
check(source.includes('declaredPrincipalDigestsAuthenticated: false'), 'runtime keeps principal authentication false');
check(source.includes('sameControllerWithDistinctKeysStillPossible: true'), 'runtime preserves same-controller counterexample truth');
check(source.includes('crossLayerCollusionExcluded: false'), 'runtime keeps anti-collusion false');
check(source.includes('witnessPolicyReplacementPrevented: false'), 'runtime keeps policy replacement prevention false');
check(source.includes('separationReceiptExternallyRetained: false'), 'runtime keeps external receipt retention false');
check(source.includes('checkpointDeletionOrRollbackPrevented: false'), 'runtime keeps rollback prevention false');
check(!source.includes("require('fs')") && !source.includes("require('child_process')"), 'runtime imports no filesystem or process capability');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');
check(!source.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

check(focusedTest.includes('older ledger separation gate cannot consume the v1.6 possession anchor'), 'focused test proves old-contract incompatibility');
check(focusedTest.includes('cross-layer public key reuse is refused'), 'focused test proves cross-layer key overlap refusal');
check(focusedTest.includes('cross-layer declared-principal reuse is refused'), 'focused test proves cross-layer principal overlap refusal');
check(focusedTest.includes('one synthetic controller with distinct keys and digests passes observable non-overlap'), 'focused test preserves same-controller counterexample');
check(focusedTest.includes('fresh process verifies separated exact state'), 'focused test proves fresh-process exact comparison');
check(focusedTest.includes('fresh process detects deletion through separated chain'), 'focused test proves fresh-process deletion detection');
check(focusedTest.includes('separated absence becomes typed hold'), 'focused test proves absence hold');
check(focusedTest.includes('separated invalid state becomes typed hold'), 'focused test proves invalidity hold');
check(focusedTest.includes('separated identity drift becomes typed hold'), 'focused test proves identity hold');
check(/One controller can generate distinct keys/.test(readme), 'README preserves the one-controller counterexample');
check(/Verdict: `FAIL` as an independence,\s+identity or anti-collusion claim/.test(routes), 'evidence routes refuse broad independence claims');

check(receiptSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-separated-witness/v1', 'receipt schema identity is exact');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-separated-continuity/v1', 'audit schema identity is exact');
check(receiptSchema.additionalProperties === false && auditSchema.additionalProperties === false, 'both public schemas close unknown fields');
check(receiptSchema.properties.separationEvidence.properties.sharedKeyFingerprintCount.const === 0, 'receipt schema requires zero shared key fingerprints');
check(receiptSchema.properties.separationEvidence.properties.sharedDeclaredPrincipalDigestCount.const === 0, 'receipt schema requires zero shared principal digests');
check(receiptSchema.$defs.truth.properties.realWorldControllerIndependenceProven.const === false, 'receipt schema keeps controller independence false');
check(receiptSchema.$defs.truth.properties.sameControllerWithDistinctKeysStillPossible.const === true, 'receipt schema preserves same-controller possibility');
check(receiptSchema.$defs.truth.properties.crossLayerCollusionExcluded.const === false, 'receipt schema keeps collusion exclusion false');
check(receiptSchema.$defs.truth.properties.separationReceiptExternallyRetained.const === false, 'receipt schema keeps external retention false');
check(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const === false, 'audit schema keeps checkpoint prevention false');
check(auditSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous repair');

check(sourceSnapshot.sources.length === 133, 'source snapshot declares one hundred thirty-three normalized TEST inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match current normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 35 && results.summary.passed === 35 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 2407, 'focused assertion count matches recorded command outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession checkpoint separation evidence selftest: PASS (' + checks + ' checks)');
