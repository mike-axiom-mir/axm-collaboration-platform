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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-anchor-gate');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-anchor-gate.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const policySchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-anchor-policy.schema.json'), 'utf8'));
const authorizationSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-anchor-authorization.schema.json'), 'utf8'));
const witnessSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-anchored-witness.schema.json'), 'utf8'));
const auditSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-anchored-continuity.schema.json'), 'utf8'));

check(requirements.requirements.length === 23 && requirements.requirements.filter(item => item.required).length === 15, 'requirements separate fifteen bounded technical routes from eight protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 14, 'before report records fourteen missing anchor-gate capabilities');
check(before.requirements.find(item => item.id === 'upstream-witness-integrity').status === 'READY', 'before report preserves upstream v0.4 witness exact rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-witness-integrity').every(item => item.status === 'BLOCKED'), 'before report blocks every new required anchor-gate route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes required gaps while the real frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fifteen bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eight protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-anchor-pin').status === 'OPTIONAL_UNKNOWN', 'authenticated host anchor pin remains unproven');
check(after.requirements.find(item => item.id === 'actual-external-anchor-retention').status === 'OPTIONAL_UNKNOWN', 'actual external anchor retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-anchor-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic anchor state remains unproven');
check(after.requirements.find(item => item.id === 'authenticated-real-world-anchor-steward').status === 'OPTIONAL_UNKNOWN', 'real-world anchor steward identity remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'external trusted time remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('caller-presented-anchor-as-authenticated-host-trust-root'), 'contract refuses caller anchor as authenticated host trust');
check(contract.boundaries.refuses.includes('caller-presented-anchor-digest-as-authenticated-pin'), 'contract refuses caller digest as authenticated host pin');
check(contract.boundaries.refuses.includes('self-declared-anchor-epoch-as-monotonic-state'), 'contract refuses self-declared anchor epoch as monotonic state');
check(contract.boundaries.refuses.includes('anchor-key-possession-as-real-world-identity'), 'contract refuses anchor key possession as real-world identity');
check(contract.boundaries.refuses.includes('anchored-witness-as-proven-external-retention'), 'contract refuses anchored witness as external retention proof');
check(contract.boundaries.refuses.includes('anchored-witness-as-deletion-or-rollback-prevention'), 'contract refuses anchored witness as rollback prevention');
check(contract.boundaries.refuses.includes('anchor-signature-as-execution-authority'), 'contract refuses anchor signature as execution authority');

check(implementation.includes("crypto.verify(null, payload, key.key, signature)"), 'implementation uses native Ed25519 verification on the canonical anchor payload');
check(implementation.includes('caller-presented expected anchor digest does not match the exact anchor policy'), 'implementation requires exact caller-presented anchor digest match');
check(implementation.includes('witness policy digest mismatch') && implementation.includes('checkpoint digest mismatch'), 'implementation exact-binds authorizations to witness policy and checkpoint');
check(implementation.includes('ledger manifest digest mismatch') && implementation.includes('entries digest mismatch'), 'implementation exact-binds authorizations to ledger and entries digests');
check(implementation.includes('anchor public key fingerprint must be unique') && implementation.includes('anchor stewardDigest must be unique'), 'implementation refuses duplicate anchor seats');
check(implementation.includes('never private-key material'), 'implementation refuses private-key material');
check(implementation.includes('anchorPolicyAuthorityAuthenticated: false') && implementation.includes('expectedAnchorDigestAuthorityAuthenticated: false'), 'implementation keeps anchor authority and pin authority false');
check(implementation.includes('jointAnchorAndPinSubstitutionStillPossible: true'), 'implementation exposes the joint-substitution boundary as positive counterevidence');
check(implementation.includes('anchorEpochMonotonicityProven: false') && implementation.includes('anchoredWitnessExternallyRetained: false'), 'implementation keeps monotonicity and retention false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

check(focusedTest.includes('valid replacement witness policy cannot reuse original anchor authorizations'), 'focused test refuses witness-policy substitution relative to the fixed anchor pin');
check(focusedTest.includes('replacement anchor and matching pin with new keys can produce another cryptographically valid chain'), 'focused test preserves joint anchor-and-pin substitution counterevidence');
check(focusedTest.includes('fresh process verifies anchor chain and audits current ledger'), 'focused test routes anchor-chain reload through a fresh process');
check(focusedTest.includes('fresh anchored audit performs no ledger write'), 'focused test compares ledger fingerprints around fresh-process audit');
check(focusedTest.includes('anchored checkpoint detects relative rollback'), 'focused test detects rollback relative to the anchored checkpoint');
check(focusedTest.includes('private anchor key material is refused'), 'focused test exercises the public-key-only boundary');
check(focusedTest.includes('anchored witness receipt retains no raw authorization id'), 'focused test verifies digested authorization identifier retention');
check(/Replacing them\s+together/.test(readme) && /does not prove Mike or host trust/.test(readme), 'README preserves joint substitution and host-trust boundary');

check(policySchema.$id === 'axm.model-shadow-review-challenge-anchor-policy/v1', 'anchor policy schema identity matches contract');
check(authorizationSchema.$id === 'axm.model-shadow-review-challenge-anchor-authorization/v1', 'anchor authorization schema identity matches contract');
check(witnessSchema.$id === 'axm.model-shadow-review-challenge-anchored-witness/v1', 'anchored witness schema identity matches contract');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-anchored-continuity/v1', 'anchored audit schema identity matches contract');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 29, 'source snapshot declares twenty-nine normalized TEST inputs');
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
  check(results.status === 'PASS' && results.summary.commands === 23 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 664, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge anchor gate evidence selftest: PASS (' + checks + ' checks)');
