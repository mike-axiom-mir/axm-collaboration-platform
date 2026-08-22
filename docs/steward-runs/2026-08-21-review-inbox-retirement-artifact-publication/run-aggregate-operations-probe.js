#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const parent = '0ac8c4d6b3aa30636a17955ea67c79dfcff45efa';
const product = 'c64dd671c0c4bed1f798a546de879b48c8ac93cc';
const servicePath = 'shared/verification-proof/verification-proof-service.js';
const selftestPath = 'tools/verification-proof-lab/selftest.js';
const intakePath = 'intakes/verification-proof-99-v0.1';
function git(args) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024 });
  return { status:result.status, stdout:String(result.stdout || '').trim() };
}
function blob(commit, file) { return git(['rev-parse',commit + ':' + file]).stdout; }
function exists(commit, file) { return git(['cat-file','-e',commit + ':' + file]).status === 0; }
function packageAt(commit) { return JSON.parse(git(['show',commit + ':package.json']).stdout); }
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }

const executable = process.platform === 'win32' ? process.env.ComSpec : 'npm';
const executableArgs = process.platform === 'win32' ? ['/d','/s','/c','npm run test:operations'] : ['run','test:operations'];
const result = childProcess.spawnSync(executable, executableArgs, { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
const changed = git(['diff','--name-only',parent,product,'--']).stdout.split(/\r?\n/).filter(Boolean);
const receipt = {
  schema:'axm.aggregate-operations-probe/v1',
  status:'FOREIGN_FAILURE',
  command:'npm run test:operations',
  exitCode:Number.isInteger(result.status) ? result.status : 1,
  reachedProductChecks:{
    atomicPublication:output.includes('retirement publication selftest: PASS (125 assertions'),
    withdrawal:output.includes('retirement intent withdrawal selftest: PASS (87 assertions'),
    decisionProcesses:output.includes('retirement decision process selftest: PASS (22 assertions')
  },
  failure:{ errorCode:'CURATED_VERIFICATION_INTAKE_MISSING', exactMessagePresent:output.includes('curated verification intake is missing') },
  comparison:{
    serviceBlobUnchanged:blob(parent,servicePath) === blob(product,servicePath),
    selftestBlobUnchanged:blob(parent,selftestPath) === blob(product,selftestPath),
    modularIntakeScriptUnchanged:packageAt(parent).scripts['test:modular-intake'] === packageAt(product).scripts['test:modular-intake'],
    intakeTrackedAtBaseline:exists(parent,intakePath),
    intakeTrackedAtProduct:exists(product,intakePath),
    intakePresentInWorkspace:fs.existsSync(path.join(ROOT,intakePath)),
    productTouchedFailingLane:changed.some(file => file.startsWith('shared/verification-proof/') || file.startsWith('tools/verification-proof-lab/') || file.startsWith(intakePath + '/'))
  },
  classification:{ convertedToPass:false, productFailure:false, specialistPackageIntakeAttempted:false },
  receiptDigest:null
};
const expectedForeignFailure = receipt.exitCode === 1 && Object.values(receipt.reachedProductChecks).every(Boolean) &&
  receipt.failure.exactMessagePresent && receipt.comparison.serviceBlobUnchanged && receipt.comparison.selftestBlobUnchanged &&
  receipt.comparison.modularIntakeScriptUnchanged && !receipt.comparison.intakeTrackedAtBaseline &&
  !receipt.comparison.intakeTrackedAtProduct && !receipt.comparison.intakePresentInWorkspace && !receipt.comparison.productTouchedFailingLane;
if (!expectedForeignFailure) receipt.status = 'UNCLASSIFIED_FAILURE';
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.receiptDigest;
receipt.receiptDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'AGGREGATE_OPERATIONS_PROBE.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
process.stdout.write('AGGREGATE OPERATIONS ' + receipt.status + ' · product checks reached before unchanged missing intake\n');
if (receipt.status !== 'FOREIGN_FAILURE') process.exitCode = 1;
