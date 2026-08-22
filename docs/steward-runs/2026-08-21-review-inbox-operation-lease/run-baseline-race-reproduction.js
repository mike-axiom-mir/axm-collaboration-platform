#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASE_COMMIT = '275bb342ff1fb9e5423d8e09409d0a10d7b9c68b';
const PROCESS_COUNT = 8;
const CURRENT_UTILS = path.join(ROOT, 'shared', 'operations', 'operations-utils.js');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function normalizedText(value) { return String(value).replace(/\r\n/g, '\n'); }
function sleep(milliseconds) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds); }

if (process.argv[2] === '--child') {
  const serviceFile = process.argv[3], stateRoot = process.argv[4], barrierRoot = process.argv[5], childId = process.argv[6];
  const U = require(CURRENT_UTILS), originalAtomicJson = U.atomicJson;
  U.atomicJson = function synchronizedAtomicJson(file, value) {
    fs.writeFileSync(path.join(barrierRoot, childId + '.ready'), childId + '\n', 'utf8');
    const deadline = Date.now() + 10000;
    while (fs.readdirSync(barrierRoot).filter(name => name.endsWith('.ready')).length < PROCESS_COUNT) {
      if (Date.now() >= deadline) throw new Error('deterministic read-before-write barrier timed out');
      sleep(5);
    }
    sleep(40);
    return originalAtomicJson(file, value);
  };
  const Review = require(serviceFile);
  process.on('message', message => {
    if (message !== 'go') return;
    try {
      Review.create({ stateRoot }).submit({ kind:'baseline-race', title:'Baseline race ' + childId, sourceRef:'baseline-race:' + childId, artifactDigest:sha256('baseline-race:' + childId) });
      process.exit(0);
    } catch (error) { process.stderr.write(String(error.stack || error)); process.exit(1); }
  });
  if (process.send) process.send('ready');
} else {
  function gitShow(relative) {
    const result = childProcess.spawnSync('git', ['show', BASE_COMMIT + ':' + relative], { cwd:ROOT, encoding:'utf8', windowsHide:true, maxBuffer:8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('git show failed for ' + relative + ': ' + String(result.stderr || '').trim());
    return result.stdout;
  }
  function waitForMessage(proc, expected) { return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('child message timeout: ' + expected)), 15000);
    proc.on('message', message => { if (message === expected) { clearTimeout(timer); resolve(); } });
    proc.on('error', reject);
  }); }
  function waitForExit(proc) { return new Promise(resolve => {
    let stderr = '';
    if (proc.stderr) proc.stderr.on('data', chunk => { stderr += chunk; });
    proc.on('error', error => resolve({ exitCode:1, diagnostic:String(error.message || error).slice(-500) }));
    proc.on('exit', code => resolve({ exitCode:Number.isInteger(code) ? code : 1, diagnostic:String(stderr).trim().slice(-500) || null }));
  }); }

  (async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-baseline-race-'));
    try {
      const baselineService = gitShow('shared/operations/review-service.js');
      const baselineUtils = gitShow('shared/operations/operations-utils.js');
      const currentUtils = fs.readFileSync(CURRENT_UTILS, 'utf8');
      if (sha256(normalizedText(baselineUtils)) !== sha256(normalizedText(currentUtils))) throw new Error('baseline and current operations-utils normalized digests differ');
      const marker = "require('./operations-utils')";
      if (baselineService.split(marker).length !== 2) throw new Error('baseline ReviewService loader seam is not exact');
      const serviceFile = path.join(tempRoot, 'baseline-review-service.js');
      fs.writeFileSync(serviceFile, baselineService.replace(marker, 'require(' + JSON.stringify(CURRENT_UTILS) + ')'), 'utf8');
      const stateRoot = path.join(tempRoot, 'state'), barrierRoot = path.join(tempRoot, 'barrier');
      fs.mkdirSync(barrierRoot, { recursive:true });
      const children = Array.from({ length:PROCESS_COUNT }, (_, index) => childProcess.fork(__filename, ['--child', serviceFile, stateRoot, barrierRoot, String(index)], { silent:true }));
      await Promise.all(children.map(proc => waitForMessage(proc, 'ready')));
      children.forEach(proc => proc.send('go'));
      const childResults = await Promise.all(children.map(waitForExit));
      let items = [], stateReadable = false;
      const stateFile = path.join(stateRoot, 'review-inbox', 'reviews.json');
      try { items = JSON.parse(fs.readFileSync(stateFile, 'utf8')).items; stateReadable = Array.isArray(items); } catch (_) {}
      const actualItems = stateReadable ? items.length : 0;
      const failedChildren = childResults.filter(result => result.exitCode !== 0).length;
      const receipt = {
        schema:'axm.review-operation-baseline-race-reproduction/v1', status:actualItems < PROCESS_COUNT || failedChildren > 0 ? 'REPRODUCED' : 'NOT_REPRODUCED',
        baselineCommit:BASE_COMMIT,
        source:{ reviewServiceSha256:'sha256:' + sha256(normalizedText(baselineService)), operationsUtilsNormalizedSha256:'sha256:' + sha256(normalizedText(baselineUtils)), lineEndingNormalizedForComparison:true, loaderSubstitutionOnly:true },
        interleaving:{ processes:PROCESS_COUNT, barrier:'all processes reached atomicJson after their independent read and before any write', injectedDelayMs:40 },
        result:{ expectedItems:PROCESS_COUNT, actualItems, lostItems:PROCESS_COUNT - actualItems, failedChildren, stateReadable, childExitCodes:childResults.map(result => result.exitCode) },
        boundary:{ productionFrequencyProven:false, naturalUnsynchronizedAttemptConclusive:false, baselineSourceExecutedWithIdenticalOperationsUtils:true, specialistPackagesInspected:false }
      };
      fs.writeFileSync(path.join(__dirname, 'BASELINE_RACE_REPRODUCTION.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
      process.stdout.write('Baseline review race: ' + receipt.status + ' expected=' + PROCESS_COUNT + ' actual=' + actualItems + ' failedChildren=' + failedChildren + '\n');
      if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
    } finally { fs.rmSync(tempRoot, { recursive:true, force:true }); }
  })().catch(error => { console.error(error.stack || error); process.exit(1); });
}
