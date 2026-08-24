#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Fabric = require('./index.js');
const BuilderRegistry = require('./builder-registry.js');

let passed=0;
function check(condition,label){assert(condition,label);passed+=1;}
function resealPlan(plan){const copy=Fabric.clone(plan);delete copy.planDigest;plan.planDigest=Fabric.digest(copy);return plan;}
function resealCandidate(candidate){
  const bundle={schema:'axm.module-bundle/v1',id:candidate.package.id,version:candidate.package.version,requiredSeats:1,files:Object.keys(candidate.files).filter(function(path){return path!=='module-bundle.json';}).sort().map(function(path){return {path:path,encoding:'utf8',sha256:Fabric.digest(candidate.files[path]).slice(7),content:candidate.files[path]};})};
  candidate.files['module-bundle.json']=JSON.stringify(bundle,null,2)+'\n';
  candidate.package.files=Object.keys(candidate.files).sort().map(function(path){return {path:path,bytes:Buffer.byteLength(candidate.files[path],'utf8'),digest:Fabric.digest(candidate.files[path])};});
  candidate.package.totalBytes=candidate.package.files.reduce(function(sum,row){return sum+row.bytes;},0);
  const descriptor=Fabric.clone(candidate.package);delete descriptor.packageDigest;candidate.package.packageDigest=Fabric.digest(descriptor);return candidate;
}

function main(){
  const catalog=Fabric.loadCatalog(),catalogCheck=Fabric.validateCatalog(catalog);
  check(catalogCheck.ok,'digest-bound recipe catalog validates');
  check(catalog.recipes.length===9,'reviewed catalog has one portable SKILL plus eight bounded HAND recipes including the strict closed-object adapter');
  check(catalog.recipes.filter(function(row){return row.capabilityKind==='HAND'&&row.capabilityContract.runtimeMode==='EXECUTABLE';}).length===8&&catalog.recipes.filter(function(row){return row.capabilityKind==='SKILL'&&row.capabilityContract.runtimeMode==='HOST_MEDIATED';}).length===1,'reviewed active recipes preserve their exact modular kind and runtime boundary');
  check(catalog.recipes.every(function(row){return row.candidatePolicy.defaultCount===1&&row.candidatePolicy.variants.some(function(variant){return variant.id===row.candidatePolicy.defaultVariantId;});}),'every reviewed recipe explicitly defaults to one named candidate variant');
  check(catalog.activationPolicy==='SOURCE_REVIEW_AND_MIKE_MERGE','shared activation policy preserves Mike merge gate');
  check(BuilderRegistry.activeIds().length===9&&BuilderRegistry.activeIds().includes('closed-object-contract-adapter-v2')&&BuilderRegistry.reviewCandidateIds().join(',')==='closed-object-contract-adapter-v1','modular builder registry activates only the strict v2 adapter while retaining the exact historical v1 review candidate');
  check(catalog.recipes.every(function(row){const builder=BuilderRegistry.describe(row.builderId);return builder&&row.builderDigest===builder.implementationDigest;}),'every active recipe binds the exact modular builder digest');

  const packages={};
  catalog.recipes.forEach(function(recipe){
    const request=Fabric.sealRequest(recipe.exampleRequest,true),requestCheck=Fabric.validateRequest(request),plan=Fabric.planBuild(request,catalog),one=Fabric.build(request,catalog),two=Fabric.build(request,catalog);
    check(requestCheck.ok,recipe.id+' example seals into a valid request');
    check(plan.status==='READY'&&plan.candidateCount===1&&plan.recipeRef.capabilityKind===recipe.capabilityKind&&plan.recipeRef.builderDigest===recipe.builderDigest,recipe.id+' exact recipe plans one kind-and-builder-bound candidate');
    check(one.status==='COMPLETE'&&one.candidates.length===1,recipe.id+' builds one detached candidate');
    check(one.generatedCodeExecuted===false,recipe.id+' build does not execute generated code');
    check(Fabric.canonicalJson(one)===Fabric.canonicalJson(two),recipe.id+' rebuild is byte-identical');
    check(Fabric.verifyCandidate(one.candidates[0]).ok,recipe.id+' package verifies');
    check(Object.values(one.candidates[0].package.authority).every(function(value){return value===false;}),recipe.id+' package carries no authority');
    const selftestPath=recipe.capabilityKind==='HAND'?(recipe.capabilityContract.selftest||'selftest.js'):'skill.selftest.js';
    check(one.candidates[0].files[selftestPath]&&one.candidates[0].files['module-bundle.json'],recipe.id+' emits its kind-specific external test and exact bundle');
    const modular=JSON.parse(one.candidates[0].files['modular-capability.contract.json']);
    const modularBody=Fabric.clone(modular);delete modularBody.contractDigest;check(modular.kind===recipe.capabilityKind&&modular.contractDigest===Fabric.digest(modularBody),recipe.id+' emits a digest-bound modular capability contract');
    packages[recipe.id]=one.candidates[0];
  });

  const pythonRecipe=catalog.recipes.find(function(row){return row.id==='bounded-python-record-transform';}),pythonPackage=packages[pythonRecipe.id],pythonRuntime=JSON.parse(pythonPackage.files['modular-capability.contract.json']).runtime,pythonCompilation=JSON.parse(pythonPackage.files['compilation.receipt.json']);
  check(pythonPackage.files['capability.py']&&pythonPackage.files['selftest.py']&&!pythonPackage.files['capability.js']&&!pythonPackage.files['selftest.js'],'Python HAND emits exact language-native source and selftest paths without JavaScript aliases');
  check(pythonRuntime.sourceLanguage==='python'&&pythonRuntime.entry==='capability.py'&&pythonRuntime.selftest==='selftest.py','Python runtime contract byte-binds language, entry, and selftest paths');
  check(pythonRecipe.capabilityContract.requiredHostCapabilities.join(',')==='python-runtime/v3','Python recipe declares its future host runtime without receiving it');
  check(/^import json$/m.test(pythonPackage.files['capability.py'])&&!/^import (?:os|sys|subprocess|socket|pathlib)|^from (?:os|sys|subprocess|socket|pathlib)/m.test(pythonPackage.files['capability.py']),'generated Python source uses the reviewed json-only import surface');
  check(!/\b(?:open|eval|exec|compile|__import__|globals|locals|getattr|setattr)\s*\(/.test(pythonPackage.files['capability.py']),'generated Python source contains no file or dynamic-reflection call');
  check(pythonCompilation.generatedCodeExecuted===false&&pythonCompilation.testsEmitted===true,'Python compilation receipt distinguishes emitted tests from execution');
  const missingPythonSelftest=Fabric.clone(pythonPackage);delete missingPythonSelftest.files['selftest.py'];resealCandidate(missingPythonSelftest);const missingPythonCheck=Fabric.verifyCandidate(missingPythonSelftest);
  check(!missingPythonCheck.ok&&missingPythonCheck.errors.some(function(row){return row.code==='PACKAGE_REQUIRED_FILE_MISSING';}),'language-native required selftest cannot be omitted and rehashed');
  const caseAliasPython=Fabric.clone(pythonPackage);caseAliasPython.files['Capability.py']=caseAliasPython.files['capability.py'];resealCandidate(caseAliasPython);const caseAliasCheck=Fabric.verifyCandidate(caseAliasPython);
  check(!caseAliasCheck.ok&&caseAliasCheck.errors.some(function(row){return row.code==='PACKAGE_PATH_UNSAFE';}),'Windows-style case aliases are refused even after complete rehash');
  ['CON.py','folder\\capability.py','capability.py:stream'].forEach(function(unsafePath){const drift=Fabric.clone(pythonRecipe);drift.capabilityContract.entry=unsafePath;delete drift.recipeDigest;drift.recipeDigest=Fabric.digest(drift);check(!Fabric.validateRecipe(drift).ok,'unsafe Python entry path is refused: '+unsafePath);});

  const cssRecipe=catalog.recipes.find(function(row){return row.id==='bounded-css-token-stylesheet';}),cssPackage=packages[cssRecipe.id],cssSource=cssPackage.files['capability.js'],cssCompilation=JSON.parse(cssPackage.files['compilation.receipt.json']);
  check(cssPackage.files['capability.js']&&cssPackage.files['selftest.js'],'CSS HAND emits exact inert JavaScript source and selftest paths');
  check(!/@import|url\s*\(|<\/?style|\bfetch\s*\(|require\(['"](?:fs|node:fs|child_process|node:child_process)['"]\)|new Function|\beval\s*\(/i.test(cssSource),'generated CSS hand contains no arbitrary import, URL, style element, provider, filesystem, process, or dynamic-code surface');
  check(cssSource.includes(":root {\\n")&&cssSource.includes("rows.push('  --"),'generated CSS hand fixes output to root custom properties');
  check(['COLOR_HEX','INTEGER','LENGTH_PX','PERCENT','TIME_MS'].every(function(kind){return cssSource.includes("token.kind==='"+kind+"'");})&&cssRecipe.boundaries.some(function(row){return row.includes('COLOR_HEX');}),'CSS types are closed by reviewed builder logic and disclosed by the recipe boundary');
  check(cssCompilation.generatedCodeExecuted===false&&cssCompilation.testsEmitted===true,'CSS compilation receipt distinguishes emitted tests from execution');
  check(cssRecipe.boundaries.some(function(row){return row.includes('visual quality remain UNKNOWN');}),'CSS recipe preserves browser and visual uncertainty');
  const cssNameInjection=Fabric.clone(cssRecipe.exampleRequest);cssNameInjection.parameters.tokens[0].name='bad;display-none';assert.throws(function(){Fabric.build(Fabric.sealRequest(cssNameInjection,true),catalog);},/invalid/);passed+=1;
  const cssKindExpansion=Fabric.clone(cssRecipe.exampleRequest);cssKindExpansion.parameters.tokens[0].kind='RAW_CSS';assert.throws(function(){Fabric.build(Fabric.sealRequest(cssKindExpansion,true),catalog);},/unsupported/);passed+=1;
  const cssDuplicate=Fabric.clone(cssRecipe.exampleRequest);cssDuplicate.parameters.tokens[1].name=cssDuplicate.parameters.tokens[0].name;assert.throws(function(){Fabric.build(Fabric.sealRequest(cssDuplicate,true),catalog);},/unique/);passed+=1;
  check(true,'CSS token-name injection, raw kind expansion, and duplicate aliases are refused before candidate emission');

  const svgRecipe=catalog.recipes.find(function(row){return row.id==='svg-status-badge';}),svgPackage=packages[svgRecipe.id],svgSource=svgPackage.files['capability.js'],svgContract=JSON.parse(svgPackage.files['modular-capability.contract.json']),svgCompilation=JSON.parse(svgPackage.files['compilation.receipt.json']);
  check(svgRecipe.version==='1.1.0'&&svgRecipe.builderDigest===BuilderRegistry.describe('svg-status-badge-v1').implementationDigest,'SVG recipe binds the exact hardened builder version and digest');
  check(svgPackage.files['capability.js']&&svgPackage.files['selftest.js'],'SVG HAND emits exact inert JavaScript source and selftest paths');
  check(svgContract.consumes.join(',')==='axm.svg-status-badge-content/v1'&&svgContract.provides.includes('axm.creation.svg-status-badge/v1')&&svgContract.provides.includes('image/svg+xml'),'SVG contract binds one typed input and exact result/media outputs');
  check(svgSource.includes('jsonRecord')&&svgSource.includes('recordBytes')&&!svgSource.includes('JSON.stringify(input)')&&svgSource.includes('INPUT_FIELDS_UNSUPPORTED')&&svgSource.includes('INPUT_BYTES_EXCEEDED')&&svgSource.includes('SVG_BYTES_EXCEEDED'),'generated SVG hand closes the runtime record without invoking input serialization hooks and enforces both byte ceilings');
  check(svgSource.includes('xmlText')&&svgPackage.files['selftest.js'].includes('inheritedHookRead')&&svgPackage.files['selftest.js'].includes("'INPUT_BYTES_EXCEEDED'")&&svgPackage.files['selftest.js'].includes("'SVG_BYTES_EXCEEDED'"),'SVG emitted proof refuses inherited serialization hooks, XML-invalid text, and both active byte-budget adversaries');
  check(svgSource.includes('"maxInputBytes":128')&&svgSource.includes('"maxOutputBytes":1024'),'SVG active candidate binds the exact exercised input and output ceilings');
  check(svgSource.includes('<title>')&&svgSource.includes('viewBox=')&&svgSource.includes('&amp;')&&svgSource.includes('&lt;')&&svgSource.includes('&#39;'),'generated SVG hand contains bounded accessibility structure and XML escaping');
  check(!/(?:<script|<style|\son[a-z]+\s*=|href=|xlink:href|url\s*\(|@import|<animate|<set|<foreignObject|\bfetch\s*\(|new Function|\beval\s*\()/i.test(svgSource),'generated SVG hand contains no active, external-resource, provider, or dynamic-code surface');
  check(!/require\(['"](?:fs|node:fs|http|https|node:http|node:https|child_process|node:child_process)['"]\)/.test(svgSource),'generated SVG hand imports no filesystem, network, or process module');
  check(svgCompilation.generatedCodeExecuted===false&&svgCompilation.testsEmitted===true,'SVG compilation receipt distinguishes emitted tests from execution');
  check(svgRecipe.boundaries.some(function(row){return row.includes('visual fitness require separate live observation');}),'SVG recipe preserves browser and visual uncertainty');
  const svgHidden=Fabric.clone(svgRecipe.exampleRequest);svgHidden.parameters.rawSvg='<script/>';const svgHiddenPlan=Fabric.planBuild(Fabric.sealRequest(svgHidden,true),catalog);
  check(svgHiddenPlan.status==='HELD'&&svgHiddenPlan.holds[0].code==='CONTRACT_HOLD','SVG raw-source parameter expansion is held before builder invocation');
  const svgColorInjection=Fabric.clone(svgRecipe.exampleRequest);svgColorInjection.parameters.foreground='url(https://example.test/a)';const svgColorPlan=Fabric.planBuild(Fabric.sealRequest(svgColorInjection,true),catalog);
  check(svgColorPlan.status==='HELD'&&svgColorPlan.holds[0].code==='CONTRACT_HOLD','SVG colour URL injection is held by the exact recipe contract');

  const javascriptRecipe=catalog.recipes.find(function(row){return row.id==='pure-json-transform';}),javascriptPackage=packages[javascriptRecipe.id],javascriptSource=javascriptPackage.files['capability.js'],javascriptCompilation=JSON.parse(javascriptPackage.files['compilation.receipt.json']);
  check(javascriptRecipe.version==='1.1.0'&&javascriptRecipe.builderDigest===BuilderRegistry.describe('pure-json-transform-v1').implementationDigest,'JavaScript transform recipe binds the exact hardened builder version and digest');
  check(javascriptSource.includes('inspectRecord')&&javascriptSource.includes('recordBytes')&&!javascriptSource.includes('JSON.stringify(input)'),'JavaScript transform validates own data descriptors and measures only inspected string records without serializing arbitrary input');
  check(javascriptSource.includes('INPUT_OBJECT_REQUIRED')&&javascriptSource.includes('INPUT_FIELD_UNSUPPORTED')&&javascriptSource.includes('INPUT_VALUE_INVALID')&&javascriptSource.includes('INPUT_KEY_LIMIT')&&javascriptSource.includes('INPUT_BYTES_EXCEEDED')&&javascriptSource.includes('OUTPUT_BYTES_EXCEEDED'),'JavaScript transform emits the complete typed refusal surface');
  check(javascriptPackage.files['selftest.js'].includes('getterRead')&&javascriptPackage.files['selftest.js'].includes('inheritedHookRead')&&javascriptPackage.files['selftest.js'].includes("'INPUT_BYTES_EXCEEDED'")&&javascriptPackage.files['selftest.js'].includes("'OUTPUT_BYTES_EXCEEDED'"),'JavaScript emitted proof covers accessor and inherited-hook non-invocation plus both real byte-budget adversaries');
  check(javascriptSource.includes('deepFreeze')&&javascriptSource.includes('Object.defineProperty(output'),'JavaScript transform freezes exact configuration and emits a fresh one-field output record');
  check(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls|dgram)['"]\)|\bfetch\s*\(|provider\.call|process\.(?:env|cwd)|Date\.now|Math\.random|new Function|\beval\s*\(/.test(javascriptSource),'JavaScript transform source contains no filesystem, process, network, provider, environment, clock, randomness, or dynamic-code surface');
  check(javascriptCompilation.generatedCodeExecuted===false&&javascriptCompilation.testsEmitted===true,'JavaScript compilation receipt distinguishes emitted tests from execution');
  const javascriptHidden=Fabric.clone(javascriptRecipe.exampleRequest);javascriptHidden.parameters.inputField='__proto__';const javascriptHiddenPlan=Fabric.planBuild(Fabric.sealRequest(javascriptHidden,true),catalog);
  check(javascriptHiddenPlan.status==='HELD'&&javascriptHiddenPlan.holds[0].code==='CONTRACT_HOLD','JavaScript unsafe field expansion is held before builder invocation');

  const adapterRecipe=catalog.recipes.find(function(row){return row.id==='closed-object-contract-adapter';}),adapterPackage=packages[adapterRecipe.id],adapterSource=adapterPackage.files['capability.js'],adapterSelftest=adapterPackage.files['selftest.js'],adapterContract=JSON.parse(adapterPackage.files['modular-capability.contract.json']);
  check(adapterRecipe.version==='0.2.0'&&adapterRecipe.builderId==='closed-object-contract-adapter-v2'&&adapterRecipe.builderDigest===BuilderRegistry.describe('closed-object-contract-adapter-v2').implementationDigest,'adapter recipe binds the exact strict v2 builder version and digest');
  check(adapterContract.consumes.join(',')==='axm.example.legacy-player/v1'&&adapterContract.provides.join(',')==='axm.example.player-summary/v1','adapter contract byte-binds its exact source and target contracts');
  check(adapterSource.includes('inspectRecord')&&adapterSource.includes('PROPERTY_LIMIT_EXCEEDED')&&adapterSource.includes('INPUT_BYTES_EXCEEDED')&&adapterSource.includes('OUTPUT_BYTES_EXCEEDED'),'adapter enforces closed records plus property, input-byte, and output-byte ceilings');
  check(!adapterSource.includes('JSON.stringify(input)')&&!adapterSource.includes('JSON.stringify(output)')&&!/\bBuffer\b/.test(adapterSource),'adapter byte accounting does not delegate arbitrary records to host serialization or Buffer');
  check(adapterSelftest.includes('getterRead')&&adapterSelftest.includes('const hidden=')&&adapterSelftest.includes('const symbolRecord=')&&adapterSelftest.includes('originalStringify')&&adapterSelftest.includes('originalBuffer'),'adapter emitted proof covers accessors, hidden and symbol fields, and hostile host serializer globals');
  check(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls|dgram)['"]\)|\bfetch\s*\(|provider\.call|process\.(?:env|cwd)|Date\.now|Math\.random|new Function|\beval\s*\(/.test(adapterSource),'adapter source contains no filesystem, process, network, provider, environment, clock, randomness, or dynamic-code surface');

  const recipe=catalog.recipes.find(function(row){return row.id==='pure-json-transform';}),base=Fabric.sealRequest(recipe.exampleRequest,true),changedDraft=Fabric.clone(recipe.exampleRequest);changedDraft.parameters.defaultValue='different';const changed=Fabric.sealRequest(changedDraft,true);
  check(base.requestDigest!==changed.requestDigest,'semantic request change alters request digest');
  check(Fabric.build(base,catalog).candidates[0].package.packageDigest!==Fabric.build(changed,catalog).candidates[0].package.packageDigest,'semantic request change alters package digest');
  const builderDriftCatalog=Fabric.clone(catalog),builderDriftRecipe=builderDriftCatalog.recipes.find(function(row){return row.id===recipe.id;});builderDriftRecipe.builderDigest=Fabric.digest('wrong builder');delete builderDriftRecipe.recipeDigest;builderDriftRecipe.recipeDigest=Fabric.digest(builderDriftRecipe);delete builderDriftCatalog.catalogDigest;builderDriftCatalog.catalogDigest=Fabric.digest(builderDriftCatalog);
  check(Fabric.planBuild(base,builderDriftCatalog).status==='HELD','builder implementation digest drift becomes a catalog hold');

  const unreviewed=Fabric.sealRequest(recipe.exampleRequest,false),unreviewedPlan=Fabric.planBuild(unreviewed,catalog);
  check(unreviewedPlan.status==='HELD'&&unreviewedPlan.holds[0].code==='AUTHORITY_HOLD','unreviewed request is held');
  const missingDraft=Fabric.clone(recipe.exampleRequest);missingDraft.recipeId='missing-recipe';const missing=Fabric.planBuild(Fabric.sealRequest(missingDraft,true),catalog);
  check(missing.status==='HELD'&&missing.holds[0].code==='MISSING_RECIPE','missing exact recipe returns typed hold');
  const implicitDraft=Fabric.clone(recipe.exampleRequest);implicitDraft.recipeId=null;const implicit=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),catalog);
  check(implicit.status==='READY'&&implicit.recipeRef.id===recipe.id,'single exact family match can be resolved without guessing');
  const ambiguousCatalog=Fabric.clone(catalog),copy=Fabric.clone(recipe);copy.id='pure-json-transform-alt';copy.exampleRequest.recipeId=copy.id;delete copy.recipeDigest;copy.recipeDigest=Fabric.digest(copy);ambiguousCatalog.recipes.push(copy);delete ambiguousCatalog.catalogDigest;ambiguousCatalog.catalogDigest=Fabric.digest(ambiguousCatalog);const ambiguous=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),ambiguousCatalog);
  check(ambiguous.status==='HELD'&&ambiguous.holds[0].code==='RECIPE_SELECTION_REQUIRED','ambiguous family returns selection hold');
  const invalid=Fabric.clone(base);invalid.parameters.extra=true;delete invalid.requestDigest;invalid.requestDigest=Fabric.digest(invalid);const invalidPlan=Fabric.planBuild(invalid,catalog);
  check(invalidPlan.status==='HELD'&&invalidPlan.holds[0].code==='CONTRACT_HOLD','unknown parameter is refused by closed recipe contract');
  const defaultedCatalog=Fabric.clone(catalog),defaultedRecipe=defaultedCatalog.recipes.find(function(row){return row.id===recipe.id;});defaultedRecipe.candidatePolicy.variants[0].parameterOverrides={defaultValue:'from-variant'};delete defaultedRecipe.recipeDigest;defaultedRecipe.recipeDigest=Fabric.digest(defaultedRecipe);delete defaultedCatalog.catalogDigest;defaultedCatalog.catalogDigest=Fabric.digest(defaultedCatalog);const defaultedDraft=Fabric.clone(recipe.exampleRequest);delete defaultedDraft.parameters.defaultValue;const defaultedRequest=Fabric.sealRequest(defaultedDraft,true),defaultedPlan=Fabric.planBuild(defaultedRequest,defaultedCatalog);
  check(defaultedPlan.status==='READY'&&Fabric.build(defaultedRequest,defaultedCatalog).status==='COMPLETE','default variant overrides are resolved before required-parameter validation');
  const invalidVariantCatalog=Fabric.clone(catalog),invalidVariantRecipe=invalidVariantCatalog.recipes.find(function(row){return row.id===recipe.id;});invalidVariantRecipe.candidatePolicy.variants[0].parameterOverrides={undeclared:true};delete invalidVariantRecipe.recipeDigest;invalidVariantRecipe.recipeDigest=Fabric.digest(invalidVariantRecipe);delete invalidVariantCatalog.catalogDigest;invalidVariantCatalog.catalogDigest=Fabric.digest(invalidVariantCatalog);const invalidVariantPlan=Fabric.planBuild(base,invalidVariantCatalog);
  check(invalidVariantPlan.status==='HELD'&&invalidVariantPlan.holds[0].code==='CATALOG_HOLD','invalid variant override becomes a typed catalog hold before compilation');
  const forgedPlan=Fabric.clone(Fabric.planBuild(base,catalog));forgedPlan.requestDigest=unreviewed.requestDigest;resealPlan(forgedPlan);assert.throws(function(){Fabric.buildCandidate(unreviewed,catalog,forgedPlan);});passed+=1;
  const weakenedPlan=Fabric.clone(Fabric.planBuild(base,catalog));weakenedPlan.candidateCount=0;resealPlan(weakenedPlan);assert.throws(function(){Fabric.buildCandidate(base,catalog,weakenedPlan);});passed+=1;
  check(true,'exported candidate builder refuses forged or weakened READY plans');

  const proposalRecipe=Fabric.clone(recipe);delete proposalRecipe.recipeDigest;delete proposalRecipe.builderDigest;proposalRecipe.schema=Fabric.PROPOSAL_RECIPE_SCHEMA;proposalRecipe.id='mirror-proposed-transform';proposalRecipe.activation='INACTIVE_PROPOSAL';proposalRecipe.exampleRequest.id='mirror-proposed-transform-example';proposalRecipe.exampleRequest.recipeId=proposalRecipe.id;const proposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'MIRROR',recipe:proposalRecipe,proposalDigest:Fabric.digest(proposalRecipe)},proposalResult=Fabric.importRecipeProposal(proposal);
  check(proposalResult.ok&&proposalResult.status==='INACTIVE_PROPOSAL'&&proposalResult.active===false,'Mirror recipe proposal remains inactive');
  check(proposalResult.providerCalled===false,'proposal inspection invokes no provider');
  const humanProposal=Fabric.clone(proposal);humanProposal.sourceKind='HUMAN';const codexProposal=Fabric.clone(proposal);codexProposal.sourceKind='CODEX';
  check(Fabric.importRecipeProposal(humanProposal).ok&&Fabric.importRecipeProposal(codexProposal).ok,'human and Codex authors retain truthful inactive proposal provenance');
  const skillProposal=Fabric.clone(proposal);skillProposal.recipe.id='portable-review-skill';skillProposal.recipe.family='capability-review';skillProposal.recipe.capabilityKind='SKILL';skillProposal.recipe.capabilityContract={runtimeMode:'HOST_MEDIATED',entry:null,operation:'followProcedure',portableForm:'SKILL_MD',portablePath:'SKILL.md',resultContractPolicy:'BUILDER_PROVIDES_EXACT',requiredHostCapabilities:['human-or-agent-procedure-runner/v1']};skillProposal.recipe.exampleRequest.id='portable-review-skill-example';skillProposal.recipe.exampleRequest.family=skillProposal.recipe.family;skillProposal.recipe.exampleRequest.recipeId=skillProposal.recipe.id;skillProposal.proposalDigest=Fabric.digest(skillProposal.recipe);
  check(Fabric.importRecipeProposal(skillProposal).ok&&Fabric.importRecipeProposal(skillProposal).active===false,'first-class SKILL proposal is accepted only as inactive review material');
  const invalidSkill=Fabric.clone(skillProposal);invalidSkill.recipe.capabilityContract.portablePath=null;invalidSkill.proposalDigest=Fabric.digest(invalidSkill.recipe);
  check(!Fabric.importRecipeProposal(invalidSkill).ok,'SKILL proposal without portable SKILL.md binding is refused');
  const activeClaim=Fabric.clone(proposal);activeClaim.recipe.activation=Fabric.ACTIVE_RECIPE;activeClaim.proposalDigest=Fabric.digest(activeClaim.recipe);const activeClaimResult=Fabric.importRecipeProposal(activeClaim);
  check(!activeClaimResult.ok&&activeClaimResult.errors.some(function(row){return row.code==='PROPOSAL_ACTIVATION_REFUSED';}),'proposal inspection refuses an active-recipe claim');
  const malformedProposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'AI',recipe:{},proposalDigest:Fabric.digest({})};
  check(!Fabric.importRecipeProposal(malformedProposal).ok,'under-specified recipe proposal is refused without provider execution');

  const hand={schema:'axm.workshop-direction.hand-request/v1',handRequestId:'hand-proof',targetModuleId:'status-proof',title:'Build a status proof',reason:'No bounded callable hand exists.',desiredContract:'axm.direction-hand/status-proof/v1'},target={recipeId:'pure-json-transform',family:'code-module',parameters:Fabric.clone(recipe.exampleRequest.parameters),idSuffix:'capability'},adapted=Fabric.adaptHandRequest(hand,target);
  check(adapted.ok&&adapted.request.schema===Fabric.REQUEST_SCHEMA,'Workshop Direction hand request adapts to exact build request contract');
  check(adapted.request.humanReviewed===false&&adapted.status==='HUMAN_REVIEW_REQUIRED','adapted build request cannot self-approve');
  check(Fabric.validateRequest(adapted.request).ok,'adapted request carries a valid deterministic digest');
  check(Fabric.planBuild(adapted.request,catalog).status==='HELD','adapted request cannot build before human review');

  const tampered=Fabric.clone(packages['pure-json-transform']);tampered.files['capability.js']+='// drift\n';
  check(!Fabric.verifyCandidate(tampered).ok,'package byte tampering is detected');
  const installedManifest=Fabric.clone(packages['pure-json-transform']),manifest=JSON.parse(installedManifest.files['manifest.json']);manifest.installed=true;installedManifest.files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';resealCandidate(installedManifest);const manifestCheck=Fabric.verifyCandidate(installedManifest);
  check(!manifestCheck.ok&&manifestCheck.errors.some(function(row){return row.code==='MANIFEST_AUTHORITY_DRIFT';}),'rehashing cannot hide an installed manifest authority conflict');
  const writableContract=Fabric.clone(packages['pure-json-transform']),contract=JSON.parse(writableContract.files['module.contract.json']);contract.permissions=['filesystem'];writableContract.files['module.contract.json']=JSON.stringify(contract,null,2)+'\n';resealCandidate(writableContract);const contractCheck=Fabric.verifyCandidate(writableContract);
  check(!contractCheck.ok&&contractCheck.errors.some(function(row){return row.code==='CONTRACT_AUTHORITY_DRIFT';}),'rehashing cannot hide a permission-bearing contract');
  const weakenedEvidence=Fabric.clone(packages['pure-json-transform']),evidence=JSON.parse(weakenedEvidence.files['evidence-route.json']);evidence.notProven=[];weakenedEvidence.files['evidence-route.json']=JSON.stringify(evidence,null,2)+'\n';resealCandidate(weakenedEvidence);const evidenceCheck=Fabric.verifyCandidate(weakenedEvidence);
  check(!evidenceCheck.ok&&evidenceCheck.errors.some(function(row){return row.code==='EVIDENCE_BOUNDARY_DRIFT';}),'rehashing cannot erase required not-proven evidence boundaries');
  const promotedDescriptor=Fabric.clone(packages['pure-json-transform']);promotedDescriptor.package.authority.promoted=true;const promotedBody=Fabric.clone(promotedDescriptor.package);delete promotedBody.packageDigest;promotedDescriptor.package.packageDigest=Fabric.digest(promotedBody);const promotedCheck=Fabric.verifyCandidate(promotedDescriptor);
  check(!promotedCheck.ok&&promotedCheck.errors.some(function(row){return row.code==='DETACHED_AUTHORITY_CONFLICT';}),'rehashing cannot hide descriptor promotion authority');
  const byteLie=Fabric.clone(packages['pure-json-transform']);byteLie.package.files[0].bytes+=1;const byteLieBody=Fabric.clone(byteLie.package);delete byteLieBody.packageDigest;byteLie.package.packageDigest=Fabric.digest(byteLieBody);
  check(!Fabric.verifyCandidate(byteLie).ok,'rehashing cannot hide false file byte declarations');
  const kindDrift=Fabric.clone(packages['pure-json-transform']),modularDrift=JSON.parse(kindDrift.files['modular-capability.contract.json']);modularDrift.runtime.operation='promote';delete modularDrift.contractDigest;modularDrift.contractDigest=Fabric.digest(modularDrift);kindDrift.files['modular-capability.contract.json']=JSON.stringify(modularDrift,null,2)+'\n';resealCandidate(kindDrift);
  check(!Fabric.verifyCandidate(kindDrift).ok&&Fabric.verifyCandidate(kindDrift).errors.some(function(row){return row.code==='MODULAR_CONTRACT_DRIFT';}),'rehashing cannot drift modular HAND runtime semantics');
  process.stdout.write('Capability Fabric shared selftest PASS · '+passed+' checks\n');
}

main();
