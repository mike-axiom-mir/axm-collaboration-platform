#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Foundation = require('./game-asset-foundation');
const Profiles = require('./art-direction-profiles');
const Era2004Mesh = require('./era-2004-mesh');
const Atlas = require('./atlas');
const Writer = require('./pack-writer');
const Raster = require('../asset-hands/raster-codec');
const GlTF = require('../asset-hands/gltf-codec');
const RiggedGlTF = require('../asset-hands/rigged-gltf-codec');
const KTX2 = require('../asset-hands/ktx2-codec');

function body(item) { return item.text != null ? Buffer.from(item.text, 'utf8') : Buffer.from(item.data || []); }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function find(result, predicate, label) { const item=result.artifacts.find(predicate);assert(item,'missing '+label);return item; }

(async function(){
  const profile=Profiles.get('urban-2004-original'),definitions=Foundation.definitions(profile);
  assert.equal(definitions.length,27);
  assert.deepEqual(definitions.reduce((counts,item)=>{counts[item.category]=(counts[item.category]||0)+1;return counts;},{}),{building:5,road:5,prop:8,vehicle:5,character:4});

  for(const definition of definitions){
    const counts=[0,1,2].map(level=>{
      const built=Era2004Mesh.build(definition,level),validation=Era2004Mesh.validate(built,profile.budgets[definition.category].triangles[level]);
      assert(validation.pass,definition.id+' LOD'+level+': '+validation.issues.join(', '));
      const obj=Era2004Mesh.toObj(built,Atlas.create(profile,'selftest').uvRects);
      assert(obj.includes('mtllib ../../../../textures/urban-atlas.mtl'));
      assert(obj.includes('\nvt ')&&obj.includes('\nvn ')&&obj.includes('\nf '));
      return validation.triangles;
    });
    assert(counts[0]>counts[1]&&counts[1]>counts[2],definition.id+' needs strict descending LOD triangles');
    assert(counts[0]>=profile.visualTriangleFloor[definition.category],definition.id+' needs PS2 LOD0 geometry density');
  }

  const atlasA=Atlas.create(profile,'selftest'),atlasB=Atlas.create(profile,'selftest');
  assert(atlasA.inspection.pass);assert.equal(atlasA.width,1024);assert.equal(atlasA.materials.length,32);assert.deepEqual(Buffer.from(atlasA.png),Buffer.from(atlasB.png));

  const result=await Foundation.build({seed:'selftest-urban',bakeMode:'representative'});
  assert.equal(result.report.status,'PS2_TECHNICAL_CANDIDATE_PASS');
  assert(result.report.checks.every(check=>check.pass),JSON.stringify(result.report.checks));
  assert.equal(result.manifest.schema,'axm.game-asset-pack/v1');assert.equal(result.manifest.assets.length,27);
  assert.equal(result.manifest.styleVariants.variants.length,4);assert.equal(result.manifest.styleVariants.combinations,108);assert.equal(result.manifest.styleVariants.geometryReuse,true);
  assert.equal(result.manifest.authority.candidateOnly,true);assert.equal(result.manifest.authority.automaticImport,false);assert.equal(result.manifest.authority.automaticPublish,false);
  assert.equal(result.manifest.license.generatedAssets,'PROPOSED_CC0-1.0_PENDING_STEWARD_SELECTION');assert.equal(result.manifest.license.sourceAndProvenanceReviewRequired,true);
  assert.equal(result.manifest.report.truth.nativeEngineValidation,false);assert.equal(result.manifest.report.truth.humanArtReviewRequired,true);assert.equal(result.manifest.report.truth.ps2VisualApproval,false);
  assert.equal(result.manifest.report.truth.ps2PublicReleaseApproved,false);
  assert.equal(result.artifacts.filter(item=>item.mime==='model/obj').length,81);
  assert.equal(result.manifest.assets.filter(item=>item.pbr).length,4);assert.equal(result.manifest.assets.filter(item=>item.rig).length,4);
  for(const item of result.artifacts){const value=body(item);assert.equal(value.length,item.bytes,item.path+' byte count');assert.equal(digest(value),item.digest,item.path+' digest');}

  const contact=find(result,item=>item.path==='previews/asset-contact-sheet.png','contact sheet'),contactInspection=Raster.inspectPng(body(contact));
  assert(contactInspection.pass);assert.equal(contactInspection.width,1600);assert.equal(contactInspection.height,1200);
  const hero=find(result,item=>item.path==='previews/urban-scene-hero.png','urban scene proof'),heroInspection=Raster.inspectPng(body(hero));assert(heroInspection.pass);assert.equal(heroInspection.width,1600);assert.equal(heroInspection.height,900);
  for(const variant of result.manifest.styleVariants.variants){const atlasArtifact=find(result,item=>item.path===variant.atlas,variant.id+' style atlas'),previewArtifact=find(result,item=>item.path===variant.preview,variant.id+' style preview');assert(Raster.inspectPng(body(atlasArtifact)).pass);assert(Raster.inspectPng(body(previewArtifact)).pass);}
  const runtime=find(result,item=>item.path==='preview/index.html','runtime preview').text;
  assert(runtime.includes('<canvas id="view"></canvas>'));assert(runtime.includes('requestAnimationFrame'));assert(!/https?:\/\//.test(runtime));

  const baked=find(result,item=>item.mime==='model/gltf-binary'&&item.path.includes('/pbr/'),'PBR GLB'),bakedInspection=GlTF.inspect(body(baked));
  assert(bakedInspection.pass,bakedInspection.errors&&bakedInspection.errors.join(', '));
  assert(bakedInspection.json.meshes[0].primitives[0].attributes.TEXCOORD_0!=null);
  const ktx=find(result,item=>item.mime==='image/ktx2','KTX2 texture'),ktxInspection=await KTX2.validate(body(ktx));assert(ktxInspection.pass);

  const rig=find(result,item=>item.mime==='model/gltf-binary'&&item.path.includes('/rig/'),'rigged GLB'),rigInspection=RiggedGlTF.inspect(body(rig));
  assert(rigInspection.pass,rigInspection.errors&&rigInspection.errors.join(', '));assert(rigInspection.skin&&rigInspection.skin.joints>=13);assert(rigInspection.animation&&rigInspection.animation.frames>=5);assert(rigInspection.animation.channels>=5);assert(rigInspection.deformation&&rigInspection.deformation.changed);
  for(const character of result.manifest.assets.filter(item=>item.category==='character')){assert(character.rig);assert.equal(character.rig.triangles,character.lods[0].triangles);assert.equal(character.rig.sourceMesh,character.lods[0].path);assert(character.rig.joints>=13);}
  const navigation=find(result,item=>item.path.endsWith('-navigation.json'),'navigation JSON'),navigationValue=JSON.parse(navigation.text);assert(navigationValue.polygons.length>0);

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-game-assets-')),zip=temp+'.zip';
  try{
    const receipt=Writer.writePack(temp,result,{zip:true});assert.equal(receipt.files,result.artifacts.length);assert(fs.existsSync(path.join(temp,'game-asset-pack.json')));assert(fs.existsSync(path.join(temp,'preview','index.html')));assert(fs.existsSync(zip));assert(receipt.archive&&receipt.archive.files===result.artifacts.length);
    assert.throws(()=>Writer.writePack(temp,result),/new or empty/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});fs.rmSync(zip,{force:true});}

  console.log('Game Asset Foundation PS2 selftest PASS (27 assets, 108 style combinations, 81 OBJ LODs, geometry floors, 1024 atlas, PBR GLB/PNG/KTX2, four rigged characters, scene proof, runtime preview, safe pack+ZIP)');
}()).catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
