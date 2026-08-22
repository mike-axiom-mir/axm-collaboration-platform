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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request');
const inboxDir = path.join(root, 'tools/review-inbox');
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
const visual = read('VISUAL_RECEIPT.json');
const contract = readModule('module.contract.json');
const artifactSchema = readModule('review-artifact.schema.json');
const requestSchema = readModule('review-request.schema.json');
const inboxManifest = JSON.parse(fs.readFileSync(path.join(inboxDir, 'manifest.json'), 'utf8'));
const inboxContract = JSON.parse(fs.readFileSync(path.join(inboxDir, 'module.contract.json'), 'utf8'));
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const renderer = fs.readFileSync(path.join(inboxDir, 'history-reconciliation-review-view.js'), 'utf8');
const rendererTest = fs.readFileSync(path.join(inboxDir, 'history-reconciliation-review-view-selftest.js'), 'utf8');
const app = fs.readFileSync(path.join(inboxDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(inboxDir, 'index.html'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const frontier = fs.readFileSync(path.join(dir, 'FRONTIER_AUDIT.md'), 'utf8');
const evidenceReadme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');

check(requirements.requirements.length === 39, 'requirements inventory contains thirty-nine routes');
check(requirements.requirements.filter(item => item.required).length === 28, 'twenty-eight bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 11, 'eleven broader routes remain optional');
check(before.overall === 'BLOCKED', 'before comparator is BLOCKED');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one upstream route was ready before v4.0');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 27, 'twenty-seven v4.0 routes were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 11, 'eleven optional routes were gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 28, 'all twenty-eight bounded routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 11, 'all eleven broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 1, 'before inventory exposes only committed v3.9 divergence evidence');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 28, 'after inventory exposes twenty-eight bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 11, 'after inventory preserves eleven unknown capabilities');

check(ContractVerifier.validateContract(contract).pass, 'bridge contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request', 'bridge contract identity is exact');
check(contract.version === 'v4.0' && contract.status === 'TEST', 'bridge version and TEST status are exact');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'bridge remains uninstalled and unpromoted');
check(contract.merge_gate === 'Mike Tobi / AXM', 'bridge contract preserves Mike merge gate');
check(contract.boundaries.writes.length === 0, 'bridge contract declares no writes');
check(contract.boundaries.refuses.includes('review-approval-as-history-reconciliation-or-divergence-resolution'), 'bridge refuses approval-as-reconciliation');
check(contract.boundaries.refuses.includes('pairwise-history-evidence-as-independent-custody-globality-or-protected-monotonic-state'), 'bridge refuses custody and globality inflation');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/"), 'bridge composes exact v3.9 verifier');
check(source.includes("observation.classification !== 'COMPLETE_HISTORY_DIVERGES'"), 'bridge admits only v3.9 divergence');
check(source.includes('leftHistory: historySummary(observation.left)') && source.includes('rightHistory: historySummary(observation.right)'), 'bridge retains both minimized history summaries');
check(source.includes('earliestDivergence: clone(observation.comparison.earliestDivergence)'), 'bridge retains earliest divergence');
check(source.includes('reconciliationOnApproval: false') && source.includes('automaticCanon: false'), 'bridge fixes reconciliation and CANON authority false');
check(!/review-service|operations-api|writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|\bfetch\s*\(|XMLHttpRequest|provider\.invoke/.test(source), 'bridge has no ReviewService file-write network or provider surface');

check(artifactSchema.$schema === 'https://json-schema.org/draft/2020-12/schema' && requestSchema.$schema === artifactSchema.$schema, 'both schemas declare Draft 2020-12');
check(artifactSchema.additionalProperties === false && requestSchema.additionalProperties === false, 'both public schemas close top-level shapes');
check(everyObjectClosed(artifactSchema) && everyObjectClosed(requestSchema), 'every local schema object shape is closed');
check(artifactSchema.properties.truth.properties.actualHumanReviewProven.const === false, 'artifact schema fixes human review false');
check(artifactSchema.properties.truth.properties.reconciliationPerformed.const === false, 'artifact schema fixes reconciliation false');
check(requestSchema.properties.reviewCandidate.properties.action.properties.reconciliationOnApproval.const === false, 'request schema fixes approval-as-reconciliation false');
check(requestSchema.properties.reviewCandidate.properties.action.properties.canonAuthority.const === false, 'request schema fixes CANON authority false');

[
  'fixture is an admitted complete-history divergence',
  'exact rebuild writes no source or settlement bytes',
  'candidate is compatible with synthetic ReviewService',
  'exact replay cannot enter reconciliation review',
  'fresh process exact-rebuilds identical request',
  'runtime opens no filesystem write surface',
  'synthetic ReviewService state is removed'
].forEach(label => check(focused.includes(label), 'bridge focused suite covers ' + label));

check(inboxManifest.version === 'v0.4' && inboxManifest.status === 'TEST', 'Review Inbox manifest is v0.4 TEST');
check(inboxContract.version === inboxManifest.version, 'Review Inbox contract matches manifest version');
check(inboxContract.provides.includes('model.shadow.transition-history-reconciliation-review-view.browser-canonical-sha256'), 'Inbox declares browser canonical hash capability');
check(inboxContract.boundaries.refuses.includes('artifact-approval-as-transition-history-reconciliation-or-divergence-resolution'), 'Inbox refuses approval-as-reconciliation');
check(html.indexOf('retention-audit-review-view.js') < html.indexOf('history-reconciliation-review-view.js') && html.indexOf('history-reconciliation-review-view.js') < html.indexOf('app.js'), 'Inbox loads both typed renderers before routing app');
check(app.includes('typedViewFor(current)') && app.includes('typedReviewKinds'), 'Inbox routes dedicated typed kinds fail closed');
check(renderer.includes('ITEM_ARTIFACT_DIGEST_MISMATCH') && renderer.includes('ARTIFACT_SELF_DIGEST_MISMATCH'), 'renderer names both digest mismatch classes');
check(renderer.includes('Approval is not reconciliation') && renderer.includes('protected global history'), 'renderer preserves reconciliation and globality boundaries');
check(!/\bfetch\s*\(|XMLHttpRequest|AXMOps|O\.post|review-service|operations-api/.test(renderer), 'renderer opens no API or ReviewService route');
[
  'exact divergence artifact verifies',
  'approval-as-reconciliation inflation',
  'generic item remains outside typed renderer',
  'renderer escapes hostile HTML element',
  'synthetic ReviewService state is removed'
].forEach(label => check(rendererTest.includes(label), 'renderer suite covers ' + label));

check(routes.routes.length === 6 && routes.routes.every(route => route.verdict === 'PASS'), 'all six bounded evidence routes pass');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every route retains pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'live-desktop-and-narrow-review-journey').kind === 'visual', 'live UI claim routes to visual evidence');
check(routes.routes.find(route => route.claimId === 'reconciliation-identity-benefit-and-authority-boundary').kind === 'authorization', 'authority claim routes to authorization evidence');

check(visual.status === 'PASS' && visual.backend === 'BROWSER_PRIMARY', 'visual receipt records browser-primary PASS');
check(visual.harness.getOnly && visual.harness.postRoutes === '405-read-only' && visual.harness.temporaryReviewStateRemoved, 'visual harness remained read-only and cleaned');
check(visual.desktop.exactSelection.integrityState === 'VERIFIED' && visual.desktop.exactSelection.voteDisabled === false, 'live exact selection verified and enabled vote control');
check(visual.desktop.exactSelection.leftHistoryCommitmentVisible && visual.desktop.exactSelection.rightHistoryCommitmentVisible, 'live exact view showed both commitments');
check(visual.desktop.mismatchSelection.integrityState === 'HOLD' && visual.desktop.mismatchSelection.reason === 'ITEM_ARTIFACT_DIGEST_MISMATCH' && visual.desktop.mismatchSelection.voteDisabled, 'live mismatch stayed on exact typed hold');
check(visual.desktop.existingV29Regression.integrityState === 'VERIFIED' && visual.desktop.genericSelection.typedPanelAbsent, 'live prior-v2.9 and generic paths remained separate');
check(visual.desktop.rapidSelection.verifiedPanels === 0 && visual.desktop.rapidSelection.holdPanels === 1, 'rapid selection ignored stale verified results');
check(!visual.narrow.horizontalPageOverflow && visual.narrow.factColumns === 1 && visual.narrow.votePanelPosition === 'static', 'narrow layout has one column no overflow and static vote panel');
check(visual.retention.screenshotsRetained === false && visual.retention.inMemoryFrameVariablesCleared, 'temporary screenshot buffers were not retained');

check(/59\/59 commands passed/.test(summary) && /5,708 focused/.test(summary), 'summary preserves exact verification totals');
check(/Independent schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent validator');
check(/Review approval is not reconciliation/.test(frontier), 'frontier preserves approval-as-reconciliation boundary');
check(/next meaningful seam is not another local digest wrapper/.test(frontier), 'frontier identifies real next infrastructure or authority seam');
check(/Passing tests do not make this `CANON`/.test(evidenceReadme), 'evidence README refuses test-as-CANON');

check(sources.sources.length === 335, 'source snapshot declares three hundred thirty-five normalized inputs');
check(sources.sources.every(item => { const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n'); return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex'); }), 'all source snapshot digests match normalized bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 59 && results.summary.passed === 59 && results.summary.failed === 0, 'all recorded commands passed');
check(results.summary.focusedAssertions === 5708, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 49, 'forty-nine focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nTransition-history reconciliation-review evidence selftest: PASS (' + checks + ' checks)');
