'use strict';
const assert=require('assert'),Index=require('./workshop-capability-index');
const modules=[
  {id:'studio',name:'AXM Studio',folder:'studio',entry:'index.html',summary:'Draw paint edit photos design UI and make skins.',actions:['draw an image'],accepts:['image/*'],produces:['axm.studio/v1'],readiness:['storage'],tags:['drawing','ui','image'],audience:'human'},
  {id:'skinner',name:'Skinner',folder:'skinner',summary:'Skin production.',tags:['skin'],audience:'machine',integratedInto:'studio'},
  {id:'audio-studio',name:'Audio Studio',folder:'audio-studio',summary:'Music sound Foley synth and MIDI.',tags:['audio','music']},
  {id:'ai-team',name:'AI Team',folder:'ai-team',summary:'Agents prompts models and collaboration.',tags:['ai','agents']}
];
let r=Index.search(modules,'I want to make a song');assert.equal(r[0].destinationId,'audio-studio');
r=Index.search(modules,'design a skin');assert.equal(r[0].destinationId,'studio');assert.ok(r.some(x=>x.id==='skinner'&&x.integratedInto==='studio'));
r=Index.search(modules,'compare prompts for my agents');assert.equal(r[0].destinationId,'ai-team');
const report=Index.report(modules);assert.equal(report.total,4);assert.equal(report.integrated,1);assert.equal(report.withAuthoredActions,1);assert.equal(report.withArtifactEnvelope,1);assert.equal(report.withReadinessEnvelope,1);assert.equal(report.truth.opensAutomatically,false);assert.equal(report.truth.changesPermissions,false);
assert.deepEqual(Index.search(modules,'music'),Index.search(modules,'music'),'matching must be deterministic');
console.log('AXM Workshop Capability Index selftest: PASS (plain-language intent, integrated destinations, deterministic shared index and no automatic action)');
