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
const moduleDir = path.join(root, 'shared/model-shadow-portable-pin-settlement-history-checkpoint');
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
const checkpointSchema = readModule('checkpoint.schema.json');
const auditSchema = readModule('audit.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-portable-pin-settlement-history-checkpoint.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 46, 'requirements inventory contains forty-six routes');
check(requirements.requirements.filter(item => item.required).length === 27, 'twenty-seven bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 19, 'nineteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three upstream v2.5 capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 24, 'twenty-four v2.6 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 27, 'all twenty-seven required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 19, 'all nineteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 27, 'after inventory declares twenty-seven bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(3, 27).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'directory-entry-hardware-durability', 'authenticated-policy-rotation', 'authenticated-controller-independence',
  'collusion-exclusion', 'authenticated-human-participation', 'authenticated-host-entrypoint', 'externally-trusted-time',
  'global-transition-uniqueness', 'globally-consistent-log', 'atomic-ledger-snapshot', 'provider-execution',
  'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-portable-pin-settlement-history-checkpoint', 'contract identity is exact');
check(contract.version === 'v2.6' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'not-applicable', 'contract stores no checkpoint state');
check(contract.permissions.some(value => value.includes('transient operation lock')), 'contract declares composed transient-lock permission');
check(contract.boundaries.writes.length === 1 && contract.boundaries.writes[0].includes('transient operation lock'), 'contract limits writes to composed transient lock');
check(contract.boundaries.refuses.includes('byte-identical-durable-state-after-call-as-proof-that-no-transient-lock-write-occurred'), 'contract refuses byte identity as zero-write proof');
check(contract.boundaries.refuses.includes('joint-checkpoint-and-root-replacement-as-original-continuity'), 'contract preserves joint replacement boundary');
check(contract.boundaries.refuses.includes('equal-bracketing-reads-as-atomic-filesystem-snapshot'), 'contract refuses atomic snapshot inference');
check(contract.boundaries.refuses.includes('checkpoint-or-audit-as-provider-execution-evaluation-adoption-promotion-merge-or-canon-authority'), 'contract refuses broader audit authority');

check(source.includes("require('../model-shadow-history-checkpoint-pin-settlement-ledger/"), 'runtime composes exact v2.5 module');
check(source.includes('verifyProposalPersisted('), 'runtime exact-verifies persisted proposals');
check(source.includes('verifySettlementPersisted('), 'runtime exact-verifies reconstructed settlement packages');
check(source.includes('settledPinRefs'), 'runtime commits complete settled-pin sequence');
check(source.includes('transientV25OperationLockMayBeWritten'), 'runtime exposes transient-lock truth');
check(source.includes('durableLedgerStateChangedByModule: false'), 'runtime distinguishes durable state from transient write');
check(source.includes('intermediateOrRevertedLedgerChangesExcluded: false'), 'runtime refuses atomic bracketing inference');
check(source.includes('checkpointExternalRetentionProven: false'), 'runtime refuses external retention proof');
check(source.includes('withheldRootsExcluded: false'), 'runtime refuses withheld-root exclusion');
check(!source.includes("require('fs')") && !source.includes('writeFile'), 'v2.6 runtime contains no direct filesystem API');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime signs nothing and accepts no private key API');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');

check(focused.includes('focused suite observes every closed v2.6 classification'), 'focused suite covers every v2.6 classification');
check(focused.includes('movement adversary settled proposal during package verification'), 'focused suite moves state between bracket reads');
check(focused.includes('settlement package deduplicates proposal input'), 'focused suite proves package deduplication');
check(focused.includes('checkpoint derives head from final settled-pin reference'), 'focused suite proves derived head self-validation');
check(focused.includes('fresh-process checkpoint is exact'), 'focused suite proves fresh-process checkpoint rebuild');
check(focused.includes('jointly replaced checkpoint and root form another exact relative history'), 'focused suite preserves joint replacement counterexample');
check(focused.includes('checkpoint declares composed v2.5 transient lock writes'), 'focused suite preserves transient-lock correction');
check(focused.includes('checkpoint creation leaves complete v2.5 root byte-identical'), 'focused suite proves no durable change by tree digest');
check(/source has no direct\s+filesystem API, but composed v2\.5/.test(readme), 'README distinguishes direct API from composed writes');
check(/Byte-identical end state does not mean zero writes/.test(routes), 'evidence routes preserve transient-write boundary');

check(checkpointSchema.additionalProperties === false, 'checkpoint schema closes unknown top-level fields');
check(checkpointSchema.$defs.truth.const.transientV25OperationLockMayBeWritten === true, 'checkpoint schema declares transient lock');
check(checkpointSchema.$defs.truth.const.durableLedgerStateChangedByModule === false, 'checkpoint schema refuses durable change');
check(checkpointSchema.$defs.history.required.length === 4, 'checkpoint schema requires three sequences and digest');
check(auditSchema.additionalProperties === false, 'audit schema closes unknown top-level fields');
check(auditSchema.properties.classification.enum.length === 7, 'audit schema closes seven classifications');
check(auditSchema.$defs.truth.additionalProperties === false, 'audit schema closes truth fields');
check(auditSchema.$defs.truth.properties.deletionOrRollbackPrevented.const === false, 'audit schema refuses rollback prevention');
check(auditSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous action');
check(/independent Draft\s+2020-12 meta-validation remains unrun/.test(summary), 'summary preserves unavailable meta-validator boundary');

check(sourceSnapshot.sources.length === 210, 'source snapshot declares two hundred ten normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 42 && results.summary.passed === 42 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 3255, 'focused assertion count is exact');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable pin-settlement history-checkpoint evidence selftest: PASS (' + checks + ' checks)');
