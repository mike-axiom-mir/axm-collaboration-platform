#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Lease = require('./review-operation-lease');

let assertions = 0;
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function check(value, label) { assert(value, label); assertions += 1; }
function fixture(stateRoot) {
  const lease = Lease.create({ stateRoot });
  fs.mkdirSync(path.dirname(lease.leaseFile), { recursive:true });
  const owner = { schema:Lease.OWNER_SCHEMA, leaseId:crypto.randomUUID(), processId:process.pid + 100000, acquiredAt:new Date().toISOString() };
  fs.writeFileSync(lease.leaseFile, JSON.stringify(owner) + '\n', 'utf8');
  return { lease, plan:lease.retirementPlan() };
}
function retirementInput(plan) {
  return { schema:Lease.RETIREMENT_REQUEST_SCHEMA, assertion:Lease.RETIREMENT_ASSERTION, confirmation:plan.exactConfirmation, ownerDigest:plan.ownerDigest, reason:'Operator confirms the deterministic concurrency fixture holder has terminated.' };
}
function recoveryInput(record) {
  return { schema:Lease.RETIREMENT_RECOVERY_REQUEST_SCHEMA, retirementId:record.retirementId, action:record.actionRequired, ownerDigest:record.ownerDigest, assertion:Lease.RETIREMENT_ASSERTION, confirmation:record.confirmationRequired, reason:'Operator confirms this exact deterministic concurrent recovery action.' };
}
function interruptAfterIntent(stateRoot) {
  const value = fixture(stateRoot), original = fs.renameSync;
  try {
    fs.renameSync = (from, to) => {
      if (path.resolve(from) === path.resolve(value.lease.leaseFile)) { const error = new Error('intent interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return original(from, to);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (error) { value.interruption = error; }
  finally { fs.renameSync = original; }
  return value;
}
function interruptAfterEvidence(stateRoot) {
  const value = fixture(stateRoot), original = fs.linkSync;
  try {
    fs.linkSync = (stage, file) => {
      if (String(file).endsWith('.result.json')) { const error = new Error('result interruption'); error.code = 'SIMULATED_INTERRUPTION'; throw error; }
      return original(stage, file);
    };
    value.lease.retireWithOperatorAssertion(retirementInput(value.plan));
  } catch (error) { value.interruption = error; }
  finally { fs.linkSync = original; }
  return value;
}
function capture(action) {
  try { return { result:action(), error:null }; }
  catch (error) { return { result:null, error }; }
}
function resumeRace(stateRoot) {
  const value = interruptAfterIntent(stateRoot), record = value.lease.retirementRecoveryStatus().records[0], input = recoveryInput(record);
  const original = fs.renameSync;
  let inner = null, triggered = false;
  try {
    fs.renameSync = (from, to) => {
      if (!triggered && path.resolve(from) === path.resolve(value.lease.leaseFile)) {
        triggered = true;
        inner = capture(() => value.lease.recoverRetirement(input));
      }
      return original(from, to);
    };
    value.outer = capture(() => value.lease.recoverRetirement(input));
  } finally { fs.renameSync = original; }
  return Object.assign(value, { inner, input, triggered });
}
function finalizeRace(stateRoot) {
  const value = interruptAfterEvidence(stateRoot), record = value.lease.retirementRecoveryStatus().records[0], input = recoveryInput(record);
  const original = fs.linkSync;
  let inner = null, triggered = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!triggered && String(file).endsWith('.result.json')) {
        triggered = true;
        inner = capture(() => value.lease.recoverRetirement(input));
      }
      return original(stage, file);
    };
    value.outer = capture(() => value.lease.recoverRetirement(input));
  } finally { fs.linkSync = original; }
  return Object.assign(value, { inner, input, triggered });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-operation-recovery-convergence-'));
try {
  const resume = resumeRace(path.join(root, 'resume'));
  equal(resume.interruption && resume.interruption.code, 'SIMULATED_INTERRUPTION', 'resume fixture stops after intent');
  equal(resume.triggered, true, 'resume race reaches the exact rename checkpoint twice');
  equal(resume.inner && resume.inner.error, null, 'inner resume caller receives no raw race error');
  equal(resume.outer && resume.outer.error, null, 'outer resume caller receives no raw race error');
  equal(resume.inner.result.schema, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'inner resume result is typed');
  equal(resume.outer.result.schema, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'outer resume result is typed');
  equal([resume.inner.result.state, resume.outer.result.state].sort(), ['ALREADY_COMPLETE','RECOVERED'], 'resume race converges to one recovery and one exact observation');
  equal(resume.lease.retirementRecoveryStatus().state, 'CURRENT', 'resume race leaves current retirement evidence');
  equal(fs.readdirSync(resume.lease.retirementsDirectory).length, 4, 'resume race retains exactly intent decision owner evidence and result');
  equal(resume.outer.result.truth.cooperatingSingleHostRecoveryCheckpointConvergence, true, 'resume truth declares cooperating single-host checkpoint convergence');
  equal(resume.outer.result.truth.generalRecoverySerializationProven, false, 'resume truth refuses general serialization');

  const finalize = finalizeRace(path.join(root, 'finalize'));
  equal(finalize.interruption && finalize.interruption.code, 'SIMULATED_INTERRUPTION', 'finalize fixture stops after owner evidence');
  equal(finalize.triggered, true, 'finalize race reaches the exclusive result checkpoint twice');
  equal(finalize.inner && finalize.inner.error, null, 'inner finalize caller receives no raw race error');
  equal(finalize.outer && finalize.outer.error, null, 'outer finalize caller receives no raw race error');
  equal(finalize.inner.result.schema, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'inner finalize result is typed');
  equal(finalize.outer.result.schema, Lease.RETIREMENT_RECOVERY_RESULT_SCHEMA, 'outer finalize result is typed');
  equal([finalize.inner.result.state, finalize.outer.result.state].sort(), ['ALREADY_COMPLETE','RECOVERED'], 'finalize race converges to one recovery and one exact observation');
  equal(finalize.lease.retirementRecoveryStatus().state, 'CURRENT', 'finalize race leaves current retirement evidence');
  equal(fs.readdirSync(finalize.lease.retirementsDirectory).length, 4, 'finalize race retains exactly intent decision owner evidence and result');

  const invalid = interruptAfterEvidence(path.join(root, 'invalid-result-collision'));
  const invalidRecord = invalid.lease.retirementRecoveryStatus().records[0], invalidInput = recoveryInput(invalidRecord), originalLink = fs.linkSync;
  let inserted = false;
  try {
    fs.linkSync = (stage, file) => {
      if (!inserted && String(file).endsWith('.result.json')) {
        inserted = true;
        fs.writeFileSync(file, '{invalid concurrent result', 'utf8');
      }
      return originalLink(stage, file);
    };
    invalid.outcome = capture(() => invalid.lease.recoverRetirement(invalidInput));
  } finally { fs.linkSync = originalLink; }
  equal(inserted, true, 'invalid collision reaches the result checkpoint');
  equal(invalid.outcome.result, null, 'invalid concurrent result never becomes recovery success');
  equal(invalid.outcome.error && invalid.outcome.error.code, 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', 'invalid result collision is a typed refusal');
  equal(invalid.lease.retirementRecoveryStatus().state, 'HELD', 'invalid result collision remains held');

  const corrupt = interruptAfterIntent(path.join(root, 'corrupt-quarantine-race'));
  const corruptRecord = corrupt.lease.retirementRecoveryStatus().records[0], corruptInput = recoveryInput(corruptRecord), originalRename = fs.renameSync;
  let moved = false;
  try {
    fs.renameSync = (from, to) => {
      if (!moved && path.resolve(from) === path.resolve(corrupt.lease.leaseFile)) {
        moved = true;
        originalRename(from, to);
        fs.appendFileSync(to, 'corrupt', 'utf8');
      }
      return originalRename(from, to);
    };
    corrupt.outcome = capture(() => corrupt.lease.recoverRetirement(corruptInput));
  } finally { fs.renameSync = originalRename; }
  equal(moved, true, 'corrupt race reaches the quarantine checkpoint');
  equal(corrupt.outcome.result, null, 'corrupt concurrent quarantine never becomes recovery success');
  equal(corrupt.outcome.error && corrupt.outcome.error.code, 'REVIEW_OPERATION_RETIREMENT_RECOVERY_REFUSED', 'corrupt quarantine race is a typed refusal');
  equal(corrupt.lease.retirementRecoveryStatus().state, 'HELD', 'corrupt quarantine race remains held');

  const source = fs.readFileSync(path.join(__dirname, 'review-operation-lease.js'), 'utf8');
  check(!source.includes('automaticRecovery:true'), 'convergence adds no automatic recovery');
  check(!source.includes('generalRecoverySerializationProven:true'), 'source never claims general serialization');
  console.log('Review operation lease retirement recovery convergence selftest: PASS (' + assertions + ' assertions, reentrant resume/finalize races converge, corrupt collisions hold, no general serialization claim)');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
