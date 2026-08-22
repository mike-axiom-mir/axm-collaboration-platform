#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));

assert.equal(manifest.id, path.basename(__dirname), 'folder and manifest ids remain one discovery seam');
assert.equal(manifest.id, contract.id, 'manifest and contract ids remain one seam');
assert.equal(manifest.contract, 'module.contract.json');
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)), 'declared entry exists');
assert.ok(contract.provides.includes('capability.prepare.evidence-chain-recovery-candidate/v1'));
assert.ok(contract.consumes.includes('axm.evidence-chain-inspection/v1'));
assert.ok(contract.consumes.includes('capability.inspect.evidence-chain/v1'));
assert.deepEqual(contract.permissions, manifest.permissions);
assert.ok(contract.handoffs.emits.includes('axm.evidence-chain-recovery-candidate/v1'));
assert.ok(contract.boundaries.refuses.includes('content-authenticity-claim'));
assert.ok(contract.boundaries.refuses.includes('automatic-candidate-apply'));
assert.equal(contract.lifecycle.state_owner, 'none');

console.log('Evidence Chain Recovery Foundry discovery seam: PASS');
