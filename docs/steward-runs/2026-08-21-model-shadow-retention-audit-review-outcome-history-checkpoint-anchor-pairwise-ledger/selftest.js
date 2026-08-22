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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function everyObjectClosed(schema) {
  let pass = true;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object' && value.additionalProperties !== false) pass = false;
    Object.values(value).forEach(walk);
  }
  walk(schema); return pass;
}

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const routes = read('EVIDENCE_ROUTES.json');
const sources = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const schemas = ['manifest.schema.json', 'entry.schema.json', 'snapshot.schema.json'].map(readModule);
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const inheritedTest = fs.readFileSync(path.join(root, 'shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const frontier = fs.readFileSync(path.join(dir, 'FRONTIER_AUDIT.md'), 'utf8');

check(requirements.requirements.length === 37, 'requirements inventory contains thirty-seven routes');
check(requirements.requirements.filter(item => item.required).length === 25, 'twenty-five bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 12, 'twelve broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream route was ready before v3.6');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 24, 'twenty-four v3.6 routes were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 12, 'twelve optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 25, 'all twenty-five bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 12, 'all twelve broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only the committed upstream seam');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 25, 'after inventory exposes twenty-five bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 12, 'after inventory preserves twelve unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger', 'contract identity is exact');
check(contract.version === 'v3.6' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger.')).length === 24, 'contract declares twenty-four bounded adapter capabilities');
check(contract.boundaries.refuses.includes('write-or-fsync-failure-as-proof-that-no-inspectable-file-remains'), 'contract refuses fsync-failure overclaim');
check(contract.boundaries.refuses.includes('caller-owned-local-files-as-independent-external-retention-protected-monotonic-state-or-rollback-prevention'), 'contract refuses local-root trust inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/"), 'runtime composes exact v3.5 module');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime exclusively creates local artifacts');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs before successful return');
check(source.includes('successfulRecordReturnRequiresEntryFileFsync: true'), 'runtime states the successful-return fsync requirement');
check(source.includes('writeAndReloadCompletionPersistedSeparately: false'), 'runtime denies persisted completion proof');
check(source.includes('globalTransitionUniquenessProven: false') && source.includes('externalRetentionProven: false'), 'runtime refuses globality and retention claims');
check(source.includes('executionAuthorized: false') && source.includes('automaticCanon: false'), 'runtime refuses execution and CANON authority');
check(!/\bfetch\s*\(|crypto\.sign|generateKeyPair|createPrivateKey|provider\.invoke/.test(source), 'runtime has no network signing key-generation private-key or provider surface');

[
  'entry fsync failure has a typed durability-uncertain result',
  'entry write may remain inspectable after an fsync failure',
  'exactly one concurrent writer wins the local genesis head',
  'independent roots accept distinct candidates from the same genesis',
  'deletion reopens a different genesis branch',
  'rolled-back root accepts a different next branch',
  'recording leaves upstream source ledger byte-for-byte unchanged'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(inheritedTest.includes("OperationsUtils.now = () => '2026-08-21T09:00:00.000Z'"), 'v3.4 inherited test pins its synthetic clock');
check(inheritedTest.includes('OperationsUtils.now = originalNow'), 'v3.4 inherited test restores the shared clock helper');
check(/successful `record` return requires exclusive create, file `fsync`/.test(readme), 'README states successful-return persistence requirements');
check(/failed file `fsync` can still leave an\s+inspectable entry/.test(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')), 'evidence README preserves fsync uncertainty');
check(/two independent roots accept distinct candidates/.test(frontier), 'frontier preserves the independent-root counterexample');
check(/restoring an earlier namespace permits a different next successor/.test(frontier), 'frontier preserves the rollback counterexample');

schemas.forEach((schema, index) => {
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema ' + (index + 1) + ' declares Draft 2020-12');
  check(schema.additionalProperties === false && everyObjectClosed(schema), 'schema ' + (index + 1) + ' closes every local object shape');
});
check(schemas[1].$defs.truth.properties.writeAndReloadCompletionPersistedSeparately.const === false, 'entry schema fixes separately persisted completion false');
check(schemas[2].$defs.truth.properties.externalRetentionProven.const === false, 'snapshot schema fixes external retention proof false');

check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route retains pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'authority-retention-benefit-and-canon-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');
check(/Browser verification: not applicable/.test(summary), 'summary marks browser verification not applicable');
check(/schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/54\/54 commands passed/.test(summary) && /4,958 focused/.test(summary), 'summary preserves exact verification totals');
check(/pre-existing v3\.4 selftest\s+clock defect/.test(summary), 'summary preserves inherited clock failure and repair');

check(sources.sources.length === 302, 'source snapshot declares three hundred two normalized inputs');
check(sources.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 54 && results.summary.passed === 54 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 4958, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 44, 'forty-four focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nAnchored pairwise transition-ledger evidence selftest: PASS (' + checks + ' checks)');
