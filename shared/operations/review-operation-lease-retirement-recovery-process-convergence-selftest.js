#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');

function sleep(milliseconds) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds); }
function fixture(stateRoot) {
  const lease = Lease.create({ stateRoot });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  return { lease, plan:lease.retirementPlan() };
}
function retirementInput(plan) {
  return { schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator confirms the cross-process concurrency fixture holder has terminated.' };
}
function recoveryInput(record) {
  return { schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, retirementId:record.retirementId, action:record.actionRequired, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_ASSERTION, confirmation:record.confirmationRequired, reason:'Operator confirms this exact cross-process concurrent recovery action.' };
}
function interrupt(stateRoot, mode) {
  const value = fixture(stateRoot), originalRename = fs.renameSync, originalLink = fs.linkSync;
  try {
    if (mode === 'resume') fs.renameSync = (from, to) => {
      if (path.resolve(from) === path.resolve(value.lease.leaseFile)) { const error = new Error('intent interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return originalRename(from, to);
    };
    else fs.linkSync = (stage, file) => {
      if (String(file).endsWith('.result.json')) { const error = new Error('result interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return originalLink(stage, file);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (error) { value.interruption = error; }
  finally { fs.renameSync = originalRename; fs.linkSync = originalLink; }
  return value;
}
function waitForPeers(stateRoot) {
  const deadline = Date.now() + 10000;
  while (fs.readdirSync(stateRoot).filter(name => name.endsWith('.ready')).length < 2) {
    if (Date.now() >= deadline) { const error = new Error('worker barrier timeout'); error.code = 'WORKER_BARRIER_TIMEOUT'; throw error; }
    sleep(5);
  }
}
function worker(stateRoot, mode, workerId) {
  const lease = Lease.create({ stateRoot, recoveryCheckpointObserveMs:2000 });
  const record = lease.retirementRecoveryStatus().records[0], input = recoveryInput(record);
  const ready = path.join(stateRoot, workerId + '.ready');
  const originalRename = fs.renameSync, originalLink = fs.linkSync;
  let entered = false;
  try {
    if (mode === 'resume') fs.renameSync = (from, to) => {
      if (!entered && path.resolve(from) === path.resolve(lease.leaseFile)) {
        entered = true; fs.writeFileSync(ready, 'ready', { flag:'wx' }); waitForPeers(stateRoot);
      }
      return originalRename(from, to);
    };
    else fs.linkSync = (stage, file) => {
      if (!entered && String(file).endsWith('.result.json')) {
        entered = true; fs.writeFileSync(ready, 'ready', { flag:'wx' }); waitForPeers(stateRoot);
      }
      return originalLink(stage, file);
    };
    const result = lease.recoverRetirement(input);
    process.stdout.write(JSON.stringify({ ok:true, state:result.state, schema:result.schema, entered }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok:false, code:error.code || 'UNTYPED', entered }) + '\n');
    process.exitCode = 1;
  } finally { fs.renameSync = originalRename; fs.linkSync = originalLink; }
}
function spawnWorker(stateRoot, mode, workerId) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [__filename, '--worker', stateRoot, mode, workerId], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function main() {
  let assertions = 0;
  function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
  function check(value, label) { assert(value, label); assertions += 1; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-operation-process-convergence-'));
  try {
    for (const mode of ['resume','finalize']) {
      const stateRoot = path.join(root, mode), value = interrupt(stateRoot, mode);
      equal(value.interruption && value.interruption.code, 'SIMULATED_INTERRUPTION', mode + ' fixture reaches interruption window');
      const processes = await Promise.all([spawnWorker(stateRoot, mode, 'worker-a'), spawnWorker(stateRoot, mode, 'worker-b')]);
      processes.forEach((processResult, index) => {
        equal(processResult.code, 0, mode + ' worker ' + index + ' exits zero');
        equal(processResult.stderr, '', mode + ' worker ' + index + ' emits no raw error');
      });
      const outcomes = processes.map(item => JSON.parse(item.stdout));
      check(outcomes.every(item => item.ok && item.entered && item.schema === Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA), mode + ' workers return typed checkpoint outcomes');
      equal(outcomes.map(item => item.state).sort(), ['ALREADY_COMPLETE','RECOVERED'], mode + ' workers converge to one recovery and one observation');
      const status = value.lease.retirementRecoveryStatus();
      equal(status.state, 'CURRENT', mode + ' cross-process race leaves current evidence');
      equal(status.records[0].state, 'COMPLETE', mode + ' cross-process race leaves exact complete record');
      equal(fs.readdirSync(value.lease.retirementsDirectory).length, 4, mode + ' cross-process race retains exactly four evidence files');
    }
    console.log('Review operation lease retirement recovery process convergence selftest: PASS (' + assertions + ' assertions, two real processes converge at resume and finalization checkpoints)');
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

if (process.argv[2] === '--worker') worker(path.resolve(process.argv[3]), process.argv[4], process.argv[5]);
else main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
