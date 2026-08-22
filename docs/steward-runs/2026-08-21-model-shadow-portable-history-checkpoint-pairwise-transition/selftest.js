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
const moduleDir = path.join(root, 'shared/model-shadow-history-checkpoint-pairwise');
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
const schema = readModule('transition.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-history-checkpoint-pairwise.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 41, 'requirements inventory contains forty-one routes');
check(requirements.requirements.filter(item => item.required).length === 23, 'twenty-three bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three upstream capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 20, 'twenty v2.3 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 23, 'all twenty-three required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 18, 'all eighteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 23, 'after inventory declares twenty-three bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(3, 23).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'authenticated-policy-rotation', 'authenticated-controller-independence', 'collusion-exclusion', 'authenticated-human-participation',
  'authenticated-host-entrypoint', 'externally-trusted-time', 'global-transition-uniqueness', 'globally-consistent-log',
  'atomic-ledger-snapshot', 'provider-execution', 'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-portable-history-checkpoint-pairwise-transition', 'contract identity is exact');
check(contract.version === 'v2.3' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.writes.length === 0 && contract.permissions.length === 0, 'contract declares a pure authority-free leaf');
check(contract.boundaries.refuses.includes('pairwise-comparison-as-global-fork-or-withheld-branch-exclusion'), 'contract refuses withheld-fork exclusion');
check(contract.boundaries.refuses.includes('joint-replacement-of-both-presented-pairs-as-original-continuity'), 'contract preserves joint-replacement counterevidence');

check(source.includes("require('../model-shadow-history-checkpoint-anchor/"), 'runtime composes exact v2.2 module');
check(source.includes('Anchor.verifyAnchoredCheckpoint('), 'runtime exact-rebuilds both anchored packages');
check(source.includes('witnessContinuityProfile') && source.includes('anchorContinuityProfile'), 'runtime compares normalized cryptographic policy profiles');
check(source.includes('completeProposalAndSettlementReferencePrefixesCompared: true'), 'truth surface names full history comparison');
check(source.includes('twoIndependentCandidatesMayExtendSamePrevious: true'), 'runtime preserves independent-candidate counterexample');
check(source.includes('withheldBranchesExcluded: false'), 'runtime refuses withheld-branch exclusion');
check(source.includes('jointPairReplacementStillPossible: true'), 'runtime preserves joint replacement');
check(source.includes('policyRotationAuthenticated: false'), 'runtime refuses authenticated rotation claim');
check(!source.includes("require('fs')") && !source.includes('writeFile') && !source.includes('.propose(') && !source.includes('.settle('), 'runtime contains no direct write route');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime signs nothing and accepts no private key API');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');

check(focused.includes('focused suite observes every closed classification'), 'focused suite covers every classification');
check(focused.includes('fork A strictly extends complete previous history') && focused.includes('fork B independently extends the same previous history'), 'focused test proves two real independent forward candidates');
check(focused.includes('co-presented divergent candidates expose replacement or fork'), 'focused test exposes fork only when co-presented');
check(focused.includes('jointly replaced checkpoints policies signatures and anchors form another valid relative pair'), 'focused test preserves joint replacement');
check(focused.includes('pairwise comparison leaves origin ledger byte-for-byte unchanged'), 'focused test proves read-only behavior by tree digest');
check(focused.includes('fresh process rebuilds forward pairwise receipt'), 'focused test proves fresh-process reconstruction');
check(/Two different candidates can independently extend/.test(readme), 'README preserves independent-fork boundary');
check(/jointly replacing both checkpoints/.test(readme), 'README preserves joint-replacement boundary');
check(/Browser render\/click evidence is not applicable/.test(routes), 'evidence routes preserve nonvisual browser boundary');

check(schema.additionalProperties === false, 'transition schema closes unknown top-level fields');
check(schema.properties.classification.enum.length === 15, 'transition schema closes classification to fifteen outcomes');
check(schema.properties.decision.properties.autonomousActionCount.const === 0, 'transition schema prevents autonomous action');
check(sourceSnapshot.sources.length === 185, 'source snapshot declares one hundred eighty-five normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 39 && results.summary.passed === 39 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 2804, 'focused assertion count matches recorded outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable history-checkpoint pairwise evidence selftest: PASS (' + checks + ' checks)');
