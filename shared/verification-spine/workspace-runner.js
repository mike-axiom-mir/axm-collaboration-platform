'use strict';

const fs = require('fs');
const path = require('path');
const Spine = require('./verification-spine');
const Registry = require('./registry-loader');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return null; }
}

function claim(id, status, required, risk, summary, evidence, limitations) {
  return { id, status, required, risk, summary, evidence: evidence || [], limitations: limitations || [] };
}

function coreReceipt(coreText, effectiveCoreFail, profile, at) {
  const warningCount = (String(coreText || '').match(/^\s*warn\s/gm) || []).length;
  return Spine.createReceipt({
    id: 'workshop-core-floor',
    verifier: { id: 'axm-core-verifier', version: '1.0.0', category: 'foundation' },
    subject: { id: 'axm-workshop', kind: 'workshop' },
    target_profile: profile,
    claims: [
      claim('foundation.core-floor', effectiveCoreFail ? 'FAIL' : 'PASS', true, 'high', effectiveCoreFail ? 'One or more unretired core checks failed.' : 'The unretired core floor passed.', [{ kind: 'deterministic-behavior', surface: 'node verify.js' }]),
      claim('foundation.named-warnings', warningCount ? 'WARNING' : 'PASS', false, 'medium', warningCount ? warningCount + ' core warning line(s) remain visible.' : 'No core warnings were reported.', [{ kind: 'static-structure', surface: 'verify report' }])
    ],
    created_at: at
  });
}

function moduleReceipt(coreText, moduleSeams, profile, at) {
  const contractFailure = /^\s*FAIL\s+module contract/m.test(String(coreText || '')) || /module contract adapter could not run/.test(String(coreText || ''));
  const gaps = Number(moduleSeams && moduleSeams.gapCount || 0);
  return Spine.createReceipt({
    id: 'workshop-module-contracts',
    verifier: { id: 'module-contract-verifier', version: '1.0.0', category: 'module' },
    subject: { id: 'tools', kind: 'module-library' },
    target_profile: profile,
    claims: [
      claim('module.contracts', contractFailure ? 'FAIL' : 'PASS', true, 'high', contractFailure ? 'A declared module contract failed.' : 'Declared module contracts passed.', [{ kind: 'static-structure', surface: 'hub/module-contract-verifier.js' }]),
      claim('module.lifecycle-debt', gaps ? 'WARNING' : 'PASS', false, 'medium', gaps ? gaps + ' lifecycle seam gap(s) remain inventoried.' : 'Lifecycle seams are declared.', [{ kind: 'static-structure', surface: 'exports/module-seam-gaps.json' }])
    ],
    created_at: at
  });
}

function gameReceipt(gameReport, profile, at) {
  if (!gameReport) return null;
  const failures = Number(gameReport.failCount || 0), warnings = Number(gameReport.warningCount || 0);
  return Spine.createReceipt({
    id: 'workshop-game-packages',
    verifier: { id: 'game-package-verifier', version: '1.0.0', category: 'game' },
    subject: { id: 'game-library', kind: 'game-library' },
    target_profile: profile,
    claims: [
      claim('game.package-contracts', failures ? 'FAIL' : 'PASS', true, 'high', failures ? failures + ' game package failure(s).' : (gameReport.games || []).length + ' game package(s) satisfy structural contracts.', [{ kind: 'deterministic-behavior', surface: 'tools/game-hub/game-package-verifier.js' }]),
      claim('game.pending-real-world-evidence', warnings ? 'WARNING' : 'PASS', false, 'medium', warnings ? warnings + ' pending physical, reconnect, overlay or collaborator evidence item(s).' : 'No pending Game Night evidence.', [{ kind: 'interaction-journey', surface: 'exports/game-night-seam-report.json' }])
    ],
    created_at: at
  });
}

function userReceipts(userResults, userChecks, profile, at) {
  const checks = {};
  (userChecks || []).forEach(function (check) { checks[check.id] = check; });
  const grouped = {};
  (userResults || []).forEach(function (result) {
    const definition = checks[result.id] || {};
    const category = definition.category || 'foundation';
    (grouped[category] = grouped[category] || []).push({ result, definition });
  });
  return Object.keys(grouped).sort().map(function (category) {
    return Spine.createReceipt({
      id: 'user-checks-' + category,
      verifier: { id: 'editable-user-checks', version: '1.0.0', category },
      subject: { id: 'axm-workshop', kind: 'workshop' },
      target_profile: profile,
      claims: grouped[category].map(function (entry) {
        const risk = Spine.RISKS.indexOf(entry.definition.risk) >= 0 ? entry.definition.risk : 'medium';
        return claim('user.' + entry.result.id, entry.result.ok ? 'PASS' : 'FAIL', entry.definition.required !== false, risk, entry.result.label, [{ kind: 'deterministic-behavior', detail: entry.result.detail }]);
      }),
      created_at: at
    });
  });
}

function buildWorkspaceReport(options) {
  options = options || {};
  const at = options.at || new Date().toISOString();
  const loaded = options.registry || Registry.loadRegistry(__dirname);
  const profileId = options.profileId || 'workshop-full';
  const profile = loaded.profiles.find(function (item) { return item.id === profileId; });
  if (!profile) throw new Error('unknown verification target profile: ' + profileId);
  const receipts = [
    coreReceipt(options.coreText, options.effectiveCoreFail === true, profileId, at),
    moduleReceipt(options.coreText, options.moduleSeams, profileId, at)
  ];
  const game = gameReceipt(options.gameReport, profileId, at);
  if (game) receipts.push(game);
  receipts.push.apply(receipts, userReceipts(options.userResults, options.userChecks, profileId, at));
  const categoryIds = loaded.categories.map(function (item) { return item.id; });
  const profileIds = loaded.profiles.map(function (item) { return item.id; });
  const failureResults = Spine.evaluateFailureMemory(options.failureMemory || [], options.evaluateCheck, { categories: categoryIds, profiles: profileIds });
  receipts.push.apply(receipts, Spine.failureResultsToReceipts(failureResults, options.failureMemory || [], profileId, at));
  const resolution = Spine.resolveReceipts(receipts, profile, loaded);
  return Object.assign({}, resolution, {
    generated_at: at,
    registry: { schema: loaded.schema, version: loaded.version, categories: categoryIds, profiles: profileIds },
    receipts: receipts,
    failure_memory: {
      total: failureResults.length,
      candidates: failureResults.filter(function (item) { return item.lifecycle === 'candidate'; }).length,
      active: failureResults.filter(function (item) { return item.lifecycle === 'active'; }).length,
      monitor: failureResults.filter(function (item) { return item.lifecycle === 'monitor'; }).length,
      manual_review: failureResults.filter(function (item) { return item.lifecycle === 'manual-review'; }).length,
      retired: failureResults.filter(function (item) { return item.lifecycle === 'retired'; }).length,
      results: failureResults
    }
  });
}

function runCurrentWorkspace(root, options) {
  root = path.resolve(root);
  options = Object.assign({}, options || {});
  options.gameReport = options.gameReport || readJson(path.join(root, 'exports', 'game-night-seam-report.json'));
  options.moduleSeams = options.moduleSeams || readJson(path.join(root, 'exports', 'module-seam-gaps.json'));
  const report = buildWorkspaceReport(options);
  fs.mkdirSync(path.join(root, 'exports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'exports', 'verification-spine-report.json'), JSON.stringify(report, null, 2));
  return report;
}

module.exports = { buildWorkspaceReport, runCurrentWorkspace, coreReceipt, moduleReceipt, gameReceipt, userReceipts };
