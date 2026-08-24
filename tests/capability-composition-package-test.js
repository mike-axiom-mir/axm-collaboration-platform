#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const childProcess=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Fabric=require('../shared/capability-fabric/index.js');
const Cli=require('../tools/capability-fabric/cli.js');
const Machine=require('../tools/capability-fabric/machine.js');
const Nursery=require('../tools/detached-candidate-nursery/core/nursery-core.js');
const Foundry=require('../tools/capability-recipe-foundry/foundry-core.js');

let passed=0;
function check(value,label){assert(value,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function safeRemove(root){const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('axm-capability-composition-test-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});}

(async function main(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-capability-composition-test-'));
  try{
    const catalog=Fabric.loadCatalog(),request=Fabric.exampleComposition(catalog,true),build=Fabric.buildComposition(request,catalog);
    const toolRoot=path.join(__dirname,'../tools/capability-fabric'),schemaRoot=path.join(__dirname,'../shared/capability-fabric/schemas');
    const manifest=JSON.parse(fs.readFileSync(path.join(toolRoot,'manifest.json'),'utf8')),contract=JSON.parse(fs.readFileSync(path.join(toolRoot,'module.contract.json'),'utf8'));
    check(manifest.status==='EXPERIMENTAL'&&manifest.installed===false&&manifest.promoted===false,'Capability Fabric remains experimental and detached');
    check(manifest.actions.some(function(row){return /composition/i.test(row);})&&contract.provides.includes('deterministic-capability-composition'),'tool contracts expose deterministic composition explicitly');
    const historicalAdapterRequest=Fabric.sealRequest(Foundry.exampleAdapter().recipe.exampleRequest,true),historicalAdapterPlan=Fabric.planBuild(historicalAdapterRequest,catalog);
    check(historicalAdapterPlan.status==='READY'&&historicalAdapterPlan.recipeRef.version==='0.2.0'&&historicalAdapterPlan.recipeRef.builderId==='closed-object-contract-adapter-v2','historical request shape can resolve only the strict active v2 adapter, never the inactive v1 builder');
    const heldCompositionDraft=Fabric.clone(request);heldCompositionDraft.nodes[0].request=historicalAdapterRequest;const heldCompositionRequest=Fabric.sealCompositionRequest(heldCompositionDraft,true),heldAdapterComposition=Fabric.buildComposition(heldCompositionRequest,catalog);
    check(heldAdapterComposition.status==='HELD'&&heldAdapterComposition.nodes.length===0&&heldAdapterComposition.holds.some(function(row){return row.code==='EDGE_TARGET_CONTRACT_MISSING';})&&heldAdapterComposition.holds.some(function(row){return row.code==='INPUT_UNBOUND';}),'composition with an incompatible adapter contract fails graph binding and emits no partial node candidates');
    ['composition-request.schema.json','composition-plan.schema.json','composition-build.schema.json','composition-verification.schema.json','composition-node-packages.schema.json','composition-materialization-receipt.schema.json'].forEach(function(file){JSON.parse(fs.readFileSync(path.join(schemaRoot,file),'utf8'));passed+=1;process.stdout.write('PASS '+file+' parses\n');});
    new Function(fs.readFileSync(path.join(__dirname,'../shared/capability-fabric/composition-core.js'),'utf8'));check(true,'composition core parses');

    const validated=await Machine.run({action:'composition.validate',input:{request:request}});check(validated.ok,'machine door validates the exact composition request');
    const planned=await Machine.run({action:'composition.plan',input:{request:request}});check(planned.ok&&planned.plan.order.join(',')==='transform,review','machine door returns the deterministic DAG order');
    const built=await Machine.run({action:'composition.build',input:{request:request}});check(built.ok&&built.build.generatedCodeExecuted===false&&built.build.nodeTestsExecuted===false,'machine door builds detached nodes without execution');
    const verified=await Machine.run({action:'composition.verify',input:{build:built.build}});check(verified.ok,'machine door verifies the exact composition rebuild');
    const forbidden=await Machine.run({action:'composition.execute',input:{build:built.build}});check(!forbidden.ok&&forbidden.code==='FORBIDDEN_ACTION','machine door refuses composition execution');

    const requestFile=path.join(root,'composition-request.json'),cliOutput=path.join(root,'cli-output');fs.writeFileSync(requestFile,JSON.stringify(request,null,2)+'\n',{flag:'wx'});fs.mkdirSync(cliOutput);
    const cliPlan=childProcess.spawnSync(process.execPath,[path.join(toolRoot,'cli.js'),'compose-plan','--request',requestFile],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:20000,windowsHide:true});
    check(cliPlan.status===0&&JSON.parse(cliPlan.stdout).status==='READY','CLI composition planner accepts the exact sealed request');
    const cliBuild=childProcess.spawnSync(process.execPath,[path.join(toolRoot,'cli.js'),'compose-build','--request',requestFile,'--output-parent',cliOutput],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:20000,windowsHide:true});
    check(cliBuild.status===0&&JSON.parse(cliBuild.stdout).nodeCount===2,'CLI composition build materializes two verified nodes through its public command');

    check(build.status==='COMPLETE'&&Fabric.verifyComposition(build,catalog).state==='PASS','composition build is complete and independently verified before materialization');
    const materialized=Cli.materializeComposition(build,root,catalog);
    check(materialized.nursery.total===2&&materialized.nursery.readyForLaterIntake===2&&materialized.nursery.codeExecuted===false,'materialized composition contains two Nursery-ready detached nodes');
    const rootNames=fs.readdirSync(materialized.directory).sort();
    check(['composition-plan.json','composition-request.json','composition.receipt.json','node-packages.json'].every(function(file){return rootNames.includes(file);}), 'composition root carries exact request, plan, receipt, and package index');
    const receipt=JSON.parse(fs.readFileSync(path.join(materialized.directory,'composition.receipt.json'),'utf8')),receiptBody=Fabric.clone(receipt),packageIndex=JSON.parse(fs.readFileSync(path.join(materialized.directory,'node-packages.json'),'utf8')),packageIndexBody=Fabric.clone(packageIndex);delete receiptBody.receiptDigest;delete packageIndexBody.nodePackagesDigest;
    check(receipt.receiptDigest===Fabric.digest(receiptBody)&&receipt.buildDigest===build.buildDigest&&packageIndex.nodePackagesDigest===Fabric.digest(packageIndexBody)&&receipt.nodePackagesDigest===packageIndex.nodePackagesDigest,'materialization receipt is digest-bound to the exact composition build and node-package index');
    const nodeFolders=fs.readdirSync(materialized.directory,{withFileTypes:true}).filter(function(row){return row.isDirectory();}).map(function(row){return row.name;}).sort();
    check(nodeFolders.length===2&&nodeFolders.some(function(row){return row.startsWith('transform-');})&&nodeFolders.some(function(row){return row.startsWith('review-');}),'composition materializes one owned folder per graph node');
    nodeFolders.forEach(function(folder){
      const directory=path.join(materialized.directory,folder),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8')),selftest=manifest.capabilityKind==='SKILL'?'skill.selftest.js':'selftest.js';
      const run=childProcess.spawnSync(process.execPath,[path.join(directory,selftest)],{cwd:directory,encoding:'utf8',timeout:10000,windowsHide:true});
      check(run.status===0&&/PASS/.test(run.stdout),folder+' node selftest passes only from the explicit trusted host');
    });
    assert.throws(function(){Cli.materializeComposition(build,root,catalog);},function(error){return error&&error.receipt&&error.receipt.code==='OUTPUT_OVERWRITE_REFUSED';});passed+=1;process.stdout.write('PASS composition materialization refuses overwrite\n');
    const tampered=Fabric.clone(build);tampered.nodes[0].candidate.files['module.contract.json']+='\n';delete tampered.buildDigest;tampered.buildDigest=Fabric.digest(tampered);
    check(Fabric.verifyComposition(tampered,catalog).state==='FAIL','composition verification detects rehashed node-package drift');

    const rollbackParent=path.join(root,'rollback');fs.mkdirSync(rollbackParent);const originalScan=Nursery.scanSupply;let rollbackError=null;
    try{Nursery.scanSupply=function(){return {summary:{total:2,readyForLaterIntake:0},truth:{candidateCodeExecuted:false}};};Cli.materializeComposition(build,rollbackParent,catalog);}catch(error){rollbackError=error;}finally{Nursery.scanSupply=originalScan;}
    check(rollbackError&&rollbackError.receipt&&rollbackError.receipt.code==='NURSERY_HOLD'&&fs.readdirSync(rollbackParent).length===0,'failed composition intake rolls back only its fresh owned directory');
    process.stdout.write('Capability Composition package test PASS · '+passed+' checks\n');
  }finally{safeRemove(root);}
})().catch(function(error){console.error(error.stack||error);process.exitCode=1;});
