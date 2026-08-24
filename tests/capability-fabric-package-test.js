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
function pythonInvocation(args){
  const configured=process.env.AXM_PYTHON||process.env.PYTHON;
  if(configured)return {command:configured,args:args};
  return process.platform==='win32'?{command:'py',args:['-3'].concat(args)}:{command:'python3',args:args};
}

function main(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-capability-fabric-test-'));
  try{
    const nurseryRoot=path.join(root,'nursery'),executionRoot=path.join(root,'execution');fs.mkdirSync(nurseryRoot);fs.mkdirSync(executionRoot);
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
    check(html.includes('/shared/capability-fabric/core.js')&&html.includes('/shared/capability-fabric/composition-core.js')&&html.includes('/shared/capability-fabric/builder-registry.js')&&html.includes('/shared/deterministic-organ-fabric/core.js'),'workbench visibly reuses deterministic Organ kernel, modular builder registry, and composition core');
    check(!/openai|anthropic|gemini|api[_ -]?key/i.test(app),'browser workbench has no provider or credential path');
    new Function(app);check(true,'browser workbench script parses');

    const packageDigests=[];
    catalog.recipes.forEach(function(recipe){
      const request=Fabric.sealRequest(recipe.exampleRequest,true),first=Fabric.build(request,catalog),second=Fabric.build(request,catalog),candidate=first.candidates[0];
      check(first.status==='COMPLETE',recipe.id+' focused build completes');
      check(Fabric.canonicalJson(first)===Fabric.canonicalJson(second),recipe.id+' complete build receipt is deterministic');
      check(first.candidates.length===1,recipe.id+' creates one candidate by default');
      check(Fabric.verifyCandidate(candidate).ok,recipe.id+' package verification passes');
      const modular=JSON.parse(candidate.files['modular-capability.contract.json']);
      check(candidate.package.capabilityKind===recipe.capabilityKind&&modular.kind===recipe.capabilityKind&&modular.installed===false&&modular.promoted===false&&modular.canon===false,recipe.id+' candidate binds its modular kind without authority');
      check(candidate.files['index.html'].includes('executes no generated capability code'),recipe.id+' candidate inspection entry stays static');
      const runtime=modular.runtime,sourceLanguage=recipe.capabilityKind==='HAND'?(runtime.sourceLanguage||'javascript'):'javascript',entryFile=recipe.capabilityKind==='HAND'?(runtime.entry||'capability.js'):null,selftestFile=recipe.capabilityKind==='HAND'?(runtime.selftest||'selftest.js'):'skill.selftest.js';
      if(recipe.capabilityKind==='HAND'&&sourceLanguage==='javascript'){new Function(candidate.files[entryFile]);new Function(candidate.files[selftestFile]);}
      else if(recipe.capabilityKind==='HAND'){check(sourceLanguage==='python'&&entryFile.endsWith('.py')&&selftestFile.endsWith('.py'),recipe.id+' binds an exact supported non-JavaScript runtime layout');}
      else{check(typeof candidate.files['SKILL.md']==='string'&&JSON.parse(candidate.files['skill.contract.json']).runtimeMode==='HOST_MEDIATED',recipe.id+' emits its portable host-mediated skill contract');}
      if(sourceLanguage==='javascript'){new Function(candidate.files[selftestFile]);check(true,recipe.id+' emitted JavaScript source parses');}
      const materialized=Cli.materialize(candidate,nurseryRoot);check(materialized.nursery.status==='READY_FOR_LATER_INTAKE',recipe.id+' materializes as Nursery-ready structure');
      check(materialized.nursery.codeExecuted===false,recipe.id+' Nursery scan executes no candidate code');
      const executionDirectory=path.join(executionRoot,recipe.id);fs.cpSync(materialized.directory,executionDirectory,{recursive:true});
      const executionRelative=path.relative(nurseryRoot,executionDirectory);check(executionRelative.startsWith('..'+path.sep)&&!path.isAbsolute(executionRelative),recipe.id+' trusted-test execution copy is disjoint from detached Nursery source');
      if(sourceLanguage==='python'){
        const parse=pythonInvocation(['-c','import ast, pathlib, sys; [ast.parse(pathlib.Path(item).read_text(encoding="utf-8"), filename=item) for item in sys.argv[1:]]',path.join(executionDirectory,entryFile),path.join(executionDirectory,selftestFile)]),parsed=childProcess.spawnSync(parse.command,parse.args,{cwd:executionDirectory,encoding:'utf8',timeout:10000});
        check(parsed.status===0,recipe.id+' emitted Python source and selftest parse through the declared runtime family');
      }
      const selftestPath=path.join(executionDirectory,selftestFile),invocation=sourceLanguage==='python'?pythonInvocation([selftestPath]):{command:process.execPath,args:[selftestPath]};
      const run=childProcess.spawnSync(invocation.command,invocation.args,{cwd:executionDirectory,encoding:'utf8',timeout:10000});check(run.status===0&&/PASS/.test(run.stdout),recipe.id+' emitted selftest passes when explicitly run by trusted test host');
      packageDigests.push(candidate.package.packageDigest);
      assert.throws(function(){Cli.materialize(candidate,nurseryRoot);},function(error){return error&&error.receipt&&error.receipt.code==='OUTPUT_OVERWRITE_REFUSED';});passed+=1;process.stdout.write('PASS '+recipe.id+' refuses overwrite of exact materialization\n');
    });
    check(new Set(packageDigests).size===9,'nine capability recipes produce distinct packages');
    const registry=Nursery.scanSupply(nurseryRoot);check(registry.summary.total===9&&registry.summary.readyForLaterIntake===9,'Nursery independently sees all nine exact candidates ready for later intake after disjoint trusted tests');
    check(registry.truth.candidateCodeExecuted===false&&registry.truth.installationPerformed===false,'Nursery proves scan-only authority boundary');

    const tamperRecipe=catalog.recipes.find(function(row){return row.id==='pure-json-transform';}),request=Fabric.sealRequest(tamperRecipe.exampleRequest,true),candidate=Fabric.build(request,catalog).candidates[0],tampered=Fabric.clone(candidate);tampered.files['module-bundle.json']=tampered.files['module-bundle.json'].replace('pure-json-transform','changed-transform');
    check(!Fabric.verifyCandidate(tampered).ok,'bundle tampering fails package verification');
    const rollbackParent=path.join(root,'rollback-proof');fs.mkdirSync(rollbackParent);const originalScan=Nursery.scanSupply;let rollbackError=null;
    try{Nursery.scanSupply=function(){return {candidates:[]};};Cli.materialize(candidate,rollbackParent);}catch(error){rollbackError=error;}finally{Nursery.scanSupply=originalScan;}
    check(rollbackError&&rollbackError.receipt&&rollbackError.receipt.code==='NURSERY_HOLD'&&fs.readdirSync(rollbackParent).length===0,'failed Nursery intake rolls back only the fresh candidate directory');
    check(Cli.safeFilePath(root,'safe.json')===path.join(root,'safe.json'),'CLI accepts safe child paths');
    assert.throws(function(){Cli.safeFilePath(root,'../escape.json');});passed+=1;process.stdout.write('PASS CLI refuses traversal paths\n');
    process.stdout.write('Capability Fabric package test PASS · '+passed+' checks\n');
  }finally{safeRemove(root);}
}

main();
