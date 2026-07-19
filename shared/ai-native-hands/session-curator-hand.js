'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const Retention=require('../evidence-retention/evidence-retention-service');

const CAPABILITY='evidence.curate.session/v1';
const MANIFEST_SCHEMA='axm.ephemeral-capture-manifest/v1';
const RECEIPT_SCHEMA='axm.ephemeral-cleanup-receipt/v1';
const EYE_OWNER='visual.capture.ephemeral-rolling-buffer/v1';
const NATIVE_EYE_OWNER='visual.capture.windows-native/v1';
const EYE_OWNERS=[EYE_OWNER,NATIVE_EYE_OWNER];

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function inside(root,file){const relative=path.relative(root,file);return !!relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function cleanId(value,label){const text=String(value||'').trim();if(!text||text.length>160)throw new Error(label+' requires a bounded id');return text;}
function cleanRoot(value){const text=String(value||'').trim();if(!text||text.length>1024||text.includes('\0'))throw new Error('ownedRoot requires a bounded filesystem path');return text;}

function create(options){
  options=options||{};const stateRoot=path.resolve(options.stateRoot||path.join(__dirname,'..','..','state')),retention=options.retention||Retention.forStateRoot(stateRoot),evidenceFile=path.join(stateRoot,'ai-native-hands','curation-events.jsonl');
  function cleanupEphemeral(manifest,runOptions){
    runOptions=runOptions||{};if(!manifest||manifest.schema!==MANIFEST_SCHEMA)throw new Error('ephemeral capture manifest required');if(!EYE_OWNERS.includes(manifest.owner))throw new Error('cleanup authority is limited to Eye temporary captures');
    const ownedRoot=path.resolve(cleanRoot(manifest.ownedRoot)),files=Array.isArray(manifest.files)?manifest.files:[];if(!files.length||files.length>500)throw new Error('bounded non-empty manifest files required');
    const planned=[],refused=[];files.forEach(function(entry){try{const relativePath=cleanId(entry&&entry.relativePath,'relativePath');if(path.isAbsolute(relativePath)||relativePath.includes('\0'))throw new Error('relative path required');const target=path.resolve(ownedRoot,relativePath);if(!inside(ownedRoot,target))throw new Error('path escapes owned root');const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('regular non-symlink file required');const actual=sha256(target),expected=String(entry.sha256||'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(expected)||actual!==expected)throw new Error('digest mismatch');planned.push({relativePath:relativePath,absolutePath:target,sha256:actual,bytes:stat.size});}catch(error){refused.push({relativePath:String(entry&&entry.relativePath||''),reason:String(error.message||error)});}});
    const apply=runOptions.apply===true&&runOptions.authority==='eye-current-loop',deleted=[];if(apply&&!refused.length)planned.forEach(function(entry){fs.unlinkSync(entry.absolutePath);deleted.push({relativePath:entry.relativePath,sha256:entry.sha256,bytes:entry.bytes});});
    const receipt={schema:RECEIPT_SCHEMA,capability:CAPABILITY,bufferId:cleanId(manifest.bufferId,'bufferId'),owner:manifest.owner,at:new Date().toISOString(),mode:apply?'APPLIED':'PREVIEW',planned:planned.map(function(entry){return{relativePath:entry.relativePath,sha256:entry.sha256,bytes:entry.bytes};}),deleted:deleted,refused:refused,cleanupComplete:apply&&!refused.length&&deleted.length===planned.length,rawMediaRetained:apply?planned.some(function(entry){return fs.existsSync(entry.absolutePath);}):true,authority:runOptions.authority||null};
    if(runOptions.record!==false)retention.record(evidenceFile,{type:'ephemeral-capture-cleanup',at:receipt.at,receipt:receipt});return receipt;
  }
  return{capability:CAPABILITY,record:function(file,event){return retention.record(file,event);},seal:function(reason){return retention.seal(reason||'explicit-curator-seal');},status:function(){return retention.status();},cleanupEphemeral:cleanupEphemeral};
}

const descriptor={id:'session-evidence-curator',capability:CAPABILITY,version:'1.0.0',status:'TEST',accepts:['events','session-segments',MANIFEST_SCHEMA],produces:['axm.evidence-retention/v1',RECEIPT_SCHEMA],sideEffects:['append-evidence','seal-session','delete-exact-owned-temporary-files'],automaticDeletion:false};
module.exports={CAPABILITY,MANIFEST_SCHEMA,RECEIPT_SCHEMA,EYE_OWNER,NATIVE_EYE_OWNER,EYE_OWNERS,descriptor,create};
