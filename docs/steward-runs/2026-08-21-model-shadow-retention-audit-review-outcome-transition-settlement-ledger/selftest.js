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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
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
const schemas = ['manifest.schema.json', 'proposal.schema.json', 'settlement.schema.json', 'snapshot.schema.json'].map(readModule);
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-transition-settlement-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const evidenceReadme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const frontier = fs.readFileSync(path.join(dir, 'FRONTIER_AUDIT.md'), 'utf8');

check(requirements.requirements.length === 40, 'requirements inventory contains forty routes');
check(requirements.requirements.filter(item => item.required).length === 28, 'twenty-eight bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 12, 'twelve broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream route was ready before v3.7');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 27, 'twenty-seven v3.7 routes were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 12, 'twelve optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 28, 'all twenty-eight bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 12, 'all twelve broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only the committed upstream seam');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 28, 'after inventory exposes twenty-eight bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 12, 'after inventory preserves twelve unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-transition-settlement-ledger', 'contract identity is exact');
check(contract.version === 'v3.7' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-transition-settlement-ledger.')).length === 27, 'contract declares twenty-seven bounded adapter capabilities');
check(contract.boundaries.refuses.includes('prewrite-source-match-as-proof-of-postwrite-or-later-currentness'), 'contract refuses prewrite currentness inflation');
check(contract.boundaries.refuses.includes('distinct-caller-owned-local-root-as-independent-external-retention-or-custody'), 'contract refuses local-root custody inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/"), 'runtime composes exact v3.6 module');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime exclusively creates local artifacts');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs before successful return');
check(source.includes("fs.openSync(paths.lock, 'wx'"), 'runtime uses the fixed exclusive operation lock');
check(source.includes('entryPersistedExactRebuild: verificationPass'), 'runtime retains exact-entry verification independently');
check(source.includes('beforeCaptureState: before.kind') && source.includes('afterCaptureState: after.kind'), 'runtime persists explicit source capture states');
check(source.includes('postwriteSourceCurrentnessProven: false'), 'runtime denies postwrite source currentness');
check(source.includes('externalRetentionProven: false') && source.includes('globalTransitionUniquenessProven: false'), 'runtime refuses retention and globality claims');
check(!/\bfetch\s*\(|crypto\.sign|generateKeyPair|createPrivateKey|provider\.invoke/.test(source), 'runtime has no network signing key-generation private-key or provider surface');

[
  'focused cases exercise every source observation classification',
  'focused cases exercise every settlement classification',
  'changed-source observation retains successful exact entry verification',
  'source absence becomes typed held settlement',
  'stable source without the proposed entry becomes typed held settlement',
  'proposal fsync failure has typed durability uncertainty',
  'settlement fsync failure has typed durability uncertainty',
  'exactly one concurrent proposal wins local operation contention',
  'joint source and settlement replacement can reopen a divergent sequence one',
  'proposal leaves durable v3.6 source bytes unchanged'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(/Each minimized observation records both capture states/.test(readme), 'README explains independent capture-state evidence');
check(/failed file `fsync` can still leave an inspectable proposal\s+or settlement/.test(evidenceReadme), 'evidence README preserves fsync uncertainty');
check(/Independent source\/settlement pairs can settle divergent candidates/.test(frontier), 'frontier preserves the independent-root counterexample');
check(/Joint replacement of caller-owned source and settlement namespaces can reopen/.test(frontier), 'frontier preserves the joint-replacement counterexample');

schemas.forEach((schema, index) => {
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema ' + (index + 1) + ' declares Draft 2020-12');
  check(schema.additionalProperties === false && everyObjectClosed(schema), 'schema ' + (index + 1) + ' closes every local object shape');
});
check(schemas[1].$defs.observation.properties.beforeCaptureState.enum.length === 3, 'proposal schema declares three source capture states');
check(schemas[2].$defs.truth.properties.postwriteSourceCurrentnessProven.const === false, 'settlement schema fixes postwrite currentness false');
check(schemas[3].$defs.truth.properties.externalRetentionProven.const === false, 'snapshot schema fixes external retention proof false');

check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route retains pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'authority-retention-benefit-and-canon-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');
check(/Browser verification: not applicable/.test(summary), 'summary marks browser verification not applicable');
check(/schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/55\/55 commands passed/.test(summary) && /5,134 focused/.test(summary), 'summary preserves exact verification totals');
check(/Four early focused failures/.test(summary), 'summary preserves all early focused fixture failures');
check(/After the first 151-assertion green run/.test(summary), 'summary preserves the first post-green truth audit');
check(/A second audit found snapshot-null values/.test(summary), 'summary preserves the capture-state truth audit');
check(/outdated script filename/.test(summary), 'summary preserves the comparator path failure');

check(sources.sources.length === 312, 'source snapshot declares three hundred twelve normalized inputs');
check(sources.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 55 && results.summary.passed === 55 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5134, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 45, 'forty-five focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nTransition-settlement evidence selftest: PASS (' + checks + ' checks)');
