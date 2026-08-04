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
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)), 'declared browser entry exists');
assert.ok(fs.existsSync(path.join(__dirname, manifest.machine.entry)), 'declared machine entry exists');
assert.ok(contract.provides.includes('capability.inspect.evidence-chain/v1'));
assert.ok(contract.consumes.includes('axm.evidence-retention/v1'));
assert.deepEqual(contract.permissions, manifest.permissions);
assert.ok(contract.handoffs.emits.includes('axm.evidence-chain-inspection/v1'));
assert.ok(contract.boundaries.refuses.includes('private-state-crawl'));
assert.ok(contract.boundaries.refuses.includes('automatic-chain-repair'));
assert.equal(contract.lifecycle.state_owner, 'none');

console.log('Evidence Chain Inspector discovery seam: PASS');
