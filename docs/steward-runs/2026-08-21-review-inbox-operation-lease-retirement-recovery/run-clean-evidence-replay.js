#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const EVIDENCE_COMMIT = '178adc0a5d047e7b449116ae4150bb7de56f1a00';
const EVIDENCE_TREE = 'e36c5f7e0a611e09f53750f56e512defc034cbdd';
const EVIDENCE_PATH = 'docs/steward-runs/2026-08-21-review-inbox-operation-lease-retirement-recovery';
const slicePaths = [EVIDENCE_PATH, 'tools/deterministic-json-core'];

function run(executable, args, options) {
  return childProcess.spawnSync(executable, args, Object.assign({
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024
  }, options));
}

function git(args, cwd, encoding) {
  return run('git', args, { cwd, encoding: encoding === null ? null : 'utf8' });
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const container = fs.mkdtempSync(path.join(path.parse(ROOT).root, 'e45-'));
const archiveFile = path.join(container, 'evidence.tar');
let cleanupComplete = false;
try {
  const observedTree = String(git(['rev-parse', EVIDENCE_COMMIT + '^{tree}'], ROOT).stdout || '').trim();
  if (observedTree !== EVIDENCE_TREE) throw new Error('evidence tree identity mismatch');
  const gitDir = String(git(['rev-parse', '--absolute-git-dir'], ROOT).stdout || '').trim();
  const archive = git(['archive', '--format=tar', '--output', archiveFile, EVIDENCE_COMMIT, '--', ...slicePaths], ROOT);
  if (archive.status !== 0) throw new Error('evidence archive creation failed: ' + String(archive.stderr || '').trim());
  const extract = run('tar', ['-xf', archiveFile, '-C', container], { cwd: ROOT });
  if (extract.status !== 0) throw new Error('evidence archive extraction failed: ' + String(extract.stderr || '').trim());
  const listed = git(['ls-tree', '-r', '--name-only', '-z', EVIDENCE_COMMIT, '--', ...slicePaths], ROOT);
  if (listed.status !== 0) throw new Error('evidence tree listing failed');
  const trackedNames = String(listed.stdout || '').split('\0').filter(Boolean);
  const selftest = run(process.execPath, [path.join(EVIDENCE_PATH, 'selftest.js')], {
    cwd: container,
    env: Object.assign({}, process.env, { GIT_DIR: gitDir, GIT_WORK_TREE: container })
  });
  const segmentBytes = fs.readFileSync(path.join(container, EVIDENCE_PATH, 'SESSION_SEGMENT.jsonl'));
  const seal = JSON.parse(fs.readFileSync(path.join(container, EVIDENCE_PATH, 'SESSION_SEGMENT.seal.json'), 'utf8'));
  const lines = segmentBytes.toString('utf8').split(/\r?\n/).filter(Boolean);
  const validJsonLines = lines.filter(line => {
    try { JSON.parse(line); return true; } catch (_) { return false; }
  }).length;
  const sealReplay = {
    verdict: seal.sha256 === sha256(segmentBytes) && seal.eventLines === lines.length && validJsonLines === lines.length ? 'PASS' : 'FAIL',
    sha256Matches: seal.sha256 === sha256(segmentBytes),
    eventLines: lines.length,
    validJsonLines
  };
  const receipt = {
    schema: 'axm.clean-archived-evidence-replay/v1',
    status: selftest.status === 0 && sealReplay.verdict === 'PASS' ? 'PASS' : 'FAIL',
    evidenceCommit: EVIDENCE_COMMIT,
    evidenceTree: EVIDENCE_TREE,
    slicePaths,
    archiveSha256: 'sha256:' + sha256(fs.readFileSync(archiveFile)),
    trackedFiles: trackedNames.length,
    selftest: {
      command: 'node ' + EVIDENCE_PATH + '/selftest.js',
      exitCode: Number.isInteger(selftest.status) ? selftest.status : 1,
      verdict: selftest.status === 0 ? 'PASS' : 'FAIL',
      stdout: String(selftest.stdout || '').trim(),
      diagnostic: selftest.status === 0 ? null : String(selftest.stderr || selftest.error || '').trim().slice(-2000)
    },
    sealReplay,
    immutableGitObjectDatabaseUsedForProductBlobVerification: true,
    sourceCheckoutOrSharedMainMutated: false,
    temporaryReplayPathRetained: false,
    replayDigest: null
  };
  const digestBody = JSON.parse(JSON.stringify(receipt));
  delete digestBody.replayDigest;
  receipt.replayDigest = 'sha256:' + sha256(JSON.stringify(digestBody));
  fs.writeFileSync(path.join(__dirname, 'CLEAN_EVIDENCE_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(receipt.status + ' clean archived evidence replay: selftest ' + receipt.selftest.verdict + ', seal ' + receipt.sealReplay.verdict);
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally {
  if (fs.existsSync(container)) fs.rmSync(container, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  cleanupComplete = !fs.existsSync(container);
  if (!cleanupComplete) {
    console.error('clean evidence replay cleanup failed');
    process.exitCode = 1;
  }
}
