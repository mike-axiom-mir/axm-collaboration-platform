#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const product = 'b707aa08f0adf958f6344babf0839c37ab1b9dca';
const productTree = '0f2aa8e9e2fad6e19416c93667cf426899955eed';
const commands = [
  'shared/operations/review-operation-lease-selftest.js',
  'shared/operations/review-operation-lease-retirement-selftest.js',
  'shared/operations/review-operation-lease-retirement-publication-selftest.js',
  'shared/operations/review-operation-lease-retirement-publication-stage-archival-selftest.js',
  'shared/operations/review-operation-lease-retirement-recovery-selftest.js',
  'shared/operations/review-operation-lease-retirement-recovery-convergence-selftest.js',
  'shared/operations/review-operation-lease-retirement-recovery-process-convergence-selftest.js',
  'shared/operations/review-operation-lease-retirement-intent-withdrawal-selftest.js',
  'shared/operations/review-operation-lease-retirement-decision-process-selftest.js',
  'tools/review-inbox/selftest.js',
  'tools/review-inbox/discovery-seam-review.js'
];
const slicePaths = ['package.json','shared/operations','shared/readiness','shared/evidence-retention','tools/review-inbox','tools/deterministic-json-core','tools-index.json'];
function spawn(command,args,cwd,timeout) { return childProcess.spawnSync(command,args,{ cwd,encoding:'utf8',windowsHide:true,timeout:timeout || 180000,maxBuffer:64 * 1024 * 1024 }); }
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function files(root,current) {
  const base = current || root, values = [];
  for (const entry of fs.readdirSync(base,{ withFileTypes:true })) {
    const absolute = path.join(base,entry.name);
    if (entry.isDirectory()) values.push(...files(root,absolute));
    else if (entry.isFile()) values.push(path.relative(root,absolute).replace(/\\/g,'/'));
  }
  return values.sort();
}
function snapshot(root) { return Object.fromEntries(files(root).map(file => [file,sha256(fs.readFileSync(path.join(root,file)))])); }

const container = fs.mkdtempSync(path.join(os.tmpdir(),'axm-v52-clean-product-'));
const replayRoot = path.join(container,'slice'), archiveFile = path.join(container,'slice.tar');
const results = [];
let trackedFilesUnchangedAfterReplay = false, changedTrackedFiles = [], retained = true, trackedFiles = 0;
try {
  const archived = childProcess.spawnSync('git',['archive','--format=tar',product,'--',...slicePaths],{ cwd:ROOT,encoding:null,windowsHide:true,timeout:180000,maxBuffer:128 * 1024 * 1024 });
  if (archived.status !== 0) throw new Error('clean product slice archive failed');
  fs.writeFileSync(archiveFile,archived.stdout);
  fs.mkdirSync(replayRoot);
  const extracted = spawn('tar',['-xf',archiveFile,'-C',replayRoot],ROOT);
  if (extracted.status !== 0) throw new Error('clean product slice extraction failed');
  const before = snapshot(replayRoot);
  trackedFiles = Object.keys(before).length;
  for (const file of commands) {
    const result = spawn(process.execPath,[file],replayRoot);
    const output = String(result.stdout || '');
    const assertions = Array.from(output.matchAll(/(\d+)\s+(?:assertions?|checks?|controls?)\b/gi)).reduce((sum,match) => sum + Number(match[1]),0);
    results.push({ command:'node ' + file, exitCode:result.status, verdict:result.status === 0 ? 'PASS' : 'FAIL', assertions, diagnostic:result.status === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().split(/\r?\n/).slice(-8).join('\n') });
    process.stdout.write((result.status === 0 ? 'PASS ' : 'FAIL ') + file + '\n');
  }
  const after = snapshot(replayRoot);
  changedTrackedFiles = Array.from(new Set([...Object.keys(before),...Object.keys(after)])).filter(file => before[file] !== after[file]).sort();
  trackedFilesUnchangedAfterReplay = changedTrackedFiles.length === 0;
} finally {
  const resolved = path.resolve(container), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('temporary replay root escaped OS temp directory');
  fs.rmSync(resolved,{ recursive:true,force:true });
  retained = fs.existsSync(resolved);
}
const receipt = {
  schema:'axm.clean-product-replay/v1', status:results.every(item => item.exitCode === 0) && trackedFilesUnchangedAfterReplay && !retained ? 'PASS' : 'FAIL',
  productCommit:product, productTree, slicePaths, commands:results, trackedFiles,
  summary:{ commands:results.length, passed:results.filter(item => item.exitCode === 0).length, failed:results.filter(item => item.exitCode !== 0).length, focusedAssertions:results.reduce((sum,item) => sum + item.assertions,0) },
  trackedFilesUnchangedAfterReplay, changedTrackedFiles, temporaryReplayPathRetained:retained, specialistPackageIntakeAttempted:false, replayDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.replayDigest;
receipt.replayDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'CLEAN_PRODUCT_REPLAY.json'), JSON.stringify(receipt,null,2) + '\n','utf8');
if (receipt.status !== 'PASS') process.exitCode = 1;
