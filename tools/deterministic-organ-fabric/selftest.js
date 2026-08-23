'use strict';

const assert = require('assert');
const Machine = require('./machine.js');
const Shared = require('../../shared/deterministic-organ-fabric/selftest.js');

(async function(){
  const fields=await Machine.run({action:'fields.list'});assert.equal(fields.ok,true);assert.equal(fields.fields.length,3);
  const selected=await Machine.run({action:'verification.route.plan-selected',input:{brief:{changeType:'code',risk:4,affectedSurfaces:['organ-runtime','fabric-archive','mirror-passive-receiver']}}});assert.equal(selected.ok,true);assert.equal(selected.output.plan.output.route.includes('archive-reload'),true);assert.equal(selected.output.plan.output.route.includes('sender-receiver-parity'),true);assert.equal(selected.generatedCodeExecuted,false);assert.equal(selected.checksExecuted,false);assert.equal(selected.wroteState,false);
  const creative=await Machine.run({action:'creative.production.plan-selected',input:{brief:{medium:'visual',delivery:'web',accessibility:['keyboard-review','alt-text-check']}}});assert.equal(creative.ok,true);assert.equal(creative.output.productionPlan.route.includes('human-review'),true);assert.equal(creative.output.productionPlan.validators.includes('contrast'),true);assert.equal(creative.output.productionPlan.fallbacks.includes('text-alternative'),true);assert.equal(creative.generatedCodeExecuted,false);assert.equal(creative.assetGenerated,false);assert.equal(creative.validatorsExecuted,false);assert.equal(creative.humanReviewPerformed,false);assert.equal(creative.wroteState,false);
  const forbidden=await Machine.run({action:'promote'});assert.equal(forbidden.refused,true);assert.equal(forbidden.promoted,false);assert.equal(forbidden.canonChanged,false);
  console.log('Deterministic Organ Fabric tool selftest PASS · 20 checks');
})().catch(function(error){console.error(error);process.exitCode=1;});
