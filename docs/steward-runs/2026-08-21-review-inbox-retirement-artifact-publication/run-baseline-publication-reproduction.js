#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_COMMIT = 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e';
const childSource = `
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Lease = require('./review-operation-lease');
const stateRoot = path.resolve(process.argv[2]), artifact = process.argv[3];
const suffix = '.' + artifact + '.json';
const lease = Lease.create({ stateRoot, timeoutMs:0 });
fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\\n', 'utf8');
const plan = lease.retirementPlan(), originalOpen = fs.openSync;
fs.openSync = (file, flags, mode) => {
  const handle = originalOpen(file, flags, mode);
  if (String(file).endsWith(suffix) && flags === 'wx') process.exit(70);
  return handle;
};
lease.retireWithOperatorAssertion({ schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator asserts the isolated baseline publication fixture holder has terminated.' });
process.exit(72);
`;

function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function gitShow(spec) {
  const result = childProcess.spawnSync('git', ['show',spec], { cwd:ROOT, encoding:null, windowsHide:true, maxBuffer:16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('unable to load exact baseline source');
  return result.stdout;
}

const container = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v49-publication-baseline-'));
let retained = true;
const observations = [];
try {
  const moduleFile = path.join(container,'review-operation-lease.js'), childFile = path.join(container,'crash-child.js');
  fs.writeFileSync(moduleFile, gitShow(SOURCE_COMMIT + ':shared/operations/review-operation-lease.js'));
  fs.writeFileSync(childFile, childSource, 'utf8');
  const Lease = require(moduleFile);
  for (const artifact of ['intent','decision','result']) {
    const stateRoot = path.join(container,'state-' + artifact);
    const child = childProcess.spawnSync(process.execPath, [childFile,stateRoot,artifact], { encoding:'utf8', windowsHide:true });
    const lease = Lease.create({ stateRoot, timeoutMs:0 });
    const files = fs.existsSync(lease.retirementsDirectory) ? fs.readdirSync(lease.retirementsDirectory).sort() : [];
    const target = files.find(name => name.endsWith('.' + artifact + '.json')) || null;
    const targetFile = target ? path.join(lease.retirementsDirectory,target) : null;
    const recovery = lease.retirementRecoveryStatus();
    observations.push({
      artifact,
      crashExitCode:child.status,
      authoritativeFileExists:Boolean(targetFile && fs.existsSync(targetFile)),
      authoritativeBytes:targetFile ? fs.statSync(targetFile).size : null,
      authoritativeJsonValid:targetFile ? (() => { try { JSON.parse(fs.readFileSync(targetFile,'utf8')); return true; } catch (_) { return false; } })() : null,
      recoveryState:recovery.state,
      recoveryReasonCode:recovery.reasonCode,
      heldRetirements:recovery.heldRetirements
    });
  }
} finally {
  const resolved = path.resolve(container), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('temporary baseline root escaped OS temp directory');
  fs.rmSync(resolved, { recursive:true, force:true });
  retained = fs.existsSync(resolved);
}

const receipt = {
  schema:'axm.review-operation-lease-retirement-publication-baseline-reproduction/v1',
  status:observations.every(item => item.crashExitCode === 70 && item.authoritativeFileExists && item.authoritativeBytes === 0 && item.authoritativeJsonValid === false && item.recoveryState === 'HELD') && !retained ? 'REPRODUCED' : 'NOT_REPRODUCED',
  sourceCommit:SOURCE_COMMIT,
  crashBoundary:'after-exclusive-authoritative-open-before-first-byte',
  observations,
  temporaryFixtureRetained:retained,
  truth:{ processCrashReproduced:true, partialOrZeroAuthoritativeArtifactReproduced:true, currentProductEvaluated:false, powerLossEvaluated:false, specialistPackageIntakeAttempted:false },
  receiptDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.receiptDigest;
receipt.receiptDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'BASELINE_PUBLICATION_REPRODUCTION.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
process.stdout.write(receipt.status + ' v4.9 authoritative-open crash reproduction for ' + observations.length + ' retirement artifacts\n');
if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
