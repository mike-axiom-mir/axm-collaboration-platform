'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Adventure = require('./deterministic-adventure-content-generator-v1');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.game-trailer-generation-request/v1';
const PLAN_SCHEMA = 'axm.game-trailer-plan/v1';
const PLAN_ID = 'four-roots-adventure-trailer-v0.1';
const ROOTS = Adventure.ROOTS.slice();
const GAME_ROOT = path.resolve(__dirname, '..', '..', 'tools', 'game-hub', 'game-library', '020-four-roots-adventure');
const CONTENT_PATH = 'tools/game-hub/game-library/020-four-roots-adventure/content/adventure-content.v0.2.json';
const MANIFEST_PATH = 'tools/game-hub/game-library/020-four-roots-adventure/game.manifest.json';
const CONTENT_FILE = path.resolve(__dirname, '..', '..', CONTENT_PATH);
const MANIFEST_FILE = path.resolve(__dirname, '..', '..', MANIFEST_PATH);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CONTENT_REF = Object.freeze({id:'four-roots-adventure-content-v0.2',schema:'axm.four-roots-adventure-content/v1',path:CONTENT_PATH,sha256:'sha256:fa5e159f6d7266bd4f3881983e567ae2cce21ca339ac26e7921912439f02dd8d',byteLength:25693});
const MANIFEST_REF = Object.freeze({id:'020-four-roots-adventure',schema:'game.manifest.json',path:MANIFEST_PATH,sha256:'sha256:810a9b6e1fa617a7bf02f746ba12f2a3792fc6ce3a81de82c1da5ff2d5d3f65e',byteLength:5867});
const OUTPUT_PATHS = Object.freeze([
  'media/rendered/four-roots-adventure-trailer.mp4',
  'media/rendered/four-roots-adventure-trailer.webm',
  'media/rendered/four-roots-adventure-trailer.vtt',
  'media/rendered/trailer-plan.json',
  'media/rendered/sparse-sequence.json',
  'media/rendered/verification-receipt.json',
  'media/rendered/proof-first.png',
  'media/rendered/proof-middle.png',
  'media/rendered/proof-last.png'
]);

function clone(value){return JSON.parse(JSON.stringify(value));}
function canonical(value){return Adventure.canonical(value);}
function same(a,b){return canonical(a)===canonical(b);}
function hashBytes(value){return 'sha256:'+crypto.createHash('sha256').update(value).digest('hex');}
function hashValue(value){return hashBytes(Buffer.from(canonical(value),'utf8'));}
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be an object');return value;}
function exact(value,keys,label){object(value,label);if(!same(Object.keys(value).sort(),keys.slice().sort()))throw new Error(label+' fields are not closed');}
function text(value,label,max){if(typeof value!=='string'||value.trim()!==value||value.length<1||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new Error(label+' must be bounded text');return value;}
function id(value,label){value=text(value,label,128);if(!ID.test(value))throw new Error(label+' must be a portable id');return value;}
function digest(value,label){if(typeof value!=='string'||!DIGEST.test(value))throw new Error(label+' must be a SHA-256 digest');return value;}
function normalizedFile(file){const source=fs.readFileSync(file);return Buffer.from(source.toString('utf8').replace(/\r\n?/g,'\n'),'utf8');}
function ref(value,label){exact(value,['id','schema','path','sha256','byteLength'],label);return{id:id(value.id,label+'.id'),schema:text(value.schema,label+'.schema',180),path:portablePath(value.path,label+'.path'),sha256:digest(value.sha256,label+'.sha256'),byteLength:value.byteLength};}
function portablePath(value,label){value=text(value,label,240);if(value.includes('\\')||value.startsWith('/')||/^[a-z]:/i.test(value)||value.startsWith('//')||value.includes(':')||value.split('/').some((part)=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part)))throw new Error(label+' must be a portable relative path');return value;}

function normalizeRoots(values){if(!Array.isArray(values)||values.length!==4)throw new Error('rootsGate requires exactly four roots');return values.map((entry,index)=>{exact(entry,['root','verdict','evidenceRefs'],'rootsGate['+index+']');if(entry.root!==ROOTS[index]||entry.verdict!=='PASS')throw new Error('ROOTS_GATE_HOLD:'+ROOTS[index]);if(!Array.isArray(entry.evidenceRefs)||entry.evidenceRefs.length<1||entry.evidenceRefs.length>8)throw new Error('root evidence is required');return{root:entry.root,verdict:'PASS',evidenceRefs:entry.evidenceRefs.map((item,n)=>{exact(item,['id','schema','sha256'],'root evidence');return{id:id(item.id,'root evidence id'),schema:text(item.schema,'root evidence schema',180),sha256:digest(item.sha256,'root evidence digest')}})};});}

function sealRequest(value){
  exact(value,['schema','id','goal','gameContentRef','gameManifestRef','outputProfile','rootsGate','marketingPolicy','resources','rights','hostDecision','authority'],'trailer request');
  if(value.schema!==REQUEST_SCHEMA||value.authority!=='NONE')throw new Error('trailer request identity or authority drift');
  const gameContentRef=ref(value.gameContentRef,'gameContentRef'),gameManifestRef=ref(value.gameManifestRef,'gameManifestRef');
  if(!same(gameContentRef,CONTENT_REF)||!same(gameManifestRef,MANIFEST_REF))throw new Error('trailer source reference drift');
  exact(value.outputProfile,['width','height','frameRate','durationSeconds','samples','uniqueFrames','formats','audio','captions'],'outputProfile');
  if(!same(value.outputProfile,{width:640,height:360,frameRate:12,durationSeconds:30,samples:360,uniqueFrames:48,formats:['video/mp4','video/webm'],audio:false,captions:true}))throw new Error('trailer output profile drift');
  exact(value.marketingPolicy,['claimsOnlyFromEvidence','fakeReviewQuotes','universalBest','publicAvailability','canon'],'marketingPolicy');
  if(value.marketingPolicy.claimsOnlyFromEvidence!==true||value.marketingPolicy.fakeReviewQuotes!==false||value.marketingPolicy.universalBest!==false||value.marketingPolicy.publicAvailability!==false||value.marketingPolicy.canon!==false)throw new Error('marketing policy inflation');
  exact(value.resources,['maxInputBytes','maxPlanBytes','maxUniqueFrameBytes','maxEncodedOutputBytes','maxFiles','maxChildProcesses','maxNetworkRequests'],'resources');
  const r=value.resources;if(!Number.isSafeInteger(r.maxInputBytes)||r.maxInputBytes<CONTENT_REF.byteLength+MANIFEST_REF.byteLength||r.maxInputBytes>131072||!Number.isSafeInteger(r.maxPlanBytes)||r.maxPlanBytes<1||r.maxPlanBytes>131072||r.maxUniqueFrameBytes!==44236800||!Number.isSafeInteger(r.maxEncodedOutputBytes)||r.maxEncodedOutputBytes<1||r.maxEncodedOutputBytes>52428800||r.maxFiles!==9||r.maxChildProcesses!==0||r.maxNetworkRequests!==0)throw new Error('trailer resource envelope drift');
  exact(value.rights,['internalWorkshopReview','publicDistribution'],'rights');if(value.rights.internalWorkshopReview!=='MIKE_AUTHORIZED_TEST'||value.rights.publicDistribution!=='HOLD')throw new Error('trailer rights drift');
  exact(value.hostDecision,['source','authenticatedIdentityProven','planAuthorized','renderAuthorized','publishAuthorized'],'hostDecision');if(!same(value.hostDecision,{source:'EXPLICIT_IN_THREAD_DIRECTION',authenticatedIdentityProven:false,planAuthorized:true,renderAuthorized:true,publishAuthorized:false}))throw new Error('trailer host decision drift');
  const core={schema:REQUEST_SCHEMA,id:id(value.id,'request.id'),goal:text(value.goal,'request.goal',600),gameContentRef,gameManifestRef,outputProfile:clone(value.outputProfile),rootsGate:normalizeRoots(value.rootsGate),marketingPolicy:clone(value.marketingPolicy),resources:clone(value.resources),rights:clone(value.rights),hostDecision:clone(value.hostDecision),authority:'NONE'};
  return{...core,requestDigest:hashValue(core)};
}
function normalizeRequest(value){exact(value,['schema','id','goal','gameContentRef','gameManifestRef','outputProfile','rootsGate','marketingPolicy','resources','rights','hostDecision','authority','requestDigest'],'trailer request');const{requestDigest,...core}=value,sealed=sealRequest(core);if(requestDigest!==sealed.requestDigest||!same(value,sealed))throw new Error('trailer request digest or canonical form mismatch');return sealed;}

function loadSources(){
  const contentBytes=normalizedFile(CONTENT_FILE),manifestBytes=normalizedFile(MANIFEST_FILE);
  if(hashBytes(contentBytes)!==CONTENT_REF.sha256||contentBytes.length!==CONTENT_REF.byteLength||hashBytes(manifestBytes)!==MANIFEST_REF.sha256||manifestBytes.length!==MANIFEST_REF.byteLength)throw new Error('trailer source bytes drift');
  const content=Adventure.validateContent(JSON.parse(contentBytes.toString('utf8'))),manifest=JSON.parse(manifestBytes.toString('utf8'));
  if(manifest.game_id!=='020-four-roots-adventure'||!String(manifest.status).startsWith('TEST')||manifest.rules.runtime_internet_required!==false||manifest.rules.outbound_network_allowed!==false||manifest.rules.simulation_authority!=='server'||manifest.verification.game_night.host_reload_recovery!=='native-resume')throw new Error('game manifest capability truth drift');
  if(!manifest.controls.keyboard||!manifest.controls.mouse||manifest.controls.phone_controller||manifest.controls.gamepad||manifest.controls.touch)throw new Error('game input declaration drift');
  return{content,manifest,contentBytes,manifestBytes};
}

function claim(idValue,textValue,evidenceRefs){return{id:idValue,text:textValue,status:'PROVEN_FROM_EXACT_SOURCE',evidenceRefs:evidenceRefs.map(clone)};}
function scene(idValue,index,kind,headline,subline,accent,claimIds,visual){return{id:idValue,index,startFrame:index*60,endFrame:(index+1)*60,kind,headline,subline,accent,claimIds,visual};}
function cue(index,textValue){const start=index*5,end=(index+1)*5,stamp=(seconds)=>'00:00:'+String(seconds).padStart(2,'0')+'.000';return{index,startFrame:index*60,endFrame:(index+1)*60,start:stamp(start),end:stamp(end),text:textValue};}

function plan(input){
  const request=normalizeRequest(input),source=loadSources(),content=source.content,manifest=source.manifest,contentRef=clone(CONTENT_REF),manifestRef=clone(MANIFEST_REF);
  const actorCount=content.zones.reduce((sum,zone)=>sum+zone.actors.length,0);
  const claims=[
    claim('local-test-adventure','A LOCAL WORKSHOP TEST ADVENTURE',[manifestRef]),
    claim('five-connected-zones','EXPLORE 5 CONNECTED ZONES',[contentRef]),
    claim('six-quests','COMPLETE 6 QUESTS',[contentRef]),
    claim('ten-discoveries','FIND 10 DISCOVERIES',[contentRef]),
    claim('four-ordered-roots','CARRY 4 ROOTS IN ORDER',[contentRef]),
    claim('keyboard-pointer-controls','MOVE WITH WASD OR ARROWS. INTERACT WITH E OR SPACE.',[manifestRef]),
    claim('server-resume','YOUR EXACT TEST SAVE CAN RESUME AFTER RESTART.',[manifestRef]),
    claim('offline-native','NO AI KEY OR INTERNET REQUIRED.',[manifestRef])
  ];
  const scenes=[
    scene('opening',0,'title','FOUR ROOTS ADVENTURE','A LOCAL TEST JOURNEY','#58e6ff',['local-test-adventure','offline-native'],{mode:'gate-awakens',zoneId:'crossroads'}),
    scene('controls',1,'tutorial','MOVE. MEET. DISCOVER.','WASD OR ARROWS / E OR SPACE','#ffcc66',['keyboard-pointer-controls'],{mode:'control-path',zoneId:'crossroads'}),
    scene('worlds',2,'world','FIVE CONNECTED WORLDS','EVERY PATH CARRIES EVIDENCE','#8df0a8',['five-connected-zones'],{mode:'zone-orbit',zoneIds:content.zones.map((zone)=>zone.id)}),
    scene('roots',3,'progression','TRUTH / AGENCY','CONTINUITY / WISDOM','#d8a8ff',['four-ordered-roots'],{mode:'root-constellation',rootIds:content.roots.map((root)=>root.id)}),
    scene('quests',4,'features','6 QUESTS. 10 DISCOVERIES.','YOUR EXACT SAVE CAN RETURN.','#ff8f70',['six-quests','ten-discoveries','server-resume'],{mode:'quest-journal',quests:content.quests.length,items:content.items.length,actors:actorCount}),
    scene('ending',5,'call-to-review',content.ending.title.toUpperCase(),'PLAY. QUESTION. REPAIR. DECIDE.','#58e6ff',['local-test-adventure','offline-native'],{mode:'review-door',endingTitle:content.ending.title})
  ];
  const captions=[cue(0,'Four Roots Adventure. A local Workshop TEST journey.'),cue(1,'Move with WASD or arrows. Interact with E or Space.'),cue(2,'Explore five connected zones where every path carries evidence.'),cue(3,'Carry Truth, Agency, Continuity, and Wisdom in order.'),cue(4,'Complete six quests, find ten discoveries, and resume your exact save.'),cue(5,'Reach A Door Into Review. Play, question, repair, and decide.')];
  const core={schema:PLAN_SCHEMA,version:VERSION,status:'TEST_PLAN',id:PLAN_ID,requestRef:{id:request.id,schema:request.schema,sha256:request.requestDigest},sourceRefs:[contentRef,manifestRef],profile:clone(request.outputProfile),claims,scenes,captions,outputPaths:OUTPUT_PATHS.slice(),resources:{inputBytes:source.contentBytes.length+source.manifestBytes.length,planBytes:0,uniqueFrameBytes:44236800,samples:360,files:9,childProcesses:0,networkRequests:0,enforced:true},rights:clone(request.rights),limitations:['Silent video; tutorial and marketing copy are on-screen and in companion captions.','MP4 uses bounded Motion JPEG; WebM uses VP8 all-keyframes.','Trailer proves its own media structure, not every gameplay or taste claim.','Internal Workshop TEST only; public distribution remains HOLD.'],truth:{deterministicPlan:true,claimsEvidenceBound:true,providerCalled:false,aiUsed:false,gameRuntimeExecuted:false,videoRendered:false,playabilityProvenByTrailer:false,published:false,canonChanged:false},authority:'NONE'};
  core.resources.planBytes=Buffer.byteLength(canonical(core),'utf8');
  if(core.resources.inputBytes>request.resources.maxInputBytes||core.resources.planBytes>request.resources.maxPlanBytes)throw new Error('trailer planning byte budget exceeded');
  return{request,plan:{...core,planDigest:hashValue(core)}};
}
function verify(result,input){try{return same(result,plan(input))?{pass:true,errors:[]}:{pass:false,errors:['trailer result differs from deterministic rebuild']};}catch(error){return{pass:false,errors:[error.message]};}}
function buildExampleRequest(){return sealRequest({schema:REQUEST_SCHEMA,id:'four-roots-adventure-trailer-request-v0.1',goal:'Create one silent captioned TEST trailer that teaches the proven controls while truthfully marketing the exact Four Roots Adventure release.',gameContentRef:clone(CONTENT_REF),gameManifestRef:clone(MANIFEST_REF),outputProfile:{width:640,height:360,frameRate:12,durationSeconds:30,samples:360,uniqueFrames:48,formats:['video/mp4','video/webm'],audio:false,captions:true},rootsGate:ROOTS.map((root)=>({root,verdict:'PASS',evidenceRefs:[{id:'four-roots-trailer-'+root,schema:'axm.four-root-technical-review/v1',sha256:hashValue('four-roots-trailer-v0.1:'+root)}]})),marketingPolicy:{claimsOnlyFromEvidence:true,fakeReviewQuotes:false,universalBest:false,publicAvailability:false,canon:false},resources:{maxInputBytes:65536,maxPlanBytes:65536,maxUniqueFrameBytes:44236800,maxEncodedOutputBytes:52428800,maxFiles:9,maxChildProcesses:0,maxNetworkRequests:0},rights:{internalWorkshopReview:'MIKE_AUTHORIZED_TEST',publicDistribution:'HOLD'},hostDecision:{source:'EXPLICIT_IN_THREAD_DIRECTION',authenticatedIdentityProven:false,planAuthorized:true,renderAuthorized:true,publishAuthorized:false},authority:'NONE'});}

module.exports={VERSION,REQUEST_SCHEMA,PLAN_SCHEMA,PLAN_ID,ROOTS,GAME_ROOT,CONTENT_PATH,MANIFEST_PATH,CONTENT_FILE,MANIFEST_FILE,CONTENT_REF,MANIFEST_REF,OUTPUT_PATHS,clone,canonical,hashBytes,hashValue,portablePath,sealRequest,normalizeRequest,loadSources,plan,verify,buildExampleRequest};
