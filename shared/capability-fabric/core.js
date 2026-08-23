(function (root, factory) {
  const dependency = typeof module !== 'undefined' && module.exports
    ? require('../deterministic-organ-fabric/core.js')
    : root.AXMDeterministicOrganFabric;
  const builderRegistry = typeof module !== 'undefined' && module.exports
    ? require('./builder-registry.js')
    : root.AXMCapabilityBuilderRegistry;
  const api = factory(dependency, builderRegistry);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMCapabilityFabric = api;
})(typeof self !== 'undefined' ? self : this, function (deterministicKernel, builderRegistry) {
  'use strict';

  if (!deterministicKernel || typeof deterministicKernel.digest !== 'function') {
    throw new Error('AXM deterministic organ kernel is required');
  }
  if (!builderRegistry || typeof builderRegistry.compileActive !== 'function') {
    throw new Error('AXM capability builder registry is required');
  }

  const FABRIC_VERSION = '1.3.0';
  const REQUEST_SCHEMA = 'axm.capability-fabric.build-request/v1';
  const RECIPE_SCHEMA = 'axm.capability-recipe/v1';
  const CATALOG_SCHEMA = 'axm.capability-recipe-catalog/v1';
  const PLAN_SCHEMA = 'axm.capability-build-plan/v1';
  const PACKAGE_SCHEMA = 'axm.capability-candidate-package/v1';
  const RUN_SCHEMA = 'axm.capability-build-receipt/v1';
  const PROPOSAL_SCHEMA = 'axm.capability-recipe-proposal/v1';
  const PROPOSAL_RECIPE_SCHEMA = 'axm.capability-recipe-draft/v1';
  const ACTIVE_RECIPE = 'ACTIVE_SOURCE_REVIEWED';
  const CAPABILITY_KINDS = Object.freeze(['HAND', 'SKILL']);
  const MAX_PARAMETER_BYTES = 32768;
  const MAX_PROPOSAL_BYTES = 131072;
  const MAX_PACKAGE_FILES = 32;
  const MAX_PACKAGE_BYTES = 1048576;
  const ALLOWED_BUILDERS = Object.freeze(builderRegistry.activeIds());
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
  function safeVersion(value) { return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(value||'')); }
  function safeDigest(value) { return /^sha256:[a-f0-9]{64}$/.test(String(value||'')); }
  function safePackagePath(value) { return typeof value==='string'&&value.length>0&&value.length<=240&&!value.includes('\0')&&!/^(?:[A-Za-z]:|[\\/])/.test(value)&&value.replace(/\\/g,'/').split('/').every(function(part){return part&&part!=='.'&&part!=='..';}); }
  function escapeHtml(value) { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function mergeParameters(base, overrides) {
    const result=Object.create(null);
    Object.keys(base||{}).sort().forEach(function(key){result[key]=clone(base[key]);});
    Object.keys(overrides||{}).sort().forEach(function(key){result[key]=clone(overrides[key]);});
    return clone(result);
  }
  function validateStringList(value,path,errors,code) {
    if(!Array.isArray(value)||!value.length){errors.push(issue(code,path,'Expected a non-empty string array.'));return;}
    const seen=new Set();
    value.forEach(function(row,index){const at=path+'['+index+']';if(typeof row!=='string'||!row.trim()||row.length>500){errors.push(issue(code,at,'Expected 1 to 500 characters.'));return;}if(seen.has(row))errors.push(issue(code,at,'Duplicate entries are refused.'));seen.add(row);});
  }
  function falseAuthority(value,path,errors) {
    if(!allowedKeys(value,Object.keys(AUTHORITY),path,errors))return;
    requireKeys(value,Object.keys(AUTHORITY),path,errors);
    Object.keys(AUTHORITY).forEach(function(key){if(value[key]!==false)errors.push(issue('DETACHED_AUTHORITY_CONFLICT',path+'.'+key,'Detached authority must be false.'));});
  }

  function validateRule(rule, path, errors) {
    if(!allowedKeys(rule,['type','required','enum','pattern','minimum','maximum','maxLength','maxBytes','description'],path,errors))return;
    requireKeys(rule,['type','required','description'],path,errors);
    if(['string','integer','number','boolean','object','array'].indexOf(rule.type)<0)errors.push(issue('PARAMETER_TYPE_UNSUPPORTED',path+'.type','Unsupported parameter type.'));
    if(typeof rule.required!=='boolean')errors.push(issue('PARAMETER_REQUIRED_FLAG_INVALID',path+'.required','required must be boolean.'));
    if(typeof rule.description!=='string'||!rule.description.trim()||rule.description.length>500)errors.push(issue('PARAMETER_DESCRIPTION_INVALID',path+'.description','Description must contain 1 to 500 characters.'));
    if(own(rule,'enum')){
      if(!Array.isArray(rule.enum)||!rule.enum.length)errors.push(issue('PARAMETER_ENUM_INVALID',path+'.enum','Enum must be a non-empty array.'));
      else {const seen=new Set();rule.enum.forEach(function(value,index){if(!typeMatches(value,rule.type))errors.push(issue('PARAMETER_ENUM_TYPE_MISMATCH',path+'.enum['+index+']','Enum value must match the rule type.'));const key=canonicalJson(value);if(seen.has(key))errors.push(issue('PARAMETER_ENUM_DUPLICATE',path+'.enum['+index+']','Enum values must be unique.'));seen.add(key);});}
    }
    if(own(rule,'pattern')){if(rule.type!=='string'||typeof rule.pattern!=='string')errors.push(issue('PARAMETER_PATTERN_INVALID',path+'.pattern','Pattern is allowed only as a string constraint.'));else try{new RegExp(rule.pattern);}catch(error){errors.push(issue('PARAMETER_PATTERN_INVALID',path+'.pattern',error.message));}}
    ['minimum','maximum'].forEach(function(key){if(own(rule,key)&&(['integer','number'].indexOf(rule.type)<0||typeof rule[key]!=='number'||!Number.isFinite(rule[key])))errors.push(issue('PARAMETER_RANGE_INVALID',path+'.'+key,'Numeric bounds require a finite number rule.'));});
    if(own(rule,'minimum')&&own(rule,'maximum')&&rule.minimum>rule.maximum)errors.push(issue('PARAMETER_RANGE_INVALID',path,'minimum cannot exceed maximum.'));
    if(own(rule,'maxLength')&&(rule.type!=='string'||!Number.isInteger(rule.maxLength)||rule.maxLength<1))errors.push(issue('PARAMETER_LENGTH_RULE_INVALID',path+'.maxLength','maxLength requires a positive integer string rule.'));
    if(own(rule,'maxBytes')&&(!Number.isInteger(rule.maxBytes)||rule.maxBytes<1||rule.maxBytes>MAX_PARAMETER_BYTES))errors.push(issue('PARAMETER_BYTE_RULE_INVALID',path+'.maxBytes','maxBytes must be a positive integer within the parameter ceiling.'));
  }

  function validateCapabilityContract(kind, contract, path, errors) {
    const keys=['runtimeMode','entry','operation','portableForm','portablePath','resultContractPolicy','requiredHostCapabilities'];
    if(!allowedKeys(contract,keys,path,errors))return;
    requireKeys(contract,keys,path,errors);
    if(CAPABILITY_KINDS.indexOf(kind)<0)errors.push(issue('CAPABILITY_KIND_INVALID',path.replace(/\.capabilityContract$/,'.capabilityKind'),'Capability kind must be HAND or SKILL.'));
    if(['EXECUTABLE','HOST_MEDIATED','INSTRUCTION_ONLY'].indexOf(contract.runtimeMode)<0)errors.push(issue('RUNTIME_MODE_INVALID',path+'.runtimeMode','Unsupported modular capability runtime mode.'));
    if(contract.entry!==null&&(typeof contract.entry!=='string'||!safePackagePath(contract.entry)))errors.push(issue('RUNTIME_ENTRY_INVALID',path+'.entry','Runtime entry must be null or a safe package path.'));
    if(typeof contract.operation!=='string'||!/^[a-z][a-zA-Z0-9]{1,63}$/.test(contract.operation))errors.push(issue('RUNTIME_OPERATION_INVALID',path+'.operation','Runtime operation must be lower camel case.'));
    if(['NONE','SKILL_MD'].indexOf(contract.portableForm)<0)errors.push(issue('PORTABLE_FORM_INVALID',path+'.portableForm','Portable form must be NONE or SKILL_MD.'));
    if(contract.portablePath!==null&&(typeof contract.portablePath!=='string'||!safePackagePath(contract.portablePath)))errors.push(issue('PORTABLE_PATH_INVALID',path+'.portablePath','Portable path must be null or a safe package path.'));
    if(contract.resultContractPolicy!=='BUILDER_PROVIDES_EXACT')errors.push(issue('RESULT_CONTRACT_POLICY_INVALID',path+'.resultContractPolicy','Builder output must declare exact provided contracts.'));
    if(!Array.isArray(contract.requiredHostCapabilities)||contract.requiredHostCapabilities.length>32)errors.push(issue('HOST_CAPABILITIES_INVALID',path+'.requiredHostCapabilities','Host capabilities must be an array of at most 32 unique contract ids.'));
    else {const seen=new Set();contract.requiredHostCapabilities.forEach(function(value,index){if(typeof value!=='string'||!value.trim()||value.length>180||seen.has(value))errors.push(issue('HOST_CAPABILITIES_INVALID',path+'.requiredHostCapabilities['+index+']','Host capability ids must be unique strings of 1 to 180 characters.'));seen.add(value);});}
    if(kind==='HAND'&&(contract.runtimeMode!=='EXECUTABLE'||contract.entry!=='capability.js'||contract.portableForm!=='NONE'||contract.portablePath!==null))errors.push(issue('HAND_CONTRACT_INVALID',path,'HAND requires executable capability.js and no portable skill form.'));
    if(kind==='SKILL'&&(contract.portableForm!=='SKILL_MD'||contract.portablePath!=='SKILL.md'))errors.push(issue('SKILL_CONTRACT_INVALID',path,'SKILL requires the portable SKILL.md form.'));
    if(kind==='SKILL'&&contract.runtimeMode==='EXECUTABLE'&&contract.entry!=='capability.js')errors.push(issue('SKILL_RUNTIME_ENTRY_INVALID',path+'.entry','Executable SKILL requires capability.js.'));
    if(kind==='SKILL'&&contract.runtimeMode!=='EXECUTABLE'&&contract.entry!==null)errors.push(issue('SKILL_RUNTIME_ENTRY_INVALID',path+'.entry','Non-executable SKILL runtime entry must be null.'));
  }

  function validateRecipe(recipe) {
    const errors=[];
    const keys=['schema','id','version','title','summary','family','capabilityKind','capabilityContract','builderId','builderDigest','activation','reviewPolicy','candidatePolicy','parameterSpec','exampleRequest','boundaries','verifiers','recipeDigest'];
    if(!allowedKeys(recipe,keys,'$',errors))return {ok:false,errors:errors};
    requireKeys(recipe,keys,'$',errors);
    if(recipe.schema!==RECIPE_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+RECIPE_SCHEMA+'.'));
    if(!safeId(recipe.id))errors.push(issue('RECIPE_ID_INVALID','$.id','Recipe id must be lowercase and hyphenated.'));
    if(!safeVersion(recipe.version))errors.push(issue('RECIPE_VERSION_INVALID','$.version','Recipe version must be numeric semantic version text.'));
    if(typeof recipe.title!=='string'||!recipe.title.trim()||recipe.title.length>120)errors.push(issue('RECIPE_TITLE_INVALID','$.title','Title must contain 1 to 120 characters.'));
    if(typeof recipe.summary!=='string'||!recipe.summary.trim()||recipe.summary.length>500)errors.push(issue('RECIPE_SUMMARY_INVALID','$.summary','Summary must contain 1 to 500 characters.'));
    if(!safeId(recipe.family))errors.push(issue('RECIPE_FAMILY_INVALID','$.family','Family must be lowercase and hyphenated.'));
    validateCapabilityContract(recipe.capabilityKind,recipe.capabilityContract,'$.capabilityContract',errors);
    const compiledBuilder=builderRegistry.describe(recipe.builderId);
    if(ALLOWED_BUILDERS.indexOf(recipe.builderId)<0||!compiledBuilder||compiledBuilder.status!==builderRegistry.ACTIVE)errors.push(issue('BUILDER_UNKNOWN','$.builderId','Builder is not active and source reviewed in this Fabric.'));
    if(!safeDigest(recipe.builderDigest)||!compiledBuilder||recipe.builderDigest!==compiledBuilder.implementationDigest||recipe.capabilityKind!==compiledBuilder.capabilityKind)errors.push(issue('BUILDER_DIGEST_MISMATCH','$.builderDigest','Recipe does not bind the exact active builder implementation and kind.'));
    if(recipe.activation!==ACTIVE_RECIPE)errors.push(issue('RECIPE_INACTIVE','$.activation','Only source-reviewed recipes in the exact catalog are active.'));
    if(allowedKeys(recipe.reviewPolicy,['activation','sharedUseRequires','canonAuthority'],'$.reviewPolicy',errors)){
      requireKeys(recipe.reviewPolicy,['activation','sharedUseRequires','canonAuthority'],'$.reviewPolicy',errors);
      if(recipe.reviewPolicy.activation!=='source-review-and-merge'||recipe.reviewPolicy.sharedUseRequires!=='MIKE_TOBI_MERGE'||recipe.reviewPolicy.canonAuthority!=='NONE')errors.push(issue('REVIEW_POLICY_INVALID','$.reviewPolicy','Recipe review policy cannot grant activation or CANON authority.'));
    }
    if(!isPlain(recipe.parameterSpec))errors.push(issue('PARAMETER_SPEC_INVALID','$.parameterSpec','Parameter specification must be an object.'));
    else Object.keys(recipe.parameterSpec).sort().forEach(function(key){if(!safeField(key))errors.push(issue('PARAMETER_NAME_INVALID','$.parameterSpec.'+key,'Use lower camel case.'));validateRule(recipe.parameterSpec[key],'$.parameterSpec.'+key,errors);});
    if(!isPlain(recipe.candidatePolicy)||!allowedKeys(recipe.candidatePolicy,['defaultCount','defaultVariantId','variants'],'$.candidatePolicy',errors)||recipe.candidatePolicy.defaultCount!==1||!safeId(recipe.candidatePolicy.defaultVariantId)||!Array.isArray(recipe.candidatePolicy.variants)||!recipe.candidatePolicy.variants.length)errors.push(issue('CANDIDATE_POLICY_INVALID','$.candidatePolicy','v1 recipes must name one default variant and build one candidate.'));
    else {
      const ids=new Set();
      recipe.candidatePolicy.variants.forEach(function(row,index){const at='$.candidatePolicy.variants['+index+']';if(!allowedKeys(row,['id','title','parameterOverrides'],at,errors))return;requireKeys(row,['id','title','parameterOverrides'],at,errors);if(!safeId(row.id)||ids.has(row.id))errors.push(issue('VARIANT_ID_INVALID',at+'.id','Variant id must be unique and lowercase.'));ids.add(row.id);if(typeof row.title!=='string'||!row.title.trim()||row.title.length>120)errors.push(issue('VARIANT_TITLE_INVALID',at+'.title','Variant title must contain 1 to 120 characters.'));if(!isPlain(row.parameterOverrides))errors.push(issue('VARIANT_OVERRIDES_INVALID',at+'.parameterOverrides','Overrides must be an object.'));else validateParameters(row.parameterOverrides,recipe,{requireRequired:false}).errors.forEach(function(error){errors.push(issue(error.code,at+'.parameterOverrides'+error.path.slice('$.parameters'.length),error.message,error.details));});});
      if(!ids.has(recipe.candidatePolicy.defaultVariantId))errors.push(issue('DEFAULT_VARIANT_MISSING','$.candidatePolicy.defaultVariantId','Default variant id must name one declared variant.'));
    }
    validateStringList(recipe.boundaries,'$.boundaries',errors,'BOUNDARIES_REQUIRED');
    validateStringList(recipe.verifiers,'$.verifiers',errors,'VERIFIERS_REQUIRED');
    if(isPlain(recipe.exampleRequest)){
      const draftKeys=['id','family','purpose','recipeId','variantId','parameters','source'];
      allowedKeys(recipe.exampleRequest,draftKeys,'$.exampleRequest',errors);requireKeys(recipe.exampleRequest,draftKeys,'$.exampleRequest',errors);
      if(recipe.exampleRequest.recipeId!==recipe.id||recipe.exampleRequest.family!==recipe.family)errors.push(issue('EXAMPLE_RECIPE_MISMATCH','$.exampleRequest','Example request must explicitly target this recipe and family.'));
      const sealed=sealRequest(recipe.exampleRequest,true),requestCheck=validateRequest(sealed);
      requestCheck.errors.forEach(function(error){errors.push(issue(error.code,'$.exampleRequest'+error.path.slice(1),error.message,error.details));});
      const defaultVariant=isPlain(recipe.candidatePolicy)&&Array.isArray(recipe.candidatePolicy.variants)?recipe.candidatePolicy.variants.find(function(row){return row&&row.id===recipe.candidatePolicy.defaultVariantId;}):null;
      if(defaultVariant&&isPlain(defaultVariant.parameterOverrides))validateParameters(mergeParameters(sealed.parameters,defaultVariant.parameterOverrides),recipe).errors.forEach(function(error){errors.push(issue(error.code,'$.exampleRequest'+error.path.slice(1),error.message,error.details));});
    } else errors.push(issue('EXAMPLE_REQUEST_INVALID','$.exampleRequest','Recipe requires a closed example request object.'));
    const expected=digest(withoutKey(recipe,'recipeDigest'));
    if(!safeDigest(recipe.recipeDigest)||recipe.recipeDigest!==expected)errors.push(issue('RECIPE_DIGEST_MISMATCH','$.recipeDigest','Recipe digest does not match canonical content.',{expected:expected,actual:recipe.recipeDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function validateCatalog(catalog) {
    const errors=[];
    if(!allowedKeys(catalog,['schema','status','activationPolicy','recipes','catalogDigest'],'$',errors))return {ok:false,errors:errors};
    requireKeys(catalog,['schema','status','activationPolicy','recipes','catalogDigest'],'$',errors);
    if(catalog.schema!==CATALOG_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+CATALOG_SCHEMA+'.'));
    if(catalog.status!=='EXPERIMENTAL')errors.push(issue('CATALOG_STATUS_INVALID','$.status','The v1 catalog remains EXPERIMENTAL.'));
    if(catalog.activationPolicy!=='SOURCE_REVIEW_AND_MIKE_MERGE')errors.push(issue('ACTIVATION_POLICY_INVALID','$.activationPolicy','Active shared recipes require source review and Mike merge.'));
    if(!Array.isArray(catalog.recipes)||!catalog.recipes.length||catalog.recipes.length>128)errors.push(issue('RECIPES_REQUIRED','$.recipes','Catalog requires 1 to 128 recipes.'));
    else {
      const ids=new Set();
      catalog.recipes.forEach(function(recipe,index){if(ids.has(recipe&&recipe.id))errors.push(issue('RECIPE_ID_DUPLICATE','$.recipes['+index+'].id','Recipe ids must be unique.'));ids.add(recipe&&recipe.id);validateRecipe(recipe).errors.forEach(function(row){errors.push(issue(row.code,'$.recipes['+index+']'+row.path.slice(1),row.message,row.details));});});
    }
    const expected=digest(withoutKey(catalog,'catalogDigest'));
    if(!safeDigest(catalog.catalogDigest)||catalog.catalogDigest!==expected)errors.push(issue('CATALOG_DIGEST_MISMATCH','$.catalogDigest','Catalog digest does not match canonical content.',{expected:expected,actual:catalog.catalogDigest}));
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
    else {requireKeys(request.source,['kind','ref'],'$.source',errors);if(['HUMAN','WORKSHOP_DIRECTION','EXTERNAL','MIRROR','CODE_FABRIC'].indexOf(request.source.kind)<0)errors.push(issue('SOURCE_KIND_INVALID','$.source.kind','Unsupported source kind.'));if(request.source.ref!==null&&(typeof request.source.ref!=='string'||request.source.ref.length>500))errors.push(issue('SOURCE_REF_INVALID','$.source.ref','Source ref must be null or at most 500 characters.'));}
    if(request.status!=='EXPERIMENTAL'||request.authority!=='NONE')errors.push(issue('AUTHORITY_CEILING','$','Build requests remain EXPERIMENTAL with authority NONE.'));
    if(typeof request.humanReviewed!=='boolean')errors.push(issue('HUMAN_REVIEW_FLAG_INVALID','$.humanReviewed','humanReviewed must be boolean.'));
    const expected=digest(withoutKey(request,'requestDigest'));
    if(!safeDigest(request.requestDigest)||request.requestDigest!==expected)errors.push(issue('REQUEST_DIGEST_MISMATCH','$.requestDigest','Request digest does not match canonical content.',{expected:expected,actual:request.requestDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function validateParameters(parameters, recipe, options) {
    const errors=[],spec=recipe.parameterSpec||{},requireRequired=!options||options.requireRequired!==false;
    if(!isPlain(parameters))return {ok:false,errors:[issue('PARAMETERS_INVALID','$.parameters','Parameters must be an object.')]};
    Object.keys(parameters||{}).forEach(function(key){if(!own(spec,key))errors.push(issue('UNKNOWN_PARAMETER','$.parameters.'+key,'Recipe does not declare this parameter.'));});
    Object.keys(spec).sort().forEach(function(key){const rule=spec[key],present=own(parameters,key),value=parameters[key],at='$.parameters.'+key;if(requireRequired&&rule.required&&!present){errors.push(issue('PARAMETER_REQUIRED',at,'Required recipe parameter is missing.'));return;}if(!present)return;if(!typeMatches(value,rule.type)){errors.push(issue('PARAMETER_TYPE_MISMATCH',at,'Expected '+rule.type+'.'));return;}if(rule.enum&&rule.enum.indexOf(value)<0)errors.push(issue('PARAMETER_ENUM_MISMATCH',at,'Value is outside the declared enum.'));if(rule.pattern&&typeof value==='string'&&!new RegExp(rule.pattern).test(value))errors.push(issue('PARAMETER_PATTERN_MISMATCH',at,'Value does not match the declared pattern.'));if(rule.maxLength!==undefined&&typeof value==='string'&&value.length>rule.maxLength)errors.push(issue('PARAMETER_LENGTH_EXCEEDED',at,'String exceeds the declared length.'));if(rule.minimum!==undefined&&Number(value)<Number(rule.minimum))errors.push(issue('PARAMETER_MINIMUM',at,'Value is below the declared minimum.'));if(rule.maximum!==undefined&&Number(value)>Number(rule.maximum))errors.push(issue('PARAMETER_MAXIMUM',at,'Value is above the declared maximum.'));if(rule.maxBytes!==undefined&&utf8Length(value)>rule.maxBytes)errors.push(issue('PARAMETER_BYTES_EXCEEDED',at,'Value exceeds the declared byte ceiling.'));});
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
      const variants=recipe.candidatePolicy.variants;
      if(request.variantId)variant=variants.find(function(row){return row.id===request.variantId;})||null;
      else variant=variants.find(function(row){return row.id===recipe.candidatePolicy.defaultVariantId;})||null;
      if(!variant)holds.push(hold('MISSING_VARIANT','Requested recipe variant is unavailable.',{variantId:request.variantId}));
      else {const parameterCheck=validateParameters(mergeParameters(request.parameters,variant.parameterOverrides),recipe);if(!parameterCheck.ok)holds.push(hold('CONTRACT_HOLD','Resolved recipe parameters failed validation.',parameterCheck.errors));}
    }
    const plan={schema:PLAN_SCHEMA,fabricVersion:FABRIC_VERSION,status:holds.length?'HELD':'READY',requestDigest:request&&request.requestDigest||null,catalogDigest:catalog&&catalog.catalogDigest||null,recipeRef:recipe?{id:recipe.id,version:recipe.version,digest:recipe.recipeDigest,builderId:recipe.builderId,builderDigest:recipe.builderDigest,capabilityKind:recipe.capabilityKind}:null,variantId:variant&&variant.id||null,candidateCount:holds.length?0:1,holds:holds,generatedCodeExecuted:false,authority:clone(AUTHORITY),planDigest:''};
    plan.planDigest=digest(withoutKey(plan,'planDigest'));
    return plan;
  }

  function validateCompiledArtifact(recipe, artifact) {
    const errors=[];
    if(!isPlain(recipe)||!isPlain(artifact))return {ok:false,errors:[issue('COMPILED_ARTIFACT_INVALID','$','Recipe and compiled artifact must be objects.') ]};
    const common=['capabilityKind','provides','consumes','summary'];
    common.forEach(function(key){if(!own(artifact,key))errors.push(issue('COMPILED_ARTIFACT_FIELD_REQUIRED','$.artifact.'+key,'Compiled artifact field is required.'));});
    Object.keys(artifact).forEach(function(key){if(common.concat(recipe.capabilityKind==='HAND'?['source','selftest']:['portableFiles']).indexOf(key)<0)errors.push(issue('COMPILED_ARTIFACT_FIELD_UNKNOWN','$.artifact.'+key,'Compiled artifact shape is closed for its modular kind.'));});
    if(artifact.capabilityKind!==recipe.capabilityKind)errors.push(issue('COMPILED_ARTIFACT_KIND_MISMATCH','$.artifact.capabilityKind','Builder output kind must match the reviewed recipe.'));
    validateStringList(artifact.provides,'$.artifact.provides',errors,'COMPILED_PROVIDES_INVALID');
    validateStringList(artifact.consumes,'$.artifact.consumes',errors,'COMPILED_CONSUMES_INVALID');
    if(typeof artifact.summary!=='string'||!artifact.summary.trim()||artifact.summary.length>500)errors.push(issue('COMPILED_SUMMARY_INVALID','$.artifact.summary','Compiled artifact summary is required and bounded.'));
    if(recipe.capabilityKind==='HAND'){
      ['source','selftest'].forEach(function(key){if(typeof artifact[key]!=='string'||!artifact[key].trim()||utf8Length(artifact[key])>131072)errors.push(issue('COMPILED_HAND_SOURCE_INVALID','$.artifact.'+key,'HAND source and selftest must be non-empty UTF-8 text within 128 KiB.'));});
    }
    if(recipe.capabilityKind==='SKILL'){
      const portable=artifact.portableFiles,required=['SKILL.md','skill.contract.json','skill.selftest.js'];
      if(!isPlain(portable)||canonicalJson(Object.keys(portable).sort())!==canonicalJson(required))errors.push(issue('COMPILED_SKILL_FILES_INVALID','$.artifact.portableFiles','SKILL must emit exact SKILL.md, skill.contract.json, and skill.selftest.js portable files.'));
      else required.forEach(function(path){if(typeof portable[path]!=='string'||!portable[path].trim()||utf8Length(portable[path])>131072)errors.push(issue('COMPILED_SKILL_FILE_INVALID','$.artifact.portableFiles.'+path,'Portable skill file is empty or exceeds 128 KiB.'));});
      if(isPlain(portable))try{const descriptor=JSON.parse(portable['skill.contract.json']);if(!isPlain(descriptor)||descriptor.schema!=='axm.portable-skill-contract/v1'||descriptor.kind!=='SKILL'||descriptor.status!=='EXPERIMENTAL'||descriptor.authorityInherited!==false||descriptor.installed!==false||descriptor.promoted!==false||descriptor.canon!==false)errors.push(issue('COMPILED_SKILL_CONTRACT_INVALID','$.artifact.portableFiles.skill.contract.json','Portable skill contract weakened identity or authority.'));}catch(error){errors.push(issue('COMPILED_SKILL_CONTRACT_INVALID','$.artifact.portableFiles.skill.contract.json',String(error.message||error)));}
    }
    return {ok:errors.length===0,errors:errors};
  }
  function compileArtifact(recipe, parameters) {
    return builderRegistry.compileActive(recipe.builderId,recipe.builderDigest,parameters);
  }

  function buildCandidate(request, catalog, plan) {
    const expectedPlan=planBuild(request,catalog);
    if(expectedPlan.status!=='READY'||!plan||plan.status!=='READY')throw new Error('READY build plan required.');
    if(canonicalJson(plan)!==canonicalJson(expectedPlan))throw new Error('Build plan lineage drift.');
    const recipe=catalog.recipes.find(function(row){return row.id===plan.recipeRef.id&&row.recipeDigest===plan.recipeRef.digest;});
    if(!recipe)throw new Error('Exact planned recipe unavailable.');
    const variant=recipe.candidatePolicy.variants.find(function(row){return row.id===plan.variantId;});
    if(!variant)throw new Error('Exact planned variant unavailable.');
    const parameters=mergeParameters(request.parameters,variant.parameterOverrides);
    const parameterCheck=validateParameters(parameters,recipe);if(!parameterCheck.ok)throw new Error('Variant parameters failed validation.');
    const artifact=compileArtifact(recipe,parameters),moduleId=request.id+(variant.id==='standard'?'':'-'+variant.id),version='v0.1';
    const artifactCheck=validateCompiledArtifact(recipe,artifact);if(!artifactCheck.ok)throw new Error('Compiled artifact contract failed: '+artifactCheck.errors.map(function(row){return row.code;}).join(', '));
    const manifest={schema:'axm.module-manifest/v1',id:moduleId,name:recipe.title+' — '+request.id,version:version,status:'EXPERIMENTAL',capabilityKind:recipe.capabilityKind,entry:'index.html',contract:'module.contract.json',uses:[],installed:false,promoted:false};
    const contract={schema:'axm.module-contract/v1',id:moduleId,version:version,capabilityKind:recipe.capabilityKind,modularCapabilityContract:'modular-capability.contract.json',provides:artifact.provides,consumes:artifact.consumes,permissions:[],handoffs:{emits:artifact.provides,accepts:artifact.consumes.concat(['human-review'])},lifecycle:{state_owner:'none',reload:'not-applicable',disconnect:'not-applicable',cleanup:'not-applicable'},boundaries:{writes:[],refuses:['network','filesystem','dynamic-code','implicit-randomness','automatic-test-execution','installation','registration','staging','promotion','permission-change','canon-change','foundation-mutation']}};
    const modularContract={schema:'axm.modular-capability-contract/v1',id:moduleId,version:version,kind:recipe.capabilityKind,runtime:{mode:recipe.capabilityContract.runtimeMode,entry:recipe.capabilityContract.entry,operation:recipe.capabilityContract.operation},portable:{form:recipe.capabilityContract.portableForm,path:recipe.capabilityContract.portablePath},provides:artifact.provides,consumes:artifact.consumes,resultContractPolicy:recipe.capabilityContract.resultContractPolicy,requiredHostCapabilities:recipe.capabilityContract.requiredHostCapabilities,permissions:[],status:'EXPERIMENTAL',installed:false,promoted:false,canon:false,contractDigest:''};
    modularContract.contractDigest=digest(withoutKey(modularContract,'contractDigest'));
    const compilation={schema:'axm.capability-compilation-receipt/v1',fabricVersion:FABRIC_VERSION,status:'EXPERIMENTAL',capabilityKind:recipe.capabilityKind,requestDigest:request.requestDigest,catalogDigest:catalog.catalogDigest,recipeRef:plan.recipeRef,variantId:variant.id,builderId:recipe.builderId,generatedCodeExecuted:false,testsEmitted:true,authority:clone(AUTHORITY),compilationDigest:''};
    compilation.compilationDigest=digest(withoutKey(compilation,'compilationDigest'));
    const files={
      'manifest.json':pretty(manifest),
      'module.contract.json':pretty(contract),
      'modular-capability.contract.json':pretty(modularContract),
      'index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(manifest.name)+'</title><style>body{font:16px system-ui;max-width:52rem;margin:4rem auto;padding:0 1rem;background:#0b1118;color:#edf7f4}code{color:#79e6c2}.boundary{border:1px solid #395066;padding:1rem;border-radius:12px}</style><h1>'+escapeHtml(manifest.name)+'</h1><p>'+escapeHtml(artifact.summary)+'</p><p>Recipe: <code>'+escapeHtml(recipe.id)+'@'+escapeHtml(recipe.version)+'</code></p><div class="boundary"><strong>EXPERIMENTAL · DETACHED</strong><p>Static inspection only. This page executes no generated capability code.</p></div></html>\n',
      'README.md':'# '+manifest.name+'\n\n'+artifact.summary+'\n\nGenerated deterministically from recipe `'+recipe.id+'@'+recipe.version+'`. The candidate is detached and EXPERIMENTAL. Run `node selftest.js` only from an explicitly trusted host entry point.\n',
      'build-request.json':pretty(request),
      'capability-recipe.json':pretty(recipe),
      'compilation.receipt.json':pretty(compilation),
      'evidence-route.json':pretty({schema:'axm.evidence-route/v1',claims:[{claim:'Same exact request and recipe rebuild identical candidate bytes.',evidence:'Capability Fabric deterministic rebuild test and package verification.'},{claim:'Candidate structure is ready for later governed intake.',evidence:'Detached Candidate Nursery structural scan.'},{claim:'Generated behavior meets its focused contract.',evidence:'Externally executed emitted selftest.js.'}],notProven:['general usefulness','fitness for undeclared tasks','visual approval unless separately observed','runtime safety outside declared boundaries','installation readiness','promotion or CANON status']})
    };
    if(recipe.capabilityKind==='HAND'){
      files['capability.js']=artifact.source.replace(/\r\n/g,'\n');
      files['selftest.js']=artifact.selftest.replace(/\r\n/g,'\n');
    }else Object.keys(artifact.portableFiles).sort().forEach(function(path){files[path]=artifact.portableFiles[path].replace(/\r\n/g,'\n');});
    const receipt={schema:'axm.module-candidate-receipt/v1',candidate:{id:moduleId,name:manifest.name,version:version,status:'EXPERIMENTAL',capabilityKind:recipe.capabilityKind,location:'detached-capability-candidate'},source:{kind:'capability-fabric',requestDigest:request.requestDigest,recipeDigest:recipe.recipeDigest,compilationDigest:compilation.compilationDigest},authority:clone(AUTHORITY),boundaries:['detached-package','no-self-install','no-self-promotion','host-review-required']};
    files['candidate.receipt.json']=pretty(receipt);
    const bundleFiles=Object.keys(files).sort().map(function(path){return {path:path,encoding:'utf8',sha256:digest(files[path]).slice(7),content:files[path]};});
    files['module-bundle.json']=pretty({schema:'axm.module-bundle/v1',id:moduleId,version:version,requiredSeats:1,files:bundleFiles});
    const fileRows=Object.keys(files).sort().map(function(path){return {path:path,bytes:utf8Length(files[path]),digest:digest(files[path])};});
    const totalBytes=fileRows.reduce(function(sum,row){return sum+row.bytes;},0);
    if(fileRows.length>MAX_PACKAGE_FILES)throw new Error('Package file ceiling exceeded.');
    if(totalBytes>MAX_PACKAGE_BYTES)throw new Error('Package byte ceiling exceeded.');
    const descriptor={schema:PACKAGE_SCHEMA,id:moduleId,version:version,status:'EXPERIMENTAL',capabilityKind:recipe.capabilityKind,requestDigest:request.requestDigest,catalogDigest:catalog.catalogDigest,recipeRef:plan.recipeRef,variantId:variant.id,compilationDigest:compilation.compilationDigest,files:fileRows,totalBytes:totalBytes,authority:clone(AUTHORITY),packageDigest:''};
    descriptor.packageDigest=digest(withoutKey(descriptor,'packageDigest'));
    return {package:descriptor,files:files,compilation:compilation};
  }

  function verifyCandidate(candidate) {
    const errors=[];
    if(!isPlain(candidate)||!isPlain(candidate.package)||!isPlain(candidate.files))return {ok:false,errors:[issue('PACKAGE_SHAPE_INVALID','$','Expected package and plain file-map objects.')]};
    allowedKeys(candidate,['package','files','compilation'],'$',errors);
    const descriptor=candidate.package,descriptorKeys=['schema','id','version','status','capabilityKind','requestDigest','catalogDigest','recipeRef','variantId','compilationDigest','files','totalBytes','authority','packageDigest'];
    if(allowedKeys(descriptor,descriptorKeys,'$.package',errors))requireKeys(descriptor,descriptorKeys,'$.package',errors);
    if(descriptor.schema!==PACKAGE_SCHEMA)errors.push(issue('PACKAGE_SCHEMA_MISMATCH','$.package.schema','Expected '+PACKAGE_SCHEMA+'.'));
    if(!safeId(descriptor.id))errors.push(issue('PACKAGE_ID_INVALID','$.package.id','Package id must be lowercase and hyphenated.'));
    if(descriptor.version!=='v0.1'||descriptor.status!=='EXPERIMENTAL')errors.push(issue('PACKAGE_STATUS_INVALID','$.package','Capability candidates remain v0.1 and EXPERIMENTAL.'));
    if(CAPABILITY_KINDS.indexOf(descriptor.capabilityKind)<0)errors.push(issue('PACKAGE_KIND_INVALID','$.package.capabilityKind','Package must bind a first-class HAND or SKILL kind.'));
    ['requestDigest','catalogDigest','compilationDigest','packageDigest'].forEach(function(key){if(!safeDigest(descriptor[key]))errors.push(issue('PACKAGE_DIGEST_FORMAT_INVALID','$.package.'+key,'Expected sha256 digest text.'));});
    if(allowedKeys(descriptor.recipeRef,['id','version','digest','builderId','builderDigest','capabilityKind'],'$.package.recipeRef',errors)){
      requireKeys(descriptor.recipeRef,['id','version','digest','builderId','builderDigest','capabilityKind'],'$.package.recipeRef',errors);
      const packagedBuilder=builderRegistry.describe(descriptor.recipeRef.builderId);
      if(!safeId(descriptor.recipeRef.id)||!safeVersion(descriptor.recipeRef.version)||!safeDigest(descriptor.recipeRef.digest)||!safeDigest(descriptor.recipeRef.builderDigest)||ALLOWED_BUILDERS.indexOf(descriptor.recipeRef.builderId)<0||!packagedBuilder||packagedBuilder.implementationDigest!==descriptor.recipeRef.builderDigest||descriptor.recipeRef.capabilityKind!==descriptor.capabilityKind)errors.push(issue('PACKAGE_RECIPE_REF_INVALID','$.package.recipeRef','Recipe reference is malformed, kind-drifted, or names an unavailable builder implementation.'));
    }
    if(!safeId(descriptor.variantId))errors.push(issue('PACKAGE_VARIANT_INVALID','$.package.variantId','Variant id must be lowercase and hyphenated.'));
    falseAuthority(descriptor.authority,'$.package.authority',errors);

    const paths=Object.keys(candidate.files).sort(),declared=[],seen=new Set();let declaredBytes=0;
    if(!Array.isArray(descriptor.files)||!descriptor.files.length||descriptor.files.length>MAX_PACKAGE_FILES)errors.push(issue('PACKAGE_FILES_INVALID','$.package.files','Package must declare 1 to '+MAX_PACKAGE_FILES+' files.'));
    else descriptor.files.forEach(function(row,index){
      const at='$.package.files['+index+']';
      if(!allowedKeys(row,['path','bytes','digest'],at,errors))return;
      requireKeys(row,['path','bytes','digest'],at,errors);declared.push(row.path);
      if(!safePackagePath(row.path)||seen.has(row.path))errors.push(issue('PACKAGE_PATH_UNSAFE',at+'.path','File path must be unique, relative, and traversal-free.'));seen.add(row.path);
      if(!Number.isInteger(row.bytes)||row.bytes<0)errors.push(issue('PACKAGE_FILE_BYTES_INVALID',at+'.bytes','Declared bytes must be a non-negative integer.'));
      if(!safeDigest(row.digest))errors.push(issue('PACKAGE_FILE_DIGEST_INVALID',at+'.digest','Declared file digest is malformed.'));
      if(!own(candidate.files,row.path)){errors.push(issue('PACKAGE_FILE_MISSING','$.files.'+row.path,'Declared file is missing.'));return;}
      const content=candidate.files[row.path];
      if(typeof content!=='string'){errors.push(issue('PACKAGE_FILE_CONTENT_INVALID','$.files.'+row.path,'Candidate file content must be UTF-8 text.'));return;}
      const actualBytes=utf8Length(content),actualDigest=digest(content);declaredBytes+=actualBytes;
      if(row.bytes!==actualBytes)errors.push(issue('PACKAGE_FILE_BYTES_MISMATCH',at+'.bytes','Declared byte count differs from content.',{expected:actualBytes,actual:row.bytes}));
      if(row.digest!==actualDigest)errors.push(issue('PACKAGE_FILE_TAMPERED','$.files.'+row.path,'File digest mismatch.',{expected:row.digest,actual:actualDigest}));
    });
    paths.forEach(function(path){if(!safePackagePath(path))errors.push(issue('PACKAGE_PATH_UNSAFE','$.files.'+path,'Actual file path is unsafe.'));if(typeof candidate.files[path]!=='string')errors.push(issue('PACKAGE_FILE_CONTENT_INVALID','$.files.'+path,'Candidate file content must be UTF-8 text.'));});
    if(canonicalJson(paths)!==canonicalJson(declared))errors.push(issue('PACKAGE_FILE_SET_MISMATCH','$.files','Declared and actual file sets or order differ.'));
    const requiredFiles=['manifest.json','module.contract.json','modular-capability.contract.json','index.html','README.md','build-request.json','capability-recipe.json','compilation.receipt.json','evidence-route.json','candidate.receipt.json','module-bundle.json'].concat(descriptor.capabilityKind==='HAND'?['capability.js','selftest.js']:['SKILL.md','skill.contract.json','skill.selftest.js']);
    requiredFiles.forEach(function(path){if(!own(candidate.files,path))errors.push(issue('PACKAGE_REQUIRED_FILE_MISSING','$.files.'+path,'Required modular candidate file is missing.'));});
    if(!Number.isInteger(descriptor.totalBytes)||descriptor.totalBytes!==declaredBytes||descriptor.totalBytes>MAX_PACKAGE_BYTES)errors.push(issue('PACKAGE_TOTAL_BYTES_MISMATCH','$.package.totalBytes','Total bytes must exactly match content within the package ceiling.',{expected:declaredBytes,actual:descriptor.totalBytes}));
    const expected=digest(withoutKey(descriptor,'packageDigest'));if(expected!==descriptor.packageDigest)errors.push(issue('PACKAGE_DIGEST_MISMATCH','$.package.packageDigest','Package digest mismatch.'));

    try{
      const request=JSON.parse(candidate.files['build-request.json']),recipe=JSON.parse(candidate.files['capability-recipe.json']),compilation=JSON.parse(candidate.files['compilation.receipt.json']),receipt=JSON.parse(candidate.files['candidate.receipt.json']),manifest=JSON.parse(candidate.files['manifest.json']),contract=JSON.parse(candidate.files['module.contract.json']),modularContract=JSON.parse(candidate.files['modular-capability.contract.json']),evidence=JSON.parse(candidate.files['evidence-route.json']);
      if(validateRequest(request).ok!==true||request.requestDigest!==descriptor.requestDigest)errors.push(issue('REQUEST_LINEAGE_DRIFT','$.files.build-request.json','Embedded request is invalid or unbound.'));
      if(validateRecipe(recipe).ok!==true||recipe.id!==descriptor.recipeRef.id||recipe.version!==descriptor.recipeRef.version||recipe.builderId!==descriptor.recipeRef.builderId||recipe.builderDigest!==descriptor.recipeRef.builderDigest||recipe.capabilityKind!==descriptor.capabilityKind||recipe.recipeDigest!==descriptor.recipeRef.digest)errors.push(issue('RECIPE_LINEAGE_DRIFT','$.files.capability-recipe.json','Embedded recipe is invalid, builder-drifted, kind-drifted, or unbound.'));
      const compilationKeys=['schema','fabricVersion','status','capabilityKind','requestDigest','catalogDigest','recipeRef','variantId','builderId','generatedCodeExecuted','testsEmitted','authority','compilationDigest'];
      if(allowedKeys(compilation,compilationKeys,'$.files.compilation.receipt.json',errors))requireKeys(compilation,compilationKeys,'$.files.compilation.receipt.json',errors);
      if(compilation.schema!=='axm.capability-compilation-receipt/v1'||compilation.fabricVersion!==FABRIC_VERSION||compilation.status!=='EXPERIMENTAL'||compilation.capabilityKind!==descriptor.capabilityKind||compilation.requestDigest!==descriptor.requestDigest||compilation.catalogDigest!==descriptor.catalogDigest||canonicalJson(compilation.recipeRef)!==canonicalJson(descriptor.recipeRef)||compilation.variantId!==descriptor.variantId||compilation.builderId!==descriptor.recipeRef.builderId||compilation.generatedCodeExecuted!==false||compilation.testsEmitted!==true||compilation.compilationDigest!==descriptor.compilationDigest||compilation.compilationDigest!==digest(withoutKey(compilation,'compilationDigest')))errors.push(issue('COMPILATION_LINEAGE_DRIFT','$.files.compilation.receipt.json','Compilation receipt drifted or weakened its execution boundary.'));
      falseAuthority(compilation.authority,'$.files.compilation.receipt.json.authority',errors);
      if(own(candidate,'compilation')&&canonicalJson(candidate.compilation)!==canonicalJson(compilation))errors.push(issue('COMPILATION_OBJECT_DRIFT','$.compilation','Detached compilation object differs from its embedded receipt.'));
      allowedKeys(receipt,['schema','candidate','source','authority','boundaries'],'$.files.candidate.receipt.json',errors);requireKeys(receipt,['schema','candidate','source','authority','boundaries'],'$.files.candidate.receipt.json',errors);
      if(isPlain(receipt.candidate)){allowedKeys(receipt.candidate,['id','name','version','status','capabilityKind','location'],'$.files.candidate.receipt.json.candidate',errors);requireKeys(receipt.candidate,['id','name','version','status','capabilityKind','location'],'$.files.candidate.receipt.json.candidate',errors);}
      if(isPlain(receipt.source)){allowedKeys(receipt.source,['kind','requestDigest','recipeDigest','compilationDigest'],'$.files.candidate.receipt.json.source',errors);requireKeys(receipt.source,['kind','requestDigest','recipeDigest','compilationDigest'],'$.files.candidate.receipt.json.source',errors);}
      const requiredReceiptBoundaries=['detached-package','no-self-install','no-self-promotion','host-review-required'];
      if(!isPlain(receipt.candidate)||receipt.schema!=='axm.module-candidate-receipt/v1'||receipt.candidate.id!==descriptor.id||receipt.candidate.version!==descriptor.version||receipt.candidate.status!=='EXPERIMENTAL'||receipt.candidate.capabilityKind!==descriptor.capabilityKind||receipt.candidate.location!=='detached-capability-candidate'||!isPlain(receipt.source)||receipt.source.kind!=='capability-fabric'||receipt.source.requestDigest!==descriptor.requestDigest||receipt.source.recipeDigest!==descriptor.recipeRef.digest||receipt.source.compilationDigest!==descriptor.compilationDigest||!Array.isArray(receipt.boundaries)||requiredReceiptBoundaries.some(function(value){return receipt.boundaries.indexOf(value)<0;}))errors.push(issue('CANDIDATE_RECEIPT_DRIFT','$.files.candidate.receipt.json','Candidate receipt lineage or detached boundary drifted.'));
      falseAuthority(receipt.authority,'$.files.candidate.receipt.json.authority',errors);
      allowedKeys(manifest,['schema','id','name','version','status','capabilityKind','entry','contract','uses','installed','promoted'],'$.files.manifest.json',errors);requireKeys(manifest,['schema','id','name','version','status','capabilityKind','entry','contract','uses','installed','promoted'],'$.files.manifest.json',errors);
      if(manifest.schema!=='axm.module-manifest/v1'||manifest.id!==descriptor.id||manifest.version!==descriptor.version||manifest.status!=='EXPERIMENTAL'||manifest.capabilityKind!==descriptor.capabilityKind||manifest.entry!=='index.html'||manifest.contract!=='module.contract.json'||manifest.installed!==false||manifest.promoted!==false||!Array.isArray(manifest.uses)||manifest.uses.length!==0)errors.push(issue('MANIFEST_AUTHORITY_DRIFT','$.files.manifest.json','Manifest identity, kind, or detached authority drifted.'));
      const requiredRefusals=['network','filesystem','dynamic-code','implicit-randomness','automatic-test-execution','installation','registration','staging','promotion','permission-change','canon-change','foundation-mutation'];
      allowedKeys(contract,['schema','id','version','capabilityKind','modularCapabilityContract','provides','consumes','permissions','handoffs','lifecycle','boundaries'],'$.files.module.contract.json',errors);requireKeys(contract,['schema','id','version','capabilityKind','modularCapabilityContract','provides','consumes','permissions','handoffs','lifecycle','boundaries'],'$.files.module.contract.json',errors);
      if(isPlain(contract.boundaries)){allowedKeys(contract.boundaries,['writes','refuses'],'$.files.module.contract.json.boundaries',errors);requireKeys(contract.boundaries,['writes','refuses'],'$.files.module.contract.json.boundaries',errors);}
      if(contract.schema!=='axm.module-contract/v1'||contract.id!==descriptor.id||contract.version!==descriptor.version||contract.capabilityKind!==descriptor.capabilityKind||contract.modularCapabilityContract!=='modular-capability.contract.json'||!Array.isArray(contract.provides)||!Array.isArray(contract.consumes)||!Array.isArray(contract.permissions)||contract.permissions.length!==0||!isPlain(contract.boundaries)||!Array.isArray(contract.boundaries.writes)||contract.boundaries.writes.length!==0||!Array.isArray(contract.boundaries.refuses)||requiredRefusals.some(function(value){return contract.boundaries.refuses.indexOf(value)<0;}))errors.push(issue('CONTRACT_AUTHORITY_DRIFT','$.files.module.contract.json','Module contract weakened the detached execution, kind, or authority boundary.'));
      const modularKeys=['schema','id','version','kind','runtime','portable','provides','consumes','resultContractPolicy','requiredHostCapabilities','permissions','status','installed','promoted','canon','contractDigest'];
      allowedKeys(modularContract,modularKeys,'$.files.modular-capability.contract.json',errors);requireKeys(modularContract,modularKeys,'$.files.modular-capability.contract.json',errors);
      const expectedRuntime={mode:recipe.capabilityContract.runtimeMode,entry:recipe.capabilityContract.entry,operation:recipe.capabilityContract.operation},expectedPortable={form:recipe.capabilityContract.portableForm,path:recipe.capabilityContract.portablePath};
      if(!isPlain(modularContract.runtime)||!isPlain(modularContract.portable)||modularContract.schema!=='axm.modular-capability-contract/v1'||modularContract.id!==descriptor.id||modularContract.version!==descriptor.version||modularContract.kind!==descriptor.capabilityKind||canonicalJson(modularContract.runtime)!==canonicalJson(expectedRuntime)||canonicalJson(modularContract.portable)!==canonicalJson(expectedPortable)||canonicalJson(modularContract.provides)!==canonicalJson(contract.provides)||canonicalJson(modularContract.consumes)!==canonicalJson(contract.consumes)||modularContract.resultContractPolicy!==recipe.capabilityContract.resultContractPolicy||canonicalJson(modularContract.requiredHostCapabilities)!==canonicalJson(recipe.capabilityContract.requiredHostCapabilities)||!Array.isArray(modularContract.permissions)||modularContract.permissions.length!==0||modularContract.status!=='EXPERIMENTAL'||modularContract.installed!==false||modularContract.promoted!==false||modularContract.canon!==false||modularContract.contractDigest!==digest(withoutKey(modularContract,'contractDigest')))errors.push(issue('MODULAR_CONTRACT_DRIFT','$.files.modular-capability.contract.json','Modular capability contract is invalid, unbound, or authority-bearing.'));
      const requiredNotProven=['runtime safety outside declared boundaries','installation readiness','promotion or CANON status'];
      if(!isPlain(evidence)||evidence.schema!=='axm.evidence-route/v1'||!Array.isArray(evidence.claims)||!Array.isArray(evidence.notProven)||requiredNotProven.some(function(value){return evidence.notProven.indexOf(value)<0;}))errors.push(issue('EVIDENCE_BOUNDARY_DRIFT','$.files.evidence-route.json','Evidence route removed required not-proven boundaries.'));
    }catch(error){errors.push(issue('BOUND_JSON_INVALID','$.files',String(error.message||error)));}
    try{
      const bundle=JSON.parse(candidate.files['module-bundle.json']),covered=paths.filter(function(path){return path!=='module-bundle.json';});
      if(!isPlain(bundle)||bundle.schema!=='axm.module-bundle/v1'||bundle.id!==descriptor.id||bundle.version!==descriptor.version||bundle.requiredSeats!==1||!Array.isArray(bundle.files)||canonicalJson(bundle.files.map(function(row){return row.path;}))!==canonicalJson(covered))errors.push(issue('BUNDLE_DRIFT','$.files.module-bundle.json','Bundle identity or exact non-self coverage drifted.'));
      (bundle.files||[]).forEach(function(row,index){const at='$.files.module-bundle.json.files['+index+']';if(!allowedKeys(row,['path','encoding','sha256','content'],at,errors))return;requireKeys(row,['path','encoding','sha256','content'],at,errors);if(!safePackagePath(row.path)||row.encoding!=='utf8'||typeof row.content!=='string'||!safeDigest('sha256:'+row.sha256)||candidate.files[row.path]!==row.content||digest(row.content).slice(7)!==row.sha256)errors.push(issue('BUNDLE_FILE_DRIFT',at,'Bundled content, digest, encoding, or path differs.'));});
    }catch(error){errors.push(issue('BUNDLE_INVALID','$.files.module-bundle.json',String(error.message||error)));}
    return {ok:errors.length===0,errors:errors,packageDigest:descriptor.packageDigest};
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

  function validateRecipeProposalDraft(recipe) {
    const errors=[],keys=['schema','id','version','title','summary','family','capabilityKind','capabilityContract','builderId','activation','reviewPolicy','candidatePolicy','parameterSpec','exampleRequest','boundaries','verifiers'];
    if(!allowedKeys(recipe,keys,'$.recipe',errors))return {ok:false,errors:errors};
    requireKeys(recipe,keys,'$.recipe',errors);
    if(utf8Length(recipe)>MAX_PROPOSAL_BYTES)errors.push(issue('PROPOSAL_BYTES_EXCEEDED','$.recipe','Recipe proposal exceeds the 128 KiB inspection ceiling.'));
    if(recipe.schema!==PROPOSAL_RECIPE_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.recipe.schema','Expected '+PROPOSAL_RECIPE_SCHEMA+'.'));
    if(!safeId(recipe.id)||!safeVersion(recipe.version)||!safeId(recipe.family)||!safeId(recipe.builderId))errors.push(issue('PROPOSAL_IDENTITY_INVALID','$.recipe','Recipe proposal identity or version is malformed.'));
    validateCapabilityContract(recipe.capabilityKind,recipe.capabilityContract,'$.recipe.capabilityContract',errors);
    if(typeof recipe.title!=='string'||!recipe.title.trim()||recipe.title.length>120||typeof recipe.summary!=='string'||!recipe.summary.trim()||recipe.summary.length>500)errors.push(issue('PROPOSAL_DESCRIPTION_INVALID','$.recipe','Recipe proposal title or summary is invalid.'));
    if(recipe.activation!=='INACTIVE_PROPOSAL')errors.push(issue('PROPOSAL_ACTIVATION_REFUSED','$.recipe.activation','Submitted recipe drafts must explicitly remain INACTIVE_PROPOSAL.'));
    if(allowedKeys(recipe.reviewPolicy,['activation','sharedUseRequires','canonAuthority'],'$.recipe.reviewPolicy',errors)){
      requireKeys(recipe.reviewPolicy,['activation','sharedUseRequires','canonAuthority'],'$.recipe.reviewPolicy',errors);
      if(recipe.reviewPolicy.activation!=='source-review-and-merge'||recipe.reviewPolicy.sharedUseRequires!=='MIKE_TOBI_MERGE'||recipe.reviewPolicy.canonAuthority!=='NONE')errors.push(issue('REVIEW_POLICY_INVALID','$.recipe.reviewPolicy','Proposal review policy must preserve source review, Mike merge, and no CANON authority.'));
    }
    if(!isPlain(recipe.parameterSpec))errors.push(issue('PARAMETER_SPEC_INVALID','$.recipe.parameterSpec','Parameter specification must be an object.'));
    else Object.keys(recipe.parameterSpec).sort().forEach(function(key){if(!safeField(key))errors.push(issue('PARAMETER_NAME_INVALID','$.recipe.parameterSpec.'+key,'Use lower camel case.'));validateRule(recipe.parameterSpec[key],'$.recipe.parameterSpec.'+key,errors);});
    if(!isPlain(recipe.candidatePolicy)||!allowedKeys(recipe.candidatePolicy,['defaultCount','defaultVariantId','variants'],'$.recipe.candidatePolicy',errors)||recipe.candidatePolicy.defaultCount!==1||!safeId(recipe.candidatePolicy.defaultVariantId)||!Array.isArray(recipe.candidatePolicy.variants)||!recipe.candidatePolicy.variants.length)errors.push(issue('CANDIDATE_POLICY_INVALID','$.recipe.candidatePolicy','Proposal must name one default variant and build one candidate.'));
    else {const ids=new Set();recipe.candidatePolicy.variants.forEach(function(row,index){const at='$.recipe.candidatePolicy.variants['+index+']';if(!allowedKeys(row,['id','title','parameterOverrides'],at,errors))return;requireKeys(row,['id','title','parameterOverrides'],at,errors);if(!safeId(row.id)||ids.has(row.id))errors.push(issue('VARIANT_ID_INVALID',at+'.id','Variant id must be unique and lowercase.'));ids.add(row.id);if(typeof row.title!=='string'||!row.title.trim()||row.title.length>120)errors.push(issue('VARIANT_TITLE_INVALID',at+'.title','Variant title must contain 1 to 120 characters.'));if(!isPlain(row.parameterOverrides))errors.push(issue('VARIANT_OVERRIDES_INVALID',at+'.parameterOverrides','Overrides must be an object.'));else validateParameters(row.parameterOverrides,recipe,{requireRequired:false}).errors.forEach(function(error){errors.push(issue(error.code,at+'.parameterOverrides'+error.path.slice('$.parameters'.length),error.message,error.details));});});if(!ids.has(recipe.candidatePolicy.defaultVariantId))errors.push(issue('DEFAULT_VARIANT_MISSING','$.recipe.candidatePolicy.defaultVariantId','Default variant id must name one declared variant.'));}
    validateStringList(recipe.boundaries,'$.recipe.boundaries',errors,'BOUNDARIES_REQUIRED');
    validateStringList(recipe.verifiers,'$.recipe.verifiers',errors,'VERIFIERS_REQUIRED');
    if(!isPlain(recipe.exampleRequest))errors.push(issue('EXAMPLE_REQUEST_INVALID','$.recipe.exampleRequest','Proposal requires a closed example request object.'));
    else {const draftKeys=['id','family','purpose','recipeId','variantId','parameters','source'];allowedKeys(recipe.exampleRequest,draftKeys,'$.recipe.exampleRequest',errors);requireKeys(recipe.exampleRequest,draftKeys,'$.recipe.exampleRequest',errors);if(recipe.exampleRequest.recipeId!==recipe.id||recipe.exampleRequest.family!==recipe.family)errors.push(issue('EXAMPLE_RECIPE_MISMATCH','$.recipe.exampleRequest','Example request must target the proposed recipe and family.'));const sealed=sealRequest(recipe.exampleRequest,true),requestCheck=validateRequest(sealed);requestCheck.errors.forEach(function(error){errors.push(issue(error.code,'$.recipe.exampleRequest'+error.path.slice(1),error.message,error.details));});const defaultVariant=isPlain(recipe.candidatePolicy)&&Array.isArray(recipe.candidatePolicy.variants)?recipe.candidatePolicy.variants.find(function(row){return row&&row.id===recipe.candidatePolicy.defaultVariantId;}):null;if(defaultVariant&&isPlain(defaultVariant.parameterOverrides))validateParameters(mergeParameters(sealed.parameters,defaultVariant.parameterOverrides),recipe).errors.forEach(function(error){errors.push(issue(error.code,'$.recipe.exampleRequest'+error.path.slice(1),error.message,error.details));});}
    return {ok:errors.length===0,errors:errors};
  }

  function importRecipeProposal(envelope) {
    const errors=[];
    if(!allowedKeys(envelope,['schema','sourceKind','recipe','proposalDigest'],'$',errors))return {ok:false,errors:errors};
    requireKeys(envelope,['schema','sourceKind','recipe','proposalDigest'],'$',errors);
    if(envelope.schema!==PROPOSAL_SCHEMA)errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected '+PROPOSAL_SCHEMA+'.'));
    if(['HUMAN','CODEX','MIRROR','CODE_FABRIC','EXTERNAL','AI'].indexOf(envelope.sourceKind)<0)errors.push(issue('PROPOSAL_SOURCE_INVALID','$.sourceKind','Unsupported proposal source.'));
    const recipeCheck=validateRecipeProposalDraft(envelope.recipe);recipeCheck.errors.forEach(function(row){errors.push(row);});
    const expectedProposalDigest=isPlain(envelope.recipe)?digest(envelope.recipe):null;
    if(!safeDigest(envelope.proposalDigest)||envelope.proposalDigest!==expectedProposalDigest)errors.push(issue('PROPOSAL_DIGEST_MISMATCH','$.proposalDigest','Proposal digest mismatch.'));
    if(errors.length)return {ok:false,errors:errors};
    return {ok:true,status:'INACTIVE_PROPOSAL',active:false,sourceKind:envelope.sourceKind,recipe:clone(envelope.recipe),proposalDigest:envelope.proposalDigest,validation:recipeCheck,requiresSourceReview:true,requiresMikeMerge:true,providerCalled:false,authority:clone(AUTHORITY)};
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
    FABRIC_VERSION:FABRIC_VERSION,REQUEST_SCHEMA:REQUEST_SCHEMA,RECIPE_SCHEMA:RECIPE_SCHEMA,CATALOG_SCHEMA:CATALOG_SCHEMA,PLAN_SCHEMA:PLAN_SCHEMA,PACKAGE_SCHEMA:PACKAGE_SCHEMA,RUN_SCHEMA:RUN_SCHEMA,PROPOSAL_SCHEMA:PROPOSAL_SCHEMA,PROPOSAL_RECIPE_SCHEMA:PROPOSAL_RECIPE_SCHEMA,ACTIVE_RECIPE:ACTIVE_RECIPE,CAPABILITY_KINDS:CAPABILITY_KINDS,AUTHORITY:AUTHORITY,ALLOWED_BUILDERS:ALLOWED_BUILDERS,
    canonicalJson:canonicalJson,digest:digest,clone:clone,sealRequest:sealRequest,validateRequest:validateRequest,validateRecipe:validateRecipe,validateCatalog:validateCatalog,validateParameters:validateParameters,validateRecipeProposalDraft:validateRecipeProposalDraft,validateCompiledArtifact:validateCompiledArtifact,planBuild:planBuild,buildCandidate:buildCandidate,verifyCandidate:verifyCandidate,build:build,importRecipeProposal:importRecipeProposal,adaptHandRequest:adaptHandRequest
  };
});
