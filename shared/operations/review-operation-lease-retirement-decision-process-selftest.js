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
  const lease = Lease.create({ stateRoot, timeoutMs:0 });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  const plan = lease.retirementPlan(), originalLink = fs.linkSync;
  try {
    fs.linkSync = (stage, file) => {
      if (String(file).endsWith('.decision.json')) { const error = new Error('decision interruption'); error.code = 'SIMULATED_DECISION_INTERRUPTION'; throw error; }
      return originalLink(stage, file);
    };
    lease.retireWithOperatorAssertion({ schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator asserts the process-race fixture holder has terminated.' });
  } catch (error) { if (error.code !== 'SIMULATED_DECISION_INTERRUPTION') throw error; }
  finally { fs.linkSync = originalLink; }
  return lease;
}
function waitForPeers(stateRoot, scenario) {
  const deadline = Date.now() + 10000, prefix = scenario + '-';
  while (fs.readdirSync(stateRoot).filter(name => name.startsWith(prefix) && name.endsWith('.ready')).length < 2) {
    if (Date.now() >= deadline) { const error = new Error('worker barrier timeout'); error.code = 'WORKER_BARRIER_TIMEOUT'; throw error; }
    sleep(5);
  }
}
function inputs(record) {
  return {
    withdraw:{ schema:Lease.RETIREMENT_WITHDRAWAL_REQUEST_SCHEMA, retirementId:record.retirementId, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_WITHDRAWAL_ASSERTION, confirmation:record.withdrawalConfirmationRequired, reason:'Operator explicitly withdraws this exact process-race retirement intent.' },
    resume:{ schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, retirementId:record.retirementId, action:record.actionRequired, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_ASSERTION, confirmation:record.confirmationRequired, reason:'Operator explicitly resumes this exact process-race retirement intent.' }
  };
}
function worker(stateRoot, scenario, role) {
  const lease = Lease.create({ stateRoot, timeoutMs:0, recoveryCheckpointObserveMs:2000 });
  const record = lease.retirementRecoveryStatus().records[0], input = inputs(record)[role];
  const ready = path.join(stateRoot, scenario + '-' + role + '.ready'), originalLink = fs.linkSync;
  let entered = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!entered && String(file).endsWith('.decision.json')) {
        entered = true;
        fs.writeFileSync(ready, 'ready', { flag:'wx' });
        waitForPeers(stateRoot, scenario);
        if ((scenario === 'withdrawal-wins' && role === 'resume') || (scenario === 'proceed-wins' && role === 'withdraw')) sleep(30);
      }
      return originalLink(stage, file);
    };
    const result = role === 'withdraw' ? lease.withdrawRetirement(input) : lease.recoverRetirement(input);
    process.stdout.write(JSON.stringify({ role, ok:true, state:result.state, schema:result.schema, entered }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ role, ok:false, code:error.code || 'UNTYPED', entered }) + '\n');
  } finally { fs.linkSync = originalLink; }
}
function spawn(stateRoot, scenario, role) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [__filename,'--worker',stateRoot,scenario,role], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-retirement-decision-process-'));
  try {
    for (const scenario of ['withdrawal-wins','proceed-wins']) {
      const stateRoot = path.join(root,scenario), lease = fixture(stateRoot), ownerBytes = fs.readFileSync(lease.leaseFile);
      const processes = await Promise.all([spawn(stateRoot,scenario,'withdraw'),spawn(stateRoot,scenario,'resume')]);
      processes.forEach((item,index) => {
        equal(item.code, 0, scenario + ' worker ' + index + ' exits zero');
        equal(item.stderr, '', scenario + ' worker ' + index + ' emits no raw error');
      });
      const outcomes = Object.fromEntries(processes.map(item => { const value = JSON.parse(item.stdout); return [value.role,value]; }));
      check(outcomes.withdraw.entered && outcomes.resume.entered, scenario + ' both workers reach exclusive decision checkpoint');
      if (scenario === 'withdrawal-wins') {
        equal(outcomes.withdraw.ok, true, 'withdrawal winner succeeds');
        equal(outcomes.withdraw.state, 'WITHDRAWN', 'withdrawal winner is typed');
        equal(outcomes.resume, { role:'resume', ok:false, code:'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', entered:true }, 'resume loser is typed refusal');
        equal(fs.readFileSync(lease.leaseFile), ownerBytes, 'withdrawal winner preserves exact owner bytes');
        equal(lease.retirementRecoveryStatus().records[0].state, 'WITHDRAWN', 'withdrawal winner leaves withdrawn evidence');
        equal(fs.readdirSync(lease.retirementsDirectory).filter(name => !name.endsWith('.ready')).length, 2, 'withdrawal winner retains intent and decision');
      } else {
        equal(outcomes.resume.ok, true, 'proceed winner succeeds');
        equal(outcomes.resume.state, 'RECOVERED', 'proceed winner is typed');
        equal(outcomes.withdraw, { role:'withdraw', ok:false, code:'REVIEW_OPERATION_RETIREMENT_WITHDRAWAL_REFUSED', entered:true }, 'withdrawal loser is typed refusal');
        equal(fs.existsSync(lease.leaseFile), false, 'proceed winner quarantines exact owner bytes');
        equal(lease.retirementRecoveryStatus().records[0].state, 'COMPLETE', 'proceed winner leaves complete evidence');
        equal(fs.readdirSync(lease.retirementsDirectory).filter(name => !name.endsWith('.ready')).length, 4, 'proceed winner retains four evidence files');
      }
    }
    console.log('Review operation lease retirement decision process selftest: PASS (' + assertions + ' assertions, two real processes arbitrate both proceed/withdraw outcomes without contradictory success)');
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

if (process.argv[2] === '--worker') worker(path.resolve(process.argv[3]),process.argv[4],process.argv[5]);
else main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
