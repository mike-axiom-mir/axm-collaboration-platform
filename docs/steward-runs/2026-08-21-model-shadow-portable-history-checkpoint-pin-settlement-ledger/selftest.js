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
const moduleDir = path.join(root, 'shared/model-shadow-history-checkpoint-pin-settlement-ledger');
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
const schemas = ['manifest', 'proposal', 'settlement', 'snapshot'].map(name => readModule(name + '.schema.json'));
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-history-checkpoint-pin-settlement-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 46, 'requirements inventory contains forty-six routes');
check(requirements.requirements.filter(item => item.required).length === 27, 'twenty-seven bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 19, 'nineteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 2, 'two upstream v2.4 capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 25, 'twenty-five v2.5 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 27, 'all twenty-seven required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 19, 'all nineteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory declares two available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 27, 'after inventory declares twenty-seven bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(2, 27).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'directory-entry-hardware-durability', 'authenticated-policy-rotation', 'authenticated-controller-independence',
  'collusion-exclusion', 'authenticated-human-participation', 'authenticated-host-entrypoint', 'externally-trusted-time',
  'global-transition-uniqueness', 'globally-consistent-log', 'atomic-ledger-snapshot', 'provider-execution',
  'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-portable-history-checkpoint-pin-settlement-ledger', 'contract identity is exact');
check(contract.version === 'v2.5' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'filesystem' && contract.lifecycle.reload === 'resume', 'contract uses closed filesystem resume lifecycle values');
check(contract.lifecycle.disconnect === 'graceful-degrade' && contract.lifecycle.cleanup === 'explicit', 'contract names stale-lock degradation and explicit cleanup');
check(contract.permissions.some(value => value.includes('transient operation lock')), 'contract declares transient lock permission');
check(contract.boundaries.refuses.includes('operation-while-an-active-or-stale-local-lock-exists'), 'contract refuses operation through stale lock');
check(contract.boundaries.refuses.includes('file-fsync-as-directory-entry-hardware-power-loss-or-remote-durability-proof'), 'contract refuses overbroad file-fsync durability claim');
check(contract.boundaries.refuses.includes('local-sequence-as-deletion-or-rollback-prevention'), 'contract preserves deletion and rollback boundary');
check(contract.boundaries.refuses.includes('explicit-confirmation-as-authenticated-host-human-review-or-real-world-identity'), 'contract refuses authentication inference');
check(contract.boundaries.refuses.includes('local-pin-settlement-as-provider-execution-adoption-promotion-merge-or-canon-authority'), 'contract refuses broader settlement authority');

check(source.includes("require('../model-shadow-history-checkpoint-pin-transition/"), 'runtime composes exact v2.4 module');
check(source.includes('PinTransition.verifyTransition('), 'runtime exact-rebuilds v2.4 transition packages');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime exclusive-creates persisted records');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs records and lock');
check(source.includes("fs.openSync(lockPath, 'wx'"), 'runtime serializes operations with exclusive lock');
check(source.includes('currentPinHeadDerivedOnlyFromSettlements: true'), 'runtime states settled-only head derivation');
check(source.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability proof');
check(source.includes('independentRootsExcluded: false'), 'runtime refuses independent-root exclusion');
check(source.includes('deletionOrRollbackPrevented: false'), 'runtime refuses deletion and rollback prevention');
check(source.includes('authenticatedHumanReviewProven: false'), 'runtime refuses authenticated human review proof');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime signs nothing and accepts no private key API');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');

check(focused.includes('proposal does not advance settled head'), 'focused suite proves pending proposal cannot move head');
check(focused.includes('fresh-process pending snapshot is exact'), 'focused suite proves fresh-process pending recovery');
check(focused.includes('fresh-process settle reports success'), 'focused suite proves fresh-process settlement');
check(focused.includes('exactly one concurrent first writer succeeds'), 'focused suite proves one concurrent first writer');
check(focused.includes('stale operation lock fails closed'), 'focused suite proves stale-lock refusal');
check(focused.includes('independent roots can diverge without detection'), 'focused suite preserves divergent-root counterexample');
check(focused.includes('deleted ledger can reopen at sequence one'), 'focused suite preserves deletion/reopen counterexample');
check(focused.includes('noncanonical proposal file fails closed'), 'focused suite proves noncanonical state refusal');
check(focused.includes('linked state root is rejected'), 'focused suite proves linked-root boundary');
check(/crash can leave a\s+stale lock/.test(readme), 'README preserves stale-lock recovery boundary');
check(/Browser render\/click evidence is not applicable/.test(routes), 'evidence routes preserve nonvisual browser boundary');

check(schemas.every(schema => schema.additionalProperties === false), 'all schemas close unknown top-level fields');
check(schemas.every(schema => schema.properties.truth.$ref === '#/$defs/truth'), 'all schemas route truth through closed definitions');
check(schemas.every(schema => schema.$defs.truth.additionalProperties === false), 'all truth schemas close unknown fields');
check(schemas.every(schema => schema.properties.status.const === 'TEST'), 'all schemas keep TEST status');
check(schemas[1].properties.decision.properties.settledHeadAdvanced.const === false, 'proposal schema prevents settled-head advance');
check(schemas[2].properties.decision.properties.executionAuthorized.const === false, 'settlement schema prevents execution authority');
check(schemas[2].properties.decision.properties.adoptionAuthorized.const === false, 'settlement schema prevents adoption authority');
check(schemas[3].$defs.truth.properties.directoryEntryOrHardwareDurabilityProven.const === false, 'snapshot schema refuses overbroad durability');
check(schemas[3].$defs.truth.properties.independentRootsExcluded.const === false, 'snapshot schema refuses independent-root exclusion');

check(sourceSnapshot.sources.length === 202, 'source snapshot declares two hundred two normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 41 && results.summary.passed === 41 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 3089, 'focused assertion count is exact');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable history-checkpoint pin-settlement-ledger evidence selftest: PASS (' + checks + ' checks)');
