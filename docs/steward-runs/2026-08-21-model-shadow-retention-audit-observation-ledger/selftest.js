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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-observation-ledger');
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
const observationSchema = readModule('observation.schema.json');
const snapshotSchema = readModule('snapshot.schema.json');
const Runtime = require(path.join(moduleDir, 'model-shadow-retention-audit-observation-ledger.js'));
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-observation-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 26, 'requirements inventory contains twenty-six routes');
check(requirements.requirements.filter(item => item.required).length === 19, 'nineteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 7, 'seven broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 18, 'before comparator exposes eighteen bounded misses');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one exact v2.7 rebuild capability was ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 18, 'eighteen v2.8 capabilities were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 7, 'seven broader routes were optional unknown');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 19, 'all nineteen required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 7, 'all seven broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory declares one available upstream capability');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 19, 'after inventory declares nineteen bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.filter(item => item.required).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every bounded capability by exact id');
[
  'external-retention', 'protected-monotonicity', 'authenticated-identity', 'trusted-time',
  'provider-evaluation', 'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-observation-ledger', 'contract identity is exact');
check(contract.version === 'v2.8' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'filesystem' && contract.lifecycle.reload === 'resume', 'contract declares filesystem state and fresh reload');
check(contract.permissions.some(value => value.includes('distinct v2.7 retention root')), 'contract declares bounded upstream read permission');
check(contract.boundaries.writes.some(value => value.includes('full minimized v2.7 audit observation')), 'contract declares full-audit observation write');
check(contract.boundaries.refuses.includes('caller-owned-local-root-as-independent-external-retention'), 'contract refuses local root as external retention');
check(contract.boundaries.refuses.includes('joint-source-retention-and-observation-root-loss-as-original-continuity'), 'contract preserves joint three-root loss boundary');
check(contract.boundaries.refuses.includes('stored-observation-as-continuous-monitoring-of-later-source-or-retention-state'), 'contract refuses continuous monitoring overclaim');
check(contract.boundaries.refuses.includes('confirmation-string-as-host-actor-human-organization-or-policy-authentication'), 'contract refuses confirmation authentication');

check(source.includes("require('../model-shadow-history-checkpoint-retention-ledger/"), 'runtime composes exact v2.7 module');
check(source.includes('.verifyAudit('), 'runtime exact-rebuilds v2.7 audit package');
check(source.includes('assertThreeDistinctRoots('), 'runtime enforces three-root separation');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive record creation');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs records and operation lock');
check(source.includes('MAX_AGGREGATE_STORAGE_BYTES'), 'runtime enforces aggregate storage budget');
check(source.includes('sourceOrRetentionPresentationRequiredForReload: false'), 'runtime declares origin-independent reload boundary');
check(source.includes('continuousMonitoringPerformed: false'), 'runtime refuses continuous-monitoring claim');
check(source.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability');
check(source.includes('externalRetentionProven: false'), 'runtime refuses external retention proof');
check(source.includes('withheldOrJointlyReplacedRootsExcluded: false'), 'runtime refuses joint-root exclusion');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('child_process'), 'runtime launches no process');
check(Runtime.buildManifest === undefined && Runtime.buildObservation === undefined, 'write-completion builders are private');

check(focused.includes('fresh process preserves exact held audit after compared-root loss'), 'focused suite tests persistence after compared-root loss');
check(focused.includes('exactly one concurrent duplicate writer succeeds'), 'focused suite exercises concurrent writers');
check(focused.includes('corrupt previous-reference chain fails closed'), 'focused suite rejects a broken digest chain');
check(focused.includes('one observation log refuses retention manifest identity drift'), 'focused suite rejects retention identity drift');
check(focused.includes('another internally exact local triple remains possible after joint loss'), 'focused suite preserves joint-loss counterexample');
check(focused.includes('public artifacts retain explicit negative minimization truth fields'), 'focused suite distinguishes negative truth from payloads');
check(focused.includes('write-completion observation builder is not exported'), 'focused suite closes side-effect builder export');
check(/fresh process can reload[\s\S]+source[\s\S]+retention roots are unavailable/.test(readme), 'README states bounded origin-independent reload');
check(/Joint deletion or replacement of all three roots defeats/.test(readme), 'README preserves joint-loss boundary');

check(routes.routes.length === 6, 'six claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface), 'every claim route has native pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'local-persistence').primarySurface.includes('fresh child process'), 'persistence routes to a fresh process');
check(routes.routes.find(route => route.claimId === 'authority-boundary').kind === 'authorization', 'authority is classified on its native surface');

[manifestSchema, observationSchema, snapshotSchema].forEach(schema => check(schema.additionalProperties === false, schema.$id + ' closes unknown top-level fields'));
check(observationSchema.properties.v27Audit.$ref === '../model-shadow-history-checkpoint-retention-ledger/audit.schema.json', 'observation schema reuses v2.7 audit schema');
check(observationSchema.properties.truth.properties.externalRetentionProven.const === false, 'observation schema refuses external retention');
check(observationSchema.properties.truth.properties.executionAuthorized.const === false, 'observation schema refuses execution authority');
check(/independent meta-validation remains unrun/.test(summary), 'summary preserves unavailable meta-validator boundary');
check(/Write-completion manifest and observation builders[\s\S]+remain private/.test(summary), 'summary preserves builder-export boundary');
check(/losing a create race[\s\S]+rechecks the exact directory boundary/.test(summary), 'summary preserves initialization-race correction');

check(sourceSnapshot.sources.length === 230, 'source snapshot declares two hundred thirty normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 44 && results.summary.passed === 44 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 3641, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 34, 'thirty-four focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts retained commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal retention-audit observation-ledger evidence selftest: PASS (' + checks + ' checks)');
