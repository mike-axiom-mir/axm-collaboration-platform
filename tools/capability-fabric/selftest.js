#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Machine = require('./machine.js');
const Fabric = require('../../shared/capability-fabric/index.js');

(async function(){
  const catalog=Fabric.loadCatalog(),request=Fabric.sealRequest(catalog.recipes[0].exampleRequest,true);
  const list=await Machine.run({action:'catalog.list'});assert(list.ok&&list.catalog.recipes.length===3);
  const valid=await Machine.run({action:'request.validate',input:{request:request}});assert(valid.ok);
  const plan=await Machine.run({action:'build.plan',input:{request:request}});assert(plan.ok&&plan.plan.status==='READY');
  const built=await Machine.run({action:'build.run',input:{request:request}});assert(built.ok&&built.run.generatedCodeExecuted===false);
  const verified=await Machine.run({action:'package.verify',input:{candidate:built.run.candidates[0]}});assert(verified.ok);
  const forbidden=await Machine.run({action:'filesystem.write'});assert(!forbidden.ok&&forbidden.refused&&forbidden.code==='FORBIDDEN_ACTION');
  const activate=await Machine.run({action:'recipe.activate'});assert(!activate.ok&&activate.code==='FORBIDDEN_ACTION');
  const unsupported=await Machine.run({action:'surprise'});assert(!unsupported.ok&&unsupported.code==='UNSUPPORTED_ACTION');
  process.stdout.write('Capability Fabric tool selftest PASS · 8 checks\n');
})().catch(function(error){console.error(error.stack||error);process.exitCode=1;});
