#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
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
const schema = readModule('model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const routes = fs.readFileSync(path.join(dir, 'EVIDENCE_ROUTES.md'), 'utf8');

check(requirements.requirements.length === 47, 'requirements inventory contains forty-seven exact routes');
check(requirements.requirements.filter(item => item.required).length === 16, 'sixteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 31, 'thirty-one broader routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 14, 'before comparator is BLOCKED by fourteen missing adapter capabilities');
check(before.requirements.filter(item => item.status === 'READY').length === 2, 'v1.7 separator and v0.7 pairwise pattern were the two ready inputs');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 31, 'before comparator preserves thirty-one optional unknown routes');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.status === 'READY').length === 16, 'all sixteen bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 31, 'all thirty-one broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory retains two reusable capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 16, 'after inventory declares sixteen bounded capabilities');
const contractCapabilities = new Set(contract.provides);
const newRequired = requirements.requirements.filter(item => item.required && !['upstream-v1.7-separated-possession-chain', 'existing-v0.7-pairwise-transition-pattern'].includes(item.id));
check(newRequired.every(item => item.capabilities.every(capability => contractCapabilities.has(capability))), 'contract provides every new bounded capability by exact id');

[
  'live-source-state-recapture', 'independent-key-custody',
  'independent-real-world-controllers', 'authenticated-principal-mapping',
  'cross-layer-collusion-exclusion', 'host-authenticated-anchor-pin',
  'anchor-policy-authority', 'witness-policy-authority',
  'witness-policy-replacement-prevention', 'independently-operated-anchor-signers',
  'authenticated-human-anchor', 'actual-human-participation',
  'independently-retained-anchor', 'independently-retained-separation-receipt',
  'independently-retained-checkpoints', 'actual-network-transport',
  'other-host-delivery', 'externally-trusted-time', 'protected-monotonic-state',
  'rollback-prevention', 'withheld-branch-observation',
  'global-transition-uniqueness', 'globally-consistent-transition-log',
  'independently-retained-transition', 'authenticated-host-entrypoint',
  'provider-execution', 'held-out-evaluation', 'branch-adoption',
  'held-out-human-benefit', 'held-out-learning', 'promotion-merge-canon'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(contract.id === 'model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition', 'contract identity is exact');
check(contract.version === 'v1.8' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares a pure read/write boundary');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('presented-checkpoint-as-current-source-state-recapture'), 'contract refuses presented checkpoint as current-state recapture');
check(contract.boundaries.refuses.includes('pairwise-comparison-as-global-fork-exclusion'), 'contract refuses pairwise comparison as global fork exclusion');
check(contract.boundaries.refuses.includes('pairwise-comparison-as-observation-of-withheld-branches'), 'contract refuses withheld-branch observation');
check(contract.boundaries.refuses.includes('same-witness-policy-identity-as-policy-authority-or-replacement-prevention'), 'contract refuses policy identity as authority or prevention');
check(contract.boundaries.refuses.includes('declared-party-digest-continuity-as-authenticated-real-world-identity'), 'contract refuses declared digests as real-world identity');
check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/"), 'runtime composes the exact v1.7 validator');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/"), 'runtime composes the exact v1.6 validator');
check(source.includes("require('../model-shadow-review-challenge-transition-local-possession-continuity/"), 'runtime composes the exact v1.4 checkpoint validator');
check(source.includes('MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024'), 'runtime declares exact artifact byte bound');
check(source.includes("return 'PRESENTED_POSSESSION_CHAIN_EXACT_REPLAY'"), 'runtime has exact replay classification');
check(source.includes("return 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN'"), 'runtime has forward response-extension classification');
check(source.includes("return 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_RESPONSES'"), 'runtime holds missing or replaced prior responses');
check(source.includes("return 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT'"), 'runtime holds witness-policy identity drift');
check(source.includes("return 'HOLD_DECLARED_RECEIVER_DIGEST_DRIFT'"), 'runtime holds declared receiver digest drift');
check(source.includes("return 'HOLD_RECEIVER_POLICY_DRIFT'"), 'runtime holds receiver policy drift');
check(source.includes('sourceSnapshotsPresentedByReferenceOnly: true'), 'runtime declares reference-only source snapshots');
check(source.includes('sourceStateRecapturedByThisModule: false'), 'runtime keeps source-state recapture false');
check(source.includes('presentedCheckpointSourceTruthIndependentlyProven: false'), 'runtime keeps source truth unproven');
check(source.includes('withheldForksExcluded: false'), 'runtime keeps withheld-fork exclusion false');
check(source.includes('globalTransitionUniquenessProven: false'), 'runtime keeps global uniqueness false');
check(source.includes('sameControllerWithDistinctKeysStillPossible: true'), 'runtime preserves same-controller counterexample');
check(source.includes('declaredPrincipalDigestsAuthenticated: false'), 'runtime keeps principal authentication false');
check(source.includes('witnessPolicyReplacementPrevented: false'), 'runtime keeps policy replacement prevention false');
check(source.includes('deletionOrRollbackPrevented: false'), 'runtime keeps rollback prevention false');
check(!source.includes("require('fs')") && !source.includes("require('child_process')"), 'runtime imports no filesystem or process capability');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('crypto.sign') && !source.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');
check(!source.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

check(focusedTest.includes('older ledger pairwise gate cannot consume the v1.7 possession chain'), 'focused test proves old-contract incompatibility');
check(focusedTest.includes('candidate with one new response is a forward extension'), 'focused test proves response extension');
check(focusedTest.includes('second fork independently extends the same prior chain'), 'focused test preserves independently admissible fork');
check(focusedTest.includes('co-presented divergent response forks are held'), 'focused test proves co-presented fork detection');
check(focusedTest.includes('higher self-declared epoch can accompany response extension'), 'focused test preserves self-declared epoch advance');
check(focusedTest.includes('different witness-policy identity is held'), 'focused test proves witness-policy identity hold');
check(focusedTest.includes('different declared receiver digest is held'), 'focused test proves declared receiver hold');
check(focusedTest.includes('changed receiver-policy reference is held'), 'focused test proves receiver-policy hold');
check(focusedTest.includes('caller-presented replaced-response checkpoint is structurally exact'), 'focused test names presented structural replacement boundary');
check(focusedTest.includes('fresh process verifies committed transition receipt'), 'focused test proves fresh-process exact rebuild');
check(/Two different candidates can each extend/.test(readme), 'README preserves independently valid forks');
check(/receives no\s+live state root or snapshot bytes/.test(readme), 'README preserves no-source-recapture boundary');
check(/Verdict: `PASS` for co-presented fork detection; `FAIL` as global fork/.test(routes), 'evidence routes separate fork detection from global exclusion');

check(schema.$id === 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/v1', 'schema identity is exact');
check(schema.additionalProperties === false, 'public schema closes unknown fields');
check(schema.properties.comparison.additionalProperties === false && schema.properties.decision.additionalProperties === false, 'comparison and decision shapes are exact');
check(schema.properties.comparison.properties.replacedPreviousResponses.items.additionalProperties === false, 'replacement evidence shape is exact');
check(schema.properties.decision.properties.autonomousActionCount.const === 0, 'schema prevents autonomous action');
check(schema.properties.truth.properties.sourceStateRecapturedByThisModule.const === false, 'schema keeps source-state recapture false');
check(schema.properties.truth.properties.withheldForksExcluded.const === false, 'schema keeps withheld-fork exclusion false');
check(schema.properties.truth.properties.sameControllerWithDistinctKeysStillPossible.const === true, 'schema preserves same-controller possibility');
check(schema.properties.truth.properties.declaredPrincipalDigestsAuthenticated.const === false, 'schema keeps principal authentication false');
check(schema.properties.truth.properties.automaticCanon.const === false, 'schema keeps automatic CANON false');

check(sourceSnapshot.sources.length === 140, 'source snapshot declares one hundred forty normalized TEST inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match current normalized source bytes');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 36 && results.summary.passed === 36 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 2565, 'focused assertion count matches recorded command outputs');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow local possession checkpoint pairwise transition evidence selftest: PASS (' + checks + ' checks)');
