#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = '8f41d9e039179245d9e7923202d7c82b82158932';
const PRODUCT_COMMIT = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const SERVICE_PATH = 'shared/verification-proof/verification-proof-service.js';
const SELFTEST_PATH = 'tools/verification-proof-lab/selftest.js';
const INTAKE_PATH = 'intakes/verification-proof-99-v0.1/modules';

function git(args, encoding) { return childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024 }); }
function bytes(commit, file) { const result = git(['show', commit + ':' + file], null); if (result.status !== 0) throw new Error('git show failed'); return result.stdout; }
function exists(commit, file) { return git(['cat-file', '-e', commit + ':' + file]).status === 0; }
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function packageScript(commit, name) { return JSON.parse(bytes(commit, 'package.json').toString('utf8')).scripts[name]; }

let executable = 'npm', args = ['run', 'test:operations'];
if (process.platform === 'win32') { executable = process.execPath; args = [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args]; }
const result = childProcess.spawnSync(executable, args, { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
const baselineService = bytes(BASELINE_COMMIT, SERVICE_PATH), productService = bytes(PRODUCT_COMMIT, SERVICE_PATH);
const baselineSelftest = bytes(BASELINE_COMMIT, SELFTEST_PATH), productSelftest = bytes(PRODUCT_COMMIT, SELFTEST_PATH);
const changed = String(git(['diff-tree','--no-commit-id','--name-only','-r',BASELINE_COMMIT,PRODUCT_COMMIT]).stdout || '').split(/\r?\n/).filter(Boolean);
const receipt = {
  schema:'axm.aggregate-operations-probe/v1', status:'FOREIGN_FAILURE', command:'npm run test:operations', exitCode:Number.isInteger(result.status) ? result.status : 1,
  reachedProductChecks:{ reentrantConvergencePass:output.includes('recovery convergence selftest: PASS (30 assertions'), processConvergencePass:output.includes('process convergence selftest: PASS (20 assertions') },
  failure:{ command:'node tools/verification-proof-lab/selftest.js', errorCode:'CURATED_VERIFICATION_INTAKE_MISSING', exactMessageObserved:output.includes('curated verification intake is missing') },
  comparison:{
    baselineCommit:BASELINE_COMMIT, productCommit:PRODUCT_COMMIT,
    serviceSha256:sha256(productService), serviceBlobUnchanged:Buffer.compare(baselineService, productService) === 0,
    selftestSha256:sha256(productSelftest), selftestBlobUnchanged:Buffer.compare(baselineSelftest, productSelftest) === 0,
    modularIntakeScriptUnchanged:packageScript(BASELINE_COMMIT, 'test:modular-intake') === packageScript(PRODUCT_COMMIT, 'test:modular-intake'),
    intakeTrackedAtBaseline:exists(BASELINE_COMMIT, INTAKE_PATH), intakeTrackedAtProduct:exists(PRODUCT_COMMIT, INTAKE_PATH),
    intakePresentInWorkspace:fs.existsSync(path.join(ROOT, INTAKE_PATH)),
    productTouchedFailingLane:changed.some(file => file === SERVICE_PATH || file === SELFTEST_PATH || file.startsWith('intakes/verification-proof-99-v0.1/'))
  },
  classification:{ productRegressionProven:false, convertedToPass:false, missingExternalOrUntrackedCuratedIntake:true },
  retention:{ rawCommandLogRetained:false, temporaryIntakeCreated:false, specialistPackagesInspected:false }
};
if (receipt.exitCode === 0 || !Object.values(receipt.reachedProductChecks).every(Boolean) || !receipt.failure.exactMessageObserved ||
  !receipt.comparison.serviceBlobUnchanged || !receipt.comparison.selftestBlobUnchanged || !receipt.comparison.modularIntakeScriptUnchanged ||
  receipt.comparison.intakeTrackedAtBaseline || receipt.comparison.intakeTrackedAtProduct || receipt.comparison.intakePresentInWorkspace || receipt.comparison.productTouchedFailingLane) receipt.status = 'UNKNOWN';
fs.writeFileSync(path.join(__dirname, 'AGGREGATE_OPERATIONS_PROBE.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(receipt.status + ' aggregate operations probe');
if (receipt.status !== 'FOREIGN_FAILURE') process.exitCode = 1;
