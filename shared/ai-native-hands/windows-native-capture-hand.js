'use strict';

const childProcess=require('child_process');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const Curator=require('./session-curator-hand');

const CAPABILITY='visual.capture.windows-native/v1';
const LEASE_SCHEMA='axm.visual-capture-lease/v1';
const CAPTURE_SCHEMA='axm.windows-native-capture/v1';
const SCOPES=['screen.primary','screen.virtual'];

function bounded(value,label,max){const text=String(value||'').trim();if(!text||text.length>(max||160))throw new Error(label+' requires a bounded value');return text;}
function clamp(value,min,max,fallback){value=Number(value);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
function digest(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+crypto.randomBytes(4).toString('hex');}

function proposeLease(input){
  input=input||{};const durationMinutes=Math.round(clamp(input.durationMinutes,1,1440,480)),scope=SCOPES.includes(input.scope)?input.scope:'screen.primary',recipients=Array.isArray(input.recipients)?Array.from(new Set(input.recipients.map(x=>bounded(x,'recipient',80)))):[];
  if(!recipients.length||recipients.length>16)throw new Error('one to sixteen named recipients required');
  return{schema:LEASE_SCHEMA,id:uid('eye-lease'),state:'PROPOSED',createdAt:new Date().toISOString(),createdBy:bounded(input.createdBy||'local-human','createdBy',80),scope:scope,recipients:recipients,purpose:bounded(input.purpose||'bounded observation-only local screen capture','purpose',300),durationMinutes:durationMinutes,minIntervalMs:Math.round(clamp(input.minIntervalMs,1000,60000,1000)),maxCaptures:Math.round(clamp(input.maxCaptures,1,10000,3600)),audio:false,commands:false,rawVideoArchive:false,automaticActivation:false};
}

function activateLease(proposal,confirmation){
  if(!proposal||proposal.schema!==LEASE_SCHEMA||proposal.state!=='PROPOSED')throw new Error('proposed visual capture lease required');
  if(confirmation!=='ALLOW NATIVE EYE')throw new Error('exact human confirmation required');
  const issuedAt=new Date(),expiresAt=new Date(issuedAt.getTime()+proposal.durationMinutes*60000);
  return Object.assign({},proposal,{state:'ACTIVE',issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString(),approvedByHuman:true,automaticActivation:false,confirmationDigest:crypto.createHash('sha256').update(confirmation+'\n'+proposal.id).digest('hex')});
}

function validateLease(lease,recipient,now){
  if(!lease||lease.schema!==LEASE_SCHEMA||lease.state!=='ACTIVE'||lease.approvedByHuman!==true)throw new Error('active human-approved visual capture lease required');
  if(!SCOPES.includes(lease.scope))throw new Error('unsupported capture scope');
  recipient=bounded(recipient,'recipient',80);if(!Array.isArray(lease.recipients)||!lease.recipients.includes(recipient))throw new Error('recipient is outside the visual capture lease');
  now=now||new Date();if(!lease.expiresAt||Date.parse(lease.expiresAt)<=now.getTime())throw new Error('visual capture lease expired');
  if(Date.parse(lease.expiresAt)-Date.parse(lease.issuedAt)>1440*60000+1000)throw new Error('visual capture lease exceeds the 24 hour bound');
  return{recipient:recipient,target:lease.scope==='screen.virtual'?'virtual':'primary'};
}

function compilerPath(preferred){const candidates=[preferred,'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe','C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'].filter(Boolean);return candidates.find(file=>fs.existsSync(file))||null;}

function create(options){
  options=options||{};const stateRoot=path.resolve(options.stateRoot||path.join(__dirname,'..','..','state')),tempRoot=path.resolve(options.tempRoot||path.join(stateRoot,'eye-native','temp')),binRoot=path.resolve(options.binRoot||path.join(stateRoot,'eye-native','bin')),killSwitchFile=path.resolve(options.killSwitchFile||path.join(stateRoot,'eye-native','STOP')),source=path.join(__dirname,'windows-native-capture.cs'),compiler=compilerPath(options.compiler),curator=options.curator||Curator.create({stateRoot}),usage=new Map(),lastAt=new Map();
  function ensureHelper(){
    if(!compiler)throw new Error('built-in Windows C# compiler is unavailable');fs.mkdirSync(binRoot,{recursive:true});const executable=path.join(binRoot,'AXM.NativeEye.exe'),receiptFile=path.join(binRoot,'AXM.NativeEye.build.json'),sourceDigest=digest(fs.readFileSync(source));let current=null;try{current=JSON.parse(fs.readFileSync(receiptFile,'utf8'));}catch(error){}
    if(!fs.existsSync(executable)||!current||current.sourceSha256!==sourceDigest){const temporary=path.join(binRoot,'AXM.NativeEye.build-'+process.pid+'.exe');try{childProcess.execFileSync(compiler,['/nologo','/target:exe','/optimize+','/out:'+temporary,'/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll',source],{windowsHide:true,timeout:30000,encoding:'utf8',maxBuffer:1024*1024});if(fs.existsSync(executable))fs.unlinkSync(executable);fs.renameSync(temporary,executable);fs.writeFileSync(receiptFile,JSON.stringify({schema:'axm.windows-native-eye-build/v1',sourceSha256:sourceDigest,executableSha256:digest(fs.readFileSync(executable)),compiler:compiler,builtAt:new Date().toISOString()},null,2)+'\n','utf8');}catch(error){try{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}catch(cleanupError){}throw error;}}
    return executable;
  }
  function captureOnce(input){
    input=input||{};if(process.platform!=='win32')throw new Error('Windows native capture is unavailable on '+process.platform);if(fs.existsSync(killSwitchFile))throw new Error('native Eye kill switch is active');
    const lease=validateLease(input.lease,input.recipient),used=usage.get(input.lease.id)||0;if(used>=input.lease.maxCaptures)throw new Error('visual capture lease budget exhausted');
    const previous=lastAt.get(input.lease.id)||0,now=Date.now();if(now-previous<input.lease.minIntervalMs)throw new Error('visual capture lease rate limit');
    fs.mkdirSync(tempRoot,{recursive:true});const name=uid('eye-native')+'.jpg',file=path.join(tempRoot,name),maxWidth=Math.round(clamp(input.maxWidth,320,1920,1280)),quality=Math.round(clamp(input.quality,45,90,72));
    try{
      const helper=ensureHelper();childProcess.execFileSync(helper,['--output',file,'--target',lease.target,'--max-width',String(maxWidth),'--quality',String(quality)],{windowsHide:true,timeout:15000,encoding:'utf8',maxBuffer:1024*1024});
      const bytes=fs.readFileSync(file);if(bytes.length<1000||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('Windows capture did not produce a valid JPEG');
      usage.set(input.lease.id,used+1);lastAt.set(input.lease.id,Date.now());const sha256=digest(bytes),capturedAt=new Date().toISOString();
      return{schema:CAPTURE_SCHEMA,capability:CAPABILITY,id:path.basename(name,'.jpg'),capturedAt:capturedAt,recipient:lease.recipient,scope:input.lease.scope,bytes:bytes.length,sha256:sha256,dataUrl:'data:image/jpeg;base64,'+bytes.toString('base64'),manifest:{schema:Curator.MANIFEST_SCHEMA,owner:Curator.NATIVE_EYE_OWNER,bufferId:input.lease.id,ownedRoot:tempRoot,files:[{relativePath:name,sha256:sha256}]},rawVideoArchive:false,commands:false};
    }catch(error){try{if(fs.existsSync(file))fs.unlinkSync(file);}catch(cleanupError){}throw error;}
  }
  function captureFrame(input){return async function(){const capture=captureOnce(input),cleanup=curator.cleanupEphemeral(capture.manifest,{apply:true,authority:'eye-current-loop'});if(!cleanup.cleanupComplete)throw new Error('native Eye temporary capture cleanup failed');return{dataUrl:capture.dataUrl,capturedAt:capture.capturedAt,nativeReceipt:{id:capture.id,scope:capture.scope,bytes:capture.bytes,sha256:capture.sha256,cleanupComplete:true}};};}
  return{capability:CAPABILITY,tempRoot:tempRoot,binRoot:binRoot,killSwitchFile:killSwitchFile,captureOnce:captureOnce,captureFrame:captureFrame,status:function(leaseId){return{capability:CAPABILITY,platform:process.platform,available:process.platform==='win32'&&!!compiler&&fs.existsSync(source),compiler:compiler,killSwitch:fs.existsSync(killSwitchFile),capturesUsed:usage.get(leaseId)||0,rawVideoArchive:false};}};
}

const descriptor={id:'windows-native-eye',capability:CAPABILITY,version:'1.0.0',status:'TEST',accepts:[LEASE_SCHEMA,'named-recipient','Windows interactive desktop'],produces:[CAPTURE_SCHEMA,'JPEG data URL','axm.ephemeral-cleanup-receipt/v1'],sideEffects:['create exact temporary JPEG','delete exact temporary JPEG after ingestion'],automaticActivation:false,rawVideoArchive:false,commands:false};
module.exports={CAPABILITY,LEASE_SCHEMA,CAPTURE_SCHEMA,SCOPES,descriptor,proposeLease,activateLease,validateLease,compilerPath,create};
