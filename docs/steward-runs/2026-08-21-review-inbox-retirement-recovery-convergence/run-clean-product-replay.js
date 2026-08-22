#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const PRODUCT_TREE = '9a9beb9f5f6cc13d6ad73f1ea55cc3d683e65c9c';
const slicePaths = ['package.json','shared/operations','shared/readiness','shared/evidence-retention','tools/review-inbox','tools/deterministic-json-core','tools-index.json'];
const commands = [
  'node shared/operations/review-operation-lease-retirement-recovery-convergence-selftest.js',
  'node shared/operations/review-operation-lease-retirement-recovery-process-convergence-selftest.js',
  'node shared/operations/review-operation-lease-retirement-recovery-selftest.js',
  'node shared/operations/review-operation-lease-retirement-selftest.js',
  'node shared/operations/review-operation-lease-selftest.js',
  'node tools/review-inbox/selftest.js',
  'node tools/review-inbox/discovery-seam-review.js'
];
function git(args, cwd, encoding) { return childProcess.spawnSync('git', args, { cwd, encoding:encoding === null ? null : 'utf8', windowsHide:true, timeout:180000, maxBuffer:32 * 1024 * 1024 }); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function digests(root, names) { return new Map(names.map(name => [name, sha256(fs.readFileSync(path.join(root, name)))])); }
function run(command, cwd) {
  const file = command.slice(5), result = childProcess.spawnSync(process.execPath, [file], { cwd, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  return { command, exitCode, verdict:exitCode === 0 ? 'PASS' : 'FAIL', diagnostic:exitCode === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-1600) };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v48-clean-product-')), archive = path.join(temp, 'product.tar');
try {
  const tree = String(git(['rev-parse', PRODUCT_COMMIT + '^{tree}'], ROOT).stdout || '').trim();
  if (tree !== PRODUCT_TREE) throw new Error('product tree identity mismatch');
  const made = git(['archive','--format=tar','--output',archive,PRODUCT_COMMIT,'--',...slicePaths], ROOT);
  if (made.status !== 0) throw new Error('archive creation failed');
  const extracted = childProcess.spawnSync('tar', ['-xf',archive,'-C',temp], { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000 });
  if (extracted.status !== 0) throw new Error('archive extraction failed');
  const listing = git(['ls-tree','-r','--name-only','-z',PRODUCT_COMMIT,'--',...slicePaths], ROOT);
  const names = String(listing.stdout || '').split('\0').filter(Boolean), before = digests(temp, names);
  const results = commands.map(command => run(command, temp)), after = digests(temp, names);
  const changed = names.filter(name => before.get(name) !== after.get(name));
  const receipt = {
    schema:'axm.clean-archived-product-slice-replay/v1', status:results.every(item => item.exitCode === 0) && changed.length === 0 ? 'PASS' : 'FAIL',
    productCommit:PRODUCT_COMMIT, productTree:PRODUCT_TREE, slicePaths, trackedFiles:names.length,
    archiveSha256:'sha256:' + sha256(fs.readFileSync(archive)), commands:results,
    summary:{ commands:results.length, passed:results.filter(item => item.exitCode === 0).length, failed:results.filter(item => item.exitCode !== 0).length },
    trackedFilesUnchangedAfterReplay:changed.length === 0, changedTrackedFiles:changed.slice(0, 20), temporaryReplayPathRetained:false, replayDigest:null
  };
  const body = JSON.parse(Core.canonicalJson(receipt)); delete body.replayDigest;
  receipt.replayDigest = 'sha256:' + sha256(Buffer.from(Core.canonicalJson(body)));
  fs.writeFileSync(path.join(__dirname, 'CLEAN_PRODUCT_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally { fs.rmSync(temp, { recursive:true, force:true, maxRetries:10, retryDelay:100 }); }
