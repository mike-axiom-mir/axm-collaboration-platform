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
  { id: 'archive-intake-cartographer', label: 'Archive Intake Cartographer', digest: 'ed57ea25bc0e161714d686a28211652a12e64c16cfc321a8a35d979f8729dd40' },
  { id: 'authority-surface-observatory', label: 'Authority Surface Observatory', digest: 'be1f549ce5d6eb47b4d93f7e85d5b6a9928ce047a6653498ebfb0242f057e925' },
  { id: 'browser-global-surface-observatory', label: 'Browser Global Surface Observatory', digest: '278ae7ce7a4df2262d1b862611b57eb5d46d36cad1f7bad17ce6188ed36670bb' },
  { id: 'dependency-declaration-observatory', label: 'Dependency Declaration Observatory', digest: 'fb409aac40c6596c39e9907f6a95f7631e738a24d1f0d7243a314c8d59a22344' },
  { id: 'detached-candidate-nursery', label: 'Detached Candidate Nursery', digest: '3d4f490a68440da3c509f979282a06291663101f5617fd3892ddfa48ebb779dd' },
  { id: 'dual-door-observatory', label: 'Dual Door Observatory', digest: '2ae7ccd6862fdb69f3622f5a8afe9d923400adab5c118e8f8f39a8cdbfbef061' },
  { id: 'entry-resource-closure-observatory', label: 'Entry Resource Closure Observatory', digest: 'edcce2b33c31af47dc09708196f1dbbb84e41dbfd25b839634f7b991b56375f3' },
  { id: 'handoff-wiring-observatory', label: 'Handoff Wiring Observatory', digest: 'e517f116400f6bf2a67d973f59a3f356a49dd205233ed96a20aa3c87d91f3df3' },
  { id: 'host-assumption-observatory', label: 'Host Assumption Observatory', digest: 'a947072395e811b9bdc4729a99773f5a27dcc99aa8ec7d96ce671a0ab39ecca0' },
  { id: 'human-control-binding-observatory', label: 'Human Control Binding Observatory', digest: 'bc152e6673aa41347b2d8f771401a0edb4421bae182e5dd2cac8ece1f0e908a1' },
  { id: 'module-footprint-observatory', label: 'Module Footprint Observatory', digest: '45c17b4df5087bed5013e56cbd2770432fdd682e826c962c53e4f6befae46911' },
  { id: 'module-lineage-comparator', label: 'Module Lineage Comparator', digest: 'c648e219ff3f056e0844e9d0f84e80995a285041a739b21632cf1b507a032d69' },
  { id: 'protocol-version-observatory', label: 'Protocol Version Observatory', digest: '3c611b0dd33e9973857f63e63f65f046ad7c1a98a1341bd8319c5c19b29e2ff1' },
  { id: 'runtime-channel-observatory', label: 'Runtime Channel Observatory', digest: '1391c76c672e1a178e03fe9daf289bf65b10afc3dd69876439de3afeb54da3b2' },
  { id: 'schema-identity-observatory', label: 'Schema Identity Observatory', digest: '826dfc9d597025b46d1deb2d20905817aea4281c73cfb34da07f0d9c2f617b61' },
  { id: 'storage-namespace-observatory', label: 'Storage Namespace Observatory', digest: 'df309fbfbc324a042e52e82f3e2c2dcaeda67652ddbfcc9ba1020d84ad84311a' },
  { id: 'verification-entry-observatory', label: 'Verification Entry Observatory', digest: 'fca688ee5ce5cbb519e4103b9f964bc97e305625e106184e38b85329a02fe3c2' },
  { id: 'workshop-census-observatory', label: 'Workshop Census Observatory', digest: '81a9de35654c1825f51c1c9688eb0da3bcfb9a1e24c00f11daa9937dafff7009' }
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
