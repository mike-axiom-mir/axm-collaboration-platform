#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const Fabric = require('../shared/capability-fabric/index.js');
const Cli = require('../tools/capability-fabric/cli.js');
const Nursery = require('../tools/detached-candidate-nursery/core/nursery-core.js');

let passed=0;
function check(condition,label){assert(condition,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function safeRemove(root){const resolved=path.resolve(root),prefix=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(prefix)||!path.basename(resolved).startsWith('axm-capability-fabric-test-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});}

function main(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-capability-fabric-test-'));
  try{
    const catalog=Fabric.loadCatalog();
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../tools/capability-fabric/manifest.json'),'utf8'));
    const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'../tools/capability-fabric/module.contract.json'),'utf8'));
    const html=fs.readFileSync(path.join(__dirname,'../tools/capability-fabric/index.html'),'utf8');
    const app=fs.readFileSync(path.join(__dirname,'../tools/capability-fabric/app.js'),'utf8');
    check(manifest.schema==='axm.tool-manifest/v1'&&manifest.kind==='product','tool manifest uses modern product schema');
    check(manifest.status==='EXPERIMENTAL'&&manifest.installed===false&&manifest.promoted===false,'tool authority remains explicitly detached');
    check(manifest.permissions.length===0&&contract.permissions.length===0,'normal compiler needs no permissions');
    check(contract.boundaries.refuses.includes('generated code execution'),'contract refuses generated-code execution');
    check(contract.boundaries.refuses.includes('Foundation mutation')&&contract.boundaries.refuses.includes('CANON change'),'contract refuses Foundation and CANON mutation');
    check(html.includes('Capability Fabric')&&html.includes('ONE CANDIDATE DEFAULT'),'human workbench exposes the intended build model');
    check(html.includes('/shared/capability-fabric/core.js')&&html.includes('/shared/deterministic-organ-fabric/core.js'),'workbench visibly reuses deterministic Organ kernel');
    check(!/openai|anthropic|gemini|api[_ -]?key/i.test(app),'browser workbench has no provider or credential path');
    new Function(app);check(true,'browser workbench script parses');

    const packageDigests=[];
    catalog.recipes.forEach(function(recipe){
      const request=Fabric.sealRequest(recipe.exampleRequest,true),first=Fabric.build(request,catalog),second=Fabric.build(request,catalog),candidate=first.candidates[0];
      check(first.status==='COMPLETE',recipe.id+' focused build completes');
      check(Fabric.canonicalJson(first)===Fabric.canonicalJson(second),recipe.id+' complete build receipt is deterministic');
      check(first.candidates.length===1,recipe.id+' creates one candidate by default');
      check(Fabric.verifyCandidate(candidate).ok,recipe.id+' package verification passes');
      check(candidate.files['index.html'].includes('executes no generated capability code'),recipe.id+' candidate inspection entry stays static');
      new Function(candidate.files['capability.js']);new Function(candidate.files['selftest.js']);check(true,recipe.id+' emitted JavaScript parses');
      const materialized=Cli.materialize(candidate,root);check(materialized.nursery.status==='READY_FOR_LATER_INTAKE',recipe.id+' materializes as Nursery-ready structure');
      check(materialized.nursery.codeExecuted===false,recipe.id+' Nursery scan executes no candidate code');
      const run=childProcess.spawnSync(process.execPath,[path.join(materialized.directory,'selftest.js')],{encoding:'utf8'});check(run.status===0&&/PASS/.test(run.stdout),recipe.id+' emitted selftest passes when explicitly run by trusted test host');
      packageDigests.push(candidate.package.packageDigest);
      assert.throws(function(){Cli.materialize(candidate,root);},function(error){return error&&error.receipt&&error.receipt.code==='OUTPUT_OVERWRITE_REFUSED';});passed+=1;process.stdout.write('PASS '+recipe.id+' refuses overwrite of exact materialization\n');
    });
    check(new Set(packageDigests).size===3,'three capability families produce distinct packages');
    const registry=Nursery.scanSupply(root);check(registry.summary.total===3&&registry.summary.readyForLaterIntake===3,'Nursery independently sees all three exact candidates ready for later intake');
    check(registry.truth.candidateCodeExecuted===false&&registry.truth.installationPerformed===false,'Nursery proves scan-only authority boundary');

    const request=Fabric.sealRequest(catalog.recipes[0].exampleRequest,true),candidate=Fabric.build(request,catalog).candidates[0],tampered=Fabric.clone(candidate);tampered.files['module-bundle.json']=tampered.files['module-bundle.json'].replace('pure-json-transform','changed-transform');
    check(!Fabric.verifyCandidate(tampered).ok,'bundle tampering fails package verification');
    check(Cli.safeFilePath(root,'safe.json')===path.join(root,'safe.json'),'CLI accepts safe child paths');
    assert.throws(function(){Cli.safeFilePath(root,'../escape.json');});passed+=1;process.stdout.write('PASS CLI refuses traversal paths\n');
    process.stdout.write('Capability Fabric package test PASS · '+passed+' checks\n');
  }finally{safeRemove(root);}
}

main();
