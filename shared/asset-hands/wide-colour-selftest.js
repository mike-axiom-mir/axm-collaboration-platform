#!/usr/bin/env node
'use strict';
const assert=require('assert'),crypto=require('crypto');
const Hands=require('./asset-hands'),Core=require('./asset-hand-core'),Raster=require('./raster-codec'),Colour=require('./colour-codec'),Schemas=require('./artifact-schema-catalog');
const createdAt='2026-07-19T00:00:00Z',host={capabilities:['json'],permissions:[],accepts:[Hands.RESULT_SCHEMA,'image/png','application/json']};
function brief(space,overrides){return Object.assign({id:'wide-'+space,title:'Wide colour field',kind:'texture',intended_use:'texture',target_canvas:{medium:'game-world',dimensions:{width:32,height:16,unit:'px'},colour:{space:space,transparency:'opaque',bit_depth:16,rendering_intent:'relative-colorimetric'},physical:{repeat:{mode:'xy'}},behaviour:['static','tileable'],performance:{max_file_bytes:100000,max_texture_memory_bytes:8192},intended_use:'texture'},required_outputs:['image/png'],editable_recipe_formats:['axm.wide-colour-raster-recipe/v1'],quality_requirements:{require_preview:true,require_validation:true,require_editable_source:true}},overrides||{});}
function artifact(result,id){const value=result.artifacts.find(item=>item.id===id);assert(value,'missing '+id);return value;}
function bytes(item){return Raster.bytesFromDataUrl(item.dataUrl,item.mime);}

assert(Hands.list().length>=20);
assert(Hands.listMissingHands().length<=14);
assert(!Hands.getMissingHand('wide-colour-raster'));
for(const space of ['srgb','display-p3']){const profile=Colour.profile(space),hash=crypto.createHash('sha256').update(profile.bytes).digest('hex');assert.equal(hash,Colour.PROFILE_HASHES[space]);assert(profile.inspection.pass);}
const linear=Colour.profile('linear-srgb');assert(linear.inspection.pass);assert.equal(linear.inspection.curves.red.functionType,0);assert.equal(linear.inspection.curves.red.gamma,1);

const p3=Hands.create('wide-colour-raster',brief('display-p3'),{seed:'wide-p3',createdAt,host});
assert.equal(p3.status,'READY');assert(p3.technical.pass);assert.equal(p3.hand.id,'wide-colour-raster');
const master=artifact(p3,'wide-colour-png'),preview=artifact(p3,'colour-managed-preview'),recipe=JSON.parse(artifact(p3,'wide-colour-recipe').text),report=JSON.parse(artifact(p3,'colour-validation-report').text),inspection=Raster.inspectPng(bytes(master)),embedded=Raster.extractIcc(bytes(master));
assert.equal(master.mime,'image/png');assert.equal(master.format,'PNG');assert.equal(inspection.bitDepth,16);assert(inspection.hasIcc);assert(!inspection.hasSrgb);assert.equal(Colour.identifyProfile(embedded.bytes),'display-p3');assert.equal(preview.metadata.colourSpace,'srgb');assert(report.status==='PASS');assert(recipe.generator.targetNativeAccentPixels>0);assert.equal(recipe.target_canvas.colour.space,'display-p3');assert.equal(recipe.provenance.hand,'wide-colour-raster');assert(Schemas.validate(recipe.schema,recipe).pass);assert(Schemas.validate(report.schema,report).pass);
assert(Hands.verifyDeterminism('wide-colour-raster',brief('display-p3'),{seed:'wide-p3',createdAt,host}).pass);

const linearResult=Hands.create('wide-colour-raster',brief('linear-srgb'),{seed:'linear',createdAt,host});
const linearMaster=artifact(linearResult,'wide-colour-png'),linearEmbedded=Raster.extractIcc(bytes(linearMaster));assert.equal(Colour.identifyProfile(linearEmbedded.bytes),'linear-srgb');assert.equal(Raster.inspectPng(bytes(linearMaster)).bitDepth,16);

const srgbPixels=new Uint8Array(16*16*4);for(let i=0;i<srgbPixels.length;i+=4){srgbPixels[i]=255;srgbPixels[i+1]=(i/4)%256;srgbPixels[i+2]=20;srgbPixels[i+3]=255;}
const srgbPng=Raster.encodeRgba(16,16,srgbPixels,{colourSpace:'srgb'}),finishBrief=brief('display-p3',{id:'finish-p3',operation_mode:'finish',target_canvas:{medium:'screen',dimensions:{width:16,height:16,unit:'px'},colour:{space:'display-p3',transparency:'opaque',bit_depth:16},behaviour:['static'],performance:{max_file_bytes:100000},intended_use:'texture'},source_artifacts:[{id:'srgb-source',mime:'image/png',format:'PNG',dataUrl:srgbPng.dataUrl,digest:'source-digest'}]});
const finished=Hands.create('wide-colour-raster',finishBrief,{seed:'finish',createdAt,host});assert(finished.technical.pass);const finishedRecipe=JSON.parse(artifact(finished,'wide-colour-recipe').text);assert.equal(finishedRecipe.source.space,'srgb');assert.equal(finishedRecipe.targetSpace,'display-p3');assert.deepEqual(finishedRecipe.provenance.source_artifact_digests,['source-digest']);

const corrupted=bytes(master).slice(),iccIndex=inspection.chunks.indexOf('iCCP');assert(iccIndex>=0);let offset=8;while(offset+12<corrupted.length){const length=((corrupted[offset]<<24)|(corrupted[offset+1]<<16)|(corrupted[offset+2]<<8)|corrupted[offset+3])>>>0,type=String.fromCharCode(...corrupted.slice(offset+4,offset+8));if(type==='iCCP'){corrupted[offset+8+5]^=1;break;}offset+=12+length;}assert(!Raster.inspectPng(corrupted).pass);

const noWideRoute=Hands.routes(brief('srgb'),host);assert(!noWideRoute.some(route=>route.hand.id==='wide-colour-raster'));
console.log('Asset Hands wide-colour selftest PASS (P3, linear sRGB, ICC, 16-bit, conversion, budgets, tamper, determinism, honest routing)');
