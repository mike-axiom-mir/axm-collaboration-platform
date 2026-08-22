#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('every faction owns two exclusive authored Grand Doctrines', () => {
  assert.equal(DATA.DOCTRINES.length, 16);
  assert.equal(new Set(DATA.DOCTRINES.map(item => item.id)).size, 16);
  for (const faction of DATA.FACTIONS) {
    const choices = SYS.doctrinesForFaction(faction.id);
    assert.equal(choices.length, 2, faction.name);
    assert.deepEqual(choices.map(item => item.key), ['9','0']);
    assert.notEqual(choices[0].variant.unitId, choices[1].variant.unitId);
    assert.ok(choices.every(item => item.name && item.detail && item.variant.name && item.variant.role));
  }
});

test('doctrines produce distinct faction-scoped core formations', () => {
  const mass = SYS.squadSpec('mobs','graveyard-shift',null,'graveyard-collective');
  const base = SYS.squadSpec('mobs','graveyard-shift');
  assert.equal(mass.members, base.members + 5);
  assert.ok(mass.memberHp < base.memberHp);
  assert.ok(SYS.trainingCost('mobs','graveyard-shift','graveyard-collective').seconds < SYS.trainingCost('mobs','graveyard-shift').seconds);
  assert.equal(SYS.doctrineUnitPresentation('mobs','graveyard-shift','graveyard-collective').name,'Night Shift Crowd');
  assert.equal(SYS.doctrineUnitPresentation('mobs','clockwork-coven','graveyard-collective').name,'Mischief Mob');
  assert.equal(SYS.activeDoctrine('clockwork-coven','graveyard-collective'),null);
});

test('doctrine empire levers alter buildings, income, cap, and powers only where authored', () => {
  const buildings=[{team:0,kind:'borough',progress:1},{team:0,kind:'moot',progress:1}];
  assert.ok(SYS.claimCost('moot','clockwork-coven','midnight-union').scrap < SYS.claimCost('moot','clockwork-coven').scrap);
  assert.equal(SYS.claimCost('watch','clockwork-coven','midnight-union').scrap,SYS.claimCost('watch','clockwork-coven').scrap);
  assert.equal(SYS.buildingHpMultiplier('moot','clockwork-coven','midnight-union'),1.15);
  assert.ok(SYS.incomeFor(buildings,'clockwork-coven','midnight-union').scrap > SYS.incomeFor(buildings,'clockwork-coven').scrap);
  assert.equal(SYS.incomeFor(buildings,'lantern-republic','tiny-marches').cap,SYS.incomeFor(buildings,'lantern-republic').cap+60);
  assert.ok(SYS.summonCost('reinforce','boo-brigade','universal-aftercare') < SYS.summonCost('reinforce','boo-brigade'));
  assert.equal(SYS.summonCost('pirates','boo-brigade','universal-aftercare'),SYS.summonCost('pirates','boo-brigade'));
  assert.ok(Math.abs(SYS.doctrinePowerCooldown('reinforce',7,'temporal-mischief','deadline-extension')-4.9)<1e-9);
});

test('each doctrine pair creates two materially different macro build signatures without siege', () => {
  const allowedUnits=new Set(['mobs','hexbows','brooms','lanterns']);
  for(const faction of DATA.FACTIONS){
    const choices=SYS.doctrinesForFaction(faction.id);
    assert.ok(choices.every(item=>allowedUnits.has(item.variant.unitId)));
    const signature=item=>JSON.stringify({variant:item.variant,empire:item.empire});
    assert.notEqual(signature(choices[0]),signature(choices[1]),faction.name);
  }
  assert.ok(DATA.DOCTRINES.every(item=>!/siege|catapult|trebuchet/i.test(item.name+' '+item.detail+' '+item.variant.name)));
});

test('rivals and the co-op ally receive deterministic doctrine branches', () => {
  for(const faction of DATA.FACTIONS){
    const choices=SYS.doctrinesForFaction(faction.id);
    assert.equal(SYS.doctrineForBattle(faction.id,1601,'story').id,choices[0].id);
    assert.equal(SYS.doctrineForBattle(faction.id,1601,'nightmare').id,choices[1].id);
    assert.equal(SYS.doctrineForBattle(faction.id,1601,'serious').id,choices[1].id);
    assert.equal(SYS.doctrineForBattle(faction.id,1602,'serious').id,choices[0].id);
  }
});
