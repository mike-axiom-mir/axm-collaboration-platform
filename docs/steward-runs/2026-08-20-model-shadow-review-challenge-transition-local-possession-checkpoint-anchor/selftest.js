#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
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
const policySchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-policy.schema.json');
const authorizationSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-authorization.schema.json');
const receiptSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-anchored-witness.schema.json');
const auditSchema = readModule('model-shadow-review-challenge-transition-local-possession-anchored-continuity.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 37, 'requirements inventory contains thirty-seven exact routes');
check(requirements.requirements.filter(item => item.required).length === 16, 'sixteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 21, 'twenty-one broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 14, 'before comparator is BLOCKED by fourteen missing adapter capabilities');
check(before.requirements.filter(item => item.status === 'READY').length === 2, 'v1.5 witness and v0.5 anchor pattern were the two ready inputs');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 21, 'before comparator preserves twenty-one optional unknown routes');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.status === 'READY').length === 16, 'all sixteen bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 21, 'all twenty-one broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory retains two reusable capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 16, 'after inventory declares sixteen bounded capabilities');
const contractCapabilities = new Set(contract.provides);
const newRequired = requirements.requirements.filter(item => item.required && !['upstream-v1.5-witness', 'existing-v0.5-anchor-pattern'].includes(item.id));
check(newRequired.every(item => item.capabilities.every(capability => contractCapabilities.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'host-authenticated-anchor-pin', 'anchor-policy-authority', 'witness-policy-authority',
  'witness-policy-replacement-prevention', 'independently-operated-anchor-signers',
  'authenticated-human-anchor', 'independently-retained-anchor',
  'independently-retained-anchored-witness', 'independently-retained-checkpoint',
  'actual-network-transport', 'other-host-delivery', 'externally-trusted-time',
  'protected-monotonic-state', 'rollback-prevention', 'authenticated-host-entrypoint',
  'provider-execution', 'held-out-evaluation', 'branch-adoption',
  'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor', 'contract identity is exact');
check(contract.version === 'v1.6' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares a pure read/write boundary');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('relative-witness-policy-substitution-detection-as-replacement-prevention'), 'contract refuses relative detection as prevention');
check(contract.boundaries.refuses.includes('joint-anchor-pin-witness-policy-and-signature-substitution-as-original-policy-continuity'), 'contract preserves joint-substitution counterexample');
check(contract.boundaries.refuses.includes('caller-presented-anchor-as-authenticated-host-trust-root'), 'contract refuses caller anchor as host trust');
check(contract.boundaries.refuses.includes('declared-human-anchor-key-as-authenticated-human'), 'contract refuses declared human seat as authenticated human');
check(contract.boundaries.refuses.includes('anchored-witness-as-proven-external-retention'), 'contract refuses anchored receipt as external retention');
check(contract.boundaries.refuses.includes('private-key-ingestion'), 'contract refuses private-key ingestion');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/"), 'runtime composes the exact v1.5 validator');
check(source.includes('MAX_ANCHOR_KEYS = 10'), 'runtime declares exact anchor-seat bound');
check(source.includes('MAX_AUTHORIZATION_AGE_SECONDS = 86400'), 'runtime declares exact authorization-age bound');
check(source.includes('MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024'), 'runtime declares exact artifact byte bound');
check(source.includes('crypto.verify'), 'runtime performs native detached Ed25519 verification');
check(source.includes('sourceSnapshotDigest !== witness.sourceSnapshotRef.sha256'), 'runtime binds exact source snapshot');
check(source.includes('receiverIdDigest !== witness.receiverIdDigest'), 'runtime binds exact receiver identity');
check(source.includes('challengerIdDigest !== witness.challengerIdDigest'), 'runtime binds exact challenger identity');
check(source.includes('receiverPolicyDigest !== witness.receiverPolicyRef.sha256'), 'runtime binds exact receiver policy');
check(source.includes('witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true'), 'runtime declares bounded relative substitution detection');
check(source.includes('jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true'), 'runtime preserves joint-substitution counterexample');
check(source.includes('witnessPolicyReplacementPrevented: false'), 'runtime keeps policy replacement prevention false');
check(source.includes('anchorPolicyAuthorityAuthenticated: false'), 'runtime keeps anchor authority false');
check(source.includes('anchorExternallyRetained: false'), 'runtime keeps anchor retention false');
check(source.includes('checkpointDeletionOrRollbackPrevented: false'), 'runtime keeps rollback prevention false');
check(!source.includes("require('fs')") && !source.includes("require('child_process')"), 'runtime imports no filesystem or process capability');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey') && !source.includes('privateKeyPem'), 'runtime performs no signing and accepts no private-key field');
check(source.includes('privateKeyIngested: false'), 'runtime keeps private-key ingestion false');
check(!source.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

check(focusedTest.includes('older ledger anchor cannot consume the v1.5 possession witness'), 'focused test proves contract incompatibility');
check(focusedTest.includes('fresh process verifies anchored exact state'), 'focused test proves fresh-process comparison');
check(focusedTest.includes('fresh process detects deletion against anchored checkpoint'), 'focused test proves anchored deletion detection');
check(focusedTest.includes('valid signed response replacement is detected through anchor'), 'focused test proves anchored signed replacement detection');
check(focusedTest.includes('replacement witness policy cannot reuse original anchor signatures'), 'focused test proves relative policy substitution detection');
check(focusedTest.includes('original anchor keys can explicitly authorize a replacement witness policy'), 'focused test preserves original-anchor reauthorization');
check(focusedTest.includes('joint replacement anchor pin witness policy and signatures can form a valid chain'), 'focused test preserves joint replacement counterexample');
check(focusedTest.includes('private key material is refused'), 'focused test proves private-key refusal');
check(focusedTest.includes("['sourceSnapshotDigest'"), 'focused test covers source snapshot binding table');
check(focusedTest.includes("['receiverPolicyDigest'"), 'focused test covers receiver policy binding table');
check(focusedTest.includes('anchored absence becomes typed hold'), 'focused test proves anchored absence hold');
check(focusedTest.includes('anchored identity drift becomes typed hold'), 'focused test proves anchored identity hold');
check(/replacing the anchor, pin, witness\s+policy, witness and signatures together/i.test(readme), 'README preserves joint-substitution counterexample');
check(/Verdict: `FAIL` as an\s+authenticated-authority or prevention claim/.test(routes), 'evidence routes refuse broad authenticated-authority claim');

check(policySchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-policy/v1', 'policy schema identity is exact');
check(authorizationSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-authorization/v1', 'authorization schema identity is exact');
check(receiptSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchored-witness/v1', 'receipt schema identity is exact');
check(auditSchema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-anchored-continuity/v1', 'audit schema identity is exact');
check([policySchema, authorizationSchema, receiptSchema, auditSchema].every(schema => schema.additionalProperties === false), 'all four public schemas close unknown fields');
check(policySchema.properties.authorityOrigin.const === 'CALLER_PRESENTED_PIN_UNAUTHENTICATED', 'policy schema admits unauthenticated presented pin');
check(policySchema.properties.requiredSignatures.maximum === 10 && policySchema.properties.maxAuthorizationAgeSeconds.maximum === 86400, 'policy schema enforces seat and age bounds');
check(receiptSchema.$defs.truth.properties.witnessPolicySubstitutionDetectedRelativeToPresentedAnchor.const === true, 'receipt schema declares bounded relative detection');
check(receiptSchema.$defs.truth.properties.witnessPolicyReplacementPrevented.const === false, 'receipt schema keeps replacement prevention false');
check(receiptSchema.$defs.truth.properties.jointAnchorPinAndWitnessPolicySubstitutionStillPossible.const === true, 'receipt schema keeps joint substitution true');
check(receiptSchema.$defs.truth.properties.anchorPolicyAuthorityAuthenticated.const === false, 'receipt schema keeps anchor authority false');
check(receiptSchema.$defs.truth.properties.anchoredWitnessExternallyRetained.const === false, 'receipt schema keeps external retention false');
check(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const === false, 'audit schema keeps checkpoint prevention false');
check(auditSchema.$defs.truth.properties.currentResponseStateDeletionOrRollbackPrevented.const === false, 'audit schema keeps response-state prevention false');
check(auditSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous repair');
check(auditSchema.$defs.snapshotSummary.additionalProperties === false && auditSchema.$defs.comparison.additionalProperties === false, 'audit nested public shapes are exact');

check(sourceSnapshot.sources.length === 125, 'source snapshot declares one hundred twenty-five normalized TEST inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match current normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 34 && results.summary.passed === 34 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 2218, 'focused assertion count matches recorded command outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession checkpoint anchor evidence selftest: PASS (' + checks + ' checks)');
