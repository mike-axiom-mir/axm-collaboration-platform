#!/usr/bin/env node
'use strict';

const assert=require('node:assert');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Fabric=require('../shared/capability-fabric/index.js');
const Registry=require('../shared/capability-fabric/builder-registry.js');
const Admission=require('../shared/capability-fabric/admission-core.js');
const Foundry=require('../tools/capability-recipe-foundry/foundry-core.js');
const Host=require('../tools/capability-recipe-admission-gate/admission-host.js');

let passed=0;
function check(value,label){assert(value,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function clone(value){return JSON.parse(JSON.stringify(value));}
function writeCapability(root,built,name){const target=path.join(root,name);fs.mkdirSync(target);fs.writeFileSync(path.join(target,'capability.js'),built.source,{flag:'wx'});return require(path.join(target,'capability.js'));}
function expectBuildRefusal(builder,parameters,pattern,label){assert.throws(function(){builder.build(parameters);},pattern);check(true,label);}

function main(){
  const intent=Foundry.exampleAdapter(),expected=Foundry.forge(intent),pilotsRoot=path.resolve(__dirname,'../tools/capability-recipe-foundry/pilots');
  const packetRoot=fs.readdirSync(pilotsRoot,{withFileTypes:true}).filter(function(row){return row.isDirectory();}).map(function(row){return path.join(pilotsRoot,row.name);}).find(function(root){const packet=path.join(root,'packet.json');return fs.existsSync(packet)&&JSON.parse(fs.readFileSync(packet,'utf8')).packetDigest===expected.packet.packetDigest;});
  check(!!packetRoot,'exact current adapter packet is materialized');
  const inspected=Host.inspectPacketRoot(packetRoot);
  check(inspected.verification.state==='PASS'&&inspected.packet.packetDigest===expected.packet.packetDigest,'packet bytes, proposal, registry candidate, and authority boundary verify');
  const testReceipt=Host.runExactTest({packetRoot:packetRoot,confirmation:Admission.TEST_CONFIRMATION});
  check(testReceipt.state==='PASS'&&Admission.verifyTestReceipt(testReceipt,{proposalDigest:inspected.proposal.proposalDigest,builderId:inspected.builder.id,builderDigest:inspected.builder.implementationDigest,capabilityKind:inspected.builder.capabilityKind,packetDigest:inspected.packet.packetDigest}),'trusted host runs the exact builder and generated selftest');

  const builder=require(path.join(packetRoot,'builder-contribution.js')),parameters=intent.recipe.exampleRequest.parameters;
  const built=builder.build(parameters),rebuilt=builder.build(clone(parameters)),registryBuilt=Registry.compileReviewCandidate(inspected.builder.id,inspected.builder.implementationDigest,parameters);
  check(Fabric.canonicalJson(built)===Fabric.canonicalJson(rebuilt)&&Fabric.canonicalJson(built)===Fabric.canonicalJson(registryBuilt),'packet builder, rebuild, and registry candidate are byte-identical');
  check(!/(?:node:)?(?:fs|child_process|http|https|net)|\bfetch\b|XMLHttpRequest|\beval\s*\(|new Function|process\.env|Math\.random|Date\.now/.test(built.source),'generated adapter has no filesystem, process, network, clock, randomness, or dynamic-code surface');

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-adapter-review-'));
  try{
    const capability=writeCapability(temp,built,'base'),base={displayName:'Ada',score:7,category:'pilot',legacyNote:'drop me'};
    const first=capability.adapt(base),second=capability.adapt(clone(base));
    check(first.ok&&Fabric.canonicalJson(first)===Fabric.canonicalJson(second),'same accepted input produces the same result');
    check(Fabric.canonicalJson(first.output)===Fabric.canonicalJson({name:'Ada',points:7,label:'pilot'}),'copy, rename, and explicit drop produce the declared target shape');
    check(first.semanticCompatibilityProven===false&&capability.CONFIG.semanticClaim==='UNPROVEN','runtime preserves the structural-versus-domain-semantic boundary');
    check(capability.adapt({displayName:'Ada',score:7,legacyNote:'x'}).output.label==='unlabeled','missing optional input uses the reviewed default');
    check(capability.adapt(Object.assign({},base,{surprise:true})).code==='SOURCE_CONTRACT_INVALID','undeclared source fields fail closed');
    check(capability.adapt({score:7,legacyNote:'x'}).code==='SOURCE_CONTRACT_INVALID','missing required source fields fail closed');
    check(Object.isFrozen(capability.CONFIG)&&Object.isFrozen(capability.CONFIG.mappings)&&Object.isFrozen(capability.CONFIG.sourceSchema.properties),'all nested generated configuration is immutable');
    assert.throws(function(){capability.CONFIG.mappings[0].target='drift';},TypeError);check(true,'strict mutation of nested configuration is refused');

    let hostileCalled=false;const hostile=Object.assign({},base);hostile.toJSON=function(){hostileCalled=true;throw new Error('must not run');};
    check(capability.adapt(hostile).code==='SOURCE_CONTRACT_INVALID'&&!hostileCalled,'invalid toJSON input is refused before byte measurement can execute it');
    let getterCalled=false;const accessor=Object.assign({},base);Object.defineProperty(accessor,'displayName',{enumerable:true,get:function(){getterCalled=true;return 'Ada';}});
    check(capability.adapt(accessor).code==='SOURCE_CONTRACT_INVALID'&&!getterCalled,'accessor-bearing input is refused without invoking the getter');
    const symbolInput=Object.assign({},base);symbolInput[Symbol('hidden')]='x';
    check(capability.adapt(symbolInput).code==='SOURCE_CONTRACT_INVALID','symbol-bearing non-JSON input is refused');
    const nullPrototype=Object.assign(Object.create(null),base);
    check(capability.adapt(nullPrototype).ok===true,'plain null-prototype JSON records remain supported');

    const unicode=clone(parameters);unicode.sourceSchema.properties.displayName.maxLength=1;unicode.targetSchema.properties.name.maxLength=1;
    const unicodeCapability=writeCapability(temp,builder.build(unicode),'unicode');
    check(unicodeCapability.adapt({displayName:'😀',score:1,legacyNote:''}).ok===true,'string bounds count Unicode code points rather than UTF-16 units');

    const inputBound=clone(parameters);inputBound.maxInputBytes=64;inputBound.sourceSchema.properties.legacyNote.maxLength=1000;
    const inputBoundCapability=writeCapability(temp,builder.build(inputBound),'input-bound');
    check(inputBoundCapability.adapt({displayName:'Ada',score:1,category:'x',legacyNote:'x'.repeat(200)}).code==='INPUT_BYTES_EXCEEDED','source byte ceiling returns the typed refusal');
    const outputBound=clone(parameters);outputBound.maxOutputBytes=64;
    const outputBoundCapability=writeCapability(temp,builder.build(outputBound),'output-bound');
    check(outputBoundCapability.adapt({displayName:'x'.repeat(80),score:999999,category:'x'.repeat(32),legacyNote:''}).code==='OUTPUT_BYTES_EXCEEDED','target byte ceiling returns the typed refusal without returning partial output');

    const partial=clone(parameters);partial.mappings[2].onMissing='REFUSE';partial.mappings[2].defaultValue=null;
    const partialCapability=writeCapability(temp,builder.build(partial),'partial');
    check(partialCapability.CONFIG.totality==='PARTIAL'&&partialCapability.adapt({displayName:'Ada',score:1,legacyNote:''}).code==='SOURCE_FIELD_MISSING','optional REFUSE mapping is explicitly partial');
    const omit=clone(parameters);omit.targetSchema.required=omit.targetSchema.required.filter(function(name){return name!=='label';});omit.mappings[2].onMissing='OMIT';omit.mappings[2].defaultValue=null;
    const omitCapability=writeCapability(temp,builder.build(omit),'omit'),omitted=omitCapability.adapt({displayName:'Ada',score:1,legacyNote:''});
    check(omitCapability.CONFIG.totality==='TOTAL'&&omitted.ok&&!Object.prototype.hasOwnProperty.call(omitted.output,'label'),'optional OMIT mapping succeeds without inventing a target field');
  }finally{
    const resolved=path.resolve(temp);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('axm-adapter-review-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});
  }

  const reordered=clone(parameters);reordered.mappings.reverse();
  check(Fabric.canonicalJson(builder.build(reordered))===Fabric.canonicalJson(built),'mapping declaration order canonicalizes to one generated adapter');
  const hidden=clone(parameters);hidden.drops=[];expectBuildRefusal(builder,hidden,/mapped or explicitly dropped/,'hidden source-field loss is refused');
  const duplicate=clone(parameters);duplicate.mappings[2].source='displayName';expectBuildRefusal(builder,duplicate,/unique/,'duplicate mapping sources are refused');
  const narrowing=clone(parameters);narrowing.targetSchema.properties.name.maxLength=20;expectBuildRefusal(builder,narrowing,/structurally compatible/,'narrowing string constraints are refused');
  const numericNarrowing=clone(parameters);numericNarrowing.targetSchema.properties.points.type='integer';numericNarrowing.sourceSchema.properties.score.type='number';expectBuildRefusal(builder,numericNarrowing,/structurally compatible/,'number-to-integer narrowing is refused');
  const invalidDefault=clone(parameters);invalidDefault.mappings[2].defaultValue=9;expectBuildRefusal(builder,invalidDefault,/default/,'defaults must satisfy the exact target field');
  const regex=clone(parameters);regex.sourceSchema.properties.displayName.pattern='(a+)+$';expectBuildRefusal(builder,regex,/unsupported key/,'regex-bearing schemas are outside the bounded adapter subset');
  const reserved=clone(parameters);Object.defineProperty(reserved.targetSchema.properties,'__proto__',{value:{type:'string'},enumerable:true});expectBuildRefusal(builder,reserved,/invalid/,'prototype-sensitive field names are refused');
  const overProperties=clone(parameters);overProperties.maxProperties=65;expectBuildRefusal(builder,overProperties,/bounded range/,'property ceiling cannot exceed the reviewed maximum');
  check(!Fabric.ALLOWED_BUILDERS.includes(inspected.builder.id)&&!Fabric.loadCatalog().recipes.some(function(row){return row.id===intent.recipe.id;}),'review execution leaves the candidate inactive and absent from the catalog');
  process.stdout.write('Capability object adapter independent review PASS · '+passed+' checks\n');
}

try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}
