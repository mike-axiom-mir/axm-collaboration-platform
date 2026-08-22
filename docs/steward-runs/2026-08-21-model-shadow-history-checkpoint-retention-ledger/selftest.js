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
const moduleDir = path.join(root, 'shared/model-shadow-history-checkpoint-retention-ledger');
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
const manifestSchema = readModule('manifest.schema.json');
const proposalSchema = readModule('proposal.schema.json');
const settlementSchema = readModule('settlement.schema.json');
const snapshotSchema = readModule('snapshot.schema.json');
const auditSchema = readModule('audit.schema.json');
const Runtime = require(path.join(moduleDir, 'model-shadow-history-checkpoint-retention-ledger.js'));
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-history-checkpoint-retention-ledger.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 50, 'requirements inventory contains fifty routes');
check(requirements.requirements.filter(item => item.required).length === 31, 'thirty-one bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 19, 'nineteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three upstream v2.6 capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 28, 'twenty-eight v2.7 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 31, 'all thirty-one required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 19, 'all nineteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 31, 'after inventory declares thirty-one bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(3, 31).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'directory-entry-hardware-durability', 'authenticated-policy-rotation', 'authenticated-controller-independence',
  'collusion-exclusion', 'authenticated-human-participation', 'authenticated-host-entrypoint', 'externally-trusted-time',
  'global-transition-uniqueness', 'globally-consistent-log', 'atomic-ledger-snapshot', 'provider-execution',
  'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-history-checkpoint-retention-ledger', 'contract identity is exact');
check(contract.version === 'v2.7' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'filesystem' && contract.lifecycle.reload === 'resume', 'contract declares filesystem state and fresh reload');
check(contract.permissions.some(value => value.includes('distinct explicit v2.5 source root')), 'contract declares bounded source-read permission');
check(contract.boundaries.writes.some(value => value.includes('full-checkpoint proposal')), 'contract declares full-checkpoint proposal write');
check(contract.boundaries.refuses.includes('caller-owned-distinct-local-root-as-independent-external-retention'), 'contract refuses local root as external retention');
check(contract.boundaries.refuses.includes('joint-source-and-retention-root-replacement-as-original-continuity'), 'contract preserves joint replacement boundary');
check(contract.boundaries.refuses.includes('pending-observation-as-settled-retention-authority'), 'contract preserves pending authority boundary');
check(contract.boundaries.refuses.includes('file-fsync-as-directory-entry-or-hardware-durability'), 'contract refuses durability overclaim');

check(source.includes("require('../model-shadow-portable-pin-settlement-history-checkpoint/"), 'runtime composes exact v2.6 module');
check(source.includes('verifyCheckpointOrigin('), 'runtime exact-verifies checkpoint origin');
check(source.includes('auditCheckpoint('), 'runtime composes v2.6 current audit');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive record creation');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs records and operation lock');
check(source.includes('MAX_AGGREGATE_STORAGE_BYTES'), 'runtime enforces aggregate storage budget');
check(source.includes('rootsOverlap('), 'runtime enforces source and retention root separation');
check(source.includes('latestPersistedCheckpointSelectedWithoutCallerCheckpointPresentation'), 'runtime declares persisted checkpoint selection');
check(source.includes('pendingObservationGrantsSettledAuthority: false'), 'runtime refuses pending authority');
check(source.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability');
check(source.includes('externalRetentionProven: false'), 'runtime refuses external retention proof');
check(source.includes('withheldOrJointlyReplacedRootsExcluded: false'), 'runtime refuses joint-root exclusion');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('child_process'), 'runtime launches no process');
check(Runtime.buildProposal === undefined && Runtime.buildSettlement === undefined, 'write-completion builders are private');
check(Runtime.checkpointRelation === undefined, 'unchecked relation helper is private');

check(focused.includes('concurrent proposal race admits exactly one writer'), 'focused suite exercises concurrent writers');
check(focused.includes('source movement between preflight and locked rebuild refuses proposal'), 'focused suite exercises source movement');
check(focused.includes('stored checkpoint exposes strict source rollback'), 'focused suite detects retained-source rollback');
check(focused.includes('stored checkpoint exposes absent source namespace'), 'focused suite detects retained-source absence');
check(focused.includes('latest persisted audit remains pending'), 'focused suite audits pending observation');
check(focused.includes('settled audit selection is exact'), 'focused suite audits settled observation');
check(focused.includes('same-history checkpoint replay is refused'), 'focused suite rejects checkpoint replay');
check(focused.includes('fork checkpoint proposal is refused'), 'focused suite rejects checkpoint fork');
check(focused.includes('identity-drift checkpoint proposal is refused'), 'focused suite rejects checkpoint identity drift');
check(focused.includes('jointly replaced source and retention roots form another exact relative pair'), 'focused suite preserves joint replacement counterexample');
check(focused.includes('public artifacts retain explicit negative minimization truth fields'), 'focused suite distinguishes negative truth fields from payloads');
check(focused.includes('write-completion proposal builder is not exported'), 'focused suite closes side-effect builder export');
check(/latest persisted observation[\s\S]+whether pending or settled/.test(readme), 'README distinguishes pending and settled audit selection');
check(/Deleting[\s\S]+both source and retention roots/.test(readme), 'README preserves joint replacement boundary');
check(/Byte-identical durable source state does not mean zero transient source writes/.test(routes), 'evidence routes preserve transient source-write boundary');

[manifestSchema, proposalSchema, settlementSchema, snapshotSchema, auditSchema].forEach(schema => check(schema.additionalProperties === false, schema.$id + ' closes unknown top-level fields'));
check(proposalSchema.properties.checkpoint.$ref === '../model-shadow-portable-pin-settlement-history-checkpoint/checkpoint.schema.json', 'proposal schema reuses v2.6 checkpoint schema');
check(auditSchema.properties.upstreamAudit.$ref === '../model-shadow-portable-pin-settlement-history-checkpoint/audit.schema.json', 'audit schema reuses v2.6 audit schema');
check(auditSchema.properties.truth.properties.externalRetentionProven.const === false, 'audit schema refuses external retention');
check(auditSchema.properties.truth.properties.protectedMonotonicStateProven.const === false, 'audit schema refuses protected state');
check(proposalSchema.properties.truth.properties.sourceCurrentAfterFinalReadProven.const === false, 'proposal schema refuses currentness after final read');
check(/independent meta-validation remains unrun/.test(summary), 'summary preserves unavailable meta-validator boundary');
check(/write-completion receipts without a service write/.test(summary), 'summary preserves builder-export correction');
check(/truthful field name `privateContextEmbedded: false`/.test(summary), 'summary preserves minimization-scan correction');

check(sourceSnapshot.sources.length === 221, 'source snapshot declares two hundred twenty-one normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 43 && results.summary.passed === 43 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 3480, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 33, 'thirty-three focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts retained commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal history-checkpoint retention-ledger evidence selftest: PASS (' + checks + ' checks)');
