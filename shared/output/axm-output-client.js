(function(root,factory){root.AXMOutput=factory(root);})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  var Core=root.AXMOutputCore,Comlink=root.Comlink,VERSION='0.1.0';
  function makeWorker(){if(!root.Worker)throw Error('Web Workers are unavailable');if(!Comlink)throw Error('Comlink is unavailable');var worker=new Worker('/shared/output/axm-output-worker.js');return{worker:worker,remote:Comlink.wrap(worker)};}
  function abortError(message){var e=new Error(message||'Output job cancelled');e.name='AbortError';return e;}
  async function browserCapabilities(){var session=makeWorker();try{return await session.remote.capabilities();}finally{session.worker.terminate();}}
  async function serverCapabilities(){var response=await fetch('/api/output/capabilities',{cache:'no-store'});if(!response.ok)throw Error('Local output service unavailable');return(await response.json()).capabilities||[];}
  async function capabilities(){var out=[];try{out=out.concat(await browserCapabilities());}catch(e){out.push({id:'pdf.generate',state:'UNAVAILABLE',reason:e.message});}try{out=out.concat(await serverCapabilities());}catch(e){out.push({id:'image.transform',state:'UNAVAILABLE',reason:e.message});}return out;}
  function runPdf(job,options){
    options=options||{};var session=makeWorker(),timeoutMs=Math.max(1000,Math.min(120000,Number(options.timeoutMs)||20000)),settled=false,timer,abortListener;
    function stop(){clearTimeout(timer);if(options.signal&&abortListener)options.signal.removeEventListener('abort',abortListener);session.worker.terminate();}
    var gate=new Promise(function(_,reject){timer=setTimeout(function(){if(!settled)reject(abortError('PDF job exceeded '+timeoutMs+'ms and was stopped'));},timeoutMs);if(options.signal){abortListener=function(){if(!settled)reject(abortError());};if(options.signal.aborted)return abortListener();options.signal.addEventListener('abort',abortListener,{once:true});}});
    var callback=Comlink.proxy(function(update){if(typeof options.onProgress==='function')options.onProgress(update);});
    var task=session.remote.run(job,callback);
    return Promise.race([task,gate]).then(function(result){settled=true;stop();return result;},function(error){settled=true;stop();throw error;});
  }
  async function runImage(job,options){
    options=options||{};var checked=Core.validate(job);if(!checked.ok)throw Error(checked.errors.join('; '));
    if(typeof options.onProgress==='function')options.onProgress({value:8,label:'Validated image job'});
    var response=await fetch('/api/output/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(checked.job),signal:options.signal});
    var data=await response.json().catch(function(){return{};});if(!response.ok||!data.ok)throw Error(data.error||'Image output failed');
    if(typeof options.onProgress==='function')options.onProgress({value:100,label:'Image verified'});
    return{ok:true,bytes:Uint8Array.from(atob(data.base64),function(c){return c.charCodeAt(0);}),receipt:data.receipt};
  }
  async function run(job,options){var checked=Core.validate(job);if(!checked.ok)throw Error(checked.errors.join('; '));return checked.job.kind==='pdf.generate'?runPdf(checked.job,options):runImage(checked.job,options);}
  function blobFor(result){if(!result||!result.receipt||!result.bytes)throw Error('Verified output result required');return new Blob([result.bytes],{type:result.receipt.mime||'application/octet-stream'});}
  function download(result){var blob=blobFor(result),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=result.receipt.filename;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1500);return result.receipt;}
  function registerExporterAdapters(engines){
    if(!engines||!engines.Exporter)return false;
    engines.Exporter.register({id:'axm-jspdf-worker',version:'0.1.0',formats:['PDF'],export:async function(document,options){var result=await run({schema:Core.JOB_SCHEMA,kind:'pdf.generate',name:document.title,payload:document,actor:options&&options.actor},options);return{ok:true,blob:blobFor(result),bytes:result.receipt.bytes,evidence:result.receipt.evidence,receipt:result.receipt};}});
    engines.Exporter.register({id:'axm-vips-worker',version:'0.1.0',formats:['PNG','JPEG','WebP'],export:async function(document,options){var result=await run({schema:Core.JOB_SCHEMA,kind:'image.transform',name:document.name,payload:document,actor:options&&options.actor},options);return{ok:true,blob:blobFor(result),bytes:result.receipt.bytes,evidence:result.receipt.evidence,receipt:result.receipt};}});
    return true;
  }
  return{VERSION:VERSION,capabilities:capabilities,run:run,download:download,blobFor:blobFor,registerExporterAdapters:registerExporterAdapters};
});
