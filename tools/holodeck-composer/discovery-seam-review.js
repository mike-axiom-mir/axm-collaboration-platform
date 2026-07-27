'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

assert.equal(manifest.id, 'holodeck-composer');
assert.equal(contract.id, manifest.id);
assert.equal(manifest.status, 'TEST');
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
assert.deepEqual(contract.provides, [
  'holodeck.world.compose/v1',
  'holodeck.view.observe/v1',
  'holodeck.view.camera-control/v1',
  'holodeck.view.authority-boundary/v1'
]);
assert.ok(contract.consumes.includes('holodeck.world.compile/v1'));
assert.ok(contract.consumes.includes('holodeck.adapter.screen/v1'));
assert.ok(contract.boundaries.refuses.includes('automatic-world-promotion'));
assert.ok(contract.boundaries.refuses.includes('observer-camera-mutates-world-state'));
assert.ok(contract.boundaries.refuses.includes('observer-camera-dispatches-player-intent'));
assert.ok(contract.boundaries.refuses.includes('physical-world-manipulation-claim'));
console.log('Holodeck Composer discovery seam: PASS - 4 bounded capabilities, observer/player authority split, TEST boundary');
