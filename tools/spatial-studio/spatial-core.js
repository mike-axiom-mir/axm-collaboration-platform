(function(root,factory){
  var api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.AXMSpatialCore=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  var FORMAT='axm.spatial.project/v1',VERSION=1;
  var MODES=[
    {id:'scene',group:'Build',short:'Scene',title:'Scene & Hierarchy',description:'Assemble one inspectable 3D scene from objects, groups, cameras and lights.'},
    {id:'model',group:'Build',short:'Model',title:'Model & Sculpt',description:'Edit parametric geometry and bounded deformation modifiers without destroying source recipes.'},
    {id:'surface',group:'Surface',short:'Surface',title:'UV & Materials',description:'Assign physically described local materials; texture baking remains an adapter route.'},
    {id:'rig',group:'Motion',short:'Rig',title:'Rig & Skin',description:'Build transform hierarchies and rig records while advanced mesh skinning stays explicitly unavailable.'},
    {id:'animate',group:'Motion',short:'Animate',title:'Spatial Animation',description:'Keyframe object transforms on the shared frame timeline and keep every value editable.'},
    {id:'simulate',group:'Simulate',short:'Simulate',title:'Particles & Physics',description:'Run bounded particle recipes and honest 2D physics projections; 3D fluids, cloth and hair require adapters.'},
    {id:'render',group:'Finish',short:'Render',title:'Lighting & Render',description:'Preview the actual scene through a local WebGL renderer and export current-frame proof.'},
    {id:'capture',group:'Capture',short:'Capture',title:'Photogrammetry & Voxels',description:'Record image-set manifests and paint real voxel cells; no reconstruction is claimed without a solver.'},
    {id:'templates',group:'Routes',short:'Templates',title:'Design Workspaces',description:'Start product, architecture, fashion, jewelry, landscape or vehicle work from templates—not new engines.'},
    {id:'deliver',group:'Deliver',short:'Deliver',title:'Export & Handoff',description:'Export the project, scene packet, OBJ geometry, frame proof or an unreviewed Publish record.'}
  ];
  var OBJECT_TYPES=['cube','sphere','cylinder','cone','plane','torus'];
  var KEY_PROPERTIES=['position.x','position.y','position.z','rotation.x','rotation.y','rotation.z','scale.x','scale.y','scale.z'];
  var TEMPLATE_NAMES=['product','architecture','fashion','jewelry','landscape','vehicle'];

  function now(){return new Date().toISOString();}
  function id(prefix){return(prefix||'item')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function text(v,max){var s=String(v==null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim();return max?s.slice(0,max):s;}
  function num(v,min,max,fallback){var n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function hex(v,fallback){return/^#[0-9a-f]{6}$/i.test(v)?v:fallback;}
  function vec3(v,fallback,min,max){v=Array.isArray(v)?v:[];fallback=fallback||[0,0,0];return[0,1,2].map(function(i){return num(v[i],min==null?-1e6:min,max==null?1e6:max,fallback[i]);});}
  function slug(v){return text(v,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'spatial';}

  function normalizeMaterial(m){m=m||{};return{id:text(m.id,100)||id('material'),name:text(m.name,120)||'Material',baseColor:hex(m.baseColor,'#38d6ec'),metallic:num(m.metallic,0,1,0),roughness:num(m.roughness,.02,1,.55),emissive:hex(m.emissive,'#000000'),opacity:num(m.opacity,0,1,1),doubleSided:!!m.doubleSided,source:text(m.source,500)||'local material recipe',createdAt:text(m.createdAt,40)||now()};}
  function normalizeObject(o){o=o||{};return{id:text(o.id,100)||id('object'),name:text(o.name,120)||'Object',type:OBJECT_TYPES.indexOf(o.type)>=0?o.type:'cube',parentId:text(o.parentId,100),position:vec3(o.position,[0,0,0]),rotation:vec3(o.rotation,[0,0,0],-36000,36000),scale:vec3(o.scale,[1,1,1],.001,10000),materialId:text(o.materialId,100),visible:o.visible!==false,locked:!!o.locked,castShadow:o.castShadow!==false,receiveShadow:o.receiveShadow!==false,geometry:{detail:Math.round(num(o.geometry&&o.geometry.detail,3,64,20)),inflate:num(o.geometry&&o.geometry.inflate,-.9,4,0),twist:num(o.geometry&&o.geometry.twist,-720,720,0),seed:Math.round(num(o.geometry&&o.geometry.seed,0,2147483647,1))},metadata:{domain:text(o.metadata&&o.metadata.domain,80),note:text(o.metadata&&o.metadata.note,1000)},createdAt:text(o.createdAt,40)||now()};}
  function normalizeLight(l){l=l||{};return{id:text(l.id,100)||id('light'),name:text(l.name,120)||'Light',type:['ambient','directional','point'].indexOf(l.type)>=0?l.type:'directional',color:hex(l.color,'#ffffff'),intensity:num(l.intensity,0,50,1),position:vec3(l.position,[4,7,6]),direction:vec3(l.direction,[-.5,-1,-.4],-1,1),enabled:l.enabled!==false};}
  function normalizeCamera(c){c=c||{};return{target:vec3(c.target,[0,1,0]),yaw:num(c.yaw,-10000,10000,35),pitch:num(c.pitch,-89,89,24),distance:num(c.distance,.2,100000,12),fov:num(c.fov,15,120,48),near:num(c.near,.001,1000,.1),far:num(c.far,1,1e7,1000)};}
  function normalizeKeyframe(k){k=k||{};return{id:text(k.id,100)||id('key'),objectId:text(k.objectId,100),property:KEY_PROPERTIES.indexOf(k.property)>=0?k.property:'position.x',frame:Math.round(num(k.frame,0,1e9,0)),value:num(k.value,-1e9,1e9,0),easing:['linear','hold','ease-in','ease-out','ease-in-out'].indexOf(k.easing)>=0?k.easing:'linear'};}
  function normalizeRig(r){r=r||{};return{id:text(r.id,100)||id('rig'),name:text(r.name,120)||'Rig',rootObjectId:text(r.rootObjectId,100),bones:(Array.isArray(r.bones)?r.bones:[]).map(function(b){return{id:text(b.id,100)||id('bone'),name:text(b.name,100)||'Bone',parentBoneId:text(b.parentBoneId,100),objectId:text(b.objectId,100),length:num(b.length,.001,1e6,1)};}).slice(0,500),skinAdapter:text(r.skinAdapter,100)||'UNAVAILABLE',createdAt:text(r.createdAt,40)||now()};}
  function normalizeEmitter(e){e=e||{};return{id:text(e.id,100)||id('emitter'),name:text(e.name,100)||'Emitter',objectId:text(e.objectId,100),count:Math.round(num(e.count,1,2000,80)),radius:num(e.radius,.01,1000,2),speed:num(e.speed,0,1000,1),seed:Math.round(num(e.seed,0,2147483647,1)),enabled:e.enabled!==false};}
  function normalizeVoxel(v){v=v||{};return{id:text(v.id,100)||id('voxel'),x:Math.round(num(v.x,-256,256,0)),y:Math.round(num(v.y,-256,256,0)),z:Math.round(num(v.z,-256,256,0)),size:num(v.size,.01,100,1),materialId:text(v.materialId,100),createdAt:text(v.createdAt,40)||now()};}
  function normalizeCapture(c){c=c||{};return{id:text(c.id,100)||id('capture'),name:text(c.name,140)||'Image set',imageCount:Math.round(num(c.imageCount,0,100000,0)),source:text(c.source,1000)||'local manifest',solverStatus:['UNAVAILABLE','PENDING','COMPLETE','FAILED'].indexOf(c.solverStatus)>=0?c.solverStatus:'UNAVAILABLE',evidence:(Array.isArray(c.evidence)?c.evidence:[]).map(function(x){return text(x,1000);}).filter(Boolean).slice(0,100),createdAt:text(c.createdAt,40)||now()};}

  function emptyProject(name){
    var material=normalizeMaterial({name:'AXM Cyan',baseColor:'#35d5e8',metallic:.12,roughness:.48});
    var ground=normalizeMaterial({name:'Ground',baseColor:'#17263a',metallic:0,roughness:.92});
    return{format:FORMAT,version:VERSION,id:id('spatial'),name:text(name,120)||'Untitled Spatial Project',fps:24,durationFrames:240,createdAt:now(),updatedAt:now(),materials:[material,ground],objects:[normalizeObject({name:'Ground',type:'plane',position:[0,0,0],scale:[8,1,8],materialId:ground.id,locked:true}),normalizeObject({name:'Hero Form',type:'cube',position:[0,1,0],scale:[1.5,1.5,1.5],rotation:[0,25,0],materialId:material.id})],lights:[normalizeLight({name:'Ambient',type:'ambient',intensity:.32}),normalizeLight({name:'Key',type:'directional',intensity:1.4,position:[5,8,6],direction:[-.5,-1,-.6]})],camera:normalizeCamera(),keyframes:[],rigs:[],emitters:[],voxels:[],captures:[],simulationReceipts:[],renderReceipts:[],exports:[],assetHandImports:[],template:'blank'};
  }
  function normalizeProject(p){
    p=p||{};if(p.format&&p.format!==FORMAT)throw Error('unsupported Spatial project format');
    var out={format:FORMAT,version:VERSION,id:text(p.id,100)||id('spatial'),name:text(p.name,120)||'Untitled Spatial Project',fps:Math.round(num(p.fps,1,240,24)),durationFrames:Math.round(num(p.durationFrames,1,1e9,240)),createdAt:text(p.createdAt,40)||now(),updatedAt:text(p.updatedAt,40)||now(),materials:(Array.isArray(p.materials)?p.materials:[]).map(normalizeMaterial).slice(0,1000),objects:(Array.isArray(p.objects)?p.objects:[]).map(normalizeObject).slice(0,10000),lights:(Array.isArray(p.lights)?p.lights:[]).map(normalizeLight).slice(0,100),camera:normalizeCamera(p.camera),keyframes:(Array.isArray(p.keyframes)?p.keyframes:[]).map(normalizeKeyframe).slice(0,100000),rigs:(Array.isArray(p.rigs)?p.rigs:[]).map(normalizeRig).slice(0,1000),emitters:(Array.isArray(p.emitters)?p.emitters:[]).map(normalizeEmitter).slice(0,1000),voxels:(Array.isArray(p.voxels)?p.voxels:[]).map(normalizeVoxel).slice(0,20000),captures:(Array.isArray(p.captures)?p.captures:[]).map(normalizeCapture).slice(0,1000),simulationReceipts:Array.isArray(p.simulationReceipts)?p.simulationReceipts.slice(0,5000):[],renderReceipts:Array.isArray(p.renderReceipts)?p.renderReceipts.slice(0,5000):[],exports:Array.isArray(p.exports)?p.exports.slice(0,5000):[],assetHandImports:Array.isArray(p.assetHandImports)?p.assetHandImports.map(clone).slice(0,5000):[],template:TEMPLATE_NAMES.indexOf(p.template)>=0?p.template:'blank'};
    if(!out.materials.length)out.materials.push(normalizeMaterial({name:'Default'}));
    out.objects.forEach(function(o){if(!out.materials.some(function(m){return m.id===o.materialId;}))o.materialId=out.materials[0].id;if(o.parentId&&!out.objects.some(function(x){return x.id===o.parentId;}))o.parentId='';});
    return out;
  }

  function addObject(p,input){var o=normalizeObject(input);if(!o.materialId)o.materialId=p.materials[0]&&p.materials[0].id;if(o.parentId&&!p.objects.some(function(x){return x.id===o.parentId;}))throw Error('parent object not found');p.objects.push(o);p.updatedAt=now();return o;}
  function removeObject(p,objectId){var remove=[objectId],changed=true;while(changed){changed=false;p.objects.forEach(function(o){if(remove.indexOf(o.parentId)>=0&&remove.indexOf(o.id)<0){remove.push(o.id);changed=true;}});}p.objects=p.objects.filter(function(o){return remove.indexOf(o.id)<0;});p.keyframes=p.keyframes.filter(function(k){return remove.indexOf(k.objectId)<0;});p.emitters=p.emitters.filter(function(e){return remove.indexOf(e.objectId)<0;});p.updatedAt=now();return remove;}
  function transformObject(p,objectId,patch){var o=p.objects.find(function(x){return x.id===objectId;});if(!o)throw Error('object not found');if(o.locked)throw Error('object is locked');patch=patch||{};if(patch.position)o.position=vec3(patch.position,o.position);if(patch.rotation)o.rotation=vec3(patch.rotation,o.rotation,-36000,36000);if(patch.scale)o.scale=vec3(patch.scale,o.scale,.001,10000);if(patch.geometry)o.geometry=normalizeObject({geometry:Object.assign({},o.geometry,patch.geometry)}).geometry;if('parentId'in patch){if(patch.parentId===o.id)throw Error('object cannot parent itself');if(patch.parentId&&!p.objects.some(function(x){return x.id===patch.parentId;}))throw Error('parent object not found');o.parentId=text(patch.parentId,100);}p.updatedAt=now();return o;}
  function addMaterial(p,input){var m=normalizeMaterial(input);p.materials.push(m);p.updatedAt=now();return m;}
  function assignMaterial(p,objectId,materialId){var o=p.objects.find(function(x){return x.id===objectId;}),m=p.materials.find(function(x){return x.id===materialId;});if(!o||!m)throw Error('object and material are required');o.materialId=m.id;p.updatedAt=now();return o;}
  function setKeyframe(p,input){var k=normalizeKeyframe(input);if(!p.objects.some(function(o){return o.id===k.objectId;}))throw Error('keyframe object not found');p.keyframes=p.keyframes.filter(function(x){return!(x.objectId===k.objectId&&x.property===k.property&&x.frame===k.frame);});p.keyframes.push(k);p.durationFrames=Math.max(p.durationFrames,k.frame);p.updatedAt=now();return k;}
  function valueAt(p,objectId,property,frame,fallback){var keys=p.keyframes.filter(function(k){return k.objectId===objectId&&k.property===property;}).sort(function(a,b){return a.frame-b.frame;});if(!keys.length)return fallback;if(frame<=keys[0].frame)return keys[0].value;if(frame>=keys[keys.length-1].frame)return keys[keys.length-1].value;for(var i=0;i<keys.length-1;i++){var a=keys[i],b=keys[i+1];if(frame>=a.frame&&frame<=b.frame){if(a.easing==='hold')return a.value;var t=(frame-a.frame)/(b.frame-a.frame);if(a.easing==='ease-in')t*=t;if(a.easing==='ease-out')t=1-(1-t)*(1-t);if(a.easing==='ease-in-out')t=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;return a.value+(b.value-a.value)*t;}}return fallback;}
  function poseAt(p,frame){var out=clone(p);out.objects.forEach(function(o){['position','rotation','scale'].forEach(function(group){['x','y','z'].forEach(function(axis,index){var prop=group+'.'+axis;o[group][index]=valueAt(p,o.id,prop,frame,o[group][index]);});});});return out;}
  function addRig(p,input){var r=normalizeRig(input);if(r.rootObjectId&&!p.objects.some(function(o){return o.id===r.rootObjectId;}))throw Error('rig root object not found');p.rigs.push(r);p.updatedAt=now();return r;}
  function addEmitter(p,input){var e=normalizeEmitter(input);if(e.objectId&&!p.objects.some(function(o){return o.id===e.objectId;}))throw Error('emitter object not found');p.emitters.push(e);p.updatedAt=now();return e;}
  function addVoxel(p,input){var v=normalizeVoxel(input);var old=p.voxels.find(function(x){return x.x===v.x&&x.y===v.y&&x.z===v.z;});if(old)return old;p.voxels.push(v);p.updatedAt=now();return v;}
  function recordCapture(p,input){var c=normalizeCapture(input);p.captures.push(c);p.updatedAt=now();return c;}

  function templateProject(name){
    if(TEMPLATE_NAMES.indexOf(name)<0)throw Error('unknown Spatial template');
    var p=emptyProject(name.charAt(0).toUpperCase()+name.slice(1)+' Study');p.objects=[];p.template=name;var cyan=p.materials[0].id,ground=p.materials[1].id;
    function add(n,t,pos,scale,rot,mat){return addObject(p,{name:n,type:t,position:pos,scale:scale,rotation:rot||[0,0,0],materialId:mat||cyan,metadata:{domain:name}});}
    add('Ground','plane',[0,0,0],[10,1,10],[0,0,0],ground);
    if(name==='product'){add('Product body','cube',[0,1.1,0],[2.2,1.1,1.4],[0,28,0]);add('Control ring','torus',[0,1.3,1.45],[.5,.5,.5],[90,0,0]);}
    if(name==='architecture'){add('Floor plate','cube',[0,.15,0],[5,.15,4]);add('North wall','cube',[0,1.7,-3.8],[5,1.7,.2]);add('West wall','cube',[-4.8,1.7,0],[.2,1.7,4]);add('Tower','cube',[1.6,2.2,.5],[1.2,2.2,1.2]);}
    if(name==='fashion'){add('Torso','cylinder',[0,2,0],[.8,1.3,.55]);add('Head','sphere',[0,3.7,0],[.55,.55,.55]);add('Skirt volume','cone',[0,.8,0],[1.5,1.5,1.5],[0,0,180]);}
    if(name==='jewelry'){add('Ring','torus',[0,1.5,0],[1.8,1.8,1.8],[90,0,0]);add('Setting','cylinder',[0,2.4,0],[.45,.3,.45]);add('Stone','sphere',[0,2.85,0],[.55,.7,.55]);}
    if(name==='landscape'){for(var i=0;i<7;i++)add('Land mass '+(i+1),'sphere',[(i%4-1.5)*2.5,.2+((i*17)%5)*.12,(Math.floor(i/4)-.5)*3],[2.1,.45,1.8],[0,i*23,0]);for(var j=0;j<8;j++)add('Tree '+(j+1),'cone',[(j%4-1.5)*2.1,1.1,(Math.floor(j/4)-.5)*3.4],[.45,1.1,.45]);}
    if(name==='vehicle'){add('Chassis','cube',[0,1,0],[2.8,.55,1.35]);add('Cabin','cube',[-.35,1.9,0],[1.25,.65,1.15],[0,0,-4]);[-1.8,1.8].forEach(function(x){[-1.25,1.25].forEach(function(z){add('Wheel','torus',[x,.55,z],[.55,.55,.55],[0,90,0]);});});}
    p.updatedAt=now();return p;
  }

  function summary(p){return{objects:p.objects.length,materials:p.materials.length,lights:p.lights.filter(function(l){return l.enabled;}).length,keyframes:p.keyframes.length,rigs:p.rigs.length,emitters:p.emitters.length,voxels:p.voxels.length,captures:p.captures.length,trianglesEstimate:p.objects.reduce(function(n,o){var d=o.geometry.detail;return n+(o.type==='sphere'||o.type==='torus'?d*d*2:o.type==='cylinder'||o.type==='cone'?d*4:o.type==='plane'?2:12);},0)};}
  function scenePacket(p){return{schema:'axm.spatial.scene/v1',projectId:p.id,name:p.name,units:'metres',coordinateSystem:'right-handed-y-up',objects:clone(p.objects),materials:clone(p.materials),lights:clone(p.lights),camera:clone(p.camera),voxels:clone(p.voxels),template:p.template,truth:{geometry:'parametric recipes',textures:'not embedded',physics:'simulation receipts are separate evidence, not baked scene truth'}};}
  function publishPacket(p,input){input=input||{};return{schema:'axm.publish-artifact/v1',type:'axm-publish-artifact',artifact:{name:text(input.name,160)||p.name,source:'Spatial Studio',format:text(input.format,80)||'Spatial project',version:text(input.version,40)||'0.1.0',license:text(input.license,200)||'Rights review required',provenance:'AXM Spatial project '+p.id+' · '+text(input.provenance,1500),state:'INBOX'}};}

  function importAssetHandResult(current,result){
    if(!result||result.schema!=='axm.asset-hand-result/v1')throw Error('Asset Hand result schema required');
    if(!result.technical||result.technical.pass!==true||result.status!=='READY')throw Error('Asset Hand result is not technically ready');
    if(!result.validation_receipt||result.validation_receipt.status!=='PASS')throw Error('Asset Hand validation receipt must pass');
    if(!result.hand||!result.hand.id||!result.hand.version)throw Error('Asset Hand identity is required');
    if(!result.target_canvas||result.target_canvas.schema!=='axm.target-canvas/v1'||!result.target_canvas_original||typeof result.target_canvas_original!=='object'||(result.target_canvas_original.schema&&result.target_canvas_original.schema!=='axm.target-canvas/v1'))throw Error('original and effective target canvases are required');
    if(!result.creation_recipe||result.creation_recipe.schema!=='axm.asset-creation-recipe/v1')throw Error('machine-readable creation recipe is required');
    if(!Array.isArray(result.artifacts)||!result.artifacts.length)throw Error('Asset Hand artifacts are required');
    var spatialArtifact=result.artifacts.find(function(a){return a&&a.mime==='application/json'&&a.format==='JSON'&&a.metadata&&a.metadata.schema===FORMAT&&a.editable===true;});
    var materialArtifact=result.artifacts.find(function(a){return a&&a.mime==='application/json'&&a.format==='JSON'&&a.metadata&&a.metadata.schema==='axm.material-graph/v1'&&a.editable===true;});
    if(!spatialArtifact&&!materialArtifact)throw Error('No editable Spatial project or material graph is available');
    var action,artifact,project;
    if(spatialArtifact){
      artifact=spatialArtifact;
      var parsedProject;try{parsedProject=JSON.parse(artifact.text);}catch(error){throw Error('Spatial project artifact is not valid JSON');}
      if(parsedProject.format!==FORMAT)throw Error('Spatial project artifact format mismatch');
      project=normalizeProject(parsedProject);action='replace-project';
    }else{
      artifact=materialArtifact;
      var graph;try{graph=JSON.parse(artifact.text);}catch(error){throw Error('Material graph artifact is not valid JSON');}
      if(graph.schema!=='axm.material-graph/v1'||!graph.parameters)throw Error('Material graph schema mismatch');
      project=normalizeProject(current);
      addMaterial(project,{name:graph.name||result.brief&&result.brief.title||'Imported material',baseColor:graph.parameters.base_color_hex,metallic:graph.parameters.metallic,roughness:graph.parameters.roughness,opacity:graph.parameters.opacity,source:'Asset Hand '+result.hand.id+' '+result.hand.version+' · '+result.digest});
      action='add-material';
    }
    var receipt={schema:'axm.spatial.asset-hand-import/v1',action:action,resultId:result.id,resultDigest:result.digest,hand:{id:result.hand.id,version:result.hand.version,contract:result.hand.schema||null},artifact:{id:artifact.id,digest:artifact.digest,mime:artifact.mime,format:artifact.format,contentSchema:artifact.metadata&&artifact.metadata.schema||null},artifactInventory:result.artifacts.map(function(item){return{id:item.id,role:item.role,mime:item.mime,format:item.format,digest:item.digest,editable:item.editable,contentSchema:item.metadata&&item.metadata.schema||null};}),targetCanvas:clone(result.target_canvas),targetCanvasOriginal:clone(result.target_canvas_original),targetCanvasValidation:clone(result.brief&&result.brief.target_canvas_validation||null),canvasTransformReceipt:clone(result.canvas_transform_receipt||null),fallbackPolicy:clone(result.brief&&result.brief.fallback_policy||null),creationRecipe:clone(result.creation_recipe),validationReceipt:clone(result.validation_receipt),importedAt:now()};
    project.assetHandImports.push(receipt);project.updatedAt=now();
    return{action:action,project:project,receipt:receipt};
  }

  return{FORMAT:FORMAT,VERSION:VERSION,MODES:MODES,OBJECT_TYPES:OBJECT_TYPES,KEY_PROPERTIES:KEY_PROPERTIES,TEMPLATE_NAMES:TEMPLATE_NAMES,emptyProject:emptyProject,normalizeProject:normalizeProject,normalizeObject:normalizeObject,normalizeMaterial:normalizeMaterial,normalizeLight:normalizeLight,normalizeKeyframe:normalizeKeyframe,normalizeRig:normalizeRig,normalizeEmitter:normalizeEmitter,normalizeVoxel:normalizeVoxel,normalizeCapture:normalizeCapture,addObject:addObject,removeObject:removeObject,transformObject:transformObject,addMaterial:addMaterial,assignMaterial:assignMaterial,setKeyframe:setKeyframe,valueAt:valueAt,poseAt:poseAt,addRig:addRig,addEmitter:addEmitter,addVoxel:addVoxel,recordCapture:recordCapture,templateProject:templateProject,summary:summary,scenePacket:scenePacket,publishPacket:publishPacket,importAssetHandResult:importAssetHandResult,id:id,now:now,clone:clone,slug:slug};
});
