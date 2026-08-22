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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-ledger');
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
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const manifestSchema = readModule('manifest.schema.json');
const recordSchema = readModule('record.schema.json');
const snapshotSchema = readModule('snapshot.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 35, 'requirements inventory contains thirty-five routes');
check(requirements.requirements.filter(item => item.required).length === 25, 'twenty-five bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 10, 'ten broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 22, 'before comparator exposes twenty-two bounded misses');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three v3.1 capabilities were ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 22, 'twenty-two v3.2 capabilities were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 10, 'ten broader routes were optional unknown');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 25, 'all twenty-five required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 10, 'all ten broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 25, 'after inventory declares twenty-five bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 10, 'after inventory preserves ten unknown capabilities');
const availableBefore = new Set(beforeInventory.capabilities.filter(item => item.status === 'available').map(item => item.id));
const provided = new Set(contract.provides);
check(requirements.requirements.filter(item => item.required).every(item => item.capabilities.every(capability => availableBefore.has(capability) || provided.has(capability))), 'inherited or local declarations cover every bounded capability by exact id');
[
  'live-host-observation', 'authenticated-actor', 'actual-human-review', 'hold-resolution',
  'external-custody', 'protected-monotonic', 'hardware-durability', 'provider-evaluation',
  'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-ledger', 'contract identity is exact');
check(contract.version === 'v3.2' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'filesystem' && contract.lifecycle.reload === 'resume', 'contract declares caller-owned reloadable filesystem state');
check(contract.permissions.some(value => value.includes('fixed namespace')), 'contract bounds ledger writes to one fixed namespace');
check(contract.permissions.some(value => value.includes('transient operation lock')), 'contract declares inherited transient-lock authority');
check(contract.boundaries.refuses.includes('reload-as-independent-raw-actor-digest-provenance-proof'), 'contract refuses reload provenance inflation');
check(contract.boundaries.refuses.includes('caller-controlled-full-ledger-rewrite-as-detectable-tamper-or-original-history-proof'), 'contract refuses full rewrite as original-history proof');
check(contract.boundaries.refuses.includes('persisted-approval-as-hold-resolution-remediation-or-execution-authority'), 'contract refuses persisted approval authority');

check(source.includes("require('../model-shadow-retention-audit-review-outcome/"), 'runtime composes exact v3.1 module');
check(source.includes('V31.verifyOutcome'), 'runtime exact-rebuilds v3.1 before capture');
check(source.includes("fs.openSync(paths.lock, 'wx'"), 'runtime exclusive-creates its operation lock');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime exclusive-creates manifest and records');
check(source.includes('fs.fsyncSync'), 'runtime file-syncs lock manifest and records');
check(source.includes('actorDigestProvenanceExactRebuiltBeforeWrite: true'), 'runtime records capture-time actor provenance rebuild');
check(source.includes('actorDigestProvenanceReverifiedOnReload: false'), 'runtime refuses actor provenance reload claim');
check(source.includes('localControllerFullRewriteExcluded: false'), 'runtime preserves full local rewrite counterevidence');
check(source.includes('holdResolved: false') && source.includes('executionAuthorized: false'), 'runtime refuses hold resolution and execution claims');
check(!/review-service|ReviewService|operations-api|AXMOps|\bfetch\s*\(|XMLHttpRequest/.test(source), 'runtime imports or calls no ReviewService operations API or browser network');
check(!/require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(source), 'runtime imports no process or HTTP module');

check(focused.includes('approved record persists exact minimized v3.1 outcome'), 'focused suite captures exact approved outcome');
check(focused.includes('held record persists exact minimized outcome'), 'focused suite captures exact held outcome');
check(focused.includes('rejected record persists exact minimized outcome'), 'focused suite captures exact rejected outcome');
check(focused.includes('exactly one concurrent duplicate writer succeeds'), 'focused suite exercises separate-process writer race');
check(focused.includes('fresh process reloads exact snapshot after upstream loss'), 'focused suite reloads after upstream loss');
check(focused.includes('self-consistent full local record rewrite remains internally loadable'), 'focused suite preserves full local rewrite counterexample');
check(focused.includes('replacement ledger can reuse the same configured manifest identity'), 'focused suite preserves replacement identity counterexample');
check(focused.includes('original service has no continuity after its ledger root is removed'), 'focused suite preserves joint-loss counterexample');
check(/does not independently reconstruct raw actors/.test(readme), 'README preserves actor provenance reload boundary');
check(/controller that can replace every local ledger byte[\s\S]+not detectable/.test(readme), 'README preserves full local rewrite boundary');

check(routes.routes.length === 6, 'six claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface), 'every claim route has native pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'reload-and-loss-boundary').passCondition.includes('replacement can reuse configured manifest identity'), 'reload route preserves replacement identity counterevidence');
check(routes.routes.find(route => route.claimId === 'authority-and-durability-boundary').kind === 'authorization', 'authority is classified on its native surface');
check(routes.routes.find(route => route.claimId === 'concurrency-corruption-and-resources').primarySurface.includes('separate-process'), 'concurrency routes to separate-process execution');

[manifestSchema, recordSchema, snapshotSchema].forEach(schema => check(schema.additionalProperties === false, schema.$id + ' closes unknown top-level fields'));
check(recordSchema.properties.log.additionalProperties === false, 'record schema closes log binding');
check(recordSchema.properties.decision.additionalProperties === false, 'record schema closes decision fields');
check(recordSchema.properties.truth.additionalProperties === false, 'record schema closes truth fields');
check(recordSchema.properties.outcome.$ref === '../model-shadow-retention-audit-review-outcome/review-outcome.schema.json', 'record schema reuses exact v3.1 schema');
check(recordSchema.properties.truth.properties.actorDigestProvenanceReverifiedOnReload.const === false, 'record schema fixes reload provenance false');
check(recordSchema.properties.truth.properties.localControllerFullRewriteExcluded.const === false, 'record schema fixes full rewrite exclusion false');
check(recordSchema.properties.truth.properties.holdResolved.const === false, 'record schema fixes hold resolution false');
check(snapshotSchema.properties.truth.properties.externalRetentionProven.const === false, 'snapshot schema fixes external retention false');
check(snapshotSchema.properties.truth.properties.protectedMonotonicStateProven.const === false, 'snapshot schema fixes protected monotonic state false');
check(manifestSchema.properties.truth.properties.automaticCanon.const === false, 'manifest schema fixes automatic CANON false');
check(/Browser verification: not applicable/.test(summary), 'summary explicitly marks browser verification not applicable');
check(/Draft 2020-12 schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent schema-validator boundary');
check(/all 25 bounded required routes `READY`/.test(summary), 'summary preserves bounded DEGRADED result');

check(sourceSnapshot.sources.length === 267, 'source snapshot declares two hundred sixty-seven normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 50 && results.summary.passed === 50 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 4381, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 40, 'forty focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal retention-audit review-outcome-ledger evidence selftest: PASS (' + checks + ' checks)');
