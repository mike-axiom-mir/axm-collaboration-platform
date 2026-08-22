'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
assert.equal(manifest.id, path.basename(__dirname));
assert.equal(contract.id, manifest.id);
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
assert.ok(contract.provides.includes('interface.pattern.recommend/v0.6'));
console.log('Human Interface Intelligence discovery seam: PASS');

