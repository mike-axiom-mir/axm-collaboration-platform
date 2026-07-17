'use strict';
const assert=require('assert'),B=require('./artifact-handoff-broker');
const tools=[
  {id:'studio',name:'Studio',produces:['image/png','image/svg+xml'],accepts:['image/*']},
  {id:'film',name:'Film',produces:['video/mp4'],accepts:['image/*','audio/*']},
  {id:'audio',name:'Audio',produces:['audio/wav'],accepts:['audio/*']},
  {id:'project',name:'Project Room',produces:['axm.project/v1'],accepts:['axm.handoff/v1']},
  {id:'legacy-film',name:'Legacy Film',integratedInto:'film',destinationId:'film',destinationName:'Film',accepts:['image/png'],produces:['video/mp4']}
];
assert.equal(B.match('image/png','image/*'),'wildcard');assert.equal(B.match('image/png','image/png'),'exact');assert.equal(B.match('image/png','audio/*'),null);
const destinations=B.compatible(tools,'studio','image/png');assert.ok(destinations.some(x=>x.destinationId==='film'));assert.ok(!destinations.some(x=>x.destinationId==='project'));
assert.throws(()=>B.compatible(tools,'studio','video/mp4'),/does not declare/);
const p=B.proposal(tools,{sourceId:'studio',artifactKind:'image/png',destinationId:'film',artifactId:'poster-1'});assert.equal(B.validate(p).ok,true);assert.equal(p.state,'REVIEW_REQUIRED');assert.equal(p.truth.artifactDataCopied,false);assert.equal(p.truth.automaticImport,false);
assert.throws(()=>B.proposal(tools,{sourceId:'studio',artifactKind:'image/png',destinationId:'project'}),/compatible/);
console.log('AXM Artifact Handoff Broker selftest: PASS (declared formats, exact/wildcard matching, explicit proposal and zero copied data)');
