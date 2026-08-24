'use strict';
const assert=require('assert'),r=require('./registry');
const all=r.all(),again=r.all();
assert.strictEqual(all,again,'registry must keep one immutable process snapshot');
assert.ok(Object.isFrozen(all));
let signalRoundTrips=0;
function expectPreferred(result,organId,label){assert.strictEqual(result.result,'MATCHED',label);assert.strictEqual(result.organ.organId,organId,label);signalRoundTrips++}
for(const o of all){
  assert.ok(Object.isFrozen(o),`organ must be frozen: ${o.organId}`);
  assert.ok(Object.isFrozen(o.detect),`detect must be frozen: ${o.organId}`);
  for(const b of o.detect.base)expectPreferred(r.detect({filePath:b,preferredOrganId:o.organId}),o.organId,`basename ${b}`);
  for(const x of o.detect.path)expectPreferred(r.detect({filePath:`probe${x}probe`,preferredOrganId:o.organId}),o.organId,`path ${x}`);
  for(const e of o.detect.ext)expectPreferred(r.detect({filePath:`probe${e}`,preferredOrganId:o.organId}),o.organId,`extension ${e}`);
  for(const s of o.detect.shebang)expectPreferred(r.detect({filePath:'probe',firstLine:`#!/usr/bin/env -S ${s} --probe`,preferredOrganId:o.organId}),o.organId,`shebang ${s}`);
}
assert.strictEqual(r.getByLanguageId('python').organId,'code.organ.python.v1');
assert.strictEqual(r.getByLanguageId('not-a-language'),null);
assert.strictEqual(r.detect({filePath:'SRC/MAIN.PY'}).organ.organId,'code.organ.python.v1');
assert.strictEqual(r.detect({filePath:'DOCKERFILE'}).organ.organId,'code.organ.docker.v1');
assert.strictEqual(r.detect({filePath:'dockerfile'}).organ.organId,'code.organ.docker.v1');
assert.strictEqual(r.detect({filePath:'.github\\workflows\\CI.YML'}).organ.organId,'code.organ.github-actions.v1');
assert.strictEqual(r.detect({filePath:'probe',firstLine:'#!/usr/bin/env -S python3 -u'}).organ.organId,'code.organ.python.v1');
assert.strictEqual(r.detect({filePath:'x.schema.json'}).organ.organId,'code.organ.json-schema.v1');
assert.strictEqual(r.detect({filePath:'app/templates/config.yml'}).organ.organId,'code.organ.yaml.v1');
assert.strictEqual(r.detect({filePath:'charts/app/templates/deploy.yml'}).organ.organId,'code.organ.helm-templates.v1');
assert.strictEqual(r.detect({filePath:'src/main.py',preferredOrganId:'code.organ.rust.v1'}).result,'PREFERRED_ORGAN_NOT_CANDIDATE');
assert.strictEqual(r.detect({filePath:'src/main.py',preferredOrganId:'code.organ.does-not-exist.v1'}).result,'UNKNOWN_PREFERRED_ORGAN');
assert.strictEqual(r.plan({organId:'code.organ.python.v1',requestedStages:'parse'}).result,'INVALID_STAGES');
assert.strictEqual(r.plan({organId:'code.organ.python.v1',requestedStages:['parse','not-a-stage']}).result,'UNKNOWN_STAGE');
const audit=r.signalAudit(),extAmbiguity=new Map(audit.ambiguities.ext.map(x=>[x.signal,x.organIds]));
for(const signal of ['.m','.v']){assert.ok(extAmbiguity.has(signal),`expected ${signal} ambiguity`);assert.strictEqual(r.detect({filePath:`probe${signal}`}).result,'SELECTION_REQUIRED')}
for(const item of audit.ambiguities.ext){const result=r.detect({filePath:`probe${item.signal}`});assert.strictEqual(result.result,'SELECTION_REQUIRED',`duplicate exact extension must not guess: ${item.signal}`)}
const snap=r.snapshot(),snap2=r.snapshot();
assert.strictEqual(snap.organCount,102);assert.strictEqual(snap.familyCount,23);assert.match(snap.snapshotSha256,/^[a-f0-9]{64}$/);assert.strictEqual(snap.snapshotSha256,snap2.snapshotSha256);assert.ok(Object.isFrozen(snap));
const pythonPlan=r.plan({organId:'code.organ.python.v1',requestedStages:r.STAGES});
assert.strictEqual(pythonPlan.registrySnapshotDigest,snap.snapshotSha256);assert.strictEqual(pythonPlan.authority.toolExecution,false);assert.strictEqual(pythonPlan.authority.workspaceMutation,false);
console.log(JSON.stringify({ok:true,organCount:all.length,signalRoundTrips,extensionAmbiguities:audit.ambiguities.ext.length,basenameAmbiguities:audit.ambiguities.base.length,pathAmbiguities:audit.ambiguities.path.length,shebangAmbiguities:audit.ambiguities.shebang.length,snapshotSha256:snap.snapshotSha256,authority:'NONE'},null,2));
