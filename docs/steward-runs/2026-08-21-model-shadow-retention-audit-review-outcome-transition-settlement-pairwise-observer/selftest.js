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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function everyObjectClosed(schema) {
  let pass = true;
  function walk(value) { if (!value || typeof value !== 'object') return; if (value.type === 'object' && value.additionalProperties !== false) pass = false; Object.values(value).forEach(walk); }
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
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const evidenceReadme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const frontier = fs.readFileSync(path.join(dir, 'FRONTIER_AUDIT.md'), 'utf8');

check(requirements.requirements.length === 34, 'requirements inventory contains thirty-four routes');
check(requirements.requirements.filter(item => item.required).length === 21, 'twenty-one bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 13, 'thirteen broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream route was ready before v3.8');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 20, 'twenty v3.8 routes were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 13, 'thirteen optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 21, 'all twenty-one bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 13, 'all thirteen broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only committed v3.7 rebuild');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 21, 'after inventory exposes twenty-one bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 13, 'after inventory preserves thirteen unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer', 'contract identity is exact');
check(contract.version === 'v3.8' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.provides.filter(value => value.startsWith('model.shadow.retention-audit-review-outcome-transition-settlement-pairwise-observer.')).length === 20, 'contract declares twenty bounded observer capabilities');
check(contract.boundaries.refuses.includes('different-local-epoch-heads-as-fork-without-complete-history-comparison'), 'contract refuses different-epoch fork inflation');
check(contract.boundaries.refuses.includes('v37-package-rebuild-as-live-v36-source-recapture-or-source-entry-currentness'), 'contract refuses source-currentness inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/"), 'runtime composes exact v3.7 module');
check(source.includes('settlementPackageExactRebuild: exactRebuild'), 'runtime retains exact-package fact independently');
check(source.includes('settlementPackageMatchesCurrentReceipt: currentMatch'), 'runtime retains current-receipt match independently');
check(source.includes("return 'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED'"), 'runtime preserves unresolved different-epoch relation');
check(source.includes('liveV36SourceRecaptured: false') && source.includes('sourceEntryCurrentnessReverified: false'), 'runtime denies live v3.6 source currentness evidence');
check(!/require\(['"]fs['"]\)|writeFile|\bfetch\s*\(|crypto\.sign|provider\.invoke/.test(source), 'runtime has no direct file write network signing or provider surface');

[
  'focused cases exercise every side observation classification',
  'focused cases exercise every pairwise classification',
  'noncurrent truth retains independently exact package rebuild',
  'changed-side truth retains independently exact package rebuild',
  'different epochs without a latest-receipt link remain unresolved',
  'different epochs alone are not called a contradiction',
  'same settled head with distinct snapshot is classified without history equivalence',
  'joint pair replacement can present another exact replay with a different head',
  'observer leaves left source bytes unchanged',
  'fresh process exact-rebuilds receipt'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(/different epochs are\s+not called a fork/.test(readme), 'README refuses different-epoch fork inflation');
check(/does not recapture either live\s+v3\.6 source/.test(evidenceReadme), 'evidence README denies live source recapture');
check(/An exact replay pair cannot expose a separately withheld/.test(frontier), 'frontier preserves withheld-frontier counterexample');
check(/Jointly replacing both presented pairs can produce another exact replay/.test(frontier), 'frontier preserves joint-pair replacement counterexample');

check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema declares Draft 2020-12');
check(schema.additionalProperties === false && everyObjectClosed(schema), 'schema closes every local object shape');
check(schema.$defs.truth.properties.completeProposalAndSettlementHistoriesCompared.const === false, 'schema fixes complete-history comparison false');
check(schema.$defs.truth.properties.liveV36SourceRecaptured.const === false, 'schema fixes live source recapture false');
check(schema.$defs.truth.properties.rootsAuthenticatedIndependent.const === false, 'schema fixes root independence false');

check(routes.routes.length === 5 && routes.routes.every(route => route.verdict === 'PASS'), 'all five bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route retains pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'authority-retention-benefit-and-canon-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');
check(/Browser verification: not applicable/.test(summary), 'summary marks browser verification not applicable');
check(/schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/56\/56 commands passed/.test(summary) && /5,237 focused/.test(summary), 'summary preserves exact verification totals');
check(/first full focused suite passed 93 assertions/.test(summary), 'summary preserves first post-green audit baseline');
check(/corrected suite passed 97 assertions/.test(summary), 'summary preserves second post-green audit baseline');
check(/final suite passed 103 assertions/.test(summary), 'summary preserves final focused count');

check(sources.sources.length === 319, 'source snapshot declares three hundred nineteen normalized inputs');
check(sources.sources.every(item => { const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n'); return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex'); }), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 56 && results.summary.passed === 56 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5237, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 46, 'forty-six focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nSettlement pairwise-observer evidence selftest: PASS (' + checks + ' checks)');
