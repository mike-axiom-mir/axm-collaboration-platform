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
const moduleDir = path.join(root, 'shared/model-shadow-history-checkpoint-pin-transition');
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
const pinSchema = readModule('pin.schema.json');
const transitionSchema = readModule('transition.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-history-checkpoint-pin-transition.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 45, 'requirements inventory contains forty-five routes');
check(requirements.requirements.filter(item => item.required).length === 27, 'twenty-seven bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 18, 'eighteen broader routes remain optional');
check(before.overall === 'UNKNOWN' && before.missingCapabilities.length === 0, 'before comparator is honestly UNKNOWN');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three upstream capabilities were ready');
check(before.requirements.filter(item => item.status === 'UNKNOWN').length === 24, 'twenty-four v2.4 capabilities were unknown before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 27, 'all twenty-seven required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 18, 'all eighteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available upstream capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 27, 'after inventory declares twenty-seven bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(3, 27).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'authenticated-checkpoint-origin-or-pin', 'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'authenticated-policy-rotation', 'authenticated-controller-independence', 'collusion-exclusion', 'authenticated-human-participation',
  'authenticated-host-entrypoint', 'externally-trusted-time', 'global-transition-uniqueness', 'globally-consistent-log',
  'atomic-ledger-snapshot', 'provider-execution', 'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-portable-history-checkpoint-pin-transition', 'contract identity is exact');
check(contract.version === 'v2.4' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.writes.length === 0 && contract.permissions.length === 0, 'contract declares a pure authority-free leaf');
check(contract.boundaries.refuses.includes('caller-presented-pin-as-authenticated-origin-authority-or-host-pin'), 'contract refuses authenticated pin authority');
check(contract.boundaries.refuses.includes('joint-replacement-of-pin-and-both-packages-as-original-continuity'), 'contract preserves joint pin-and-pair replacement counterevidence');
check(contract.boundaries.refuses.includes('successor-pin-proposal-as-retained-or-adopted-state'), 'contract refuses proposal adoption');

check(source.includes("require('../model-shadow-history-checkpoint-pairwise/"), 'runtime composes exact v2.3 module');
check(source.includes('Pairwise.buildTransition('), 'runtime rebuilds the unchanged v2.3 pairwise transition');
check(source.includes('Anchor.verifyAnchoredCheckpoint('), 'runtime exact-rebuilds both v2.2 packages');
check(source.includes('PIN_BINDING_DIMENSIONS'), 'runtime declares the closed pin binding set');
check(source.includes('retainedOriginalPinCanExposeJointPairReplacement: true'), 'runtime names conditional retained-pin detection');
check(source.includes('jointPairAndPinReplacementStillPossible: true'), 'runtime preserves joint replacement of pin and pair');
check(source.includes('originalPinContinuityProven: false'), 'runtime refuses original-lineage proof');
check(source.includes('externalRetentionProven: false') && source.includes('protectedMonotonicStateProven: false'), 'runtime refuses retention and monotonic-state proof');
check(!source.includes("require('fs')") && !source.includes('writeFile') && !source.includes('.propose(') && !source.includes('.settle('), 'runtime contains no direct write route');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime signs nothing and accepts no private key API');
check(source.includes('providerInvoked: false') && source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses provider benefit and CANON claims');

check(focused.includes('focused suite observes every closed v2.4 classification'), 'focused suite covers every v2.4 classification');
check(focused.includes('retained original pin exposes joint replacement of both packages'), 'focused suite proves conditional retained-pin detection');
check(focused.includes('replacing pin and both packages together remains internally forward'), 'focused suite preserves joint replacement counterexample');
check(focused.includes('typed hold names the exact pin drift dimension'), 'focused suite proves typed single-dimension pin drift');
check(focused.includes('successor pin can exact-match its candidate package in a later rebuild'), 'focused suite proves successor-pin reuse');
check(focused.includes('pin transition leaves the source ledger byte-for-byte unchanged'), 'focused suite proves read-only behavior by tree digest');
check(focused.includes('fresh process exact-rebuilds pin and transition'), 'focused suite proves fresh-process reconstruction');
check(/Replacing the pin\s+together with both packages still produces/.test(readme), 'README preserves joint-replacement boundary');
check(/Browser render\/click evidence is not applicable/.test(routes), 'evidence routes preserve nonvisual browser boundary');

check(pinSchema.additionalProperties === false, 'pin schema closes unknown top-level fields');
check(pinSchema.properties.pinKind.enum.length === 2, 'pin schema closes pin kind');
check(pinSchema.allOf.length === 2, 'pin schema constrains genesis and successor lineage shapes');
check(pinSchema.$defs.binding.required.length === 13, 'pin schema requires all thirteen binding dimensions');
check(transitionSchema.additionalProperties === false, 'transition schema closes unknown top-level fields');
check(transitionSchema.properties.classification.enum.length === 5, 'transition schema closes v2.4 classification to five outcomes');
check(transitionSchema.properties.pairwiseClassification.enum.length === 15, 'transition schema preserves all fifteen v2.3 classifications');
check(transitionSchema.$defs.pinComparison.properties.driftDimensions.items.enum.length === 14, 'transition schema closes typed drift dimensions including pin time');
check(transitionSchema.$defs.decision.properties.autonomousActionCount.const === 0, 'transition schema prevents autonomous action');
check(transitionSchema.$defs.decision.properties.successorPinAdoptionAuthorized.const === false, 'transition schema prevents successor adoption');
check(transitionSchema.$defs.truth.properties.originalPinContinuityProven.const === false, 'transition schema refuses original-pin continuity proof');

check(sourceSnapshot.sources.length === 192, 'source snapshot declares one hundred ninety-two normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results));
delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 40 && results.summary.passed === 40 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 2920, 'focused assertion count matches whole-word result parsing');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit and cannot count checkpoint as check');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable history-checkpoint pin-transition evidence selftest: PASS (' + checks + ' checks)');
