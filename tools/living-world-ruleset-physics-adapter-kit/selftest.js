#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LivingWorld = require('../../shared/operations/living-world-state-service');
const Adapters = require('../../shared/operations/ruleset-physics-adapter-service');

const PREFIX = 'axm-world-adapter-selftest-';
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
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const world = LivingWorld.create(options);
  const adapters = Adapters.create(Object.assign({}, options, { worldStateService: world }));

  world.apply({
    expectedRevision: 0,
    operations: [{
      type: 'upsert-entity',
      entity: { id: 'mover-one', kind: 'agent', data: { zone: 'north', position: { x: 0, y: 0 }, velocity: { x: 2, y: 1 } } }
    }]
  }, 'selftest');

  check('manifest and contract declare proposal-only adapter authority', () => {
    assert.equal(manifest.id, 'living-world-ruleset-physics-adapter-kit');
    assert.equal(contract.id, manifest.id);
    assert.deepStrictEqual(contract.permissions, manifest.permissions);
    assert(contract.boundaries.refuses.includes('world-ownership'));
    assert(contract.boundaries.refuses.includes('world-reset'));
    assert(contract.boundaries.refuses.includes('automatic-intent-apply'));
  });

  check('registry seeds bounded physics and ruleset contracts', () => {
    const status = adapters.status();
    assert.equal(status.adapters.length, 2);
    assert.equal(status.contracts.consumes, 'axm.living-world.snapshot/v1');
    assert.equal(status.contracts.produces, 'axm.living-world.intent/v1');
    assert.equal(status.worldOwner, false);
    assert.equal(status.automaticApply, false);
    assert.equal(status.resetAuthority, false);
  });

  check('invalid contracts cannot claim ownership or incompatible schemas', () => {
    const checked = adapters.contract({
      id: 'unsafe-adapter',
      consumes: 'unversioned-world',
      produces: 'direct-mutation',
      ownsWorld: true,
      canResetWorld: true
    });
    assert.equal(checked.valid, false);
    assert.equal(checked.errors.length, 4);
    assert.throws(() => adapters.register(checked.adapter, 'selftest'), /adapter contract refused/);
  });

  check('attachment is revision-bound', () => {
    assert.throws(() => adapters.attach({ adapterId: 'bounded-motion-2d', expectedRevision: 0 }, 'selftest'), /revision conflict/);
  });

  const attachment = adapters.attach({
    adapterId: 'bounded-motion-2d',
    expectedRevision: 1,
    config: { dt: 0.5, bound: 10 }
  }, 'selftest');

  check('physics evaluation emits bounded intents with no apply authority', () => {
    const packet = adapters.evaluate({ attachmentId: attachment.id, expectedRevision: 1 }, 'selftest');
    assert.equal(packet.schema, 'axm.living-world.intent/v1');
    assert.equal(packet.intents.length, 1);
    assert.deepStrictEqual(packet.intents[0].entity.data.position, { x: 1, y: 0.5 });
    assert.equal(packet.applyAuthority, false);
    assert.equal(packet.resetAuthority, false);
  });

  check('evaluating an adapter does not mutate canonical world state', () => {
    const canonical = world.get();
    assert.deepStrictEqual(canonical.entities[0].data.position, { x: 0, y: 0 });
    assert.equal(canonical.revision, 1);
  });

  check('stale evaluations are rejected after the world advances', () => {
    world.apply({ expectedRevision: 1, operations: [{ type: 'set-fact', key: 'day', value: 2 }] }, 'selftest');
    assert.throws(() => adapters.evaluate({ attachmentId: attachment.id, expectedRevision: 1 }, 'selftest'), /revision conflict/);
  });

  check('detached adapters cannot emit further intents', () => {
    adapters.detach(attachment.id, 'selftest');
    assert.throws(() => adapters.evaluate({ attachmentId: attachment.id, expectedRevision: 2 }, 'selftest'), /active adapter attachment not found/);
  });

  check('browser surface names attachment and evaluation as separate actions', () => {
    assert(app.includes("O.post('/api/world-adapters/attach'"));
    assert(app.includes("O.post('/api/world-adapters/evaluate'"));
    assert(app.includes('none applied'));
  });

  console.log('Living World Ruleset & Physics Adapter Kit selftest: PASS (' + pass + ' controls)');
} finally {
  cleanup();
}
