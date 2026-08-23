(function (root, factory) {
  const dependency = typeof module !== 'undefined' && module.exports
    ? require('../deterministic-organ-fabric/core.js')
    : root.AXMDeterministicOrganFabric;
  const api = factory(dependency);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMCapabilityBuilderRegistry = api;
})(typeof self !== 'undefined' ? self : this, function (deterministicKernel) {
  'use strict';

  if (!deterministicKernel || typeof deterministicKernel.digest !== 'function') throw new Error('AXM deterministic organ kernel is required');
  const REGISTRY_SCHEMA = 'axm.capability-builder-registry/v1';
  const ACTIVE = 'ACTIVE_SOURCE_REVIEWED';
  const REVIEW_CANDIDATE = 'REVIEW_CANDIDATE';
  const digest = deterministicKernel.digest;
  const canonicalJson = deterministicKernel.canonicalJson;

  function jsonTransformSource(parameters) {
    const config={inputField:parameters.inputField,outputField:parameters.outputField,defaultValue:parameters.defaultValue,outputSchema:parameters.outputSchema,maxInputKeys:parameters.maxInputKeys};
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction own(v,k){return Object.prototype.hasOwnProperty.call(Object(v),k);}\nfunction run(input){if(!input||typeof input!=='object'||Array.isArray(input))return {schema:CONFIG.outputSchema,ok:false,code:'INPUT_OBJECT_REQUIRED'};if(Object.keys(input).length>CONFIG.maxInputKeys)return {schema:CONFIG.outputSchema,ok:false,code:'INPUT_KEY_LIMIT'};const output={};output[CONFIG.outputField]=own(input,CONFIG.inputField)?input[CONFIG.inputField]:CONFIG.defaultValue;return {schema:CONFIG.outputSchema,ok:true,output:output};}\nmodule.exports={CONFIG:CONFIG,run:run};\n";
  }
  function jsonTransformSelftest(parameters) {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');let input={};input["+JSON.stringify(parameters.inputField)+"]='proof';const result=capability.run(input);assert.equal(result.ok,true);assert.equal(result.output["+JSON.stringify(parameters.outputField)+"],'proof');const fallback=capability.run({});assert.deepStrictEqual(fallback.output["+JSON.stringify(parameters.outputField)+"],"+JSON.stringify(parameters.defaultValue)+");console.log('PASS pure JSON transform capability');\n";
  }
  function buildJsonTransform(parameters) {
    return {capabilityKind:'HAND',source:jsonTransformSource(parameters),selftest:jsonTransformSelftest(parameters),provides:[parameters.outputSchema],consumes:['application/json'],summary:'Pure bounded JSON field transform.'};
  }

  function svgBadgeSource(parameters) {
    const config={label:parameters.label,value:parameters.value,background:parameters.background,foreground:parameters.foreground,width:parameters.width};
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction esc(v){return String(v).slice(0,48).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#39;');}\nfunction render(input){input=input&&typeof input==='object'&&!Array.isArray(input)?input:{};const label=esc(input.label==null?CONFIG.label:input.label),value=esc(input.value==null?CONFIG.value:input.value),split=Math.floor(CONFIG.width*0.58);const svg='<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" role=\\\"img\\\" aria-label=\\\"'+label+': '+value+'\\\"><rect width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.background+'\\\"/><rect x=\\\"'+split+'\\\" width=\\\"'+(CONFIG.width-split)+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.foreground+'\\\"/><text x=\\\"10\\\" y=\\\"19\\\" fill=\\\"#ffffff\\\" font-family=\\\"system-ui,sans-serif\\\" font-size=\\\"13\\\">'+label+'</text><text x=\\\"'+(split+8)+'\\\" y=\\\"19\\\" fill=\\\"#081018\\\" font-family=\\\"system-ui,sans-serif\\\" font-size=\\\"13\\\" font-weight=\\\"700\\\">'+value+'</text></svg>';return {schema:'axm.creation.svg-status-badge/v1',ok:true,mimeType:'image/svg+xml',svg:svg};}\nmodule.exports={CONFIG:CONFIG,render:render};\n";
  }
  function svgBadgeSelftest() {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const first=capability.render({label:'A&B',value:'<ok>'}),second=capability.render({label:'A&B',value:'<ok>'});assert.equal(first.ok,true);assert.equal(first.svg,second.svg);assert(first.svg.includes('A&amp;B'));assert(first.svg.includes('&lt;ok&gt;'));console.log('PASS deterministic SVG badge capability');\n";
  }
  function buildSvgBadge(parameters) {
    return {capabilityKind:'HAND',source:svgBadgeSource(parameters),selftest:svgBadgeSelftest(parameters),provides:['axm.creation.svg-status-badge/v1','image/svg+xml'],consumes:['application/json'],summary:'Deterministic text-only SVG status badge creation hand.'};
  }

  function directionAdapterSource(parameters) {
    const config={targetRecipeId:parameters.targetRecipeId,targetFamily:parameters.targetFamily,targetParameters:parameters.targetParameters,idSuffix:parameters.idSuffix};
    return "'use strict';\nconst crypto=require('crypto');const CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}\nfunction sha(v){return 'sha256:'+crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');}\nfunction slug(v){return String(v||'capability').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'capability';}\nfunction adapt(input){if(!input||input.schema!=='axm.workshop-direction.hand-request/v1')return {ok:false,code:'HAND_REQUEST_SCHEMA_REQUIRED'};for(const key of ['handRequestId','targetModuleId','title','reason','desiredContract'])if(!String(input[key]||''))return {ok:false,code:'HAND_REQUEST_FIELD_REQUIRED',field:key};const request={schema:'axm.capability-fabric.build-request/v1',id:slug(input.targetModuleId)+'-'+CONFIG.idSuffix,family:CONFIG.targetFamily,purpose:String(input.title)+' — '+String(input.reason),recipeId:CONFIG.targetRecipeId,variantId:null,parameters:CONFIG.targetParameters,source:{kind:'WORKSHOP_DIRECTION',ref:String(input.handRequestId)},status:'EXPERIMENTAL',authority:'NONE',humanReviewed:false,requestDigest:''};const copy=JSON.parse(JSON.stringify(request));delete copy.requestDigest;request.requestDigest=sha(copy);return {ok:true,status:'HUMAN_REVIEW_REQUIRED',request:request,installed:false,promoted:false};}\nmodule.exports={CONFIG:CONFIG,adapt:adapt};\n";
  }
  function directionAdapterSelftest() {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const hand={schema:'axm.workshop-direction.hand-request/v1',handRequestId:'hand-proof',targetModuleId:'proof-module',title:'Build proof module',reason:'Missing bounded hand',desiredContract:'axm.direction-hand/proof/v1'};const one=capability.adapt(hand),two=capability.adapt(hand);assert.equal(one.ok,true);assert.equal(one.status,'HUMAN_REVIEW_REQUIRED');assert.equal(one.request.humanReviewed,false);assert.equal(one.request.requestDigest,two.request.requestDigest);console.log('PASS Workshop Direction adapter capability');\n";
  }
  function buildDirectionAdapter(parameters) {
    return {capabilityKind:'HAND',source:directionAdapterSource(parameters),selftest:directionAdapterSelftest(parameters),provides:['axm.capability-fabric.build-request/v1'],consumes:['axm.workshop-direction.hand-request/v1'],summary:'Bounded Workshop Direction hand-request adapter; output remains human-review held.'};
  }

  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
  }
  function byteLength(value) {
    const text=typeof value==='string'?value:stable(value);
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text,'utf8');
  }
  function exactKeys(value, allowed, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
    Object.keys(value).forEach(function (key) { if (!allowed.includes(key)) throw new Error(label + ' contains unsupported key ' + key); });
  }
  function inspectSchema(schema, at) {
    exactKeys(schema,['type','properties','required','additionalProperties','items','enum','pattern','minLength','maxLength','minimum','maximum','minItems','maxItems','description'],at);
    const types=['object','array','string','number','integer','boolean'];
    if(!types.includes(schema.type))throw new Error(at+'.type is unsupported');
    if(schema.enum!==undefined&&(!Array.isArray(schema.enum)||!schema.enum.length))throw new Error(at+'.enum must be non-empty');
    if(schema.pattern!==undefined){if(schema.type!=='string'||typeof schema.pattern!=='string')throw new Error(at+'.pattern is invalid');new RegExp(schema.pattern);}
    if(schema.type==='object'){
      exactKeys(schema.properties||{},Object.keys(schema.properties||{}),at+'.properties');
      if(schema.additionalProperties!==false)throw new Error(at+'.additionalProperties must be false');
      const required=schema.required||[];
      if(!Array.isArray(required)||new Set(required).size!==required.length)throw new Error(at+'.required must be a unique array');
      required.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(schema.properties||{},key))throw new Error(at+'.required names an unknown property');});
      Object.keys(schema.properties||{}).sort().forEach(function(key){inspectSchema(schema.properties[key],at+'.properties.'+key);});
    }
    if(schema.type==='array'){if(!schema.items)throw new Error(at+'.items is required');inspectSchema(schema.items,at+'.items');}
  }
  function validatorSource(config) {
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction bytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8');}catch(e){return Infinity;}}\nfunction typeOk(v,t){if(t==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v);if(t==='array')return Array.isArray(v);if(t==='integer')return Number.isInteger(v);if(t==='number')return typeof v==='number'&&Number.isFinite(v);return typeof v===t;}\nfunction walk(v,s,p,e){if(!typeOk(v,s.type)){e.push({path:p,code:'TYPE_MISMATCH',expected:s.type});return;}if(s.enum&&!s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v)))e.push({path:p,code:'ENUM_MISMATCH'});if(s.type==='string'){if(s.minLength!==undefined&&v.length<s.minLength)e.push({path:p,code:'MIN_LENGTH'});if(s.maxLength!==undefined&&v.length>s.maxLength)e.push({path:p,code:'MAX_LENGTH'});if(s.pattern!==undefined&&!new RegExp(s.pattern).test(v))e.push({path:p,code:'PATTERN_MISMATCH'});}if(s.type==='number'||s.type==='integer'){if(s.minimum!==undefined&&v<s.minimum)e.push({path:p,code:'MINIMUM'});if(s.maximum!==undefined&&v>s.maximum)e.push({path:p,code:'MAXIMUM'});}if(s.type==='array'){if(s.minItems!==undefined&&v.length<s.minItems)e.push({path:p,code:'MIN_ITEMS'});if(s.maxItems!==undefined&&v.length>s.maxItems)e.push({path:p,code:'MAX_ITEMS'});v.forEach((x,i)=>walk(x,s.items,p+'['+i+']',e));}if(s.type==='object'){const props=s.properties||{},req=s.required||[];req.forEach(k=>{if(!Object.prototype.hasOwnProperty.call(v,k))e.push({path:p+'.'+k,code:'REQUIRED'});});Object.keys(v).sort().forEach(k=>{if(!Object.prototype.hasOwnProperty.call(props,k)){if(s.additionalProperties===false)e.push({path:p+'.'+k,code:'ADDITIONAL_PROPERTY'});}else walk(v[k],props[k],p+'.'+k,e);});}}\nfunction validate(input){if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_BYTES_EXCEEDED'}]};const errors=[];walk(input,CONFIG.schema,'$',errors);return {schema:CONFIG.resultSchemaId,ok:errors.length===0,errors:errors};}\nmodule.exports={CONFIG,validate};\n";
  }
  function validatorSelftest(config) {
    return "'use strict';\nconst assert=require('assert');const subject=require('./capability.js');const good="+JSON.stringify(config.exampleValid)+";const pass=subject.validate(good);assert(pass.ok&&pass.schema==="+JSON.stringify(config.resultSchemaId)+");const bad=JSON.parse(JSON.stringify(good));delete bad["+JSON.stringify(config.firstRequired)+"];assert(!subject.validate(bad).ok);const extra=Object.assign({},good,{undeclared:true});assert(!subject.validate(extra).ok);process.stdout.write('closed JSON schema validator candidate selftest PASS\\n');\n";
  }
  function exampleFor(schema) {
    if(schema.type==='string')return schema.enum?schema.enum[0]:'value';
    if(schema.type==='integer'||schema.type==='number')return schema.enum?schema.enum[0]:(schema.minimum===undefined?0:schema.minimum);
    if(schema.type==='boolean')return schema.enum?schema.enum[0]:true;
    if(schema.type==='array')return [exampleFor(schema.items)];
    const value={};Object.keys(schema.properties||{}).sort().forEach(function(key){if((schema.required||[]).includes(key))value[key]=exampleFor(schema.properties[key]);});return value;
  }
  function buildSchemaValidator(parameters) {
    exactKeys(parameters,['inputSchemaId','resultSchemaId','schema','maxInputBytes'],'parameters');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.inputSchemaId||''))throw new Error('inputSchemaId is invalid');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId||''))throw new Error('resultSchemaId is invalid');
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<64||parameters.maxInputBytes>65536)throw new Error('maxInputBytes is outside the bounded range');
    if(byteLength(parameters.schema)>16384)throw new Error('schema exceeds 16 KiB');
    inspectSchema(parameters.schema,'$.schema');
    const firstRequired=(parameters.schema.required||[])[0];if(!firstRequired)throw new Error('pilot schema needs one required property for its generated refusal proof');
    const config={inputSchemaId:parameters.inputSchemaId,resultSchemaId:parameters.resultSchemaId,schema:parameters.schema,maxInputBytes:parameters.maxInputBytes,firstRequired:firstRequired,exampleValid:exampleFor(parameters.schema)};
    return {capabilityKind:'HAND',source:validatorSource(config),selftest:validatorSelftest(config),provides:[parameters.resultSchemaId],consumes:[parameters.inputSchemaId],summary:'Closed deterministic JSON Schema subset validator.'};
  }

  function exact(value, keys, label) {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be an object');
    Object.keys(value).forEach(function(key){if(!keys.includes(key))throw new Error(label+' contains unsupported key '+key);});
    keys.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(value,key))throw new Error(label+' is missing '+key);});
  }
  function list(value,label,max) {
    if(!Array.isArray(value)||!value.length||value.length>max)throw new Error(label+' must contain 1 to '+max+' entries');
    const seen=new Set();return value.map(function(row){const text=String(row||'').trim();if(!text||text.length>240||seen.has(text))throw new Error(label+' entries must be unique bounded text');seen.add(text);return text;});
  }
  function safeId(value,label){const text=String(value||'');if(!/^[a-z][a-z0-9-]{2,79}$/.test(text))throw new Error(label+' is invalid');return text;}
  function contractId(value,label){const text=String(value||'');if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(text))throw new Error(label+' is invalid');return text;}
  function renderSkillMarkdown(config) {
    return ['---','name: '+config.skillId,'status: EXPERIMENTAL','capability: '+config.receiptSchema,'---','','# '+config.title,'',config.purpose,'','## Inputs',''].concat(config.inputs.map(function(row){return '- '+row;}),['','## Procedure',''],config.procedure.map(function(row,index){return (index+1)+'. '+row;}),['','## Outputs',''],config.outputs.map(function(row){return '- '+row;}),['','## Boundaries',''],config.boundaries.map(function(row){return '- '+row;}),['','## Authority','','- Host mediated: true','- Authority inherited: false','- Installed: false','- Promoted: false','- CANON: false','']).join('\n');
  }
  function renderSkillSelftest(config) {
    return "'use strict';\nconst assert=require('assert'),fs=require('fs');const md=fs.readFileSync('SKILL.md','utf8'),contract=JSON.parse(fs.readFileSync('skill.contract.json','utf8'));assert(md.includes('# "+config.title.replace(/'/g,"\\'")+"'));assert.equal(contract.schema,'axm.portable-skill-contract/v1');assert.equal(contract.kind,'SKILL');assert.equal(contract.authorityInherited,false);assert.equal(contract.installed,false);assert.equal(contract.promoted,false);assert.equal(contract.canon,false);process.stdout.write('portable skill selftest PASS\\n');\n";
  }
  function buildReviewSkill(parameters) {
    exact(parameters,['skillId','title','purpose','inputs','outputs','procedure','boundaries','receiptSchema','maxSteps'],'parameters');
    const config={skillId:safeId(parameters.skillId,'skillId'),title:String(parameters.title||'').trim(),purpose:String(parameters.purpose||'').trim(),inputs:list(parameters.inputs,'inputs',16),outputs:list(parameters.outputs,'outputs',16),procedure:list(parameters.procedure,'procedure',32),boundaries:list(parameters.boundaries,'boundaries',16),receiptSchema:contractId(parameters.receiptSchema,'receiptSchema'),maxSteps:parameters.maxSteps};
    if(!config.title||config.title.length>120||!config.purpose||config.purpose.length>500)throw new Error('title or purpose is invalid');
    if(!Number.isInteger(config.maxSteps)||config.maxSteps<1||config.maxSteps>32||config.procedure.length>config.maxSteps)throw new Error('maxSteps is outside the bounded range');
    const descriptor={schema:'axm.portable-skill-contract/v1',id:config.skillId,kind:'SKILL',status:'EXPERIMENTAL',runtimeMode:'HOST_MEDIATED',portableForm:'SKILL.md',operation:'followProcedure',inputs:config.inputs,outputs:config.outputs,receiptSchema:config.receiptSchema,requiredHostCapabilities:['human-or-agent-procedure-runner/v1'],authorityInherited:false,installed:false,promoted:false,canon:false};
    return {capabilityKind:'SKILL',portableFiles:{'SKILL.md':renderSkillMarkdown(config),'skill.contract.json':JSON.stringify(descriptor,null,2)+'\n','skill.selftest.js':renderSkillSelftest(config)},provides:[config.receiptSchema],consumes:['axm.capability-review-input/v1'],summary:'Portable bounded review procedure skill.'};
  }

  function makeEntry(id, kind, status, proposalDigest, build, parts) {
    const material={id:id,capabilityKind:kind,status:status,proposalDigest:proposalDigest,implementation:parts.map(function(part){return String(part).replace(/\r\n/g,'\n');})};
    return {id:id,capabilityKind:kind,status:status,proposalDigest:proposalDigest,implementationDigest:digest(material),build:build};
  }
  const entries=[
    makeEntry('pure-json-transform-v1','HAND',ACTIVE,null,buildJsonTransform,[jsonTransformSource,jsonTransformSelftest,buildJsonTransform]),
    makeEntry('svg-status-badge-v1','HAND',ACTIVE,null,buildSvgBadge,[svgBadgeSource,svgBadgeSelftest,buildSvgBadge]),
    makeEntry('workshop-direction-adapter-v1','HAND',ACTIVE,null,buildDirectionAdapter,[directionAdapterSource,directionAdapterSelftest,buildDirectionAdapter]),
    makeEntry('closed-json-schema-validator-v1','HAND',REVIEW_CANDIDATE,'sha256:02a61d48f5213edc9140f1720c12f84a8de1ebc0bbc7f1b338d9a9e8bf0df14f',buildSchemaValidator,[stable,byteLength,exactKeys,inspectSchema,validatorSource,validatorSelftest,exampleFor,buildSchemaValidator]),
    makeEntry('bounded-review-procedure-skill-v1','SKILL',REVIEW_CANDIDATE,'sha256:acd5678b5327fda7c2a2f1280fb4fa26f41cfd188e4788c1df3c2e539ee532ba',buildReviewSkill,[exact,list,safeId,contractId,renderSkillMarkdown,renderSkillSelftest,buildReviewSkill])
  ];
  const byId=new Map(entries.map(function(entry){return [entry.id,entry];}));
  function descriptor(entry){return {id:entry.id,capabilityKind:entry.capabilityKind,status:entry.status,proposalDigest:entry.proposalDigest,implementationDigest:entry.implementationDigest};}
  const registryBody={schema:REGISTRY_SCHEMA,version:'1.0.0',entries:entries.map(descriptor).sort(function(left,right){return left.id.localeCompare(right.id);})};
  const registryDigest=digest(registryBody);
  function inventory(){return {schema:REGISTRY_SCHEMA,version:registryBody.version,entries:JSON.parse(canonicalJson(registryBody.entries)),registryDigest:registryDigest};}
  function describe(id){const entry=byId.get(String(id||''));return entry?descriptor(entry):null;}
  function compile(entry, expectedDigest, parameters) {
    if(!entry)throw new Error('Unknown compiled builder');
    if(entry.implementationDigest!==expectedDigest)throw new Error('Builder implementation digest mismatch');
    return entry.build(parameters);
  }
  function compileActive(id, expectedDigest, parameters) {
    const entry=byId.get(String(id||''));
    if(!entry||entry.status!==ACTIVE)throw new Error('Builder is not active and source reviewed');
    return compile(entry,expectedDigest,parameters);
  }
  function compileReviewCandidate(id, expectedDigest, parameters) {
    const entry=byId.get(String(id||''));
    if(!entry||entry.status!==REVIEW_CANDIDATE)throw new Error('Builder is not a review candidate');
    return compile(entry,expectedDigest,parameters);
  }
  return {
    REGISTRY_SCHEMA:REGISTRY_SCHEMA,ACTIVE:ACTIVE,REVIEW_CANDIDATE:REVIEW_CANDIDATE,
    inventory:inventory,describe:describe,
    activeIds:function(){return entries.filter(function(entry){return entry.status===ACTIVE;}).map(function(entry){return entry.id;}).sort();},
    reviewCandidateIds:function(){return entries.filter(function(entry){return entry.status===REVIEW_CANDIDATE;}).map(function(entry){return entry.id;}).sort();},
    compileActive:compileActive,compileReviewCandidate:compileReviewCandidate
  };
});
