#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const programPath = path.join(__dirname, 'program.json');
const schemaPath = path.join(__dirname, 'upgrade-program.schema.json');
const program = JSON.parse(fs.readFileSync(programPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

assert.equal(program.schema, 'axm.asset-hands.upgrade-program/v1');
assert.equal(schema.$id, 'https://axm.local/schemas/asset-hands-upgrade-program.schema.json');
assert.equal(program.upgrades.length, 50, 'the complete requested scope must remain fifty upgrades');

const ranks = new Set();
const ids = new Set();
const capabilities = new Set();
for (const upgrade of program.upgrades) {
  assert(Number.isInteger(upgrade.rank) && upgrade.rank >= 1 && upgrade.rank <= 50);
  assert.equal(upgrade.rank, program.upgrades.indexOf(upgrade) + 1, 'rank order must stay contiguous');
  assert(!ranks.has(upgrade.rank), 'duplicate rank ' + upgrade.rank);
  assert(!ids.has(upgrade.id), 'duplicate upgrade id ' + upgrade.id);
  ranks.add(upgrade.rank);
  ids.add(upgrade.id);
  assert(/^asset\.[a-z0-9.-]+$/.test(upgrade.id), 'unstable id ' + upgrade.id);
  assert(['CORE', 'EVIDENCE', 'IMPROVE', 'NEW_HAND', 'ADAPTER'].includes(upgrade.class));
  assert(['MISSING', 'PARTIAL', 'READY', 'BLOCKED', 'UNKNOWN'].includes(upgrade.state));
  assert(upgrade.state !== 'READY', 'planning evidence must not pre-promote ' + upgrade.id);
  assert(Array.isArray(upgrade.gap_types) && upgrade.gap_types.length);
  assert(Array.isArray(upgrade.capabilities) && upgrade.capabilities.length);
  assert(Array.isArray(upgrade.depends_on));
  assert(upgrade.acceptance && upgrade.acceptance.pass_condition.length >= 20);
  assert(upgrade.acceptance.primary_surface.length >= 5);
  assert(upgrade.acceptance.counterevidence.length >= 10);
  for (const capability of upgrade.capabilities) {
    assert(/^[a-z0-9.-]+$/.test(capability), 'unstable capability ' + capability);
    assert(!capabilities.has(capability), 'capability owned by two upgrades: ' + capability);
    capabilities.add(capability);
  }
}

for (const upgrade of program.upgrades) {
  for (const dependency of upgrade.depends_on) {
    assert(ids.has(dependency), upgrade.id + ' has unknown dependency ' + dependency);
    const dependencyRank = program.upgrades.find((entry) => entry.id === dependency).rank;
    assert(dependencyRank < upgrade.rank, upgrade.id + ' depends on a later upgrade ' + dependency);
  }
}

assert.equal(ranks.size, 50);
assert.equal(ids.size, 50);
assert(capabilities.size >= 120, 'capability decomposition is too coarse');
console.log(`Asset Hands fifty-upgrade program PASS (${ids.size} upgrades, ${capabilities.size} stable capabilities, dependency DAG ordered, zero pre-promoted READY claims)`);
