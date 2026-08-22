#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const Review = require('./review-service');
const Lease = require('./review-operation-lease');

function digest(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function wait(milliseconds) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds); }

if (process.argv[2] === '--child') {
  const action = process.argv[3], stateRoot = process.argv[4], id = process.argv[5] || 'child';
  if (action === 'submit') {
    process.on('message', message => {
      if (message !== 'go') return;
      try {
        const review = Review.create({ stateRoot, reviewOperationLeaseTimeoutMs:10000, reviewOperationLeaseRetryMs:5 });
        review.withExclusive(() => {
          wait(35);
          review.submit({ title:'Concurrent ' + id, kind:'lease-race', sourceRef:'child-' + id, artifactDigest:digest(id) });
        });
        process.exit(0);
      } catch (error) { process.stderr.write(String(error.stack || error)); process.exit(1); }
    });
    if (process.send) process.send('ready');
  } else if (action === 'hold') {
    const review = Review.create({ stateRoot, reviewOperationLeaseTimeoutMs:10000, reviewOperationLeaseRetryMs:5 });
    review.withExclusive(() => { if (process.send) process.send('held'); wait(1200); });
    process.exit(0);
  } else if (action === 'crash') {
    const review = Review.create({ stateRoot, reviewOperationLeaseTimeoutMs:10000, reviewOperationLeaseRetryMs:5 });
    review.withExclusive(() => process.exit(0));
  }
} else {
  (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-operation-lease-'));
    let checks = 0;
    function check(value, message) { checks += 1; assert.ok(value, message); }
    function equal(actual, expected, message) { checks += 1; assert.strictEqual(actual, expected, message); }
    function child(action, stateRoot, id) { return fork(__filename, ['--child', action, stateRoot, id || ''], { silent:true }); }
    function onMessage(proc, expected) { return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('child message timeout: ' + expected)), 10000);
      proc.on('message', message => { if (message === expected) { clearTimeout(timer); resolve(); } });
      proc.on('error', reject);
    }); }
    function onExit(proc) { return new Promise((resolve, reject) => {
      let stderr = '';
      if (proc.stderr) proc.stderr.on('data', chunk => { stderr += chunk; });
      proc.on('error', reject);
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error('child exit ' + code + ': ' + stderr)));
    }); }

    try {
      const basicRoot = path.join(root, 'basic');
      const review = Review.create({ stateRoot:basicRoot, reviewOperationLeaseTimeoutMs:60, reviewOperationLeaseRetryMs:5 });
      const ownerSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-owner.schema.json'), 'utf8'));
      const statusSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'review-operation-lease-status.schema.json'), 'utf8'));
      const free = review.operationLeaseStatus();
      equal(ownerSchema.$id, Lease.OWNER_SCHEMA, 'owner schema file matches runtime schema');
      equal(statusSchema.$id, Lease.STATUS_SCHEMA, 'status schema file matches runtime schema');
      assert.deepStrictEqual(Object.keys(free).sort(), statusSchema.required.slice().sort(), 'runtime status keys match the closed schema'); checks += 1;
      assert.deepStrictEqual(Object.keys(free.truth).sort(), statusSchema.properties.truth.required.slice().sort(), 'runtime truth keys match the closed schema'); checks += 1;
      equal(free.schema, Lease.STATUS_SCHEMA, 'status schema is exact');
      equal(free.state, 'FREE', 'new operation path is free');
      equal(free.reasonCode, 'NO_REVIEW_OPERATION_LEASE', 'missing lease has a typed reason');
      equal(free.truth.cooperatingSingleHostReviewMutationsSerialized, true, 'bounded cooperating single-host claim is explicit');
      equal(free.truth.nonCooperatingExternalWritersExcluded, false, 'external writers are not claimed excluded');
      equal(free.truth.crossFileAtomicityProven, false, 'cross-file atomicity is not claimed');
      equal(free.truth.multiHostOrNetworkFilesystemSafetyProven, false, 'multi-host safety is not claimed');
      equal(free.truth.automaticStaleLeaseTheft, false, 'automatic theft is refused');
      equal(free.truth.browserRecoveryRoute, false, 'browser recovery is refused');
      let nestedState, nestedOwner;
      review.withExclusive(() => {
        nestedState = review.operationLeaseStatus();
        nestedOwner = JSON.parse(fs.readFileSync(review.operationLeaseFile, 'utf8'));
        review.submit({ title:'Nested', kind:'lease-basic', sourceRef:'nested', artifactDigest:digest('nested') });
      });
      check(Lease.validOwner(nestedOwner), 'exclusive-create owner evidence matches the closed runtime validator');
      equal(nestedState.state, 'HELD', 'nested mutation observes the held lease');
      equal(nestedState.truth.heldByThisServiceInstance, true, 'same-instance ownership is locally observable');
      equal(review.list().length, 1, 'nested public mutation is reentrant');
      equal(review.operationLeaseStatus().state, 'FREE', 'normal completion releases the lease');

      const transientRoot = path.join(root, 'transient-eperm');
      const transient = Review.create({ stateRoot:transientRoot, reviewOperationLeaseTimeoutMs:100, reviewOperationLeaseRetryMs:1 });
      const originalOpenSync = fs.openSync;
      let transientAttempts = 0;
      try {
        fs.openSync = function(file, flags) {
          if (file === transient.operationLeaseFile && flags === 'wx' && transientAttempts++ < 2) {
            const error = new Error('simulated transient sharing violation'); error.code = 'EPERM'; throw error;
          }
          return originalOpenSync.apply(fs, arguments);
        };
        transient.submit({ sourceRef:'transient-eperm', artifactDigest:digest('transient-eperm') });
      } finally { fs.openSync = originalOpenSync; }
      equal(transientAttempts, 3, 'transient EPERM sharing violations are retried within the bounded wait');
      equal(transient.list().length, 1, 'transient EPERM retry preserves the requested mutation');
      equal(transient.operationLeaseStatus().state, 'FREE', 'transient EPERM completion releases normally');

      const deniedRoot = path.join(root, 'persistent-eperm');
      const denied = Review.create({ stateRoot:deniedRoot, reviewOperationLeaseTimeoutMs:5, reviewOperationLeaseRetryMs:1 });
      let deniedError = null;
      try {
        fs.openSync = function(file, flags) {
          if (file === denied.operationLeaseFile && flags === 'wx') { const error = new Error('simulated persistent sharing violation'); error.code = 'EPERM'; throw error; }
          return originalOpenSync.apply(fs, arguments);
        };
        denied.submit({ sourceRef:'persistent-eperm', artifactDigest:digest('persistent-eperm') });
      } catch (error) { deniedError = error; }
      finally { fs.openSync = originalOpenSync; }
      equal(deniedError && deniedError.code, 'REVIEW_OPERATION_BUSY', 'persistent EPERM fails closed with typed contention');
      equal(deniedError && deniedError.leaseStatus.reasonCode, 'LEASE_EVIDENCE_UNREADABLE', 'persistent EPERM does not pretend the path is free');
      equal(fs.existsSync(denied.stateFile), false, 'persistent EPERM permits no review mutation');
      equal(fs.existsSync(review.operationLeaseFile), false, 'normal completion removes exact lease evidence');

      const raceRoot = path.join(root, 'race');
      const racers = Array.from({ length:8 }, (_, index) => child('submit', raceRoot, String(index)));
      await Promise.all(racers.map(proc => onMessage(proc, 'ready')));
      racers.forEach(proc => proc.send('go'));
      await Promise.all(racers.map(onExit));
      const raced = Review.create({ stateRoot:raceRoot });
      equal(raced.list().length, 8, 'eight cooperating processes preserve all eight review mutations');
      equal(new Set(raced.list().map(item => item.sourceRef)).size, 8, 'all concurrent sources remain distinct');
      equal(raced.operationLeaseStatus().state, 'FREE', 'concurrent completion leaves no lease');
      equal(fs.readFileSync(raced.auditFile, 'utf8').trim().split(/\r?\n/).length, 8, 'all concurrent audit records persist');

      const heldRoot = path.join(root, 'held');
      const holder = child('hold', heldRoot);
      await onMessage(holder, 'held');
      const blocked = Review.create({ stateRoot:heldRoot, reviewOperationLeaseTimeoutMs:40, reviewOperationLeaseRetryMs:5 });
      const before = fs.existsSync(blocked.stateFile) ? digest(fs.readFileSync(blocked.stateFile)) : null;
      let busy = null;
      try { blocked.submit({ sourceRef:'blocked', artifactDigest:digest('blocked') }); } catch (error) { busy = error; }
      equal(busy && busy.code, 'REVIEW_OPERATION_BUSY', 'active contention fails with a typed busy error');
      equal(busy && busy.leaseStatus.state, 'HELD', 'busy error carries held status');
      equal(fs.existsSync(blocked.stateFile) ? digest(fs.readFileSync(blocked.stateFile)) : null, before, 'timed-out contention changes no review state');
      await onExit(holder);
      blocked.submit({ sourceRef:'after-holder', artifactDigest:digest('after-holder') });
      equal(blocked.list().length, 1, 'mutation resumes after the active holder releases');

      const crashRoot = path.join(root, 'crash');
      await onExit(child('crash', crashRoot));
      const crashed = Review.create({ stateRoot:crashRoot, reviewOperationLeaseTimeoutMs:30, reviewOperationLeaseRetryMs:5 });
      const crashedStatus = crashed.operationLeaseStatus();
      equal(crashedStatus.state, 'HELD', 'crashed process leaves the operation path held');
      equal(crashedStatus.reasonCode, 'REVIEW_OPERATION_LEASE_PRESENT', 'crash evidence stays valid but does not prove liveness');
      equal(crashedStatus.truth.staleOwnerOrProcessDeathProven, false, 'pid metadata is not liveness evidence');
      let crashBusy = null;
      try { crashed.submit({ sourceRef:'after-crash', artifactDigest:digest('after-crash') }); } catch (error) { crashBusy = error; }
      equal(crashBusy && crashBusy.code, 'REVIEW_OPERATION_BUSY', 'crash residue is not stolen automatically');
      equal(fs.existsSync(crashed.stateFile), false, 'held crash residue permits no mutation');
      check(path.relative(crashRoot, crashed.operationLeaseFile).split(path.sep)[0] !== '..', 'test cleanup target is inside its exact fixture root');
      fs.unlinkSync(crashed.operationLeaseFile);
      crashed.submit({ sourceRef:'operator-inspected', artifactDigest:digest('operator-inspected') });
      equal(crashed.list().length, 1, 'test-owned explicit cleanup restores the fixture path');

      const invalidRoot = path.join(root, 'invalid'), invalid = Review.create({ stateRoot:invalidRoot, reviewOperationLeaseTimeoutMs:20, reviewOperationLeaseRetryMs:5 });
      fs.mkdirSync(path.dirname(invalid.operationLeaseFile), { recursive:true });
      fs.writeFileSync(invalid.operationLeaseFile, '{not valid json', 'utf8');
      equal(invalid.operationLeaseStatus().reasonCode, 'LEASE_EVIDENCE_INVALID', 'invalid evidence is typed');
      let invalidBusy = null;
      try { invalid.submit({ sourceRef:'invalid-lock', artifactDigest:digest('invalid-lock') }); } catch (error) { invalidBusy = error; }
      equal(invalidBusy && invalidBusy.code, 'REVIEW_OPERATION_BUSY', 'invalid evidence holds mutations');
      equal(fs.readFileSync(invalid.operationLeaseFile, 'utf8'), '{not valid json', 'invalid evidence is not altered or deleted');
      fs.unlinkSync(invalid.operationLeaseFile);

      const alteredRoot = path.join(root, 'altered'), altered = Review.create({ stateRoot:alteredRoot });
      altered.withExclusive(() => fs.writeFileSync(altered.operationLeaseFile, '{"altered":true}\n', 'utf8'));
      equal(altered.operationLeaseStatus().reasonCode, 'LEASE_EVIDENCE_INVALID', 'altered owner evidence survives token-checked release');
      equal(fs.existsSync(altered.operationLeaseFile), true, 'release never deletes altered evidence');

      const leaseSource = fs.readFileSync(path.join(__dirname, 'review-operation-lease.js'), 'utf8');
      const authoritySource = fs.readFileSync(path.join(__dirname, 'review-authority-service.js'), 'utf8');
      const apiSource = fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8');
      check(leaseSource.includes("fs.openSync(leaseFile, 'wx'"), 'lease acquisition uses exclusive creation');
      check(leaseSource.includes('never stolen automatically'), 'busy contract states no automatic theft');
      check(!/kill\s*\(|process\.kill|unlinkSync\(leaseFile\).*Date\.now|stale.*unlink/i.test(leaseSource), 'implementation has no pid probe or age-based stale deletion');
      check(authoritySource.includes("review.withExclusive(() => submit(candidate, envelope))"), 'signed submit spans the shared lease');
      check(authoritySource.includes("review.withExclusive(() => vote(envelope))"), 'signed vote spans the shared lease');
      check(authoritySource.includes("review.withExclusive(() => recoverProjection(envelopeId, confirmation))"), 'signed recovery spans the shared lease');
      check(apiSource.includes('operationLease:review.operationLeaseStatus()'), 'read-only API exposes lease status');
      check(apiSource.includes("error.code === 'REVIEW_OPERATION_BUSY'"), 'typed operation contention maps to a bounded client-visible API refusal');
      check(!/review-operation-lease\/(release|recover|unlock)|operationLease\.(release|recover|unlock)/i.test(apiSource), 'API exposes no lease release route');

      console.log('Review operation lease selftest: PASS (' + checks + ' assertions, eight-process preservation, bounded contention, crash hold, invalid-evidence hold, no automatic theft)');
    } finally {
      fs.rmSync(root, { recursive:true, force:true });
    }
  })().catch(error => { console.error(error.stack || error); process.exit(1); });
}
