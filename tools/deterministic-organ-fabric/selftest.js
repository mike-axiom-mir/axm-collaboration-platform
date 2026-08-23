'use strict';

const assert = require('assert');
const Machine = require('./machine.js');
const Shared = require('../../shared/deterministic-organ-fabric/selftest.js');

(async function(){
  const fields=await Machine.run({action:'fields.list'});assert.equal(fields.ok,true);assert.equal(fields.fields.length,3);
  const selected=await Machine.run({action:'verification.route.plan-selected',input:{brief:{changeType:'code',risk:4,affectedSurfaces:['organ-runtime','fabric-archive','mirror-passive-receiver']}}});assert.equal(selected.ok,true);assert.equal(selected.output.plan.output.route.includes('archive-reload'),true);assert.equal(selected.output.plan.output.route.includes('sender-receiver-parity'),true);assert.equal(selected.generatedCodeExecuted,false);assert.equal(selected.checksExecuted,false);assert.equal(selected.wroteState,false);
  const forbidden=await Machine.run({action:'promote'});assert.equal(forbidden.refused,true);assert.equal(forbidden.promoted,false);assert.equal(forbidden.canonChanged,false);
  console.log('Deterministic Organ Fabric tool selftest PASS · 11 checks');
})().catch(function(error){console.error(error);process.exitCode=1;});
