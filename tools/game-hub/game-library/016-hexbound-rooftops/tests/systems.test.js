#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('eight factions and six non-generic maps are selectable', () => {
  assert.equal(DATA.FACTIONS.length, 8);
  assert.equal(new Set(DATA.FACTIONS.map(item => item.id)).size, 8);
  assert.equal(DATA.MAPS.length, 6);
  assert.ok(DATA.MAPS.every(item => item.name && item.kicker && item.hazard));
});

test('one logical recruit represents a large multi-fighter squad', () => {
  const base = SYS.squadSpec('mobs', 'clockwork-coven');
  const graveyard = SYS.squadSpec('mobs', 'graveyard-shift');
  assert.equal(base.members, 10);
  assert.equal(graveyard.members, 12);
  assert.equal(base.maxHp, base.members * base.memberHp);
});

test('casualties create faction-modified Essence', () => {
  assert.equal(SYS.casualtyDelta(100, 59, 20, 5), 2);
  assert.equal(SYS.essenceFromDeaths(2, 'clockwork-coven'), 2);
  assert.equal(SYS.essenceFromDeaths(2, 'boo-brigade'), 3);
});

test('faction traits alter expansion, summons, training, and income', () => {
  assert.ok(SYS.claimCost('borough', 'thorn-court').scrap < SYS.claimCost('borough', 'clockwork-coven').scrap);
  assert.ok(SYS.summonCost('pirates', 'moonwake-corsairs') < SYS.summonCost('pirates', 'clockwork-coven'));
  assert.ok(SYS.trainingCost('mobs', 'lantern-republic').seconds < SYS.trainingCost('mobs', 'clockwork-coven').seconds);
  const buildings = [{ team:0, kind:'borough', progress:1 }, { team:0, kind:'borough', progress:1 }];
  assert.ok(SYS.incomeFor(buildings, 'clockwork-coven').scrap > SYS.incomeFor(buildings, 'thorn-court').scrap);
  assert.equal(SYS.incomeFor(buildings, 'clockwork-coven').cap, 560);
});

test('field summoning respects remembered fog cells', () => {
  const grid = { '2:3': true };
  assert.equal(SYS.exploredAt(grid, 3 * 80 + 5, 2 * 80 + 7, 80), true);
  assert.equal(SYS.exploredAt(grid, 20, 20, 80), false);
});
