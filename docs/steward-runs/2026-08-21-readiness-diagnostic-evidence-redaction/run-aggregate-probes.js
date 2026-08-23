#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'f9558a2cb1427167c1cf7cc5e42f9fe35f086884';
const PRODUCT_COMMIT = '0533987856b321d67ede5f6d8a3fd8867f9cfbfb';
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function runScript(name) {
  return childProcess.spawnSync(process.execPath, [npmCli, 'run', name], {
    cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:240000, maxBuffer:64 * 1024 * 1024
  });
}
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}
function sha(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }

if (!fs.existsSync(npmCli)) throw new Error('trusted npm CLI entry point is missing');
const readiness = runScript('test:readiness');
const operations = runScript('test:operations');
const operationsOutput = String(operations.stdout || '') + String(operations.stderr || '');
const servicePath = 'shared/verification-proof/verification-proof-service.js';
const baselineService = git(['show', BASELINE_COMMIT + ':' + servicePath], null);
const productService = git(['show', PRODUCT_COMMIT + ':' + servicePath], null);
const baselinePackage = JSON.parse(git(['show', BASELINE_COMMIT + ':package.json']));
const productPackage = JSON.parse(git(['show', PRODUCT_COMMIT + ':package.json']));
const intakePath = 'intakes/verification-proof-99-v0.1/modules';
const trackedAt = commit => {
  const result = childProcess.spawnSync('git', ['cat-file','-e',commit + ':' + intakePath], { cwd:ROOT, encoding:'utf8', windowsHide:true });
  return result.status === 0;
};

const receipt = {
  schema:'axm.readiness-diagnostic-redaction-aggregate-probes/v1',
  status:readiness.status === 0 && operations.status !== 0 ? 'PASS_WITH_FOREIGN_FAILURE' : 'UNKNOWN',
  readiness:{
    command:'npm run test:readiness',
    exitCode:Number.isInteger(readiness.status) ? readiness.status : 1,
    verdict:readiness.status === 0 ? 'PASS' : 'FAIL',
    directRedactionSuitePassed:String(readiness.stdout || '').includes('diagnostic redaction selftest: PASS (25 assertions'),
    derivedIndexPrivacySuitePassed:String(readiness.stdout || '').includes('tools index diagnostic privacy selftest: PASS (27 assertions')
  },
  operations:{
    command:'npm run test:operations',
    exitCode:Number.isInteger(operations.status) ? operations.status : 1,
    verdict:operations.status === 0 ? 'PASS' : 'FOREIGN_FAILURE',
    reachedLeaseRecoverySuitePass:operationsOutput.includes('Review operation lease retirement recovery selftest: PASS'),
    errorCode:'CURATED_VERIFICATION_INTAKE_MISSING',
    exactMessageObserved:operationsOutput.includes('curated verification intake is missing')
  },
  baselineComparison:{
    baselineCommit:BASELINE_COMMIT,
    productCommit:PRODUCT_COMMIT,
    baselineServiceSha256:sha(baselineService),
    productServiceSha256:sha(productService),
    serviceBlobUnchanged:Buffer.compare(baselineService, productService) === 0,
    operationsPackageScriptUnchanged:baselinePackage.scripts['test:operations'] === productPackage.scripts['test:operations'],
    intakeDirectoryTrackedAtBaseline:trackedAt(BASELINE_COMMIT),
    intakeDirectoryTrackedAtProduct:trackedAt(PRODUCT_COMMIT),
    intakeDirectoryPresentInWorkspace:fs.existsSync(path.join(ROOT, intakePath)),
    productTouchedVerificationProofLane:false
  },
  classification:{
    result:'FOREIGN_FAILURE',
    v46RegressionProven:false,
    convertedToPass:false,
    substituteIntakeCreated:false
  },
  retention:{
    rawCommandLogsRetained:false,
    rawMachinePathsRetained:false,
    specialistPackagesInspected:false
  }
};
if (receipt.readiness.verdict !== 'PASS' || !receipt.readiness.directRedactionSuitePassed || !receipt.readiness.derivedIndexPrivacySuitePassed ||
  receipt.operations.verdict !== 'FOREIGN_FAILURE' || !receipt.operations.exactMessageObserved || !receipt.baselineComparison.serviceBlobUnchanged ||
  !receipt.baselineComparison.operationsPackageScriptUnchanged || receipt.baselineComparison.intakeDirectoryTrackedAtBaseline ||
  receipt.baselineComparison.intakeDirectoryTrackedAtProduct || receipt.baselineComparison.intakeDirectoryPresentInWorkspace) {
  receipt.status = 'UNKNOWN';
}
fs.writeFileSync(path.join(__dirname, 'AGGREGATE_PROBES.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.status + ' aggregate probes: readiness ' + receipt.readiness.verdict + ', operations ' + receipt.operations.verdict);
if (receipt.status !== 'PASS_WITH_FOREIGN_FAILURE') process.exitCode = 1;
