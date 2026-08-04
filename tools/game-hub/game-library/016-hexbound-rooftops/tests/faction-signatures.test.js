#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('every faction owns exactly one distinct signature regiment and passive', () => {
  const signatures = DATA.UNITS.filter(unit => unit.signatureOf);
  assert.equal(signatures.length, 8);
  assert.equal(new Set(signatures.map(unit => unit.signatureOf)).size, 8);
  assert.equal(new Set(signatures.map(unit => unit.id)).size, 8);
  assert.equal(new Set(signatures.map(unit => unit.passive)).size, 8);
  for (const faction of DATA.FACTIONS) {
    const signature = SYS.signatureForFaction(faction.id);
    assert.ok(signature && signature.passiveLabel);
    assert.equal(SYS.recruitableUnits(faction.id).length, 5);
    assert.ok(SYS.recruitableUnits(faction.id).includes(signature));
    assert.ok(SYS.recruitableUnits(faction.id).every(unit => !unit.signatureOf || unit.signatureOf === faction.id));
  }
});

test('signature regiment costs and squad modifiers remain faction-aware', () => {
  const lantern = SYS.signatureForFaction('lantern-republic');
  const temporal = SYS.signatureForFaction('temporal-mischief');
  assert.ok(SYS.trainingCost(lantern.id,'lantern-republic').seconds < lantern.train);
  assert.ok(SYS.squadSpec(temporal.id,'temporal-mischief').speed > temporal.speed);
  assert.equal(SYS.squadSpec(lantern.id,'lantern-republic').members, lantern.members + 1);
});

test('automatic macro passives produce bounded deterministic modifiers', () => {
  const building = { team:0, x:100, y:100 };
  const witches = [{ id:'w', team:0, unitId:'overtime-witches', hp:100, x:200, y:100 }];
  assert.equal(SYS.constructionAuraMultiplier(building,witches),1.5);
  assert.equal(SYS.constructionAuraMultiplier(building,[{...witches[0],x:500}]),1);

  const casualty = { x:100, y:100 };
  const wraiths = [{ id:'a', team:0, unitId:'audit-wraiths', hp:100, x:180, y:100 }];
  assert.equal(SYS.essenceAuraMultiplier(casualty,wraiths),1.5);

  assert.equal(SYS.lastActMultiplier({unitId:'plot-rioters',members:5,maxMembers:10}),1.4);
  assert.equal(SYS.lastActMultiplier({unitId:'mobs',members:5,maxMembers:10}),1);

  const squad = { id:'m',team:0,unitId:'mobs',hp:100,x:100,y:100 };
  const paladins = [{ id:'p',team:0,unitId:'pocket-paladins',hp:100,x:200,y:100 }];
  assert.equal(SYS.marchAuraMultiplier(squad,paladins),1.12);
});
