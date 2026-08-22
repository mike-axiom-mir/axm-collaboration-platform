#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-review-challenge-transition-declared-disclosure');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
const text = name => fs.readFileSync(path.join(moduleDir, name), 'utf8');
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const contract = readModule('module.contract.json');
const rosterSchema = readModule('model-shadow-review-challenge-transition-disclosure-roster.schema.json');
const assessmentSchema = readModule('model-shadow-review-challenge-transition-declared-disclosure.schema.json');
const implementation = text('model-shadow-review-challenge-transition-declared-disclosure.js');
const focusedTest = text('selftest.js');
const readme = text('README.md');

check(requirements.requirements.length === 30, 'requirements inventory contains thirty exact routes');
check(requirements.requirements.filter(item => item.required).length === 14, 'fourteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 16, 'sixteen external or authority routes remain optional evidence');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before comparator is BLOCKED by thirteen missing bounded capabilities');
check(before.requirements.find(item => item.id === 'upstream-v0.9-presentation-exact-rebuild').status === 'READY', 'v0.9 upstream presentation rebuild was ready before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED with no missing bounded capability');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen required bounded routes are READY');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all sixteen optional external routes remain UNKNOWN');
check(beforeInventory.capabilities.some(item => item.id.endsWith('presentation-exact-rebuild') && item.status === 'available'), 'before inventory retains exact v0.9 upstream capability');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 14, 'after inventory declares fourteen bounded available capabilities including upstream');
check(after.requirements.find(item => item.id === 'authenticated-append-only-root-registry').status === 'OPTIONAL_UNKNOWN', 'authenticated append-only root registry remains unproven');
check(after.requirements.find(item => item.id === 'compelled-all-root-disclosure').status === 'OPTIONAL_UNKNOWN', 'actual all-root disclosure remains unproven');
check(after.requirements.find(item => item.id === 'globally-consistent-transition-log').status === 'OPTIONAL_UNKNOWN', 'global log consistency remains unproven');
check(after.requirements.find(item => item.id === 'independent-real-world-controllers').status === 'OPTIONAL_UNKNOWN', 'real-world controller independence remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unproven');
check(after.requirements.find(item => item.id === 'provider-execution').status === 'OPTIONAL_UNKNOWN', 'provider execution remains unproven');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');
check(after.requirements.find(item => item.id === 'held-out-learning').status === 'OPTIONAL_UNKNOWN', 'held-out learning remains unproven');
check(after.requirements.find(item => item.id === 'promotion-merge-canon').status === 'OPTIONAL_UNKNOWN', 'promotion merge and CANON remain unproven');

check(contract.id === 'model-shadow-review-challenge-transition-declared-disclosure' && contract.version === 'v1.0', 'contract identity and version are exact');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract is permissionless TEST material');
check(contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract declares no runtime read or write route');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('caller-declared-roster-as-authenticated-root-registry'), 'contract refuses roster as authenticated registry');
check(contract.boundaries.refuses.includes('missing-declared-submission-as-proof-of-intentional-withholding'), 'contract refuses absence as intentional-withholding proof');
check(contract.boundaries.refuses.includes('complete-declared-commitment-coverage-as-all-existing-roots'), 'contract refuses declared coverage as all-root proof');
check(contract.boundaries.refuses.includes('declared-coverage-as-actual-compelled-disclosure'), 'contract refuses declared coverage as actual compulsion');
check(contract.boundaries.refuses.includes('all-pairs-prefix-compatibility-as-global-total-order-or-global-consistency'), 'contract refuses all-pairs compatibility as global consistency');
check(contract.boundaries.refuses.includes('assessment-receipt-as-branch-adoption-or-execution-authority'), 'contract refuses assessment as adoption or execution authority');

check(!implementation.includes("require('fs')") && !implementation.includes("require('path')") && !implementation.includes("require('child_process')") && !implementation.includes('fetch('), 'runtime imports no filesystem process path or network capability');
check(implementation.includes('MAX_DECLARED_MEMBERS = 64'), 'runtime declares exact member bound');
check(implementation.includes('MAX_ROSTER_CANONICAL_BYTES = 128 * 1024'), 'runtime declares exact roster byte bound');
check(implementation.includes('MAX_ASSESSMENT_CANONICAL_BYTES = 32 * 1024 * 1024'), 'runtime declares exact assessment byte bound');
check(implementation.includes('HOLD_DECLARED_PRESENTATION_COMMITMENT_COVERAGE_INCOMPLETE'), 'runtime has typed incomplete-coverage hold');
check(implementation.includes('HOLD_DECLARED_SET_PRESENTED_HISTORY_CONTRADICTION'), 'runtime has typed declared-set contradiction hold');
check(implementation.includes('DECLARED_SET_PRESENTATIONS_PAIRWISE_COMPATIBLE'), 'runtime has bounded compatible classification');
check(implementation.includes('unlistedRootsExcluded: false') && implementation.includes('actualMultiPartyDisclosureCompelled: false'), 'runtime keeps unlisted roots and actual compulsion false');
check(implementation.includes('declaredMemberSetAuthorityAuthenticated: false') && implementation.includes('realWorldControllerIndependenceProven: false'), 'runtime keeps registry authority and controller independence false');

check(focusedTest.includes('missing declared submission creates a typed coverage hold'), 'focused test proves missing declared commitment hold');
check(focusedTest.includes('valid alternate submission creates a typed coverage hold'), 'focused test proves valid commitment mismatch hold');
check(focusedTest.includes('three matching members produce every one of three pairs'), 'focused test proves semantic three-member all-pairs coverage');
check(focusedTest.includes('maximum bounded assessment reconciles all 2,016 distinct pairs'), 'focused test proves maximum all-pairs bound');
check(focusedTest.includes('complete declared-set receipt contains no unlisted presentation digest'), 'focused test proves unlisted valid presentation is absent');
check(focusedTest.includes('fresh process derives exact assessment digest'), 'focused test routes reload through fresh process');
check(focusedTest.includes('assessment over canonical byte limit is refused'), 'focused test proves assessment canonical-byte refusal');
check(focusedTest.includes('assessment receipt embeds no raw public key') && focusedTest.includes('assessment receipt embeds no raw signature'), 'focused test checks receipt data minimization');
check(/caller can omit an existing root/.test(readme) && /cannot be forced to disclose/.test(readme), 'README preserves omitted-root and no-compulsion boundary');

check(rosterSchema.$id === 'axm.model-shadow-review-challenge-transition-disclosure-roster/v1', 'roster schema identity is exact');
check(rosterSchema.properties.members.minItems === 2 && rosterSchema.properties.members.maxItems === 64, 'roster schema mirrors member bounds');
check(rosterSchema.properties.truth.properties.allExistingRootsEnumerated.const === false, 'roster schema keeps all-root enumeration false');
check(assessmentSchema.$id === 'axm.model-shadow-review-challenge-transition-declared-disclosure/v1', 'assessment schema identity is exact');
check(assessmentSchema.properties.pairwiseComparisons.maxItems === 2016, 'assessment schema mirrors maximum pair count');
check(assessmentSchema.properties.truth.properties.unlistedRootsExcluded.const === false, 'assessment schema keeps unlisted-root exclusion false');
check(assessmentSchema.properties.truth.properties.globallyConsistentTransitionLogProven.const === false, 'assessment schema keeps global consistency false');
check(assessmentSchema.properties.truth.properties.automaticCanon.const === false, 'assessment schema keeps automatic CANON false');

const snapshot = read('SOURCE_SNAPSHOT.json');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 68, 'source snapshot declares sixty-eight normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

const results = read('CHECK_RESULTS.json');
const resultPayload = JSON.parse(Core.canonicalJson(results));
delete resultPayload.resultsDigest;
check(results.status === 'PASS' && results.summary.commands === 28 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
check(results.summary.focusedAssertions === 1174, 'focused assertion count matches recorded command outputs');
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(resultPayload)).digest('hex'), 'verification result digest matches canonical content');

const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows machine path');
check(!/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/.test(evidenceJson) && !/Bearer\s+[A-Za-z0-9._-]{16,}/i.test(evidenceJson), 'evidence JSON contains no API key or bearer-token pattern');

console.log('\nModel Shadow review challenge transition declared disclosure evidence selftest: PASS (' + checks + ' checks)');
