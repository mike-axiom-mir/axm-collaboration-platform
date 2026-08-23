'use strict';
const BUILDER_ID = 'bounded-review-procedure-skill-v1';
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  Object.keys(value).forEach((key) => { if (!keys.includes(key)) throw new Error(label + ' contains unsupported key ' + key); });
  keys.forEach((key) => { if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(label + ' is missing ' + key); });
}
function list(value, label, max) {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new Error(label + ' must contain 1 to ' + max + ' entries');
  const seen = new Set();
  return value.map((row) => { const text = String(row || '').trim(); if (!text || text.length > 240 || seen.has(text)) throw new Error(label + ' entries must be unique bounded text'); seen.add(text); return text; });
}
function id(value, label) { const text=String(value || ''); if (!/^[a-z][a-z0-9-]{2,79}$/.test(text)) throw new Error(label + ' is invalid'); return text; }
function contractId(value, label) { const text=String(value || ''); if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(text)) throw new Error(label + ' is invalid'); return text; }
function renderMarkdown(config) {
  return ['---','name: '+config.skillId,'status: EXPERIMENTAL','capability: '+config.receiptSchema,'---','','# '+config.title,'',config.purpose,'','## Inputs',''].concat(config.inputs.map((row)=>'- '+row),['','## Procedure',''],config.procedure.map((row,index)=>(index+1)+'. '+row),['','## Outputs',''],config.outputs.map((row)=>'- '+row),['','## Boundaries',''],config.boundaries.map((row)=>'- '+row),['','## Authority','','- Host mediated: true','- Authority inherited: false','- Installed: false','- Promoted: false','- CANON: false','']).join('\n');
}
function renderSelftest(config) {
  return "'use strict';\nconst assert=require('assert'),fs=require('fs');const md=fs.readFileSync('SKILL.md','utf8'),contract=JSON.parse(fs.readFileSync('skill.contract.json','utf8'));assert(md.includes('# "+config.title.replace(/'/g,"\'")+"'));assert.equal(contract.schema,'axm.portable-skill-contract/v1');assert.equal(contract.kind,'SKILL');assert.equal(contract.authorityInherited,false);assert.equal(contract.installed,false);assert.equal(contract.promoted,false);assert.equal(contract.canon,false);process.stdout.write('portable skill selftest PASS\\n');\n";
}
function build(parameters) {
  exact(parameters, ['skillId','title','purpose','inputs','outputs','procedure','boundaries','receiptSchema','maxSteps'], 'parameters');
  const config={skillId:id(parameters.skillId,'skillId'),title:String(parameters.title||'').trim(),purpose:String(parameters.purpose||'').trim(),inputs:list(parameters.inputs,'inputs',16),outputs:list(parameters.outputs,'outputs',16),procedure:list(parameters.procedure,'procedure',32),boundaries:list(parameters.boundaries,'boundaries',16),receiptSchema:contractId(parameters.receiptSchema,'receiptSchema'),maxSteps:parameters.maxSteps};
  if (!config.title || config.title.length > 120 || !config.purpose || config.purpose.length > 500) throw new Error('title or purpose is invalid');
  if (!Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 32 || config.procedure.length > config.maxSteps) throw new Error('maxSteps is outside the bounded range');
  const descriptor={schema:'axm.portable-skill-contract/v1',id:config.skillId,kind:'SKILL',status:'EXPERIMENTAL',runtimeMode:'HOST_MEDIATED',portableForm:'SKILL.md',operation:'followProcedure',inputs:config.inputs,outputs:config.outputs,receiptSchema:config.receiptSchema,requiredHostCapabilities:['human-or-agent-procedure-runner/v1'],authorityInherited:false,installed:false,promoted:false,canon:false};
  const portableFiles={'SKILL.md':renderMarkdown(config),'skill.contract.json':JSON.stringify(descriptor,null,2)+'\n','skill.selftest.js':renderSelftest(config)};
  return {capabilityKind:'SKILL',portableFiles:portableFiles,provides:[config.receiptSchema],consumes:['axm.capability-review-input/v1'],summary:'Portable bounded review procedure skill.'};
}
module.exports={id:BUILDER_ID,build};
