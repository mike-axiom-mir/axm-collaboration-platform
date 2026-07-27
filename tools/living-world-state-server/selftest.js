#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LivingWorld = require('../../shared/operations/living-world-state-service');

const PREFIX = 'axm-living-world-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = { root, stateRoot: path.join(root, 'state'), exportRoot: path.join(root, 'exports') };
let pass = 0;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function cleanup() {
  const resolved = path.resolve(temp);
  const allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

try {
  fs.mkdirSync(options.stateRoot, { recursive: true });
  fs.mkdirSync(options.exportRoot, { recursive: true });

  const manifest = readJson('manifest.json');
  const contract = readJson('module.contract.json');
  const world = LivingWorld.create(options);

  check('manifest and contract preserve the sole-owner boundary', () => {
    assert.equal(manifest.id, 'living-world-state-server');
    assert.equal(contract.id, manifest.id);
    assert.deepStrictEqual(contract.permissions, manifest.permissions);
    assert(contract.boundaries.refuses.includes('ownership-transfer'));
    assert(contract.boundaries.refuses.includes('cross-world-mutation'));
    assert(contract.boundaries.refuses.includes('unconfirmed-restore'));
  });

  check('legacy compatibility world starts isolated at revision zero', () => {
    const status = world.status();
    assert.equal(status.defaultWorldId, 'living-globe');
    assert.equal(status.worldCount, 1);
    assert.equal(status.world.owner, 'living-world-state-server');
    assert.equal(status.world.revision, 0);
    assert.equal(status.automaticReset, false);
  });

  check('expected-revision patch advances state and journal together', () => {
    const result = world.apply({
      expectedRevision: 0,
      source: 'module-selftest',
      operations: [
        { type: 'set-fact', key: 'day', value: 2 },
        { type: 'upsert-entity', entity: { id: 'mover-one', kind: 'agent', data: { zone: 'north', position: { x: 0, y: 0 }, velocity: { x: 2, y: 1 } } } }
      ]
    }, 'selftest');
    assert.equal(result.world.revision, 1);
    assert.equal(result.event.revision, 1);
    assert.equal(world.changes(0).changes.length, 1);
    assert.equal(world.get().entities.length, 1);
  });

  check('stale writers and ownership changes are refused', () => {
    assert.throws(() => world.apply({ expectedRevision: 0, operations: [{ type: 'set-fact', key: 'day', value: 3 }] }, 'selftest'), /revision conflict/);
    assert.throws(() => world.apply({ expectedRevision: 1, owner: 'another-owner', operations: [{ type: 'set-fact', key: 'day', value: 3 }] }, 'selftest'), /ownership cannot be changed/);
  });

  check('restore requires exact confirmation and keeps revision monotonic', () => {
    const snapshot = world.snapshot('selftest', 'known good revision');
    world.apply({ expectedRevision: 1, operations: [{ type: 'set-fact', key: 'day', value: 99 }] }, 'selftest');
    const preview = world.previewRestore(snapshot.id, 'selftest');
    assert.throws(() => world.restore(preview.id, 'RESTORE', 'selftest'), /exact world restore confirmation/);
    const restored = world.restore(preview.id, 'RESTORE LIVING WORLD', 'selftest');
    assert.equal(restored.revision, 3);
    assert.equal(restored.facts.day, 2);
    assert.equal(restored.owner, 'living-world-state-server');
    assert(world.listSnapshots().length >= 2);
  });

  check('named worlds retain their own lineage and revision', () => {
    const created = world.createWorld({
      schema: 'axm.living-world.create/v1',
      worldId: 'world.selftest-planet',
      lineageId: 'world.selftest-planet:root',
      coordinateReference: { type: 'latitude-longitude' },
      metadata: { title: 'Selftest Planet' },
      facts: { epoch: 1 }
    }, 'selftest');
    assert.equal(created.revision, 0);
    assert.equal(created.lineageId, 'world.selftest-planet:root');
    assert.equal(world.listWorlds().length, 2);

    const changed = world.apply({
      worldId: created.worldId,
      lineageId: created.lineageId,
      expectedRevision: 0,
      operations: [{ type: 'set-fact', key: 'epoch', value: 2 }]
    }, 'selftest');
    assert.equal(changed.world.revision, 1);
    assert.equal(world.get(created.worldId).facts.epoch, 2);
    assert.equal(world.get().revision, 3);
  });

  check('secret-like metadata is rejected before entering world state', () => {
    assert.throws(() => world.createWorld({
      worldId: 'world.secret-test',
      coordinateReference: { type: 'local' },
      metadata: { integration: { apiToken: 'must-not-persist' } }
    }, 'selftest'), /secret-like world metadata/);
  });

  check('invalid world operations cannot bypass the allowlist', () => {
    assert.throws(() => world.apply({
      worldId: 'world.selftest-planet',
      expectedRevision: 1,
      operations: [{ type: 'reset-world' }]
    }, 'selftest'), /operation is not allowlisted/);
  });

  console.log('Authoritative Living World State Server selftest: PASS (' + pass + ' controls)');
} finally {
  cleanup();
}
