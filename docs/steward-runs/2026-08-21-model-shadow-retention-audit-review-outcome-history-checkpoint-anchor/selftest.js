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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const routes = read('EVIDENCE_ROUTES.json');
const sources = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');

check(requirements.requirements.length === 33, 'requirements inventory contains thirty-three routes');
check(requirements.requirements.filter(item => item.required).length === 21, 'twenty-one bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 12, 'twelve broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream requirement was ready before v3.4');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 20, 'twenty v3.4 requirements were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 12, 'twelve optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 21, 'all twenty-one bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 12, 'all twelve broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only the exact upstream seam');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 21, 'after inventory exposes twenty-one bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 12, 'after inventory preserves twelve unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor', 'contract identity is exact');
check(contract.version === 'v3.4' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-history-checkpoint-anchor.')).length === 20, 'contract declares exactly twenty bounded adapter capabilities');
check(contract.boundaries.refuses.includes('joint-checkpoint-policy-signature-and-anchor-replacement-as-original-history'), 'contract refuses joint replacement as original history');
check(contract.boundaries.refuses.includes('approved-history-or-signatures-as-retention-hold-resolution-remediation-execution-or-adoption-authority'), 'contract refuses signature authority inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint/"), 'runtime composes exact v3.3 module');
check(source.includes('crypto.verify') && !source.includes('crypto.sign'), 'runtime verifies but never signs');
check(!/generateKeyPair|createPrivateKey|\bfetch\s*\(|writeFile|mkdir/.test(source), 'runtime has no key generation private-key network or direct write surface');
check(source.includes('witnessPolicyAuthorityAuthenticated: false'), 'runtime refuses witness-policy authority');
check(source.includes('anchorPolicyAuthorityAuthenticated: false'), 'runtime refuses anchor-policy authority');
check(source.includes('sameControllerWithDistinctKeysAndDigestsStillPossible: true'), 'runtime preserves same-controller counterexample');
check(source.includes('jointCheckpointPoliciesSignaturesAndExpectedAnchorReplacementStillPossible: true'), 'runtime preserves joint-package replacement counterexample');
check(source.includes('retentionHoldResolved: false') && source.includes('executionAuthorized: false'), 'runtime refuses hold resolution and execution authority');
check(source.includes('humanBenefitProven: false') && source.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

[
  'witness exact-rebuilds', 'anchored checkpoint exact-rebuilds', 'anchored audit exact-rebuilds',
  'wrong witness signature fails closed', 'wrong anchor signature fails closed',
  'cross-layer verified key reuse fails closed', 'cross-layer principal reuse fails closed',
  'jointly replaced checkpoint policies keys signatures and anchor still pass relatively'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(/One controller can create every[\s\S]+distinct key and digest/.test(readme), 'README preserves same-controller boundary');
check(/replace the checkpoint, both[\s\S]+policies, every signature/.test(readme), 'README preserves joint-replacement boundary');

['witness-policy.schema.json', 'witness-attestation.schema.json', 'witness.schema.json', 'anchor-policy.schema.json', 'anchor-authorization.schema.json', 'anchored-checkpoint.schema.json', 'anchored-audit.schema.json'].forEach(name => {
  const schema = readModule(name);
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
  check(schema.additionalProperties === false, name + ' closes unknown top-level fields');
});
check(readModule('witness-policy.schema.json').$defs.key.additionalProperties === false, 'witness policy closes key seats');
check(readModule('anchor-policy.schema.json').$defs.key.additionalProperties === false, 'anchor policy closes key seats');
check(readModule('anchored-checkpoint.schema.json').properties.separationEvidence.additionalProperties === false, 'anchored schema closes separation evidence');

check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route keeps pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'authority-and-replacement-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');
check(/Browser verification: not applicable/.test(summary), 'summary marks browser verification not applicable');
check(/schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/52\/52 commands passed/.test(summary) && /4,629 focused assertions/.test(summary), 'summary preserves exact verification totals');
check(/fixture-order mistake/.test(summary) && /genuine v3.3 test flake/.test(summary), 'summary preserves both observed failures and corrections');

check(sources.sources.length === 286, 'source snapshot declares two hundred eighty-six normalized inputs');
check(sources.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 52 && results.summary.passed === 52 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4629, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 42, 'forty-two focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nReview-outcome history checkpoint anchor evidence selftest: PASS (' + checks + ' checks)');
