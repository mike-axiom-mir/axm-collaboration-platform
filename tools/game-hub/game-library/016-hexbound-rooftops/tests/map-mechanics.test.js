#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('all six maps declare a unique timed macro mechanic', () => {
  assert.equal(DATA.MAPS.length, 6);
  assert.equal(new Set(DATA.MAPS.map(map => map.mechanic.id)).size, 6);
  for (const map of DATA.MAPS) {
    assert.ok(map.mechanic.title && map.mechanic.effect && map.mechanic.counterplay);
    assert.ok(map.mechanic.first > 0 && map.mechanic.duration > 0 && map.mechanic.period > map.mechanic.duration);
  }
});

test('mechanic phases and pulse directions are deterministic', () => {
  const mechanic = DATA.MAP_MECHANICS['witch-mall'];
  assert.equal(SYS.mapMechanicState('witch-mall', mechanic.first - .1).phase, 'calm');
  const first = SYS.mapMechanicState('witch-mall', mechanic.first + .1);
  assert.equal(first.phase, 'active');
  assert.equal(first.pulse, 0);
  assert.equal(first.direction, 1);
  const warning = SYS.mapMechanicState('witch-mall', mechanic.first + mechanic.period - 1);
  assert.equal(warning.phase, 'warning');
  const second = SYS.mapMechanicState('witch-mall', mechanic.first + mechanic.period + .1);
  assert.equal(second.pulse, 1);
  assert.equal(second.direction, -1);
});

test('map effects alter only their advertised macro surfaces', () => {
  const active = { active: true, direction: 1 };
  assert.equal(SYS.mapIncomeMultiplier('royal-table', active), 1.65);
  assert.equal(SYS.mapIncomeMultiplier('tuesday', active), 1);
  assert.equal(SYS.mapSpeedMultiplier('tuesday', active, { onBridge: true }), 1.65);
  assert.equal(SYS.mapSpeedMultiplier('tuesday', active, { onBridge: false }), 1);
  assert.equal(SYS.mapSpeedMultiplier('gargoyle-garage', active, { nearContestedAnchor: true }), .55);
  assert.equal(SYS.mapSpeedMultiplier('witch-mall', active, { onEscalator: true, targetDeltaX: 40 }), 1.55);
  assert.equal(SYS.mapSpeedMultiplier('witch-mall', active, { onEscalator: true, targetDeltaX: -40 }), 1);
  assert.equal(SYS.mapSpeedMultiplier('witch-mall', active, { onEscalator: false, targetDeltaX: 40 }), 1);
});

test('bridge proximity uses the visible route segment rather than roof centres', () => {
  const anchors = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  assert.equal(SYS.isNearBridge({ x: 50, y: 20 }, anchors, [[0, 1]], 25), true);
  assert.equal(SYS.isNearBridge({ x: 50, y: 40 }, anchors, [[0, 1]], 25), false);
  assert.equal(Math.round(SYS.distanceToSegment({ x: 120, y: 0 }, anchors[0], anchors[1])), 20);
});
