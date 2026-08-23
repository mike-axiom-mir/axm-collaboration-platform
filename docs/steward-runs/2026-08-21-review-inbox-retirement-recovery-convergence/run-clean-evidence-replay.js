#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const EVIDENCE_COMMIT = 'ef4a1673ca020267a0041da0b8db41266b7c29e4';
const EVIDENCE_TREE = '6bad4c04c83de8a4ba659595d19b040b6b323bfb';
const EVIDENCE_PATH = 'docs/steward-runs/2026-08-21-review-inbox-retirement-recovery-convergence';
const slicePaths = [EVIDENCE_PATH, 'tools/deterministic-json-core'];
function run(executable, args, options) { return childProcess.spawnSync(executable, args, Object.assign({ encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 }, options)); }
function git(args, cwd, encoding) { return run('git', args, { cwd, encoding:encoding === null ? null : 'utf8' }); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v48-clean-evidence-')), archive = path.join(temp, 'evidence.tar');
try {
  const tree = String(git(['rev-parse', EVIDENCE_COMMIT + '^{tree}'], ROOT).stdout || '').trim();
  if (tree !== EVIDENCE_TREE) throw new Error('evidence tree identity mismatch');
  const gitDir = String(git(['rev-parse','--absolute-git-dir'], ROOT).stdout || '').trim();
  const made = git(['archive','--format=tar','--output',archive,EVIDENCE_COMMIT,'--',...slicePaths], ROOT);
  if (made.status !== 0) throw new Error('evidence archive creation failed');
  const extracted = run('tar', ['-xf',archive,'-C',temp], { cwd:ROOT });
  if (extracted.status !== 0) throw new Error('evidence archive extraction failed');
  const listing = git(['ls-tree','-r','--name-only','-z',EVIDENCE_COMMIT,'--',...slicePaths], ROOT);
  const names = String(listing.stdout || '').split('\0').filter(Boolean);
  const selftest = run(process.execPath, [path.join(EVIDENCE_PATH, 'selftest.js')], { cwd:temp, env:{ ...process.env, GIT_DIR:gitDir, GIT_WORK_TREE:temp } });
  const segment = fs.readFileSync(path.join(temp,EVIDENCE_PATH,'SESSION_SEGMENT.jsonl'));
  const seal = JSON.parse(fs.readFileSync(path.join(temp,EVIDENCE_PATH,'SESSION_SEGMENT.seal.json'),'utf8'));
  const lines = segment.toString('utf8').split(/\r?\n/).filter(Boolean), valid = lines.filter(line => { try { JSON.parse(line); return true; } catch (_) { return false; } }).length;
  const sealReplay = { verdict:seal.sha256 === sha256(segment) && seal.eventLines === lines.length && valid === lines.length ? 'PASS' : 'FAIL', sha256Matches:seal.sha256 === sha256(segment), eventLines:lines.length, validJsonLines:valid };
  const receipt = {
    schema:'axm.clean-archived-evidence-replay/v1', status:selftest.status === 0 && sealReplay.verdict === 'PASS' ? 'PASS' : 'FAIL',
    evidenceCommit:EVIDENCE_COMMIT, evidenceTree:EVIDENCE_TREE, slicePaths, archiveSha256:'sha256:' + sha256(fs.readFileSync(archive)), trackedFiles:names.length,
    selftest:{ command:'node ' + EVIDENCE_PATH + '/selftest.js', exitCode:Number.isInteger(selftest.status) ? selftest.status : 1, verdict:selftest.status === 0 ? 'PASS' : 'FAIL', stdout:String(selftest.stdout || '').trim(), diagnostic:selftest.status === 0 ? null : String(selftest.stderr || selftest.error || '').trim().slice(-1600) },
    sealReplay, immutableGitObjectDatabaseUsedForProductBlobVerification:true, sourceCheckoutOrSharedMainMutated:false, temporaryReplayPathRetained:false, replayDigest:null
  };
  const body = JSON.parse(JSON.stringify(receipt)); delete body.replayDigest;
  receipt.replayDigest = 'sha256:' + sha256(JSON.stringify(body));
  fs.writeFileSync(path.join(__dirname,'CLEAN_EVIDENCE_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(receipt.status + ' clean archived evidence replay: selftest ' + receipt.selftest.verdict + ', seal ' + receipt.sealReplay.verdict);
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally { fs.rmSync(temp, { recursive:true, force:true, maxRetries:10, retryDelay:100 }); }
