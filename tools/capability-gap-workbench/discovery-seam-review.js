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
assert.ok(Array.isArray(contract.provides) && contract.provides.length > 0);
assert.ok(Array.isArray(contract.consumes) && contract.consumes.includes('capability.compare.requirements/v1'));
assert.deepEqual(contract.permissions, manifest.permissions);
assert.ok(contract.handoffs.emits.includes('axm.capability-gap-report/v1'));
assert.ok(contract.boundaries.refuses.includes('automatic-canon'));
assert.ok(contract.lifecycle && contract.lifecycle.reload === 'reset');

console.log('Capability Gap Workbench discovery seam: PASS');
