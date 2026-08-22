#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');
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
const policySchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-witness-policy.schema.json');
const attestationSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-witness-attestation.schema.json');
const witnessSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-witness.schema.json');
const auditSchema = readModule('model-shadow-review-challenge-transition-local-possession-witnessed-continuity.schema.json');
const implementation = text('model-shadow-review-challenge-transition-local-possession-checkpoint-witness.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 32, 'requirements inventory contains thirty-two exact routes');
check(requirements.requirements.filter(item => item.required).length === 14, 'fourteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 12, 'before comparator is BLOCKED by twelve missing adapter capabilities');
check(before.requirements.filter(item => item.required && item.status === 'READY').length === 2, 'v1.4 checkpoint and v0.4 pattern were the two ready inputs');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all eighteen broader routes remain UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory retains two reusable available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 14, 'after inventory declares fourteen bounded available capabilities');
const newAvailable = afterInventory.capabilities.filter(item => item.status === 'available' && item.id.includes('.local-possession-checkpoint-witness.'));
check(newAvailable.length === 12 && newAvailable.every(item => contract.provides.includes(item.id)), 'contract provides every new bounded capability by exact id');
check(after.requirements.find(item => item.id === 'host-trusted-witness-policy').status === 'OPTIONAL_UNKNOWN', 'host-trusted witness policy remains unproven');
check(after.requirements.find(item => item.id === 'caller-policy-continuity').status === 'OPTIONAL_UNKNOWN', 'caller-policy continuity remains unproven');
check(after.requirements.find(item => item.id === 'independently-operated-signers').status === 'OPTIONAL_UNKNOWN', 'independent signers remain unproven');
check(after.requirements.find(item => item.id === 'authenticated-human-signer').status === 'OPTIONAL_UNKNOWN', 'authenticated human signer remains unproven');
check(after.requirements.find(item => item.id === 'independently-retained-witness').status === 'OPTIONAL_UNKNOWN', 'external witness retention remains unproven');
check(after.requirements.find(item => item.id === 'independently-retained-checkpoint').status === 'OPTIONAL_UNKNOWN', 'external checkpoint retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'rollback-prevention').status === 'OPTIONAL_UNKNOWN', 'rollback prevention remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness' && contract.version === 'v1.5', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract is TEST with no permission');
check(contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares a pure read/write boundary');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('caller-witness-policy-as-authenticated-host-trust-root'), 'contract refuses caller policy as host trust');
check(contract.boundaries.refuses.includes('replacement-caller-policy-with-valid-signatures-as-original-policy-continuity'), 'contract preserves replacement-policy counterexample');
check(contract.boundaries.refuses.includes('signing-key-possession-as-real-world-identity'), 'contract refuses key possession as identity');
check(contract.boundaries.refuses.includes('declared-human-key-as-authenticated-human'), 'contract refuses declared human key as authenticated human');
check(contract.boundaries.refuses.includes('signed-checkpoint-as-proven-external-retention'), 'contract refuses signed checkpoint as external retention');
check(contract.boundaries.refuses.includes('witness-as-proven-external-retention'), 'contract refuses witness as external retention');
check(contract.boundaries.refuses.includes('signed-checkpoint-as-deletion-or-rollback-prevention'), 'contract refuses signatures as rollback prevention');
check(contract.boundaries.refuses.includes('private-key-ingestion'), 'contract refuses private-key ingestion');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(implementation.includes("require('../model-shadow-review-challenge-transition-local-possession-continuity/"), 'runtime composes the exact v1.4 validator');
check(implementation.includes("const MAX_WITNESSES = 10"), 'runtime declares exact witness-seat bound');
check(implementation.includes("const MAX_ATTESTATION_AGE_SECONDS = 86400"), 'runtime declares exact attestation-age bound');
check(implementation.includes("const MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024"), 'runtime declares exact artifact byte bound');
check(implementation.includes("crypto.verify(null, payload, key.key, signature)"), 'runtime performs native detached Ed25519 verification');
check(implementation.includes("Continuity.validateCheckpoint"), 'runtime exact-validates v1.4 checkpoint');
check(implementation.includes("Continuity.buildAudit"), 'runtime composes unchanged v1.4 continuity audit');
check(implementation.includes("policyAuthorityAuthenticated: false"), 'runtime keeps policy authority false');
check(implementation.includes("callerPolicyReplacementPrevented: false"), 'runtime keeps policy-replacement prevention false');
check(implementation.includes("checkpointExternalRetentionProven: false"), 'runtime keeps external checkpoint retention false');
check(implementation.includes("witnessExternalRetentionProven: false"), 'runtime keeps external witness retention false');
check(implementation.includes("checkpointDeletionOrRollbackPrevented: false"), 'runtime keeps checkpoint rollback prevention false');
check(implementation.includes("currentResponseStateDeletionOrRollbackPrevented: false"), 'runtime keeps response-state rollback prevention false');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime imports no filesystem or process capability');
check(!implementation.includes("require('http')") && !implementation.includes("require('https')") && !implementation.includes("require('net')") && !implementation.includes('fetch('), 'runtime opens no network route');
check(!implementation.includes('crypto.sign') && !implementation.includes('createPrivateKey') && !implementation.includes('privateKeyPem'), 'runtime performs no signing and accepts no private-key field');
check(!implementation.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

check(focusedTest.includes('older ledger witness cannot consume the v1.4 possession checkpoint'), 'focused test proves contract incompatibility');
check(focusedTest.includes('witnessed comparison executes in a distinct child process'), 'focused test proves fresh-process comparison');
check(focusedTest.includes('fresh process detects deletion against witnessed checkpoint'), 'focused test proves witnessed deletion detection');
check(focusedTest.includes('valid signed response replacement is detected against witness'), 'focused test proves witnessed signed replacement detection');
check(focusedTest.includes('recomputed self-digest alone can make modified checkpoint structurally valid'), 'focused test preserves self-digest counterexample');
check(focusedTest.includes('replacement caller policy with its own keys can witness modified checkpoint'), 'focused test preserves replacement-policy counterexample');
check(focusedTest.includes("['checkpointDigest'") && focusedTest.includes("'wrong checkpoint digest'"), 'focused test verifies checkpoint binding under a valid wrong signature payload');
check(focusedTest.includes('private key material is refused'), 'focused test proves private-key refusal');
check(focusedTest.includes('witnessed absence becomes typed hold'), 'focused test proves witnessed absence hold');
check(focusedTest.includes('witnessed identity drift becomes typed hold'), 'focused test proves witnessed identity hold');
check(/replacement\s+policy and its own valid signatures/.test(readme), 'README preserves replacement-policy counterexample');

check(policySchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-witness-policy/v1', 'policy schema identity is exact');
check(attestationSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-witness-attestation/v1', 'attestation schema identity is exact');
check(witnessSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-witness/v1', 'witness schema identity is exact');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-witnessed-continuity/v1', 'audit schema identity is exact');
check(policySchema.additionalProperties === false && attestationSchema.additionalProperties === false && witnessSchema.additionalProperties === false && auditSchema.additionalProperties === false, 'all four public schemas close unknown fields');
check(policySchema.properties.authorityOrigin.const === 'CALLER_SUPPLIED_UNAUTHENTICATED', 'policy schema admits unauthenticated origin');
check(policySchema.properties.keys.maxItems === 10 && policySchema.properties.maxAttestationAgeSeconds.maximum === 86400, 'policy schema enforces seat and age bounds');
check(witnessSchema.$defs.truth.properties.policyAuthorityAuthenticated.const === false, 'witness schema keeps policy authority false');
check(witnessSchema.$defs.truth.properties.callerPolicyReplacementPrevented.const === false, 'witness schema keeps policy replacement prevention false');
check(witnessSchema.$defs.truth.properties.declaredHumanSignerIsAuthenticatedHuman.const === false, 'witness schema keeps authenticated-human claim false');
check(witnessSchema.$defs.truth.properties.checkpointExternalRetentionProven.const === false && witnessSchema.$defs.truth.properties.witnessExternalRetentionProven.const === false, 'witness schema keeps both external-retention claims false');
check(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const === false, 'audit schema keeps checkpoint prevention false');
check(auditSchema.$defs.truth.properties.currentResponseStateDeletionOrRollbackPrevented.const === false, 'audit schema keeps response-state prevention false');
check(auditSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous repair');
check(auditSchema.$defs.truth.properties.automaticMerge.const === false && auditSchema.$defs.truth.properties.automaticCanon.const === false, 'audit schema keeps merge and CANON false');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 116, 'source snapshot declares one hundred sixteen normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 33 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1988, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession checkpoint witness evidence selftest: PASS (' + checks + ' checks)');
