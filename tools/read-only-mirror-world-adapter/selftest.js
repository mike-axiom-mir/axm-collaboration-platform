#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LivingWorld = require('../../shared/operations/living-world-state-service');
const Mirror = require('../../shared/operations/mirror-world-adapter-service');

const PREFIX = 'axm-mirror-world-selftest-';
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
  const mirror = Mirror.create(Object.assign({}, options, { worldStateService: world }));

  world.apply({
    expectedRevision: 0,
    operations: [
      { type: 'set-fact', key: 'day', value: 2 },
      { type: 'upsert-entity', entity: { id: 'traveler-one', kind: 'agent', data: { zone: 'north' } } },
      { type: 'upsert-entity', entity: { id: 'tree-one', kind: 'flora', data: { zone: 'north' } } }
    ]
  }, 'selftest');

  check('manifest and contract declare consent-bound observation only', () => {
    assert.equal(manifest.id, 'read-only-mirror-world-adapter');
    assert.equal(contract.id, manifest.id);
    assert.deepStrictEqual(contract.permissions, manifest.permissions);
    assert(contract.boundaries.refuses.includes('world-apply'));
    assert(contract.boundaries.refuses.includes('world-reset'));
    assert(contract.boundaries.refuses.includes('unconsented-observation'));
  });

  check('service exposes no mutation route or apply authority', () => {
    const status = mirror.status();
    assert.equal(status.mode, 'read-only');
    assert.equal(status.applyAuthority, false);
    assert.equal(status.mutationRoute, false);
    assert.equal(typeof mirror.apply, 'undefined');
  });

  check('empty observation scope is refused', () => {
    assert.throws(() => mirror.createConsent({ mirrorId: 'mirror-local' }, 'selftest'), /at least one observation scope/);
  });

  const consent = mirror.createConsent({
    mirrorId: 'mirror-local',
    factKeys: ['day'],
    entityKinds: ['agent'],
    ttlHours: 1
  }, 'Mike');
  const before = world.get();
  const result = mirror.observe({ consentId: consent.id, expectedRevision: before.revision }, 'Mirror');

  check('observation contains only consented facts and entity kinds', () => {
    assert.deepStrictEqual(result.observation.facts, { day: 2 });
    assert.equal(result.observation.entities.length, 1);
    assert.equal(result.observation.entities[0].kind, 'agent');
    assert.match(result.observation.entities[0].id, /^redacted-[a-f0-9]{12}$/);
    assert.equal(result.observation.applyAuthority, false);
    assert.equal(result.observation.mutationRoute, false);
  });

  check('receipt binds consent world revision and observation digest', () => {
    assert.equal(result.receipt.schema, 'axm.mirror-observation-receipt/v1');
    assert.equal(result.receipt.consentId, consent.id);
    assert.equal(result.receipt.worldId, before.worldId);
    assert.equal(result.receipt.revision, before.revision);
    assert.equal(result.receipt.digest, result.observation.digest);
    assert.equal(result.receipt.factCount, 1);
    assert.equal(result.receipt.entityCount, 1);
  });

  check('observation leaves canonical world state unchanged', () => {
    const after = world.get();
    assert.equal(after.revision, before.revision);
    assert.equal(after.digest, before.digest);
    assert.equal(after.entities[0].id, 'traveler-one');
  });

  check('revision drift invalidates an older observation request', () => {
    world.apply({ expectedRevision: before.revision, operations: [{ type: 'set-fact', key: 'day', value: 3 }] }, 'selftest');
    assert.throws(() => mirror.observe({ consentId: consent.id, expectedRevision: before.revision }, 'Mirror'), /revision conflict/);
  });

  check('revoked consent cannot be reused', () => {
    mirror.revoke(consent.id, 'Mike');
    assert.throws(() => mirror.observe({ consentId: consent.id, expectedRevision: world.get().revision }, 'Mirror'), /active mirror consent not found/);
  });

  check('browser surface separates consent creation from observation', () => {
    assert(app.includes("O.post('/api/mirror-world/consent'"));
    assert(app.includes("O.post('/api/mirror-world/observe'"));
    assert(!app.includes("O.post('/api/mirror-world/apply'"));
  });

  console.log('Read-only Mirror World Adapter selftest: PASS (' + pass + ' controls)');
} finally {
  cleanup();
}
