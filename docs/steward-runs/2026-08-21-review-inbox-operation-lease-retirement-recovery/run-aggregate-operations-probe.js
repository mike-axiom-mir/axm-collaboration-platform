#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'db9b6c979d8bcf15cf302e502233dbb5b5f0ea61';
const PRODUCT_COMMIT = 'e3c131254dd3d23fc053b2802d4bb39dd0a75a0f';
const SERVICE_PATH = 'shared/verification-proof/verification-proof-service.js';
const INTAKE_PATH = 'intakes/verification-proof-99-v0.1/modules';

function git(args, encoding) {
  return childProcess.spawnSync('git', args, {
    cwd:ROOT,
    encoding:encoding === null ? null : 'utf8',
    windowsHide:true,
    maxBuffer:16 * 1024 * 1024
  });
}
function gitBytes(commit, file) {
  const result = git(['show', commit + ':' + file], null);
  if (result.status !== 0) throw new Error(String(result.stderr || 'git show failed'));
  return result.stdout;
}
function existsInCommit(commit, file) { return git(['cat-file', '-e', commit + ':' + file]).status === 0; }
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }

const npmArguments = ['run', 'test:operations'];
let executable = 'npm', executableArguments = npmArguments;
if (process.platform === 'win32') {
  executable = process.execPath;
  executableArguments = [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...npmArguments];
}
const result = childProcess.spawnSync(executable, executableArguments, {
  cwd:ROOT,
  encoding:'utf8',
  windowsHide:true,
  timeout:180000,
  maxBuffer:64 * 1024 * 1024
});
const combined = String(result.stdout || '') + '\n' + String(result.stderr || '');
const baselineBytes = gitBytes(BASELINE_COMMIT, SERVICE_PATH);
const productBytes = gitBytes(PRODUCT_COMMIT, SERVICE_PATH);
const changed = String(git(['diff-tree', '--no-commit-id', '--name-only', '-r', BASELINE_COMMIT, PRODUCT_COMMIT]).stdout || '')
  .split(/\r?\n/).filter(Boolean);
const expectedMessage = 'curated verification intake is missing';
const receipt = {
  schema:'axm.aggregate-operations-probe/v1',
  status:'FOREIGN_FAILURE',
  command:'npm run test:operations',
  exitCode:Number.isInteger(result.status) ? result.status : 1,
  reachedNewRecoverySelftestPass:combined.includes('Review operation lease retirement recovery selftest: PASS (105 assertions'),
  failure:{
    command:'node tools/verification-proof-lab/selftest.js',
    errorCode:'CURATED_VERIFICATION_INTAKE_MISSING',
    exactMessageObserved:combined.includes(expectedMessage)
  },
  baselineComparison:{
    baselineCommit:BASELINE_COMMIT,
    productCommit:PRODUCT_COMMIT,
    baselineServiceSha256:sha256(baselineBytes),
    productServiceSha256:sha256(productBytes),
    serviceBlobUnchanged:Buffer.compare(baselineBytes, productBytes) === 0,
    intakeDirectoryTrackedAtBaseline:existsInCommit(BASELINE_COMMIT, INTAKE_PATH),
    intakeDirectoryTrackedAtProduct:existsInCommit(PRODUCT_COMMIT, INTAKE_PATH),
    intakeDirectoryPresentInWorkspace:fs.existsSync(path.join(ROOT, INTAKE_PATH)),
    productTouchedVerificationProofLane:changed.some(file => file === SERVICE_PATH || file.startsWith('tools/verification-proof-lab/') || file.startsWith('intakes/verification-proof-99-v0.1/'))
  },
  classification:{
    result:'FOREIGN_FAILURE',
    v45RegressionProven:false,
    missingExternalOrUntrackedCuratedIntake:true,
    convertedToPass:false
  },
  retention:{
    rawCommandLogRetained:false,
    diagnosticMessageRetained:true,
    temporaryIntakeCreated:false,
    specialistPackagesInspected:false
  }
};
if (receipt.exitCode === 0 || !receipt.reachedNewRecoverySelftestPass || !receipt.failure.exactMessageObserved ||
  !receipt.baselineComparison.serviceBlobUnchanged || receipt.baselineComparison.intakeDirectoryTrackedAtBaseline ||
  receipt.baselineComparison.intakeDirectoryTrackedAtProduct || receipt.baselineComparison.intakeDirectoryPresentInWorkspace ||
  receipt.baselineComparison.productTouchedVerificationProofLane) {
  receipt.status = 'UNKNOWN';
  receipt.classification.result = 'UNKNOWN';
}
fs.writeFileSync(path.join(__dirname, 'AGGREGATE_OPERATIONS_PROBE.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(receipt.status + ' aggregate operations probe at ' + receipt.failure.errorCode);
if (receipt.status !== 'FOREIGN_FAILURE') process.exitCode = 1;
