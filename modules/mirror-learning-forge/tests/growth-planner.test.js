'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Growth=require('../core/growth-planner');
test('forecast exposes exponential pressure and bounded authority',()=>{const r=Growth.project({starting_sessions:10,session_growth_factor:2,cycles:12});assert.equal(r.rows[11].uncapped.sessions,20480);assert.equal(r.rows[11].bounded.sessions,1000);assert.equal(r.rows[11].bounded.promotions,1);assert.ok(Math.abs(r.doubling_time_cycles-1)<1e-9);});
test('seed stage never unlocks larger vocabulary automatically',()=>{const s=Growth.stage({models:{},episodes:{},applications:{}});assert.equal(s.name,'SEED');assert.equal(s.limits.max_vocab,512);assert.equal(s.unlock_is_automatic,false);});
const {makeForge}=require('./helpers');
test('forge exposes forecast without changing state or authority',()=>{const {forge,cleanup}=makeForge();try{const before=forge.status();const r=forge.growthForecast({starting_sessions:10,session_growth_factor:1.6,cycles:12});const after=forge.status();assert.equal(r.truth.forecast_is_scenario_not_prediction,true);assert.equal(before.revision,after.revision);assert.equal(before.authority_revision,after.authority_revision);}finally{cleanup();}});
