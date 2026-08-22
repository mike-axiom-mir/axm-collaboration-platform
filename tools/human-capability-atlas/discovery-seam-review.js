'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
assert.equal(manifest.id, path.basename(__dirname));
assert.equal(contract.id, manifest.id);
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
assert.ok(contract.provides.includes('capability.card.build/v1'));
console.log('Human Capability Atlas discovery seam: PASS');

