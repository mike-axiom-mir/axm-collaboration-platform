#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
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
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 33, 'requirements inventory contains thirty-three routes');
check(requirements.requirements.filter(item => item.required).length === 16, 'sixteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 17, 'seventeen broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 12, 'before comparator is BLOCKED by twelve missing capabilities');
check(before.requirements.filter(item => item.status === 'READY').length === 4, 'four upstream/reference capabilities were ready');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no bounded missing capability');
check(after.requirements.filter(item => item.status === 'READY').length === 16, 'all sixteen bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 17, 'all seventeen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 4, 'before inventory declares four available inputs');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 16, 'after inventory declares sixteen bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(4, 16).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'atomic-source-and-file-transaction', 'intermediate-or-reverted-change-exclusion', 'later-source-currentness',
  'global-transition-uniqueness', 'globally-consistent-log', 'external-retention', 'protected-monotonic-state',
  'deletion-or-rollback-prevention', 'authenticated-host-entrypoint', 'authenticated-independent-controllers',
  'authenticated-human-participation', 'externally-trusted-time', 'provider-execution', 'held-out-evaluation',
  'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger', 'contract identity is exact');
check(contract.version === 'v2.0' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('proposal-as-settled-head-advance'), 'contract refuses proposal as head advance');
check(contract.boundaries.refuses.includes('observed-postwrite-drift-as-settlement'), 'contract refuses drift as settlement');
check(contract.boundaries.refuses.includes('two-observations-as-exclusion-of-intermediate-or-reverted-source-change'), 'contract refuses intermediate-change exclusion');
check(contract.boundaries.refuses.includes('explicit-confirmations-as-host-authorization'), 'contract refuses confirmations as authorization');
check(contract.boundaries.refuses.includes('proposal-or-settlement-as-execution-adoption-promotion-or-canon-authority'), 'contract refuses downstream authority');

check(source.includes("require('fs')"), 'runtime declares filesystem capability');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-continuity/"), 'runtime composes v1.4 capture');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/"), 'runtime composes v1.7 currentness audit');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/"), 'runtime composes v1.8 transition gate');
check(source.includes('PROPOSED_AFTER_EXACT_PREWRITE_SOURCE_MATCH_SETTLED_HEAD_NOT_ADVANCED'), 'runtime makes proposal state non-settled');
check(source.includes('SETTLED_POSTWRITE_SOURCE_MATCH'), 'runtime defines exact-match settlement');
check(source.includes('HELD_POSTWRITE_SOURCE_EXTENDED_CANDIDATE'), 'runtime defines extension hold');
check(source.includes('HELD_POSTWRITE_SOURCE_ROLLBACK_OR_REPLACEMENT'), 'runtime defines rollback hold');
check(source.includes('settledHeadDerivedOnlyFromMatchingSettlements: true'), 'snapshot truth derives head only from matching settlements');
check(source.includes('proposalAdvancesSettledHead: false'), 'proposal truth refuses head advance');
check(source.includes('sourceCaptureAndProposalWriteAtomic: false'), 'proposal truth keeps prewrite atomicity false');
check(source.includes('sourceCaptureAndSettlementWriteAtomic: false'), 'settlement truth keeps postwrite atomicity false');
check(source.includes('intermediateOrRevertedSourceChangesExcluded: false'), 'settlement truth preserves unseen intermediate changes');
check(source.includes('candidateStillCurrentAfterSettlementProven: false'), 'settlement truth keeps later currentness false');
check(source.includes('independentStateRootsExcluded: false'), 'runtime keeps independent roots unexcluded');
check(source.includes('globalTransitionUniquenessProven: false'), 'runtime keeps global uniqueness false');
check(source.includes('deletionOrRollbackPrevented: false'), 'runtime keeps rollback prevention false');
check(source.includes('hostAuthorizationAuthenticated: false'), 'runtime keeps host authorization false');
check(source.includes('humanBenefitProven: false'), 'runtime keeps benefit false');
check(source.includes('automaticCanon: false'), 'runtime keeps CANON false');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive-create files');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime fsyncs written files');
const publicExports = source.slice(source.lastIndexOf('module.exports'));
check(!publicExports.includes('buildProposal') && !publicExports.includes('buildSettlement'), 'runtime does not export write-claiming internal builders');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');

check(focusedTest.includes('fresh process reloads pending proposal'), 'focused test proves pending crash recovery');
check(focusedTest.includes('proposal does not advance settled head'), 'focused test proves pending proposal does not advance head');
check(focusedTest.includes('post-proposal source extension is held'), 'focused test proves extension hold');
check(focusedTest.includes('post-proposal rollback is held'), 'focused test proves rollback hold');
check(focusedTest.includes('later exact candidate settles after held extension'), 'focused test proves recovery after hold');
check(focusedTest.includes('independent roots settle divergent candidate heads'), 'focused test preserves divergent roots');
check(focusedTest.includes('deleting local namespace reopens proposal sequence one'), 'focused test preserves deletion reopening');
check(focusedTest.includes('exclusive proposal create admits one concurrent writer'), 'focused test proves local contention');
check(/Neither capture is atomic with its following file write/.test(readme), 'README preserves both non-atomic boundaries');
check(/Two observations cannot exclude a transient change/.test(readme), 'README preserves transient-change boundary');
check(/Two observations cannot exclude transient\/reverted changes/.test(routes), 'evidence routes preserve intermediate-change counterevidence');

['manifest', 'proposal', 'settlement', 'snapshot'].forEach(name => {
  const schema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-' + name + '.schema.json');
  check(schema.additionalProperties === false, schema.title + ' closes unknown top-level fields');
});
const settlementSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-settlement.schema.json');
check(settlementSchema.properties.decision.properties.autonomousActionCount.const === 0, 'settlement schema prevents autonomous action');
check(settlementSchema.properties.decision.properties.classification.enum.length === 6, 'settlement schema closes classification to six exact outcomes');
const manifestSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger-manifest.schema.json');
check(manifestSchema.properties.authorityOrigin.const === 'CALLER_STATE_ROOT_AND_CONFIRMATIONS_UNAUTHENTICATED', 'manifest schema keeps authority unauthenticated');

check(sourceSnapshot.sources.length === 159, 'source snapshot declares one hundred fifty-nine normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 36 && results.summary.passed === 36 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 2523, 'focused assertion count matches recorded outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nTwo-phase settlement ledger evidence selftest: PASS (' + checks + ' checks)');
