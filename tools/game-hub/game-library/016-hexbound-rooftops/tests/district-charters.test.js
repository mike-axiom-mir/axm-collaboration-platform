#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

function near(actual, expected, epsilon) { assert.ok(Math.abs(actual-expected) <= (epsilon || .0001), actual+' ~= '+expected); }

test('four district charters expose different automatic macro economies', () => {
  assert.equal(DATA.CHARTERS.length,4);
  assert.equal(new Set(DATA.CHARTERS.map(item=>item.id)).size,4);
  assert.equal(new Set(DATA.CHARTERS.map(item=>item.key)).size,4);
  const base=SYS.incomeFor([], 'clockwork-coven');
  const market=SYS.incomeFor([{id:'m',team:0,kind:'watch',progress:1,hp:100,x:0,y:0,charterId:'pumpkin-market'}],'clockwork-coven');
  const junk=SYS.incomeFor([{id:'j',team:0,kind:'watch',progress:1,hp:100,x:0,y:0,charterId:'junk-jamboree'}],'clockwork-coven');
  const housing=SYS.incomeFor([{id:'h',team:0,kind:'watch',progress:1,hp:100,x:0,y:0,charterId:'impossible-housing'}],'clockwork-coven');
  near(market.glow-base.glow,.95); near(junk.scrap-base.scrap,.84); assert.equal(housing.cap-base.cap,45);
});

test('nearby different charters form a bounded wonderweb bonus', () => {
  const market={id:'m',team:0,kind:'borough',progress:1,hp:100,x:0,y:0,charterId:'pumpkin-market'};
  const different={id:'j',team:0,kind:'watch',progress:1,hp:100,x:300,y:0,charterId:'junk-jamboree'};
  const housing={id:'h',team:0,kind:'moot',progress:1,hp:100,x:0,y:300,charterId:'impossible-housing'};
  const seance={id:'s',team:0,kind:'bridgehead',progress:1,hp:100,x:300,y:300,charterId:'volunteer-seance'};
  assert.equal(SYS.districtNetworkBonus(market,[market,different]),1.15);
  assert.equal(SYS.districtNetworkBonus(market,[market,{...different,id:'m2',charterId:'pumpkin-market'}]),1);
  assert.equal(SYS.districtNetworkBonus(market,[market,different,housing,seance]),1.45);
  near(SYS.districtCharterEffects(market,[market,different]).glow,.95*1.15);
  near(SYS.districtCharterEffects(seance,[market,different,housing,seance]).musterSeconds,32/1.45);
});

test('legacy unchartered districts retain their original income contract', () => {
  const buildings=[{team:0,kind:'borough',progress:1},{team:0,kind:'borough',progress:1}];
  const income=SYS.incomeFor(buildings,'clockwork-coven');
  near(income.glow,4.9); near(income.scrap,3.828); assert.equal(income.cap,560);
  assert.equal(SYS.districtCharterEffects(buildings[0],buildings).musterSeconds,Infinity);
});
