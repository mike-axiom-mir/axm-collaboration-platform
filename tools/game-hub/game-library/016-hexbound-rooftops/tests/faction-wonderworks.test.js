#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const data = require('../runtime/game-data.js');
const systems = require('../runtime/systems.js');

test('all eight factions own one mechanically unique Wonderwork', () => {
  assert.equal(data.WONDERWORKS.length,8);
  assert.deepEqual(new Set(data.WONDERWORKS.map(item=>item.factionId)),new Set(data.FACTIONS.map(item=>item.id)));
  assert.equal(new Set(data.WONDERWORKS.map(item=>item.id)).size,8);
  assert.equal(new Set(data.WONDERWORKS.map(item=>item.silhouette)).size,8);
  assert.equal(new Set(data.WONDERWORKS.map(item=>item.effect.kind)).size,8);
  for(const item of data.WONDERWORKS){assert.equal(item.key,'B');assert.equal(item.max,2);assert.ok(item.glow>0&&item.scrap>0&&item.time>0&&item.hp>=690);}
});

test('Wonderwork lookup and limit counting stay faction scoped', () => {
  const clock=systems.wonderworkForFaction('clockwork-coven');
  assert.equal(clock.name,'Shift-Bell Foundry');
  assert.equal(systems.buildingSpec('wonderwork','clockwork-coven').id,clock.id);
  const buildings=[
    {kind:'wonderwork',team:0,factionId:'clockwork-coven',hp:500},
    {kind:'wonderwork',team:0,factionId:'clockwork-coven',hp:0},
    {kind:'wonderwork',team:2,factionId:'clockwork-coven',hp:500},
    {kind:'wonderwork',team:0,factionId:'boo-brigade',hp:500}
  ];
  assert.equal(systems.wonderworkCount(buildings,0,'clockwork-coven'),1);
});

test('mixed-charter Wonderweb strengthens a Lantern Wonderwork cap and sight', () => {
  const work={id:'w',kind:'wonderwork',team:0,factionId:'lantern-republic',progress:1,hp:700,x:100,y:100,charterId:'impossible-housing'};
  const market={id:'m',kind:'borough',team:0,factionId:'lantern-republic',progress:1,hp:500,x:250,y:100,charterId:'pumpkin-market'};
  const effects=systems.wonderworkEmpireEffects([work,market],0,'lantern-republic');
  assert.equal(effects.count,1);assert.equal(effects.cap,115);assert.equal(effects.sight,506);
  assert.equal(systems.incomeFor([work,market],'lantern-republic').cap,400+80+115+Math.round(45*1.15));
});

test('completed temporal offices accelerate future training multiplicatively', () => {
  const buildings=[1,2].map(index=>({id:'t'+index,kind:'wonderwork',team:0,factionId:'temporal-mischief',progress:1,hp:700,x:index*700,y:100,charterId:'pumpkin-market'}));
  const base=systems.trainingCost('mobs','temporal-mischief',null,[]);
  const faster=systems.trainingCost('mobs','temporal-mischief',null,buildings);
  const effects=systems.wonderworkEmpireEffects(buildings,0,'temporal-mischief');
  assert.ok(Math.abs(effects.trainSpeed-1.22*1.22)<1e-9);
  assert.ok(Math.abs(effects.cooldownSpeed-1.18*1.18)<1e-9);
  assert.ok(Math.abs(faster.seconds-base.seconds/effects.trainSpeed)<1e-9);
});

test('Wonderwork claims use the faction landmark and normal expansion modifiers', () => {
  const ordinary=systems.claimCost('wonderwork','clockwork-coven');
  const thorn=systems.claimCost('wonderwork','thorn-court');
  assert.equal(ordinary.glow,145);assert.equal(ordinary.scrap,155);
  assert.equal(thorn.glow,Math.ceil(150*.68));assert.equal(thorn.scrap,Math.ceil(165*.68));
});
