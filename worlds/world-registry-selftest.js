#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function validate(value) {
  const errors = [];
  if (!value || value.schema !== 'axm.world-registry/v1') errors.push('schema mismatch');
  if (!value || !Array.isArray(value.worlds)) errors.push('worlds must be an array');
  const ids = new Set(), routes = new Set();
  (value && value.worlds || []).forEach((world, index) => {
    const at = 'worlds[' + index + ']';
    if (!/^world\.[a-z0-9.-]+$/.test(String(world.id || ''))) errors.push(at + ' invalid id');
    if (ids.has(world.id)) errors.push(at + ' duplicate id'); else ids.add(world.id);
    if (!/^\/worlds\/[a-z0-9-]+\/$/.test(String(world.path || ''))) errors.push(at + ' invalid path');
    if (routes.has(world.path)) errors.push(at + ' duplicate path'); else routes.add(world.path);
    if (!String(world.name || '').trim()) errors.push(at + ' missing name');
    if (!String(world.status || '').trim()) errors.push(at + ' missing status');
    if (!String(world.state_owner || '').trim()) errors.push(at + ' missing state_owner');
    if (typeof world.game_rulesets_own_world !== 'boolean') errors.push(at + ' game_rulesets_own_world must be boolean');
  });
  return { pass: errors.length === 0, errors };
}

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'world-registry.json'), 'utf8'));
assert.deepEqual(validate(registry), { pass: true, errors: [] });
const bad = JSON.parse(JSON.stringify(registry));
bad.worlds.push(Object.assign({}, bad.worlds[0]));
assert.equal(validate(bad).pass, false, 'duplicate world ids and paths are rejected');
console.log('world registry selftest: PASS (' + registry.worlds.length + ' worlds)');

module.exports = { validate };
