'use strict';
const assert=require('assert'),Audit=require('./envelope-audit');
const tools=[
  {id:'studio',accepts:['image/*'],produces:['image/png']},
  {id:'film-motion-studio',accepts:['image/*','audio/*'],produces:['image/png']},
  {id:'audio-studio',accepts:['audio/*'],produces:['audio/*']},
  {id:'knowledge-canvas',accepts:['text/csv'],produces:['axm.knowledge-project-handoff/v1']},
  {id:'project-room',accepts:['axm.knowledge-project-handoff/v1'],produces:['axm.project-room/v1']}
];
const result=Audit.audit(tools,{services:{}});assert.equal(result.ok,true);assert.equal(result.criticalRoutes.every(x=>x.pass),true);assert.ok(result.routeCount>=4);
const broken=JSON.parse(JSON.stringify(tools));broken.find(x=>x.id==='knowledge-canvas').produces=['axm.wrong/v1'];assert.equal(Audit.audit(broken,{services:{}}).ok,false);
console.log('AXM Artifact Envelope Audit selftest: PASS (four critical cross-workspace canaries and schema-drift detection)');
