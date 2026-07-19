#!/usr/bin/env node
'use strict';

const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const Hands=require('./asset-hands');
const Core=require('./asset-hand-core');
const KTX2=require('./ktx2-codec');
const Raster=require('./raster-codec');
const ArtifactSchemas=require('./artifact-schema-catalog');
const Fabric=require('../../tools/asset-fabric/fabric-core');
const vendorManifest=require('./vendor/basis-universal/AXM-VENDOR-MANIFEST.json');

const createdAt='2000-01-01T00:00:00.000Z';
const host={capabilities:['svg','json','canvas-2d'],permissions:[],accepts:[Hands.RESULT_SCHEMA,'image/svg+xml','image/png','image/ktx2','application/json']};

function brief(id,overrides={}) {
  const target=overrides.target_canvas||{};
  return {
    id,title:id,kind:overrides.kind||'texture',operation_mode:overrides.operation_mode||'create',intended_use:overrides.intended_use||'texture',
    target_canvas:{schema:Hands.TARGET_CANVAS_SCHEMA,medium:target.medium||'game-world',dimensions:target.dimensions||{width:64,height:32,unit:'px'},colour:target.colour||{space:'srgb',transparency:'opaque'},physical:target.physical||{repeat:{mode:'none'}},behaviour:target.behaviour||['static'],performance:target.performance||{max_mip_levels:4},intended_use:target.intended_use||overrides.intended_use||'texture'},
    source_artifacts:overrides.source_artifacts||[],required_outputs:overrides.required_outputs||['image/ktx2'],editable_recipe_formats:overrides.editable_recipe_formats||['axm.ktx2-texture-recipe/v1'],quality_requirements:overrides.quality_requirements||{require_preview:true,require_validation:true,require_editable_source:true,minimum_quality_score:0}
  };
}
function artifact(result,mime){return result.artifacts.find(item=>item.mime===mime);}
function bytes(result){return KTX2.bytesFromDataUrl(artifact(result,'image/ktx2').dataUrl,'image/ktx2');}
function sha256(filename){return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');}

async function run(){
  assert(Hands.list().length>=19);
  assert(Hands.list().some(hand=>hand.id==='ktx2-texture-delivery'));
  assert(Hands.listMissingHands().length<=15);
  assert.equal(Hands.getMissingHand('ktx2-texture-delivery'),null);
  assert.equal(KTX2.BASIS_VERSION,'2.10-final-snapshot');
  assert.equal(KTX2.BASIS_COMMIT,'1aab02ba2df16ad873229030ea191ea8c10e3fc9');

  for(const entry of vendorManifest.files){
    const filename=path.join(__dirname,'vendor','basis-universal',entry.path);
    assert.equal(fs.statSync(filename).size,entry.bytes,entry.path+' byte count changed');
    assert.equal(sha256(filename),entry.sha256,entry.path+' hash changed');
  }

  const tileBrief=brief('ktx2-tile',{intended_use:'ground-tile',target_canvas:{dimensions:{width:64,height:32,unit:'px'},colour:{space:'srgb',transparency:'opaque'},physical:{repeat:{mode:'xy',width:16,height:8}},behaviour:['static','tileable'],performance:{max_mip_levels:4,max_texture_memory_bytes:4096},intended_use:'ground-tile'}});
  const diagnosis=Hands.diagnose(tileBrief,host);
  assert.equal(diagnosis.status,'READY');
  assert(diagnosis.compatible_hands.some(hand=>hand.id==='ktx2-texture-delivery'));
  const result=await Hands.createAsync('ktx2-texture-delivery',tileBrief,{seed:'ktx2-proof',createdAt,host});
  assert.equal(result.status,'READY');
  assert.equal(result.technical.pass,true);
  assert.deepEqual(result.target_canvas.physical.repeat,{mode:'xy',width:16,height:8});
  assert.equal(result.creation_recipe.parameters.texture.mip_levels,4,'mip constraint must reach the hand recipe');
  assert.equal(result.creation_recipe.parameters.texture.tileable,true,'tileability must shape generation');
  const primary=artifact(result,'image/ktx2'),preview=artifact(result,'image/png');
  assert(primary&&preview);
  assert.equal(primary.format,'KTX2');
  assert.equal(primary.text,'');
  assert(!/^<svg/.test(primary.text||''));
  assert(/^data:image\/ktx2;base64,/.test(primary.dataUrl));
  assert(/^data:image\/png;base64,iVBORw0KGgo/.test(preview.dataUrl));
  assert.equal(Core.validateResult(result).pass,true);

  const parsed=KTX2.inspect(bytes(result));
  assert.equal(parsed.pass,true);
  assert.equal(parsed.supercompressionName,'BasisLZ');
  assert.equal(parsed.levelCount,4);
  assert.equal(parsed.width,64);assert.equal(parsed.height,32);
  const decoded=await KTX2.validate(bytes(result),{includePixels:true});
  assert.equal(decoded.pass,true);
  assert.equal(decoded.module.isEtc1s,true);
  assert.equal(decoded.module.isUastc,false);
  assert.equal(decoded.module.isSrgb,true);
  assert.equal(decoded.module.decodedByteLength,64*32*4);
  assert.equal(decoded.module.rgba.length,64*32*4);

  const recipe=JSON.parse(result.artifacts.find(item=>item.metadata&&item.metadata.schema==='axm.ktx2-texture-recipe/v1').text);
  const report=JSON.parse(result.artifacts.find(item=>item.metadata&&item.metadata.schema==='axm.ktx2-validation-report/v1').text);
  assert.equal(ArtifactSchemas.validate(recipe.schema,recipe).pass,true);
  assert.equal(ArtifactSchemas.validate(report.schema,report).pass,true);
  assert.equal(recipe.encoder.commit,KTX2.BASIS_COMMIT);
  assert.equal(report.decoder.accepted,true);
  assert.equal(report.container.supercompression,'BasisLZ');

  const deterministic=await Hands.verifyDeterminismAsync('ktx2-texture-delivery',tileBrief,{seed:'ktx2-determinism',createdAt,host});
  assert.equal(deterministic.pass,true,'same canvas and seed must emit byte-identical KTX2 and receipts');
  assert.throws(()=>Hands.create('ktx2-texture-delivery',tileBrief,{seed:'sync-refusal',createdAt,host}),/asynchronous create API/);

  const linear=await Hands.createAsync('ktx2-texture-delivery',brief('linear',{target_canvas:{dimensions:{width:32,height:32,unit:'px'},colour:{space:'linear-srgb',transparency:'opaque'},behaviour:['static'],performance:{max_mip_levels:3}}}),{seed:'linear',createdAt,host});
  assert.equal(linear.status,'READY');
  assert.equal((await KTX2.validate(bytes(linear))).module.isSrgb,false,'linear-sRGB request must change the KTX2 DFD transfer declaration');

  const alpha=await Hands.createAsync('ktx2-texture-delivery',brief('alpha',{target_canvas:{dimensions:{width:32,height:32,unit:'px'},colour:{space:'srgb',transparency:'required'},behaviour:['static'],performance:{max_mip_levels:2}}}),{seed:'alpha',createdAt,host});
  assert.equal(alpha.status,'READY');
  assert.equal((await KTX2.validate(bytes(alpha))).module.hasAlpha,true);
  assert.equal(alpha.measures.gpuTarget,'ETC2_RGBA');

  const mipFitted=await Hands.createAsync('ktx2-texture-delivery',brief('memory-fit',{target_canvas:{dimensions:{width:128,height:128,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{max_mip_levels:8,max_texture_memory_bytes:9000}}}),{seed:'memory-fit',createdAt,host});
  assert.equal(mipFitted.status,'READY');
  assert.equal(mipFitted.measures.mipLevels,1,'GPU budget must reduce the mip chain before encoding');
  assert(mipFitted.measures.gpuBytes<=9000);

  const impossible=await Hands.createAsync('ktx2-texture-delivery',brief('memory-impossible',{target_canvas:{dimensions:{width:128,height:128,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{max_mip_levels:8,max_texture_memory_bytes:100}}}),{seed:'memory-impossible',createdAt,host});
  assert.equal(impossible.status,'HOLD');
  assert(impossible.technical.errors.includes('gpu-memory-budget'),'impossible texture-memory requests must fail honestly');

  const original=bytes(result);
  const badIdentifier=original.slice();badIdentifier[0]=0;
  assert.equal(KTX2.inspect(badIdentifier).pass,false);
  assert(KTX2.inspect(badIdentifier).errors.includes('KTX2 identifier mismatch'));
  const badLevelRange=original.slice();new DataView(badLevelRange.buffer,badLevelRange.byteOffset,badLevelRange.byteLength).setUint32(80,0xffffffff,true);
  assert.equal(KTX2.inspect(badLevelRange).pass,false);
  assert(KTX2.inspect(badLevelRange).errors.some(error=>/level 0 exceeds/.test(error)));
  const badDfd=original.slice();new DataView(badDfd.buffer,badDfd.byteOffset,badDfd.byteLength).setUint32(48,0xffffffff,true);
  assert.equal(KTX2.inspect(badDfd).pass,false);
  const corruptPayload=original.slice(),level0=parsed.levels[0];corruptPayload.fill(0,level0.byteOffset,level0.byteOffset+level0.byteLength);
  const corruptValidation=await KTX2.validate(corruptPayload);
  assert.equal(corruptValidation.pass,false,'the pinned decoder must reject a corrupted ETC1S payload');

  const validateBrief=brief('validate-existing',{operation_mode:'validate',target_canvas:tileBrief.target_canvas,source_artifacts:[{id:'source-ktx2',role:'source',name:'Source KTX2',mime:'image/ktx2',format:'KTX2',dataUrl:primary.dataUrl,editable:false,metadata:{tileable:true}}],quality_requirements:{require_preview:false,require_validation:true,require_editable_source:true}});
  const validated=await Hands.createAsync('ktx2-texture-delivery',validateBrief,{seed:'validate-existing',createdAt,host});
  assert.equal(validated.status,'READY');
  assert.equal(validated.creation_recipe.operation_mode,'validate');

  const raster=Hands.create('raster-texture',brief('png-source',{required_outputs:['image/png'],editable_recipe_formats:['axm.native-raster-recipe/v1'],target_canvas:{dimensions:{width:32,height:32,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{}}}),{seed:'png-source',createdAt,host});
  const png=artifact(raster,'image/png');
  const finished=await Hands.createAsync('ktx2-texture-delivery',brief('finish-png',{operation_mode:'finish',target_canvas:{dimensions:{width:32,height:32,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{max_mip_levels:3}},source_artifacts:[{id:'source-png',role:'source',name:'Source PNG',mime:'image/png',format:'PNG',dataUrl:png.dataUrl,editable:false}]}),{seed:'finish-png',createdAt,host});
  assert.equal(finished.status,'READY');
  assert.equal(finished.creation_recipe.operation_mode,'finish');

  const edited=await Hands.createAsync('ktx2-texture-delivery',brief('edit-ktx2',{operation_mode:'edit',target_canvas:{dimensions:{width:32,height:16,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{max_mip_levels:3}},source_artifacts:[{id:'edit-source',role:'source',name:'Editable delivery',mime:'image/ktx2',format:'KTX2',dataUrl:primary.dataUrl,editable:false}]}),{seed:'edit-ktx2',createdAt,host});
  assert.equal(edited.status,'READY');
  assert.equal(edited.measures.width,32);assert.equal(edited.measures.height,16);

  const legacySvg=Hands.create('vector-form',{id:'legacy-after-async',title:'Legacy after async',kind:'icon',width:64,height:64},{seed:'legacy-after-async',createdAt,host});
  assert.equal(legacySvg.status,'READY');
  assert(legacySvg.artifacts.some(item=>item.mime==='image/svg+xml'&&item.format==='SVG'));
  const oldState=Fabric.baseState();oldState.version='0.1';delete oldState.routeIssues;
  const normalizedOldState=Fabric.normalizeState(oldState);
  assert.equal(normalizedOldState.schema,Fabric.STATE_SCHEMA);
  assert(Array.isArray(normalizedOldState.routeIssues),'old Asset Fabric state must remain readable');

  console.log('Asset Hands KTX2 selftest PASS (real ETC1S/BasisLZ, mips, colour, alpha, budgets, tamper, determinism, finish/edit/validate, old-state compatibility)');
}

if(require.main===module)run().catch(error=>{console.error(error);process.exit(1);});
module.exports={run};
