(function(root,factory){
  const fabric=typeof module!=='undefined'&&module.exports?require('./core.js'):root.AXMCapabilityFabric;
  const api=factory(fabric);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'&&root.AXMCapabilityFabric)Object.assign(root.AXMCapabilityFabric,api);
})(typeof self!=='undefined'?self:this,function(Fabric){
  'use strict';

  if(!Fabric||typeof Fabric.build!=='function')throw new Error('AXM Capability Fabric core is required');
  const VERSION='1.0.0';
  const REQUEST_SCHEMA='axm.capability-composition.request/v1';
  const PLAN_SCHEMA='axm.capability-composition.plan/v1';
  const BUILD_SCHEMA='axm.capability-composition.build/v1';
  const VERIFICATION_SCHEMA='axm.capability-composition.verification/v1';
  const MAX_NODES=16;
  const MAX_EDGES=64;
  const MAX_REQUEST_BYTES=256*1024;
  const MAX_TOTAL_CANDIDATE_BYTES=16*1024*1024;
  const AUTHORITY=Fabric.AUTHORITY;
  const canonicalJson=Fabric.canonicalJson;
  const digest=Fabric.digest;

  function clone(value){return JSON.parse(canonicalJson(value));}
  function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}
  function isPlain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
  function without(value,key){const copy=clone(value);delete copy[key];return copy;}
  function bytes(value){const text=typeof value==='string'?value:canonicalJson(value);if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text).length;return Buffer.byteLength(text,'utf8');}
  function safeId(value){return /^[a-z][a-z0-9-]{2,79}$/.test(String(value||''));}
  function safeDigest(value){return /^sha256:[a-f0-9]{64}$/.test(String(value||''));}
  function safeContract(value){return /^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(String(value||''));}
  function issue(code,path,message,details){const row={code:code,path:path,message:message};if(details!==undefined)row.details=details;return row;}
  function hold(code,message,details){const row={code:code,message:message};if(details!==undefined)row.details=details;return row;}
  function closed(value,keys,path,errors){
    if(!isPlain(value)){errors.push(issue('TYPE_OBJECT_REQUIRED',path,'Expected a closed object.'));return false;}
    Object.keys(value).forEach(function(key){if(!keys.includes(key))errors.push(issue('UNKNOWN_FIELD',path+'.'+key,'Closed schema refuses this field.'));});
    keys.forEach(function(key){if(!own(value,key))errors.push(issue('REQUIRED_FIELD',path+'.'+key,'Required field is missing.'));});
    return true;
  }
  function authorityClosed(value){return isPlain(value)&&canonicalJson(value)===canonicalJson(AUTHORITY);}
  function sortNodes(rows){return rows.slice().sort(function(a,b){return String(a&&a.id||'').localeCompare(String(b&&b.id||''));});}
  function sortEdges(rows){return rows.slice().sort(function(a,b){return [a&&a.from,a&&a.to,a&&a.contract].map(String).join('\u0000').localeCompare([b&&b.from,b&&b.to,b&&b.contract].map(String).join('\u0000'));});}
  function sortBindings(rows){return rows.slice().sort(function(a,b){return [a&&a.nodeId,a&&a.contract].map(String).join('\u0000').localeCompare([b&&b.nodeId,b&&b.contract].map(String).join('\u0000'));});}
  function normalizeSource(source){return isPlain(source)?{kind:String(source.kind||''),ref:source.ref==null?null:String(source.ref)}:{kind:'HUMAN',ref:null};}

  function sealCompositionRequest(draft,humanReviewed){
    draft=isPlain(draft)?draft:{};
    const nodes=Array.isArray(draft.nodes)?draft.nodes.map(function(row){
      const node=isPlain(row)?row:{};
      const child=isPlain(node.request)?Fabric.sealRequest(node.request,node.request.humanReviewed===true):Fabric.sealRequest({},false);
      return {id:String(node.id||''),request:child};
    }):[];
    const request={
      schema:REQUEST_SCHEMA,
      id:String(draft.id||''),
      purpose:String(draft.purpose||''),
      nodes:sortNodes(nodes),
      edges:sortEdges(Array.isArray(draft.edges)?draft.edges.map(function(row){return {from:String(row&&row.from||''),to:String(row&&row.to||''),contract:String(row&&row.contract||'')};}):[]),
      externalInputs:sortBindings(Array.isArray(draft.externalInputs)?draft.externalInputs.map(function(row){return {nodeId:String(row&&row.nodeId||''),contract:String(row&&row.contract||'')};}):[]),
      expectedOutputs:sortBindings(Array.isArray(draft.expectedOutputs)?draft.expectedOutputs.map(function(row){return {nodeId:String(row&&row.nodeId||''),contract:String(row&&row.contract||'')};}):[]),
      limits:isPlain(draft.limits)?{maxNodes:draft.limits.maxNodes,maxEdges:draft.limits.maxEdges,maxTotalCandidateBytes:draft.limits.maxTotalCandidateBytes}:{maxNodes:8,maxEdges:16,maxTotalCandidateBytes:4*1024*1024},
      source:normalizeSource(draft.source),
      status:'EXPERIMENTAL',
      authority:'NONE',
      humanReviewed:humanReviewed===undefined?draft.humanReviewed===true:humanReviewed===true,
      requestDigest:''
    };
    request.requestDigest=digest(without(request,'requestDigest'));
    return request;
  }

  function validateBinding(row,path,errors){
    if(!closed(row,['nodeId','contract'],path,errors))return;
    if(!safeId(row.nodeId))errors.push(issue('NODE_ID_INVALID',path+'.nodeId','Node id must be lowercase and hyphenated.'));
    if(!safeContract(row.contract))errors.push(issue('CONTRACT_ID_INVALID',path+'.contract','Contract id must be bounded portable text.'));
  }
  function validateCompositionRequest(request){
    const errors=[];
    const keys=['schema','id','purpose','nodes','edges','externalInputs','expectedOutputs','limits','source','status','authority','humanReviewed','requestDigest'];
    if(!closed(request,keys,'$',errors))return {ok:false,errors:errors};
    if(request.schema!==REQUEST_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+REQUEST_SCHEMA+'.'));
    if(!safeId(request.id))errors.push(issue('COMPOSITION_ID_INVALID','$.id','Composition id must be lowercase and hyphenated.'));
    if(typeof request.purpose!=='string'||!request.purpose.trim()||request.purpose.length>500)errors.push(issue('PURPOSE_INVALID','$.purpose','Purpose must contain 1 to 500 characters.'));
    if(bytes(request)>MAX_REQUEST_BYTES)errors.push(issue('REQUEST_BYTES_EXCEEDED','$','Composition request exceeds 256 KiB.'));
    const ids=new Set(),requestIds=new Set();
    if(!Array.isArray(request.nodes)||request.nodes.length<2||request.nodes.length>MAX_NODES)errors.push(issue('NODE_COUNT_INVALID','$.nodes','Composition requires 2 to '+MAX_NODES+' nodes.'));
    else request.nodes.forEach(function(row,index){
      const at='$.nodes['+index+']';if(!closed(row,['id','request'],at,errors))return;
      if(!safeId(row.id)||ids.has(row.id))errors.push(issue('NODE_ID_INVALID',at+'.id','Node id must be unique, lowercase, and hyphenated.'));ids.add(row.id);
      const child=Fabric.validateRequest(row.request);if(!child.ok)errors.push(issue('NODE_REQUEST_INVALID',at+'.request','Child build request failed its exact contract.',child.errors));
      if(row.request&&requestIds.has(row.request.id))errors.push(issue('NODE_REQUEST_ID_DUPLICATE',at+'.request.id','Child build request ids must be unique.'));if(row.request)requestIds.add(row.request.id);
    });
    const edgeKeys=new Set();
    if(!Array.isArray(request.edges)||!request.edges.length||request.edges.length>MAX_EDGES)errors.push(issue('EDGE_COUNT_INVALID','$.edges','Composition requires 1 to '+MAX_EDGES+' edges.'));
    else request.edges.forEach(function(row,index){
      const at='$.edges['+index+']';if(!closed(row,['from','to','contract'],at,errors))return;
      if(!safeId(row.from)||!safeId(row.to))errors.push(issue('EDGE_NODE_ID_INVALID',at,'Edge endpoints must be lowercase node ids.'));
      if(row.from===row.to)errors.push(issue('EDGE_SELF_REFERENCE',at,'Self edges are refused.'));
      if(!safeContract(row.contract))errors.push(issue('CONTRACT_ID_INVALID',at+'.contract','Contract id must be bounded portable text.'));
      const key=[row.from,row.to,row.contract].join('\u0000');if(edgeKeys.has(key))errors.push(issue('EDGE_DUPLICATE',at,'Duplicate edges are refused.'));edgeKeys.add(key);
    });
    const externalKeys=new Set();
    if(!Array.isArray(request.externalInputs)||request.externalInputs.length>MAX_EDGES)errors.push(issue('EXTERNAL_INPUTS_INVALID','$.externalInputs','External inputs must be an array within the edge ceiling.'));
    else request.externalInputs.forEach(function(row,index){validateBinding(row,'$.externalInputs['+index+']',errors);const key=[row&&row.nodeId,row&&row.contract].join('\u0000');if(externalKeys.has(key))errors.push(issue('EXTERNAL_INPUT_DUPLICATE','$.externalInputs['+index+']','Duplicate external input bindings are refused.'));externalKeys.add(key);});
    const outputKeys=new Set();
    if(!Array.isArray(request.expectedOutputs)||!request.expectedOutputs.length||request.expectedOutputs.length>32)errors.push(issue('EXPECTED_OUTPUTS_INVALID','$.expectedOutputs','Expected outputs require 1 to 32 bindings.'));
    else request.expectedOutputs.forEach(function(row,index){validateBinding(row,'$.expectedOutputs['+index+']',errors);const key=[row&&row.nodeId,row&&row.contract].join('\u0000');if(outputKeys.has(key))errors.push(issue('EXPECTED_OUTPUT_DUPLICATE','$.expectedOutputs['+index+']','Duplicate expected outputs are refused.'));outputKeys.add(key);});
    if(closed(request.limits,['maxNodes','maxEdges','maxTotalCandidateBytes'],'$.limits',errors)){
      if(!Number.isInteger(request.limits.maxNodes)||request.limits.maxNodes<2||request.limits.maxNodes>MAX_NODES)errors.push(issue('NODE_LIMIT_INVALID','$.limits.maxNodes','maxNodes must be 2 to '+MAX_NODES+'.'));
      if(!Number.isInteger(request.limits.maxEdges)||request.limits.maxEdges<1||request.limits.maxEdges>MAX_EDGES)errors.push(issue('EDGE_LIMIT_INVALID','$.limits.maxEdges','maxEdges must be 1 to '+MAX_EDGES+'.'));
      if(!Number.isInteger(request.limits.maxTotalCandidateBytes)||request.limits.maxTotalCandidateBytes<65536||request.limits.maxTotalCandidateBytes>MAX_TOTAL_CANDIDATE_BYTES)errors.push(issue('BYTE_LIMIT_INVALID','$.limits.maxTotalCandidateBytes','Candidate byte ceiling must be 64 KiB to 16 MiB.'));
      if(Array.isArray(request.nodes)&&request.nodes.length>request.limits.maxNodes)errors.push(issue('NODE_LIMIT_EXCEEDED','$.nodes','Node count exceeds the declared request limit.'));
      if(Array.isArray(request.edges)&&request.edges.length>request.limits.maxEdges)errors.push(issue('EDGE_LIMIT_EXCEEDED','$.edges','Edge count exceeds the declared request limit.'));
    }
    if(closed(request.source,['kind','ref'],'$.source',errors)){
      if(!['HUMAN','WORKSHOP_DIRECTION','EXTERNAL','MIRROR','CODE_FABRIC'].includes(request.source.kind))errors.push(issue('SOURCE_KIND_INVALID','$.source.kind','Unsupported source kind.'));
      if(request.source.ref!==null&&(typeof request.source.ref!=='string'||request.source.ref.length>500))errors.push(issue('SOURCE_REF_INVALID','$.source.ref','Source ref must be null or at most 500 characters.'));
    }
    if(request.status!=='EXPERIMENTAL'||request.authority!=='NONE')errors.push(issue('AUTHORITY_CEILING','$','Composition requests remain EXPERIMENTAL with authority NONE.'));
    if(typeof request.humanReviewed!=='boolean')errors.push(issue('HUMAN_REVIEW_FLAG_INVALID','$.humanReviewed','humanReviewed must be boolean.'));
    const expected=isPlain(request)?digest(without(request,'requestDigest')):null;
    if(!safeDigest(request.requestDigest)||request.requestDigest!==expected)errors.push(issue('REQUEST_DIGEST_MISMATCH','$.requestDigest','Composition request digest mismatch.',{expected:expected,actual:request.requestDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function topologicalOrder(nodeIds,edges){
    const indegree=new Map(nodeIds.map(function(id){return [id,0];}));
    const outgoing=new Map(nodeIds.map(function(id){return [id,[]];}));
    edges.forEach(function(edge){if(!indegree.has(edge.from)||!indegree.has(edge.to)||edge.from===edge.to)return;outgoing.get(edge.from).push(edge.to);indegree.set(edge.to,indegree.get(edge.to)+1);});
    outgoing.forEach(function(rows){rows.sort();});
    const queue=nodeIds.filter(function(id){return indegree.get(id)===0;}).sort(),order=[];
    while(queue.length){const id=queue.shift();order.push(id);outgoing.get(id).forEach(function(next){indegree.set(next,indegree.get(next)-1);if(indegree.get(next)===0){queue.push(next);queue.sort();}});}
    return order.length===nodeIds.length?order:null;
  }
  function nodeDescriptor(node,run){
    const candidate=run.candidates[0],contract=JSON.parse(candidate.files['modular-capability.contract.json']);
    return {nodeId:node.id,requestId:node.request.id,requestDigest:node.request.requestDigest,buildPlanDigest:run.plan.planDigest,recipeRef:clone(run.plan.recipeRef),variantId:run.plan.variantId,capabilityKind:candidate.package.capabilityKind,runtimeMode:contract.runtime.mode,provides:clone(contract.provides).sort(),consumes:clone(contract.consumes).sort(),requiredHostCapabilities:clone(contract.requiredHostCapabilities).sort(),packageDigest:candidate.package.packageDigest,totalBytes:candidate.package.totalBytes};
  }
  function planComposition(request,catalog){
    const validation=validateCompositionRequest(request),catalogCheck=Fabric.validateCatalog(catalog),holds=[],descriptors=[];
    if(!validation.ok)holds.push(hold('COMPOSITION_CONTRACT_HOLD','Composition request failed its closed contract.',validation.errors));
    if(!catalogCheck.ok)holds.push(hold('CATALOG_HOLD','Exact reviewed recipe catalog failed validation.',catalogCheck.errors));
    if(validation.ok&&!request.humanReviewed)holds.push(hold('AUTHORITY_HOLD','Human review is required before composition.',[{code:'HUMAN_REVIEW_REQUIRED'}]));
    if(validation.ok&&catalogCheck.ok){
      sortNodes(request.nodes).forEach(function(node){
        try{
          const run=Fabric.build(node.request,catalog);
          if(run.status!=='COMPLETE')holds.push(hold('NODE_BUILD_HOLD','A child capability build is not ready.',{nodeId:node.id,holds:(run.plan&&run.plan.holds)||run.holds||[]}));
          else descriptors.push(nodeDescriptor(node,run));
        }catch(error){holds.push(hold('NODE_BUILD_HOLD','A child capability build failed closed.',{nodeId:node.id,error:String(error&&error.message||error).slice(0,500)}));}
      });
    }
    const totalBytes=descriptors.reduce(function(sum,row){return sum+row.totalBytes;},0);
    if(validation.ok&&totalBytes>request.limits.maxTotalCandidateBytes)holds.push(hold('RESOURCE_HOLD','Planned candidates exceed the declared composition byte ceiling.',{actual:totalBytes,maximum:request.limits.maxTotalCandidateBytes}));
    const byNode=new Map(descriptors.map(function(row){return [row.nodeId,row];}));
    if(validation.ok&&descriptors.length===request.nodes.length){
      request.edges.forEach(function(edge){
        const source=byNode.get(edge.from),target=byNode.get(edge.to);
        if(!source||!target){holds.push(hold('EDGE_NODE_MISSING','Edge endpoint is unavailable.',edge));return;}
        if(!source.provides.includes(edge.contract))holds.push(hold('EDGE_SOURCE_CONTRACT_MISSING','Source node does not provide the exact edge contract.',edge));
        if(!target.consumes.includes(edge.contract))holds.push(hold('EDGE_TARGET_CONTRACT_MISSING','Target node does not consume the exact edge contract.',edge));
      });
      request.externalInputs.forEach(function(binding){const node=byNode.get(binding.nodeId);if(!node||!node.consumes.includes(binding.contract))holds.push(hold('EXTERNAL_INPUT_UNUSED','External input does not bind an exact node input.',binding));});
      request.expectedOutputs.forEach(function(binding){const node=byNode.get(binding.nodeId);if(!node||!node.provides.includes(binding.contract))holds.push(hold('EXPECTED_OUTPUT_MISSING','Expected output is not provided by the named node.',binding));});
      descriptors.forEach(function(node){node.consumes.forEach(function(contract){
        const incoming=request.edges.filter(function(edge){return edge.to===node.nodeId&&edge.contract===contract;}).length;
        const external=request.externalInputs.filter(function(row){return row.nodeId===node.nodeId&&row.contract===contract;}).length;
        if(incoming+external===0)holds.push(hold('INPUT_UNBOUND','Node input has no exact edge or external binding.',{nodeId:node.nodeId,contract:contract}));
        if(incoming+external>1)holds.push(hold('INPUT_BINDING_AMBIGUOUS','Node input has more than one binding.',{nodeId:node.nodeId,contract:contract,incoming:incoming,external:external}));
      });});
    }
    const nodeIds=sortNodes(request&&Array.isArray(request.nodes)?request.nodes:[]).map(function(row){return row.id;}),order=validation.ok?topologicalOrder(nodeIds,request.edges):null;
    if(validation.ok&&!order)holds.push(hold('CYCLE_HOLD','Composition edges must form an acyclic graph.'));
    const hostCapabilities=Array.from(new Set(descriptors.flatMap(function(row){return row.requiredHostCapabilities;}))).sort();
    const evidence={proven:['exact child request, recipe, builder, and package digest lineage','exact declared contract identity on every accepted edge','acyclic deterministic node order','closed resource ceilings and no Fabric-side execution'],notProven:['runtime payload semantic compatibility beyond declared contract identity','availability or authority of required hosts','node selftest results','end-to-end behavior','installation, promotion, or CANON status'],verificationSurfaces:['closed request and catalog validation','deterministic child candidate build and package verification','contract graph and topological-order assertions','separate trusted-host node tests when execution is authorized']};
    const stable={schema:PLAN_SCHEMA,version:VERSION,status:holds.length?'HELD':'READY',requestDigest:request&&request.requestDigest||null,catalogDigest:catalog&&catalog.catalogDigest||null,nodeCount:request&&Array.isArray(request.nodes)?request.nodes.length:0,nodes:descriptors,edges:validation.ok?clone(request.edges):[],externalInputs:validation.ok?clone(request.externalInputs):[],expectedOutputs:validation.ok?clone(request.expectedOutputs):[],order:order||[],requiredHostCapabilities:hostCapabilities,totalCandidateBytes:totalBytes,evidence:evidence,holds:holds,generatedCodeExecuted:false,nodeTestsExecuted:false,authority:clone(AUTHORITY)};
    return Object.assign({},stable,{planDigest:digest(stable)});
  }

  function verifyCompositionPlan(plan,request,catalog){
    const expected=planComposition(request,catalog),checks=[
      {id:'schema',pass:!!plan&&plan.schema===PLAN_SCHEMA&&plan.version===VERSION},
      {id:'digest',pass:!!plan&&safeDigest(plan.planDigest)&&plan.planDigest===digest(without(plan,'planDigest'))},
      {id:'exact-rebuild',pass:canonicalJson(plan)===canonicalJson(expected)},
      {id:'no-execution',pass:!!plan&&plan.generatedCodeExecuted===false&&plan.nodeTestsExecuted===false},
      {id:'authority-closed',pass:!!plan&&authorityClosed(plan.authority)}
    ];
    const stable={schema:VERIFICATION_SCHEMA,version:VERSION,kind:'PLAN',state:checks.every(function(row){return row.pass;})?'PASS':'FAIL',subjectDigest:plan&&plan.planDigest||null,checks:checks,authority:clone(AUTHORITY)};
    return Object.assign({},stable,{verificationDigest:digest(stable)});
  }
  function buildComposition(request,catalog){
    const plan=planComposition(request,catalog);
    if(plan.status!=='READY'){
      const stable={schema:BUILD_SCHEMA,version:VERSION,status:'HELD',request:clone(request),plan:plan,nodes:[],verification:{plan:verifyCompositionPlan(plan,request,catalog).state,rebuildParity:false,nodePackages:false,contractWiring:false},holds:clone(plan.holds),generatedCodeExecuted:false,nodeTestsExecuted:false,authority:clone(AUTHORITY)};
      return Object.assign({},stable,{buildDigest:digest(stable)});
    }
    const nodes=[],failures=[];
    sortNodes(request.nodes).forEach(function(node){
      const one=Fabric.build(node.request,catalog),two=Fabric.build(node.request,catalog);
      const candidate=one.candidates&&one.candidates[0],descriptor=plan.nodes.find(function(row){return row.nodeId===node.id;});
      const verified=!!candidate&&Fabric.verifyCandidate(candidate).ok;
      const parity=canonicalJson(one)===canonicalJson(two);
      if(one.status!=='COMPLETE'||!verified||!parity||!descriptor||candidate.package.packageDigest!==descriptor.packageDigest)failures.push({nodeId:node.id,complete:one.status==='COMPLETE',verified:verified,parity:parity,planBound:!!descriptor&&!!candidate&&candidate.package.packageDigest===descriptor.packageDigest});
      else nodes.push({nodeId:node.id,candidate:candidate});
    });
    if(failures.length){
      const stable={schema:BUILD_SCHEMA,version:VERSION,status:'HELD',request:clone(request),plan:plan,nodes:[],verification:{plan:'PASS',rebuildParity:false,nodePackages:false,contractWiring:true},holds:[hold('REPRODUCIBILITY_HOLD','One or more child candidates failed exact rebuild or package verification.',failures)],generatedCodeExecuted:false,nodeTestsExecuted:false,authority:clone(AUTHORITY)};
      return Object.assign({},stable,{buildDigest:digest(stable)});
    }
    const stable={schema:BUILD_SCHEMA,version:VERSION,status:'COMPLETE',request:clone(request),plan:plan,nodes:nodes,verification:{plan:'PASS',rebuildParity:true,nodePackages:true,contractWiring:true},holds:[],generatedCodeExecuted:false,nodeTestsExecuted:false,authority:clone(AUTHORITY)};
    return Object.assign({},stable,{buildDigest:digest(stable)});
  }
  function verifyComposition(build,catalog){
    const checks=[];function check(id,pass){checks.push({id:id,pass:pass===true});}
    try{
      check('schema',build.schema===BUILD_SCHEMA&&build.version===VERSION&&['COMPLETE','HELD'].includes(build.status));
      check('digest',safeDigest(build.buildDigest)&&build.buildDigest===digest(without(build,'buildDigest')));
      check('request',validateCompositionRequest(build.request).ok);
      check('plan',verifyCompositionPlan(build.plan,build.request,catalog).state==='PASS');
      check('no-execution',build.generatedCodeExecuted===false&&build.nodeTestsExecuted===false);
      check('authority-closed',authorityClosed(build.authority));
      if(build.status==='COMPLETE'){
        check('node-count',Array.isArray(build.nodes)&&build.nodes.length===build.request.nodes.length);
        check('node-packages',build.nodes.every(function(row){const planned=build.plan.nodes.find(function(node){return node.nodeId===row.nodeId;});return planned&&row.candidate&&row.candidate.package.packageDigest===planned.packageDigest&&Fabric.verifyCandidate(row.candidate).ok;}));
        check('verification-claims',build.verification&&build.verification.plan==='PASS'&&build.verification.rebuildParity===true&&build.verification.nodePackages===true&&build.verification.contractWiring===true&&Array.isArray(build.holds)&&build.holds.length===0);
      }else check('held-shape',Array.isArray(build.nodes)&&build.nodes.length===0&&Array.isArray(build.holds)&&build.holds.length>0);
      const rebuilt=buildComposition(build.request,catalog);check('exact-rebuild',canonicalJson(rebuilt)===canonicalJson(build));
    }catch(_){check('parseable',false);}
    const stable={schema:VERIFICATION_SCHEMA,version:VERSION,kind:'BUILD',state:checks.every(function(row){return row.pass;})?'PASS':'FAIL',subjectDigest:build&&build.buildDigest||null,checks:checks,authority:clone(AUTHORITY)};
    return Object.assign({},stable,{verificationDigest:digest(stable)});
  }

  function exampleComposition(catalog,humanReviewed){
    const transform=catalog&&catalog.recipes&&catalog.recipes.find(function(row){return row.id==='pure-json-transform';});
    const review=catalog&&catalog.recipes&&catalog.recipes.find(function(row){return row.id==='closed-capability-review-skill';});
    if(!transform||!review)throw new Error('Reviewed transform and review SKILL recipes are required for the composition example');
    const transformDraft=clone(transform.exampleRequest);transformDraft.id='composition-transform';transformDraft.parameters.outputSchema='axm.capability-review-input/v1';
    const reviewDraft=clone(review.exampleRequest);reviewDraft.id='composition-review';
    return sealCompositionRequest({id:'bounded-review-composition',purpose:'Compose one deterministic transform HAND into one host-mediated bounded review SKILL.',nodes:[{id:'transform',request:Fabric.sealRequest(transformDraft,true)},{id:'review',request:Fabric.sealRequest(reviewDraft,true)}],edges:[{from:'transform',to:'review',contract:'axm.capability-review-input/v1'}],externalInputs:[{nodeId:'transform',contract:'application/json'}],expectedOutputs:[{nodeId:'review',contract:'axm.capability-review-receipt/v1'}],limits:{maxNodes:4,maxEdges:8,maxTotalCandidateBytes:1048576},source:{kind:'HUMAN',ref:'capability-composition-starter'}},humanReviewed===true);
  }

  return {COMPOSITION_VERSION:VERSION,COMPOSITION_REQUEST_SCHEMA:REQUEST_SCHEMA,COMPOSITION_PLAN_SCHEMA:PLAN_SCHEMA,COMPOSITION_BUILD_SCHEMA:BUILD_SCHEMA,COMPOSITION_VERIFICATION_SCHEMA:VERIFICATION_SCHEMA,COMPOSITION_MAX_NODES:MAX_NODES,COMPOSITION_MAX_EDGES:MAX_EDGES,COMPOSITION_MAX_TOTAL_CANDIDATE_BYTES:MAX_TOTAL_CANDIDATE_BYTES,sealCompositionRequest:sealCompositionRequest,validateCompositionRequest:validateCompositionRequest,planComposition:planComposition,verifyCompositionPlan:verifyCompositionPlan,buildComposition:buildComposition,verifyComposition:verifyComposition,exampleComposition:exampleComposition};
});
