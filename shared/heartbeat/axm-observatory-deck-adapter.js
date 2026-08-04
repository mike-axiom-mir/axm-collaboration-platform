'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.heartbeat-observatory-deck/v1';
const VERSION = '0.1.0';
const RUNNER = 'shared/heartbeat/axm-observatory-check-runner.js';
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXCLUDED_EXECUTION_FILES = new Set(['candidate.receipt.json', 'module-bundle.json']);

const REVIEWED_MODULES = Object.freeze([
  { id: 'archive-intake-cartographer', label: 'Archive Intake Cartographer', digest: '5a84e0836675c15ed897df01481607c7c3b4ecb323322c12a5f9e433bbf010c4' },
  { id: 'authority-surface-observatory', label: 'Authority Surface Observatory', digest: '7b9953519189267f7b01fa00a2cbb57f195e81204058df66b26a4480f46dad59' },
  { id: 'browser-global-surface-observatory', label: 'Browser Global Surface Observatory', digest: 'a1862cfac78da5857a12356ec2df0685911384109114b0fcde80148e0946af8d' },
  { id: 'dependency-declaration-observatory', label: 'Dependency Declaration Observatory', digest: '92f3298719b96384b6c5a1205b4434234a380e589e948ca13a43e578498fbc0e' },
  { id: 'detached-candidate-nursery', label: 'Detached Candidate Nursery', digest: '4a9942fc27190369a56059ef35659923e13524e729ebfc2e1b9e1e2141b35cda' },
  { id: 'dual-door-observatory', label: 'Dual Door Observatory', digest: 'f34d8d774e648629dcb7ce7e0eb758d5df5519abb58dbfdf6e0f077fdb1b389c' },
  { id: 'entry-resource-closure-observatory', label: 'Entry Resource Closure Observatory', digest: '23f6c1587a5b60224b8b49464d4f6a97f966024fb816cfcfc12df98c204f63cd' },
  { id: 'handoff-wiring-observatory', label: 'Handoff Wiring Observatory', digest: 'd2aa57ad4bde3215a37fc51b4a6e0e431649949a215934b2161dad73303d86f0' },
  { id: 'host-assumption-observatory', label: 'Host Assumption Observatory', digest: '36c7a0ac1a79d4084779a25fa272382c2c539ef4fa627babc25a3a7dc89e715b' },
  { id: 'human-control-binding-observatory', label: 'Human Control Binding Observatory', digest: 'c5a54b0791969db04b16d95e77782fc1e655fba970829b7257edfb55ca456ca2' },
  { id: 'module-footprint-observatory', label: 'Module Footprint Observatory', digest: '10187359ce1992c84df2592e8dda602a9cfecf843beb9c95c3010e766ad6f036' },
  { id: 'module-lineage-comparator', label: 'Module Lineage Comparator', digest: '63eaa519e7d0b6696d6accfa6f31352a95e41054b2cec4a68162849cba795d20' },
  { id: 'protocol-version-observatory', label: 'Protocol Version Observatory', digest: '961e653ea5bd77e4126a425569d8679cc96126be946a3ab7d54d1e6797489878' },
  { id: 'runtime-channel-observatory', label: 'Runtime Channel Observatory', digest: '46c0a29b35f19480dd93c3ab2bc5f1ca77978a0667364cadfea2ccccd2b470ee' },
  { id: 'schema-identity-observatory', label: 'Schema Identity Observatory', digest: '2734c34d2c9f7f6194a3de981d58dc41a5438c9fe3f60b1ecb9350b23c076112' },
  { id: 'storage-namespace-observatory', label: 'Storage Namespace Observatory', digest: 'ccac6011558530571a2d7b2e4ff72bb4fb41aa7b82424fa5ac3972cae2ffb0e7' },
  { id: 'verification-entry-observatory', label: 'Verification Entry Observatory', digest: '9c1980fec73132bedcea419efd92495d99718348051b454fc906bf82906ec689' },
  { id: 'workshop-census-observatory', label: 'Workshop Census Observatory', digest: 'c85850832ac29a041f48a60f27e873e33acd7b8a92f5ffb0016b9be80a133daa' }
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalizeRelative(value) { return String(value).split(path.sep).join('/'); }
function isExecutionFile(relativePath) {
  const base = path.basename(relativePath);
  if (EXCLUDED_EXECUTION_FILES.has(base) || base.startsWith('current-')) return false;
  const extension = path.extname(base).toLowerCase();
  return extension === '.js' || extension === '.json';
}
function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative === '.') return;
  if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Path escapes Workshop root: ' + target);
}
function assertNoSymlinkSegments(root, target) {
  const relative = path.relative(root, target);
  assertInside(root, target);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Symlink or junction refused: ' + normalizeRelative(path.relative(root, cursor)));
  }
}
function executionFiles(root, moduleId) {
  if (!MODULE_ID_PATTERN.test(moduleId)) throw new Error('Invalid observatory module ID');
  const workshopRoot = path.resolve(root);
  const moduleRoot = path.resolve(workshopRoot, 'tools', moduleId);
  assertInside(workshopRoot, moduleRoot);
  assertNoSymlinkSegments(workshopRoot, moduleRoot);
  if (!fs.statSync(moduleRoot).isDirectory()) throw new Error('Observatory module directory missing: ' + moduleId);
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink or junction refused: ' + normalizeRelative(path.relative(workshopRoot, absolute)));
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const relative = normalizeRelative(path.relative(moduleRoot, absolute));
        if (isExecutionFile(relative)) files.push({ absolute, relative });
      }
    }
  }
  walk(moduleRoot);
  return { workshopRoot, moduleRoot, files: files.sort((a, b) => a.relative.localeCompare(b.relative)) };
}
function executionDigest(root, moduleId) {
  const inventory = executionFiles(root, moduleId);
  const digest = crypto.createHash('sha256');
  for (const file of inventory.files) {
    const fileDigest = crypto.createHash('sha256').update(fs.readFileSync(file.absolute)).digest('hex');
    digest.update(file.relative + '\0' + fileDigest + '\n');
  }
  return { digest: digest.digest('hex'), files: inventory.files.map(file => file.relative), moduleRoot: inventory.moduleRoot };
}
function reviewedModule(moduleId) {
  const review = REVIEWED_MODULES.find(item => item.id === moduleId);
  if (!review) throw new Error('Observatory module is not allowlisted: ' + moduleId);
  return review;
}
function inspect(root, moduleId) {
  const review = reviewedModule(moduleId);
  try {
    const measured = executionDigest(root, moduleId);
    const manifestPath = path.join(measured.moduleRoot, 'manifest.json');
    const selftestPath = path.join(measured.moduleRoot, 'selftest.js');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const reasons = [];
    if (manifest.id !== moduleId) reasons.push('manifest-id-mismatch');
    if (manifest.status !== 'TEST') reasons.push('module-not-test-status');
    if (!measured.files.includes('selftest.js') || !fs.statSync(selftestPath).isFile()) reasons.push('selftest-missing');
    if (review.digest === 'PENDING') reasons.push('review-digest-pending');
    else if (measured.digest !== review.digest) reasons.push('review-digest-mismatch');
    return {
      schema: SCHEMA,
      moduleId,
      status: reasons.length ? 'HELD' : 'READY',
      reasons,
      reviewedDigest: review.digest,
      measuredDigest: measured.digest,
      executionFiles: measured.files.length,
      command: [process.execPath, path.join('tools', moduleId, 'selftest.js')],
      shell: false,
      repairAuthority: 'NONE'
    };
  } catch (error) {
    return { schema: SCHEMA, moduleId, status: 'HELD', reasons: ['inspection-error'], error: error.message, reviewedDigest: review.digest, repairAuthority: 'NONE' };
  }
}
function checkDeck() {
  return REVIEWED_MODULES.map(review => ({
    id: 'observatory-' + review.id,
    label: review.label + ' contract',
    args: [RUNNER, '--module', review.id, '--digest', review.digest],
    evidenceAuthority: 'REVIEWED_EXECUTION_SURFACE_ONLY',
    repairAuthority: 'NONE'
  }));
}

module.exports = {
  SCHEMA,
  VERSION,
  RUNNER,
  REVIEWED_MODULES: clone(REVIEWED_MODULES),
  checkDeck,
  executionDigest,
  inspect,
  reviewedModule
};
