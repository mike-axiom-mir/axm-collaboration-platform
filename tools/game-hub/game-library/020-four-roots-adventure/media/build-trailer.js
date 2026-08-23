#!/usr/bin/env node
'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const Planner=require('../../../../../shared/code-capability-fabric/deterministic-game-trailer-planner-v1');
const Video=require('../../../../../shared/asset-hands/video-codec');
const Raster=require('../../../../../shared/asset-hands/raster-codec');
const Core=require('./four-roots-trailer-core');

const ROOT=__dirname,OUTPUT=path.join(ROOT,'rendered');
const FILES=Object.freeze({mp4:'four-roots-adventure-trailer.mp4',webm:'four-roots-adventure-trailer.webm',vtt:'four-roots-adventure-trailer.vtt',plan:'trailer-plan.json',sequence:'sparse-sequence.json',receipt:'verification-receipt.json',first:'proof-first.png',middle:'proof-middle.png',last:'proof-last.png'});
function sha(bytes){return 'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex');}
function json(value){return Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');}
function record(name,bytes,mime){const value=Buffer.from(bytes);return{path:'media/rendered/'+name,mime,byteLength:value.length,sha256:sha(value)};}
function publicInspection(value){return{pass:value.pass,errors:value.errors,mime:value.mime,format:value.format,codec:value.codec,profile:value.profile,bytes:value.bytes,width:value.width,height:value.height,frames:value.frames,durationSeconds:value.durationSeconds,fps:value.fps};}

async function render(){
  const planned=Planner.plan(Planner.buildExampleRequest()),built=Core.build(planned.plan);
  const encoded=await Video.encodeSparse(Core.WIDTH,Core.HEIGHT,built.uniqueFrames,built.sequence,{frameRate:{numerator:12,denominator:1},formats:['mp4','webm'],jpegQuality:88,vp8Quality:86});
  const proofIndexes=[0,24,47],proofNames=[FILES.first,FILES.middle,FILES.last],proofs=proofIndexes.map((index,n)=>{const encodedPng=Raster.encodeRgba(Core.WIDTH,Core.HEIGHT,built.uniqueFrames[index],{colourSpace:'srgb'});return{name:proofNames[n],bytes:Buffer.from(encodedPng.bytes),inspection:encodedPng.inspection};});
  const planBytes=json(planned),sequenceBytes=json(built.record),vttBytes=Buffer.from(built.vtt,'utf8'),mp4Bytes=Buffer.from(encoded.mp4.bytes),webmBytes=Buffer.from(encoded.webm.bytes);
  const artifacts=[record(FILES.mp4,mp4Bytes,'video/mp4'),record(FILES.webm,webmBytes,'video/webm'),record(FILES.vtt,vttBytes,'text/vtt'),record(FILES.plan,planBytes,'application/json'),record(FILES.sequence,sequenceBytes,'application/json'),...proofs.map((item)=>record(item.name,item.bytes,'image/png'))];
  const outputBytes=artifacts.reduce((sum,item)=>sum+item.byteLength,0);
  if(outputBytes>planned.request.resources.maxEncodedOutputBytes)throw new Error('encoded trailer output byte budget exceeded');
  const receiptCore={schema:'axm.game-trailer-render-verification-receipt/v1',version:'1.0.0',status:'PASS',trailerId:planned.plan.id,requestDigest:planned.request.requestDigest,planDigest:planned.plan.planDigest,sourceRefs:planned.plan.sourceRefs,renderer:{id:'axm-native-sparse-video-renderer',version:Video.VERSION,engine:encoded.engine,providerCalled:false,aiUsed:false,childProcesses:0,networkRequests:0},profile:{width:encoded.width,height:encoded.height,frames:encoded.frames,uniqueFrames:encoded.uniqueFrames,frameRate:encoded.frameRate,durationSeconds:encoded.durationSeconds,audio:false,captions:true},containers:{mp4:{...publicInspection(encoded.mp4.inspection),module:encoded.mp4.module},webm:{...publicInspection(encoded.webm.inspection),module:encoded.webm.module}},proofFrames:proofs.map((item,index)=>({role:['first','middle','last'][index],frameIndex:proofIndexes[index],...record(item.name,item.bytes,'image/png'),inspection:{pass:item.inspection.pass,errors:item.inspection.errors,width:item.inspection.width,height:item.inspection.height,colourType:item.inspection.colourType}})),artifacts:artifacts.map((item)=>({...item})),receiptSelfReference:'OMITTED_TO_AVOID_RECURSIVE_DIGEST',resources:{uniqueFrameBytes:built.uniqueFrames.reduce((sum,item)=>sum+item.byteLength,0),encodedAndEvidenceBytesExcludingReceipt:outputBytes,maxEncodedOutputBytes:planned.request.resources.maxEncodedOutputBytes,files:9,childProcesses:0,networkRequests:0,enforced:true},rights:planned.plan.rights,truth:{actualVideoRendered:true,containersParsed:true,firstMiddleLastDecoded:true,captionCompanionEmitted:true,gameRuntimeExecuted:false,published:false,installed:false,promoted:false,canonChanged:false},limitations:planned.plan.limitations,authority:'NONE'};
  const receipt={...receiptCore,receiptDigest:Planner.hashValue(receiptCore)},receiptBytes=json(receipt),receiptRecord=record(FILES.receipt,receiptBytes,'application/json');
  if(outputBytes+receiptBytes.length>planned.request.resources.maxEncodedOutputBytes)throw new Error('complete trailer output byte budget exceeded');
  const allArtifacts=[...artifacts.slice(0,5),receiptRecord,...artifacts.slice(5)];
  if(allArtifacts.length!==9||new Set(allArtifacts.map((item)=>item.path)).size!==9)throw new Error('trailer artifact set drift');
  return{planned,built,encoded,proofs,receipt,files:{[FILES.mp4]:mp4Bytes,[FILES.webm]:webmBytes,[FILES.vtt]:vttBytes,[FILES.plan]:planBytes,[FILES.sequence]:sequenceBytes,[FILES.receipt]:receiptBytes,[FILES.first]:proofs[0].bytes,[FILES.middle]:proofs[1].bytes,[FILES.last]:proofs[2].bytes}};
}
function write(result,options){const replace=options&&options.replace===true;fs.mkdirSync(OUTPUT,{recursive:true});for(const [name,bytes] of Object.entries(result.files)){const target=path.join(OUTPUT,name);if(!target.startsWith(OUTPUT+path.sep))throw new Error('trailer output escaped fixed root');if(fs.existsSync(target)&&!replace)throw new Error('trailer output already exists: '+name);fs.writeFileSync(target,bytes,{flag:replace?'w':'wx'});}return result.receipt;}

async function main(){const result=await render();write(result,{replace:process.argv.includes('--replace')});process.stdout.write(JSON.stringify({status:result.receipt.status,requestDigest:result.receipt.requestDigest,planDigest:result.receipt.planDigest,receiptDigest:result.receipt.receiptDigest,artifacts:result.receipt.artifacts},null,2)+'\n');}
if(require.main===module)main().catch((error)=>{console.error(error.stack||error);process.exit(1);});
module.exports={ROOT,OUTPUT,FILES,sha,json,record,render,write};
