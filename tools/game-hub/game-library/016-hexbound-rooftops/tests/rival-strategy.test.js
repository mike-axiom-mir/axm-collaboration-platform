#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('five authored rival schemes cover macro objectives without siege', () => {
  assert.equal(DATA.RIVAL_SCHEMES.length, 5);
  assert.deepEqual(DATA.RIVAL_SCHEMES.map(item => item.id), ['market-heist', 'web-cutter', 'lantern-blackout', 'clock-crash', 'roof-grab']);
  assert.ok(DATA.RIVAL_SCHEMES.every(item => item.detail && item.counterplay && item.composition.length === 4));
  assert.ok(DATA.RIVAL_SCHEMES.every(item => item.composition.every(unit => unit !== 'siege')));
});

test('planner expands when cramped and commits to a fair late clock attack', () => {
  assert.equal(SYS.rivalSchemeFor({ ownDistricts: 1, openRoofs: 4, elapsed: 20 }).id, 'roof-grab');
  assert.equal(SYS.rivalSchemeFor({ ownDistricts: 3, openRoofs: 4, elapsed: 130, rivalFighters: 80, playerFighters: 90 }).id, 'clock-crash');
});

test('planner rotates through opportunities on the live board', () => {
  const districts = [
    { kind: 'borough', charterId: 'pumpkin-market', networkBonus: 1.3 },
    { kind: 'moot', charterId: 'junk-jamboree', networkBonus: 1.15 },
    { kind: 'watch', charterId: 'impossible-housing', networkBonus: 1 }
  ];
  const context = { ownDistricts: 3, openRoofs: 3, elapsed: 60, rivalFighters: 40, playerFighters: 80, playerDistricts: districts };
  assert.equal(SYS.rivalSchemeFor({ ...context, cycle: 0 }).id, 'market-heist');
  assert.equal(SYS.rivalSchemeFor({ ...context, cycle: 1 }).id, 'web-cutter');
  assert.equal(SYS.rivalSchemeFor({ ...context, cycle: 2 }).id, 'lantern-blackout');
  assert.equal(SYS.rivalSchemeFor({ ...context, cycle: 3 }).id, 'clock-crash');
  assert.equal(SYS.rivalSchemeFor({ ...context, cycle: 4 }).id, 'roof-grab');
});

test('objective targeting values economy, wonderweb, sight, and the Grand Clock', () => {
  const buildings = [
    { id: 'clock', team: 0, kind: 'command', x: -1000, y: 0, hp: 1000, maxHp: 1000, progress: 1 },
    { id: 'market', team: 0, kind: 'borough', charterId: 'pumpkin-market', x: 500, y: 0, hp: 560, maxHp: 560, progress: 1 },
    { id: 'web', team: 0, kind: 'moot', charterId: 'volunteer-seance', x: 0, y: 0, hp: 650, maxHp: 650, progress: 1 },
    { id: 'watch', team: 0, kind: 'watch', charterId: 'impossible-housing', x: -500, y: 0, hp: 390, maxHp: 390, progress: 1 },
    { id: 'junk', team: 0, kind: 'borough', charterId: 'junk-jamboree', x: 0, y: 500, hp: 560, maxHp: 560, progress: 1 }
  ];
  assert.equal(SYS.rivalTarget('market-heist', buildings).id, 'market');
  assert.equal(SYS.rivalTarget('web-cutter', buildings).id, 'web');
  assert.equal(SYS.rivalTarget('lantern-blackout', buildings).id, 'watch');
  assert.equal(SYS.rivalTarget('clock-crash', buildings).id, 'clock');
});

test('difficulty scales formation mass and telegraph cadence', () => {
  const story = SYS.rivalComposition('web-cutter', 'story', 0, 'audit-wraiths');
  const serious = SYS.rivalComposition('web-cutter', 'serious', 0, 'audit-wraiths');
  const nightmare = SYS.rivalComposition('web-cutter', 'nightmare', 0, 'audit-wraiths');
  assert.equal(story.length, 2); assert.equal(serious.length, 4); assert.equal(nightmare.length, 5);
  assert.ok(serious.includes('audit-wraiths'));
  assert.ok(SYS.rivalCadence('story').stage > SYS.rivalCadence('nightmare').stage);
  assert.ok(SYS.rivalCadence('story').regroup > SYS.rivalCadence('nightmare').regroup);
});
