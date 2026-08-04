#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');
const APP_SOURCE = fs.readFileSync(path.join(__dirname,'../runtime/app.js'),'utf8');

test('all eight factions own a distinct ordinary-district architecture kit', () => {
  assert.equal(DATA.DISTRICT_ARCHITECTURES.length, 8);
  assert.deepEqual(new Set(DATA.DISTRICT_ARCHITECTURES.map(item => item.factionId)), new Set(DATA.FACTIONS.map(item => item.id)));
  assert.equal(new Set(DATA.DISTRICT_ARCHITECTURES.map(item => item.id)).size, 8);
  assert.equal(new Set(DATA.DISTRICT_ARCHITECTURES.map(item => item.motif)).size, 8);
  assert.equal(new Set(DATA.DISTRICT_ARCHITECTURES.map(item => item.roof)).size, 8);
  assert.deepEqual(DATA.BUILDINGS.map(item => item.id), ['borough','moot','watch','bridgehead']);
  for (const side of DATA.FACTIONS) {
    const kit = SYS.districtArchitectureForFaction(side.id);
    assert.equal(kit.factionId, side.id);
    assert.match(kit.material, /^#[0-9a-f]{6}$/i);
    assert.match(kit.trim, /^#[0-9a-f]{6}$/i);
    assert.match(kit.light, /^#[0-9a-f]{6}$/i);
  }
});

test('Clockwork Coven converts only its ordinary Borough presentation', () => {
  const base = SYS.building('borough');
  const clockwork = SYS.buildingSpec('borough','clockwork-coven');
  assert.equal(clockwork.id, 'borough');
  assert.equal(clockwork.key, base.key);
  assert.equal(clockwork.glow, base.glow);
  assert.equal(clockwork.scrap, base.scrap);
  assert.equal(clockwork.time, base.time);
  assert.equal(clockwork.hp, base.hp);
  assert.equal(clockwork.name, 'Thirteenth-Hour Union Hall');
  assert.equal(clockwork.icon, 'XIII');
  assert.equal(clockwork.conversionId, 'thirteenth-hour-union-hall');
  assert.equal(clockwork.conversionEffect.kind, 'union-shift');
  assert.equal(SYS.buildingSpec('moot','clockwork-coven').name, 'Moon Moot');
  assert.equal(SYS.buildingSpec('borough','boo-brigade').name, base.name);
});

test('Boo Brigade converts only its ordinary Watchmoon presentation', () => {
  const base = SYS.building('watch');
  const boo = SYS.buildingSpec('watch','boo-brigade');
  assert.equal(boo.id, 'watch');
  assert.equal(boo.key, base.key);
  assert.equal(boo.glow, base.glow);
  assert.equal(boo.scrap, base.scrap);
  assert.equal(boo.time, base.time);
  assert.equal(boo.hp, base.hp);
  assert.equal(boo.name, 'Spectral Census Bureau');
  assert.equal(boo.conversionId, 'spectral-census-bureau');
  assert.equal(boo.conversionEffect.kind, 'spectral-census');
  assert.equal(SYS.buildingSpec('watch','clockwork-coven').name, base.name);
  assert.equal(SYS.buildingSpec('borough','boo-brigade').name, 'Crooked Borough');
});

test('Thorn Court converts only its ordinary Bridgehead presentation', () => {
  const base = SYS.building('bridgehead');
  const thorn = SYS.buildingSpec('bridgehead','thorn-court');
  assert.equal(thorn.id, 'bridgehead');
  assert.equal(thorn.key, base.key);
  assert.equal(thorn.glow, base.glow);
  assert.equal(thorn.scrap, base.scrap);
  assert.equal(thorn.time, base.time);
  assert.equal(thorn.hp, base.hp);
  assert.equal(thorn.name, 'Briarway Gatehouse');
  assert.equal(thorn.conversionId, 'briarway-gatehouse');
  assert.equal(thorn.conversionEffect.kind, 'briar-mend');
  assert.equal(SYS.buildingSpec('bridgehead','clockwork-coven').name, base.name);
  assert.equal(SYS.buildingSpec('borough','thorn-court').name, 'Crooked Borough');
});

test('Moonwake Corsairs convert only their ordinary Moon Moot presentation', () => {
  const base = SYS.building('moot');
  const moonwake = SYS.buildingSpec('moot','moonwake-corsairs');
  assert.equal(moonwake.id, 'moot');
  assert.equal(moonwake.key, base.key);
  assert.equal(moonwake.glow, base.glow);
  assert.equal(moonwake.scrap, base.scrap);
  assert.equal(moonwake.time, base.time);
  assert.equal(moonwake.hp, base.hp);
  assert.equal(moonwake.name, 'Black-Sail Anchorage');
  assert.equal(moonwake.conversionId, 'black-sail-anchorage');
  assert.equal(moonwake.conversionEffect.kind, 'black-sail-route');
  assert.equal(SYS.buildingSpec('moot','clockwork-coven').name, base.name);
  assert.equal(SYS.buildingSpec('borough','moonwake-corsairs').name, 'Crooked Borough');
});

test('Once-Upon-a-Mob converts only its ordinary Watchmoon presentation', () => {
  const base = SYS.building('watch');
  const mob = SYS.buildingSpec('watch','once-upon-a-mob');
  assert.equal(mob.id, 'watch');
  assert.equal(mob.key, base.key);
  assert.equal(mob.glow, base.glow);
  assert.equal(mob.scrap, base.scrap);
  assert.equal(mob.time, base.time);
  assert.equal(mob.hp, base.hp);
  assert.equal(mob.name, 'Foreground Spotlight');
  assert.equal(mob.conversionId, 'foreground-spotlight');
  assert.equal(mob.conversionEffect.kind, 'lead-role-spotlight');
  assert.equal(SYS.buildingSpec('watch','clockwork-coven').name, base.name);
  assert.equal(SYS.buildingSpec('borough','once-upon-a-mob').name, 'Crooked Borough');
});

test('Tin Lantern Republic converts only its ordinary Borough presentation', () => {
  const base = SYS.building('borough');
  const lantern = SYS.buildingSpec('borough','lantern-republic');
  assert.equal(lantern.id, 'borough');
  assert.equal(lantern.key, base.key);
  assert.equal(lantern.glow, base.glow);
  assert.equal(lantern.scrap, base.scrap);
  assert.equal(lantern.time, base.time);
  assert.equal(lantern.hp, base.hp);
  assert.equal(lantern.name, 'Every-Window Assembly');
  assert.equal(lantern.icon, 'CIVIC');
  assert.equal(lantern.conversionId, 'every-window-assembly');
  assert.equal(lantern.conversionEffect.kind, 'civic-cover');
  assert.equal(SYS.buildingSpec('moot','lantern-republic').name, 'Moon Moot');
  assert.equal(SYS.buildingSpec('borough','temporal-mischief').name, base.name);
});

test('Graveyard Shift converts only its ordinary Borough presentation', () => {
  const base = SYS.building('borough');
  const graveyard = SYS.buildingSpec('borough','graveyard-shift');
  assert.equal(graveyard.id, 'borough');
  assert.equal(graveyard.key, base.key);
  assert.equal(graveyard.glow, base.glow);
  assert.equal(graveyard.scrap, base.scrap);
  assert.equal(graveyard.time, base.time);
  assert.equal(graveyard.hp, base.hp);
  assert.equal(graveyard.name, 'Last-Rites Exchange');
  assert.equal(graveyard.icon, 'WAKE');
  assert.equal(graveyard.conversionId, 'last-rites-exchange');
  assert.equal(graveyard.conversionEffect.kind, 'wake-dividend');
  assert.equal(SYS.buildingSpec('moot','graveyard-shift').name, 'Moon Moot');
  assert.equal(SYS.buildingSpec('borough','temporal-mischief').name, base.name);
});

test('Black-Sail route support is allied, local, route-only, mixed-charter scaled, and non-stacking', () => {
  const anchorage = {id:'anchorage',team:0,kind:'moot',factionId:'moonwake-corsairs',progress:1,hp:650,maxHp:650,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'borough',factionId:'moonwake-corsairs',progress:1,hp:560,maxHp:560,x:90,y:0,charterId:'junk-jamboree'},
    {id:'watch',team:0,kind:'watch',factionId:'moonwake-corsairs',progress:1,hp:390,maxHp:390,x:0,y:100,charterId:'impossible-housing'},
    {id:'bridge',team:0,kind:'bridgehead',factionId:'moonwake-corsairs',progress:1,hp:760,maxHp:760,x:120,y:80,charterId:'volunteer-seance'}
  ];
  const second = {...anchorage,id:'anchorage-two',x:80,y:40};
  const routed = {id:'crew',team:0,hp:200,x:160,y:0,tx:700,ty:0,order:'march',routeGoal:{x:700,y:0},route:[{x:300,y:0}]};
  const buildings = [anchorage,...web,second];
  const support = SYS.districtRouteSupport(routed,buildings);
  assert.equal(support.conversionId,'black-sail-anchorage');
  assert.equal(support.networkBonus,1.45);
  assert.ok(['anchorage','anchorage-two'].includes(support.sourceId));
  assert.ok(Math.abs(support.multiplier-1.232)<1e-9);
  assert.equal(SYS.districtRouteSupport({...routed,order:'ready',route:[],routeGoal:null},buildings).multiplier,1);
  assert.equal(SYS.districtRouteSupport({...routed,team:2},buildings).multiplier,1);
  assert.equal(SYS.districtRouteSupport({...routed,x:700},buildings).multiplier,1);
  assert.equal(SYS.districtRouteSupport(routed,[{...anchorage,progress:.9},...web]).multiplier,1);
  assert.equal(SYS.districtRouteSupport(routed,[{...anchorage,hp:0},...web]).multiplier,1);
});

test('Thirteenth-Hour shift is a four-second allied local pulse strengthened by capped mixed charters', () => {
  const hall = {id:'hall',team:0,kind:'borough',factionId:'clockwork-coven',progress:1,hp:560,maxHp:560,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'moot',factionId:'clockwork-coven',progress:1,hp:650,maxHp:650,x:80,y:0,charterId:'junk-jamboree'},
    {id:'housing',team:0,kind:'watch',factionId:'clockwork-coven',progress:1,hp:390,maxHp:390,x:0,y:90,charterId:'impossible-housing'},
    {id:'volunteers',team:0,kind:'bridgehead',factionId:'clockwork-coven',progress:1,hp:760,maxHp:760,x:110,y:70,charterId:'volunteer-seance'},
    {id:'extra',team:0,kind:'borough',factionId:'clockwork-coven',progress:1,hp:560,maxHp:560,x:130,y:30,charterId:'junk-jamboree'}
  ];
  const nearby = {id:'nearby',team:0,hp:200,x:160,y:0};
  const targets = [
    nearby,
    {id:'edge',team:0,hp:120,x:520,y:0},
    {id:'enemy',team:2,hp:200,x:100,y:0},
    {id:'dead',team:0,hp:0,x:100,y:0},
    {id:'far',team:0,hp:200,x:521,y:0},
    {id:'invalid',team:0,hp:200,x:NaN,y:0}
  ];
  const pulse = SYS.districtUnionShiftPulse(hall,[hall,...web],targets);
  assert.equal(pulse.conversionId,'thirteenth-hour-union-hall');
  assert.equal(pulse.period,12);
  assert.equal(pulse.duration,4);
  assert.equal(pulse.range,520);
  assert.equal(pulse.networkBonus,1.45);
  assert.ok(Math.abs(pulse.moveMultiplier-1.261)<1e-9);
  assert.ok(Math.abs(pulse.attackRecoveryMultiplier-1.232)<1e-9);
  assert.deepEqual(pulse.targets.map(item=>item.id),['nearby','edge']);
  assert.equal(SYS.districtUnionShiftPulse({...hall,progress:.9},[hall],targets),null);
  assert.equal(SYS.districtUnionShiftPulse({...hall,hp:0},[hall],targets),null);
  assert.equal(SYS.districtUnionShiftPulse({...hall,factionId:'boo-brigade'},[hall],targets),null);
});

test('Foreground Spotlight deterministically casts one enemy formation and grants a local non-stacking lead-role bonus', () => {
  const spotlight = {id:'spotlight',team:0,kind:'watch',factionId:'once-upon-a-mob',progress:1,hp:390,maxHp:390,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'borough',factionId:'once-upon-a-mob',progress:1,hp:560,maxHp:560,x:80,y:0,charterId:'junk-jamboree'},
    {id:'housing',team:0,kind:'moot',factionId:'once-upon-a-mob',progress:1,hp:650,maxHp:650,x:0,y:90,charterId:'impossible-housing'},
    {id:'volunteers',team:0,kind:'bridgehead',factionId:'once-upon-a-mob',progress:1,hp:760,maxHp:760,x:110,y:70,charterId:'volunteer-seance'}
  ];
  const candidates = [
    {id:'enemy-b',team:2,unitId:'mobs',hp:200,x:180,y:0},
    {id:'enemy-a',team:2,unitId:'hexbows',hp:180,x:180,y:0},
    {id:'ally-ai',team:1,unitId:'mobs',hp:200,x:80,y:0},
    {id:'dead',team:2,unitId:'mobs',hp:0,x:70,y:0},
    {id:'far',team:2,unitId:'mobs',hp:200,x:521,y:0},
    {id:'enemy-building',team:2,kind:'borough',hp:560,x:50,y:0}
  ];
  const pulse = SYS.districtSpotlightPulse(spotlight,[spotlight,...web],candidates);
  assert.equal(pulse.conversionId,'foreground-spotlight');
  assert.equal(pulse.period,13);
  assert.equal(pulse.duration,5);
  assert.equal(pulse.range,520);
  assert.equal(pulse.networkBonus,1.45);
  assert.ok(Math.abs(pulse.damageMultiplier-1.261)<1e-9);
  assert.equal(pulse.target.id,'enemy-a');
  assert.equal(SYS.districtSpotlightPulse({...spotlight,progress:.9},[spotlight],candidates),null);

  const active = {...spotlight,conversionPulseUntil:10,conversionTargets:['enemy-a']};
  const second = {...active,id:'second',x:30,y:0,charterId:null};
  const player = {id:'player',team:0,unitId:'plot-rioters',hp:200,x:120,y:0};
  const ally = {...player,id:'ally',team:1};
  const target = candidates[1];
  const support = SYS.districtSpotlightDamageMultiplier(player,target,[active,...web,second],4);
  assert.equal(support.sourceId,'spotlight');
  assert.ok(Math.abs(support.multiplier-1.261)<1e-9);
  assert.ok(Math.abs(SYS.districtSpotlightDamageMultiplier(ally,target,[active,...web],4).multiplier-1.261)<1e-9);
  assert.equal(SYS.districtSpotlightDamageMultiplier({...player,team:2},target,[active,...web],4).multiplier,1);
  assert.equal(SYS.districtSpotlightDamageMultiplier({...player,x:521},target,[active,...web],4).multiplier,1);
  assert.equal(SYS.districtSpotlightDamageMultiplier(player,target,[active,...web],10).multiplier,1);
  assert.equal(SYS.districtSpotlightDamageMultiplier(player,{...target,kind:'borough'},[active,...web],4).multiplier,1);
  assert.equal(SYS.districtSpotlightDamageMultiplier(player,target,[{...active,hp:0},...web],4).multiplier,1);
});

test('Every-Window Assembly raises threat-gated allied Civic Cover with strongest-only mixed-charter scaling', () => {
  const assembly = {id:'assembly',team:0,kind:'borough',factionId:'lantern-republic',progress:1,hp:560,maxHp:560,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'moot',factionId:'lantern-republic',progress:1,hp:650,maxHp:650,x:80,y:0,charterId:'junk-jamboree'},
    {id:'housing',team:0,kind:'watch',factionId:'lantern-republic',progress:1,hp:390,maxHp:390,x:0,y:90,charterId:'impossible-housing'},
    {id:'volunteers',team:0,kind:'bridgehead',factionId:'lantern-republic',progress:1,hp:760,maxHp:760,x:110,y:70,charterId:'volunteer-seance'}
  ];
  const candidates = [
    {id:'player',team:0,unitId:'mobs',hp:200,x:100,y:0},
    {id:'ally-ai',team:1,unitId:'hexbows',hp:180,x:140,y:0},
    {id:'enemy',team:2,unitId:'plot-rioters',hp:200,x:180,y:0},
    {id:'dead-enemy',team:2,unitId:'mobs',hp:0,x:70,y:0},
    {id:'far-ally',team:0,unitId:'mobs',hp:200,x:521,y:0},
    {id:'ally-building',team:0,kind:'watch',hp:390,x:50,y:0}
  ];
  const pulse = SYS.districtCivicCoverPulse(assembly,[assembly,...web],candidates);
  assert.equal(pulse.conversionId,'every-window-assembly');
  assert.equal(pulse.period,13);
  assert.equal(pulse.duration,5);
  assert.equal(pulse.range,520);
  assert.equal(pulse.networkBonus,1.45);
  assert.ok(Math.abs(pulse.damageReduction-.203)<1e-9);
  assert.ok(Math.abs(pulse.damageMultiplier-.797)<1e-9);
  assert.deepEqual(pulse.threats.map(item=>item.id),['enemy']);
  assert.deepEqual(pulse.targets.map(item=>item.id),['player','ally-ai']);
  assert.equal(SYS.districtCivicCoverPulse({...assembly,progress:.9},[assembly],candidates),null);
  assert.equal(SYS.districtCivicCoverPulse({...assembly,hp:0},[assembly],candidates),null);
  assert.equal(SYS.districtCivicCoverPulse({...assembly,factionId:'graveyard-shift'},[assembly],candidates),null);
  assert.equal(SYS.districtCivicCoverPulse(assembly,[assembly],candidates.filter(item=>item.team!==2)).threats.length,0);

  const active = {...assembly,conversionPulseUntil:10,conversionTargets:['player','ally-ai']};
  const weaker = {...active,id:'weaker',x:30,y:0,charterId:null};
  const player = candidates[0], ally = candidates[1];
  const cover = SYS.districtCivicCoverDamageMultiplier(player,[active,...web,weaker],4);
  assert.equal(cover.sourceId,'assembly');
  assert.ok(Math.abs(cover.damageReduction-.203)<1e-9);
  assert.ok(Math.abs(cover.multiplier-.797)<1e-9);
  assert.ok(Math.abs(SYS.districtCivicCoverDamageMultiplier(ally,[active,...web],4).multiplier-.797)<1e-9);
  assert.equal(SYS.districtCivicCoverDamageMultiplier({...player,team:2},[active,...web],4).multiplier,1);
  assert.equal(SYS.districtCivicCoverDamageMultiplier({...player,x:521},[active,...web],4).multiplier,1);
  assert.equal(SYS.districtCivicCoverDamageMultiplier(player,[active,...web],10).multiplier,1);
  assert.equal(SYS.districtCivicCoverDamageMultiplier({...player,kind:'borough'},[active,...web],4).multiplier,1);
  assert.equal(SYS.districtCivicCoverDamageMultiplier(player,[{...active,hp:0},...web],4).multiplier,1);

  const rival = {...assembly,id:'rival-assembly',team:2,conversionPulseUntil:10,conversionTargets:['rival-formation']};
  const rivalFormation = {id:'rival-formation',team:2,unitId:'mobs',hp:200,x:100,y:0};
  assert.ok(SYS.districtCivicCoverDamageMultiplier(rivalFormation,[rival],4).multiplier<1);
  assert.equal(SYS.districtCivicCoverDamageMultiplier({...rivalFormation,id:'ally-formation',team:1},[rival],4).multiplier,1);
});

test('Last-Rites Exchange pays one local strongest-only casualty dividend with mixed-charter and rival parity', () => {
  const exchange = {id:'exchange',team:0,kind:'borough',factionId:'graveyard-shift',progress:1,hp:560,maxHp:560,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'moot',factionId:'graveyard-shift',progress:1,hp:650,maxHp:650,x:80,y:0,charterId:'junk-jamboree'},
    {id:'housing',team:0,kind:'watch',factionId:'graveyard-shift',progress:1,hp:390,maxHp:390,x:0,y:90,charterId:'impossible-housing'},
    {id:'volunteers',team:0,kind:'bridgehead',factionId:'graveyard-shift',progress:1,hp:760,maxHp:760,x:110,y:70,charterId:'volunteer-seance'}
  ];
  const weaker = {...exchange,id:'weaker',x:40,y:20,charterId:null};
  const casualty = {id:'casualty',team:2,unitId:'mobs',members:7,hp:160,x:180,y:0};
  const dividend = SYS.districtWakeDividend(casualty,3,[exchange,...web,weaker],0);
  assert.equal(dividend.conversionId,'last-rites-exchange');
  assert.equal(dividend.sourceId,'exchange');
  assert.equal(dividend.sourceFactionId,'graveyard-shift');
  assert.equal(dividend.range,520);
  assert.equal(dividend.networkBonus,1.45);
  assert.ok(Math.abs(dividend.bonusRate-.7975)<1e-9);
  assert.ok(Math.abs(dividend.essence-2.3925)<1e-9);
  assert.equal(SYS.districtWakeDividend({...casualty,x:521},3,[exchange,...web],0).essence,0);
  assert.equal(SYS.districtWakeDividend({...casualty,kind:'borough'},3,[exchange,...web],0).essence,0);
  assert.equal(SYS.districtWakeDividend(casualty,0,[exchange,...web],0).essence,0);
  assert.equal(SYS.districtWakeDividend(casualty,3,[{...exchange,progress:.9},...web],0).essence,0);
  assert.equal(SYS.districtWakeDividend(casualty,3,[{...exchange,hp:0},...web],0).essence,0);
  assert.equal(SYS.districtWakeDividend(casualty,3,[{...exchange,factionId:'temporal-mischief'},...web],0).essence,0);

  const rivalExchange = {...exchange,id:'rival-exchange',team:2,x:20,y:0,charterId:null};
  const rivalDividend = SYS.districtWakeDividend({...casualty,team:0},3,[rivalExchange],2);
  assert.equal(rivalDividend.sourceId,'rival-exchange');
  assert.ok(Math.abs(rivalDividend.bonusRate-.55)<1e-9);
  assert.ok(Math.abs(rivalDividend.essence-1.65)<1e-9);
  assert.equal(SYS.districtWakeDividend(casualty,3,[rivalExchange],0).essence,0);
});

test('runtime routes combat and hazard casualties through player and rival wake accounts', () => {
  assert.match(APP_SOURCE,/awardCasualtyEssence\(squad,deaths,'TOW '/);
  assert.match(APP_SOURCE,/awardCasualtyEssence\(target,deaths,''/);
  assert.match(APP_SOURCE,/districtWakeDividend\(casualty,deaths,state\.buildings,0\)/);
  assert.match(APP_SOURCE,/districtWakeDividend\(casualty,deaths,state\.buildings,2\)/);
  assert.match(APP_SOURCE,/state\.resources\.essence\+=gained;state\.enemyEssence\+=rivalDividend\.essence/);
  assert.match(APP_SOURCE,/if\(rivalSource\)cashRivalEssence\(rivalSource/);
  assert.match(APP_SOURCE,/if\(!source\|\|source\.team!==2\|\|state\.enemyEssence<60\)return false/);
});

test('Briarway repair pulse is bounded to damaged allied ordinary districts and scales with mixed charters', () => {
  const gate = {id:'gate',team:0,kind:'bridgehead',factionId:'thorn-court',progress:1,hp:760,maxHp:760,x:0,y:0,charterId:'pumpkin-market'};
  const market = {id:'market',team:0,kind:'borough',factionId:'thorn-court',progress:1,hp:400,maxHp:560,x:100,y:0,charterId:'junk-jamboree'};
  const watch = {id:'watch',team:0,kind:'watch',factionId:'thorn-court',progress:1,hp:300,maxHp:390,x:0,y:100,charterId:'impossible-housing'};
  const moot = {id:'moot',team:0,kind:'moot',factionId:'thorn-court',progress:1,hp:500,maxHp:650,x:150,y:120,charterId:'volunteer-seance'};
  const excluded = [
    {id:'clock',team:0,kind:'command',factionId:'thorn-court',progress:1,hp:900,maxHp:1700,x:80,y:80},
    {id:'work',team:0,kind:'wonderwork',factionId:'thorn-court',progress:1,hp:500,maxHp:820,x:90,y:90,charterId:'junk-jamboree'},
    {id:'enemy',team:2,kind:'borough',factionId:'boo-brigade',progress:1,hp:200,maxHp:560,x:120,y:0,charterId:'junk-jamboree'},
    {id:'far',team:0,kind:'borough',factionId:'thorn-court',progress:1,hp:200,maxHp:560,x:700,y:0,charterId:'junk-jamboree'},
    {id:'unfinished',team:0,kind:'borough',factionId:'thorn-court',progress:.5,hp:200,maxHp:560,x:130,y:0,charterId:'junk-jamboree'},
    {id:'full',team:0,kind:'borough',factionId:'thorn-court',progress:1,hp:560,maxHp:560,x:140,y:0,charterId:'junk-jamboree'}
  ];
  const pulse = SYS.districtConversionPulse(gate,[gate,market,watch,moot,...excluded]);
  assert.equal(pulse.conversionId,'briarway-gatehouse');
  assert.equal(pulse.period,8);
  assert.equal(pulse.range,520);
  assert.equal(pulse.networkBonus,1.45);
  assert.ok(Math.abs(pulse.amount-20.3)<1e-9);
  assert.deepEqual(pulse.targets.map(item=>item.id).sort(),['market','moot','watch']);
  assert.equal(SYS.districtConversionPulse({...gate,progress:.9},[gate,market]),null);
});

test('Spectral Census files one deterministic bridge frontier within four hops and quickens through mixed charters', () => {
  const bureau = {id:'bureau',team:0,kind:'watch',factionId:'boo-brigade',progress:1,hp:390,maxHp:390,x:0,y:0,charterId:'pumpkin-market'};
  const web = [
    {id:'junk',team:0,kind:'borough',factionId:'boo-brigade',progress:1,hp:560,maxHp:560,x:60,y:30,charterId:'junk-jamboree'},
    {id:'housing',team:0,kind:'moot',factionId:'boo-brigade',progress:1,hp:650,maxHp:650,x:120,y:30,charterId:'impossible-housing'},
    {id:'volunteers',team:0,kind:'bridgehead',factionId:'boo-brigade',progress:1,hp:760,maxHp:760,x:180,y:30,charterId:'volunteer-seance'}
  ];
  const anchors = [0,200,400,600,800,1000].map((x,index)=>({id:'a'+index,name:'Roof '+index,x,y:0}));
  const links = [[0,1],[1,2],[2,3],[3,4],[4,5]];
  const explored = {'0:2':true,'0:5':true};
  const pulse = SYS.districtCensusPulse(bureau,[bureau,...web],anchors,links,explored);
  assert.equal(pulse.conversionId,'spectral-census-bureau');
  assert.equal(pulse.maxHops,4);
  assert.equal(pulse.networkBonus,1.45);
  assert.ok(Math.abs(pulse.period-11/1.45)<1e-9);
  assert.equal(pulse.target.id,'a3');
  assert.deepEqual(pulse.path.map(anchor=>anchor.id),['a0','a1','a2','a3']);
  const bounded = SYS.districtCensusPulse(bureau,[bureau,...web],anchors,links,{...explored,'0:7':true,'0:10':true});
  assert.equal(bounded.target,null);
  assert.equal(SYS.districtCensusPulse({...bureau,progress:.9},[bureau,...web],anchors,links,{}),null);
  assert.equal(SYS.districtCensusPulse({...bureau,hp:0},[bureau,...web],anchors,links,{}),null);
});

test('strategic knowledge keeps own districts and public Clocks while excluding fog-hidden rival districts', () => {
  const buildings = [
    {id:'rival-home',team:2,kind:'command',x:1000,y:0,hp:1700},
    {id:'rival-bureau',team:2,kind:'watch',x:900,y:0,hp:390},
    {id:'player-clock',team:0,kind:'command',x:0,y:0,hp:1700},
    {id:'filed-market',team:0,kind:'borough',x:400,y:0,hp:560},
    {id:'hidden-watch',team:0,kind:'watch',x:640,y:0,hp:390},
    {id:'fallen-rival',team:2,kind:'borough',x:800,y:0,hp:0}
  ];
  const known = SYS.strategicKnownBuildings(buildings,2,{'0:5':true});
  assert.deepEqual(known.map(item=>item.id),['rival-home','rival-bureau','player-clock','filed-market']);
});

test('rival forward expansion uses Wonderworks first and the faction conversion afterward', () => {
  assert.equal(SYS.rivalExpansionKind('thorn-court',[],2),'wonderwork');
  const thornWorks=[1,2].map(index=>({id:'w'+index,team:2,kind:'wonderwork',factionId:'thorn-court',progress:1,hp:800}));
  assert.equal(SYS.rivalExpansionKind('thorn-court',thornWorks,2),'bridgehead');
  const clockWorks=[1,2].map(index=>({id:'c'+index,team:2,kind:'wonderwork',factionId:'clockwork-coven',progress:1,hp:700}));
  assert.equal(SYS.rivalExpansionKind('clockwork-coven',clockWorks,2),'borough');
  const moonwakeWorks=[1,2].map(index=>({id:'m'+index,team:2,kind:'wonderwork',factionId:'moonwake-corsairs',progress:1,hp:740}));
  assert.equal(SYS.rivalExpansionKind('moonwake-corsairs',moonwakeWorks,2),'moot');
  const booWorks=[1,2].map(index=>({id:'b'+index,team:2,kind:'wonderwork',factionId:'boo-brigade',progress:1,hp:690}));
  assert.equal(SYS.rivalExpansionKind('boo-brigade',booWorks,2),'watch');
  const mobWorks=[1,2].map(index=>({id:'p'+index,team:2,kind:'wonderwork',factionId:'once-upon-a-mob',progress:1,hp:720}));
  assert.equal(SYS.rivalExpansionKind('once-upon-a-mob',mobWorks,2),'watch');
  const lanternWorks=[1,2].map(index=>({id:'l'+index,team:2,kind:'wonderwork',factionId:'lantern-republic',progress:1,hp:760}));
  assert.equal(SYS.rivalExpansionKind('lantern-republic',lanternWorks,2),'borough');
  const graveyardWorks=[1,2].map(index=>({id:'g'+index,team:2,kind:'wonderwork',factionId:'graveyard-shift',progress:1,hp:850}));
  assert.equal(SYS.rivalExpansionKind('graveyard-shift',graveyardWorks,2),'borough');
});
