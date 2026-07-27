'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
const machines = require('../../shared/holodeck/machine-contracts.json');

const expected = [
  'holodeck.world.validate/v1', 'holodeck.world.compile/v1', 'holodeck.intent.dispatch/v1',
  'holodeck.sensor.observe/v1', 'holodeck.state.snapshot/v1', 'holodeck.adapter.screen/v1',
  'holodeck.experience.echo-atrium/v1'
];
assert.equal(manifest.id, 'holodeck-screen-deck');
assert.equal(contract.id, manifest.id);
assert.equal(manifest.status, 'TEST');
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
expected.forEach(capability => assert.ok(contract.provides.includes(capability), 'missing ' + capability));
assert.equal(machines.machines.length, 10);
assert.ok(contract.boundaries.refuses.includes('render-coordinate-as-canonical-state'));
assert.ok(contract.boundaries.refuses.includes('physical-world-manipulation-claim'));
console.log('Holodeck Screen Deck discovery seam: PASS - 10 modular machines, 7 exact capabilities, TEST boundary');
