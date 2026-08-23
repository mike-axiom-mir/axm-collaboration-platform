'use strict';
const BUILDER_ID = 'closed-json-schema-validator-v1';
const MAX_SCHEMA_BYTES = 16384;
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}
function byteLength(value) { return Buffer.byteLength(typeof value === 'string' ? value : stable(value), 'utf8'); }
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  Object.keys(value).forEach((key) => { if (!allowed.includes(key)) throw new Error(label + ' contains unsupported key ' + key); });
}
function inspectSchema(schema, path) {
  exactKeys(schema, ['type','properties','required','additionalProperties','items','enum','pattern','minLength','maxLength','minimum','maximum','minItems','maxItems','description'], path);
  const types = ['object','array','string','number','integer','boolean'];
  if (!types.includes(schema.type)) throw new Error(path + '.type is unsupported');
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length)) throw new Error(path + '.enum must be non-empty');
  if (schema.pattern !== undefined) { if (schema.type !== 'string' || typeof schema.pattern !== 'string') throw new Error(path + '.pattern is invalid'); new RegExp(schema.pattern); }
  if (schema.type === 'object') {
    exactKeys(schema.properties || {}, Object.keys(schema.properties || {}), path + '.properties');
    if (schema.additionalProperties !== false) throw new Error(path + '.additionalProperties must be false');
    const required = schema.required || [];
    if (!Array.isArray(required) || new Set(required).size !== required.length) throw new Error(path + '.required must be a unique array');
    required.forEach((key) => { if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) throw new Error(path + '.required names an unknown property'); });
    Object.keys(schema.properties || {}).sort().forEach((key) => inspectSchema(schema.properties[key], path + '.properties.' + key));
  }
  if (schema.type === 'array') {
    if (!schema.items) throw new Error(path + '.items is required');
    inspectSchema(schema.items, path + '.items');
  }
}
function validatorSource(config) {
  return '\'use strict\';\nconst CONFIG=Object.freeze(' + JSON.stringify(config) + ');\n' +
    "function bytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8');}catch(e){return Infinity;}}\n" +
    "function typeOk(v,t){if(t==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v);if(t==='array')return Array.isArray(v);if(t==='integer')return Number.isInteger(v);if(t==='number')return typeof v==='number'&&Number.isFinite(v);return typeof v===t;}\n" +
    "function walk(v,s,p,e){if(!typeOk(v,s.type)){e.push({path:p,code:'TYPE_MISMATCH',expected:s.type});return;}if(s.enum&&!s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v)))e.push({path:p,code:'ENUM_MISMATCH'});if(s.type==='string'){if(s.minLength!==undefined&&v.length<s.minLength)e.push({path:p,code:'MIN_LENGTH'});if(s.maxLength!==undefined&&v.length>s.maxLength)e.push({path:p,code:'MAX_LENGTH'});if(s.pattern!==undefined&&!new RegExp(s.pattern).test(v))e.push({path:p,code:'PATTERN_MISMATCH'});}if(s.type==='number'||s.type==='integer'){if(s.minimum!==undefined&&v<s.minimum)e.push({path:p,code:'MINIMUM'});if(s.maximum!==undefined&&v>s.maximum)e.push({path:p,code:'MAXIMUM'});}if(s.type==='array'){if(s.minItems!==undefined&&v.length<s.minItems)e.push({path:p,code:'MIN_ITEMS'});if(s.maxItems!==undefined&&v.length>s.maxItems)e.push({path:p,code:'MAX_ITEMS'});v.forEach((x,i)=>walk(x,s.items,p+'['+i+']',e));}if(s.type==='object'){const props=s.properties||{},req=s.required||[];req.forEach(k=>{if(!Object.prototype.hasOwnProperty.call(v,k))e.push({path:p+'.'+k,code:'REQUIRED'});});Object.keys(v).sort().forEach(k=>{if(!Object.prototype.hasOwnProperty.call(props,k)){if(s.additionalProperties===false)e.push({path:p+'.'+k,code:'ADDITIONAL_PROPERTY'});}else walk(v[k],props[k],p+'.'+k,e);});}}\n" +
    "function validate(input){if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_BYTES_EXCEEDED'}]};const errors=[];walk(input,CONFIG.schema,'$',errors);return {schema:CONFIG.resultSchemaId,ok:errors.length===0,errors:errors};}\nmodule.exports={CONFIG,validate};\n";
}
function validatorSelftest(config) {
  return '\'use strict\';\nconst assert=require(\'assert\');const subject=require(\'./capability.js\');const good=' + JSON.stringify(config.exampleValid) + ';const pass=subject.validate(good);assert(pass.ok&&pass.schema===' + JSON.stringify(config.resultSchemaId) + ');const bad=JSON.parse(JSON.stringify(good));delete bad[' + JSON.stringify(config.firstRequired) + '];assert(!subject.validate(bad).ok);const extra=Object.assign({},good,{undeclared:true});assert(!subject.validate(extra).ok);process.stdout.write(\'closed JSON schema validator candidate selftest PASS\\n\');\n';
}
function exampleFor(schema) {
  if (schema.type === 'string') return schema.enum ? schema.enum[0] : 'value';
  if (schema.type === 'integer' || schema.type === 'number') return schema.enum ? schema.enum[0] : (schema.minimum === undefined ? 0 : schema.minimum);
  if (schema.type === 'boolean') return schema.enum ? schema.enum[0] : true;
  if (schema.type === 'array') return [exampleFor(schema.items)];
  const value = {}; Object.keys(schema.properties || {}).sort().forEach((key) => { if ((schema.required || []).includes(key)) value[key] = exampleFor(schema.properties[key]); }); return value;
}
function build(parameters) {
  exactKeys(parameters, ['inputSchemaId','resultSchemaId','schema','maxInputBytes'], 'parameters');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.inputSchemaId || '')) throw new Error('inputSchemaId is invalid');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId || '')) throw new Error('resultSchemaId is invalid');
  if (!Number.isInteger(parameters.maxInputBytes) || parameters.maxInputBytes < 64 || parameters.maxInputBytes > 65536) throw new Error('maxInputBytes is outside the bounded range');
  if (byteLength(parameters.schema) > MAX_SCHEMA_BYTES) throw new Error('schema exceeds 16 KiB');
  inspectSchema(parameters.schema, '$.schema');
  const firstRequired = (parameters.schema.required || [])[0];
  if (!firstRequired) throw new Error('pilot schema needs one required property for its generated refusal proof');
  const config = { inputSchemaId: parameters.inputSchemaId, resultSchemaId: parameters.resultSchemaId, schema: parameters.schema, maxInputBytes: parameters.maxInputBytes, firstRequired, exampleValid: exampleFor(parameters.schema) };
  return { capabilityKind: 'HAND', source: validatorSource(config), selftest: validatorSelftest(config), provides: [parameters.resultSchemaId], consumes: [parameters.inputSchemaId], summary: 'Closed deterministic JSON Schema subset validator.' };
}
module.exports = { id: BUILDER_ID, build, inspectSchema };
