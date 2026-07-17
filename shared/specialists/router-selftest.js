#!/usr/bin/env node
'use strict';
const assert=require('assert'),R=require('./specialist-router');
let rec=R.recommend({task:'Fix mobile controller lag and crashes in game 003, then verify the repair.',modelCapabilities:{nativeVision:false,nativeToolCalling:false,strictJson:false,largeContext:false,needsScreenObservation:true,needsVisualComposition:false}});assert.equal(R.validate(rec).ok,true);assert.equal(rec.truth.automaticCheckout,false);assert.equal(rec.truth.automaticSkillActivation,false);assert.ok(rec.recommendations.some(x=>x.specialist.profileId==='failure'));assert.ok(rec.recommendations.some(x=>x.specialist.profileId==='implementation'||x.specialist.profileId==='validation'));assert.ok(rec.recommendations.some(x=>x.capabilityBridges.selected.some(s=>s.id==='screen-scout-loop')));
rec=R.recommend({task:'Check collision tunnelling and timestep convergence in the physics simulation.'});assert.ok(rec.recommendations.some(x=>x.specialist.category==='Physics & Simulation'));assert.equal(rec.recommendations.length,3);
rec=R.recommend({task:'Something unclear that needs a sensible starting point.'});assert.ok(rec.recommendations.length>=1&&rec.recommendations.length<=3);assert.ok(rec.recommendations.every(x=>x.confidenceStatus==='HEURISTIC_NON_EVIDENCE'));
assert.throws(()=>R.recommend({task:''}),/task is required/);
console.log('Specialist Router selftest: PASS (ranked proposals, model bridge preview, explicit no-auto boundary)');
