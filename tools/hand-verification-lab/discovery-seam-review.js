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
assert.ok(contract.provides.includes('capability.verify.missing-hand/v1'));
assert.ok(contract.consumes.includes('axm.missing-hand-specification/v1'));
assert.deepEqual(contract.permissions, manifest.permissions);
assert.ok(contract.handoffs.emits.includes('axm.hand-verification-plan/v1'));
assert.ok(contract.handoffs.emits.includes('axm.hand-verification-receipt/v1'));
assert.ok(contract.boundaries.refuses.includes('automatic-test-execution'));
assert.ok(contract.boundaries.refuses.includes('automatic-promotion'));
assert.equal(contract.lifecycle.reload, 'reset');

console.log('Hand Verification Lab discovery seam: PASS');
