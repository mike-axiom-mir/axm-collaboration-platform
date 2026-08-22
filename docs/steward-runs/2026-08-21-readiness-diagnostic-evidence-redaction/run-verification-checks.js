#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = '0533987856b321d67ede5f6d8a3fd8867f9cfbfb';
const PRODUCT_TREE = '6007cd2fc1143df2f2cf81ecc4639eed28c3274d';
const commands = [
  { phase:'FOCUSED', args:['--check','shared/readiness/diagnostic-redaction.js'] },
  { phase:'FOCUSED', args:['--check','scripts/generate-tools-index.js'] },
  { phase:'FOCUSED', args:['--check','scripts/daily-verification.js'] },
  { phase:'FOCUSED', args:['shared/readiness/diagnostic-redaction-selftest.js'], assertions:25 },
  { phase:'FOCUSED', args:['shared/readiness/tools-index-diagnostic-privacy-selftest.js'], assertions:27 },
  { phase:'FOCUSED', args:['shared/readiness/selftest.js'] },
  { phase:'FOCUSED', args:['shared/readiness/readiness-observer-selftest.js'] },
  { phase:'FOCUSED', args:['scripts/package-script-path-selftest.js'], controls:255 },
  { phase:'FOCUSED', args:['tools/review-inbox/selftest.js'], assertions:134 },
  { phase:'REQUIRED', args:['verify.js'] },
  { phase:'REQUIRED', args:['hub/hub-selftest.js'] },
  { phase:'REQUIRED', args:['hub/route-selftest.js'] },
  { phase:'REQUIRED', args:['hub/graft-selftest.js'] },
  { phase:'REQUIRED', args:['hub/skin-selftest.js'] },
  { phase:'REQUIRED', args:['hub/verify-plus.js'] },
  { phase:'REQUIRED', args:['tests/html-script-syntax-test.js'] },
  { phase:'REQUIRED', args:['tests/tool-forge-package-test.js'] },
  { phase:'REQUIRED', args:['tools/agent-tool-forge/selftest.js'] },
  { phase:'REQUIRED', args:['tools/evidence-desk/selftest.js'] }
];

function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function commandText(item) { return 'node ' + item.args.join(' '); }

const observedTree = childProcess.spawnSync('git', ['show','-s','--format=%T',PRODUCT_COMMIT], { cwd:ROOT, encoding:'utf8', windowsHide:true });
if (observedTree.status !== 0 || String(observedTree.stdout).trim() !== PRODUCT_TREE) throw new Error('product tree mismatch');

const results = commands.map(item => {
  const started = Date.now();
  const result = childProcess.spawnSync(process.execPath, item.args, {
    cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024
  });
  const output = String(result.stdout || '') + String(result.stderr || '');
  const row = {
    phase:item.phase,
    command:commandText(item),
    verdict:result.status === 0 ? 'PASS' : 'FAIL',
    exitCode:Number.isInteger(result.status) ? result.status : 1,
    durationMs:Date.now() - started,
    outputBytes:Buffer.byteLength(output),
    outputSha256:'sha256:' + sha(output),
    assertions:item.assertions || 0,
    controls:item.controls || 0,
    diagnostic:result.status === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-1000)
  };
  process.stdout.write(row.verdict + ' ' + row.command + '\n');
  return row;
});

const receipt = {
  schema:'axm.scoped-check-results/v1',
  status:results.every(row => row.verdict === 'PASS') ? 'PASS' : 'FAIL',
  productCommit:PRODUCT_COMMIT,
  productTree:PRODUCT_TREE,
  summary:{
    commands:results.length,
    passed:results.filter(row => row.verdict === 'PASS').length,
    failed:results.filter(row => row.verdict !== 'PASS').length,
    focusedAssertions:results.filter(row => row.phase === 'FOCUSED').reduce((sum, row) => sum + row.assertions, 0),
    focusedControls:results.filter(row => row.phase === 'FOCUSED').reduce((sum, row) => sum + row.controls, 0),
    requiredCommands:results.filter(row => row.phase === 'REQUIRED').length
  },
  commands:results,
  rawCommandOutputRetained:false,
  specialistPackagesInspected:false,
  resultsDigest:null
};
const digestBody = JSON.parse(JSON.stringify(receipt));
delete digestBody.resultsDigest;
receipt.resultsDigest = 'sha256:' + sha(JSON.stringify(digestBody));
fs.writeFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.status + ' scoped checks: ' + receipt.summary.passed + '/' + receipt.summary.commands + ' commands, ' + receipt.summary.focusedAssertions + ' focused assertions');
if (receipt.status !== 'PASS') process.exitCode = 1;
