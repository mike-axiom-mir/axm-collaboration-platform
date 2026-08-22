#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.equal(path.basename(root), manifest.id);
assert.equal(contract.id, manifest.id);
assert.equal(manifest.entry, 'index.html');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, contract.permissions);
assert.ok(contract.provides.includes('capability.review.evidence-chain-recovery-candidate/v1'));
assert.ok(contract.consumes.includes('capability.inspect.evidence-chain/v1'));
assert.ok(contract.consumes.includes('capability.prepare.evidence-chain-recovery-candidate/v1'));
assert.ok(contract.handoffs.emits.includes('axm.evidence-chain-recovery-review/v1'));
assert.ok(contract.handoffs.emits.includes('axm.evidence-chain-recovery-review-decision/v1'));
assert.ok(contract.boundaries.refuses.includes('candidate-application'));
assert.ok(contract.boundaries.refuses.includes('permission-or-authority-grant'));
assert.ok(contract.boundaries.refuses.includes('automatic-canon'));
assert.equal(contract.lifecycle.state_owner, 'none');
assert(!app.includes('localStorage'));
assert(!app.includes('fetch('));

console.log('Evidence Chain Candidate Review Gate discovery seam: PASS');
