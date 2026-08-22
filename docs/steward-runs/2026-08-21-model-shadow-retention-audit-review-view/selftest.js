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
const moduleDir = path.join(root, 'tools/review-inbox');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const routes = read('EVIDENCE_ROUTES.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const visual = read('VISUAL_RECEIPT.json');
const contract = readModule('module.contract.json');
const manifest = readModule('manifest.json');
const renderer = fs.readFileSync(path.join(moduleDir, 'retention-audit-review-view.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'retention-audit-review-view-selftest.js'), 'utf8');
const app = fs.readFileSync(path.join(moduleDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(moduleDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(moduleDir, 'review-inbox.css'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 27, 'requirements inventory contains twenty-seven routes');
check(requirements.requirements.filter(item => item.required).length === 20, 'twenty bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 7, 'seven broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 17, 'before comparator exposes seventeen bounded misses');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three inherited capabilities were ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 17, 'seventeen v3.0 capabilities were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 7, 'seven broader routes were optional unknown');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 20, 'all twenty required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 7, 'all seven broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 20, 'after inventory declares twenty bounded capabilities');
const provided = new Set(contract.provides);
const localRequired = requirements.requirements.filter(item => item.required).flatMap(item => item.capabilities).filter(id => !beforeInventory.capabilities.some(capability => capability.id === id && capability.status === 'available'));
check(localRequired.every(id => provided.has(id)), 'contract provides every new bounded capability by exact id');
[
  'live-host-submission', 'authenticated-identity', 'actual-human-review', 'hold-resolution',
  'assistive-tech', 'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'Review Inbox contract matches Workshop contract shape');
check(contract.id === 'review-inbox' && contract.version === 'v0.3', 'contract identity and version are exact');
check(manifest.id === contract.id && manifest.version === contract.version && manifest.status === 'TEST', 'manifest binds the TEST contract version');
check(contract.permissions.length === 0 && manifest.permissions.length === 0, 'typed view requests no new permission');
check(contract.boundaries.refuses.includes('typed-view-as-live-submission-or-authenticated-identity'), 'contract refuses submission and identity inference');
check(contract.boundaries.refuses.includes('artifact-approval-as-retention-hold-resolution'), 'contract refuses artifact approval as hold resolution');
check(contract.boundaries.refuses.includes('typed-view-as-execution-adoption-promotion-merge-or-canon-authority'), 'contract refuses consequential authority');
check(manifest.summary.includes('fail-closed typed view'), 'manifest describes the bounded fail-closed seam');

check(renderer.includes("REVIEW_KIND = 'model-shadow-retention-audit-hold'"), 'renderer matches the exact v2.9 review kind');
check(renderer.includes("ARTIFACT_SCHEMA = 'axm.model-shadow-retention-audit-review-artifact/v1'"), 'renderer matches the exact v2.9 artifact schema');
check(renderer.includes('MAX_ARTIFACT_CANONICAL_BYTES = 1048576'), 'renderer fixes the one MiB bound');
check(renderer.includes("provider.subtle.digest('SHA-256'"), 'renderer uses Web Crypto SHA-256');
check(renderer.includes("holdView('ARTIFACT_SELF_DIGEST_MISMATCH')"), 'renderer holds artifact self-digest mismatch');
check(renderer.includes("holdView('ITEM_ARTIFACT_DIGEST_MISMATCH')"), 'renderer holds item-to-artifact mismatch');
check(renderer.includes('Retention hold remains unresolved'), 'renderer keeps the hold visible');
check(renderer.includes('actual human participation is proven by this view'), 'renderer refuses human-participation proof');
check(!/\bfetch\s*\(|XMLHttpRequest|AXMOps|O\.post|review-service|operations-api/.test(renderer), 'renderer opens no API or service route');
check(!/require\(['"]fs['"]\)|require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(renderer), 'renderer imports no filesystem process or network module');

check(app.includes('currentVoteReady') && app.includes('selectionRevision'), 'app has vote readiness and stale-selection state');
check(app.includes('if (revision !== selectionRevision'), 'app ignores stale digest verification');
check(app.includes('vote.disabled = current.kind === typed.REVIEW_KIND'), 'app gates claimed held audits while verification is pending');
check(app.includes('if (!current || !currentVoteReady) return;'), 'vote handler fails closed before POST');
check((app.match(/O\.post\(/g) || []).length === 1, 'app retains exactly one pre-existing vote POST call');
check(!/localStorage|sessionStorage/.test(app), 'app adds no browser-owned persistence');
check(html.indexOf('../deterministic-json-core/index.js') < html.indexOf('retention-audit-review-view.js'), 'HTML loads deterministic JSON before the renderer');
check(html.indexOf('retention-audit-review-view.js') < html.indexOf('app.js'), 'HTML loads the renderer before app integration');
check(html.includes('id="typedReview" aria-live="polite"'), 'typed result has a live semantic region');
check(html.includes('aria-labelledby="rawEvidenceHeading"'), 'raw evidence retains an accessible label');
check(css.includes('.typed-audit-review') && css.includes('.authority-boundaries'), 'CSS distinguishes typed integrity and authority panels');
check(css.includes('overflow-wrap: anywhere') && css.includes('word-break: break-word'), 'CSS wraps exact digests');
check(/@media \(max-width: 700px\)[\s\S]+\.vote-panel[\s\S]+position: static/.test(css), 'narrow CSS removes the sticky vote panel');
check(/\.audit-facts[\s\S]+grid-template-columns: 1fr/.test(css), 'narrow CSS collapses facts to one column');

check(focused.includes('browser-compatible canonical SHA-256 matches v2.9 artifact'), 'focused suite executes exact v2.9 digest compatibility');
check(focused.includes('automatic apply inflation'), 'focused suite rejects action authority inflation');
check(focused.includes('human review truth inflation'), 'focused suite rejects human-review truth inflation');
check(focused.includes('oversized artifact'), 'focused suite rejects oversized artifacts');
check(focused.includes('renderer escapes hostile HTML element'), 'focused suite exercises hostile text escaping');
check(focused.includes('generic item remains outside typed renderer'), 'focused suite exercises generic non-disruption');

check(routes.routes.length === 6, 'six claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface), 'every claim route has native pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'mismatch-journey').risk === 'high', 'mismatch journey retains high-risk routing');
check(routes.routes.find(route => route.claimId === 'narrow-responsive-view').kind === 'visual appearance', 'responsive claim routes to visual appearance evidence');

check(visual.status === 'PASS' && visual.backend === 'BROWSER_PRIMARY', 'visual receipt records primary browser evidence');
check(visual.desktop.exactSelection.integrityState === 'VERIFIED' && visual.desktop.exactSelection.voteDisabled === false, 'desktop exact selection verified and became vote-ready');
check(visual.desktop.mismatchSelection.integrityState === 'HOLD' && visual.desktop.mismatchSelection.voteDisabled === true, 'desktop mismatch failed closed');
check(visual.desktop.genericSelection.typedPanelAbsent && visual.desktop.genericSelection.voteDisabled === false, 'generic browser item remained untyped');
check(visual.desktop.rapidSelection.cycles === 5 && visual.desktop.rapidSelection.verifiedPanels === 0, 'rapid selection ended without stale verified panel');
check(visual.narrow.viewport.width === 390 && visual.narrow.factColumns === 1, 'narrow receipt records one-column facts');
check(visual.narrow.documentClientWidth === visual.narrow.documentScrollWidth, 'narrow receipt records no horizontal overflow');
check(visual.narrow.holdUnresolvedVisible && visual.narrow.canonBoundaryVisible, 'narrow view kept authority boundaries visible');
check(visual.retention.screenshotsRetained === false && visual.retention.semanticMeasurementsAndDigestsRetained, 'visual receipt deletes frames after semantic extraction');
check(visual.counterevidence.some(value => value.includes('sticky-region stitching')), 'visual receipt preserves capture-method counterevidence');

check(sourceSnapshot.sources.length === 251, 'source snapshot declares two hundred fifty-one normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 48 && results.summary.passed === 48 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 4062, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 38, 'thirty-eight focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(results.commands.find(item => item.command.includes('retention-audit-review-view-selftest')).assertions === 176, 'renderer contributes exactly 176 focused assertions');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts commands to one relative Node script');
check(/global tools-index refresh remains open/.test(summary), 'summary preserves the moving shared-index seam');
check(/Screenshot bytes are not retained/.test(summary), 'summary preserves the temporary-capture boundary');
check(/assistive-technology audit/.test(summary), 'summary refuses assistive-technology proof');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal retention-audit Review Inbox view evidence selftest: PASS (' + checks + ' checks)');
