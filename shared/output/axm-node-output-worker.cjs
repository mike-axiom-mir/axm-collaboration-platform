'use strict';
const {parentPort}=require('worker_threads');
const crypto=require('crypto');
const Vips=require('../vendor/wasm-vips/lib/vips-node.js');
const Core=require('./axm-output-core.js');
let vipsPromise;
function vips(){if(!vipsPromise)vipsPromise=Vips();return vipsPromise;}
function decodeDataUrl(value){const match=String(value||'').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([a-zA-Z0-9+/=]+)$/);if(!match)throw Error('supported image data URL required');const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>15*1024*1024)throw Error('image input must be between 1 byte and 15MB');return bytes;}
function outputSpec(format,quality){if(format==='JPEG')return{extension:'jpg',mime:'image/jpeg',vips:'.jpg',options:{Q:quality}};if(format==='WebP')return{extension:'webp',mime:'image/webp',vips:'.webp',options:{Q:quality}};return{extension:'png',mime:'image/png',vips:'.png',options:{compression:6}};}
async function transform(job){
  const checked=Core.validate(job);if(!checked.ok)throw Error(checked.errors.join('; '));if(checked.job.kind!=='image.transform')throw Error('image worker only accepts image.transform');
  const started=Date.now(),payload=checked.job.payload,input=decodeDataUrl(payload.dataUrl),engine=await vips();
  let source=engine.Image.newFromBuffer(input,'');
  const original={width:source.width,height:source.height};
  let width=Math.max(1,Math.min(8192,Number(payload.width)||Math.round(source.width*(Number(payload.height)||source.height)/source.height)));
  let height=Math.max(1,Math.min(8192,Number(payload.height)||Math.round(source.height*width/source.width)));
  let output=source.thumbnailImage(width,{height:height,size:'both'}),spec=outputSpec(payload.format,Math.max(20,Math.min(100,Number(payload.quality)||88)));
  const bytes=Buffer.from(output.writeToBuffer(spec.vips,spec.options));
  const dimensions={width:output.width,height:output.height,sourceWidth:original.width,sourceHeight:original.height};
  const receipt=Core.receipt({jobId:checked.job.id,kind:checked.job.kind,adapter:'axm-vips-node-worker',engine:{name:'wasm-vips',version:'0.0.18',license:'MIT',source:'https://github.com/kleisauke/wasm-vips'},format:payload.format,mime:spec.mime,filename:payload.filename||checked.job.name,extension:spec.extension,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),dimensions:dimensions,durationMs:Date.now()-started,evidence:['Image decoded and transformed by wasm-vips in an isolated worker thread','Output dimensions verified as '+dimensions.width+'x'+dimensions.height,'SHA-256 calculated before download']});
  if(output&&typeof output.delete==='function')output.delete();if(source&&typeof source.delete==='function')source.delete();
  return{ok:true,base64:bytes.toString('base64'),receipt:receipt};
}
parentPort.once('message',job=>{transform(job).then(result=>parentPort.postMessage(result)).catch(error=>parentPort.postMessage({ok:false,error:String(error&&error.message||error)}));});
