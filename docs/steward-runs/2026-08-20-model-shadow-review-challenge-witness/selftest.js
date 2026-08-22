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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-witness');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-witness.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const policySchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-witness-policy.schema.json'), 'utf8'));
const attestationSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-witness-attestation.schema.json'), 'utf8'));
const witnessSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-witness.schema.json'), 'utf8'));
const auditSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-witnessed-continuity.schema.json'), 'utf8'));

check(requirements.requirements.length === 21 && requirements.requirements.filter(item => item.required).length === 13, 'requirements separate thirteen bounded technical routes from eight protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 12, 'before report records twelve missing checkpoint-witness capabilities');
check(before.requirements.find(item => item.id === 'upstream-checkpoint-integrity').status === 'READY', 'before report preserves upstream checkpoint exact rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-checkpoint-integrity').every(item => item.status === 'BLOCKED'), 'before report blocks every new required checkpoint-witness route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes required gaps while the real frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all thirteen bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eight protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-witness-policy').status === 'OPTIONAL_UNKNOWN', 'authenticated host witness policy remains unproven');
check(after.requirements.find(item => item.id === 'actual-external-witness-retention').status === 'OPTIONAL_UNKNOWN', 'actual external witness retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-ledger-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'authenticated-real-world-signer').status === 'OPTIONAL_UNKNOWN', 'real-world signer identity remains unproven');
check(after.requirements.find(item => item.id === 'externally-trusted-time').status === 'OPTIONAL_UNKNOWN', 'external trusted time remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('caller-witness-policy-as-authenticated-host-trust-root'), 'contract refuses caller policy as authenticated host trust');
check(contract.boundaries.refuses.includes('signing-key-possession-as-real-world-identity'), 'contract refuses key possession as real-world identity');
check(contract.boundaries.refuses.includes('signed-checkpoint-as-proven-external-retention'), 'contract refuses checkpoint signature as retention proof');
check(contract.boundaries.refuses.includes('signed-checkpoint-as-deletion-or-rollback-prevention'), 'contract refuses signature as rollback prevention');
check(contract.boundaries.refuses.includes('signature-as-execution-authority'), 'contract refuses signature as execution authority');

check(implementation.includes("crypto.verify(null, payload, key.key, signature)"), 'implementation uses native Ed25519 verification on the canonical attestation payload');
check(implementation.includes('checkpoint witness key policy checkpoint reference mismatch'), 'implementation exact-binds policy to checkpoint reference');
check(implementation.includes('ledger manifest digest mismatch') && implementation.includes('entries digest mismatch'), 'implementation exact-binds signatures to ledger and entries digests');
check(implementation.includes('checkpoint witness public key fingerprint must be unique') && implementation.includes('actorDigest must be unique'), 'implementation refuses duplicate witness seats');
check(implementation.includes('never private-key material'), 'implementation refuses private-key material');
check(implementation.includes('policyAuthorityAuthenticated: false') && implementation.includes('signerRealWorldIdentityProven: false'), 'implementation keeps policy authority and signer identity false');
check(implementation.includes('checkpointExternalRetentionProven: false') && implementation.includes('ledgerDeletionOrRollbackPrevented: false'), 'implementation keeps retention and prevention false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

check(focusedTest.includes('replacement caller policy with its own keys can produce another cryptographically valid witness'), 'focused test preserves caller-policy substitution counterevidence');
check(focusedTest.includes('recomputed self-digest alone can make a modified checkpoint structurally valid'), 'focused test demonstrates the self-digest seam that signatures bound');
check(focusedTest.includes('fresh process verifies witness and audits current ledger'), 'focused test routes witness reload through a fresh process');
check(focusedTest.includes('fresh witnessed audit performs no ledger write'), 'focused test compares ledger fingerprints around fresh-process audit');
check(focusedTest.includes('witnessed checkpoint detects relative rollback'), 'focused test detects rollback relative to the signed checkpoint');
check(focusedTest.includes('private key material is refused'), 'focused test exercises the public-key-only boundary');
check(focusedTest.includes('witness receipt retains no raw attestation id'), 'focused test verifies digested attestation identifier retention');
check(/replacement\s+policy/.test(readme) && /does not authenticate a host trust root/.test(readme), 'README preserves the policy-swap and host-trust boundary');

check(policySchema.$id === 'axm.model-shadow-review-challenge-witness-policy/v1', 'policy schema identity matches contract');
check(attestationSchema.$id === 'axm.model-shadow-review-challenge-witness-attestation/v1', 'attestation schema identity matches contract');
check(witnessSchema.$id === 'axm.model-shadow-review-challenge-witness/v1', 'witness schema identity matches contract');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-witnessed-continuity/v1', 'witnessed audit schema identity matches contract');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 20, 'source snapshot declares twenty normalized TEST inputs');
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
  check(results.status === 'PASS' && results.summary.commands === 22 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 561, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge checkpoint witness evidence selftest: PASS (' + checks + ' checks)');
