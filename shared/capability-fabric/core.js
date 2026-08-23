(function (root, factory) {
  const dependency = typeof module !== 'undefined' && module.exports
    ? require('../deterministic-organ-fabric/core.js')
    : root.AXMDeterministicOrganFabric;
  const api = factory(dependency);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMCapabilityFabric = api;
})(typeof self !== 'undefined' ? self : this, function (deterministicKernel) {
  'use strict';

  if (!deterministicKernel || typeof deterministicKernel.digest !== 'function') {
    throw new Error('AXM deterministic organ kernel is required');
  }

  const FABRIC_VERSION = '1.0.0';
  const REQUEST_SCHEMA = 'axm.capability-fabric.build-request/v1';
  const RECIPE_SCHEMA = 'axm.capability-recipe/v1';
  const CATALOG_SCHEMA = 'axm.capability-recipe-catalog/v1';
  const PLAN_SCHEMA = 'axm.capability-build-plan/v1';
  const PACKAGE_SCHEMA = 'axm.capability-candidate-package/v1';
  const RUN_SCHEMA = 'axm.capability-build-receipt/v1';
  const PROPOSAL_SCHEMA = 'axm.capability-recipe-proposal/v1';
  const ACTIVE_RECIPE = 'ACTIVE_SOURCE_REVIEWED';
  const MAX_PARAMETER_BYTES = 32768;
  const MAX_PACKAGE_FILES = 32;
  const MAX_PACKAGE_BYTES = 1048576;
  const ALLOWED_BUILDERS = Object.freeze(['pure-json-transform-v1', 'svg-status-badge-v1', 'workshop-direction-adapter-v1']);
  const AUTHORITY = Object.freeze({ installed:false, registered:false, staged:false, promoted:false, canonChanged:false, permissionsChanged:false });

  const canonicalJson = deterministicKernel.canonicalJson;
  const digest = deterministicKernel.digest;
  function clone(value) { return JSON.parse(canonicalJson(value)); }
  function pretty(value) { return JSON.stringify(JSON.parse(canonicalJson(value)), null, 2) + '\n'; }
  function own(value, key) { return Object.prototype.hasOwnProperty.call(Object(value), key); }
  function isPlain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function utf8Length(value) {
    const text = typeof value === 'string' ? value : canonicalJson(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text, 'utf8');
  }
  function withoutKey(value, key) { const copy=clone(value); delete copy[key]; return copy; }
  function issue(code, path, message, details) { const row={code:code,path:path,message:message}; if(details!==undefined)row.details=details; return row; }
  function allowedKeys(value, keys, path, errors) {
    if (!isPlain(value)) { errors.push(issue('TYPE_OBJECT_REQUIRED', path, 'Expected an object.')); return false; }
    Object.keys(value).forEach(function (key) { if (keys.indexOf(key) < 0) errors.push(issue('UNKNOWN_FIELD', path + '.' + key, 'Closed schema refuses this field.')); });
    return true;
  }
  function requireKeys(value, keys, path, errors) { keys.forEach(function (key) { if (!own(value,key)) errors.push(issue('REQUIRED_FIELD',path+'.'+key,'Required field is missing.')); }); }
  function typeMatches(value, type) {
    if(type==='integer')return Number.isInteger(value);
    if(type==='number')return typeof value==='number'&&Number.isFinite(value);
    if(type==='array')return Array.isArray(value);
    if(type==='object')return isPlain(value);
    return typeof value===type;
  }
  function safeId(value) { return /^[a-z][a-z0-9-]{2,79}$/.test(String(value||'')); }
  function safeField(value) { return /^[a-z][a-zA-Z0-9]{0,63}$/.test(String(value||'')); }
  function escapeHtml(value) { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function validateRule(rule, path, errors) {
    if(!allowedKeys(rule,['type','required','enum','pattern','minimum','maximum','maxLength','maxBytes','description'],path,errors))return;
    requireKeys(rule,['type','required','description'],path,errors);
    if(['string','integer','number','boolean','object','array'].indexOf(rule.type)<0)errors.push(issue('PARAMETER_TYPE_UNSUPPORTED',path+'.type','Unsupported parameter type.'));
    if(rule.enum&&(!Array.isArray(rule.enum)||!rule.enum.length))errors.push(issue('PARAMETER_ENUM_INVALID',path+'.enum','Enum must be a non-empty array.'));
    if(rule.pattern){try{new RegExp(rule.pattern);}catch(error){errors.push(issue('PARAMETER_PATTERN_INVALID',path+'.pattern',error.message));}}
  }

  function validateRecipe(recipe) {
    const errors=[];
    const keys=['schema','id','version','title','summary','family','builderId','activation','reviewPolicy','candidatePolicy','parameterSpec','exampleRequest','boundaries','verifiers','recipeDigest'];
    if(!allowedKeys(recipe,keys,'$',errors))return {ok:false,errors:errors};
    requireKeys(recipe,keys,'$',errors);
    if(recipe.schema!==RECIPE_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+RECIPE_SCHEMA+'.'));
    if(!safeId(recipe.id))errors.push(issue('RECIPE_ID_INVALID','$.id','Recipe id must be lowercase and hyphenated.'));
    if(ALLOWED_BUILDERS.indexOf(recipe.builderId)<0)errors.push(issue('BUILDER_UNKNOWN','$.builderId','Builder is not compiled into this Fabric.'));
    if(recipe.activation!==ACTIVE_RECIPE)errors.push(issue('RECIPE_INACTIVE','$.activation','Only source-reviewed recipes in the exact catalog are active.'));
    if(!isPlain(recipe.parameterSpec))errors.push(issue('PARAMETER_SPEC_INVALID','$.parameterSpec','Parameter specification must be an object.'));
    else Object.keys(recipe.parameterSpec).sort().forEach(function(key){if(!safeField(key))errors.push(issue('PARAMETER_NAME_INVALID','$.parameterSpec.'+key,'Use lower camel case.'));validateRule(recipe.parameterSpec[key],'$.parameterSpec.'+key,errors);});
    if(!isPlain(recipe.candidatePolicy)||recipe.candidatePolicy.defaultCount!==1||!Array.isArray(recipe.candidatePolicy.variants)||!recipe.candidatePolicy.variants.length)errors.push(issue('CANDIDATE_POLICY_INVALID','$.candidatePolicy','v1 recipes must default to one candidate and declare at least one variant.'));
    else {
      const ids=new Set();
      recipe.candidatePolicy.variants.forEach(function(row,index){const at='$.candidatePolicy.variants['+index+']';if(!allowedKeys(row,['id','title','parameterOverrides'],at,errors))return;requireKeys(row,['id','title','parameterOverrides'],at,errors);if(!safeId(row.id)||ids.has(row.id))errors.push(issue('VARIANT_ID_INVALID',at+'.id','Variant id must be unique and lowercase.'));ids.add(row.id);if(!isPlain(row.parameterOverrides))errors.push(issue('VARIANT_OVERRIDES_INVALID',at+'.parameterOverrides','Overrides must be an object.'));});
    }
    if(!Array.isArray(recipe.boundaries)||!recipe.boundaries.length)errors.push(issue('BOUNDARIES_REQUIRED','$.boundaries','Recipe needs explicit boundaries.'));
    if(!Array.isArray(recipe.verifiers)||!recipe.verifiers.length)errors.push(issue('VERIFIERS_REQUIRED','$.verifiers','Recipe needs external verifier routes.'));
    const expected=digest(withoutKey(recipe,'recipeDigest'));
    if(recipe.recipeDigest!==expected)errors.push(issue('RECIPE_DIGEST_MISMATCH','$.recipeDigest','Recipe digest does not match canonical content.',{expected:expected,actual:recipe.recipeDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function validateCatalog(catalog) {
    const errors=[];
    if(!allowedKeys(catalog,['schema','status','activationPolicy','recipes','catalogDigest'],'$',errors))return {ok:false,errors:errors};
    requireKeys(catalog,['schema','status','activationPolicy','recipes','catalogDigest'],'$',errors);
    if(catalog.schema!==CATALOG_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+CATALOG_SCHEMA+'.'));
    if(catalog.status!=='EXPERIMENTAL')errors.push(issue('CATALOG_STATUS_INVALID','$.status','The v1 catalog remains EXPERIMENTAL.'));
    if(catalog.activationPolicy!=='SOURCE_REVIEW_AND_MIKE_MERGE')errors.push(issue('ACTIVATION_POLICY_INVALID','$.activationPolicy','Active shared recipes require source review and Mike merge.'));
    if(!Array.isArray(catalog.recipes)||!catalog.recipes.length)errors.push(issue('RECIPES_REQUIRED','$.recipes','Catalog requires at least one recipe.'));
    else {
      const ids=new Set();
      catalog.recipes.forEach(function(recipe,index){if(ids.has(recipe&&recipe.id))errors.push(issue('RECIPE_ID_DUPLICATE','$.recipes['+index+'].id','Recipe ids must be unique.'));ids.add(recipe&&recipe.id);validateRecipe(recipe).errors.forEach(function(row){errors.push(issue(row.code,'$.recipes['+index+']'+row.path.slice(1),row.message,row.details));});});
    }
    const expected=digest(withoutKey(catalog,'catalogDigest'));
    if(catalog.catalogDigest!==expected)errors.push(issue('CATALOG_DIGEST_MISMATCH','$.catalogDigest','Catalog digest does not match canonical content.',{expected:expected,actual:catalog.catalogDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function sealRequest(draft, humanReviewed) {
    draft=isPlain(draft)?clone(draft):{};
    const request={
      schema:REQUEST_SCHEMA,
      id:String(draft.id||''),
      family:String(draft.family||''),
      purpose:String(draft.purpose||''),
      recipeId:draft.recipeId==null?null:String(draft.recipeId),
      variantId:draft.variantId==null?null:String(draft.variantId),
      parameters:isPlain(draft.parameters)?clone(draft.parameters):{},
      source:isPlain(draft.source)?clone(draft.source):{kind:'HUMAN',ref:null},
      status:'EXPERIMENTAL',
      authority:'NONE',
      humanReviewed:humanReviewed===undefined?draft.humanReviewed===true:humanReviewed===true,
      requestDigest:''
    };
    if(!own(request.source,'ref'))request.source.ref=null;
    request.requestDigest=digest(withoutKey(request,'requestDigest'));
    return request;
  }

  function validateRequest(request) {
    const errors=[];
    const keys=['schema','id','family','purpose','recipeId','variantId','parameters','source','status','authority','humanReviewed','requestDigest'];
    if(!allowedKeys(request,keys,'$',errors))return {ok:false,errors:errors};
    requireKeys(request,keys,'$',errors);
    if(request.schema!==REQUEST_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+REQUEST_SCHEMA+'.'));
    if(!safeId(request.id))errors.push(issue('REQUEST_ID_INVALID','$.id','Request id must be lowercase and hyphenated.'));
    if(!safeId(request.family))errors.push(issue('FAMILY_INVALID','$.family','Family must be lowercase and hyphenated.'));
    if(!String(request.purpose||'').trim()||String(request.purpose).length>500)errors.push(issue('PURPOSE_INVALID','$.purpose','Purpose must contain 1 to 500 characters.'));
    if(request.recipeId!==null&&!safeId(request.recipeId))errors.push(issue('RECIPE_ID_INVALID','$.recipeId','Recipe id must be null or lowercase and hyphenated.'));
    if(request.variantId!==null&&!safeId(request.variantId))errors.push(issue('VARIANT_ID_INVALID','$.variantId','Variant id must be null or lowercase and hyphenated.'));
    if(!isPlain(request.parameters))errors.push(issue('PARAMETERS_INVALID','$.parameters','Parameters must be an object.'));
    else if(utf8Length(request.parameters)>MAX_PARAMETER_BYTES)errors.push(issue('PARAMETER_BYTES_EXCEEDED','$.parameters','Parameters exceed the 32 KiB ceiling.'));
    if(!allowedKeys(request.source,['kind','ref'],'$.source',errors))errors.push(issue('SOURCE_INVALID','$.source','Source must be a closed object.'));
    else if(['HUMAN','WORKSHOP_DIRECTION','EXTERNAL','MIRROR','CODE_FABRIC'].indexOf(request.source.kind)<0)errors.push(issue('SOURCE_KIND_INVALID','$.source.kind','Unsupported source kind.'));
    if(request.status!=='EXPERIMENTAL'||request.authority!=='NONE')errors.push(issue('AUTHORITY_CEILING','$','Build requests remain EXPERIMENTAL with authority NONE.'));
    if(typeof request.humanReviewed!=='boolean')errors.push(issue('HUMAN_REVIEW_FLAG_INVALID','$.humanReviewed','humanReviewed must be boolean.'));
    const expected=digest(withoutKey(request,'requestDigest'));
    if(request.requestDigest!==expected)errors.push(issue('REQUEST_DIGEST_MISMATCH','$.requestDigest','Request digest does not match canonical content.',{expected:expected,actual:request.requestDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function validateParameters(parameters, recipe) {
    const errors=[],spec=recipe.parameterSpec||{};
    Object.keys(parameters||{}).forEach(function(key){if(!own(spec,key))errors.push(issue('UNKNOWN_PARAMETER','$.parameters.'+key,'Recipe does not declare this parameter.'));});
    Object.keys(spec).sort().forEach(function(key){const rule=spec[key],present=own(parameters,key),value=parameters[key],at='$.parameters.'+key;if(rule.required&&!present){errors.push(issue('PARAMETER_REQUIRED',at,'Required recipe parameter is missing.'));return;}if(!present)return;if(!typeMatches(value,rule.type)){errors.push(issue('PARAMETER_TYPE_MISMATCH',at,'Expected '+rule.type+'.'));return;}if(rule.enum&&rule.enum.indexOf(value)<0)errors.push(issue('PARAMETER_ENUM_MISMATCH',at,'Value is outside the declared enum.'));if(rule.pattern&&typeof value==='string'&&!new RegExp(rule.pattern).test(value))errors.push(issue('PARAMETER_PATTERN_MISMATCH',at,'Value does not match the declared pattern.'));if(rule.maxLength!==undefined&&typeof value==='string'&&value.length>rule.maxLength)errors.push(issue('PARAMETER_LENGTH_EXCEEDED',at,'String exceeds the declared length.'));if(rule.minimum!==undefined&&Number(value)<Number(rule.minimum))errors.push(issue('PARAMETER_MINIMUM',at,'Value is below the declared minimum.'));if(rule.maximum!==undefined&&Number(value)>Number(rule.maximum))errors.push(issue('PARAMETER_MAXIMUM',at,'Value is above the declared maximum.'));if(rule.maxBytes!==undefined&&utf8Length(value)>rule.maxBytes)errors.push(issue('PARAMETER_BYTES_EXCEEDED',at,'Value exceeds the declared byte ceiling.'));});
    return {ok:errors.length===0,errors:errors};
  }

  function hold(code, message, details) { const row={code:code,message:message};if(details!==undefined)row.details=details;return row; }
  function planBuild(request,catalog) {
    const catalogCheck=validateCatalog(catalog),requestCheck=validateRequest(request),holds=[];
    if(!catalogCheck.ok)holds.push(hold('CATALOG_HOLD','Exact reviewed recipe catalog failed validation.',catalogCheck.errors));
    if(!requestCheck.ok)holds.push(hold('CONTRACT_HOLD','Build request failed its closed contract.',requestCheck.errors));
    let recipe=null,variant=null;
    if(!holds.length&&!request.humanReviewed)holds.push(hold('AUTHORITY_HOLD','Human review is required before compilation.',[{code:'HUMAN_REVIEW_REQUIRED'}]));
    if(!holds.length){
      const active=catalog.recipes.filter(function(row){return row.activation===ACTIVE_RECIPE;});
      if(request.recipeId){
        recipe=active.find(function(row){return row.id===request.recipeId;})||null;
        if(!recipe)holds.push(hold('MISSING_RECIPE','The exact active recipe id is unavailable.',{recipeId:request.recipeId}));
      } else {
        const matches=active.filter(function(row){return row.family===request.family;});
        if(!matches.length)holds.push(hold('MISSING_RECIPE','No active recipe exactly matches this family.',{family:request.family}));
        else if(matches.length>1)holds.push(hold('RECIPE_SELECTION_REQUIRED','More than one active recipe exactly matches; select a recipe id.',{recipeIds:matches.map(function(row){return row.id;}).sort()}));
        else recipe=matches[0];
      }
    }
    if(recipe&&!holds.length){
      const parameterCheck=validateParameters(request.parameters,recipe);if(!parameterCheck.ok)holds.push(hold('CONTRACT_HOLD','Recipe parameters failed validation.',parameterCheck.errors));
      const variants=recipe.candidatePolicy.variants;
      if(request.variantId)variant=variants.find(function(row){return row.id===request.variantId;})||null;
      else variant=variants[0];
      if(!variant)holds.push(hold('MISSING_VARIANT','Requested recipe variant is unavailable.',{variantId:request.variantId}));
    }
    const plan={schema:PLAN_SCHEMA,fabricVersion:FABRIC_VERSION,status:holds.length?'HELD':'READY',requestDigest:request&&request.requestDigest||null,catalogDigest:catalog&&catalog.catalogDigest||null,recipeRef:recipe?{id:recipe.id,version:recipe.version,digest:recipe.recipeDigest,builderId:recipe.builderId}:null,variantId:variant&&variant.id||null,candidateCount:holds.length?0:1,holds:holds,generatedCodeExecuted:false,authority:clone(AUTHORITY),planDigest:''};
    plan.planDigest=digest(withoutKey(plan,'planDigest'));
    return plan;
  }

  function jsonTransformSource(parameters) {
    const config={inputField:parameters.inputField,outputField:parameters.outputField,defaultValue:parameters.defaultValue,outputSchema:parameters.outputSchema,maxInputKeys:parameters.maxInputKeys};
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction own(v,k){return Object.prototype.hasOwnProperty.call(Object(v),k);}\nfunction run(input){if(!input||typeof input!=='object'||Array.isArray(input))return {schema:CONFIG.outputSchema,ok:false,code:'INPUT_OBJECT_REQUIRED'};if(Object.keys(input).length>CONFIG.maxInputKeys)return {schema:CONFIG.outputSchema,ok:false,code:'INPUT_KEY_LIMIT'};const output={};output[CONFIG.outputField]=own(input,CONFIG.inputField)?input[CONFIG.inputField]:CONFIG.defaultValue;return {schema:CONFIG.outputSchema,ok:true,output:output};}\nmodule.exports={CONFIG:CONFIG,run:run};\n";
  }
  function jsonTransformSelftest(parameters) {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');let input={};input["+JSON.stringify(parameters.inputField)+"]='proof';const result=capability.run(input);assert.equal(result.ok,true);assert.equal(result.output["+JSON.stringify(parameters.outputField)+"],'proof');const fallback=capability.run({});assert.deepStrictEqual(fallback.output["+JSON.stringify(parameters.outputField)+"],"+JSON.stringify(parameters.defaultValue)+");console.log('PASS pure JSON transform capability');\n";
  }
  function svgBadgeSource(parameters) {
    const config={label:parameters.label,value:parameters.value,background:parameters.background,foreground:parameters.foreground,width:parameters.width};
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction esc(v){return String(v).slice(0,48).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#39;');}\nfunction render(input){input=input&&typeof input==='object'&&!Array.isArray(input)?input:{};const label=esc(input.label==null?CONFIG.label:input.label),value=esc(input.value==null?CONFIG.value:input.value),split=Math.floor(CONFIG.width*0.58);const svg='<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" role=\\\"img\\\" aria-label=\\\"'+label+': '+value+'\\\"><rect width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.background+'\\\"/><rect x=\\\"'+split+'\\\" width=\\\"'+(CONFIG.width-split)+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.foreground+'\\\"/><text x=\\\"10\\\" y=\\\"19\\\" fill=\\\"#ffffff\\\" font-family=\\\"system-ui,sans-serif\\\" font-size=\\\"13\\\">'+label+'</text><text x=\\\"'+(split+8)+'\\\" y=\\\"19\\\" fill=\\\"#081018\\\" font-family=\\\"system-ui,sans-serif\\\" font-size=\\\"13\\\" font-weight=\\\"700\\\">'+value+'</text></svg>';return {schema:'axm.creation.svg-status-badge/v1',ok:true,mimeType:'image/svg+xml',svg:svg};}\nmodule.exports={CONFIG:CONFIG,render:render};\n";
  }
  function svgBadgeSelftest() { return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const first=capability.render({label:'A&B',value:'<ok>'}),second=capability.render({label:'A&B',value:'<ok>'});assert.equal(first.ok,true);assert.equal(first.svg,second.svg);assert(first.svg.includes('A&amp;B'));assert(first.svg.includes('&lt;ok&gt;'));console.log('PASS deterministic SVG badge capability');\n"; }
  function directionAdapterSource(parameters) {
    const config={targetRecipeId:parameters.targetRecipeId,targetFamily:parameters.targetFamily,targetParameters:parameters.targetParameters,idSuffix:parameters.idSuffix};
    return "'use strict';\nconst crypto=require('crypto');const CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}\nfunction sha(v){return 'sha256:'+crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');}\nfunction slug(v){return String(v||'capability').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'capability';}\nfunction adapt(input){if(!input||input.schema!=='axm.workshop-direction.hand-request/v1')return {ok:false,code:'HAND_REQUEST_SCHEMA_REQUIRED'};for(const key of ['handRequestId','targetModuleId','title','reason','desiredContract'])if(!String(input[key]||''))return {ok:false,code:'HAND_REQUEST_FIELD_REQUIRED',field:key};const request={schema:'axm.capability-fabric.build-request/v1',id:slug(input.targetModuleId)+'-'+CONFIG.idSuffix,family:CONFIG.targetFamily,purpose:String(input.title)+' — '+String(input.reason),recipeId:CONFIG.targetRecipeId,variantId:null,parameters:CONFIG.targetParameters,source:{kind:'WORKSHOP_DIRECTION',ref:String(input.handRequestId)},status:'EXPERIMENTAL',authority:'NONE',humanReviewed:false,requestDigest:''};const copy=JSON.parse(JSON.stringify(request));delete copy.requestDigest;request.requestDigest=sha(copy);return {ok:true,status:'HUMAN_REVIEW_REQUIRED',request:request,installed:false,promoted:false};}\nmodule.exports={CONFIG:CONFIG,adapt:adapt};\n";
  }
  function directionAdapterSelftest() { return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const hand={schema:'axm.workshop-direction.hand-request/v1',handRequestId:'hand-proof',targetModuleId:'proof-module',title:'Build proof module',reason:'Missing bounded hand',desiredContract:'axm.direction-hand/proof/v1'};const one=capability.adapt(hand),two=capability.adapt(hand);assert.equal(one.ok,true);assert.equal(one.status,'HUMAN_REVIEW_REQUIRED');assert.equal(one.request.humanReviewed,false);assert.equal(one.request.requestDigest,two.request.requestDigest);console.log('PASS Workshop Direction adapter capability');\n"; }
  function compileArtifact(recipe, parameters) {
    if(recipe.builderId==='pure-json-transform-v1')return {source:jsonTransformSource(parameters),selftest:jsonTransformSelftest(parameters),provides:[parameters.outputSchema],consumes:['application/json'],summary:'Pure bounded JSON field transform.'};
    if(recipe.builderId==='svg-status-badge-v1')return {source:svgBadgeSource(parameters),selftest:svgBadgeSelftest(parameters),provides:['axm.creation.svg-status-badge/v1','image/svg+xml'],consumes:['application/json'],summary:'Deterministic text-only SVG status badge creation hand.'};
    if(recipe.builderId==='workshop-direction-adapter-v1')return {source:directionAdapterSource(parameters),selftest:directionAdapterSelftest(parameters),provides:[REQUEST_SCHEMA],consumes:['axm.workshop-direction.hand-request/v1'],summary:'Bounded Workshop Direction hand-request adapter; output remains human-review held.'};
    throw new Error('Unknown compiled builder: '+recipe.builderId);
  }

  function buildCandidate(request, catalog, plan) {
    if(!plan||plan.status!=='READY')throw new Error('READY build plan required.');
    if(plan.requestDigest!==request.requestDigest||plan.catalogDigest!==catalog.catalogDigest)throw new Error('Build plan lineage drift.');
    const recipe=catalog.recipes.find(function(row){return row.id===plan.recipeRef.id&&row.recipeDigest===plan.recipeRef.digest;});
    if(!recipe)throw new Error('Exact planned recipe unavailable.');
    const variant=recipe.candidatePolicy.variants.find(function(row){return row.id===plan.variantId;});
    if(!variant)throw new Error('Exact planned variant unavailable.');
    const parameters=Object.assign({},clone(request.parameters),clone(variant.parameterOverrides));
    const parameterCheck=validateParameters(parameters,recipe);if(!parameterCheck.ok)throw new Error('Variant parameters failed validation.');
    const artifact=compileArtifact(recipe,parameters),moduleId=request.id+(variant.id==='standard'?'':'-'+variant.id),version='v0.1';
    const manifest={schema:'axm.module-manifest/v1',id:moduleId,name:recipe.title+' — '+request.id,version:version,status:'EXPERIMENTAL',entry:'index.html',contract:'module.contract.json',uses:[],installed:false,promoted:false};
    const contract={schema:'axm.module-contract/v1',id:moduleId,version:version,provides:artifact.provides,consumes:artifact.consumes,permissions:[],handoffs:{emits:artifact.provides,accepts:artifact.consumes.concat(['human-review'])},lifecycle:{state_owner:'none',reload:'not-applicable',disconnect:'not-applicable',cleanup:'not-applicable'},boundaries:{writes:[],refuses:['network','filesystem','dynamic-code','implicit-randomness','automatic-test-execution','installation','registration','staging','promotion','permission-change','canon-change','foundation-mutation']}};
    const compilation={schema:'axm.capability-compilation-receipt/v1',fabricVersion:FABRIC_VERSION,status:'EXPERIMENTAL',requestDigest:request.requestDigest,catalogDigest:catalog.catalogDigest,recipeRef:plan.recipeRef,variantId:variant.id,builderId:recipe.builderId,generatedCodeExecuted:false,testsEmitted:true,authority:clone(AUTHORITY),compilationDigest:''};
    compilation.compilationDigest=digest(withoutKey(compilation,'compilationDigest'));
    const files={
      'manifest.json':pretty(manifest),
      'module.contract.json':pretty(contract),
      'index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(manifest.name)+'</title><style>body{font:16px system-ui;max-width:52rem;margin:4rem auto;padding:0 1rem;background:#0b1118;color:#edf7f4}code{color:#79e6c2}.boundary{border:1px solid #395066;padding:1rem;border-radius:12px}</style><h1>'+escapeHtml(manifest.name)+'</h1><p>'+escapeHtml(artifact.summary)+'</p><p>Recipe: <code>'+escapeHtml(recipe.id)+'@'+escapeHtml(recipe.version)+'</code></p><div class="boundary"><strong>EXPERIMENTAL · DETACHED</strong><p>Static inspection only. This page executes no generated capability code.</p></div></html>\n',
      'README.md':'# '+manifest.name+'\n\n'+artifact.summary+'\n\nGenerated deterministically from recipe `'+recipe.id+'@'+recipe.version+'`. The candidate is detached and EXPERIMENTAL. Run `node selftest.js` only from an explicitly trusted host entry point.\n',
      'capability.js':artifact.source.replace(/\r\n/g,'\n'),
      'selftest.js':artifact.selftest.replace(/\r\n/g,'\n'),
      'build-request.json':pretty(request),
      'capability-recipe.json':pretty(recipe),
      'compilation.receipt.json':pretty(compilation),
      'evidence-route.json':pretty({schema:'axm.evidence-route/v1',claims:[{claim:'Same exact request and recipe rebuild identical candidate bytes.',evidence:'Capability Fabric deterministic rebuild test and package verification.'},{claim:'Candidate structure is ready for later governed intake.',evidence:'Detached Candidate Nursery structural scan.'},{claim:'Generated behavior meets its focused contract.',evidence:'Externally executed emitted selftest.js.'}],notProven:['general usefulness','fitness for undeclared tasks','visual approval unless separately observed','runtime safety outside declared boundaries','installation readiness','promotion or CANON status']})
    };
    const receipt={schema:'axm.module-candidate-receipt/v1',candidate:{id:moduleId,name:manifest.name,version:version,status:'EXPERIMENTAL',location:'detached-capability-candidate'},source:{kind:'capability-fabric',requestDigest:request.requestDigest,recipeDigest:recipe.recipeDigest,compilationDigest:compilation.compilationDigest},authority:clone(AUTHORITY),boundaries:['detached-package','no-self-install','no-self-promotion','host-review-required']};
    files['candidate.receipt.json']=pretty(receipt);
    const bundleFiles=Object.keys(files).sort().map(function(path){return {path:path,encoding:'utf8',sha256:digest(files[path]).slice(7),content:files[path]};});
    files['module-bundle.json']=pretty({schema:'axm.module-bundle/v1',id:moduleId,version:version,requiredSeats:1,files:bundleFiles});
    const fileRows=Object.keys(files).sort().map(function(path){return {path:path,bytes:utf8Length(files[path]),digest:digest(files[path])};});
    const totalBytes=fileRows.reduce(function(sum,row){return sum+row.bytes;},0);
    if(fileRows.length>MAX_PACKAGE_FILES)throw new Error('Package file ceiling exceeded.');
    if(totalBytes>MAX_PACKAGE_BYTES)throw new Error('Package byte ceiling exceeded.');
    const descriptor={schema:PACKAGE_SCHEMA,id:moduleId,version:version,status:'EXPERIMENTAL',requestDigest:request.requestDigest,catalogDigest:catalog.catalogDigest,recipeRef:plan.recipeRef,variantId:variant.id,compilationDigest:compilation.compilationDigest,files:fileRows,totalBytes:totalBytes,authority:clone(AUTHORITY),packageDigest:''};
    descriptor.packageDigest=digest(withoutKey(descriptor,'packageDigest'));
    return {package:descriptor,files:files,compilation:compilation};
  }

  function verifyCandidate(candidate) {
    const errors=[];
    if(!candidate||!candidate.package||!candidate.files)return {ok:false,errors:[issue('PACKAGE_SHAPE_INVALID','$','Expected package and files.')]};
    const paths=Object.keys(candidate.files).sort(),declared=(candidate.package.files||[]).map(function(row){return row.path;});
    if(canonicalJson(paths)!==canonicalJson(declared))errors.push(issue('PACKAGE_FILE_SET_MISMATCH','$.files','Declared and actual file sets differ.'));
    (candidate.package.files||[]).forEach(function(row){if(!own(candidate.files,row.path))return;const actual=digest(candidate.files[row.path]);if(actual!==row.digest)errors.push(issue('PACKAGE_FILE_TAMPERED','$.files.'+row.path,'File digest mismatch.',{expected:row.digest,actual:actual}));});
    const expected=digest(withoutKey(candidate.package,'packageDigest'));if(expected!==candidate.package.packageDigest)errors.push(issue('PACKAGE_DIGEST_MISMATCH','$.package.packageDigest','Package digest mismatch.'));
    try{
      const request=JSON.parse(candidate.files['build-request.json']),recipe=JSON.parse(candidate.files['capability-recipe.json']),compilation=JSON.parse(candidate.files['compilation.receipt.json']),receipt=JSON.parse(candidate.files['candidate.receipt.json']);
      if(validateRequest(request).ok!==true||request.requestDigest!==candidate.package.requestDigest)errors.push(issue('REQUEST_LINEAGE_DRIFT','$.files.build-request.json','Embedded request is invalid or unbound.'));
      if(validateRecipe(recipe).ok!==true||recipe.recipeDigest!==candidate.package.recipeRef.digest)errors.push(issue('RECIPE_LINEAGE_DRIFT','$.files.capability-recipe.json','Embedded recipe is invalid or unbound.'));
      if(compilation.compilationDigest!==candidate.package.compilationDigest||compilation.compilationDigest!==digest(withoutKey(compilation,'compilationDigest')))errors.push(issue('COMPILATION_LINEAGE_DRIFT','$.files.compilation.receipt.json','Compilation receipt drifted.'));
      Object.keys(AUTHORITY).forEach(function(key){if(receipt.authority[key]!==false)errors.push(issue('DETACHED_AUTHORITY_CONFLICT','$.files.candidate.receipt.json.authority.'+key,'Detached authority must be false.'));});
    }catch(error){errors.push(issue('BOUND_JSON_INVALID','$.files',String(error.message||error)));}
    try{
      const bundle=JSON.parse(candidate.files['module-bundle.json']),covered=Object.keys(candidate.files).filter(function(path){return path!=='module-bundle.json';}).sort();
      if(bundle.schema!=='axm.module-bundle/v1'||canonicalJson(bundle.files.map(function(row){return row.path;}))!==canonicalJson(covered))errors.push(issue('BUNDLE_DRIFT','$.files.module-bundle.json','Bundle does not cover the exact non-self file set.'));
      (bundle.files||[]).forEach(function(row){if(candidate.files[row.path]!==row.content||digest(row.content).slice(7)!==row.sha256)errors.push(issue('BUNDLE_FILE_DRIFT','$.files.'+row.path,'Bundled content differs.'));});
    }catch(error){errors.push(issue('BUNDLE_INVALID','$.files.module-bundle.json',String(error.message||error)));}
    return {ok:errors.length===0,errors:errors,packageDigest:candidate.package.packageDigest};
  }

  function build(request,catalog) {
    const plan=planBuild(request,catalog);
    if(plan.status!=='READY'){const held={schema:RUN_SCHEMA,fabricVersion:FABRIC_VERSION,status:'HELD',plan:plan,candidates:[],generatedCodeExecuted:false,authority:clone(AUTHORITY),runDigest:''};held.runDigest=digest(withoutKey(held,'runDigest'));return held;}
    const candidate=buildCandidate(request,catalog,plan),rebuilt=buildCandidate(request,catalog,plan),verification=verifyCandidate(candidate),parity=canonicalJson(candidate)===canonicalJson(rebuilt);
    if(!verification.ok||!parity){const failed={schema:RUN_SCHEMA,fabricVersion:FABRIC_VERSION,status:'HELD',plan:plan,candidates:[],holds:[hold('REPRODUCIBILITY_HOLD','Candidate integrity or deterministic rebuild failed.',{verification:verification,parity:parity})],generatedCodeExecuted:false,authority:clone(AUTHORITY),runDigest:''};failed.runDigest=digest(withoutKey(failed,'runDigest'));return failed;}
    const run={schema:RUN_SCHEMA,fabricVersion:FABRIC_VERSION,status:'COMPLETE',plan:plan,candidates:[candidate],verification:{package:verification.ok,rebuildParity:parity},generatedCodeExecuted:false,testsEmitted:true,authority:clone(AUTHORITY),runDigest:''};
    run.runDigest=digest({schema:run.schema,fabricVersion:run.fabricVersion,status:run.status,planDigest:plan.planDigest,candidateDigests:run.candidates.map(function(row){return row.package.packageDigest;}),verification:run.verification,generatedCodeExecuted:false,testsEmitted:true,authority:run.authority});
    return run;
  }

  function importRecipeProposal(envelope) {
    const errors=[];
    if(!allowedKeys(envelope,['schema','sourceKind','recipe','proposalDigest'],'$',errors))return {ok:false,errors:errors};
    requireKeys(envelope,['schema','sourceKind','recipe','proposalDigest'],'$',errors);
    if(envelope.schema!==PROPOSAL_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+PROPOSAL_SCHEMA+'.'));
    if(['MIRROR','CODE_FABRIC','EXTERNAL','AI'].indexOf(envelope.sourceKind)<0)errors.push(issue('PROPOSAL_SOURCE_INVALID','$.sourceKind','Unsupported proposal source.'));
    if(envelope.proposalDigest!==digest(envelope.recipe))errors.push(issue('PROPOSAL_DIGEST_MISMATCH','$.proposalDigest','Proposal digest mismatch.'));
    if(errors.length)return {ok:false,errors:errors};
    return {ok:true,status:'INACTIVE_PROPOSAL',active:false,sourceKind:envelope.sourceKind,recipe:clone(envelope.recipe),proposalDigest:envelope.proposalDigest,requiresSourceReview:true,requiresMikeMerge:true,providerCalled:false,authority:clone(AUTHORITY)};
  }

  function adaptHandRequest(handRequest,target) {
    const required=['handRequestId','targetModuleId','title','reason','desiredContract'];
    if(!isPlain(handRequest)||handRequest.schema!=='axm.workshop-direction.hand-request/v1')return {ok:false,status:'HELD',holds:[hold('CONTRACT_HOLD','Expected Workshop Direction hand-request v1.')]};
    const missing=required.filter(function(key){return !String(handRequest[key]||'').trim();});if(missing.length)return {ok:false,status:'HELD',holds:[hold('CONTRACT_HOLD','Hand request is missing required fields.',{fields:missing})]};
    if(!isPlain(target)||!safeId(target.recipeId)||!safeId(target.family)||!isPlain(target.parameters))return {ok:false,status:'HELD',holds:[hold('CONTRACT_HOLD','Explicit target recipe, family, and parameters are required.')]};
    const draft={id:String(handRequest.targetModuleId).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)+'-'+String(target.idSuffix||'capability'),family:target.family,purpose:String(handRequest.title)+' — '+String(handRequest.reason),recipeId:target.recipeId,variantId:null,parameters:target.parameters,source:{kind:'WORKSHOP_DIRECTION',ref:String(handRequest.handRequestId)}};
    return {ok:true,status:'HUMAN_REVIEW_REQUIRED',request:sealRequest(draft,false),holds:[hold('AUTHORITY_HOLD','Adapted requests require human review before build.')],built:false,authority:clone(AUTHORITY)};
  }

  return {
    FABRIC_VERSION:FABRIC_VERSION,REQUEST_SCHEMA:REQUEST_SCHEMA,RECIPE_SCHEMA:RECIPE_SCHEMA,CATALOG_SCHEMA:CATALOG_SCHEMA,PLAN_SCHEMA:PLAN_SCHEMA,PACKAGE_SCHEMA:PACKAGE_SCHEMA,RUN_SCHEMA:RUN_SCHEMA,PROPOSAL_SCHEMA:PROPOSAL_SCHEMA,ACTIVE_RECIPE:ACTIVE_RECIPE,AUTHORITY:AUTHORITY,ALLOWED_BUILDERS:ALLOWED_BUILDERS,
    canonicalJson:canonicalJson,digest:digest,clone:clone,sealRequest:sealRequest,validateRequest:validateRequest,validateRecipe:validateRecipe,validateCatalog:validateCatalog,validateParameters:validateParameters,planBuild:planBuild,buildCandidate:buildCandidate,verifyCandidate:verifyCandidate,build:build,importRecipeProposal:importRecipeProposal,adaptHandRequest:adaptHandRequest
  };
});
