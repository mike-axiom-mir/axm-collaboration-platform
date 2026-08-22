#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger');
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
const entrySchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-entry.schema.json');
const manifestSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-manifest.schema.json');
const snapshotSchema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-snapshot.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 27, 'requirements inventory contains twenty-seven exact routes');
check(requirements.requirements.filter(item => item.required).length === 12, 'twelve bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 15, 'fifteen broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 8, 'before comparator is BLOCKED by eight missing adapter capabilities');
check(before.requirements.filter(item => item.status === 'READY').length === 4, 'four upstream and reference capabilities were ready');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.status === 'READY').length === 12, 'all twelve bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 15, 'all fifteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 4, 'before inventory retains four reusable capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 12, 'after inventory declares twelve bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.slice(4, 12).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'atomic-source-and-ledger-binding', 'global-transition-uniqueness', 'globally-consistent-log',
  'external-retention', 'protected-monotonic-state', 'deletion-or-rollback-prevention',
  'authenticated-host-entrypoint', 'authenticated-independent-controllers',
  'authenticated-human-participation', 'externally-trusted-time', 'provider-execution',
  'held-out-evaluation', 'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger', 'contract identity is exact');
check(contract.version === 'v1.9' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('prewrite-source-capture-as-atomic-with-ledger-append'), 'contract refuses atomic source binding');
check(contract.boundaries.refuses.includes('local-sequence-as-global-fork-exclusion'), 'contract refuses local sequence as global uniqueness');
check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization'), 'contract refuses confirmation as authorization');
check(contract.boundaries.refuses.includes('transition-recording-as-execution-adoption-promotion-or-canon-authority'), 'contract refuses downstream authority');

check(source.includes("require('fs')"), 'runtime declares filesystem capability');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-continuity/"), 'runtime composes v1.4 live capture');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/"), 'runtime composes v1.7 separated currentness audit');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/"), 'runtime composes v1.8 pairwise gate');
check(source.includes('CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN'), 'runtime requires exact v1.8 forward classification');
check(source.includes('CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT'), 'runtime requires exact v1.7 currentness match');
check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive-create files');
check(source.includes('fs.fsyncSync(descriptor)'), 'runtime fsyncs written entry files');
check(source.includes('sourceCaptureAndLedgerAppendAtomic: false'), 'runtime keeps source/append atomicity false');
check(source.includes('candidateStillCurrentAfterWriteProven: false'), 'runtime keeps later currentness false');
check(source.includes('independentStateRootsExcluded: false'), 'runtime keeps independent roots unexcluded');
check(source.includes('globalTransitionUniquenessProven: false'), 'runtime keeps global uniqueness false');
check(source.includes('deletionOrRollbackPrevented: false'), 'runtime keeps deletion prevention false');
check(source.includes('hostAuthorizationAuthenticated: false'), 'runtime keeps host authorization false');
check(source.includes('humanBenefitProven: false'), 'runtime keeps benefit false');
check(source.includes('automaticCanon: false'), 'runtime keeps CANON false');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');

check(focusedTest.includes('source extension beyond candidate checkpoint is refused'), 'focused test proves source-extension refusal');
check(focusedTest.includes('source rollback relative to candidate checkpoint is refused'), 'focused test proves source-rollback refusal');
check(focusedTest.includes('independent roots can accept divergent candidate branches'), 'focused test preserves divergent independent roots');
check(focusedTest.includes('deleting the local root reopens sequence one'), 'focused test preserves deletion reopening');
check(focusedTest.includes('exclusive create admits one concurrent writer'), 'focused test proves bounded local contention');
check(focusedTest.includes('fresh process exact-rebuilds persisted entry from caller package'), 'focused test proves fresh-process caller-package rebuild');
check(/source capture happens before the ledger append; those operations are not atomic/.test(readme), 'README preserves non-atomic source boundary');
check(/Two independent roots can record different forks/.test(readme), 'README preserves independent-root counterexample');
check(/Capture and append are not atomic/.test(routes), 'evidence routes preserve atomicity counterevidence');

[entrySchema, manifestSchema, snapshotSchema].forEach(schema => check(schema.additionalProperties === false, schema.title + ' closes unknown top-level fields'));
check(entrySchema.properties.truth.type === 'object' && entrySchema.properties.entryDigest.$ref, 'entry schema binds truth object and entry digest');
check(manifestSchema.properties.authorityOrigin.const === 'CALLER_STATE_ROOT_AND_CONFIRMATION_UNAUTHENTICATED', 'manifest schema keeps authority unauthenticated');
check(snapshotSchema.properties.entryCount.minimum === 0, 'snapshot schema permits exact empty local ledger state');

check(sourceSnapshot.sources.length === 149, 'source snapshot declares one hundred forty-nine normalized TEST inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match current normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 35 && results.summary.passed === 35 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 2417, 'focused assertion count matches recorded command outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nLocal-possession checkpoint transition ledger evidence selftest: PASS (' + checks + ' checks)');
