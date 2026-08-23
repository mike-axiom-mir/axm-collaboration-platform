'use strict';

const assert = require('assert');
const Machine = require('./machine.js');
const Shared = require('../../shared/deterministic-organ-fabric/selftest.js');

(async function(){
  const fields=await Machine.run({action:'fields.list'});assert.equal(fields.ok,true);assert.equal(fields.fields.length,3);
  const forbidden=await Machine.run({action:'promote'});assert.equal(forbidden.refused,true);assert.equal(forbidden.promoted,false);assert.equal(forbidden.canonChanged,false);
  console.log('Deterministic Organ Fabric tool selftest PASS · 6 checks');
})().catch(function(error){console.error(error);process.exitCode=1;});
