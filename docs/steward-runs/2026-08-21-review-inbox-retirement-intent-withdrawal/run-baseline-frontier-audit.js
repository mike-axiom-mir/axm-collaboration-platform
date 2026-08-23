#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const parent = '5087e5dc6d7744b9814d6b4697a1ae299e44b773';
function git(args) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:'utf8', windowsHide:true, maxBuffer:16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git baseline read failed');
  return result.stdout;
}
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }

const leaseSource = git(['show', parent + ':shared/operations/review-operation-lease.js']);
const adminSource = git(['show', parent + ':shared/operations/review-operation-lease-admin.js']);
const contract = JSON.parse(git(['show', parent + ':tools/review-inbox/module.contract.json']));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v49-parent-audit-'));
let runtime;
try {
  const moduleFile = path.join(tempRoot, 'review-operation-lease.js');
  fs.writeFileSync(moduleFile, leaseSource, 'utf8');
  const Lease = require(moduleFile);
  const instance = Lease.create({ stateRoot:path.join(tempRoot, 'state'), timeoutMs:0 });
  runtime = {
    withdrawalRequestSchemaExported:typeof Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA === 'string',
    decisionSchemaExported:typeof Lease.RETIREMENT_DECISION_SCHEMA === 'string',
    withdrawMethodExported:typeof instance.withdrawRetirement === 'function'
  };
} finally {
  const resolved = path.resolve(tempRoot), allowed = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error('temporary baseline root escaped the OS temp directory');
  fs.rmSync(resolved, { recursive:true, force:true });
}
const receipt = {
  schema:'axm.retirement-intent-withdrawal-frontier-audit/v1', status:'BLOCKED', sourceCommit:parent,
  sourceDigests:{ lease:sha256(leaseSource), admin:sha256(adminSource) },
  runtime,
  source:{
    withdrawalFunctionPresent:leaseSource.includes('function withdrawRetirement('),
    decisionSchemaPresent:leaseSource.includes('RETIREMENT_DECISION_SCHEMA'),
    withdrawCliPresent:adminSource.includes("'withdraw'"),
    withdrawalContractPresent:contract.provides.includes('explicit-host-local-retirement-intent-withdrawal')
  },
  gap:'Interrupted intent-only retirement could proceed through recovery but had no explicit append-only withdrawal or shared proceed-versus-withdraw decision.',
  receiptDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.receiptDigest;
receipt.receiptDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname, 'BASELINE_FRONTIER_AUDIT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('BASELINE FRONTIER BLOCKED · withdrawal method, schemas, CLI, and contract absent');
