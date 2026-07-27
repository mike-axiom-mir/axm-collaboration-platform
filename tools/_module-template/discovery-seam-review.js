#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
assert.equal(manifest.id, contract.id, 'manifest and contract ids remain one seam');
assert.equal(manifest.contract, 'module.contract.json');
assert.ok(Array.isArray(contract.provides) && Array.isArray(contract.consumes));
assert.ok(contract.handoffs && Array.isArray(contract.handoffs.emits) && Array.isArray(contract.handoffs.accepts));
assert.ok(contract.boundaries && Array.isArray(contract.boundaries.refuses));
assert.ok(contract.lifecycle && contract.lifecycle.reload, 'lifecycle choice is explicit');
console.log('module template discovery seam review: PASS');
