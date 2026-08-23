#!/usr/bin/env node
'use strict';

const assert=require('assert');
const childProcess=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const Fabric=require('../shared/deterministic-organ-fabric/core.js');
const Creative=require('../shared/deterministic-organ-fabric/selected-creative-production-route-organ.js');
const Contract=require('../shared/deterministic-organ-fabric/selected-creative-production-route-organ.contract.json');
const Machine=require('../tools/deterministic-organ-fabric/machine.js');

let checks=0;
function check(condition,label){assert.equal(Boolean(condition),true,label);checks+=1;}
function throwsCode(fn,code,label){let error=null;try{fn();}catch(caught){error=caught;}check(error&&error.code===code,label);}

(async function(){
  const inspection=Creative.inspect();
  check(inspection.packageVerified&&inspection.packageDigest===Contract.selection.packageDigest,'selected creative package rebuilds and verifies');
  check(inspection.selectionDigest===Contract.selection.selectionDigest&&!inspection.generatedCodeExecuted,'selected creative lineage is exact and generated code stays unloaded');

  const visual=Creative.plan({medium:'visual',delivery:'web',accessibility:['keyboard-review','alt-text-check','alt-text-check']});
  check(visual.productionPlan.route.includes('human-review')&&visual.productionPlan.route.includes('alt-text-check'),'visual route includes human and accessibility review');
  check(visual.productionPlan.validators.includes('contrast')&&visual.productionPlan.validators.includes('alt-text-present'),'visual route exposes mechanical validators');
  check(visual.productionPlan.fallbacks.includes('static-poster')&&visual.productionPlan.fallbacks.includes('text-alternative'),'web route exposes accessible fallbacks');
  check(visual.openHumanJudgments.length===2&&!visual.authority.assetGenerated&&!visual.authority.validatorsExecuted&&!visual.authority.humanReviewPerformed,'human judgments and execution boundaries remain explicit');
  check(Creative.verify(visual).ok,'visual output rebuilds identically');

  const reordered=Creative.plan({delivery:'web',accessibility:['alt-text-check','keyboard-review'],medium:'visual'});
  check(reordered.outputDigest===visual.outputDigest,'reordered and duplicated accessibility inputs normalize identically');

  const audio=Creative.plan({medium:'audio',delivery:'live',accessibility:['transcript-check','caption-check']});
  check(audio.productionPlan.route.includes('listening-review')&&audio.productionPlan.validators.includes('peak-level'),'audio route keeps listening review separate from peak validation');
  check(audio.productionPlan.fallbacks.includes('pre-rendered-playback')&&audio.productionPlan.fallbacks.includes('caption-file'),'live audio route exposes bounded fallbacks');
  check(Creative.verify(audio).ok,'audio output rebuilds identically');

  throwsCode(function(){Creative.plan({medium:'visual',delivery:'web',accessibility:[],surprise:true});},'CREATIVE_BRIEF_UNKNOWN_FIELD','unknown brief fields are refused');
  throwsCode(function(){Creative.plan({medium:'video',delivery:'web',accessibility:[]});},'INPUT_SCHEMA_REFUSAL','unknown media are refused by the selected definition');
  throwsCode(function(){Creative.plan({medium:'visual',delivery:'web',accessibility:['']});},'CREATIVE_BRIEF_TYPE_INVALID','empty accessibility tokens are refused');

  const tamperedContract=Fabric.clone(Contract);tamperedContract.selection.packageDigest='sha256:'+'0'.repeat(64);
  throwsCode(function(){Creative.inspect({contract:tamperedContract});},'SELECTED_CREATIVE_ORGAN_PACKAGE_DRIFT','package lineage drift is refused');
  const tamperedOutput=Fabric.clone(visual);tamperedOutput.productionPlan.route.push('claim-quality');
  check(!Creative.verify(tamperedOutput).ok,'tampered creative output fails deterministic verification');

  const machine=await Machine.run({action:'creative.production.plan-selected',input:{brief:{medium:'audio',delivery:'live',accessibility:['caption-check']}}});
  check(machine.ok&&machine.output.productionPlan.validators.includes('peak-level'),'machine adapter uses the trusted selected creative organ');
  check(!machine.generatedCodeExecuted&&!machine.assetGenerated&&!machine.validatorsExecuted&&!machine.humanReviewPerformed&&!machine.wroteState,'machine adapter preserves every creative authority boundary');
  const machineInspection=await Machine.run({action:'creative.production.inspect-selected'});
  check(machineInspection.ok&&machineInspection.inspection.packageVerified&&!machineInspection.generatedCodeExecuted&&!machineInspection.assetGenerated,'machine adapter exposes pure creative admission inspection');

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'selected-creative-route-'));
  try{
    const briefFile=path.join(temp,'brief.json');fs.writeFileSync(briefFile,JSON.stringify({medium:'visual',delivery:'print',accessibility:['alt-text-check']}));
    const cli=childProcess.spawnSync(process.execPath,['tools/deterministic-organ-fabric/cli.js','plan-selected-creative','--brief',briefFile],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
    check(cli.status===0,'CLI selected creative route exits successfully');
    const parsed=JSON.parse(cli.stdout);
    check(parsed.productionPlan.fallbacks.includes('high-contrast-proof')&&parsed.productionPlan.fallbacks.includes('plain-text-copy'),'CLI returns the exact print fallbacks');
    check(!parsed.authority.assetGenerated&&!parsed.authority.installed&&!parsed.authority.canonChanged,'CLI output grants no asset, install, or CANON authority');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}

  console.log('Selected Creative Production route test PASS · '+checks+' checks');
})().catch(function(error){console.error(error);process.exitCode=1;});
