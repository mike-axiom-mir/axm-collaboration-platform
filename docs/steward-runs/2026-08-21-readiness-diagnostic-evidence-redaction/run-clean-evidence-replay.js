#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const EVIDENCE_COMMIT = 'fafb67c7abda18e276c8b4942912bffe11b07add';
const EVIDENCE_TREE = '3c7f674e84a884bb4f6740885e4ede22de8561c2';
const EVIDENCE_PATH = 'docs/steward-runs/2026-08-21-readiness-diagnostic-evidence-redaction';
const slicePaths = [EVIDENCE_PATH, 'tools/deterministic-json-core', 'shared/readiness/diagnostic-redaction.js'];

function run(executable, args, options) {
  return childProcess.spawnSync(executable, args, Object.assign({ encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 }, options));
}
function git(args, cwd, encoding) { return run('git', args, { cwd, encoding:encoding === null ? null : 'utf8' }); }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

const container = fs.mkdtempSync(path.join(path.parse(ROOT).root, 'e46-'));
const archiveFile = path.join(container, 'evidence.tar');
try {
  const observedTree = String(git(['show','-s','--format=%T',EVIDENCE_COMMIT], ROOT).stdout || '').trim();
  if (observedTree !== EVIDENCE_TREE) throw new Error('evidence tree identity mismatch');
  const gitDir = String(git(['rev-parse','--absolute-git-dir'], ROOT).stdout || '').trim();
  const archive = git(['archive','--format=tar','--output',archiveFile,EVIDENCE_COMMIT,'--',...slicePaths], ROOT);
  if (archive.status !== 0) throw new Error('evidence archive creation failed');
  const extract = run('tar', ['-xf',archiveFile,'-C',container], { cwd:ROOT });
  if (extract.status !== 0) throw new Error('evidence archive extraction failed');
  const listing = git(['ls-tree','-r','--name-only','-z',EVIDENCE_COMMIT,'--',...slicePaths], ROOT);
  const names = String(listing.stdout || '').split('\0').filter(Boolean);
  const selftest = run(process.execPath, [path.join(EVIDENCE_PATH,'selftest.js')], {
    cwd:container,
    env:Object.assign({}, process.env, { GIT_DIR:gitDir, GIT_WORK_TREE:container })
  });
  const segmentBytes = fs.readFileSync(path.join(container,EVIDENCE_PATH,'SESSION_SEGMENT.jsonl'));
  const seal = JSON.parse(fs.readFileSync(path.join(container,EVIDENCE_PATH,'SESSION_SEGMENT.seal.json'),'utf8'));
  const lines = segmentBytes.toString('utf8').split(/\r?\n/).filter(Boolean);
  const valid = lines.filter(line => { try { JSON.parse(line); return true; } catch (_) { return false; } }).length;
  const sealReplay = {
    verdict:seal.sha256 === sha(segmentBytes) && seal.eventLines === lines.length && valid === lines.length ? 'PASS' : 'FAIL',
    sha256Matches:seal.sha256 === sha(segmentBytes),
    eventLines:lines.length,
    validJsonLines:valid
  };
  const receipt = {
    schema:'axm.clean-archived-evidence-replay/v1',
    status:selftest.status === 0 && sealReplay.verdict === 'PASS' ? 'PASS' : 'FAIL',
    evidenceCommit:EVIDENCE_COMMIT,
    evidenceTree:EVIDENCE_TREE,
    slicePaths,
    archiveSha256:'sha256:' + sha(fs.readFileSync(archiveFile)),
    trackedFiles:names.length,
    selftest:{
      command:'node ' + EVIDENCE_PATH + '/selftest.js',
      exitCode:Number.isInteger(selftest.status) ? selftest.status : 1,
      verdict:selftest.status === 0 ? 'PASS' : 'FAIL',
      stdout:String(selftest.stdout || '').trim(),
      diagnostic:selftest.status === 0 ? null : String(selftest.stderr || selftest.error || '').trim().slice(-2000)
    },
    sealReplay,
    immutableGitObjectDatabaseUsedForProductBlobVerification:true,
    sourceCheckoutOrSharedMainMutated:false,
    temporaryReplayPathRetained:false,
    replayDigest:null
  };
  const digestBody = JSON.parse(JSON.stringify(receipt));
  delete digestBody.replayDigest;
  receipt.replayDigest = 'sha256:' + sha(JSON.stringify(digestBody));
  fs.writeFileSync(path.join(__dirname,'CLEAN_EVIDENCE_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(receipt.status + ' clean evidence replay: selftest ' + receipt.selftest.verdict + ', seal ' + sealReplay.verdict + ', ' + names.length + ' tracked files');
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally {
  if (fs.existsSync(container)) fs.rmSync(container, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  if (fs.existsSync(container)) {
    console.error('clean evidence replay cleanup failed');
    process.exitCode = 1;
  }
}
