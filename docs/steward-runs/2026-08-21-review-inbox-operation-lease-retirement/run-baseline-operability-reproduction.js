#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'b79a77036f32f2fc06994cc8cfe4a63bf9e626b0';
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}
function sha(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-retirement-baseline-'));
try {
  const leaseSource = git(['show',BASELINE_COMMIT + ':shared/operations/review-operation-lease.js'], null);
  const selftestSource = String(git(['show',BASELINE_COMMIT + ':shared/operations/review-operation-lease-selftest.js']));
  const moduleFile = path.join(temp, 'review-operation-lease.js');
  const childFile = path.join(temp, 'crash-child.js');
  const stateRoot = path.join(temp, 'state');
  fs.writeFileSync(moduleFile, leaseSource);
  fs.writeFileSync(childFile, "const Lease=require(process.argv[2]); Lease.create({stateRoot:process.argv[3],processId:424242}).withExclusive(()=>process.exit(23));\n", 'utf8');
  const crashed = childProcess.spawnSync(process.execPath, [childFile, moduleFile, stateRoot], { encoding:'utf8', windowsHide:true });
  const Lease = require(moduleFile), lease = Lease.create({ stateRoot, timeoutMs:25, retryMs:2, processId:525252 });
  const status = lease.inspect();
  let blocked = null;
  try { lease.withExclusive(() => 'unexpected'); } catch (error) { blocked = error; }
  const lockBytes = fs.readFileSync(lease.leaseFile);
  const receipt = {
    schema:'axm.review-operation-lease-retirement-baseline-reproduction/v1',
    status:crashed.status === 23 && status.state === 'HELD' && blocked && blocked.code === 'REVIEW_OPERATION_BUSY' ? 'REPRODUCED' : 'FAIL',
    baselineCommit:BASELINE_COMMIT,
    baselineTree:String(git(['rev-parse',BASELINE_COMMIT + '^{tree}'])).trim(),
    source:{
      leaseSha256:sha(leaseSource),
      exactGitBlobExecuted:true,
      loaderSubstitutionOnly:false,
      temporaryModuleCopyOnly:true
    },
    result:{
      crashChildExitCode:crashed.status,
      postCrashState:status.state,
      postCrashReasonCode:status.reasonCode,
      nextMutationErrorCode:blocked && blocked.code || null,
      lockEvidenceSha256:sha(lockBytes),
      lockEvidenceRetainedAfterRefusal:fs.existsSync(lease.leaseFile),
      retirementPlanExported:typeof lease.retirementPlan === 'function',
      retirementMethodExported:typeof lease.retireWithOperatorAssertion === 'function',
      baselineSelftestUsesManualUnlinkForCrashFixture:/fs\.unlinkSync\(crashed\.operationLeaseFile\)/.test(selftestSource)
    },
    boundary:{
      productionCrashFrequencyProven:false,
      holderTerminationProven:false,
      manualDeletionSafeProven:false,
      providerActionPerformed:false,
      specialistPackagesInspected:false
    }
  };
  fs.writeFileSync(path.join(__dirname, 'BASELINE_OPERABILITY_REPRODUCTION.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(receipt.status + ' v4.3 crash residue operability gap: ' + receipt.result.postCrashState + ', next=' + receipt.result.nextMutationErrorCode + ', retirement=' + receipt.result.retirementMethodExported);
  if (receipt.status !== 'REPRODUCED') process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive:true, force:true, maxRetries:5, retryDelay:50 });
}
