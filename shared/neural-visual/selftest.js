const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./neural-visual-core');
const Raster = require('../asset-hands/raster-codec');

async function run(){
  ['service.contract.json','neural-visual-request.schema.json','neural-visual-result.schema.json','visual-stack-draft.schema.json'].forEach((name)=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')));
  const request = Core.normalizeRequest({operation:'relight',prompt:'Warm window light with readable silhouettes',strength:.4,seed:'test',source_draft_digest:'fnv1a32-source',target_canvas:{width:2,height:2,colour_space:'srgb',alpha:true}});
  assert.equal(request.ai_dependent,true);
  assert.equal(request.authority,'candidate-only');
  assert.equal(Core.requestDigest(request),Core.requestDigest(request));
  const requestSha = await Core.requestSha256(request);
  assert.match(requestSha,/^sha256-[a-f0-9]{64}$/);
  assert.throws(()=>Core.normalizeRequest({...request,operation:'invent-unbounded-reality'}),/unsupported neural operation/);

  const png = Raster.encodeRgba(2,2,new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),{colourSpace:'srgb'});
  const sha = await Core.sha256(png.dataUrl);
  const result = {schema:Core.RESULT_SCHEMA,version:'1.0.0',status:'PROPOSED',request_digest:requestSha,provider:{id:'test-provider',model:'test-model',receipt_id:'receipt-1'},artifact:{id:'candidate-png',mime:'image/png',width:2,height:2,sha256:sha,data_url:png.dataUrl},claims:['provider-created candidate'],ai_dependent:true,authority:'candidate-only',visual_approval:false,canonical:false};
  const checked = await Core.verifyResult(result,request);
  assert.equal(checked.pass,true,checked.errors.join('; '));
  assert.deepEqual(Core.inspectImage(png.dataUrl).width,2);
  assert.equal((await Core.verifyResult({...result,request_digest:'wrong'},request)).pass,false);
  assert.equal((await Core.verifyResult({...result,artifact:{...result.artifact,width:3}},request)).pass,false);
  assert.equal((await Core.verifyResult({...result,artifact:{...result.artifact,sha256:'0'.repeat(64)}},request)).pass,false);
  assert.equal((await Core.verifyResult({...result,visual_approval:true},request)).pass,false);

  const draft = Core.addNeuralResult(Core.newDraft({title:'Stack'}),result);
  assert.equal(draft.layers.length,2);
  assert.equal(draft.layers[1].origin.kind,'ai-provider-proposal');
  assert.equal(draft.visual_approval,false);
  assert.equal(draft.canonical,false);
  const recipe = Core.toRasterRecipe(draft);
  assert.equal(recipe.schema,'axm.raster-composition/v1');
  assert.equal(recipe.layers.length,2);
  assert.equal(recipe.layers[1].source_artifact_id,'candidate-png');
  assert(!JSON.stringify(recipe).includes('data:image/png'));
  console.log('AXM Neural Visual seam selftest PASS (provider required, exact request + PNG SHA/dimension binding, candidate-only stack, deterministic compositor handoff)');
}
run().catch((error)=>{console.error(error);process.exitCode=1;});
