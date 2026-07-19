'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Reader = require('../adapters/workshop/asset-hands-service-reader');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-asset-hands-'));
  const service = path.join(root, 'shared', 'asset-hands');
  fs.mkdirSync(service, { recursive: true });
  fs.writeFileSync(path.join(service, 'target-canvas.schema.json'), JSON.stringify({ $id: 'axm.target-canvas/v1', type: 'object' }));
  fs.writeFileSync(path.join(service, 'service.contract.json'), JSON.stringify({
    schema: 'axm.shared-service-contract/v1', id: 'asset-hands', version: '2.2.0', status: 'TEST',
    schemaFiles: { 'axm.target-canvas/v1': 'target-canvas.schema.json' },
    provides: ['format-neutral-target-canvas-contract'], builtInHands: ['vector-form', 'delivery-finisher'],
    plannedMissingHands: ['ktx2-texture-delivery'], boundaries: { refuses: ['silent-lower-quality-canvas-substitution'] }
  }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Mirror observes Asset Hands declarations and missing-hand inventory without executing providers', t => {
  const root = fixture(t);
  const observation = Reader.observe({ workshopRoot: root, environment: {}, configRoot: root });
  assert.equal(observation.schema, Reader.SCHEMA);
  assert.equal(observation.state, 'DECLARED_TEST_SERVICE');
  assert.equal(observation.executable, false);
  assert.equal(observation.service.schemaCount, 1);
  assert.equal(observation.service.executableHandCount, 2);
  assert.deepEqual(observation.service.plannedMissingHands, ['ktx2-texture-delivery']);
  assert.match(observation.reason, /without loading or executing/);
});

test('Mirror rejects schema traversal and holds absent Workshop state explicitly', t => {
  const root = fixture(t);
  const contractFile = path.join(root, 'shared', 'asset-hands', 'service.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
  contract.schemaFiles = { escaped: '../../outside.json' };
  fs.writeFileSync(contractFile, JSON.stringify(contract));
  assert.throws(() => Reader.observe({ workshopRoot: root, environment: {}, configRoot: root }), /escapes Asset Hands/);
  const absent = Reader.observe({ workshopRoot: path.join(root, 'missing'), environment: {}, configRoot: root });
  assert.equal(absent.state, 'WORKSHOP_ABSENT');
  assert.equal(absent.executable, false);
});
