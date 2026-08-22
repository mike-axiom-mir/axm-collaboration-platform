#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const core = fs.readFileSync(path.join(root, 'evidence-chain-application-drill-core.js'), 'utf8');
const executor = fs.readFileSync(path.join(root, 'sandbox-drill-executor.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(path.basename(root), manifest.id);
assert.equal(contract.id, manifest.id);
assert.equal(manifest.entry, 'index.html');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, contract.permissions);
assert.ok(contract.provides.includes('capability.drill.evidence-chain-recovery-application/v1'));
assert.ok(contract.consumes.includes('capability.inspect.evidence-chain/v1'));
assert.ok(contract.consumes.includes('capability.plan.evidence-chain-recovery-application/v1'));
assert.ok(contract.handoffs.emits.includes('axm.evidence-chain-recovery-application-drill/v1'));
assert.ok(contract.boundaries.refuses.includes('existing-sandbox-root'));
assert.ok(contract.boundaries.refuses.includes('live-target-read-or-write'));
assert.ok(contract.boundaries.refuses.includes('live-apply-capability-claim'));
assert.ok(contract.boundaries.refuses.includes('automatic-canon'));
assert.equal(contract.lifecycle.state_owner, 'filesystem');
assert.equal(contract.lifecycle.cleanup, 'automatic');
assert(core.includes("liveApplyCapabilityClosed: false"));
assert(executor.includes('fs.rmSync(sandboxRoot'));
assert(executor.includes('isSymbolicLink()'));
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Evidence Chain Application Drill Runner discovery seam: PASS');
