#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-two-phase-history-checkpoint');
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
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-two-phase-history-checkpoint.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 38, 'requirements inventory contains thirty-eight routes');
check(requirements.requirements.filter(item => item.required).length === 20, 'twenty bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN rather than inventing a missing executable hand');
check(before.requirements.filter(item => item.status === 'READY').length === 4, 'four upstream v2.0 capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 16, 'sixteen bounded v2.1 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no bounded missing capability');
check(after.requirements.filter(item => item.status === 'READY').length === 20, 'all twenty bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 18, 'all eighteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 4, 'before inventory declares four available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 20, 'after inventory declares twenty bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(4, 20).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'atomic-ledger-snapshot', 'intermediate-change-exclusion', 'later-ledger-currentness', 'authenticated-checkpoint-pin',
  'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention', 'global-transition-uniqueness',
  'globally-consistent-log', 'authenticated-host-entrypoint', 'authenticated-independent-controllers',
  'authenticated-human-participation', 'externally-trusted-time', 'provider-execution', 'held-out-evaluation',
  'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-history-checkpoint', 'contract identity is exact');
check(contract.version === 'v2.1' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.writes.length === 0, 'contract declares a read-only leaf');
check(contract.boundaries.refuses.includes('portable-checkpoint-as-proof-of-retention-or-independent-custody'), 'contract refuses retention overclaim');
check(contract.boundaries.refuses.includes('relative-rollback-detection-as-deletion-or-rollback-prevention'), 'contract refuses rollback-prevention overclaim');
check(contract.boundaries.refuses.includes('equal-bracketing-reads-as-atomic-filesystem-snapshot'), 'contract refuses atomic-snapshot overclaim');
check(contract.boundaries.refuses.includes('equal-bracketing-reads-as-exclusion-of-intermediate-or-reverted-change'), 'contract refuses intermediate-change exclusion');
check(contract.boundaries.refuses.includes('checkpoint-or-audit-as-execution-adoption-promotion-or-canon-authority'), 'contract refuses downstream authority');

check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/"), 'runtime composes unchanged v2.0 surface');
check(source.includes('verifyProposalPersisted(') && source.includes('verifySettlementPersisted('), 'runtime exact-verifies every presented package through v2.0');
check(source.includes('LEDGER_MOVED_DURING_PRESENTATION'), 'runtime refuses unequal bracketing snapshots');
check(source.includes('EXACT_HISTORY_MATCH'), 'runtime defines exact classification');
check(source.includes('FORWARD_HISTORY_EXTENSION'), 'runtime defines forward classification');
check(source.includes('OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT'), 'runtime defines relative rollback classification');
check(source.includes('OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT'), 'runtime defines relative replacement or fork classification');
check(source.includes('OBSERVED_LEDGER_IDENTITY_DRIFT'), 'runtime defines identity drift classification');
check(source.includes('OBSERVED_LEDGER_ABSENT') && source.includes('OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'), 'runtime distinguishes absence from ledger-or-configuration invalidity');
check(source.includes('classificationRelativeToPresentedCheckpointOnly: true'), 'audit truth limits classification to presented checkpoint');
check(source.includes('checkpointExternalRetentionProven: false'), 'runtime refuses external-retention claim');
check(source.includes('checkpointPinAuthenticated: false'), 'runtime refuses checkpoint-pin authentication');
check(source.includes('ledgerSnapshotAtomic: false'), 'runtime refuses atomic snapshot claim');
check(source.includes('intermediateOrRevertedLedgerChangesExcluded: false'), 'runtime preserves intermediate-change uncertainty');
check(source.includes('ledgerCurrentAfterFinalReadProven: false'), 'runtime refuses later-currentness claim');
check(source.includes('deletionOrRollbackPrevented: false'), 'runtime refuses rollback-prevention claim');
check(source.includes('globallyConsistentLogProven: false'), 'runtime refuses global consistency claim');
check(source.includes('hostAuthorizationAuthenticated: false'), 'runtime refuses host authorization claim');
check(source.includes('humanBenefitProven: false'), 'runtime refuses benefit claim');
check(source.includes('automaticCanon: false'), 'runtime refuses CANON claim');
check(!source.includes("require('fs')") && !source.includes('.propose(') && !source.includes('.settle('), 'runtime has no direct filesystem or v2.0 write call');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');

check(focusedTest.includes('exact audit leaves the ledger byte-for-byte unchanged'), 'focused test proves exact audit read-only by tree digest');
check(focusedTest.includes('changed bracketing snapshot refuses checkpoint creation'), 'focused test induces and refuses movement between reads');
check(focusedTest.includes('settling a checkpointed pending proposal is a forward history extension'), 'focused test proves forward extension');
check(focusedTest.includes('older valid prefix is typed strict rollback relative to checkpoint'), 'focused test proves strict relative rollback');
check(focusedTest.includes('different valid sequence from same identity is typed replacement or fork'), 'focused test proves relative replacement or fork');
check(focusedTest.includes('jointly replaced checkpoint and root form another exact relative chain'), 'focused test preserves joint-replacement counterexample');
check(focusedTest.includes('different valid ledger identity is typed drift'), 'focused test proves identity drift');
check(focusedTest.includes('absent namespace is typed absent') && focusedTest.includes('corrupt namespace is typed ledger or configuration invalid'), 'focused test distinguishes absence and ambiguous reload invalidity');
check(focusedTest.includes('malformed service configuration yields no invalid-ledger receipt'), 'focused test refuses invalidity receipt for unconstructable configuration');
check(focusedTest.includes('fresh process rebuilds checkpoint') && focusedTest.includes('fresh process rebuilds audit'), 'focused test proves fresh-process reconstruction');
check(/Replacing the checkpoint and ledger together/.test(readme), 'README preserves joint-replacement boundary');
check(/not an atomic filesystem snapshot/.test(readme), 'README preserves non-atomic boundary');
check(/Jointly replacing checkpoint and root/.test(routes), 'evidence routes preserve joint-replacement counterevidence');

const checkpointSchema = readModule('history-checkpoint.schema.json');
const auditSchema = readModule('history-audit.schema.json');
check(checkpointSchema.additionalProperties === false, 'checkpoint schema closes unknown top-level fields');
check(auditSchema.additionalProperties === false, 'audit schema closes unknown top-level fields');
check(auditSchema.properties.classification.enum.length === 7, 'audit schema closes classification to seven exact outcomes');
check(auditSchema.properties.decision.properties.autonomousActionCount.const === 0, 'audit schema prevents autonomous action');
check(checkpointSchema.properties.mode.const === 'CALLER_PORTABLE_UNAUTHENTICATED_CHECKPOINT', 'checkpoint schema keeps pin unauthenticated');

check(sourceSnapshot.sources.length === 166, 'source snapshot declares one hundred sixty-six normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 37 && results.summary.passed === 37 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 2627, 'focused assertion count matches recorded outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable settlement-history checkpoint evidence selftest: PASS (' + checks + ' checks)');
