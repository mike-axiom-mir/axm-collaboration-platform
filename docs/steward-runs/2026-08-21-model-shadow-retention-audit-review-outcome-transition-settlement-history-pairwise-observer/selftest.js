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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function everyObjectClosed(schema) {
  let pass = true;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    const objectType = value.type === 'object' || (Array.isArray(value.type) && value.type.includes('object'));
    if (objectType && value.additionalProperties !== false) pass = false;
    Object.values(value).forEach(walk);
  }
  walk(schema); return pass;
}

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const routes = read('EVIDENCE_ROUTES.json');
const sources = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const schema = readModule('observation.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const evidenceReadme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const frontier = fs.readFileSync(path.join(dir, 'FRONTIER_AUDIT.md'), 'utf8');

check(requirements.requirements.length === 34, 'requirements inventory contains thirty-four routes');
check(requirements.requirements.filter(item => item.required).length === 22, 'twenty-two bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 12, 'twelve broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream route was ready before v3.9');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 21, 'twenty-one v3.9 routes were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 12, 'twelve optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 22, 'all twenty-two bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 12, 'all twelve broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only committed v3.8 current-head comparison');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 22, 'after inventory exposes twenty-two bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 12, 'after inventory preserves twelve unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer', 'contract identity is exact');
check(contract.version === 'v3.9' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-transition-settlement-history-pairwise-observer.')).length === 21, 'contract declares twenty-one bounded observer capabilities');
check(contract.boundaries.refuses.includes('complete-history-double-capture-as-atomic-filesystem-snapshot-or-transient-mutation-exclusion'), 'contract refuses atomicity inflation');
check(contract.boundaries.refuses.includes('matching-complete-local-history-as-global-uniqueness-or-withheld-history-exclusion'), 'contract refuses globality inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/"), 'runtime composes exact v3.7 module');
check(source.includes("events.push({ kind: 'PROPOSAL'") && source.includes("events.push({ kind: 'SETTLEMENT'"), 'runtime commits the ordered complete event stream');
check(source.includes('proposalArtifactSequenceDigest') && source.includes('settlementArtifactSequenceDigest'), 'runtime retains exact artifact-sequence commitments');
check(source.includes('earliestDivergence = {'), 'runtime retains minimized earliest divergence');
check(source.includes('atomicTwoRootHistorySnapshotProven: false') && source.includes('transientMutationAndReversionExcluded: false'), 'runtime denies atomicity and transient-reversion exclusion');
check(source.includes('liveV36SourceRecaptured: false') && source.includes('sourceEntryCurrentnessReverified: false'), 'runtime denies live v3.6 source currentness evidence');
check(!/writeFileSync|unlinkSync|mkdirSync|rmSync|\bfetch\s*\(|crypto\.sign|provider\.invoke/.test(source), 'runtime has no file write network signing or provider surface');

[
  'focused cases exercise every side observation classification',
  'focused cases exercise every pairwise classification',
  'v3.8 exact snapshot replay cannot expose the different intermediate held outcomes',
  'held counterexample ends with the exact same v3.7 snapshot reference',
  'joint exact-replay pairs can commit different complete histories',
  'independent history-capture failure is typed separately',
  'complete-history observation writes no source or settlement bytes',
  'fresh process verifies complete-history observation'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(/exact same\s+v3\.7 snapshot reference/.test(readme), 'README preserves exact-snapshot hidden-history counterexample');
check(/not an atomic\s+filesystem snapshot/.test(evidenceReadme), 'evidence README denies atomic filesystem capture');
check(/v3\.8 exact replay is therefore not complete-history replay/.test(frontier), 'frontier preserves v3.8 exact-replay counterevidence');
check(/Jointly replacing both presented pairs can produce another exact replay/.test(frontier), 'frontier preserves joint-pair replacement counterexample');

check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema declares Draft 2020-12');
check(schema.additionalProperties === false && everyObjectClosed(schema), 'schema closes every local object shape including nullable objects');
check(schema.$defs.truth.properties.atomicTwoRootHistorySnapshotProven.const === false, 'schema fixes atomic history false');
check(schema.$defs.truth.properties.liveV36SourceRecaptured.const === false, 'schema fixes live source recapture false');
check(schema.$defs.truth.properties.rootsAuthenticatedIndependent.const === false, 'schema fixes root independence false');
check(schema.$defs.truth.properties.globallyConsistentLogProven.const === false, 'schema fixes global log false');

check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route retains pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'atomicity-custody-globality-benefit-and-authority-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');
check(/Browser verification: not applicable/.test(summary), 'summary marks browser verification not applicable');
check(/schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/57\/57 commands passed/.test(summary) && /5,405 focused/.test(summary), 'summary preserves exact verification totals');
check(/focused green then passed 164 assertions/.test(summary), 'summary preserves first complete focused baseline');
check(/strengthened final suite passed 168 assertions/.test(summary), 'summary preserves final focused count');
check(/test-harness failures were preserved and fixed/.test(summary), 'summary preserves test-harness failures');

check(sources.sources.length === 326, 'source snapshot declares three hundred twenty-six normalized inputs');
check(sources.sources.every(item => { const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n'); return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex'); }), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 57 && results.summary.passed === 57 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5405, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 47, 'forty-seven focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nSettlement history pairwise-observer evidence selftest: PASS (' + checks + ' checks)');
