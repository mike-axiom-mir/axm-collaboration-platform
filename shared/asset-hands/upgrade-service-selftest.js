#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Client=require('./upgrade-client');
const server=fs.readFileSync(path.join(__dirname,'..','..','server.js'),'utf8');
assert(server.includes('const AssetHands = require("./shared/asset-hands/asset-hands")'));
assert(server.includes('"/api/asset-hands/upgrades"'));
assert(server.includes('AssetHands.listUpgradeHands()'));
assert(server.includes('"/api/asset-hands/substrates"'));
assert(server.includes('AssetHands.externalSubstrateInventory()'));
assert(server.includes('AssetHands.diagnoseUpgradeWithInstalledSubstrates(input || {})'));
assert(server.includes('AssetHands.planUpgradeHandsWithInstalledSubstrates(input || {})'));
assert(server.includes('AssetHands.auditInstalledUpgradeHands()'));
const canvas={medium:'screen',dimensions:{width:32,height:32,unit:'px'},colour:{space:'srgb',transparency:'allowed'},behaviour:['static'],intended_use:'icon'};
function response(body){return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(body)});}
Promise.all([
  Client.list(()=>response({ok:true,hands:new Array(50).fill({})})),
  Client.diagnose({required_capabilities:['asset.vector.bezier-edit'],target_canvas:canvas},(url,options)=>{assert.equal(url,Client.BASE+'/diagnose');assert.equal(options.method,'POST');return response({ok:true,result:{schema:'axm.asset-hand-upgrade-result/v1',status:'READY_CONTRACT'}});}),
  Client.plan({required_capabilities:['asset.vector.bezier-edit'],target_canvas:canvas},(url)=>{assert.equal(url,Client.BASE+'/plan');return response({ok:true,result:{schema:'axm.asset-hand-upgrade-result/v1',status:'READY_CONTRACT',route_plan:[]}});}),
  Client.audit(()=>response({ok:true,audit:{schema:'axm.asset-hand-upgrade-audit/v1',total:50}})),
  Client.substrates((url)=>{assert.equal(url,Client.SUBSTRATE_BASE);return response({ok:true,inventory:{schema:'axm.external-substrate-inventory/v1',available_substrates:[]}});}),
]).then((values)=>{assert.equal(values[0].length,50);assert.equal(values[1].status,'READY_CONTRACT');assert(Array.isArray(values[2].route_plan));assert.equal(values[3].total,50);assert.equal(values[4].schema,'axm.external-substrate-inventory/v1');console.log('Asset Hands upgrade service PASS (browser-safe list, diagnose, plan, audit and substrate transport)');}).catch((error)=>{console.error(error.stack);process.exitCode=1;});
