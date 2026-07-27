#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Spine = require('./verification-spine');
const Registry = require('./registry-loader');
const Workspace = require('./workspace-runner');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.deepStrictEqual(actual, expected, message); checks++; }

const registry = Registry.loadRegistry(__dirname);
equal(registry.categories.length, 9, 'nine independent category packs load');
equal(registry.profiles.length, 7, 'seven target profiles load');
equal(new Set(registry.categories.map(x => x.id)).size, 9, 'category identities are unique');
ok(registry.categories.some(x => x.id === 'element' && x.baseline_claims.some(claim => claim.id === 'element.ucp-bridge')), 'element category verifies its Universal Component Protocol bridge');
ok(registry.categories.every(x => Array.isArray(x.baseline_claims) && x.baseline_claims.length >= 4), 'every category names a deep baseline exam');
ok(registry.profiles.some(x => x.id === 'game-organism-experimental' && x.required_categories.includes('organ') && x.required_categories.includes('game')), 'game organism profile requires both organ and game evidence');

function receipt(id, category, profile, claims, subject) {
  return Spine.createReceipt({
    id,
    verifier: { id: id + '-verifier', version: '1.0.0', category },
    subject: subject || { id: 'fixture', kind: 'fixture' },
    target_profile: profile,
    claims,
    created_at: '2026-07-22T00:00:00.000Z'
  });
}
function claim(id, status, required) { return { id, status, required: required !== false, risk: 'medium', summary: id, evidence: [] }; }

const modulePass = receipt('module-pass', 'module', 'game-night', [claim('module.contracts', 'PASS')]);
const gamePass = receipt('game-pass', 'game', 'game-night', [claim('game.package-contracts', 'PASS')]);
ok(Spine.validateReceipt(modulePass, registry.categories.map(x => x.id)).pass, 'normalized receipt validates');
const gameProfile = registry.profiles.find(x => x.id === 'game-night');
equal(Spine.resolveReceipts([modulePass, gamePass], gameProfile, registry).verdict, 'VERIFIED', 'required category receipts resolve green');
equal(Spine.resolveReceipts([modulePass], gameProfile, registry).verdict, 'HELD', 'missing required category holds');

const opposite = receipt('module-opposite', 'module', 'game-night', [claim('module.contracts', 'FAIL')]);
const contradicted = Spine.resolveReceipts([modulePass, opposite, gamePass], gameProfile, registry);
equal(contradicted.verdict, 'HELD', 'contradictory native evidence is held rather than averaged');
equal(contradicted.conflicts.length, 1, 'same-claim contradiction is named');

const mobileProfile = registry.profiles.find(x => x.id === 'mobile-game-asset');
const asset4k = receipt('asset-4k', 'asset', 'mobile-game-asset', [claim('asset.texture.4k-present', 'PASS')]);
const lowVram = receipt('low-vram-target', 'game', 'mobile-game-asset', [claim('game.target.low-vram', 'PASS')]);
const targetConflict = Spine.resolveReceipts([asset4k, lowVram], mobileProfile, registry);
equal(targetConflict.verdict, 'HELD', 'profile conflict rule holds incompatible valid facts');
equal(targetConflict.conflicts[0].id, 'high-resolution-versus-low-vram', 'profile conflict keeps its exact identity');

const candidate = Spine.createFailureCandidate({
  id: 'failure-refresh-reset',
  category: 'game',
  title: 'Refresh returned to the launcher',
  claim_id: 'game.refresh.resume',
  target_profile: 'game-night',
  source_summary: 'A host browser refresh discarded the active game route.',
  observed_at: '2026-07-22T00:00:00.000Z',
  check: { id: 'fixture-check', kind: 'file-exists', path: 'resume-route.js' }
});
equal(candidate.lifecycle, 'candidate', 'failure starts as a candidate');
ok(candidate.source.summary.length < 500, 'failure source is compact rather than a raw log');
let evaluated = Spine.evaluateFailureMemory([candidate], () => ({ ok: false, detail: 'not run' }), { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'CANDIDATE', 'candidate does not silently become an active blocker');
equal(evaluated[0].blocking, false, 'candidate is nonblocking');

const active = Spine.reviseFailure(candidate, { lifecycle: 'active' }, { by: 'Mike', reason: 'Reproduced and admitted', at: '2026-07-22T00:10:00.000Z' });
equal(active.revisions.length, 1, 'promotion appends a revision');
equal(active.source.summary, candidate.source.summary, 'promotion preserves original compact source');
evaluated = Spine.evaluateFailureMemory([active], () => ({ ok: false, detail: 'resume route missing' }), { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'FAIL', 'active regression executes its bounded check');
equal(evaluated[0].blocking, true, 'active regression failure blocks');
evaluated = Spine.evaluateFailureMemory([active], () => ({ ok: true, detail: 'resume route present' }), { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'PASS', 'fixed active regression remains guarded');

const monitor = Spine.reviseFailure(active, { lifecycle: 'monitor' }, { by: 'Mike', reason: 'Observe without blocking', at: '2026-07-22T00:20:00.000Z' });
evaluated = Spine.evaluateFailureMemory([monitor], () => ({ ok: false, detail: 'monitor observation' }), { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].blocking, false, 'monitor failure remains visible without blocking');
const monitorReceipt = Spine.failureResultsToReceipts(evaluated, [monitor], 'game-night', '2026-07-22T00:21:00.000Z')[0];
equal(monitorReceipt.claims[0].status, 'WARNING', 'monitor failure normalizes to a warning');

const manual = Spine.reviseFailure(candidate, { lifecycle: 'manual-review', check: null }, { by: 'Mike', reason: 'Physical phone journey', at: '2026-07-22T00:30:00.000Z' });
evaluated = Spine.evaluateFailureMemory([manual], null, { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'HUMAN_REVIEW', 'physical or qualitative failures remain human review');

const activeWithoutCheck = Spine.reviseFailure(candidate, { lifecycle: 'active', check: null }, { by: 'Mike', reason: 'Invalid promotion fixture', at: '2026-07-22T00:40:00.000Z' });
evaluated = Spine.evaluateFailureMemory([activeWithoutCheck], null, { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'MISSING_VALIDATOR', 'active lesson without a check fails honestly');
equal(evaluated[0].blocking, true, 'missing validator blocks an active lesson');

const retired = Spine.reviseFailure(active, { lifecycle: 'retired' }, { by: 'Mike', reason: 'Superseded by native resume contract', at: '2026-07-22T00:50:00.000Z' });
evaluated = Spine.evaluateFailureMemory([retired], () => { throw new Error('retired check must not execute'); }, { categories: registry.categories.map(x => x.id), profiles: registry.profiles.map(x => x.id) });
equal(evaluated[0].status, 'NOT_APPLICABLE', 'retired lesson stays visible but does not execute');

const workspaceReport = Workspace.buildWorkspaceReport({
  at: '2026-07-22T01:00:00.000Z',
  registry,
  profileId: 'workshop-full',
  coreText: '  PASS core\n  warn named limitation',
  effectiveCoreFail: false,
  gameReport: { games: [{ game: 'fixture' }], failCount: 0, warningCount: 1 },
  moduleSeams: { gapCount: 2 },
  userChecks: [], userResults: [], failureMemory: [],
  evaluateCheck: () => ({ ok: true, detail: 'fixture' })
});
equal(workspaceReport.verdict, 'VERIFIED_WITH_LIMITS', 'workspace adapter preserves named warnings');
equal(workspaceReport.receipt_count, 3, 'workspace adapter emits foundation, module and game receipts');
equal(workspaceReport.failure_memory.total, 0, 'empty failure memory stays explicit');

console.log('Verification Spine self-test passed ' + checks + ' checks.');
