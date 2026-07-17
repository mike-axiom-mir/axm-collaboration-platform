(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AXMOutputCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var VERSION='0.1.0';
  var JOB_SCHEMA='axm.output-job/v1';
  var RECEIPT_SCHEMA='axm.output-receipt/v1';
  var KINDS=['pdf.generate','image.transform'];
  var IMAGE_FORMATS=['PNG','JPEG','WebP'];
  function text(value,max){var s=String(value==null?'':value).trim();return max?s.slice(0,max):s;}
  function number(value,min,max,fallback){var n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function id(prefix){return(prefix||'job')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function safeFilename(name,extension){
    var base=text(name,100).replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,' ').trim()||'axm-output';
    var ext=String(extension||'').replace(/^\./,'').toLowerCase();
    if(ext&&!base.toLowerCase().endsWith('.'+ext))base+='.'+ext;
    return base;
  }
  function normalize(input){
    input=input&&typeof input==='object'?input:{};
    var kind=KINDS.indexOf(input.kind)>=0?input.kind:'';
    return{schema:JOB_SCHEMA,id:text(input.id,100)||id('output'),kind:kind,name:text(input.name,120)||'AXM output',payload:input.payload&&typeof input.payload==='object'?input.payload:{},actor:{id:text(input.actor&&input.actor.id,100)||'local-user',kind:['human','machine','service'].indexOf(input.actor&&input.actor.kind)>=0?input.actor.kind:'human'},createdAt:text(input.createdAt,40)||new Date().toISOString()};
  }
  function validate(input){
    var job=normalize(input),errors=[];
    if(!job.kind)errors.push('supported output kind required');
    if(job.kind==='pdf.generate'){
      if(!text(job.payload.title,160))errors.push('PDF title required');
      if(!text(job.payload.body,50000))errors.push('PDF body required');
    }
    if(job.kind==='image.transform'){
      var dataUrl=text(job.payload.dataUrl,22000000),format=text(job.payload.format,20);
      if(!/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(dataUrl))errors.push('supported image data URL required');
      if(IMAGE_FORMATS.indexOf(format)<0)errors.push('PNG, JPEG or WebP output required');
      if(!number(job.payload.width,1,8192,0)&&!number(job.payload.height,1,8192,0))errors.push('target width or height required');
    }
    return{ok:!errors.length,errors:errors,job:job};
  }
  function estimate(input){
    var checked=validate(input);if(!checked.ok)return{ok:false,errors:checked.errors};
    var job=checked.job;
    if(job.kind==='pdf.generate')return{ok:true,jobId:job.id,kind:job.kind,estimatedInputBytes:text(job.payload.body,50000).length*2,timeoutMs:20000,memoryClass:'small'};
    var base64=text(job.payload.dataUrl,22000000).split(',')[1]||'',bytes=Math.floor(base64.length*.75),width=number(job.payload.width,1,8192,1024),height=number(job.payload.height,1,8192,width);
    return{ok:true,jobId:job.id,kind:job.kind,estimatedInputBytes:bytes,estimatedWorkingBytes:Math.min(512*1024*1024,width*height*4*3),timeoutMs:60000,memoryClass:bytes>8000000?'large':bytes>2000000?'medium':'small'};
  }
  function receipt(input){
    input=input||{};
    return{schema:RECEIPT_SCHEMA,jobId:text(input.jobId,100),kind:text(input.kind,80),adapter:text(input.adapter,100),engine:{name:text(input.engine&&input.engine.name,100),version:text(input.engine&&input.engine.version,40),license:text(input.engine&&input.engine.license,40),source:text(input.engine&&input.engine.source,300)},format:text(input.format,30),mime:text(input.mime,100),filename:safeFilename(input.filename,input.extension),bytes:number(input.bytes,0,Number.MAX_SAFE_INTEGER,0),sha256:text(input.sha256,128),dimensions:input.dimensions||null,pages:number(input.pages,0,10000,0)||null,durationMs:number(input.durationMs,0,3600000,0),evidence:Array.isArray(input.evidence)?input.evidence.map(function(x){return text(x,500);}).filter(Boolean).slice(0,30):[],createdAt:text(input.createdAt,40)||new Date().toISOString(),reviewState:'INBOX'};
  }
  return{VERSION:VERSION,JOB_SCHEMA:JOB_SCHEMA,RECEIPT_SCHEMA:RECEIPT_SCHEMA,KINDS:KINDS,IMAGE_FORMATS:IMAGE_FORMATS,normalize:normalize,validate:validate,estimate:estimate,receipt:receipt,safeFilename:safeFilename};
});
