'use strict';
const crypto=require('crypto');
const BUILDER_ID='closed-object-contract-adapter-v1';
function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
  }
const canonicalJson=stable;
function digest(value){return 'sha256:'+crypto.createHash('sha256').update(stable(value)).digest('hex');}
function byteLength(value) {
    const text=typeof value==='string'?value:stable(value);
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text,'utf8');
  }
function exactKeys(value, allowed, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
    Object.keys(value).forEach(function (key) { if (!allowed.includes(key)) throw new Error(label + ' contains unsupported key ' + key); });
  }
function exact(value, keys, label) {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be an object');
    Object.keys(value).forEach(function(key){if(!keys.includes(key))throw new Error(label+' contains unsupported key '+key);});
    keys.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(value,key))throw new Error(label+' is missing '+key);});
  }
function contractId(value,label){const text=String(value||'');if(!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(text))throw new Error(label+' is invalid');return text;}
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
module.exports={id:BUILDER_ID,build:buildObjectAdapter};
