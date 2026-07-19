#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Raster=require('./raster-codec');
const Pdf=require('./pdf-codec');
const GlTF=require('./gltf-codec');
const Otio=require('./otio-codec');
const Geometry=require('../../tools/spatial-studio/spatial-geometry');

const rgba=new Uint8Array(4*4*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=40;rgba[i+1]=180;rgba[i+2]=220;rgba[i+3]=255;}
const apng=Raster.encodeApng(4,4,[rgba,rgba,rgba],{fps:12,colourSpace:'srgb'});
assert(apng.inspection.pass);assert.equal(apng.inspection.frames,3);assert(apng.inspection.chunks.includes('acTL'));assert(apng.inspection.chunks.includes('fdAT'));
assert.deepEqual(Raster.encodeApng(4,4,[rgba,rgba,rgba],{fps:12,colourSpace:'srgb'}).bytes,apng.bytes);

const pdf=Pdf.encodePrintDocument({title:'Deterministic print proof',purpose:'Bleed and CMYK structural test',widthMm:210,heightMm:297,bleedMm:3,minimumStrokeMm:.25});
assert(pdf.inspection.pass);assert(pdf.inspection.deviceCmyk);assert(pdf.dataUrl.startsWith('data:application/pdf;base64,JVBERi0'));
assert.deepEqual(Pdf.encodePrintDocument({title:'Deterministic print proof',purpose:'Bleed and CMYK structural test',widthMm:210,heightMm:297,bleedMm:3,minimumStrokeMm:.25}).bytes,pdf.bytes);

const project={format:'axm.spatial.project/v1',id:'codec-scene',name:'Codec Scene',materials:[{name:'PBR',baseColor:'#35cfe8',metallic:.2,roughness:.45,opacity:1}],objects:[{id:'cube',name:'Cube',type:'cube',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true,geometry:{detail:8,inflate:0,twist:0}}]};
const glb=GlTF.fromProject(project,Geometry);assert(glb.inspection.pass);assert.equal(glb.inspection.version,2);assert.equal(glb.inspection.json.asset.version,'2.0');assert.equal(glb.triangles,12);assert(glb.dataUrl.startsWith('data:model/gltf-binary;base64,Z2xURg'));
assert.deepEqual(GlTF.fromProject(project,Geometry).bytes,glb.bytes);

const timeline={format:'axm.film-motion.project/v1',id:'codec-timeline',name:'Codec Timeline',fps:24,width:1920,height:1080,assets:[{id:'asset-1',name:'Source',source:'media/source.mov',sourceSchema:''}],tracks:[{id:'track-1',name:'V1',kind:'video',muted:false,locked:false}],clips:[{id:'clip-1',trackId:'track-1',assetId:'asset-1',name:'Opening',startFrame:12,durationFrames:48,inFrame:0,speed:1,opacity:1,blend:'normal'}]};
const otio=Otio.fromProject(timeline);assert(otio.inspection.pass);assert.equal(otio.document.OTIO_SCHEMA,'Timeline.1');assert.equal(otio.document.tracks.children[0].children[0].OTIO_SCHEMA,'Gap.1');assert.equal(otio.document.tracks.children[0].children[1].OTIO_SCHEMA,'Clip.2');assert.equal(Otio.fromProject(timeline).text,otio.text);

console.log('AXM interchange selftest: PASS (deterministic PDF, APNG, GLB 2.0 and OTIO structures)');
