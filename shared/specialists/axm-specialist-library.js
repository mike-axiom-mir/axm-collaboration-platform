(function(root,factory){
  'use strict';
  var node=typeof module!=='undefined'&&module.exports,packs=node?require('../../tools/discovery-engine/review-packs.js'):(root&&root.AXMDiscoveryReviewPacks),profiles=node?require('./runtime-profiles.js'):(root&&root.AXMSpecialistRuntimeProfiles),bridges=node?require('./capability-bridges.js'):(root&&root.AXMCapabilityBridges);
  var api=factory(packs,profiles,bridges);if(node)module.exports=api;if(root)root.AXMSpecialistLibrary=api;
})(typeof self!=='undefined'?self:this,function(ReviewPacks,RuntimeProfiles,CapabilityBridges){
  'use strict';
  var SCHEMA='axm.specialist-library/v1',CHECKOUT_SCHEMA='axm.specialist-checkout/v2',RESULT_SCHEMA='axm.specialist-result/v2',PACKAGE_SCHEMA='axm.specialist-package/v1';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function text(v,n){return String(v==null?'':v).replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n||2000);}
  function arr(v){return Array.isArray(v)?v.map(function(x){return text(x,500);}).filter(Boolean):[];}
  function stamp(v){var d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))d=new Date();return d.toISOString();}
  function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function stable(v){if(Array.isArray(v))return'['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return'{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';return JSON.stringify(v);}
  function hash(v){var s=stable(v),h=2166136261;for(var i=0;i<s.length;i+=1){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function category(packId){return packId==='physics-stance-forge'?'Physics & Simulation':'General Practice';}
  function makeMask(pack,role){
    var maskId=pack.id+':'+role.id,runtime=RuntimeProfiles&&RuntimeProfiles.get(maskId);if(!runtime)throw new Error('runtime profile missing for '+maskId);
    return{
      schema:'axm.specialist-mask/v2',id:maskId,version:pack.version+'+runtime.'+RuntimeProfiles.VERSION,title:role.title,category:category(pack.id),status:pack.status,
      source:{kind:'discovery-role-pack',packId:pack.id,packTitle:pack.title,roleId:role.id,packVersion:pack.version},
      purpose:text(role.humanEquivalent,700),jurisdiction:arr(role.jurisdiction),methods:arr(role.methods),requiredEvidence:arr(role.evidence),
      fearedFailure:text(role.fearedFailure,1200),artifactContract:text(role.artifact,1200),handoffTo:arr(role.handoffTo),
      abstentionConditions:arr(role.abstentionConditions),forbiddenOverreach:arr(role.forbiddenOverreach),vetoes:arr(role.vetoes),
      runtimeProfile:runtime,requestedPermissions:Array.from(new Set(runtime.tools.map(function(t){return t.requestedPermission;}).filter(function(x){return x&&x!=='none';}))),identityEffect:'OVERLAY_ONLY',memoryEffect:'CANDIDATE_ONLY',independenceWarning:text(pack.sharedContextWarning,900)
    };
  }
  function catalog(){
    if(!ReviewPacks||!ReviewPacks.listPacks)throw new Error('Discovery review packs are unavailable');
    var out=[];ReviewPacks.listPacks().forEach(function(info){var pack=ReviewPacks.getPack(info.id);pack.roles.forEach(function(role){out.push(makeMask(pack,role));});});
    return out;
  }
  function findMask(maskId){return catalog().find(function(x){return x.id===text(maskId,160);})||null;}
  function outputSchema(mask){
    var fields=mask.runtimeProfile.artifact.requiredFields,artifactProperties={};
    fields.forEach(function(k){artifactProperties[k]={};});
    return{
      $schema:'https://json-schema.org/draft/2020-12/schema',title:mask.title+' result',type:'object',
      required:['schema','checkoutId','specialistId','specialistVersion','relevance','taskRestatement','artifact','claims','evidence','limitations','handoffs','nextTest','wisdomCandidates'],
      properties:{
        schema:{const:RESULT_SCHEMA},checkoutId:{type:'string'},specialistId:{const:mask.id},specialistVersion:{const:mask.version},relevance:{enum:['YES','PARTIAL','NO']},taskRestatement:{type:'string'},
        assumptions:{type:'array',items:{type:'string'}},
        workLog:{type:'array',items:{type:'object',required:['phase','action','status'],properties:{phase:{type:'string'},action:{type:'string'},tool:{type:['string','null']},status:{enum:['PLANNED','COMPLETE','BLOCKED','FAILED']},evidenceRefs:{type:'array',items:{type:'string'}}}}},
        artifact:{type:'object',required:['type','summary','data'],properties:{type:{const:mask.runtimeProfile.artifact.type},summary:{type:'string'},data:{type:'object',required:fields,properties:artifactProperties}}},
        claims:{type:'array',items:{type:'object',required:['statement','status','evidenceRefs'],properties:{statement:{type:'string'},status:{enum:['OBSERVED','MEASURED_IN_HARNESS','SOURCE_SUPPORTED','ASSUMPTION','HYPOTHESIS','DISPROVEN','REPAIRED','PARTIAL','TEST_HOLD','BLOCKED','EXPERIMENTAL','NEEDS_EXTERNAL_REVIEW','INDEPENDENTLY_UNVALIDATED']},evidenceRefs:{type:'array',items:{type:'string'}},scope:{type:'string'}}}},
        evidence:{type:'array',items:{type:'object',required:['id','kind','reference'],properties:{id:{type:'string'},kind:{enum:['file','source','test','observation','calculation','log','other']},reference:{type:'string'},supports:{type:'array',items:{type:'string'}}}}},
        failures:{type:'array',items:{type:'string'}},limitations:{type:'array',items:{type:'string'}},vetoes:{type:'array',items:{type:'string'}},
        handoffs:{type:'array',items:{type:'object',required:['to','reason'],properties:{to:{type:'string'},reason:{type:'string'},evidenceRefs:{type:'array',items:{type:'string'}}}}},
        nextTest:{type:'string'},wisdomCandidates:{type:'array',items:{type:'object',required:['statement','evidenceRefs','state'],properties:{statement:{type:'string'},evidenceRefs:{type:'array',items:{type:'string'}},state:{const:'CANDIDATE'}}}}
      }
    };
  }
  function methodPhases(mask){return[
    {id:'orient',name:'Orient',requires:['task','identity','expiry'],does:['Restate the bounded task.','Declare relevance YES, PARTIAL, or NO.','List assumptions and missing inputs.'],gate:'Stop or abstain before tool use when jurisdiction or required context is missing.'},
    {id:'plan',name:'Plan',requires:mask.runtimeProfile.inputs.required,does:mask.runtimeProfile.focusQuestions.concat(mask.runtimeProfile.methodEmphasis),gate:'Propose tool actions separately; a mask never executes by authority of the mask.'},
    {id:'work',name:'Work',requires:['approved action receipts when a permission is needed'],does:mask.methods,gatedTools:mask.runtimeProfile.tools.map(function(t){return t.capability;}),gate:'Preserve failures, blocked tools and raw evidence.'},
    {id:'challenge',name:'Challenge',requires:['draft artifact','evidence map'],does:['Attack the feared failure: '+mask.fearedFailure].concat(mask.vetoes),gate:'A live veto or unsupported material claim prevents a clean conclusion.'},
    {id:'return',name:'Return',requires:['axm.specialist-result/v2'],does:['Validate the specialist-specific artifact fields.','Trace claims to evidence.','Declare limitations, handoffs and the next test.'],gate:'Wisdom remains CANDIDATE and same-context work remains non-independent.'}
  ];}
  function perspectiveMarkdown(mask){return'# '+mask.title+'\n\n## Mission\n'+mask.purpose+'\n\n## Perspective\n'+mask.runtimeProfile.focusQuestions.map(function(x){return'- '+x;}).join('\n')+'\n\n## Jurisdiction\n'+mask.jurisdiction.map(function(x){return'- '+x;}).join('\n')+'\n\nThis is a professional method overlay, not a personality or identity. Relevance may be YES, PARTIAL, or NO. Abstention is valid.\n';}
  function compileMask(maskId,modelCapabilities){var mask=findMask(maskId);if(!mask)throw new Error('unknown specialist mask');var schema=outputSchema(mask),phases=methodPhases(mask),bridgePlan=CapabilityBridges?CapabilityBridges.plan(mask,modelCapabilities):null,manifest={schema:PACKAGE_SCHEMA,id:mask.id,version:mask.version,title:mask.title,source:mask.source,entry:'PERSPECTIVE.md',output:'OUTPUT.schema.json',files:['manifest.json','mask.json','PERSPECTIVE.md','METHOD.json','TOOLS.json','CAPABILITY-BRIDGES.json','OUTPUT.schema.json','BOUNDARIES.md'],requires:{inputs:mask.runtimeProfile.inputs.required,capabilities:mask.runtimeProfile.tools.map(function(t){return t.capability;}),permissions:mask.requestedPermissions},truth:{identityEffect:'OVERLAY_ONLY',permissionGrant:'NONE',memoryPromotion:'NONE',independentReview:false}};var files=[
      {path:'manifest.json',mediaType:'application/json',content:manifest},
      {path:'mask.json',mediaType:'application/json',content:mask},
      {path:'PERSPECTIVE.md',mediaType:'text/markdown',content:perspectiveMarkdown(mask)},
      {path:'METHOD.json',mediaType:'application/json',content:{schema:'axm.specialist-method/v1',phases:phases}},
      {path:'TOOLS.json',mediaType:'application/json',content:{schema:'axm.specialist-tools/v1',policy:'PROPOSE_THEN_AUTHORIZE',tools:mask.runtimeProfile.tools,actionSchema:'axm.action/v1'}},
      {path:'CAPABILITY-BRIDGES.json',mediaType:'application/json',content:bridgePlan},
      {path:'OUTPUT.schema.json',mediaType:'application/schema+json',content:schema},
      {path:'BOUNDARIES.md',mediaType:'text/markdown',content:'# Boundaries\n\n## Abstain\n'+mask.abstentionConditions.map(function(x){return'- '+x;}).join('\n')+'\n\n## Forbidden overreach\n'+mask.forbiddenOverreach.map(function(x){return'- '+x;}).join('\n')+'\n\n## Vetoes\n'+mask.vetoes.map(function(x){return'- '+x;}).join('\n')+'\n\n'+mask.independenceWarning+'\n'}
    ];var pkg={schema:PACKAGE_SCHEMA,manifest:manifest,mask:mask,runtime:{inputs:mask.runtimeProfile.inputs,focusQuestions:mask.runtimeProfile.focusQuestions,tools:mask.runtimeProfile.tools,capabilityBridges:bridgePlan,phases:phases,outputSchema:schema},files:files};pkg.fingerprint=hash(pkg);return pkg;}
  function validateStructuredResult(lease,result){var errors=[],mask=lease&&lease.specialist;if(!mask)return{ok:false,errors:['checkout specialist missing']};if(!result||typeof result!=='object'||Array.isArray(result))return{ok:false,errors:['structured result must be an object']};if(result.schema!==RESULT_SCHEMA)errors.push('result schema must be '+RESULT_SCHEMA);if(result.checkoutId!==lease.id)errors.push('checkoutId mismatch');if(result.specialistId!==mask.id)errors.push('specialistId mismatch');if(result.specialistVersion!==mask.version)errors.push('specialistVersion mismatch');if(['YES','PARTIAL','NO'].indexOf(result.relevance)<0)errors.push('relevance must be YES, PARTIAL or NO');['taskRestatement','nextTest'].forEach(function(k){if(!text(result[k],4000))errors.push(k+' required');});['claims','evidence','limitations','handoffs','wisdomCandidates'].forEach(function(k){if(!Array.isArray(result[k]))errors.push(k+'[] required');});var artifact=result.artifact,expected=mask.runtimeProfile.artifact;if(!artifact||typeof artifact!=='object')errors.push('artifact required');else{if(artifact.type!==expected.type)errors.push('artifact.type must be '+expected.type);if(!text(artifact.summary,4000))errors.push('artifact.summary required');var data=artifact.data&&typeof artifact.data==='object'?artifact.data:{};expected.requiredFields.forEach(function(k){if(!(k in data))errors.push('artifact.data.'+k+' required');});}if(Array.isArray(result.claims))result.claims.forEach(function(c,i){if(!c||!text(c.statement,4000)||!Array.isArray(c.evidenceRefs)||!text(c.status,80))errors.push('claim '+i+' requires statement, status and evidenceRefs[]');});if(Array.isArray(result.evidence))result.evidence.forEach(function(e,i){if(!e||!text(e.id,100)||!text(e.reference,2000))errors.push('evidence '+i+' requires id and reference');});return{ok:!errors.length,errors:errors};}
  function create(){return{schema:SCHEMA,version:1,checkouts:[],proposals:[],updatedAt:null};}
  function normalize(input,now){
    input=input&&typeof input==='object'?clone(input):create();var t=new Date(now||Date.now()).getTime();
    var out={schema:SCHEMA,version:1,checkouts:Array.isArray(input.checkouts)?input.checkouts:[],proposals:Array.isArray(input.proposals)?input.proposals:[],updatedAt:input.updatedAt||null};
    out.checkouts=out.checkouts.map(function(x){
      x=x&&typeof x==='object'?x:{};var state=['ACTIVE','RETURNED','REVOKED','EXPIRED'].indexOf(x.state)>=0?x.state:'EXPIRED';
      if(state==='ACTIVE'&&new Date(x.expiresAt||0).getTime()<=t)state='EXPIRED';
      return Object.assign({},x,{state:state});
    });
    return out;
  }
  function bindingAllows(binding,maskId){
    binding=binding&&typeof binding==='object'?binding:{};
    if(String(binding.bindingStatus||'').toUpperCase()==='BLOCKED')return false;
    var blocked=arr(binding.blockedSpecialistMasks||binding.blocked_specialist_masks),allowed=arr(binding.allowedSpecialistMasks||binding.allowed_specialist_masks);
    if(blocked.indexOf('*')>=0||blocked.indexOf(maskId)>=0)return false;
    return !allowed.length||allowed.indexOf('*')>=0||allowed.indexOf(maskId)>=0;
  }
  function checkout(state,input){
    input=input||{};state=normalize(state,input.now);var actorId=text(input.actorId,80),actorName=text(input.actorName,80),mask=findMask(input.specialistId),task=text(input.task,1200);
    if(!actorId||!actorName)throw new Error('actor identity id and name are required');if(!mask)throw new Error('unknown specialist mask');if(!task)throw new Error('bounded task or question is required');
    if(!bindingAllows(input.identityBinding,mask.id))throw new Error('identity binding does not allow this specialist mask');
    var active=state.checkouts.filter(function(x){return x.actorId===actorId&&x.state==='ACTIVE';});if(active.length>=3)throw new Error('identity already holds the maximum of 3 active specialists');
    var minutes=Math.max(5,Math.min(480,Math.floor(Number(input.leaseMinutes)||30))),started=stamp(input.now),expires=stamp(new Date(started).getTime()+minutes*60000);
    var lease={schema:CHECKOUT_SCHEMA,id:id('specialist'),state:'ACTIVE',actorId:actorId,actorName:actorName,actorKind:['human','ai','machine'].indexOf(input.actorKind)>=0?input.actorKind:'ai',connectorId:text(input.connectorId,80)||null,modelCapabilities:input.modelCapabilities&&typeof input.modelCapabilities==='object'?clone(input.modelCapabilities):{},task:task,leaseMinutes:minutes,startedAt:started,expiresAt:expires,returnedAt:null,returnedById:null,specialist:mask,permissionGrant:'NONE',identityMerge:false,memoryPromotion:'NONE',result:null};
    state.checkouts.push(lease);state.updatedAt=started;return{library:state,checkout:clone(lease),packet:workPacket(lease)};
  }
  function workPacket(lease){
    return{schema:'axm.specialist-work-packet/v2',checkoutId:lease.id,actor:{id:lease.actorId,name:lease.actorName,kind:lease.actorKind,connectorId:lease.connectorId},task:lease.task,expiresAt:lease.expiresAt,specialist:clone(lease.specialist),loadableMask:compileMask(lease.specialist.id,lease.modelCapabilities),instructions:['Load manifest.json, then PERSPECTIVE.md and METHOD.json.','Inspect CAPABILITY-BRIDGES.json and activate only selected, host-approved compensators.','Apply the professional method; do not imitate a personality.','Declare relevance YES, PARTIAL, or NO before work.','Create axm.action/v1 proposals for tools requiring permission.','Return an axm.specialist-result/v2 matching OUTPUT.schema.json.','Do not exceed the listed jurisdiction or permissions.'],truth:{identityMerged:false,permissionsGranted:[],wisdomPromotion:'NONE',independentReview:false}};
  }
  function returnCheckout(state,input){
    input=input||{};state=normalize(state,input.now);var lease=state.checkouts.find(function(x){return x.id===text(input.checkoutId,140);});if(!lease)throw new Error('specialist checkout not found');if(lease.state!=='ACTIVE')throw new Error('specialist checkout is not active');
    var who=text(input.returnedById,80),supervised=!!input.supervised;if(!who)throw new Error('returning identity is required');if(who!==lease.actorId&&!supervised)throw new Error('only the holder or an explicit supervisor may return this checkout');
    var summary=text(input.summary,2400),evidence=arr(input.evidence);if(!summary)throw new Error('result summary is required');if(!evidence.length)throw new Error('at least one evidence reference is required');
    var learning=text(input.learning,1200),learningEvidence=text(input.learningEvidence,1200);if((learning&&!learningEvidence)||(!learning&&learningEvidence))throw new Error('learning candidate requires both statement and evidence');
    var structured=input.structuredResult||null;if(structured){var check=validateStructuredResult(lease,structured);if(!check.ok)throw new Error('structured result invalid: '+check.errors.join('; '));}
    lease.state='RETURNED';lease.returnedAt=stamp(input.now);lease.returnedById=who;lease.result={schema:RESULT_SCHEMA,mode:structured?'STRUCTURED':'MANUAL_SUMMARY',relevance:['YES','PARTIAL','NO'].indexOf(input.relevance)>=0?input.relevance:'YES',summary:summary,evidence:evidence,artifact:text(input.artifact,1600)||null,limitations:arr(input.limitations),structured:structured?clone(structured):null,learningCandidate:learning?{state:'CANDIDATE',statement:learning,evidence:learningEvidence}:null,returnedAt:lease.returnedAt};state.updatedAt=lease.returnedAt;
    return{library:state,checkout:clone(lease),result:clone(lease.result)};
  }
  function revoke(state,input){
    input=input||{};state=normalize(state,input.now);var lease=state.checkouts.find(function(x){return x.id===text(input.checkoutId,140);});if(!lease)throw new Error('specialist checkout not found');if(lease.state!=='ACTIVE')throw new Error('specialist checkout is not active');
    var by=text(input.revokedById,80),reason=text(input.reason,1000);if(!by||!reason)throw new Error('revoker and reason are required');lease.state='REVOKED';lease.returnedAt=stamp(input.now);lease.returnedById=by;lease.result={schema:RESULT_SCHEMA,summary:'Checkout revoked: '+reason,evidence:[],limitations:[reason],learningCandidate:null,returnedAt:lease.returnedAt};state.updatedAt=lease.returnedAt;return{library:state,checkout:clone(lease)};
  }
  function propose(state,input){
    input=input||{};state=normalize(state,input.now);var authorId=text(input.authorId,80),title=text(input.title,140),purpose=text(input.purpose,1200),boundary=text(input.boundary,1200),sourceEvidence=arr(input.sourceEvidence);
    if(!authorId||!title||!purpose||!boundary||!sourceEvidence.length)throw new Error('proposal needs author, title, purpose, boundary and source evidence');
    var proposal={schema:'axm.specialist-mask-proposal/v1',id:id('mask-proposal'),state:'REVIEW',authorId:authorId,authorName:text(input.authorName,80)||authorId,title:title,purpose:purpose,boundary:boundary,sourceEvidence:sourceEvidence,createdAt:stamp(input.now)};state.proposals.push(proposal);state.updatedAt=proposal.createdAt;return{library:state,proposal:clone(proposal)};
  }
  function publicView(state,now){state=normalize(state,now);return{schema:SCHEMA,catalog:catalog(),checkouts:state.checkouts,proposals:state.proposals,updatedAt:state.updatedAt,truth:{masksAreIdentities:false,permissionsAutoGranted:false,wisdomAutoPromoted:false,maxActivePerIdentity:3,maxLeaseMinutes:480}};}
  return{SCHEMA:SCHEMA,PACKAGE_SCHEMA:PACKAGE_SCHEMA,RESULT_SCHEMA:RESULT_SCHEMA,create:create,normalize:normalize,catalog:catalog,findMask:findMask,compileMask:compileMask,outputSchema:outputSchema,validateStructuredResult:validateStructuredResult,checkout:checkout,returnCheckout:returnCheckout,revoke:revoke,propose:propose,publicView:publicView,workPacket:workPacket,bindingAllows:bindingAllows};
});
