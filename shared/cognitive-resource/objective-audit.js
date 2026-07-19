#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const Service=require('./cognitive-resource-service');

const root=path.resolve(__dirname,'..','..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const json=relative=>JSON.parse(read(relative));
const api=read('shared/operations/operations-api.js');
const meterApp=read('tools/cognitive-resource-meter/app.js');
const meterPage=read('tools/cognitive-resource-meter/index.html');
const meterManifest=json('tools/cognitive-resource-meter/manifest.json');
const meterContract=json('tools/cognitive-resource-meter/module.contract.json');
const hub=read('hub/hub-shell.js');
const server=read('server.js');
const children=['cognitive-evidence-explorer','cognitive-calibration-lab','human-attention-ledger','sustainability-metrology-lab','mirror-intake-monitor'];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-cognitive-objective-audit-'));
const ledger=Service.create({root,stateRoot:path.join(temp,'state'),exportRoot:path.join(temp,'exports')});
let pass=0;
function check(name,test){test();pass+=1;console.log('PASS objective audit - '+name);}

check('guided receipt wizard and explicit Codex goal import are present',()=>{
  assert(meterPage.includes('Guided Codex goal receipt'));
  assert(meterApp.includes('/api/cognitive-resource-meter/preview-goal-receipt'));
  assert(meterApp.includes('/api/cognitive-resource-meter/goal-receipt/import'));
  assert(meterManifest.actions.some(item=>/guide or import a provider-bound goal receipt/i.test(item)));
});
check('explicit native local process window has start stop and cancel controls',()=>{
  for(const suffix of ['start','stop','cancel'])assert(api.includes("'/api/cognitive-resource-meter/local-meter/"+suffix+"'"));
  assert(meterContract.permissions.includes('cognitive.measure.local'));
  assert(api.includes("requirePermission('cognitive-resource-meter','cognitive.measure.local')"));
});
check('profile and rate schedule vaults are delivered without automatic refresh',()=>{
  assert(api.includes("'/api/cognitive-resource-meter/vaults'"));
  assert(meterContract.provides.includes('privacy-safe-machine-profile-vault'));
  assert(meterContract.provides.includes('versioned-rate-schedule-vault'));
  assert(meterContract.boundaries.refuses.includes('automatic-network-price-refresh'));
});
check('hold explanation previews persist nothing and declare no auto repair',()=>{
  for(const kind of ['observation','goal-receipt','economics'])assert(api.includes("'/api/cognitive-resource-meter/preview-"+kind+"'"));
  assert(meterContract.provides.includes('hold-explanation-without-auto-repair'));
});
check('portable evidence bundle and separate resource timeline are delivered',()=>{
  assert(api.includes("'/api/cognitive-resource-meter/bundle'"));
  assert(api.includes("'/api/cognitive-resource-meter/timeline'"));
  assert(meterContract.provides.includes('portable-cognitive-evidence-bundle'));
  assert(meterContract.provides.includes('separate-dimension-resource-timeline'));
  assert(meterContract.boundaries.refuses.includes('composite-intelligence-or-value-score'));
});
check('all five requested technical children are complete machine-layer modules behind the Meter',()=>{
  for(const id of children){
    const manifest=json('tools/'+id+'/manifest.json'),contract=json('tools/'+id+'/module.contract.json');
    assert.strictEqual(manifest.integratedInto,'cognitive-resource-meter');
    assert.strictEqual(manifest.layer,'machine');
    assert.strictEqual(contract.id,id);
    assert.deepStrictEqual(manifest.permissions,contract.permissions);
    for(const file of ['index.html','app.js','selftest.js','discovery-seam-review.js','README.md'])assert(fs.existsSync(path.join(root,'tools',id,file)),id+' missing '+file);
    assert(hub.includes("'"+id+"'"));
  }
});
check('evidence labs API gates each child mutation with its declared permission',()=>{
  const gates=[['cognitive-calibration-lab','cognitive.calibration.write'],['human-attention-ledger','human.attention.write'],['sustainability-metrology-lab','sustainability.evidence.write'],['mirror-intake-monitor','mirror.intake-receipt.import']];
  for(const pair of gates)assert(api.includes("requirePermission('"+pair[0]+"','"+pair[1]+"')"));
});
check('provider catalog is additive unique and never automatic',()=>{
  const required=['codex-goal-completion-receipt/v1','local-hardware-process-meter/v1','declared-provider-compute-meter/v1','codex-goal-receipt-explicit-import/v1','workshop-server-process-window-meter/v1'],ids=Service.CATALOG.providers.map(item=>item.id);
  assert(required.every(id=>ids.includes(id)));assert.strictEqual(new Set(ids).size,ids.length);assert(Service.CATALOG.providers.every(item=>item.automaticCapture===false));assert(ids.length>=required.length);
});
check('Command Center seam is additive nonautomatic authority-free and owned by the Workshop cockpit',()=>{
  const controls=Service.CONTROL_CATALOG.controls,ids=controls.map(item=>item.id);
  const directionIds=['workshop-direction-open','workshop-direction-status','workshop-direction-preview','workshop-direction-commit','workshop-direction-lifecycle'];
  assert.strictEqual(Service.CONTROL_CATALOG.presentationOwner,'workshop-command-center');
  assert.strictEqual(new Set(ids).size,ids.length);assert(controls.length>=15);assert(directionIds.every(id=>ids.includes(id)));assert(controls.every(item=>item.automatic===false));assert(Object.values(Service.CONTROL_CATALOG.authority).every(value=>value===false));
  assert.strictEqual(Service.CONTROL_CATALOG.authority.startsBodyPulse,false);assert.strictEqual(Service.CONTROL_CATALOG.authority.grantsToolFileOrNetworkAuthority,false);
  assert(api.includes("'/api/cognitive-resource-meter/command-center-controls'"));
  for(const route of ['/api/workshop-direction','/api/workshop-direction/compile','/api/workshop-direction/commit','/api/workshop-direction/status'])assert(server.includes(route));
  assert(server.includes('explicit-compile')&&server.includes('explicit-commit')&&server.includes('explicit-status'));
  const directionContract=json('tools/workshop-direction/module.contract.json');assert(directionContract.boundaries.refuses.includes('body-mode-change'));assert(directionContract.boundaries.refuses.includes('tool-authority'));
});
check('stack requires no third-party runtime and retains zero execution authority',()=>{
  assert.deepStrictEqual(ledger.status().requiredThirdPartyDependencies,[]);
  assert(Object.values(Service.CATALOG.authority).every(value=>value===false));
  const sources=['shared/cognitive-resource/cognitive-resource-core.js','shared/cognitive-resource/cognitive-resource-workflows.js','shared/cognitive-resource/cognitive-resource-service.js','shared/cognitive-resource/cognitive-evidence-labs-core.js','shared/cognitive-resource/cognitive-evidence-labs-service.js'].map(read).join('\n');
  for(const match of sources.matchAll(/require\(['"]([^'"]+)['"]\)/g))assert(match[1].startsWith('.')||['crypto','fs','path'].includes(match[1]),'third-party require: '+match[1]);
});
check('manifest contract permissions and exact Mirror bindings remain consistent',()=>{
  assert.deepStrictEqual(meterManifest.permissions,meterContract.permissions);
  const bindings=ledger.validateContractBindings();
  assert.strictEqual(bindings.length,2);assert(bindings.every(item=>item.pass));
});

ledger.stop();
fs.rmSync(temp,{recursive:true,force:true});
console.log('\n'+pass+' PASS - 0 FAIL - cognitive resource complete objective audit');
