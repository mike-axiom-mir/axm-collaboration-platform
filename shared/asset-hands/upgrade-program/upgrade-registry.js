'use strict';

const Program = require('./program.json');
const Modules = require('./foundation-index');
const U = require('./foundation-utils');
const TargetCanvas = require('../target-canvas');

const EXTENSION_SCHEMA = 'axm.asset-hand-extension/v1';
const REQUEST_SCHEMA = 'axm.asset-hand-upgrade-request/v1';
const RESULT_SCHEMA = 'axm.asset-hand-upgrade-result/v1';
const INVOCATION_SCHEMA = 'axm.asset-hand-upgrade-invocation/v1';
const ALL_CONSTRAINTS = [
  'target_canvas.medium', 'target_canvas.dimensions', 'target_canvas.colour',
  'target_canvas.physical', 'target_canvas.behaviour', 'target_canvas.performance',
  'target_canvas.intended_use', 'quality_requirements', 'required_outputs',
];

const GROUPS = Object.freeze({
  qualityGate: [1], familyCoherence: [2], conformance: [3], editKernel: [4],
  runtimeSubstrates: [5], negotiationSdk: [6], roundTripLedger: [7], benchmark: [8],
  fuzzHarness: [9], extensionSandbox: [10], nativeAdapters: [11, 13],
  rendererMatrix: [12, 18, 19, 21], externalValidators: [14, 15, 16, 17],
  textureMatrix: [20], dtcgTokens: [22], accessibilityJourney: [23],
  interactivePrototype: [24], rasterDocument: [25, 26, 27], vectorEngine: [28, 29],
  typographyStory: [30, 31], softgoodsProduction: [32, 33, 34, 35],
  manufacturing: [36, 37, 38, 39], advanced3d: [40, 41, 42, 43, 44, 45],
  audioProduction: [46, 47, 48], videoProduction: [49, 50],
});

const FUNCTION_MAP = Object.freeze({
  1:['createBenchmark','openGate','addMachineObservation','submitHumanReview','assertGateBinding'],
  2:['createStyleContract','createReferenceFamily'], 3:['claimIds','lintDescriptor','buildMatrix'],
  4:['createDocument','validateDocument','documentDigest','createSession','apply','undo','redo'],
  5:['createManifest','resolve'], 6:['createClient','createHostFixture'],
  7:['createAdapter','semanticDiff','evaluate'], 8:['record','run'], 9:['mutate','run'],
  10:['publicFingerprint','createSignedManifest','verifyManifest','execute'],
  11:['createGodotProjectBundle','createAdapter','plan','apply','rollback'], 12:['createScene','capture','pixelDiff','compare'],
  13:['createAdapter','plan','apply','rollback'], 14:['createProfile','run','runCorpus'], 15:['createProfile','run','runCorpus'],
  16:['createProfile','run','runCorpus'], 17:['createProfile','run','runCorpus'],
  18:['assessColourPipeline'], 19:['createScene','capture','compare','assessGltfFidelity'], 20:['assess'],
  21:['createScene','capture','compare','assessMaterialMatrix'], 22:['parse','exportDocument','createRoundTripAdapter'],
  23:['createPlan','assess'], 24:['create','html','run'],
  25:['create','render','save','load','addLayer'], 26:['stroke','render'],
  27:['retouch','selectionMask','render','addLayer'], 28:['createPath','splitCubic','join','offsetPolyline','booleanRect','pathData'],
  29:['variableOutline','appearanceSvg'], 30:['layoutParagraph','textPathSvg'], 31:['createStory'],
  32:['ean13','barcodeSvg','createPackaging'], 33:['createFabric'], 34:['createGarment'],
  35:['createEmbroidery','encodeDelta'], 36:['createSketch','buildCad'], 37:['developSheetMetal'],
  38:['create3mf'], 39:['createMachineProfile','createCamCandidate','approveCam'],
  40:['assessBake'], 41:['normalizeMesh','topology','silhouetteError','assessLods'],
  42:['deform','twoBoneIk','assessAnimation'], 43:['assessAovs'], 44:['simulate'], 45:['createWorld','streamAt'],
  46:['wavEncode','wavDecode','analyze','synthesize'], 47:['editMix'],
  48:['midi2Note','umpBytes','createMidi2','negotiateMidi'],
  49:['createEdl','applyOperation','relink','frameMap','verifyFrames'], 50:['webVtt','finish'],
});

function ranges(from, to) { const out=[]; for(let i=from;i<=to;i+=1) out.push(i); return out; }
function inRanks(rank, values) { return values.indexOf(rank) >= 0; }
function moduleFor(rank) {
  return Object.keys(GROUPS).find((name) => GROUPS[name].indexOf(rank) >= 0);
}
function canvasTypes(rank) {
  if (rank <= 23) return ['*'];
  if (rank === 24) return ['screen','ui'];
  if (inRanks(rank, ranges(25,31))) return ['screen','ui','print','paper','fabric'];
  if (rank === 32) return ['print','paper','physical-object'];
  if (inRanks(rank,[33,34,35])) return ['fabric'];
  if (inRanks(rank,[36,37,38,39])) return ['wood','metal','physical-object','3d-surface'];
  if (inRanks(rank,[40,41,42,43,44])) return ['game-world','3d-surface'];
  if (rank === 45) return ['game-world'];
  if (inRanks(rank,[46,47,48])) return ['screen','game-world','physical-object','audio-device'];
  return ['screen','game-world'];
}
function outputs(rank) {
  if (rank <= 10) return ['application/json'];
  if (inRanks(rank,[11,13])) return ['axm.native-project-change+json','application/zip'];
  if (inRanks(rank,[12,19,21])) return ['image/png','application/json'];
  if (inRanks(rank,[14,15,16,17,18,20,23,40,41,42,43,44])) return ['application/json'];
  if (rank === 22) return ['application/design-tokens+json'];
  if (rank === 24) return ['text/html','application/json'];
  if (inRanks(rank,[25,26,27])) return ['image/png','axm.raster-document+json'];
  if (rank === 28) return ['application/json'];
  if (inRanks(rank,[29,30])) return ['image/svg+xml','application/json'];
  if (rank === 31) return ['application/json','image/svg+xml'];
  if (rank === 32) return ['image/svg+xml','application/json'];
  if (rank === 33) return ['image/svg+xml','application/json'];
  if (rank === 34) return ['application/json'];
  if (rank === 35) return ['application/vnd.tajima.dst','application/json'];
  if (rank === 36) return ['application/json','model/step'];
  if (rank === 37) return ['application/json'];
  if (rank === 38) return ['model/3mf'];
  if (rank === 39) return ['text/x-gcode','application/json'];
  if (rank === 45) return ['application/vnd.axm.world+json','application/octet-stream'];
  if (rank === 46) return ['audio/wav','application/json'];
  if (rank === 47) return ['audio/wav','axm.audio-mix+json'];
  if (rank === 48) return ['application/vnd.midi2.ump','application/json'];
  if (rank === 49) return ['application/vnd.axm.edl+json'];
  if (rank === 50) return ['video/mp4','text/vtt','application/json'];
  return ['application/json'];
}
function substrates(rank) {
  const map={11:['godot-runtime'],12:['cross-renderer-runtime'],14:['epubcheck'],15:['verapdf'],16:['external-pdfx-validator'],17:['openimageio','openexr'],18:['opencolorio'],19:['khronos-gltf-validator','offline-renderer'],20:['ktx-tools','ktx-validator'],21:['materialx-1.39-runtime','cross-renderer-runtime'],23:['assistive-technology-review'],32:['external-pdfx-validator','packaging-physical-mockup-review'],33:['printed-swatch-review'],34:['garment-production-review'],35:['embroidery-parser-or-simulator'],36:['brep-step-kernel'],37:['brep-step-kernel'],38:['official-3mf-validator'],39:['machine-specific-postprocessor','human-cam-approval'],40:['texture-baker'],41:['mesh-repair-kernel','mesh-compression-runtime','lod-visual-review'],42:['rig-runtime'],43:['offline-renderer'],44:['simulation-runtime'],46:['independent-audio-decoder','audible-review'],47:['loudness-meter','independent-audio-decoder'],48:['official-smf2-clip-codec'],50:['video-muxer','independent-av-decoder']};
  return map[rank] ? map[rank].slice() : [];
}
function operations(rank) {
  return { preview: inRanks(rank,[2,12,19,21,24,25,26,27,29,30,31,32,33,46,47,50]), validate: true, edit: inRanks(rank,[4,11,13,25,26,27,28,29,47,49]) };
}
function constraints(rank) {
  if (rank <= 23) return ALL_CONSTRAINTS.slice();
  const out=['target_canvas.medium','target_canvas.dimensions','target_canvas.intended_use','quality_requirements','required_outputs'];
  if (inRanks(rank,[25,26,27,28,29,30,31,32,33,34,35,46,47,48,49,50])) out.push('target_canvas.colour');
  if (inRanks(rank,[32,33,34,35,36,37,38,39,40,41,42,43,44,45])) out.push('target_canvas.physical');
  if (inRanks(rank,[24,33,43,45,46,47,48,49,50])) out.push('target_canvas.behaviour');
  if (inRanks(rank,[24,25,26,27,38,40,41,42,43,44,45,46,47,48,49,50])) out.push('target_canvas.performance');
  return out;
}

const DESCRIPTORS = Object.freeze(Program.upgrades.map((upgrade) => {
  const module = moduleFor(upgrade.rank);
  U.ensure(module && Modules[module], 'upgrade module missing for rank '+upgrade.rank);
  const functions = FUNCTION_MAP[upgrade.rank];
  U.ensure(functions && functions.every((name) => typeof Modules[module][name] === 'function'), 'upgrade operation missing for '+upgrade.id);
  return Object.freeze({schema:EXTENSION_SCHEMA,id:upgrade.id,title:upgrade.title,version:'1.0.0',rank:upgrade.rank,wave:upgrade.wave,class:upgrade.class,capabilities:Object.freeze(upgrade.capabilities.slice()),depends_on:Object.freeze(upgrade.depends_on.slice()),module,functions:Object.freeze(functions.slice()),output_types:Object.freeze(outputs(upgrade.rank)),canvas_types:Object.freeze(canvasTypes(upgrade.rank)),constraints_honoured:Object.freeze(constraints(upgrade.rank)),editable_recipe_formats:Object.freeze(['axm.asset-creation-recipe/v1','axm.asset-hand-upgrade-invocation/v1']),operations:Object.freeze(operations(upgrade.rank)),implementation_status:'executable-contract',acceptance_state:upgrade.state,required_substrates:Object.freeze(substrates(upgrade.rank))});
}));

function clone(value){ return U.clone(value); }
function list(){ return clone(DESCRIPTORS); }
function get(id){ const found=DESCRIPTORS.find((item)=>item.id===id); return found?clone(found):null; }
function normalizeRequest(raw){
  raw=raw&&typeof raw==='object'?clone(raw):{};
  const inspected=TargetCanvas.inspect(raw.target_canvas||{},raw);
  return {schema:REQUEST_SCHEMA,required_capabilities:Array.from(new Set((raw.required_capabilities||raw.capabilities||[]).map(String))).sort(),target_canvas:inspected.canvas,target_canvas_original:inspected.original,target_canvas_validation:{pass:inspected.pass,errors:inspected.errors.slice(),transformations:inspected.transformations.slice()},intended_use:String(raw.intended_use||inspected.canvas&&inspected.canvas.intended_use||''),quality_requirements:clone(raw.quality_requirements||{}),required_outputs:Array.from(new Set((raw.required_outputs||[]).map(String))).sort(),editable_recipe_formats:Array.from(new Set((raw.editable_recipe_formats||[]).map(String))).sort(),required_constraints:Array.from(new Set((raw.required_constraints||[]).map(String))).sort(),required_operations:Array.from(new Set((raw.required_operations||[]).map(String))).sort(),available_substrates:Array.from(new Set((raw.available_substrates||[]).map(String))).sort(),require_production_acceptance:raw.require_production_acceptance===true};
}
function rejection(hand,code,missing){return{hand_id:hand.id,code,missing:missing.slice(),reason:code+': '+missing.join(', ')}};
function diagnose(raw){
  const request=normalizeRequest(raw), rejections=[];
  if(!request.required_capabilities.length) return result('MISSING_HAND',request,[],[],['required_capabilities'],null);
  if(!request.target_canvas_validation.pass) return result('UNSUPPORTED_CANVAS',request,[],[],request.target_canvas_validation.errors,null);
  const capabilityCandidates=DESCRIPTORS.filter((hand)=>request.required_capabilities.every((cap)=>hand.capabilities.includes(cap)));
  if(!capabilityCandidates.length) return result('MISSING_HAND',request,[],DESCRIPTORS.map((hand)=>rejection(hand,'CAPABILITY_MISMATCH',request.required_capabilities.filter((cap)=>!hand.capabilities.includes(cap)))),request.required_capabilities,null);
  const medium=request.target_canvas.medium;
  const canvasCandidates=capabilityCandidates.filter((hand)=>hand.canvas_types.includes('*')||hand.canvas_types.includes(medium));
  capabilityCandidates.filter((hand)=>!canvasCandidates.includes(hand)).forEach((hand)=>rejections.push(rejection(hand,'UNSUPPORTED_CANVAS',[medium])));
  if(!canvasCandidates.length) return result('UNSUPPORTED_CANVAS',request,[],rejections,[medium],null);
  const full=canvasCandidates.filter((hand)=>{
    const missingOutputs=request.required_outputs.filter((item)=>!hand.output_types.includes(item));
    const missingConstraints=request.required_constraints.filter((item)=>!hand.constraints_honoured.includes(item));
    const missingRecipes=request.editable_recipe_formats.filter((item)=>!hand.editable_recipe_formats.includes(item));
    const missingOperations=request.required_operations.filter((item)=>hand.operations[item]!==true);
    if(missingOutputs.length) rejections.push(rejection(hand,'OUTPUT_MISMATCH',missingOutputs));
    if(missingConstraints.length) rejections.push(rejection(hand,'CONSTRAINT_MISMATCH',missingConstraints));
    if(missingRecipes.length) rejections.push(rejection(hand,'RECIPE_MISMATCH',missingRecipes));
    if(missingOperations.length) rejections.push(rejection(hand,'OPERATION_MISMATCH',missingOperations));
    return !missingOutputs.length&&!missingConstraints.length&&!missingRecipes.length&&!missingOperations.length;
  });
  if(!full.length) return result('MISSING_HAND',request,[],rejections,Array.from(new Set(rejections.flatMap((item)=>item.missing))).sort(),null);
  const available=new Set(request.available_substrates), selected=full[0];
  const missingSubstrates=selected.required_substrates.filter((item)=>!available.has(item));
  if(missingSubstrates.length) return result('MISSING_SUBSTRATE',request,full,rejections,missingSubstrates,selected);
  if(request.require_production_acceptance&&selected.acceptance_state!=='READY') return result('REVIEW_REQUIRED',request,full,rejections,['production acceptance: '+selected.acceptance_state],selected);
  return result('READY_CONTRACT',request,full,rejections,[],selected);
}
function plan(raw){
  const request=normalizeRequest(raw),rejections=[],owners=[],uncovered=[];
  if(!request.required_capabilities.length)return planResult('MISSING_HAND',request,[],[],['required_capabilities'],null);
  if(!request.target_canvas_validation.pass)return planResult('UNSUPPORTED_CANVAS',request,[],[],request.target_canvas_validation.errors,null);
  for(const capability of request.required_capabilities){
    const declared=DESCRIPTORS.filter((hand)=>hand.capabilities.includes(capability));
    if(!declared.length){uncovered.push(capability);continue;}
    const compatible=declared.filter((hand)=>(hand.canvas_types.includes('*')||hand.canvas_types.includes(request.target_canvas.medium))&&request.required_constraints.every((item)=>hand.constraints_honoured.includes(item))&&request.required_operations.every((item)=>hand.operations[item]===true)&&request.editable_recipe_formats.every((item)=>hand.editable_recipe_formats.includes(item)));
    if(!compatible.length){declared.forEach((hand)=>rejections.push(rejection(hand,'UNSUPPORTED_COMPOSITION_MEMBER',[capability,request.target_canvas.medium])));uncovered.push(capability);continue;}
    const selected=compatible[0],existing=owners.find((item)=>item.hand.id===selected.id);
    if(existing)existing.covers.push(capability);else owners.push({hand:selected,covers:[capability],role:'requested'});
  }
  if(uncovered.length){const canvasOnly=uncovered.every((capability)=>DESCRIPTORS.some((hand)=>hand.capabilities.includes(capability)));return planResult(canvasOnly?'UNSUPPORTED_CANVAS':'MISSING_HAND',request,owners,rejections,uncovered,null);}
  const produced=new Set(owners.flatMap((item)=>item.hand.output_types));const missingOutputs=request.required_outputs.filter((item)=>!produced.has(item));
  if(missingOutputs.length)return planResult('MISSING_HAND',request,owners,rejections,missingOutputs,null);
  const byId=new Map(DESCRIPTORS.map((hand)=>[hand.id,hand]));const all=owners.slice();
  function addDependency(id){if(all.some((item)=>item.hand.id===id))return;const hand=byId.get(id);U.ensure(hand,'upgrade dependency is not installed: '+id);hand.depends_on.forEach(addDependency);all.push({hand,covers:[],role:'dependency'});}
  owners.forEach((item)=>item.hand.depends_on.forEach(addDependency));all.sort((a,b)=>a.hand.rank-b.hand.rank);
  const available=new Set(request.available_substrates),missingSubstrates=Array.from(new Set(all.flatMap((item)=>item.hand.required_substrates.filter((substrate)=>!available.has(substrate))))).sort();
  if(missingSubstrates.length)return planResult('MISSING_SUBSTRATE',request,all,rejections,missingSubstrates,owners[0]&&owners[0].hand);
  if(request.require_production_acceptance){const reviews=all.filter((item)=>item.hand.acceptance_state!=='READY').map((item)=>item.hand.id+': '+item.hand.acceptance_state);if(reviews.length)return planResult('REVIEW_REQUIRED',request,all,rejections,reviews,owners[0]&&owners[0].hand);}
  return planResult('READY_CONTRACT',request,all,rejections,[],owners[0]&&owners[0].hand);
}
function planResult(status,request,routes,rejections,missing,selected){
  const out=result(status,request,routes.map((item)=>item.hand),rejections,missing,selected);out.route_plan=routes.map((item)=>({hand:clone(item.hand),role:item.role,covers:item.covers.slice()}));out.digest=U.sha256(Object.assign({},out,{digest:undefined}));return out;
}
function result(status,request,compatible,rejections,missing,selected){
  const out={schema:RESULT_SCHEMA,status,request,selected_hand:selected?clone(selected):null,compatible_hands:clone(compatible),rejections:clone(rejections),missing:missing.slice(),fallback_used:false,invocation:null};
  out.digest=U.sha256(out); return out;
}
function effectiveArguments(args, request, hand, operation){
  const supplied=Array.isArray(args)?args:[];
  const next=clone(supplied);
  if(hand&&hand.rank===8&&operation==='run'&&typeof supplied[1]==='function')next[1]=supplied[1];
  const canvas=request.target_canvas;
  if(!next.length||!next[0]||typeof next[0]!=='object'||Array.isArray(next[0])) next.unshift({});
  const spec=next[0];
  spec.target_canvas=clone(canvas); spec.intended_use=request.intended_use;
  spec.quality_requirements=clone(request.quality_requirements); spec.required_outputs=request.required_outputs.slice();
  spec.canvas_constraints={dimensions:clone(canvas.dimensions),colour:clone(canvas.colour),physical:clone(canvas.physical),behaviour:clone(canvas.behaviour),performance:clone(canvas.performance)};
  if(canvas.dimensions&&canvas.dimensions.unit==='px'){ if(spec.width==null)spec.width=canvas.dimensions.width; if(spec.height==null)spec.height=canvas.dimensions.height; }
  return next;
}
function argumentEvidence(args){return(args||[]).map((value)=>typeof value==='function'?{kind:'local-function',name:String(value.name||'anonymous').slice(0,100),digest:U.sha256(Function.prototype.toString.call(value))}:clone(value));}
function operationMode(name){if(/^(create|synthesize|barcode)/i.test(name))return'create';if(/^(apply|edit|stroke|retouch|split|join|offset|boolean|deform|relink|addLayer)/i.test(name))return'edit';if(/^(finish|approve)/i.test(name))return'finish';if(/^(render|capture|html|streamAt)/i.test(name))return'inspect';return'validate';}
function sourceDigests(value,path,out,depth){out=out||[];path=path||'$';depth=depth||0;if(depth>5||out.length>=100||value==null)return out;if(Array.isArray(value)){value.slice(0,100).forEach((item,index)=>sourceDigests(item,path+'['+index+']',out,depth+1));return out;}if(typeof value==='object'){Object.keys(value).slice(0,100).forEach((key)=>{const item=value[key];if(/digest$/i.test(key)&&typeof item==='string'&&item&&!out.some((entry)=>entry.digest===item))out.push({path:path+'.'+key,digest:item});else sourceDigests(item,path+'.'+key,out,depth+1);});}return out;}
function artifactInventory(output){const artifacts=[],seen=new Set();
  function add(path,mime,format,digest,extra){if(!digest||seen.has(digest))return;seen.add(digest);artifacts.push(Object.assign({id:'upgrade-artifact-'+artifacts.length,path,mime,format,digest},extra||{}));}
  function walk(value,path,depth){if(value==null||depth>6||artifacts.length>=100)return;if(Array.isArray(value)){value.slice(0,100).forEach((item,index)=>walk(item,path+'['+index+']',depth+1));return;}if(typeof value!=='object')return;
    if(typeof value.svg==='string'&&/^<svg[\s>]/.test(value.svg))add(path+'.svg','image/svg+xml','SVG',U.sha256(value.svg),{text:value.svg});
    if(typeof value.text==='string'&&typeof value.mime==='string')add(path+'.text',value.mime,String(value.format||'TEXT'),U.sha256(value.text),{text:value.text});
    if(typeof value.base64==='string'&&typeof value.mime==='string'){const bytes=Buffer.from(value.base64,'base64');add(path+'.base64',value.mime,String(value.format||'BINARY'),U.sha256(bytes),{base64:value.base64,bytes:bytes.length});}
    if(typeof value.dataUrl==='string'&&typeof value.mime==='string'){const encoded=value.dataUrl.split(',')[1]||'',bytes=Buffer.from(encoded,'base64');add(path+'.dataUrl',value.mime,String(value.format||'BINARY'),U.sha256(bytes),{dataUrl:value.dataUrl,bytes:bytes.length});}
    Object.keys(value).slice(0,100).forEach((key)=>{const item=value[key];if(typeof item==='string'&&/_base64$/i.test(key)){const bytes=Buffer.from(item,'base64'),lower=key.toLowerCase(),mime=typeof value.mime==='string'?value.mime:lower.includes('dst')?'application/vnd.tajima.dst':lower.includes('wav')?'audio/wav':lower.includes('ump')?'application/vnd.midi2.ump':lower.includes('package')?'model/3mf':'application/octet-stream';add(path+'.'+key,mime,'BINARY',U.sha256(bytes),{base64:item,bytes:bytes.length});}else walk(item,path+'.'+key,depth+1);});
  }
  walk(output,'$output',0);add('$output','application/json','JSON',U.sha256(output),{role:'structured-result'});return artifacts;
}
function invoke(id, operation, args, rawRequest){
  const hand=DESCRIPTORS.find((item)=>item.id===id);
  U.ensure(hand,'unknown upgrade hand: '+id); U.ensure(hand.functions.includes(operation),'operation is not declared by '+id+': '+operation);
  const diagnosis=diagnose(rawRequest); U.ensure(diagnosis.status==='READY_CONTRACT','upgrade route is not executable: '+diagnosis.status+' '+diagnosis.missing.join(', '));
  U.ensure(diagnosis.selected_hand&&diagnosis.selected_hand.id===id,'request selected a different upgrade hand');
  const effective=effectiveArguments(args,diagnosis.request,hand,operation),evidenceArguments=argumentEvidence(effective),output=Modules[hand.module][operation].apply(null,effective);
  const invocation={schema:INVOCATION_SCHEMA,hand_id:id,hand_version:hand.version,operation,request_digest:U.sha256(diagnosis.request),target_canvas:clone(diagnosis.request.target_canvas),target_canvas_digest:U.sha256(diagnosis.request.target_canvas),effective_arguments_digest:U.sha256(evidenceArguments),constraint_paths:diagnosis.request.required_constraints.slice(),fallback_used:false};
  invocation.digest=U.sha256(invocation);
  const artifacts=artifactInventory(output),outputStatus=output&&typeof output==='object'&&typeof output.status==='string'?output.status:'EXECUTED',missingOutputArtifacts=diagnosis.request.required_outputs.filter((mime)=>!artifacts.some((item)=>item.mime===mime));
  const creationRecipe={schema:'axm.asset-creation-recipe/v1',format:INVOCATION_SCHEMA,hand:{id:hand.id,version:hand.version},operation_mode:operationMode(operation),source_artifact_digests:sourceDigests(evidenceArguments),seed:String(effective[0]&&effective[0].seed||''),target_canvas:clone(diagnosis.request.target_canvas),target_canvas_original:clone(diagnosis.request.target_canvas_original),canvas_transformations:diagnosis.request.target_canvas_validation.transformations.slice(),intended_use:diagnosis.request.intended_use,parameters:{arguments:evidenceArguments},steps:[{operation,module:hand.module,function:operation,invocation_digest:invocation.digest}],editable:hand.operations.edit,deterministic:hand.required_substrates.length===0&&![1,8].includes(hand.rank)};
  const productionPass=hand.acceptance_state==='READY'&&outputStatus==='PASS';
  const validationReceipt={schema:'axm.asset-validation-receipt/v1',status:productionPass&&missingOutputArtifacts.length===0?'PASS':'HOLD',validator:{id:'asset-hand-upgrade-registry',version:'1.1.0',capability:'canvas-bound-technical-execution'},target_canvas_digest:invocation.target_canvas_digest,artifact_digests:artifacts.map((item)=>({id:item.id,digest:item.digest,mime:item.mime})),checks:[{name:'operation-executed',pass:true},{name:'no-fallback',pass:true},{name:'required-output-artifacts',pass:missingOutputArtifacts.length===0,missing:missingOutputArtifacts.slice()},{name:'production-acceptance',pass:productionPass,observed_status:outputStatus,acceptance_state:hand.acceptance_state}],createdAt:String(rawRequest&&rawRequest.createdAt||'UNRECORDED')};
  const previewArtifact=artifacts.find((item)=>/^image\//.test(item.mime)||/^audio\//.test(item.mime)||/^video\//.test(item.mime))||null;
  const out={schema:RESULT_SCHEMA,status:'EXECUTED',delivery_status:missingOutputArtifacts.length?'OUTPUT_REQUIREMENTS_HOLD':'OUTPUT_REQUIREMENTS_SATISFIED',request:diagnosis.request,selected_hand:clone(hand),compatible_hands:diagnosis.compatible_hands,rejections:diagnosis.rejections,missing:missingOutputArtifacts.slice(),fallback_used:false,invocation,output,artifacts,creation_recipe:creationRecipe,preview:previewArtifact?{available:true,artifact_id:previewArtifact.id,mime:previewArtifact.mime}:null,validation_receipt:validationReceipt,provenance:{hand_id:hand.id,hand_version:hand.version,module:hand.module,operation,request_digest:invocation.request_digest,invocation_digest:invocation.digest}};
  out.digest=U.sha256(out); return out;
}
function audit(options){
  options=options&&typeof options==='object'?options:{};const available=new Set((options.available_substrates||[]).map(String));
  const items=DESCRIPTORS.map((hand)=>{const program=Program.upgrades.find((entry)=>entry.id===hand.id),missing=hand.required_substrates.filter((item)=>!available.has(item));return{hand_id:hand.id,rank:hand.rank,wave:hand.wave,title:hand.title,implementation_status:hand.implementation_status,acceptance_state:hand.acceptance_state,status:missing.length?'MISSING_SUBSTRATE':hand.acceptance_state==='READY'?'READY':'REVIEW_REQUIRED',gap_types:program.gap_types.slice(),missing_substrates:missing,required_substrates:hand.required_substrates.slice(),pass_condition:program.acceptance.pass_condition,primary_evidence:program.acceptance.primary_surface,counterevidence:program.acceptance.counterevidence};});
  const counts=items.reduce((out,item)=>{out[item.status]=(out[item.status]||0)+1;return out;},{});
  const report={schema:'axm.asset-hand-upgrade-audit/v1',version:'1.0.0',program_version:Program.version,total:items.length,counts,available_substrates:Array.from(available).sort(),items};report.digest=U.sha256(report);return report;
}

module.exports=Object.freeze({VERSION:'1.1.0',EXTENSION_SCHEMA,REQUEST_SCHEMA,RESULT_SCHEMA,INVOCATION_SCHEMA,list,get,normalizeRequest,diagnose,plan,invoke,audit});
