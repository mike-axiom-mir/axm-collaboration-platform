'use strict';

const childProcess=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const Fabric=require('../../shared/capability-fabric/index.js');
const Registry=require('../../shared/capability-fabric/builder-registry.js');
const Admission=require('../../shared/capability-fabric/admission-core.js');

const REQUIRED_PACKET_FILES=Object.freeze(['README.md','builder-contribution.js','builder-contribution.selftest.js','capability-specification.json','modular-capability.contract.json','recipe-proposal.json','review-checklist.json','verification-plan.json']);
const REQUIRED_DIRECTORY_FILES=Object.freeze(REQUIRED_PACKET_FILES.concat(['foundry-receipt.json','packet.json']).sort());

function publicError(error){return String(error&&(error.message||error)||'admission host failure').replace(/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\[^\s]+/gi,'[local-path]').replace(/\/(?:home|Users)\/[^/\s]+\/[^\s]*/g,'[local-path]').replace(/[\r\n]+/g,' ').slice(0,1000);}
function safeRoot(value){const root=fs.realpathSync(path.resolve(String(value||'')));if(!fs.statSync(root).isDirectory())throw new Error('packet root must be a directory');return root;}
function safePath(root,relative){const text=String(relative||'').replace(/\\/g,'/');if(!text||text.includes('\0')||text.startsWith('/')||/^[A-Za-z]:/.test(text)||text.split('/').some(function(part){return !part||part==='.'||part==='..';}))throw new Error('packet path is unsafe');const target=path.resolve(root,...text.split('/'));const rel=path.relative(root,target);if(rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))throw new Error('packet path escaped root');return target;}
function readText(root,relative){const target=safePath(root,relative),stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw new Error('packet file is not one bounded regular file: '+relative);return fs.readFileSync(target,'utf8').replace(/^\uFEFF/,'');}
function readJson(root,relative){return JSON.parse(readText(root,relative));}
function closedAuthority(value){return value&&Object.values(value).every(function(row){return row===false;});}
function without(value,key){const copy=Fabric.clone(value);delete copy[key];return copy;}
function inspectPacketRoot(value){
  const root=safeRoot(value),checks=[];function check(id,pass){checks.push({id:id,pass:pass===true});}
  const names=fs.readdirSync(root,{withFileTypes:true}).filter(function(row){return row.isFile();}).map(function(row){return row.name;}).sort();
  check('exact-directory-file-set',Fabric.canonicalJson(names)===Fabric.canonicalJson(REQUIRED_DIRECTORY_FILES));
  const packet=readJson(root,'packet.json'),receipt=readJson(root,'foundry-receipt.json'),proposal=readJson(root,'recipe-proposal.json');
  check('packet-schema',packet.schema==='axm.capability-recipe-review-packet/v1'&&packet.status==='EXPERIMENTAL_REVIEW_PACKET');
  check('packet-digest',packet.packetDigest===Fabric.digest(without(packet,'packetDigest')));
  check('packet-authority-closed',closedAuthority(packet.authority));
  const declared=Array.isArray(packet.files)?packet.files.map(function(row){return row.path;}).sort():[];
  check('packet-exact-file-set',Fabric.canonicalJson(declared)===Fabric.canonicalJson(REQUIRED_PACKET_FILES));
  let total=0,fileRowsValid=true;
  (packet.files||[]).forEach(function(row){try{const body=readText(root,row.path);const bytes=Buffer.byteLength(body,'utf8');total+=bytes;if(row.bytes!==bytes||row.digest!==Fabric.digest(body))fileRowsValid=false;}catch(_){fileRowsValid=false;}});
  check('packet-file-bytes-and-digests',fileRowsValid&&total===packet.totalBytes);
  const inspection=Fabric.importRecipeProposal(proposal);
  check('proposal-inactive-valid',inspection.ok===true&&inspection.active===false&&inspection.requiresMikeMerge===true);
  check('proposal-packet-binding',packet.proposalRef&&packet.proposalRef.digest===proposal.proposalDigest&&packet.target&&packet.target.recipeId===proposal.recipe.id&&packet.target.builderId===proposal.recipe.builderId&&packet.target.capabilityKind===proposal.recipe.capabilityKind);
  check('foundry-receipt-digest',receipt.receiptDigest===Fabric.digest(without(receipt,'receiptDigest')));
  check('foundry-receipt-binding',receipt.packetRef&&receipt.packetRef.digest===packet.packetDigest&&receipt.output&&receipt.output.recipeId===packet.target.recipeId&&receipt.output.builderId===packet.target.builderId&&receipt.output.capabilityKind===packet.target.capabilityKind&&closedAuthority(receipt.authority));
  const builder=Registry.describe(packet.target&&packet.target.builderId);
  check('registered-review-candidate',!!builder&&builder.status===Registry.REVIEW_CANDIDATE&&builder.proposalDigest===proposal.proposalDigest&&builder.capabilityKind===packet.target.capabilityKind);
  const stable={schema:'axm.capability-foundry-packet-host-verification/v1',state:checks.every(function(row){return row.pass;})?'PASS':'FAIL',packetDigest:packet.packetDigest||null,proposalDigest:proposal.proposalDigest||null,builderId:builder&&builder.id||null,builderDigest:builder&&builder.implementationDigest||null,capabilityKind:builder&&builder.capabilityKind||null,checks:checks,authority:Fabric.clone(Admission.AUTHORITY)};
  const verification=Object.assign({},stable,{verificationDigest:Fabric.digest(stable)});
  return {root:root,packet:packet,receipt:receipt,proposal:proposal,builder:builder,verification:verification};
}
function sanitizedEnvironment(){const env={};['PATH','Path','SystemRoot','TEMP','TMP','COMSPEC','PATHEXT'].forEach(function(key){if(process.env[key])env[key]=process.env[key];});env.NODE_NO_WARNINGS='1';return env;}
function runExactTest(options){
  const inspected=inspectPacketRoot(options.packetRoot);
  if(options.confirmation!==Admission.TEST_CONFIRMATION)throw new Error('exact trusted-test confirmation is required');
  if(inspected.verification.state!=='PASS')return Admission.buildTestReceipt({state:'FAIL',proposalDigest:inspected.proposal.proposalDigest,builderId:inspected.builder.id,builderDigest:inspected.builder.implementationDigest,capabilityKind:inspected.builder.capabilityKind,packetDigest:inspected.packet.packetDigest,sourceExecuted:false,generatedCapabilityExecuted:false,checks:inspected.verification.checks,outputDigest:Fabric.digest('packet verification failed')});
  const testFile=safePath(inspected.root,'builder-contribution.selftest.js');
  const run=childProcess.spawnSync(process.execPath,[testFile],{cwd:inspected.root,encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:1024*1024,env:sanitizedEnvironment()});
  const output=String(run.stdout||'')+String(run.stderr||'');
  const checks=[{id:'packet-host-verification',pass:true},{id:'process-exit-zero',pass:run.status===0&&!run.error},{id:'selftest-pass-marker',pass:/\bPASS\b/.test(String(run.stdout||''))},{id:'output-bounded',pass:Buffer.byteLength(output,'utf8')<=1024*1024}];
  return Admission.buildTestReceipt({state:checks.every(function(row){return row.pass;})?'PASS':'FAIL',proposalDigest:inspected.proposal.proposalDigest,builderId:inspected.builder.id,builderDigest:inspected.builder.implementationDigest,capabilityKind:inspected.builder.capabilityKind,packetDigest:inspected.packet.packetDigest,sourceExecuted:true,generatedCapabilityExecuted:true,checks:checks,outputDigest:Fabric.digest(output)});
}

module.exports={REQUIRED_PACKET_FILES:REQUIRED_PACKET_FILES,REQUIRED_DIRECTORY_FILES:REQUIRED_DIRECTORY_FILES,publicError:publicError,safeRoot:safeRoot,safePath:safePath,readText:readText,readJson:readJson,inspectPacketRoot:inspectPacketRoot,sanitizedEnvironment:sanitizedEnvironment,runExactTest:runExactTest};
