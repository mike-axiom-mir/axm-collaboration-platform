#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = 'e3c131254dd3d23fc053b2802d4bb39dd0a75a0f';
const PRODUCT_TREE = '277940971097ee7114e0bbe7c0f7eee8138b8268';
const commands = [
  'node shared/operations/review-operation-lease-retirement-recovery-selftest.js',
  'node shared/operations/review-operation-lease-retirement-selftest.js',
  'node shared/operations/review-operation-lease-selftest.js',
  'node shared/operations/review-authority-service-selftest.js',
  'node shared/operations/review-projection-recovery-selftest.js',
  'node shared/operations/review-authority-api-selftest.js',
  'node shared/operations/selftest.js',
  'node shared/operations/wave2-selftest.js',
  'node shared/operations/code-draft-technical-reviewer-selftest.js',
  'node tools/review-inbox/selftest.js',
  'node tools/review-inbox/discovery-seam-review.js'
];
const slicePaths = [
  'package.json',
  'shared/operations',
  'shared/evidence-retention',
  'shared/readiness',
  'shared/modular-intake',
  'shared/cognitive-resource',
  'shared/asset-hands',
  'tools/review-inbox',
  'tools/deterministic-json-core',
  'tools/workshop-packager',
  'tools/mirror-code-clone',
  'worlds/foundation-planet',
  'hub',
  'tools-index.json'
];

function run(command, cwd) {
  const parts = command.split(' '), executable = parts.shift();
  const result = childProcess.spawnSync(executable === 'node' ? process.execPath : executable, parts, {
    cwd, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  return {
    command, exitCode, verdict:exitCode === 0 ? 'PASS' : 'FAIL',
    diagnostic:exitCode === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-2000)
  };
}
function git(args, cwd) {
  return childProcess.spawnSync('git', args, {
    cwd, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:16 * 1024 * 1024
  });
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function trackedDigests(root, names) {
  const values = new Map();
  for (const name of names) values.set(name, sha256(fs.readFileSync(path.join(root, name))));
  return values;
}

const container = fs.mkdtempSync(path.join(path.parse(ROOT).root, 'r45-'));
const archiveFile = path.join(container, 'product.tar');
let cleanupComplete = false;
try {
  const observedTree = String(git(['rev-parse', PRODUCT_COMMIT + '^{tree}'], ROOT).stdout || '').trim();
  if (observedTree !== PRODUCT_TREE) throw new Error('product tree identity mismatch');
  const archive = git(['archive', '--format=tar', '--output', archiveFile, PRODUCT_COMMIT, '--', ...slicePaths], ROOT);
  if (archive.status !== 0) throw new Error('product archive creation failed: ' + String(archive.stderr || '').trim());
  const extract = childProcess.spawnSync('tar', ['-xf', archiveFile, '-C', container], {
    cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:16 * 1024 * 1024
  });
  if (extract.status !== 0) throw new Error('product archive extraction failed: ' + String(extract.stderr || '').trim());
  const listed = git(['ls-tree', '-r', '--name-only', '-z', PRODUCT_COMMIT, '--', ...slicePaths], ROOT);
  if (listed.status !== 0) throw new Error('product tree listing failed');
  const trackedNames = String(listed.stdout || '').split('\0').filter(Boolean);
  const before = trackedDigests(container, trackedNames);
  const results = commands.map(command => run(command, container));
  const after = trackedDigests(container, trackedNames);
  const changedTrackedFiles = trackedNames.filter(name => before.get(name) !== after.get(name));
  const receipt = {
    schema:'axm.clean-archived-product-slice-replay/v1',
    status:results.every(result => result.exitCode === 0) && changedTrackedFiles.length === 0 ? 'PASS' : 'FAIL',
    productCommit:PRODUCT_COMMIT, productTree:PRODUCT_TREE, slicePaths,
    productSliceArchiveSha256:'sha256:' + sha256(fs.readFileSync(archiveFile)), trackedFiles:trackedNames.length,
    commands:results,
    summary:{ commands:results.length, passed:results.filter(result => result.exitCode === 0).length, failed:results.filter(result => result.exitCode !== 0).length },
    trackedFilesUnchangedAfterReplay:changedTrackedFiles.length === 0,
    changedTrackedFiles:changedTrackedFiles.slice(0, 20), changedTrackedFilesTruncated:changedTrackedFiles.length > 20,
    temporaryReplayPathRetained:false,
    replayDigest:null
  };
  const digestBody = JSON.parse(JSON.stringify(receipt));
  delete digestBody.replayDigest;
  receipt.replayDigest = 'sha256:' + sha256(JSON.stringify(digestBody));
  fs.writeFileSync(path.join(__dirname, 'CLEAN_PRODUCT_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally {
  if (fs.existsSync(container)) fs.rmSync(container, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  cleanupComplete = !fs.existsSync(container);
  if (!cleanupComplete) { console.error('clean replay workspace cleanup failed'); process.exitCode = 1; }
}
