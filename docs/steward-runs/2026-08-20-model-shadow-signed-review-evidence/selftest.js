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
const contract = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-signed-review-evidence/module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(root, 'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-evidence.js'), 'utf8');
const policySchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-signed-review-evidence/model-shadow-review-key-policy.schema.json'), 'utf8'));
const attestationSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-attestation.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-signed-review-evidence/model-shadow-signed-review-receipt.schema.json'), 'utf8'));

check(requirements.requirements.length === 9 && requirements.requirements.filter(item => item.required).length === 5, 'requirements separate five bounded technical routes from four optional real-world routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 6, 'before report records six missing signed-review capabilities');
check(before.requirements.find(item => item.id === 'exact-upstream-reviewed-handoff').status === 'READY', 'before report preserves the already-ready v1.0 exact handoff');
check(before.requirements.filter(item => item.required && item.id !== 'exact-upstream-reviewed-handoff').every(item => item.status === 'BLOCKED'), 'before report blocks every new required route');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after report closes required technical routes while remaining degraded by optional real-world seams');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all four external authority and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'host-trust-anchor').status === 'OPTIONAL_UNKNOWN', 'host trust root remains explicitly unproven');
check(after.requirements.find(item => item.id === 'single-use-challenge-ledger').status === 'OPTIONAL_UNKNOWN', 'single-use challenge persistence remains explicitly unbuilt');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains explicitly unrun');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains a permissionless write-free TEST leaf');
check(contract.boundaries.refuses.includes('caller-key-policy-as-authenticated-host-trust-root'), 'contract refuses caller policy as host trust substitution');
check(contract.boundaries.refuses.includes('key-possession-as-real-world-identity') && contract.boundaries.refuses.includes('declared-human-key-as-authenticated-human'), 'contract refuses key-possession as identity or humanity substitution');
check(contract.boundaries.refuses.includes('signature-as-execution-authority') && contract.boundaries.refuses.includes('signature-as-adoption-authority'), 'contract refuses signature as consequential authority');
check(policySchema.$id === 'axm.model-shadow-review-key-policy/v1' && attestationSchema.$id === 'axm.model-shadow-signed-review-attestation/v1' && receiptSchema.$id === 'axm.model-shadow-signed-review-receipt/v1', 'schema identities bind policy, attestation and receipt contracts');
check(implementation.includes('crypto.verify') && implementation.includes("asymmetricKeyType !== 'ed25519'"), 'implementation performs native Ed25519 verification and key-type refusal');
check(implementation.includes('attestation.planDigest !== handoff.plan.planDigest') && implementation.includes('does not bind an approval retained'), 'implementation binds exact plan and retained Review Inbox approval');
check(implementation.includes("AUTHORITY_ORIGIN = 'CALLER_SUPPLIED_UNAUTHENTICATED'") && implementation.includes('callerPolicyAuthorityAuthenticated: false'), 'implementation admits caller policy is not authenticated host authority');
check(implementation.includes('actualHumanParticipationProven: false') && implementation.includes('challengeSingleUseProven: false'), 'implementation keeps human participation and replay claims open');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes('fetch(') && !implementation.includes('child_process'), 'implementation contains no file, network, or process side-effect route');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 13, 'source snapshot declares thirteen normalized TEST inputs');
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
  check(results.status === 'PASS' && results.summary.commands === 19 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 329, 'focused assertion count matches the recorded command outputs');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow signed review evidence selftest: PASS (' + checks + ' checks)');
