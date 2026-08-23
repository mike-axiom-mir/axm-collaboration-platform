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

  function adapterFieldName(value,label) {
    const text=String(value||'');if(!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(text)||['__proto__','prototype','constructor'].includes(text))throw new Error(label+' is invalid');return text;
  }
  function primitiveValueValid(schema,value,skipEnum) {
    const type=schema.type;
    if(type==='string'&&typeof value!=='string')return false;
    if(type==='boolean'&&typeof value!=='boolean')return false;
    if(type==='integer'&&!Number.isInteger(value))return false;
    if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))return false;
    if(type==='string'){
      const length=Array.from(value).length;
      if(schema.minLength!==undefined&&length<schema.minLength)return false;
      if(schema.maxLength!==undefined&&length>schema.maxLength)return false;
    }
    if(type==='integer'||type==='number'){
      if(schema.minimum!==undefined&&value<schema.minimum)return false;
      if(schema.maximum!==undefined&&value>schema.maximum)return false;
    }
    return skipEnum===true||schema.enum===undefined||schema.enum.some(function(row){return canonicalJson(row)===canonicalJson(value);});
  }
  function inspectAdapterPrimitive(schema,label) {
    exactKeys(schema,['type','enum','minLength','maxLength','minimum','maximum','description'],label);
    if(!['string','number','integer','boolean'].includes(schema.type))throw new Error(label+'.type must be a supported primitive');
    if(schema.description!==undefined&&(typeof schema.description!=='string'||schema.description.length>500))throw new Error(label+'.description is invalid');
    if(schema.type!=='string'&&['minLength','maxLength'].some(function(key){return schema[key]!==undefined;}))throw new Error(label+' carries a string-only keyword for a non-string type');
    if(schema.type!=='number'&&schema.type!=='integer'&&['minimum','maximum'].some(function(key){return schema[key]!==undefined;}))throw new Error(label+' carries a numeric-only keyword for a non-numeric type');
    ['minLength','maxLength'].forEach(function(key){if(schema[key]!==undefined&&(!Number.isInteger(schema[key])||schema[key]<0||schema[key]>65536))throw new Error(label+'.'+key+' is invalid');});
    if(schema.minLength!==undefined&&schema.maxLength!==undefined&&schema.minLength>schema.maxLength)throw new Error(label+' string bounds conflict');
    ['minimum','maximum'].forEach(function(key){if(schema[key]!==undefined&&(typeof schema[key]!=='number'||!Number.isFinite(schema[key])))throw new Error(label+'.'+key+' is invalid');});
    if(schema.minimum!==undefined&&schema.maximum!==undefined&&schema.minimum>schema.maximum)throw new Error(label+' numeric bounds conflict');
    if(schema.enum!==undefined){
      if(!Array.isArray(schema.enum)||!schema.enum.length||schema.enum.length>64)throw new Error(label+'.enum is invalid');
      const seen=new Set();schema.enum.forEach(function(value){const key=canonicalJson(value);if(seen.has(key)||!primitiveValueValid(schema,value,true))throw new Error(label+'.enum contains an invalid or duplicate value');seen.add(key);});
    }
  }
  function inspectAdapterObjectSchema(schema,label,maxProperties) {
    exactKeys(schema,['type','properties','required','additionalProperties','description'],label);
    if(schema.type!=='object'||schema.additionalProperties!==false||!schema.properties||typeof schema.properties!=='object'||Array.isArray(schema.properties))throw new Error(label+' must be a closed object schema');
    if(schema.description!==undefined&&(typeof schema.description!=='string'||schema.description.length>500))throw new Error(label+'.description is invalid');
    const names=Object.keys(schema.properties).sort();if(!names.length||names.length>maxProperties)throw new Error(label+' property count is outside the declared ceiling');
    names.forEach(function(name){adapterFieldName(name,label+'.properties');inspectAdapterPrimitive(schema.properties[name],label+'.properties.'+name);});
    if(!Array.isArray(schema.required)||new Set(schema.required).size!==schema.required.length)throw new Error(label+'.required must be a unique array');
    schema.required.forEach(function(name){if(!Object.prototype.hasOwnProperty.call(schema.properties,name))throw new Error(label+'.required names an unknown property');});
  }
  function primitiveSchemaCompatible(source,target) {
    if(source.enum!==undefined)return source.enum.every(function(value){return primitiveValueValid(target,value,false);});
    if(target.enum!==undefined)return false;
    if(source.type!==target.type&&!(source.type==='integer'&&target.type==='number'))return false;
    if(source.type==='string'){
      const sourceMin=source.minLength===undefined?0:source.minLength,sourceMax=source.maxLength===undefined?Infinity:source.maxLength;
      if(target.minLength!==undefined&&sourceMin<target.minLength)return false;
      if(target.maxLength!==undefined&&sourceMax>target.maxLength)return false;
    }
    if(source.type==='number'||source.type==='integer'){
      const sourceMin=source.minimum===undefined?-Infinity:source.minimum,sourceMax=source.maximum===undefined?Infinity:source.maximum;
      if(target.minimum!==undefined&&sourceMin<target.minimum)return false;
      if(target.maximum!==undefined&&sourceMax>target.maximum)return false;
    }
    return true;
  }
  function adapterExample(schema) {
    if(schema.enum)return schema.enum[0];
    if(schema.type==='string')return schema.minLength?Array(schema.minLength+1).join('x'):'value';
    if(schema.type==='integer'||schema.type==='number')return schema.minimum===undefined?0:schema.minimum;
    return true;
  }
  function inspectAdapterParameters(parameters) {
    exact(parameters,['inputContract','outputContract','sourceSchema','targetSchema','mappings','drops','maxProperties','maxInputBytes','maxOutputBytes'],'parameters');
    const inputContract=contractId(parameters.inputContract,'inputContract'),outputContract=contractId(parameters.outputContract,'outputContract');
    if(inputContract===outputContract)throw new Error('adapter contracts must be distinct');
    if(!Number.isInteger(parameters.maxProperties)||parameters.maxProperties<1||parameters.maxProperties>64)throw new Error('maxProperties is outside the bounded range');
    ['maxInputBytes','maxOutputBytes'].forEach(function(key){if(!Number.isInteger(parameters[key])||parameters[key]<64||parameters[key]>65536)throw new Error(key+' is outside the bounded range');});
    if(byteLength(parameters.sourceSchema)>16384||byteLength(parameters.targetSchema)>16384)throw new Error('adapter schema exceeds 16 KiB');
    inspectAdapterObjectSchema(parameters.sourceSchema,'sourceSchema',parameters.maxProperties);inspectAdapterObjectSchema(parameters.targetSchema,'targetSchema',parameters.maxProperties);
    if(!Array.isArray(parameters.mappings)||!parameters.mappings.length||parameters.mappings.length>parameters.maxProperties)throw new Error('mappings are outside the bounded range');
    if(!Array.isArray(parameters.drops)||parameters.drops.length>parameters.maxProperties)throw new Error('drops are outside the bounded range');
    const sourceProperties=parameters.sourceSchema.properties,targetProperties=parameters.targetSchema.properties,sourceRequired=new Set(parameters.sourceSchema.required),targetRequired=new Set(parameters.targetSchema.required),seenSource=new Set(),seenTarget=new Set();
    const mappings=parameters.mappings.map(function(row,index){
      exact(row,['source','target','onMissing','defaultValue'],'mappings['+index+']');
      const source=adapterFieldName(row.source,'mappings['+index+'].source'),target=adapterFieldName(row.target,'mappings['+index+'].target'),onMissing=String(row.onMissing||'');
      if(!Object.prototype.hasOwnProperty.call(sourceProperties,source)||!Object.prototype.hasOwnProperty.call(targetProperties,target))throw new Error('mapping names an undeclared source or target property');
      if(seenSource.has(source)||seenTarget.has(target))throw new Error('mapping source and target fields must be unique');seenSource.add(source);seenTarget.add(target);
      if(!['REFUSE','OMIT','DEFAULT'].includes(onMissing))throw new Error('mapping onMissing policy is invalid');
      if(onMissing==='DEFAULT'){if(!primitiveValueValid(targetProperties[target],row.defaultValue,false))throw new Error('mapping default does not satisfy the target property');}
      else if(row.defaultValue!==null)throw new Error('non-default mapping must carry null defaultValue');
      if(sourceRequired.has(source)&&onMissing!=='REFUSE')throw new Error('required source fields use the REFUSE policy');
      if(!sourceRequired.has(source)&&targetRequired.has(target)&&onMissing==='OMIT')throw new Error('required target field cannot be omitted');
      if(!primitiveSchemaCompatible(sourceProperties[source],targetProperties[target]))throw new Error('source property is not structurally compatible with target property '+target);
      return {source:source,target:target,onMissing:onMissing,defaultValue:row.defaultValue};
    }).sort(function(a,b){return a.target.localeCompare(b.target);});
    const drops=parameters.drops.map(function(value){return adapterFieldName(value,'drops');}).sort();if(new Set(drops).size!==drops.length)throw new Error('drops must be unique');
    drops.forEach(function(name){if(!Object.prototype.hasOwnProperty.call(sourceProperties,name)||seenSource.has(name))throw new Error('drop must name one otherwise-unmapped source property');});
    Object.keys(targetProperties).forEach(function(name){if(!seenTarget.has(name))throw new Error('every target property needs one explicit mapping');});
    Object.keys(sourceProperties).forEach(function(name){if(!seenSource.has(name)&&!drops.includes(name))throw new Error('every source property must be mapped or explicitly dropped');});
    const partial=mappings.some(function(row){return !sourceRequired.has(row.source)&&row.onMissing==='REFUSE';});
    const config={inputContract:inputContract,outputContract:outputContract,sourceSchema:JSON.parse(canonicalJson(parameters.sourceSchema)),targetSchema:JSON.parse(canonicalJson(parameters.targetSchema)),mappings:mappings,drops:drops,maxProperties:parameters.maxProperties,maxInputBytes:parameters.maxInputBytes,maxOutputBytes:parameters.maxOutputBytes,totality:partial?'PARTIAL':'TOTAL',structuralClaim:'SUCCESSFUL_OUTPUT_SATISFIES_DECLARED_TARGET_SHAPE',semanticClaim:'UNPROVEN'};
    config.mappingDigest=digest(config);return config;
  }
  function objectAdapterSource(config) {
    return "'use strict';\nfunction deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.keys(value).forEach(key=>deepFreeze(value[key]));}return value;}\nconst CONFIG=deepFreeze("+JSON.stringify(config)+");\nfunction own(v,k){return Object.prototype.hasOwnProperty.call(Object(v),k);}\nfunction jsonRecord(v){if(!v||typeof v!=='object'||Array.isArray(v))return false;const prototype=Object.getPrototypeOf(v);if(prototype!==Object.prototype&&prototype!==null)return false;if(Object.getOwnPropertySymbols(v).length)return false;return Object.getOwnPropertyNames(v).every(k=>{const descriptor=Object.getOwnPropertyDescriptor(v,k);return descriptor&&descriptor.enumerable&&own(descriptor,'value');});}\nfunction bytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8');}catch(_){return Infinity;}}\nfunction primitive(v,s){if(s.type==='string'&&typeof v!=='string')return false;if(s.type==='boolean'&&typeof v!=='boolean')return false;if(s.type==='integer'&&!Number.isInteger(v))return false;if(s.type==='number'&&(typeof v!=='number'||!Number.isFinite(v)))return false;if(s.type==='string'){const length=Array.from(v).length;if(s.minLength!==undefined&&length<s.minLength)return false;if(s.maxLength!==undefined&&length>s.maxLength)return false;}if(s.type==='integer'||s.type==='number'){if(s.minimum!==undefined&&v<s.minimum)return false;if(s.maximum!==undefined&&v>s.maximum)return false;}return s.enum===undefined||s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v));}\nfunction validate(v,s){const errors=[];if(!jsonRecord(v))return [{path:'$',code:'PLAIN_JSON_OBJECT_REQUIRED'}];const properties=s.properties||{};(s.required||[]).forEach(k=>{if(!own(v,k))errors.push({path:'$.'+k,code:'REQUIRED'});});Object.keys(v).sort().forEach(k=>{if(!own(properties,k))errors.push({path:'$.'+k,code:'ADDITIONAL_PROPERTY'});else if(!primitive(v[k],properties[k]))errors.push({path:'$.'+k,code:'VALUE_INVALID'});});return errors;}\nfunction put(v,k,value){Object.defineProperty(v,k,{value:value,enumerable:true,writable:true,configurable:true});}\nfunction adapt(input){const sourceErrors=validate(input,CONFIG.sourceSchema);if(sourceErrors.length)return {schema:CONFIG.outputContract,ok:false,code:'SOURCE_CONTRACT_INVALID',errors:sourceErrors,mappingDigest:CONFIG.mappingDigest};if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.outputContract,ok:false,code:'INPUT_BYTES_EXCEEDED',mappingDigest:CONFIG.mappingDigest};const output={};for(const map of CONFIG.mappings){if(own(input,map.source))put(output,map.target,input[map.source]);else if(map.onMissing==='DEFAULT')put(output,map.target,map.defaultValue);else if(map.onMissing==='REFUSE')return {schema:CONFIG.outputContract,ok:false,code:'SOURCE_FIELD_MISSING',field:map.source,mappingDigest:CONFIG.mappingDigest};}const targetErrors=validate(output,CONFIG.targetSchema);if(targetErrors.length)return {schema:CONFIG.outputContract,ok:false,code:'TARGET_CONTRACT_INVALID',errors:targetErrors,mappingDigest:CONFIG.mappingDigest};if(bytes(output)>CONFIG.maxOutputBytes)return {schema:CONFIG.outputContract,ok:false,code:'OUTPUT_BYTES_EXCEEDED',mappingDigest:CONFIG.mappingDigest};return {schema:CONFIG.outputContract,ok:true,output:output,mappingDigest:CONFIG.mappingDigest,totality:CONFIG.totality,semanticCompatibilityProven:false};}\nmodule.exports={CONFIG:CONFIG,adapt:adapt};\n";
  }
  function objectAdapterSelftest(config) {
    const input={};Object.keys(config.sourceSchema.properties).sort().forEach(function(name){input[name]=adapterExample(config.sourceSchema.properties[name]);});
    const expected={};config.mappings.forEach(function(row){expected[row.target]=input[row.source];});
    const defaultMap=config.mappings.find(function(row){return row.onMissing==='DEFAULT';});
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const input="+JSON.stringify(input)+",expected="+JSON.stringify(expected)+";assert(Object.isFrozen(capability.CONFIG));assert(Object.isFrozen(capability.CONFIG.mappings));assert(Object.isFrozen(capability.CONFIG.sourceSchema.properties));assert.throws(()=>{capability.CONFIG.mappings[0].target='drift';},TypeError);const first=capability.adapt(input),second=capability.adapt(input);assert.equal(first.ok,true);assert.deepStrictEqual(first,second);assert.deepStrictEqual(first.output,expected);assert.equal(first.semanticCompatibilityProven,false);"+(defaultMap?"const withoutDefault=Object.assign({},input);delete withoutDefault["+JSON.stringify(defaultMap.source)+"];assert.deepStrictEqual(capability.adapt(withoutDefault).output["+JSON.stringify(defaultMap.target)+"],"+JSON.stringify(defaultMap.defaultValue)+");":"")+"assert.equal(capability.adapt(Object.assign({},input,{undeclared:true})).code,'SOURCE_CONTRACT_INVALID');const hostile=Object.assign({},input);hostile.toJSON=()=>{throw new Error('must not execute');};assert.equal(capability.adapt(hostile).code,'SOURCE_CONTRACT_INVALID');console.log('PASS closed object contract adapter capability');\n";
  }
  function buildObjectAdapter(parameters) {
    const config=inspectAdapterParameters(parameters);
    return {capabilityKind:'HAND',source:objectAdapterSource(config),selftest:objectAdapterSelftest(config),provides:[config.outputContract],consumes:[config.inputContract],summary:'Closed deterministic object-contract adapter with explicit field loss and structural compatibility proof.'};
  }
  function objectAdapterExampleParameters() {
    return {
      inputContract:'axm.example.legacy-player/v1',outputContract:'axm.example.player-summary/v1',
      sourceSchema:{type:'object',additionalProperties:false,required:['displayName','score'],properties:{displayName:{type:'string',minLength:1,maxLength:80},score:{type:'integer',minimum:0,maximum:999999},category:{type:'string',maxLength:32},legacyNote:{type:'string',maxLength:120}}},
      targetSchema:{type:'object',additionalProperties:false,required:['name','points','label'],properties:{name:{type:'string',minLength:1,maxLength:80},points:{type:'number',minimum:0,maximum:999999},label:{type:'string',maxLength:32}}},
      mappings:[{source:'displayName',target:'name',onMissing:'REFUSE',defaultValue:null},{source:'score',target:'points',onMissing:'REFUSE',defaultValue:null},{source:'category',target:'label',onMissing:'DEFAULT',defaultValue:'unlabeled'}],
      drops:['legacyNote'],maxProperties:16,maxInputBytes:4096,maxOutputBytes:4096
    };
  }
  function objectAdapterContributionSource() {
    const prefix="'use strict';\nconst crypto=require('crypto');\nconst BUILDER_ID='closed-object-contract-adapter-v1';\n";
    const aliases="const canonicalJson=stable;\nfunction digest(value){return 'sha256:'+crypto.createHash('sha256').update(stable(value)).digest('hex');}\n";
    const functions=[stable,byteLength,exactKeys,exact,contractId,adapterFieldName,primitiveValueValid,inspectAdapterPrimitive,inspectAdapterObjectSchema,primitiveSchemaCompatible,adapterExample,inspectAdapterParameters,objectAdapterSource,objectAdapterSelftest,buildObjectAdapter].map(function(fn){return String(fn).replace(/\r\n/g,'\n');}).join('\n');
    return prefix+String(stable).replace(/\r\n/g,'\n')+'\n'+aliases+functions.split('\n').slice(String(stable).split('\n').length).join('\n')+"\nmodule.exports={id:BUILDER_ID,build:buildObjectAdapter};\n";
  }
  function objectAdapterContributionSelftestSource() {
    return "'use strict';\nconst assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),childProcess=require('child_process');const builder=require('./builder-contribution.js');const parameters="+JSON.stringify(objectAdapterExampleParameters())+";const first=builder.build(parameters),second=builder.build(parameters);assert.equal(builder.id,'closed-object-contract-adapter-v1');assert.deepStrictEqual(first,second);assert.deepStrictEqual(first.consumes,[parameters.inputContract]);assert.deepStrictEqual(first.provides,[parameters.outputContract]);new Function(first.source);new Function(first.selftest);const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-object-adapter-builder-test-'));try{fs.writeFileSync(path.join(root,'capability.js'),first.source,{flag:'wx'});fs.writeFileSync(path.join(root,'selftest.js'),first.selftest,{flag:'wx'});const run=childProcess.spawnSync(process.execPath,[path.join(root,'selftest.js')],{cwd:root,encoding:'utf8',timeout:5000});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/PASS/);}finally{const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('axm-object-adapter-builder-test-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});}const hidden=JSON.parse(JSON.stringify(parameters));hidden.drops=[];assert.throws(()=>builder.build(hidden),/mapped or explicitly dropped/);const narrowing=JSON.parse(JSON.stringify(parameters));narrowing.targetSchema.properties.name.maxLength=20;assert.throws(()=>builder.build(narrowing),/structurally compatible/);const missing=JSON.parse(JSON.stringify(parameters));missing.mappings=missing.mappings.slice(0,2);assert.throws(()=>builder.build(missing),/target property/);const wrongDefault=JSON.parse(JSON.stringify(parameters));wrongDefault.mappings[2].defaultValue=7;assert.throws(()=>builder.build(wrongDefault),/default/);const wrongKeyword=JSON.parse(JSON.stringify(parameters));wrongKeyword.sourceSchema.properties.score.minLength=1;assert.throws(()=>builder.build(wrongKeyword),/string-only keyword/);const unsafePattern=JSON.parse(JSON.stringify(parameters));unsafePattern.sourceSchema.properties.displayName.pattern='(a+)+$';assert.throws(()=>builder.build(unsafePattern),/unsupported key/);const reserved=JSON.parse(JSON.stringify(parameters));Object.defineProperty(reserved.targetSchema.properties,'__proto__',{value:{type:'string'},enumerable:true});assert.throws(()=>builder.build(reserved),/invalid/);assert.throws(()=>builder.build(Object.assign({},parameters,{surprise:true})),/unsupported key/);process.stdout.write('closed object contract adapter builder contribution selftest PASS\\n');\n";
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
    makeEntry('bounded-review-procedure-skill-v1','SKILL',REVIEW_CANDIDATE,'sha256:acd5678b5327fda7c2a2f1280fb4fa26f41cfd188e4788c1df3c2e539ee532ba',buildReviewSkill,[exact,list,safeId,contractId,renderSkillMarkdown,renderSkillSelftest,buildReviewSkill]),
    makeEntry('closed-object-contract-adapter-v1','HAND',REVIEW_CANDIDATE,'sha256:65a4fbfab2452f0e2c6a8fbff0f873f2b58f6b6cb7f0f533cbe1a260f9f151d1',buildObjectAdapter,[adapterFieldName,primitiveValueValid,inspectAdapterPrimitive,inspectAdapterObjectSchema,primitiveSchemaCompatible,adapterExample,inspectAdapterParameters,objectAdapterSource,objectAdapterSelftest,buildObjectAdapter])
  ];
  // Lifecycle activation is applied after implementation sealing so the exact
  // source-reviewed builder digest remains the one bound by the admission plan.
  entries.find(function(entry){return entry.id==='closed-json-schema-validator-v1';}).status=ACTIVE;
  entries.find(function(entry){return entry.id==='bounded-review-procedure-skill-v1';}).status=ACTIVE;
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
    reviewCandidateContribution:function(id){if(id!=='closed-object-contract-adapter-v1')return null;return {builderSource:objectAdapterContributionSource(),builderSelftestSource:objectAdapterContributionSelftestSource(),exampleParameters:JSON.parse(canonicalJson(objectAdapterExampleParameters()))};},
    activeIds:function(){return entries.filter(function(entry){return entry.status===ACTIVE;}).map(function(entry){return entry.id;}).sort();},
    reviewCandidateIds:function(){return entries.filter(function(entry){return entry.status===REVIEW_CANDIDATE;}).map(function(entry){return entry.id;}).sort();},
    compileActive:compileActive,compileReviewCandidate:compileReviewCandidate
  };
});
