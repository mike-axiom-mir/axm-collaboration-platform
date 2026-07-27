'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.id, 'workshop-needs-observatory');
assert.equal(contract.id, manifest.id);
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(contract.permissions, []);
assert.ok(contract.boundaries.refuses.includes('silent-need-closure'));
assert.ok(contract.boundaries.refuses.includes('readiness-as-promotion'));
assert.ok(contract.provides.includes('declaration-drift-audit'));
assert.ok(contract.provides.includes('workshop.readiness.observe/v1'));
assert.ok(contract.consumes.includes('axm.tools-index/v1'));
assert.ok(html.includes('What does the Workshop need next?'));
assert.ok(html.includes('never registers a module automatically'));
assert.ok(html.includes('Review candidates are not promoted'));
assert.ok(app.includes('ACCEPT BUILT CAPABILITY'));
assert.ok(app.includes('REVIEW CANDIDATES'));

require('./readiness-composition-selftest');
console.log('workshop needs observatory self-test passed · 16 contract and surface assertions');
