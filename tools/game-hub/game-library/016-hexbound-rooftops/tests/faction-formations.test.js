#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

test('eight faction kits and four core role silhouettes cover the complete roster', () => {
  assert.equal(DATA.FORMATION_KITS.length,8);
  assert.equal(DATA.FORMATION_ROLES.length,4);
  assert.deepEqual(new Set(DATA.FORMATION_KITS.map(item=>item.factionId)),new Set(DATA.FACTIONS.map(item=>item.id)));
  assert.deepEqual(new Set(DATA.FORMATION_ROLES.map(item=>item.unitId)),new Set(['mobs','hexbows','brooms','lanterns']));
  for(const key of ['id','motif','headgear','banner','emblem'])assert.equal(new Set(DATA.FORMATION_KITS.map(item=>item[key])).size,8,key+' must be faction-distinct');
  for(const key of ['silhouette','formation','equipment'])assert.equal(new Set(DATA.FORMATION_ROLES.map(item=>item[key])).size,4,key+' must be role-distinct');
});

test('all 32 core faction-role combinations resolve to unique deterministic variants', () => {
  const variants=[];
  for(const faction of DATA.FACTIONS)for(const role of DATA.FORMATION_ROLES){
    const presentation=SYS.coreFormationPresentation(role.unitId,faction.id);
    assert.ok(presentation);
    assert.equal(presentation.factionId,faction.id);
    assert.equal(presentation.unitId,role.unitId);
    assert.equal(presentation.kitId,SYS.formationKitForFaction(faction.id).id);
    assert.equal(presentation.silhouette,role.silhouette);
    variants.push(presentation.variantId);
  }
  assert.equal(variants.length,32);
  assert.equal(new Set(variants).size,32);
});

test('signature regiments and unknown identities stay outside the core formation surface', () => {
  for(const signature of DATA.UNITS.filter(item=>item.signatureOf))assert.equal(SYS.coreFormationPresentation(signature.id,signature.signatureOf),null);
  assert.equal(SYS.coreFormationPresentation('mobs','unknown-faction'),null);
  assert.equal(SYS.coreFormationPresentation('unknown-unit','clockwork-coven'),null);
});

test('formation architecture is presentation-only and core balance remains unchanged', () => {
  const forbidden=new Set(['members','glow','scrap','train','speed','range','damage','hp','sight','effect','cost','cooldown']);
  for(const record of [...DATA.FORMATION_KITS,...DATA.FORMATION_ROLES])for(const key of Object.keys(record))assert.equal(forbidden.has(key),false,key+' is not a presentation field');
  const expected={
    mobs:{members:10,glow:70,scrap:18,train:2.4,speed:74,range:58,damage:7.5,hp:26,sight:185},
    hexbows:{members:8,glow:62,scrap:42,train:3,speed:66,range:205,damage:6.2,hp:19,sight:215},
    brooms:{members:6,glow:54,scrap:38,train:2.1,speed:118,range:76,damage:5.6,hp:18,sight:290},
    lanterns:{members:5,glow:110,scrap:88,train:4,speed:50,range:70,damage:13.5,hp:52,sight:165}
  };
  for(const [unitId,contract] of Object.entries(expected)){const unit=SYS.unit(unitId);for(const [key,value] of Object.entries(contract))assert.equal(unit[key],value,unitId+'.'+key);}
});

test('battlefield renderer wires standards, headgear, and role geometry into grouped squads', () => {
  const app=fs.readFileSync(path.join(__dirname,'../runtime/app.js'),'utf8');
  for(const seam of ['SYS.coreFormationPresentation','function formationFighterPosition','function drawFormationStandard','function drawFormationHeadgear','drawFighter(point.x,point.y'])assert.ok(app.includes(seam),seam);
  for(const banner of DATA.FORMATION_KITS.map(item=>item.banner))assert.ok(app.includes("formation.banner==='"+banner+"'")||banner==='swallowtail',banner);
  for(const headgear of DATA.FORMATION_KITS.map(item=>item.headgear))assert.ok(app.includes("formation.headgear==='"+headgear+"'"),headgear);
});
