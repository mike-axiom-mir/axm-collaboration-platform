#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'd8e6644ce9d5bfd54fd0f122ebd9ebccbb2f7849';
const PRODUCT_COMMIT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';
const SERVICE = 'shared/verification-proof/verification-proof-service.js';
const INTAKE = 'intakes/verification-proof-99-v0.1/modules';
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git read failed');
  return result.stdout;
}
function exists(commit, name) {
  return childProcess.spawnSync('git', ['cat-file','-e',commit + ':' + name], { cwd:ROOT, windowsHide:true }).status === 0;
}
function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const args = process.platform === 'win32' ? ['/d','/s','/c','npm run test:operations'] : ['run','test:operations'];
const result = childProcess.spawnSync(executable, args, { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:300000, maxBuffer:128 * 1024 * 1024 });
const output = String(result.stdout || '') + String(result.stderr || '');
const serviceBaseline = git(['show',BASELINE_COMMIT + ':' + SERVICE], null);
const serviceProduct = git(['show',PRODUCT_COMMIT + ':' + SERVICE], null);
const packageBaseline = JSON.parse(String(git(['show',BASELINE_COMMIT + ':package.json'])));
const packageProduct = JSON.parse(String(git(['show',PRODUCT_COMMIT + ':package.json'])));
const expected = result.status !== 0 && output.includes('curated verification intake is missing') && output.includes('Review operation lease retirement recovery selftest: PASS');
const receipt = {
  schema:'axm.aggregate-probe/v1',
  verdict:expected ? 'FOREIGN_FAILURE' : result.status === 0 ? 'PASS' : 'UNKNOWN',
  command:'npm run test:operations',
  exitCode:Number.isInteger(result.status) ? result.status : 1,
  outputSha256:sha(output),
  reachedRetirementRecoveryPass:output.includes('Review operation lease retirement recovery selftest: PASS'),
  failureCode:output.includes('curated verification intake is missing') ? 'CURATED_VERIFICATION_INTAKE_MISSING' : 'UNCLASSIFIED',
  unchangedBoundary:{
    servicePath:SERVICE,
    baselineSha256:sha(serviceBaseline),
    productSha256:sha(serviceProduct),
    serviceExact:Buffer.compare(serviceBaseline, serviceProduct) === 0,
    operationsScriptExact:packageBaseline.scripts['test:operations'] === packageProduct.scripts['test:operations'],
    expectedIntakePath:INTAKE,
    intakePresentInBaseline:exists(BASELINE_COMMIT, INTAKE),
    intakePresentInProduct:exists(PRODUCT_COMMIT, INTAKE),
    intakePresentInWorkspace:fs.existsSync(path.join(ROOT, INTAKE))
  },
  v47ReadinessFilesOnFailingBoundary:false,
  substituteIntakeCreated:false,
  rawCommandLogRetained:false,
  receiptDigest:null
};
const body = JSON.parse(JSON.stringify(receipt)); delete body.receiptDigest;
receipt.receiptDigest = sha(JSON.stringify(body));
fs.writeFileSync(path.join(__dirname, 'AGGREGATE_PROBE.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.verdict + ' operations aggregate: ' + receipt.failureCode + ', unchanged service=' + receipt.unchangedBoundary.serviceExact);
if (receipt.verdict === 'UNKNOWN') process.exitCode = 1;
