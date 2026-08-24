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

  function jsonTransformField(value,label){
    if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)||['constructor','prototype'].includes(value))throw new Error(label+' is invalid');
    return value;
  }
  function jsonTransformText(value,label,maxLength){
    if(typeof value!=='string'||value.length>maxLength)throw new Error(label+' must be a bounded string');
    return value;
  }
  function jsonTransformSchema(value){
    if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(value))throw new Error('outputSchema is invalid');
    return value;
  }
  function jsonTransformSource(config) {
    return [
      "'use strict';",
      "function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.getOwnPropertyNames(value).forEach(function(key){deepFreeze(value[key]);});}return value;}",
      'const CONFIG=deepFreeze('+JSON.stringify(config)+');',
      "function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}",
      "function safeField(value){return typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)&&value!=='constructor'&&value!=='prototype';}",
      "function recordPrototype(value){const prototype=Object.getPrototypeOf(value);if(prototype===null)return true;if(Object.getPrototypeOf(prototype)!==null||Object.getOwnPropertySymbols(prototype).length)return false;const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor'),safe=['__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','__proto__','constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','toString','valueOf'];return !!constructor&&own(constructor,'value')&&typeof constructor.value==='function'&&constructor.value.name==='Object'&&Function.prototype.toString.call(constructor.value)==='function Object() { [native code] }'&&Object.getOwnPropertyNames(prototype).every(function(key){return safe.includes(key);});}",
      "function inspectRecord(value){if(!value||typeof value!=='object'||Array.isArray(value))return 'INPUT_OBJECT_REQUIRED';if(!recordPrototype(value)||Object.getOwnPropertySymbols(value).length)return 'INPUT_FIELD_UNSUPPORTED';const names=Object.getOwnPropertyNames(value);if(names.length>CONFIG.maxInputKeys)return 'INPUT_KEY_LIMIT';for(let index=0;index<names.length;index+=1){const key=names[index],descriptor=Object.getOwnPropertyDescriptor(value,key);if(!safeField(key)||!descriptor||!descriptor.enumerable||!own(descriptor,'value'))return 'INPUT_FIELD_UNSUPPORTED';if(typeof descriptor.value!=='string'||descriptor.value.length>CONFIG.maxValueLength)return 'INPUT_VALUE_INVALID';}return null;}",
      "function utf8Bytes(value){let total=0;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code<128)total+=1;else if(code<2048)total+=2;else if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){total+=4;index+=1;}else total+=3;}else total+=3;}return total;}",
      "function recordBytes(value){const keys=Object.getOwnPropertyNames(value).sort();let total=2;keys.forEach(function(key,index){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(index)total+=1;total+=utf8Bytes(JSON.stringify(key))+1+utf8Bytes(JSON.stringify(descriptor.value));});return total;}",
      "function failure(code){return {schema:CONFIG.outputSchema,ok:false,code:code};}",
      "function run(input){const problem=inspectRecord(input);if(problem)return failure(problem);if(recordBytes(input)>CONFIG.maxInputBytes)return failure('INPUT_BYTES_EXCEEDED');const descriptor=own(input,CONFIG.inputField)?Object.getOwnPropertyDescriptor(input,CONFIG.inputField):null,value=descriptor?descriptor.value:CONFIG.defaultValue,output={};Object.defineProperty(output,CONFIG.outputField,{value:value,enumerable:true,writable:true,configurable:true});if(utf8Bytes(JSON.stringify(output))>CONFIG.maxOutputBytes)return failure('OUTPUT_BYTES_EXCEEDED');return {schema:CONFIG.outputSchema,ok:true,output:output};}",
      'module.exports={CONFIG:CONFIG,run:run};',
      ''
    ].join('\n');
  }
  function jsonTransformSelftest(config) {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');assert(Object.isFrozen(capability.CONFIG));const input={"+JSON.stringify(config.inputField)+":'proof',note:'bounded'},first=capability.run(input),second=capability.run(input);assert.equal(first.ok,true);assert.deepStrictEqual(first,second);assert.deepStrictEqual(first.output,{"+JSON.stringify(config.outputField)+":'proof'});assert.notStrictEqual(first.output,input);const fallback=capability.run({});assert.deepStrictEqual(fallback.output,{"+JSON.stringify(config.outputField)+":"+JSON.stringify(config.defaultValue)+"});assert.equal(capability.run(null).code,'INPUT_OBJECT_REQUIRED');assert.equal(capability.run([]).code,'INPUT_OBJECT_REQUIRED');assert.equal(capability.run(new Date()).code,'INPUT_FIELD_UNSUPPORTED');assert.equal(capability.run({"+JSON.stringify(config.inputField)+":7}).code,'INPUT_VALUE_INVALID');assert.equal(capability.run({"+JSON.stringify(config.inputField)+":'x'.repeat("+(config.maxValueLength+1)+")}).code,'INPUT_VALUE_INVALID');const accessor={};let getterRead=false;Object.defineProperty(accessor,"+JSON.stringify(config.inputField)+",{enumerable:true,get(){getterRead=true;throw new Error('must not execute');}});assert.equal(capability.run(accessor).code,'INPUT_FIELD_UNSUPPORTED');assert.equal(getterRead,false);let inheritedHookRead=false;const inheritedPrototype=Object.create(null);Object.defineProperty(inheritedPrototype,'constructor',{value:Object});Object.defineProperty(inheritedPrototype,'toJSON',{get(){inheritedHookRead=true;throw new Error('must not execute');}});const inherited=Object.create(inheritedPrototype);inherited["+JSON.stringify(config.inputField)+"]='proof';assert.equal(capability.run(inherited).code,'INPUT_FIELD_UNSUPPORTED');assert.equal(inheritedHookRead,false);const custom={"+JSON.stringify(config.inputField)+":'proof',toJSON:function(){throw new Error('must not execute');}};assert.equal(capability.run(custom).code,'INPUT_VALUE_INVALID');const symbolRecord={"+JSON.stringify(config.inputField)+":'proof'};symbolRecord[Symbol('hidden')]='x';assert.equal(capability.run(symbolRecord).code,'INPUT_FIELD_UNSUPPORTED');const reserved={"+JSON.stringify(config.inputField)+":'proof'};Object.defineProperty(reserved,'__proto__',{value:'x',enumerable:true});assert.equal(capability.run(reserved).code,'INPUT_FIELD_UNSUPPORTED');class RecordValue{constructor(){this["+JSON.stringify(config.inputField)+"]='proof';}}assert.equal(capability.run(new RecordValue()).code,'INPUT_FIELD_UNSUPPORTED');const keys={};for(let index=0;index<"+(config.maxInputKeys+1)+";index+=1)keys['k'+index]='x';assert.equal(capability.run(keys).code,'INPUT_KEY_LIMIT');const byteHeavy={a:'é'.repeat("+config.maxValueLength+"),b:'é'.repeat("+config.maxValueLength+"),c:'é'.repeat("+config.maxValueLength+")};assert.equal(capability.run(byteHeavy).code,'INPUT_BYTES_EXCEEDED');assert.equal(capability.run({"+JSON.stringify(config.inputField)+":'\\\\'.repeat("+config.maxValueLength+")}).code,'OUTPUT_BYTES_EXCEEDED');console.log('PASS bounded JavaScript string-record transform capability');\n";
  }
  function buildJsonTransform(parameters) {
    htmlExact(parameters,['inputField','outputField','defaultValue','outputSchema','maxInputKeys','maxValueLength','maxInputBytes','maxOutputBytes'],'parameters');
    if(!Number.isInteger(parameters.maxInputKeys)||parameters.maxInputKeys<1||parameters.maxInputKeys>64)throw new Error('maxInputKeys is outside the bounded range');
    if(!Number.isInteger(parameters.maxValueLength)||parameters.maxValueLength<8||parameters.maxValueLength>4096)throw new Error('maxValueLength is outside the bounded range');
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<128||parameters.maxInputBytes>1048576)throw new Error('maxInputBytes is outside the bounded range');
    if(!Number.isInteger(parameters.maxOutputBytes)||parameters.maxOutputBytes<64||parameters.maxOutputBytes>1048576)throw new Error('maxOutputBytes is outside the bounded range');
    const config={inputField:jsonTransformField(parameters.inputField,'inputField'),outputField:jsonTransformField(parameters.outputField,'outputField'),defaultValue:jsonTransformText(parameters.defaultValue,'defaultValue',parameters.maxValueLength),outputSchema:jsonTransformSchema(parameters.outputSchema),maxInputKeys:parameters.maxInputKeys,maxValueLength:parameters.maxValueLength,maxInputBytes:parameters.maxInputBytes,maxOutputBytes:parameters.maxOutputBytes};
    if(byteLength(JSON.stringify(Object.fromEntries([[config.outputField,config.defaultValue]])))>config.maxOutputBytes)throw new Error('default output exceeds maxOutputBytes');
    return {capabilityKind:'HAND',source:jsonTransformSource(config),selftest:jsonTransformSelftest(config),provides:[config.outputSchema],consumes:['axm.bounded-string-record/v1'],summary:'Strict deterministic JavaScript string-record field transform with accessor refusal and byte ceilings.'};
  }

  function svgXmlText(value){
    if(typeof value!=='string'||!value.trim()||value.length>48)return false;
    for(let index=0;index<value.length;index+=1){
      const code=value.charCodeAt(index);
      if(code===9||code===10||code===13||(code>=32&&code<=55295)||(code>=57344&&code<=65533))continue;
      if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){index+=1;continue;}}
      return false;
    }
    return true;
  }
  function svgText(value,label){
    if(!svgXmlText(value))throw new Error(label+' is invalid');
    return value;
  }
  function svgColor(value,label){
    if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw new Error(label+' must be a six-digit hexadecimal color');
    return value.toLowerCase();
  }
  function svgEscape(value){
    return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function svgBadgeMarkup(config,label,value){
    const escapedLabel=svgEscape(label),escapedValue=svgEscape(value),title=svgEscape(label+': '+value),split=Math.floor(config.width*0.58);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+config.width+'" height="28" viewBox="0 0 '+config.width+' 28" role="img" focusable="false" aria-label="'+title+'"><title>'+title+'</title><rect width="'+config.width+'" height="28" rx="5" fill="'+config.background+'"/><rect x="'+split+'" width="'+(config.width-split)+'" height="28" rx="5" fill="'+config.foreground+'"/><text x="10" y="19" fill="#ffffff" font-family="system-ui, sans-serif" font-size="13">'+escapedLabel+'</text><text x="'+(split+8)+'" y="19" fill="#081018" font-family="system-ui, sans-serif" font-size="13" font-weight="700">'+escapedValue+'</text></svg>';
  }
  function svgBadgeSource(config) {
    return [
      "'use strict';",
      "function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.getOwnPropertyNames(value).forEach(function(key){deepFreeze(value[key]);});}return value;}",
      'const CONFIG=deepFreeze('+JSON.stringify(config)+');',
      "function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}",
      "function recordPrototype(value){const prototype=Object.getPrototypeOf(value);if(prototype===null)return true;if(Object.getPrototypeOf(prototype)!==null||Object.getOwnPropertySymbols(prototype).length)return false;const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor'),safe=['__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','__proto__','constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','toString','valueOf'];return !!constructor&&own(constructor,'value')&&typeof constructor.value==='function'&&constructor.value.name==='Object'&&Function.prototype.toString.call(constructor.value)==='function Object() { [native code] }'&&Object.getOwnPropertyNames(prototype).every(function(key){return safe.includes(key);});}",
      "function jsonRecord(value){if(!value||typeof value!=='object'||Array.isArray(value)||!recordPrototype(value))return false;if(Object.getOwnPropertySymbols(value).length)return false;return Object.getOwnPropertyNames(value).every(function(key){const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&descriptor.enumerable&&own(descriptor,'value');});}",
      "function utf8Bytes(value){let total=0;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code<128)total+=1;else if(code<2048)total+=2;else if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){total+=4;index+=1;}else total+=3;}else total+=3;}return total;}",
      "function recordBytes(value){let total=2,written=false;['label','value'].forEach(function(key){if(!own(value,key))return;if(written)total+=1;written=true;total+=utf8Bytes(JSON.stringify(key))+1+utf8Bytes(JSON.stringify(Object.getOwnPropertyDescriptor(value,key).value));});return total;}",
      "function xmlText(value){if(typeof value!=='string'||!value.trim()||value.length>48)return false;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code===9||code===10||code===13||(code>=32&&code<=55295)||(code>=57344&&code<=65533))continue;if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){index+=1;continue;}}return false;}return true;}",
      "function text(value){return xmlText(value)?value:null;}",
      "function esc(value){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#39;');}",
      "function markup(label,value){const escapedLabel=esc(label),escapedValue=esc(value),title=esc(label+': '+value),split=Math.floor(CONFIG.width*0.58);return '<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" viewBox=\\\"0 0 '+CONFIG.width+' 28\\\" role=\\\"img\\\" focusable=\\\"false\\\" aria-label=\\\"'+title+'\\\"><title>'+title+'</title><rect width=\\\"'+CONFIG.width+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.background+'\\\"/><rect x=\\\"'+split+'\\\" width=\\\"'+(CONFIG.width-split)+'\\\" height=\\\"28\\\" rx=\\\"5\\\" fill=\\\"'+CONFIG.foreground+'\\\"/><text x=\\\"10\\\" y=\\\"19\\\" fill=\\\"#ffffff\\\" font-family=\\\"system-ui, sans-serif\\\" font-size=\\\"13\\\">'+escapedLabel+'</text><text x=\\\"'+(split+8)+'\\\" y=\\\"19\\\" fill=\\\"#081018\\\" font-family=\\\"system-ui, sans-serif\\\" font-size=\\\"13\\\" font-weight=\\\"700\\\">'+escapedValue+'</text></svg>';}",
      "function render(input){if(!jsonRecord(input))return {schema:CONFIG.resultSchemaId,ok:false,code:'INPUT_OBJECT_REQUIRED'};const keys=Object.keys(input);if(keys.some(function(key){return key!=='label'&&key!=='value';}))return {schema:CONFIG.resultSchemaId,ok:false,code:'INPUT_FIELDS_UNSUPPORTED'};const label=text(own(input,'label')?Object.getOwnPropertyDescriptor(input,'label').value:CONFIG.label),value=text(own(input,'value')?Object.getOwnPropertyDescriptor(input,'value').value:CONFIG.value);if(!label||!value)return {schema:CONFIG.resultSchemaId,ok:false,code:'TEXT_INVALID'};if(recordBytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,code:'INPUT_BYTES_EXCEEDED'};const svg=markup(label,value);if(utf8Bytes(svg)>CONFIG.maxOutputBytes)return {schema:CONFIG.resultSchemaId,ok:false,code:'SVG_BYTES_EXCEEDED'};return {schema:CONFIG.resultSchemaId,ok:true,mimeType:'image/svg+xml',svg:svg};}",
      'module.exports={CONFIG:CONFIG,render:render};',
      ''
    ].join('\n');
  }
  function svgBadgeSelftest(config) {
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');assert(Object.isFrozen(capability.CONFIG));const first=capability.render({label:'A&B',value:'<ok>'}),second=capability.render({label:'A&B',value:'<ok>'});assert.equal(first.ok,true);assert.equal(first.svg,second.svg);assert(first.svg.includes('<title>A&amp;B: &lt;ok&gt;</title>'));assert(first.svg.includes('viewBox=\\\"0 0 "+config.width+" 28\\\"'));assert(!/(?:<script|<style|\\son[a-z]+=|href=|xlink:href|url\\s*\\(|@import|<animate|<set|<foreignObject)/i.test(first.svg));assert.equal(capability.render({unexpected:true}).code,'INPUT_FIELDS_UNSUPPORTED');assert.equal(capability.render({label:'',value:'ok'}).code,'TEXT_INVALID');assert.equal(capability.render({label:'x'.repeat(49),value:'ok'}).code,'TEXT_INVALID');assert.equal(capability.render({label:'ok\\u0000',value:'ok'}).code,'TEXT_INVALID');assert.equal(capability.render({label:'ok\\u0001',value:'ok'}).code,'TEXT_INVALID');assert.equal(capability.render({label:'ok\\ud800',value:'ok'}).code,'TEXT_INVALID');assert.equal(capability.render([]).code,'INPUT_OBJECT_REQUIRED');assert.equal(capability.render(new Date()).code,'INPUT_OBJECT_REQUIRED');const accessor={value:'ok'};Object.defineProperty(accessor,'label',{enumerable:true,get(){throw new Error('must not execute');}});assert.equal(capability.render(accessor).code,'INPUT_OBJECT_REQUIRED');const hostile={label:'ok',value:'ok',toJSON(){throw new Error('must not execute');}};assert.equal(capability.render(hostile).code,'INPUT_FIELDS_UNSUPPORTED');let inheritedHookRead=false;const inheritedPrototype=Object.create(null);Object.defineProperty(inheritedPrototype,'constructor',{value:Object});Object.defineProperty(inheritedPrototype,'toJSON',{get(){inheritedHookRead=true;throw new Error('must not execute');}});const inherited=Object.create(inheritedPrototype);inherited.label='ok';inherited.value='ok';assert.equal(capability.render(inherited).code,'INPUT_OBJECT_REQUIRED');assert.equal(inheritedHookRead,false);assert.equal(capability.render({label:'😀'.repeat(24),value:'😀'.repeat(24)}).code,'INPUT_BYTES_EXCEEDED');assert.equal(capability.render({label:'&'.repeat(48),value:'&'.repeat(48)}).code,'SVG_BYTES_EXCEEDED');console.log('PASS strict deterministic SVG badge capability');\n";
  }
  function buildSvgBadge(parameters) {
    htmlExact(parameters,['resultSchemaId','label','value','background','foreground','width','maxInputBytes','maxOutputBytes'],'parameters');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId||''))throw new Error('resultSchemaId is invalid');
    if(!Number.isInteger(parameters.width)||parameters.width<120||parameters.width>512)throw new Error('width is outside the bounded range');
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<128||parameters.maxInputBytes>65536)throw new Error('maxInputBytes is outside the bounded range');
    if(!Number.isInteger(parameters.maxOutputBytes)||parameters.maxOutputBytes<512||parameters.maxOutputBytes>65536)throw new Error('maxOutputBytes is outside the bounded range');
    const config={resultSchemaId:parameters.resultSchemaId,label:svgText(parameters.label,'label'),value:svgText(parameters.value,'value'),background:svgColor(parameters.background,'background'),foreground:svgColor(parameters.foreground,'foreground'),width:parameters.width,maxInputBytes:parameters.maxInputBytes,maxOutputBytes:parameters.maxOutputBytes};
    if(Buffer.byteLength(svgBadgeMarkup(config,config.label,config.value),'utf8')>config.maxOutputBytes)throw new Error('default SVG exceeds maxOutputBytes');
    return {capabilityKind:'HAND',source:svgBadgeSource(config),selftest:svgBadgeSelftest(config),provides:[config.resultSchemaId,'image/svg+xml'],consumes:['axm.svg-status-badge-content/v1'],summary:'Strict deterministic text-only SVG status badge renderer with closed input and byte ceilings.'};
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

  function htmlExact(value,keys,label){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be an object');
    Object.keys(value).forEach(function(key){if(!keys.includes(key))throw new Error(label+' contains unsupported key '+key);});
    keys.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(value,key))throw new Error(label+' is missing '+key);});
  }
  function htmlText(value,label,maximum){
    const text=String(value==null?'':value);
    if(!text.trim()||text.length>maximum||text.includes('\u0000'))throw new Error(label+' is invalid');
    return text;
  }
  function htmlPageSource(config) {
    return "'use strict';\nconst CONFIG=Object.freeze("+JSON.stringify(config)+");\nfunction bytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8');}catch(e){return Infinity;}}\nfunction own(v,k){return Object.prototype.hasOwnProperty.call(Object(v),k);}\nfunction esc(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#39;');}\nfunction text(v,fallback){const value=v==null?fallback:v;return typeof value==='string'&&value.trim()&&value.length<=CONFIG.maxTextLength&&!value.includes('\\u0000')?value:null;}\nfunction render(input){if(!input||typeof input!=='object'||Array.isArray(input))return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_OBJECT_REQUIRED'}]};if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_BYTES_EXCEEDED'}]};const keys=Object.keys(input);if(keys.some(k=>!['heading','intro','sections'].includes(k)))return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_FIELDS_UNSUPPORTED'}]};const heading=text(input.heading,CONFIG.defaultHeading),intro=text(input.intro,CONFIG.defaultIntro),sections=own(input,'sections')?input.sections:[];if(!heading||!intro)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'TEXT_INVALID'}]};if(!Array.isArray(sections)||sections.length>CONFIG.maxSections)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$.sections',code:'SECTION_LIMIT'}]};const rendered=[];for(let i=0;i<sections.length;i+=1){const row=sections[i];if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['heading','body'].includes(k))||!own(row,'heading')||!own(row,'body'))return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$.sections['+i+']',code:'SECTION_SHAPE'}]};const h=text(row.heading,null),body=text(row.body,null);if(!h||!body)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$.sections['+i+']',code:'SECTION_TEXT_INVALID'}]};const id='section-'+(i+1);rendered.push('<section aria-labelledby=\\\"'+id+'-heading\\\"><h2 id=\\\"'+id+'-heading\\\">'+esc(h)+'</h2><p>'+esc(body)+'</p></section>');}const html='<!doctype html><html lang=\\\"'+CONFIG.language+'\\\"><head><meta charset=\\\"utf-8\\\"><meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1\\\"><title>'+esc(CONFIG.documentTitle)+'</title></head><body><a href=\\\"#content\\\">Skip to content</a><header><h1>'+esc(heading)+'</h1><p>'+esc(intro)+'</p></header><main id=\\\"content\\\">'+rendered.join('')+'</main></body></html>';return {schema:CONFIG.resultSchemaId,ok:true,mimeType:'text/html; charset=utf-8',html:html};}\nmodule.exports={CONFIG:CONFIG,render:render};\n";
  }
  function htmlPageSelftest(config) {
    return "'use strict';\nconst assert=require('assert');const page=require('./capability.js');const input={heading:'<Proof>',intro:'Truth & agency',sections:[{heading:'Start',body:'<script>alert(1)</script>'}]};const one=page.render(input),two=page.render(input);assert.equal(one.ok,true);assert.equal(one.html,two.html);assert(one.html.includes('<html lang=\\\""+config.language+"\\\">'));assert(one.html.includes('name=\\\"viewport\\\"'));assert(one.html.includes('<main id=\\\"content\\\">'));assert(one.html.includes('&lt;script&gt;'));assert(!/<script\\b/i.test(one.html));assert(!/\\son[a-z]+\\s*=/i.test(one.html));assert.equal(page.render({unexpected:true}).ok,false);process.stdout.write('static accessible HTML page candidate selftest PASS\\n');\n";
  }
  function buildHtmlPage(parameters) {
    htmlExact(parameters,['resultSchemaId','documentTitle','language','defaultHeading','defaultIntro','maxSections','maxInputBytes','maxTextLength'],'parameters');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId||''))throw new Error('resultSchemaId is invalid');
    const language=String(parameters.language||'');
    if(!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language))throw new Error('language is invalid');
    if(!Number.isInteger(parameters.maxSections)||parameters.maxSections<0||parameters.maxSections>24)throw new Error('maxSections is outside the bounded range');
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<128||parameters.maxInputBytes>65536)throw new Error('maxInputBytes is outside the bounded range');
    if(!Number.isInteger(parameters.maxTextLength)||parameters.maxTextLength<16||parameters.maxTextLength>4000)throw new Error('maxTextLength is outside the bounded range');
    const config={resultSchemaId:parameters.resultSchemaId,documentTitle:htmlText(parameters.documentTitle,'documentTitle',120),language:language,defaultHeading:htmlText(parameters.defaultHeading,'defaultHeading',120),defaultIntro:htmlText(parameters.defaultIntro,'defaultIntro',500),maxSections:parameters.maxSections,maxInputBytes:parameters.maxInputBytes,maxTextLength:parameters.maxTextLength};
    return {capabilityKind:'HAND',source:htmlPageSource(config),selftest:htmlPageSelftest(config),provides:[parameters.resultSchemaId,'text/html'],consumes:['axm.markup-page-content/v1'],summary:'Pure deterministic accessible HTML document-structure renderer.'};
  }

  function cssTokenName(value,label,maximum){
    const text=String(value||'');
    if(!/^[a-z][a-z0-9-]*$/.test(text)||text.length>maximum)throw new Error(label+' is invalid');
    return text;
  }
  function cssTokenValue(kind,value,label){
    if(kind==='COLOR_HEX'){
      if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw new Error(label+' must be a six-digit hexadecimal color');
      return value.toLowerCase();
    }
    if(kind==='LENGTH_PX'){
      if(!Number.isInteger(value)||value<0||value>4096)throw new Error(label+' must be an integer from 0 to 4096');
      return String(value)+'px';
    }
    if(kind==='INTEGER'){
      if(!Number.isInteger(value)||value<-1000||value>1000)throw new Error(label+' must be an integer from -1000 to 1000');
      return String(value);
    }
    if(kind==='PERCENT'){
      if(!Number.isInteger(value)||value<0||value>100)throw new Error(label+' must be an integer from 0 to 100');
      return String(value)+'%';
    }
    if(kind==='TIME_MS'){
      if(!Number.isInteger(value)||value<0||value>60000)throw new Error(label+' must be an integer from 0 to 60000');
      return String(value)+'ms';
    }
    throw new Error(label+' has an unsupported token kind');
  }
  function cssStylesheetSource(config){
    return [
      "'use strict';",
      'function deepFreeze(value){if(value&&typeof value===\'object\'&&!Object.isFrozen(value)){Object.freeze(value);Object.keys(value).forEach(function(key){deepFreeze(value[key]);});}return value;}',
      'const CONFIG=deepFreeze('+JSON.stringify(config)+');',
      'function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}',
      'function jsonRecord(value){if(!value||typeof value!==\'object\'||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)return false;if(Object.getOwnPropertySymbols(value).length)return false;return Object.getOwnPropertyNames(value).every(function(key){const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&descriptor.enumerable&&own(descriptor,\'value\');});}',
      'function bytes(value){try{return Buffer.byteLength(JSON.stringify(value),\'utf8\');}catch(_){return Infinity;}}',
      'function cssValue(token,value){if(token.kind===\'COLOR_HEX\')return typeof value===\'string\'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():null;if(token.kind===\'LENGTH_PX\')return Number.isInteger(value)&&value>=0&&value<=4096?String(value)+\'px\':null;if(token.kind===\'INTEGER\')return Number.isInteger(value)&&value>=-1000&&value<=1000?String(value):null;if(token.kind===\'PERCENT\')return Number.isInteger(value)&&value>=0&&value<=100?String(value)+\'%\':null;if(token.kind===\'TIME_MS\')return Number.isInteger(value)&&value>=0&&value<=60000?String(value)+\'ms\':null;return null;}',
      'function render(input){if(!jsonRecord(input))return {schema:CONFIG.resultSchemaId,ok:false,code:\'INPUT_OBJECT_REQUIRED\'};const inputKeys=Object.keys(input);if(inputKeys.some(function(key){return key!==\'overrides\';}))return {schema:CONFIG.resultSchemaId,ok:false,code:\'INPUT_FIELDS_UNSUPPORTED\'};const overrides=own(input,\'overrides\')?input.overrides:{};if(!jsonRecord(overrides))return {schema:CONFIG.resultSchemaId,ok:false,code:\'OVERRIDES_OBJECT_REQUIRED\'};const overrideKeys=Object.keys(overrides);if(overrideKeys.length>CONFIG.tokens.length)return {schema:CONFIG.resultSchemaId,ok:false,code:\'OVERRIDE_KEY_LIMIT\'};const known=new Set(CONFIG.tokens.map(function(token){return token.name;}));const unknown=overrideKeys.filter(function(key){return !known.has(key);}).sort();if(unknown.length)return {schema:CONFIG.resultSchemaId,ok:false,code:\'UNKNOWN_TOKEN\',token:unknown[0]};const rows=[];for(const token of CONFIG.tokens){const raw=own(overrides,token.name)?overrides[token.name]:token.defaultValue;const value=cssValue(token,raw);if(value===null)return {schema:CONFIG.resultSchemaId,ok:false,code:\'TOKEN_VALUE_INVALID\',token:token.name};rows.push(\'  --\'+CONFIG.prefix+\'-\'+token.name+\': \'+value+\';\');}if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,code:\'INPUT_BYTES_EXCEEDED\'};const css=\':root {\\n\'+rows.join(\'\\n\')+\'\\n}\\n\';if(Buffer.byteLength(css,\'utf8\')>CONFIG.maxOutputBytes)return {schema:CONFIG.resultSchemaId,ok:false,code:\'CSS_BYTES_EXCEEDED\'};return {schema:CONFIG.resultSchemaId,ok:true,mimeType:\'text/css; charset=utf-8\',css:css,tokenCount:CONFIG.tokens.length};}',
      'module.exports={CONFIG:CONFIG,render:render};',
      ''
    ].join('\n');
  }
  function cssStylesheetSelftest(config){
    const first=config.tokens[0],override=first.kind==='COLOR_HEX'?'#A1B2C3':first.kind==='INTEGER'?-7:first.kind==='PERCENT'?75:first.kind==='TIME_MS'?250:24;
    return "'use strict';\nconst assert=require('assert');const stylesheet=require('./capability.js');const defaults=stylesheet.render({}),again=stylesheet.render({});assert.equal(defaults.ok,true);assert.equal(defaults.css,again.css);assert(defaults.css.startsWith(':root {\\n'));assert(defaults.css.includes('--"+config.prefix+"-"+first.name+":'));assert(!/@import|url\\s*\\(|<\\/?style/i.test(defaults.css));const changed=stylesheet.render({overrides:{"+JSON.stringify(first.name)+":"+JSON.stringify(override)+"}});assert.equal(changed.ok,true);assert.equal(stylesheet.render({overrides:{unknown:'red'}}).code,'UNKNOWN_TOKEN');assert.equal(stylesheet.render({overrides:{"+JSON.stringify(first.name)+":'red;display:none'}}).code,'TOKEN_VALUE_INVALID');assert.equal(stylesheet.render({extra:true}).code,'INPUT_FIELDS_UNSUPPORTED');process.stdout.write('bounded CSS token stylesheet candidate selftest PASS\\n');\n";
  }
  function buildCssTokenStylesheet(parameters){
    htmlExact(parameters,['resultSchemaId','prefix','tokens','maxInputBytes','maxOutputBytes'],'parameters');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId||''))throw new Error('resultSchemaId is invalid');
    const prefix=cssTokenName(parameters.prefix,'prefix',24);
    if(!Array.isArray(parameters.tokens)||parameters.tokens.length<1||parameters.tokens.length>32)throw new Error('tokens must contain 1 to 32 entries');
    const seen=new Set(),tokens=parameters.tokens.map(function(row,index){
      htmlExact(row,['name','kind','defaultValue'],'tokens['+index+']');
      const name=cssTokenName(row.name,'tokens['+index+'].name',32);
      if(seen.has(name))throw new Error('token names must be unique');seen.add(name);
      if(!['COLOR_HEX','INTEGER','LENGTH_PX','PERCENT','TIME_MS'].includes(row.kind))throw new Error('tokens['+index+'].kind is unsupported');
      cssTokenValue(row.kind,row.defaultValue,'tokens['+index+'].defaultValue');
      return {name:name,kind:row.kind,defaultValue:row.defaultValue};
    }).sort(function(left,right){return left.name.localeCompare(right.name);});
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<128||parameters.maxInputBytes>65536)throw new Error('maxInputBytes is outside the bounded range');
    if(!Number.isInteger(parameters.maxOutputBytes)||parameters.maxOutputBytes<128||parameters.maxOutputBytes>65536)throw new Error('maxOutputBytes is outside the bounded range');
    const defaultCss=':root {\n'+tokens.map(function(token){return '  --'+prefix+'-'+token.name+': '+cssTokenValue(token.kind,token.defaultValue,'defaultValue')+';';}).join('\n')+'\n}\n';
    if(Buffer.byteLength(defaultCss,'utf8')>parameters.maxOutputBytes)throw new Error('default stylesheet exceeds maxOutputBytes');
    const config={resultSchemaId:parameters.resultSchemaId,prefix:prefix,tokens:tokens,maxInputBytes:parameters.maxInputBytes,maxOutputBytes:parameters.maxOutputBytes};
    return {capabilityKind:'HAND',source:cssStylesheetSource(config),selftest:cssStylesheetSelftest(config),provides:[parameters.resultSchemaId,'text/css'],consumes:['axm.css-token-overrides/v1'],summary:'Pure bounded CSS custom-property stylesheet renderer with typed design tokens.'};
  }

  function pythonField(value,label){
    const text=String(value||'');
    if(!/^[a-z][a-z0-9_]{0,63}$/.test(text))throw new Error(label+' is invalid');
    return text;
  }
  function pythonText(value,label,maximum){
    const text=String(value==null?'':value);
    if(!text.trim()||text.length>maximum||text.includes('\u0000'))throw new Error(label+' is invalid');
    return text;
  }
  function pythonRecordTransformSource(config){
    return [
      '# Generated deterministic candidate. Static data until a separately authorized host executes it.',
      'import json',
      '',
      'CONFIG = '+JSON.stringify(config),
      '',
      'def _json_bytes(value):',
      '    try:',
      '        encoded = json.dumps(value, sort_keys=True, separators=(\",\", \":\"), ensure_ascii=False, allow_nan=False)',
      '        return len(encoded.encode(\"utf-8\"))',
      '    except (TypeError, ValueError, OverflowError, RecursionError):',
      '        return CONFIG[\"maxInputBytes\"] + 1',
      '',
      'def run(payload):',
      '    if type(payload) is not dict:',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"INPUT_OBJECT_REQUIRED\"}',
      '    if any(type(key) is not str for key in payload):',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"INPUT_KEY_INVALID\"}',
      '    if len(payload) > CONFIG[\"maxInputKeys\"]:',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"INPUT_KEY_LIMIT\"}',
      '    if any(value is not None and type(value) is not str for value in payload.values()):',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"INPUT_VALUE_UNSUPPORTED\"}',
      '    if _json_bytes(payload) > CONFIG[\"maxInputBytes\"]:',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"INPUT_BYTES_EXCEEDED\"}',
      '    value = payload.get(CONFIG[\"sourceField\"], CONFIG[\"defaultValue\"])',
      '    if type(value) is not str:',
      '        return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": False, \"code\": \"SOURCE_VALUE_INVALID\"}',
      '    return {\"schema\": CONFIG[\"resultSchemaId\"], \"ok\": True, \"output\": {CONFIG[\"targetField\"]: value}}',
      ''
    ].join('\n');
  }
  function pythonRecordTransformSelftest(config){
    return [
      '# Emitted verification candidate. Not executed by Capability Fabric.',
      'from capability import CONFIG, run',
      '',
      'assert CONFIG[\"sourceField\"] == '+JSON.stringify(config.sourceField),
      'first = run({'+JSON.stringify(config.sourceField)+': \"proof\"})',
      'second = run({'+JSON.stringify(config.sourceField)+': \"proof\"})',
      'assert first == second',
      'assert first[\"ok\"] is True',
      'assert first[\"output\"]['+JSON.stringify(config.targetField)+'] == \"proof\"',
      'assert run({})[\"output\"]['+JSON.stringify(config.targetField)+'] == '+JSON.stringify(config.defaultValue),
      'assert run([])[\"code\"] == \"INPUT_OBJECT_REQUIRED\"',
      'assert run({'+JSON.stringify(config.sourceField)+': 7})[\"code\"] == \"INPUT_VALUE_UNSUPPORTED\"',
      'print(\"PASS bounded Python record transform candidate\")',
      ''
    ].join('\n');
  }
  function buildPythonRecordTransform(parameters){
    htmlExact(parameters,['resultSchemaId','sourceField','targetField','defaultValue','maxInputKeys','maxInputBytes'],'parameters');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId||''))throw new Error('resultSchemaId is invalid');
    if(!Number.isInteger(parameters.maxInputKeys)||parameters.maxInputKeys<1||parameters.maxInputKeys>128)throw new Error('maxInputKeys is outside the bounded range');
    if(!Number.isInteger(parameters.maxInputBytes)||parameters.maxInputBytes<128||parameters.maxInputBytes>65536)throw new Error('maxInputBytes is outside the bounded range');
    const config={resultSchemaId:parameters.resultSchemaId,sourceField:pythonField(parameters.sourceField,'sourceField'),targetField:pythonField(parameters.targetField,'targetField'),defaultValue:pythonText(parameters.defaultValue,'defaultValue',256),maxInputKeys:parameters.maxInputKeys,maxInputBytes:parameters.maxInputBytes};
    return {capabilityKind:'HAND',source:pythonRecordTransformSource(config),selftest:pythonRecordTransformSelftest(config),provides:[parameters.resultSchemaId],consumes:['application/json'],summary:'Pure bounded Python record-field transform candidate using only the standard-library json module.'};
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

  function objectAdapterV2Source(config) {
    return [
      "'use strict';",
      "function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.getOwnPropertyNames(value).forEach(function(key){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value'))deepFreeze(descriptor.value);});}return value;}",
      'const CONFIG=deepFreeze('+JSON.stringify(config)+');',
      "function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}",
      "function jsonStringBytes(value,ceiling){let total=2;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code===34||code===92||code===8||code===9||code===10||code===12||code===13)total+=2;else if(code<32||code>=55296&&code<=57343){if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){total+=4;index+=1;}else total+=6;}else total+=6;}else if(code<128)total+=1;else if(code<2048)total+=2;else total+=3;if(total>ceiling)return total;}return total;}",
      "function primitiveBytes(value,ceiling){if(typeof value==='string')return jsonStringBytes(value,ceiling);if(typeof value==='boolean')return value?4:5;if(typeof value==='number'&&Number.isFinite(value))return Object.is(value,-0)?1:String(value).length;return null;}",
      "function codePointLength(value,ceiling){let total=0;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343)index+=1;}total+=1;if(total>ceiling)return total;}return total;}",
      "function primitiveEqual(left,right){return left===right;}",
      "function primitiveValid(value,schema){if(schema.type==='string'&&typeof value!=='string')return false;if(schema.type==='boolean'&&typeof value!=='boolean')return false;if(schema.type==='integer'&&!Number.isInteger(value))return false;if(schema.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))return false;if(schema.type==='string'){const ceiling=schema.maxLength===undefined?CONFIG.maxInputBytes:schema.maxLength,length=codePointLength(value,ceiling);if(schema.minLength!==undefined&&length<schema.minLength)return false;if(schema.maxLength!==undefined&&length>schema.maxLength)return false;}if(schema.type==='integer'||schema.type==='number'){if(schema.minimum!==undefined&&value<schema.minimum)return false;if(schema.maximum!==undefined&&value>schema.maximum)return false;}return schema.enum===undefined||schema.enum.some(function(row){return primitiveEqual(row,value);});}",
      "function inspectRecord(value,schema,byteCeiling,side){let prototype,names,symbols;try{if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,code:side+'_PLAIN_RECORD_REQUIRED',errors:[{path:'$',code:'PLAIN_RECORD_REQUIRED'}]};prototype=Object.getPrototypeOf(value);names=Object.getOwnPropertyNames(value);symbols=Object.getOwnPropertySymbols(value);}catch(_){return {ok:false,code:side+'_INSPECTION_FAILED',errors:[{path:'$',code:'RECORD_INSPECTION_FAILED'}]};}if(prototype!==Object.prototype&&prototype!==null)return {ok:false,code:side+'_PLAIN_RECORD_REQUIRED',errors:[{path:'$',code:'PLAIN_RECORD_REQUIRED'}]};if(symbols.length)return {ok:false,code:side+'_SYMBOL_FIELDS_REFUSED',errors:[{path:'$',code:'SYMBOL_FIELDS_REFUSED'}]};if(names.length>CONFIG.maxProperties)return {ok:false,code:side+'_PROPERTY_LIMIT_EXCEEDED',errors:[{path:'$',code:'PROPERTY_LIMIT_EXCEEDED'}]};const descriptors=Object.create(null),errors=[],properties=schema.properties||{};let bytes=2,written=false;names.sort().forEach(function(key){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch(_){errors.push({path:'$.'+key,code:'FIELD_INSPECTION_FAILED'});return;}if(!descriptor||!descriptor.enumerable||!own(descriptor,'value')){errors.push({path:'$.'+key,code:'OWN_ENUMERABLE_DATA_FIELD_REQUIRED'});return;}descriptors[key]=descriptor;const valueBytes=primitiveBytes(descriptor.value,byteCeiling);if(valueBytes!==null){if(written)bytes+=1;written=true;bytes+=jsonStringBytes(key,byteCeiling)+1+valueBytes;}if(!own(properties,key))errors.push({path:'$.'+key,code:'ADDITIONAL_PROPERTY'});else if(valueBytes===null||!primitiveValid(descriptor.value,properties[key]))errors.push({path:'$.'+key,code:'VALUE_INVALID'});});if(bytes>byteCeiling)return {ok:false,code:side+'_BYTES_EXCEEDED',errors:[{path:'$',code:'BYTES_EXCEEDED'}]};(schema.required||[]).forEach(function(key){if(!own(descriptors,key))errors.push({path:'$.'+key,code:'REQUIRED'});});return {ok:errors.length===0,code:errors.length?side+'_CONTRACT_INVALID':side+'_VALID',errors:errors,descriptors:descriptors,bytes:bytes};}",
      "function put(value,key,field){Object.defineProperty(value,key,{value:field,enumerable:true,writable:true,configurable:true});}",
      "function refusal(code,extra){return Object.assign({schema:CONFIG.outputContract,ok:false,code:code,mappingDigest:CONFIG.mappingDigest},extra||{});}",
      "function adapt(input){const source=inspectRecord(input,CONFIG.sourceSchema,CONFIG.maxInputBytes,'SOURCE');if(!source.ok){if(source.code==='SOURCE_BYTES_EXCEEDED')return refusal('INPUT_BYTES_EXCEEDED');if(source.code==='SOURCE_PROPERTY_LIMIT_EXCEEDED')return refusal('SOURCE_PROPERTY_LIMIT_EXCEEDED');return refusal('SOURCE_CONTRACT_INVALID',{errors:source.errors});}const output={};for(const map of CONFIG.mappings){if(own(source.descriptors,map.source))put(output,map.target,source.descriptors[map.source].value);else if(map.onMissing==='DEFAULT')put(output,map.target,map.defaultValue);else if(map.onMissing==='REFUSE')return refusal('SOURCE_FIELD_MISSING',{field:map.source});}const target=inspectRecord(output,CONFIG.targetSchema,CONFIG.maxOutputBytes,'TARGET');if(!target.ok){if(target.code==='TARGET_BYTES_EXCEEDED')return refusal('OUTPUT_BYTES_EXCEEDED');return refusal('TARGET_CONTRACT_INVALID',{errors:target.errors});}return {schema:CONFIG.outputContract,ok:true,output:output,droppedFields:CONFIG.drops.slice(),mappingDigest:CONFIG.mappingDigest,totality:CONFIG.totality,structuralCompatibilityProven:true,semanticCompatibilityProven:false};}",
      'module.exports={CONFIG:CONFIG,adapt:adapt};',
      ''
    ].join('\n');
  }
  function objectAdapterV2Selftest(config) {
    const input={};Object.keys(config.sourceSchema.properties).sort().forEach(function(name){input[name]=adapterExample(config.sourceSchema.properties[name]);});
    const expected={};config.mappings.forEach(function(row){expected[row.target]=input[row.source];});
    const defaultMap=config.mappings.find(function(row){return row.onMissing==='DEFAULT';});
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const input="+JSON.stringify(input)+",expected="+JSON.stringify(expected)+";assert(Object.isFrozen(capability.CONFIG));assert(Object.isFrozen(capability.CONFIG.mappings));assert(Object.isFrozen(capability.CONFIG.sourceSchema.properties));assert.throws(()=>{capability.CONFIG.mappings[0].target='drift';},TypeError);const first=capability.adapt(input),second=capability.adapt(input);assert.equal(first.ok,true);assert.deepStrictEqual(first,second);assert.notStrictEqual(first.output,second.output);assert.deepStrictEqual(first.output,expected);assert.deepStrictEqual(first.droppedFields,"+JSON.stringify(config.drops)+");assert.equal(first.structuralCompatibilityProven,true);assert.equal(first.semanticCompatibilityProven,false);"+(defaultMap?"const withoutDefault=Object.assign({},input);delete withoutDefault["+JSON.stringify(defaultMap.source)+"];assert.deepStrictEqual(capability.adapt(withoutDefault).output["+JSON.stringify(defaultMap.target)+"],"+JSON.stringify(defaultMap.defaultValue)+");":"")+"const nullRecord=Object.assign(Object.create(null),input);assert.equal(capability.adapt(nullRecord).ok,true);assert.equal(capability.adapt(Object.assign({},input,{undeclared:true})).code,'SOURCE_CONTRACT_INVALID');assert.equal(capability.adapt(new Date()).code,'SOURCE_CONTRACT_INVALID');const accessor=Object.assign({},input);let getterRead=false;Object.defineProperty(accessor,"+JSON.stringify(config.mappings[0].source)+",{enumerable:true,get(){getterRead=true;throw new Error('must not execute');}});assert.equal(capability.adapt(accessor).code,'SOURCE_CONTRACT_INVALID');assert.equal(getterRead,false);const hidden=Object.assign({},input);Object.defineProperty(hidden,'hidden',{value:'x',enumerable:false});assert.equal(capability.adapt(hidden).code,'SOURCE_CONTRACT_INVALID');const symbolRecord=Object.assign({},input);symbolRecord[Symbol('hidden')]='x';assert.equal(capability.adapt(symbolRecord).code,'SOURCE_CONTRACT_INVALID');const hostile=Object.assign({},input);hostile.toJSON=()=>{throw new Error('must not execute');};assert.equal(capability.adapt(hostile).code,'SOURCE_CONTRACT_INVALID');let inheritedHookRead=false;const inheritedPrototype=Object.create(null);Object.defineProperty(inheritedPrototype,'toJSON',{get(){inheritedHookRead=true;throw new Error('must not execute');}});const inherited=Object.assign(Object.create(inheritedPrototype),input);assert.equal(capability.adapt(inherited).code,'SOURCE_CONTRACT_INVALID');assert.equal(inheritedHookRead,false);const tooMany=Object.assign({},input);for(let index=0;index<"+(config.maxProperties+1)+";index+=1)tooMany['extra'+index]='x';assert.equal(capability.adapt(tooMany).code,'SOURCE_PROPERTY_LIMIT_EXCEEDED');const tooLarge=Object.assign({},input,{legacyNote:'😀'.repeat("+(Math.ceil(config.maxInputBytes/4)+1)+")});assert.equal(capability.adapt(tooLarge).code,'INPUT_BYTES_EXCEEDED');const outputHeavy=Object.assign({},input,{displayName:'\\u0001'.repeat(80)});assert.equal(capability.adapt(outputHeavy).code,'OUTPUT_BYTES_EXCEEDED');const originalStringify=JSON.stringify,originalBuffer=global.Buffer;JSON.stringify=function(){throw new Error('host stringify must not run');};global.Buffer=undefined;try{assert.equal(capability.adapt(input).ok,true);}finally{JSON.stringify=originalStringify;global.Buffer=originalBuffer;}assert.deepStrictEqual(input,"+JSON.stringify(input)+");console.log('PASS strict closed object contract adapter v2 capability');\n";
  }
  function buildObjectAdapterV2(parameters) {
    const config=inspectAdapterParameters(parameters);
    return {capabilityKind:'HAND',source:objectAdapterV2Source(config),selftest:objectAdapterV2Selftest(config),provides:[config.outputContract],consumes:[config.inputContract],summary:'Strict closed primitive object-contract adapter with explicit loss, byte and property ceilings, and structural-only compatibility proof.'};
  }

  function recordQueryField(value,label) {
    if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)||['constructor','prototype'].includes(value))throw new Error(label+' is invalid');
    return value;
  }
  function inspectRecordQueryParameters(parameters) {
    htmlExact(parameters,['inputSchemaId','resultSchemaId','fields','maxRecords','maxPredicates','maxSortKeys','maxProjectionFields','maxResultRecords','maxInputBytes','maxOutputBytes'],'parameters');
    const inputSchemaId=jsonTransformSchema(parameters.inputSchemaId),resultSchemaId=jsonTransformSchema(parameters.resultSchemaId);
    if(inputSchemaId===resultSchemaId)throw new Error('record query input and result schemas must be distinct');
    if(!Array.isArray(parameters.fields)||parameters.fields.length<1||parameters.fields.length>32)throw new Error('fields must contain 1 to 32 declarations');
    const fields=parameters.fields.map(function(row,index){
      htmlExact(row,['name','kind','maxLength'],'fields['+index+']');
      const name=recordQueryField(row.name,'fields['+index+'].name'),kind=String(row.kind||'');
      if(!['BOOLEAN','INTEGER','STRING'].includes(kind))throw new Error('fields['+index+'].kind is unsupported');
      if(kind==='STRING'){
        if(!Number.isInteger(row.maxLength)||row.maxLength<1||row.maxLength>4096)throw new Error('fields['+index+'].maxLength is outside the bounded range');
      }else if(row.maxLength!==null)throw new Error('non-string field maxLength must be null');
      return {name:name,kind:kind,maxLength:row.maxLength};
    }).sort(function(left,right){return left.name<right.name?-1:left.name>right.name?1:0;});
    if(new Set(fields.map(function(row){return row.name;})).size!==fields.length)throw new Error('field names must be unique');
    const ceilings={maxRecords:[1,1024],maxPredicates:[0,16],maxSortKeys:[0,8],maxProjectionFields:[1,32],maxResultRecords:[1,1024],maxInputBytes:[256,1048576],maxOutputBytes:[128,1048576]};
    Object.keys(ceilings).forEach(function(key){const range=ceilings[key];if(!Number.isInteger(parameters[key])||parameters[key]<range[0]||parameters[key]>range[1])throw new Error(key+' is outside the bounded range');});
    if(parameters.maxProjectionFields>fields.length)throw new Error('maxProjectionFields exceeds declared fields');
    if(parameters.maxResultRecords>parameters.maxRecords)throw new Error('maxResultRecords exceeds maxRecords');
    return {inputSchemaId:inputSchemaId,resultSchemaId:resultSchemaId,fields:fields,maxRecords:parameters.maxRecords,maxPredicates:parameters.maxPredicates,maxSortKeys:parameters.maxSortKeys,maxProjectionFields:parameters.maxProjectionFields,maxResultRecords:parameters.maxResultRecords,maxInputBytes:parameters.maxInputBytes,maxOutputBytes:parameters.maxOutputBytes,stringOrder:'UTF16_CODE_UNIT',predicateJoin:'AND',tiePolicy:'ORIGINAL_INPUT_INDEX'};
  }
  function recordQuerySource(config) {
    return [
      "'use strict';",
      "function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.getOwnPropertyNames(value).forEach(function(key){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value'))deepFreeze(descriptor.value);});}return value;}",
      'const CONFIG=deepFreeze('+JSON.stringify(config)+');',
      "function own(value,key){return Object.prototype.hasOwnProperty.call(Object(value),key);}",
      "function failure(code,path){const result={schema:CONFIG.resultSchemaId,ok:false,code:code};if(path)result.path=path;return result;}",
      "function plainRecord(value,expected,label){let prototype,names,symbols;try{if(!value||typeof value!=='object'||Array.isArray(value))return {error:label+'_OBJECT_REQUIRED'};prototype=Object.getPrototypeOf(value);names=Object.getOwnPropertyNames(value);symbols=Object.getOwnPropertySymbols(value);}catch(_){return {error:label+'_INSPECTION_FAILED'};}if(prototype!==Object.prototype&&prototype!==null||symbols.length)return {error:label+'_PLAIN_DATA_REQUIRED'};const wanted=expected.slice().sort();if(names.length!==wanted.length||names.slice().sort().some(function(name,index){return name!==wanted[index];}))return {error:label+'_FIELDS_MISMATCH'};const values=Object.create(null);for(const name of wanted){let descriptor;try{descriptor=Object.getOwnPropertyDescriptor(value,name);}catch(_){return {error:label+'_INSPECTION_FAILED'};}if(!descriptor||!descriptor.enumerable||!own(descriptor,'value'))return {error:label+'_FIELD_UNSUPPORTED'};values[name]=descriptor.value;}return {values:values};}",
      "function denseArray(value,maximum,label){let names,symbols,prototype;try{if(!Array.isArray(value))return {error:label+'_ARRAY_REQUIRED'};prototype=Object.getPrototypeOf(value);names=Object.getOwnPropertyNames(value);symbols=Object.getOwnPropertySymbols(value);}catch(_){return {error:label+'_INSPECTION_FAILED'};}if(prototype!==Array.prototype||symbols.length||value.length>maximum)return {error:value.length>maximum?label+'_LIMIT_EXCEEDED':label+'_PLAIN_ARRAY_REQUIRED'};const expected=['length'];for(let index=0;index<value.length;index+=1)expected.push(String(index));if(names.length!==expected.length||names.slice().sort().some(function(name,index){return name!==expected.slice().sort()[index];}))return {error:label+'_DENSE_ARRAY_REQUIRED'};const rows=[];for(let index=0;index<value.length;index+=1){const descriptor=Object.getOwnPropertyDescriptor(value,String(index));if(!descriptor||!descriptor.enumerable||!own(descriptor,'value'))return {error:label+'_ITEM_UNSUPPORTED'};rows.push(descriptor.value);}return {rows:rows};}",
      "function fieldMap(){const map=Object.create(null);CONFIG.fields.forEach(function(field){map[field.name]=field;});return map;}",
      "const FIELDS=fieldMap();",
      "function valueValid(value,field){if(field.kind==='BOOLEAN')return typeof value==='boolean';if(field.kind==='INTEGER')return Number.isSafeInteger(value);return typeof value==='string'&&value.length<=field.maxLength;}",
      "function inspectRuntime(input){const outer=plainRecord(input,['records','predicates','orderBy','select','limit'],'INPUT');if(outer.error)return {error:outer.error};const records=denseArray(outer.values.records,CONFIG.maxRecords,'RECORDS');if(records.error)return {error:records.error};const predicates=denseArray(outer.values.predicates,CONFIG.maxPredicates,'PREDICATES');if(predicates.error)return {error:predicates.error};const orderBy=denseArray(outer.values.orderBy,CONFIG.maxSortKeys,'ORDER');if(orderBy.error)return {error:orderBy.error};const select=denseArray(outer.values.select,CONFIG.maxProjectionFields,'SELECT');if(select.error)return {error:select.error};if(!select.rows.length)return {error:'SELECT_EMPTY'};if(!Number.isSafeInteger(outer.values.limit)||outer.values.limit<0||outer.values.limit>CONFIG.maxResultRecords)return {error:'LIMIT_INVALID'};const safeRecords=[];for(let index=0;index<records.rows.length;index+=1){const inspected=plainRecord(records.rows[index],CONFIG.fields.map(function(field){return field.name;}),'RECORD');if(inspected.error)return {error:inspected.error,path:'records['+index+']'};const safe={};for(const field of CONFIG.fields){const value=inspected.values[field.name];if(!valueValid(value,field))return {error:'RECORD_VALUE_INVALID',path:'records['+index+'].'+field.name};safe[field.name]=value;}safeRecords.push(safe);}const safePredicates=[];for(let index=0;index<predicates.rows.length;index+=1){const inspected=plainRecord(predicates.rows[index],['field','op','value'],'PREDICATE');if(inspected.error)return {error:inspected.error,path:'predicates['+index+']'};const field=FIELDS[inspected.values.field],op=inspected.values.op;if(!field)return {error:'QUERY_FIELD_UNKNOWN',path:'predicates['+index+'].field'};if(!['EQ','NE','LT','LTE','GT','GTE'].includes(op))return {error:'PREDICATE_OPERATOR_UNSUPPORTED',path:'predicates['+index+'].op'};if(field.kind==='BOOLEAN'&&!['EQ','NE'].includes(op))return {error:'PREDICATE_OPERATOR_UNSUPPORTED',path:'predicates['+index+'].op'};if(!valueValid(inspected.values.value,field))return {error:'PREDICATE_VALUE_INVALID',path:'predicates['+index+'].value'};safePredicates.push({field:field.name,op:op,value:inspected.values.value});}const safeOrder=[],seenOrder=new Set();for(let index=0;index<orderBy.rows.length;index+=1){const inspected=plainRecord(orderBy.rows[index],['field','direction'],'ORDER_ITEM');if(inspected.error)return {error:inspected.error,path:'orderBy['+index+']'};if(!FIELDS[inspected.values.field])return {error:'QUERY_FIELD_UNKNOWN',path:'orderBy['+index+'].field'};if(seenOrder.has(inspected.values.field))return {error:'ORDER_FIELD_DUPLICATE',path:'orderBy['+index+'].field'};if(!['ASC','DESC'].includes(inspected.values.direction))return {error:'ORDER_DIRECTION_UNSUPPORTED',path:'orderBy['+index+'].direction'};seenOrder.add(inspected.values.field);safeOrder.push({field:inspected.values.field,direction:inspected.values.direction});}const safeSelect=[],seenSelect=new Set();for(let index=0;index<select.rows.length;index+=1){const field=select.rows[index];if(typeof field!=='string'||!FIELDS[field])return {error:'QUERY_FIELD_UNKNOWN',path:'select['+index+']'};if(seenSelect.has(field))return {error:'SELECT_FIELD_DUPLICATE',path:'select['+index+']'};seenSelect.add(field);safeSelect.push(field);}return {value:{records:safeRecords,predicates:safePredicates,orderBy:safeOrder,select:safeSelect,limit:outer.values.limit}};}",
      "function utf8Bytes(value){let total=0;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);if(code<128)total+=1;else if(code<2048)total+=2;else if(code>=55296&&code<=56319&&index+1<value.length){const next=value.charCodeAt(index+1);if(next>=56320&&next<=57343){total+=4;index+=1;}else total+=3;}else total+=3;}return total;}",
      "function compare(left,right){if(left===right)return 0;if(typeof left==='boolean')return left?1:-1;return left<right?-1:1;}",
      "function matches(record,predicate){const order=compare(record[predicate.field],predicate.value);if(predicate.op==='EQ')return order===0;if(predicate.op==='NE')return order!==0;if(predicate.op==='LT')return order<0;if(predicate.op==='LTE')return order<=0;if(predicate.op==='GT')return order>0;return order>=0;}",
      "function query(input){const inspected=inspectRuntime(input);if(inspected.error)return failure(inspected.error,inspected.path);const safe=inspected.value;if(utf8Bytes(JSON.stringify(safe))>CONFIG.maxInputBytes)return failure('INPUT_BYTES_EXCEEDED');const matched=safe.records.map(function(record,index){return {record:record,index:index};}).filter(function(row){return safe.predicates.every(function(predicate){return matches(row.record,predicate);});});matched.sort(function(left,right){for(const order of safe.orderBy){const value=compare(left.record[order.field],right.record[order.field]);if(value)return order.direction==='DESC'?-value:value;}return left.index-right.index;});const selected=matched.slice(0,safe.limit).map(function(row){const output={};safe.select.forEach(function(field){Object.defineProperty(output,field,{value:row.record[field],enumerable:true,writable:true,configurable:true});});return output;});const result={schema:CONFIG.resultSchemaId,ok:true,records:selected,summary:{scannedCount:safe.records.length,matchedCount:matched.length,returnedCount:selected.length,truncated:matched.length>selected.length},ordering:{keys:safe.orderBy.slice(),tiePolicy:CONFIG.tiePolicy,stringOrder:CONFIG.stringOrder}};if(utf8Bytes(JSON.stringify(result))>CONFIG.maxOutputBytes)return failure('OUTPUT_BYTES_EXCEEDED');return result;}",
      'module.exports={CONFIG:CONFIG,query:query};',
      ''
    ].join('\n');
  }
  function recordQuerySelftest(config) {
    const records=[{active:true,id:'q1',kind:'quest',label:'First',score:7},{active:true,id:'q2',kind:'quest',label:'Second',score:9},{active:false,id:'q3',kind:'quest',label:'Third',score:12},{active:true,id:'q4',kind:'puzzle',label:'Fourth',score:9}];
    const request={records:records,predicates:[{field:'kind',op:'EQ',value:'quest'},{field:'active',op:'EQ',value:true}],orderBy:[{field:'score',direction:'DESC'}],select:['id','label'],limit:2};
    return "'use strict';\nconst assert=require('assert');const capability=require('./capability.js');const request="+JSON.stringify(request)+";assert(Object.isFrozen(capability.CONFIG));assert(Object.isFrozen(capability.CONFIG.fields));const first=capability.query(request),second=capability.query(request);assert.deepStrictEqual(first,second);assert.equal(first.ok,true);assert.deepStrictEqual(first.records,[{id:'q2',label:'Second'},{id:'q1',label:'First'}]);assert.deepStrictEqual(first.summary,{scannedCount:4,matchedCount:2,returnedCount:2,truncated:false});assert.equal(first.ordering.tiePolicy,'ORIGINAL_INPUT_INDEX');const tie=JSON.parse(JSON.stringify(request));tie.records[0].score=9;assert.deepStrictEqual(capability.query(tie).records.map(row=>row.id),['q1','q2']);const empty=JSON.parse(JSON.stringify(request));empty.predicates=[{field:'score',op:'GT',value:99}];assert.deepStrictEqual(capability.query(empty).records,[]);const badBoolean=JSON.parse(JSON.stringify(request));badBoolean.predicates=[{field:'active',op:'LT',value:true}];assert.equal(capability.query(badBoolean).code,'PREDICATE_OPERATOR_UNSUPPORTED');const unknown=JSON.parse(JSON.stringify(request));unknown.select=['missing'];assert.equal(capability.query(unknown).code,'QUERY_FIELD_UNKNOWN');const duplicateOrder=JSON.parse(JSON.stringify(request));duplicateOrder.orderBy=[{field:'score',direction:'ASC'},{field:'score',direction:'DESC'}];assert.equal(capability.query(duplicateOrder).code,'ORDER_FIELD_DUPLICATE');const accessor=JSON.parse(JSON.stringify(request));let getterRead=false;Object.defineProperty(accessor.records[0],'label',{enumerable:true,get(){getterRead=true;throw new Error('must not execute');}});assert.equal(capability.query(accessor).code,'RECORD_FIELD_UNSUPPORTED');assert.equal(getterRead,false);const extra=JSON.parse(JSON.stringify(request));extra.records[0].extra='x';assert.equal(capability.query(extra).code,'RECORD_FIELDS_MISMATCH');const symbol=JSON.parse(JSON.stringify(request));symbol.records[0][Symbol('hidden')]='x';assert.equal(capability.query(symbol).code,'RECORD_PLAIN_DATA_REQUIRED');const wrong=JSON.parse(JSON.stringify(request));wrong.records[0].score=1.5;assert.equal(capability.query(wrong).code,'RECORD_VALUE_INVALID');const tooMany=JSON.parse(JSON.stringify(request));tooMany.records=Array.from({length:"+(config.maxRecords+1)+"},()=>request.records[0]);assert.equal(capability.query(tooMany).code,'RECORDS_LIMIT_EXCEEDED');const heavy=JSON.parse(JSON.stringify(request));heavy.records=Array.from({length:"+config.maxRecords+"},(_,index)=>({active:true,id:'x'+index,kind:'quest',label:'é'.repeat("+config.fields.find(function(field){return field.name==='label';}).maxLength+"),score:index}));assert.equal(capability.query(heavy).code,'INPUT_BYTES_EXCEEDED');assert.deepStrictEqual(request,"+JSON.stringify(request)+");console.log('PASS bounded deterministic record collection query capability');\n";
  }
  function buildRecordQuery(parameters) {
    const config=inspectRecordQueryParameters(parameters);
    return {capabilityKind:'HAND',source:recordQuerySource(config),selftest:recordQuerySelftest(config),provides:[config.resultSchemaId],consumes:[config.inputSchemaId],summary:'Strict deterministic closed-record collection filtering, stable ordering, projection, limit, and bounded count summary.'};
  }

  function makeEntry(id, kind, status, proposalDigest, build, parts) {
    const material={id:id,capabilityKind:kind,status:status,proposalDigest:proposalDigest,implementation:parts.map(function(part){return String(part).replace(/\r\n/g,'\n');})};
    return {id:id,capabilityKind:kind,status:status,proposalDigest:proposalDigest,implementationDigest:digest(material),build:build};
  }
  const entries=[
    makeEntry('pure-json-transform-v1','HAND',ACTIVE,null,buildJsonTransform,[jsonTransformField,jsonTransformText,jsonTransformSchema,jsonTransformSource,jsonTransformSelftest,buildJsonTransform]),
    makeEntry('svg-status-badge-v1','HAND',ACTIVE,null,buildSvgBadge,[svgXmlText,svgText,svgColor,svgEscape,svgBadgeMarkup,svgBadgeSource,svgBadgeSelftest,buildSvgBadge]),
    makeEntry('workshop-direction-adapter-v1','HAND',ACTIVE,null,buildDirectionAdapter,[directionAdapterSource,directionAdapterSelftest,buildDirectionAdapter]),
    makeEntry('closed-json-schema-validator-v1','HAND',REVIEW_CANDIDATE,'sha256:02a61d48f5213edc9140f1720c12f84a8de1ebc0bbc7f1b338d9a9e8bf0df14f',buildSchemaValidator,[stable,byteLength,exactKeys,inspectSchema,validatorSource,validatorSelftest,exampleFor,buildSchemaValidator]),
    makeEntry('bounded-review-procedure-skill-v1','SKILL',REVIEW_CANDIDATE,'sha256:acd5678b5327fda7c2a2f1280fb4fa26f41cfd188e4788c1df3c2e539ee532ba',buildReviewSkill,[exact,list,safeId,contractId,renderSkillMarkdown,renderSkillSelftest,buildReviewSkill]),
    makeEntry('closed-object-contract-adapter-v1','HAND',REVIEW_CANDIDATE,'sha256:65a4fbfab2452f0e2c6a8fbff0f873f2b58f6b6cb7f0f533cbe1a260f9f151d1',buildObjectAdapter,[adapterFieldName,primitiveValueValid,inspectAdapterPrimitive,inspectAdapterObjectSchema,primitiveSchemaCompatible,adapterExample,inspectAdapterParameters,objectAdapterSource,objectAdapterSelftest,buildObjectAdapter]),
    makeEntry('closed-object-contract-adapter-v2','HAND',ACTIVE,null,buildObjectAdapterV2,[adapterFieldName,primitiveValueValid,inspectAdapterPrimitive,inspectAdapterObjectSchema,primitiveSchemaCompatible,adapterExample,inspectAdapterParameters,objectAdapterV2Source,objectAdapterV2Selftest,buildObjectAdapterV2]),
    makeEntry('static-accessible-html-page-v1','HAND',REVIEW_CANDIDATE,'sha256:983ff82440f97044d5d1af9737e7656df547898b9a0753579fb01440ca4ecfc6',buildHtmlPage,[htmlExact,htmlText,htmlPageSource,htmlPageSelftest,buildHtmlPage]),
    makeEntry('bounded-css-token-stylesheet-v1','HAND',ACTIVE,null,buildCssTokenStylesheet,[htmlExact,cssTokenName,cssTokenValue,cssStylesheetSource,cssStylesheetSelftest,buildCssTokenStylesheet]),
    makeEntry('bounded-python-record-transform-v1','HAND',ACTIVE,null,buildPythonRecordTransform,[htmlExact,pythonField,pythonText,pythonRecordTransformSource,pythonRecordTransformSelftest,buildPythonRecordTransform]),
    makeEntry('bounded-record-query-v1','HAND',ACTIVE,null,buildRecordQuery,[htmlExact,jsonTransformSchema,recordQueryField,inspectRecordQueryParameters,recordQuerySource,recordQuerySelftest,buildRecordQuery])
  ];
  // Lifecycle activation is applied after implementation sealing so the exact
  // source-reviewed builder digest remains the one bound by the admission plan.
  entries.find(function(entry){return entry.id==='closed-json-schema-validator-v1';}).status=ACTIVE;
  entries.find(function(entry){return entry.id==='bounded-review-procedure-skill-v1';}).status=ACTIVE;
  entries.find(function(entry){return entry.id==='static-accessible-html-page-v1';}).status=ACTIVE;
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
