(function () {
  'use strict';

  var Foundry = window.AXMWorldTileFoundry;
  var BLANK_SOURCE_URL = 'sources/blank-10000x10000/world-source.json';
  var BLANK_RASTER_URL = 'sources/blank-10000x10000/raster-manifest.json';
  var CITY_SOURCE_URL = '../game-hub/game-library/008-district-party/exports/tilburg-authored-city-world-tile-source/world-source.json';
  var CITY_RASTER_URL = '../game-hub/game-library/008-district-party/exports/tilburg-authored-city-alpha-raster/raster-manifest.json';
  var WORKSPACE_ID = new URLSearchParams(location.search).get('workspace') || 'main';
  var STORAGE_KEY = 'axm.world-tile-foundry.explicit-draft/v1/' + WORKSPACE_ID;
  var COLORS = {ground:'#7c9b84',road:'#ffc65a',sidewalk:'#d9d0b5',building:'#e28468',park:'#5fd38a',water:'#52b8ff',rail:'#d587ff'};
  var state = {
    source:null, chunks:[], baseFeatures:[], features:[], raster:null, tileBase:'', tiles:new Map(),
    project:null, selectedId:'', mode:'select', layerVisible:{}, overlay:true, canvasMode:'flat2d', referenceItem:'crate', frameTheme:'nature',
    scale:0.08, offsetX:0, offsetY:0, dragging:false, dragStart:null, pointerStart:null, drawPreview:null
  };
  var el = {};

  function byId(id){ return document.getElementById(id); }
  function setStatus(message, good){ el.footerStatus.textContent=message; if(good!=null){ el.sourceStatus.classList.toggle('ready',!!good); } }
  function baseDir(url){ return new URL('.', new URL(url, location.href)).href; }
  function fetchJson(url){ return fetch(url,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error(r.status+' '+url); return r.json(); }); }
  function download(name, value){ var blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},500); }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
  function displayName(value){ return String(value||'').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}); }
  function currentFeature(){ return state.features.find(function(f){return f.id===state.selectedId;})||null; }
  function originalFeature(id){ return state.baseFeatures.find(function(f){return f.id===id;})||null; }

  function registerElements(){
    ['worldCanvas','canvasWrap','loadingOverlay','newProjectButton','loadDefaultButton','loadCityButton','packageInput','sourceStatus','featureCount','layerList','overlayToggle','projectName','canvasMode','referenceItem','worldShape','worldWidth','worldDepth','sectorSize','loadingChunkSize','playableHeight','reservedHeight','playableDepthLayers','reservedDepthLayers','polygonPoints','applyGridProfileButton','frameTheme','farmButton','remapList','fitButton','coordinateReadout','revisionLabel','selectionTitle','selectionMeta','materialInput','roleInput','layerInput','priorityInput','elevationInput','heightInput','walkableInput','collidableInput','applyFeatureButton','restoreFeatureButton','removeFeatureButton','drawLayer','drawMaterial','drawRole','changeSummary','saveDraftButton','loadDraftButton','downloadProjectButton','downloadHandoffButton','downloadComponentButton','projectInput','footerStatus'].forEach(function(id){el[id]=byId(id);});
    el.ctx=el.worldCanvas.getContext('2d');
  }

  async function loadBuiltIn(sourceUrl,rasterUrl,label){
    showLoading(true); setStatus('Loading '+label+'…');
    try{
      var source=await fetchJson(sourceUrl);
      var chunks=await Promise.all(source.chunking.chunks.map(function(entry){return fetchJson(new URL(entry.file,baseDir(sourceUrl)).href);}));
      var raster=await fetchJson(rasterUrl);
      state.localTileUrls=null;
      installSource(source,chunks,raster,baseDir(rasterUrl));
      setStatus(source.contentPolicy&&source.contentPolicy.transparentSubstrateOnly?('Ready · '+((source.chunking.possibleCount!=null?source.chunking.possibleCount:source.chunking.count)).toLocaleString()+' virtual loading chunks · '+source.chunking.count.toLocaleString()+' stored · '+((source.creativeGrid&&source.creativeGrid.count)||0).toLocaleString()+' authoring sectors'):('Reference ready · '+state.baseFeatures.length.toLocaleString()+' authored features'),true);
    }catch(error){ fail(error); }
  }

  function loadDefault(){return loadBuiltIn(BLANK_SOURCE_URL,BLANK_RASTER_URL,'verified blank world');}
  function loadCity(){return loadBuiltIn(CITY_SOURCE_URL,CITY_RASTER_URL,'optional Tilburg reference');}

  function installSource(source,chunks,raster,tileBase){
    var checked=Foundry.validateSource(source); if(!checked.ok) throw new Error(checked.errors.join('; '));
    state.source=source; state.chunks=chunks; state.baseFeatures=Foundry.flattenChunks(source,chunks); state.raster=raster||null; state.tileBase=tileBase||''; state.tiles.clear();
    var spatialOption=el.canvasMode.querySelector('option[value="spatial3d"]'),spatialReady=!!(source.canvasModes&&source.canvasModes.spatial3d&&source.canvasModes.spatial3d.enabled);spatialOption.disabled=!spatialReady;if(!spatialReady&&state.canvasMode==='spatial3d'){state.canvasMode='flat2d';el.canvasMode.value='flat2d';}
    state.project=Foundry.createProject(source,el.projectName.value); state.selectedId='';
    Foundry.LAYERS.forEach(function(layer){state.layerVisible[layer]=true;});
    rebuildFeatures(); renderLayerControls(); renderRemaps(); renderSelection(); fitWorld(); updateSummary(); showLoading(false);
    el.sourceStatus.textContent=source.id+'\nworkspace '+WORKSPACE_ID+' · '+state.baseFeatures.length.toLocaleString()+' features · '+source.world.width.toLocaleString()+' × '+source.world.height.toLocaleString()+' '+(source.world.canonicalUnit||'units');
  }

  async function loadPackage(files){
    if(!files.length) return;
    showLoading(true); setStatus('Reading local world package…');
    try{
      var list=Array.from(files), find=function(suffix){return list.find(function(file){return file.webkitRelativePath.replace(/\\/g,'/').endsWith(suffix);});};
      var sourceFile=find('/world-source.json')||find('world-source.json'); if(!sourceFile) throw new Error('Package needs world-source.json');
      var source=JSON.parse(await sourceFile.text());
      var chunks=[];
      for(var i=0;i<source.chunking.chunks.length;i++){
        var expected=source.chunking.chunks[i].file.replace(/\\/g,'/'), file=find('/'+expected)||find(expected); if(!file) throw new Error('Missing '+expected); chunks.push(JSON.parse(await file.text()));
      }
      var rasterFile=find('/raster-manifest.json')||find('raster-manifest.json'), raster=rasterFile?JSON.parse(await rasterFile.text()):null;
      var objectUrls=new Map();
      list.forEach(function(file){ if(/\/tiles\/tile-\d\d-\d\d\.png$/i.test('/'+file.webkitRelativePath.replace(/\\/g,'/'))) objectUrls.set(file.name,URL.createObjectURL(file)); });
      installSource(source,chunks,raster,''); state.localTileUrls=objectUrls; setStatus('Local package ready · source digests preserved',true);
    }catch(error){ fail(error); }
  }

  function fail(error){ console.error(error); showLoading(false); setStatus('Blocked: '+error.message,false); el.sourceStatus.textContent='Could not open source: '+error.message; }
  function showLoading(show){el.loadingOverlay.classList.toggle('hidden',!show);}
  function rebuildFeatures(){ state.features=Foundry.applyProject(state.baseFeatures,state.project); if(state.selectedId&&!currentFeature()) state.selectedId=''; requestDraw(); updateSummary(); }

  function renderLayerControls(){
    var counts={}; Foundry.LAYERS.forEach(function(l){counts[l]=0;}); state.baseFeatures.forEach(function(f){counts[f.layer]++;});
    el.featureCount.textContent=state.baseFeatures.length.toLocaleString()+' features'; el.layerList.innerHTML=''; el.layerInput.innerHTML=''; el.drawLayer.innerHTML='';
    Foundry.LAYERS.forEach(function(layer){
      var row=document.createElement('label'); row.className='layer-row'; row.innerHTML='<input type="checkbox" checked data-layer="'+layer+'"><i class="layer-swatch" style="background:'+COLORS[layer]+'"></i><span><strong>'+layer+'</strong><br><small>'+counts[layer].toLocaleString()+' features</small></span>'; el.layerList.appendChild(row);
      [el.layerInput,el.drawLayer].forEach(function(select){var option=document.createElement('option'); option.value=layer; option.textContent=displayName(layer); select.appendChild(option);});
    });
    el.layerList.querySelectorAll('input').forEach(function(input){input.addEventListener('change',function(){state.layerVisible[input.dataset.layer]=input.checked;requestDraw();});});
    el.drawLayer.value='ground';
  }

  function renderRemaps(){
    el.remapList.innerHTML=''; Foundry.LAYERS.forEach(function(layer){
      var label=document.createElement('label'); label.className='field'; label.innerHTML='<span>'+layer+'</span><input data-remap="'+layer+'" value="'+escapeHtml(state.project.materialRemaps[layer]||'')+'" placeholder="keep source material">'; el.remapList.appendChild(label);
    });
    el.remapList.querySelectorAll('input').forEach(function(input){input.addEventListener('change',function(){state.project=Foundry.setMaterialRemap(state.project,input.dataset.remap,input.value);rebuildFeatures();renderRevision();});});
  }
  function escapeHtml(value){return String(value).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function renderSelection(){
    var feature=currentFeature(), enabled=!!feature;
    [el.materialInput,el.roleInput,el.priorityInput,el.elevationInput,el.heightInput,el.walkableInput,el.collidableInput,el.applyFeatureButton,el.restoreFeatureButton,el.removeFeatureButton].forEach(function(node){node.disabled=!enabled;});
    if(!feature){el.selectionTitle.textContent='Select a feature';el.selectionMeta.textContent='Click a semantic shape to inspect its gameplay meaning.';el.layerInput.disabled=true;return;}
    el.selectionTitle.textContent=displayName(feature.layer)+' · '+feature.id; el.selectionMeta.textContent='World rect '+Math.round(feature.geometry.world.x)+', '+Math.round(feature.geometry.world.y)+' · '+Math.round(feature.geometry.world.width)+' × '+Math.round(feature.geometry.world.height)+' · '+displayName(feature.editState);
    el.materialInput.value=feature.material||'';el.roleInput.value=feature.role||'';el.layerInput.value=feature.layer;el.layerInput.disabled=true;el.priorityInput.value=feature.navigationPriority;el.elevationInput.value=Number(feature.elevationMetres||0);el.heightInput.value=Number(feature.heightMetres||0);el.walkableInput.checked=feature.walkable;el.collidableInput.checked=feature.collidable;
  }

  function renderRevision(){el.revisionLabel.textContent='Revision '+state.project.revision;}
  function updateSummary(){
    if(!state.project) return;
    var r=Object.keys(state.project.materialRemaps).length,o=Object.keys(state.project.overrides).length,a=state.project.additions.length,d=state.project.removedFeatureIds.length;
    el.changeSummary.textContent=(r+o+a+d===0)?'No changes yet.':r+' layer remaps\n'+o+' feature overrides\n'+a+' additions · '+d+' removals'; renderRevision();
  }

  function applyFeature(){var f=currentFeature();if(!f)return;state.project=Foundry.setOverride(state.project,f.id,{material:el.materialInput.value,role:el.roleInput.value,walkable:el.walkableInput.checked,collidable:el.collidableInput.checked,navigationPriority:Number(el.priorityInput.value),elevationMetres:Number(el.elevationInput.value||0),heightMetres:Number(el.heightInput.value||0)});rebuildFeatures();renderSelection();setStatus('Feature change stored in patch · source unchanged');}
  function restoreFeature(){if(!state.selectedId)return;state.project=Foundry.restoreFeature(state.project,state.selectedId);rebuildFeatures();renderSelection();setStatus('Feature restored from verified source');}
  function removeFeature(){if(!state.selectedId)return;state.project=Foundry.removeFeature(state.project,state.selectedId);state.selectedId='';rebuildFeatures();renderSelection();setStatus('Feature hidden by patch · source unchanged');}
  function applyFarm(){state.project=Foundry.farmStarter(state.project);rebuildFeatures();renderRemaps();setStatus('Farm starter applied · still an editable draft');}

  function newGameBuild(){
    var id='game-'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14),url=new URL(location.href);
    url.searchParams.set('workspace',id);
    window.open(url.href,'_blank','noopener');
    setStatus('New isolated game build opened · this workspace remains '+WORKSPACE_ID);
  }
  function boundedNumber(input,min,max,label){var value=Number(input.value);if(!Number.isFinite(value)||value<min||value>max)throw new Error(label+' must be between '+min.toLocaleString()+' and '+max.toLocaleString());return value;}
  function normalizedPolygon(textValue){
    var points=String(textValue||'').split(';').map(function(pair){var values=pair.split(',').map(Number);return{x:values[0],y:values[1]};});
    if(points.length<3||points.some(function(point){return !Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1;}))throw new Error('custom polygon needs at least three normalized x,y points between 0 and 1');
    return points;
  }
  async function applyGridProfile(){
    try{
      var width=boundedNumber(el.worldWidth,100,1000000,'width'),depth=boundedNumber(el.worldDepth,100,1000000,'depth'),sector=boundedNumber(el.sectorSize,1,Math.max(width,depth),'sector size'),chunk=boundedNumber(el.loadingChunkSize,10,Math.max(width,depth),'loading chunk size'),playable=boundedNumber(el.playableHeight,.5,10000,'playable height'),reserved=boundedNumber(el.reservedHeight,playable,100000,'reserved height'),playableDepth=Math.round(boundedNumber(el.playableDepthLayers,1,10000,'playable underground layers')),reservedDepth=Math.round(boundedNumber(el.reservedDepthLayers,playableDepth,100000,'reserved underground layers')),shape=el.worldShape.value,boundary=Math.min(100,width/20,depth/20),innerW=width-boundary*2,innerD=depth-boundary*2,buildRegion;
      if(shape==='circle'){var diameter=Math.min(innerW,innerD);buildRegion={shape:'circle',x:(width-diameter)/2,y:(depth-diameter)/2,width:diameter,height:diameter,centerX:width/2,centerY:depth/2,radius:diameter/2,boundaryWidth:boundary,buildable:true};}
      else if(shape==='hexagon'||shape==='polygon'){var normalized=shape==='hexagon'?[{x:.25,y:.01},{x:.75,y:.01},{x:.99,y:.5},{x:.75,y:.99},{x:.25,y:.99},{x:.01,y:.5}]:normalizedPolygon(el.polygonPoints.value),points=normalized.map(function(point){return{x:boundary+point.x*innerW,y:boundary+point.y*innerD};});buildRegion={shape:'polygon',x:boundary,y:boundary,width:innerW,height:innerD,points:points,boundaryWidth:boundary,buildable:true};}
      else buildRegion={shape:'rounded-rect',x:boundary,y:boundary,width:innerW,height:innerD,radius:shape==='rectangle'?0:Math.min(innerW,innerD)*.1,boundaryWidth:boundary,buildable:true};
      var config={width:width,depth:depth,sector:sector,chunk:chunk,playable:playable,reserved:reserved,shape:shape,buildRegion:buildRegion},semanticDigest=await sha256('semantic:'+Foundry.stable(config)),rasterDigest=await sha256('raster:'+Foundry.stable(config)),columns=Math.ceil(width/chunk),rows=Math.ceil(depth/chunk),sectorColumns=Math.ceil(width/sector),sectorRows=Math.ceil(depth/sector),source={
        schema:'axm-neutral-world-tile-source/v1',id:'axm-sparse-world-'+semanticDigest.slice(0,12),purpose:'User-shaped sparse world. Unchanged space remains implicit and consumes no chunk files.',
        world:{width:width,height:depth,origin:'north-west',xAxis:'east',yAxis:'south',canonicalUnit:'metre',unitsPerRasterPixel:1},
        canvasModes:{flat2d:{enabled:true,assetCellPixels:{width:128,height:128},footprintMetres:{width:1,depth:1},pixelsPerMetre:128,note:'Art is streamed; world size does not allocate a monolithic bitmap.'},spatial3d:{enabled:true,placementCellMetres:{width:1,depth:1,height:.5},authoringSectorMetres:{width:sector,depth:sector,playableDepthLayers:playableDepth,reservedDepthLayers:reservedDepth,playableHeight:playable,reservedHeight:reserved},heightPolicyMetres:{reservedMinimum:reservedDepth*-.5,playableMinimum:playableDepth*-.5,ground:0,playableMaximum:playable,reservedMaximum:reserved,step:.5},axes:{x:'east',y:'up',z:'south'},interchange:{gltfAndGodotScale:1,unrealCentimetreScale:100}}},
        scaleReferences:{crate:{footprintMetres:{width:1,depth:1},heightMetres:1,flatPixelsAtNativeScale:{width:128,height:128}},adultHuman:{footprintMetres:{width:.6,depth:.6},heightMetres:1.8,flatFootprintPixelsAtNativeScale:{width:77,height:77}}},
        creativeGrid:{role:'authoring-sector',cellWidth:sector,cellHeight:sector,unit:'metre',columns:sectorColumns,rows:sectorRows,count:sectorColumns*sectorRows},buildRegion:buildRegion,
        chunking:{width:chunk,height:chunk,columns:columns,rows:rows,possibleCount:columns*rows,materializedCount:0,count:0,implicitEmpty:true,chunks:[]},layers:{included:Foundry.LAYERS.slice(),totals:Object.fromEntries(Foundry.LAYERS.map(function(layer){return[layer,0];}))},semanticChunksSha256:semanticDigest,
        rasterAlignment:{manifest:'virtual',masterSha256:rasterDigest,width:width,height:depth,note:'Transparent substrate is virtual; only authored artifacts materialize.'},contentPolicy:{transparentSubstrateOnly:true,authoredPixelsIncluded:false,authoredSemanticFeaturesIncluded:false,runtimeStateIncluded:false},streamingPolicy:{strategy:'vision-window-chunk-streaming',loadingUnit:{width:chunk,height:chunk},recommendedSafetyRingChunks:1,fogOfWar:'consumer-owned visibility state; never source deletion',unloadedChunkMeaning:'implicit empty or not rendered; canonical authored state remains intact',persistence:'materialize authored chunks only'},assetPolicy:'Locally authored sparse world profile; no external asset or licence.',provenance:{originType:'authored',sourceId:'world-tile-foundry.grid-profile',createdBy:'Mike + AXM local builders',licenseId:'AXM-LOCAL'}
      },raster={schema:'axm-transparent-world-raster/v1',id:source.id,world:source.world,tileSize:{width:chunk,height:chunk},grid:{columns:columns,rows:rows,possibleCount:columns*rows,materializedCount:0,count:0,implicitEmpty:true,authoringSectorMetres:sector,authoringSectorCount:sectorColumns*sectorRows,flatAssetCellPixels:128},contentPolicy:source.contentPolicy,coverageSha256:rasterDigest,tiles:[]};
      installSource(source,[],raster,'');setStatus('Custom sparse '+shape+' ready · '+(columns*rows).toLocaleString()+' possible chunks · 0 stored · only authored changes materialize',true);
    }catch(error){setStatus('Grid profile blocked: '+error.message,false);}
  }

  function saveDraft(){if(!state.project)return;localStorage.setItem(STORAGE_KEY,JSON.stringify(state.project));setStatus('Explicit browser draft saved');}
  function loadDraft(){if(!state.source)return;try{var raw=localStorage.getItem(STORAGE_KEY);if(!raw)throw new Error('No saved draft on this browser');var project=JSON.parse(raw),check=Foundry.validateProject(project,state.source);if(!check.ok)throw new Error(check.errors.join('; '));state.project=project;el.projectName.value=project.name;rebuildFeatures();renderRemaps();renderSelection();setStatus('Saved draft loaded · base digests match');}catch(error){setStatus('Draft blocked: '+error.message);}}
  async function importProject(file){if(!file||!state.source)return;try{var project=JSON.parse(await file.text()),check=Foundry.validateProject(project,state.source);if(!check.ok)throw new Error(check.errors.join('; '));state.project=project;el.projectName.value=project.name;rebuildFeatures();renderRemaps();renderSelection();setStatus('Project imported · exact source binding confirmed');}catch(error){setStatus('Project blocked: '+error.message);}}

  function syncProjectName(){if(!state.project)return;state.project.name=el.projectName.value.trim()||'Untitled world remap';}
  function exportProject(){syncProjectName();download((state.project.id||'world-remap')+'.project.json',state.project);setStatus('Editable project downloaded');}
  function exportHandoff(){try{syncProjectName();var handoff=Foundry.buildHandoff(state.source,state.project);download((state.project.id||'world-remap')+'.handoff.json',handoff);setStatus('Builder handoff downloaded · human promotion still required');}catch(error){setStatus('Handoff blocked: '+error.message);}}
  function sourceAllowsSelfMadeExport(){
    var p=state.source&&state.source.provenance;
    return !!p&&['authored','generated'].includes(p.originType)&&p.licenseId==='AXM-LOCAL';
  }
  async function sha256(value){
    var bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(function(byte){return byte.toString(16).padStart(2,'0');}).join('');
  }
  async function exportComponent(){
    try{
      if(!state.source||!state.project)throw new Error('Open a world first');
      if(!sourceAllowsSelfMadeExport())throw new Error('source is not explicitly declared locally authored/generated; export it as an ordinary project instead');
      syncProjectName();
      var sourceDigest=state.source.semanticChunksSha256,component={
        schema:'axm.universal-component/v1',id:(state.project.id||'world-map')+'.map',version:'1.0.0',kind:'world-map-patch',title:state.project.name,
        description:'Reviewable locally authored world-map component. Editor scene framing is presentation metadata, never canonical terrain.',
        ports:{inputs:[],outputs:[{id:'map-patch',type:'axm.world-tile-edit-project/v1',required:false,multiple:false}]},
        canvas_compatibility:{mediums:['2d-raster','3d-spatial'],intended_uses:['game-world','world-map','toon-game'],constraints:['exact base digest required','scene frame is non-authoritative','human promotion required']},
        capabilities:{provides:['world.map.patch','world.scale.metric','world.canvas.dual-mode'],requires:['world.tile.source.inspect/v1']},
        artifact_refs:[],
        payload:{project:state.project,canvas_profile:state.source.canvasModes||null,editor_presentation:{frame_theme:state.frameTheme,world_truth:false}},
        provenance:{origin_type:state.source.provenance.originType,source_id:state.source.provenance.sourceId,source_digest:sourceDigest,license_id:state.source.provenance.licenseId,created_by:state.source.provenance.createdBy,created_at:new Date().toISOString()},
        resource_profile:{cpu:'light',gpu:'none',peak_memory_bytes:null,working_storage_bytes:null,native_runtime:null},
        verification:{automatic_checks:['source contract valid','exact base digest bound','locally authored/generated provenance gate'],human_judgments:['visual quality','gameplay meaning','promotion decision'],assurance_ceiling:'Contract and provenance route only; not rendered, installed, promoted or visually approved.'},
        mutability:'versioned'
      };
      component.digest=await sha256(Foundry.stable(component));
      download((state.project.id||'world-map')+'.ucp-component.json',component);
      setStatus('Self-made component downloaded · UCP review and promotion still required');
    }catch(error){setStatus('Reusable component blocked: '+error.message);}
  }

  function resizeCanvas(){var rect=el.canvasWrap.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);el.worldCanvas.width=Math.max(1,Math.round(rect.width*dpr));el.worldCanvas.height=Math.max(1,Math.round(rect.height*dpr));el.worldCanvas.dataset.dpr=dpr;requestDraw();}
  function fitWorld(){if(!state.source)return;var dpr=Number(el.worldCanvas.dataset.dpr)||1,w=el.worldCanvas.width/dpr,h=el.worldCanvas.height/dpr,pad=74;state.scale=Math.min((w-pad*2)/state.source.world.width,(h-pad*2)/state.source.world.height);state.offsetX=(w-state.source.world.width*state.scale)/2;state.offsetY=(h-state.source.world.height*state.scale)/2;requestDraw();}
  function worldToScreen(x,y){return{x:x*state.scale+state.offsetX,y:y*state.scale+state.offsetY};}
  function screenToWorld(x,y){return{x:(x-state.offsetX)/state.scale,y:(y-state.offsetY)/state.scale};}
  function eventPoint(event){var rect=el.worldCanvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  var drawQueued=false; function requestDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(function(){drawQueued=false;draw();});}

  function tileUrl(tile){if(state.localTileUrls&&state.localTileUrls.get(tile.file.split('/').pop()))return state.localTileUrls.get(tile.file.split('/').pop());return new URL(tile.file,state.tileBase).href;}
  function ensureTile(tile){var key=tile.file,record=state.tiles.get(key);if(record)return record;var img=new Image();record={img:img,ready:false};state.tiles.set(key,record);img.onload=function(){record.ready=true;requestDraw();};img.onerror=function(){record.error=true;};img.src=tileUrl(tile);return record;}
  function visible(rect,w,h){return rect.x+rect.width>=0&&rect.y+rect.height>=0&&rect.x<=w&&rect.y<=h;}
  function draw(){
    var ctx=el.ctx,dpr=Number(el.worldCanvas.dataset.dpr)||1,w=el.worldCanvas.width/dpr,h=el.worldCanvas.height/dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#071019';ctx.fillRect(0,0,w,h);if(!state.source)return;
    drawSceneFrame(ctx,w,h);
    if(state.source.contentPolicy&&state.source.contentPolicy.transparentSubstrateOnly)drawTransparencyGuide(ctx,w,h);
    if(state.raster&&Array.isArray(state.raster.tiles))state.raster.tiles.forEach(function(tile){var p=worldToScreen(tile.x,tile.y),rect={x:p.x,y:p.y,width:tile.width*state.scale,height:tile.height*state.scale};if(!visible(rect,w,h))return;var image=ensureTile(tile);if(image.ready)ctx.drawImage(image.img,rect.x,rect.y,rect.width+.5,rect.height+.5);else{ctx.fillStyle='#0c1d29';ctx.fillRect(rect.x,rect.y,rect.width,rect.height);}});
    if(state.overlay)state.features.forEach(function(f){if(!state.layerVisible[f.layer])return;var r=f.geometry.world,p=worldToScreen(r.x,r.y),rect={x:p.x,y:p.y,width:r.width*state.scale,height:r.height*state.scale};if(!visible(rect,w,h))return;var selected=f.id===state.selectedId;ctx.fillStyle=hexAlpha(COLORS[f.layer],f.editState==='base'?.08:.19);ctx.strokeStyle=selected?'#ffffff':COLORS[f.layer];ctx.lineWidth=selected?2.4:(f.editState==='base'?.7:1.5);ctx.fillRect(rect.x,rect.y,rect.width,rect.height);ctx.strokeRect(rect.x+.5,rect.y+.5,Math.max(0,rect.width-1),Math.max(0,rect.height-1));});
    if(state.drawPreview){var a=worldToScreen(state.drawPreview.x,state.drawPreview.y);ctx.save();ctx.setLineDash([7,5]);ctx.strokeStyle='#fff';ctx.fillStyle='rgba(84,231,220,.18)';ctx.lineWidth=2;ctx.fillRect(a.x,a.y,state.drawPreview.width*state.scale,state.drawPreview.height*state.scale);ctx.strokeRect(a.x,a.y,state.drawPreview.width*state.scale,state.drawPreview.height*state.scale);ctx.restore();}
    drawScaleReference(ctx,w,h);
  }

  function roundedPath(ctx,x,y,width,height,radius){
    var r=Math.max(0,Math.min(radius,width/2,height/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+width-r,y);ctx.quadraticCurveTo(x+width,y,x+width,y+r);ctx.lineTo(x+width,y+height-r);ctx.quadraticCurveTo(x+width,y+height,x+width-r,y+height);ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function regionPath(ctx,region){
    if(region.shape==='polygon'&&Array.isArray(region.points)&&region.points.length>=3){var first=worldToScreen(region.points[0].x,region.points[0].y);ctx.beginPath();ctx.moveTo(first.x,first.y);region.points.slice(1).forEach(function(point){var p=worldToScreen(point.x,point.y);ctx.lineTo(p.x,p.y);});ctx.closePath();return;}
    var rp=worldToScreen(region.x,region.y),rw=region.width*state.scale,rh=region.height*state.scale,rr=(region.radius||0)*state.scale;roundedPath(ctx,rp.x,rp.y,rw,rh,rr);
  }
  function drawSceneFrame(ctx,w,h){
    if(state.frameTheme==='none')return;
    var o=worldToScreen(0,0),ww=state.source.world.width*state.scale,wh=state.source.world.height*state.scale,palette={nature:['#10251c','#2d6b43','#8bbf5c'],waterfall:['#07263c','#1c7fa6','#78e9ff'],volcano:['#2a0b0b','#8e2419','#ffb130'],stone:['#202832','#56616b','#a9b0b5'],holo:['#06182b','#1d63a9','#68f7ee']}[state.frameTheme]||['#10251c','#2d6b43','#8bbf5c'];
    var gradient=ctx.createRadialGradient(w/2,h/2,20,w/2,h/2,Math.max(w,h)*.65);gradient.addColorStop(0,palette[0]);gradient.addColorStop(.62,palette[1]);gradient.addColorStop(1,'#03070c');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.strokeStyle=palette[2];ctx.fillStyle=palette[1];ctx.globalAlpha=.5;
    for(var i=0;i<44;i+=1){var side=i%4,t=((i*37)%101)/100,x=side<2?o.x+t*ww:(side===2?o.x-28:o.x+ww+28),y=side<2?(side===0?o.y-28:o.y+wh+28):o.y+t*wh,r=3+(i%5)*1.8;if(state.frameTheme==='volcano'){ctx.fillStyle=i%3===0?'#ffb130':'#9b2b1d';ctx.beginPath();ctx.moveTo(x-r,y+r);ctx.lineTo(x,y-r*2);ctx.lineTo(x+r,y+r);ctx.fill();}else if(state.frameTheme==='waterfall'){ctx.strokeStyle='#78e9ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-r*2);ctx.lineTo(x+(i%3-1)*2,y+r*2);ctx.stroke();}else{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}}
    ctx.globalAlpha=1;ctx.strokeStyle=palette[2];ctx.lineWidth=2;ctx.strokeRect(o.x-42,o.y-42,ww+84,wh+84);ctx.restore();
  }
  function drawTransparencyGuide(ctx,w,h){
    var origin=worldToScreen(0,0),worldW=state.source.world.width*state.scale,worldH=state.source.world.height*state.scale,size=16,region=state.source.buildRegion||{x:0,y:0,width:state.source.world.width,height:state.source.world.height,radius:0},rp=worldToScreen(region.x,region.y),rw=region.width*state.scale,rh=region.height*state.scale,rr=(region.radius||0)*state.scale;
    ctx.fillStyle='rgba(3,9,14,.86)';ctx.fillRect(origin.x,origin.y,worldW,worldH);
    ctx.save();regionPath(ctx,region);ctx.clip();
    for(var y=origin.y;y<origin.y+worldH;y+=size){for(var x=origin.x;x<origin.x+worldW;x+=size){ctx.fillStyle=((Math.floor((x-origin.x)/size)+Math.floor((y-origin.y)/size))%2)?'#13232d':'#0c1821';ctx.fillRect(x,y,size,size);}}
    var sector=(state.source.creativeGrid&&state.source.creativeGrid.cellWidth)||100,chunk=(state.raster&&state.raster.tileSize&&state.raster.tileSize.width)||1000;
    if(sector*state.scale>=3){ctx.strokeStyle='rgba(84,231,220,.10)';ctx.lineWidth=.6;for(var gx=0;gx<=state.source.world.width;gx+=sector){var sx=worldToScreen(gx,0).x;ctx.beginPath();ctx.moveTo(sx,origin.y);ctx.lineTo(sx,origin.y+worldH);ctx.stroke();}for(var gy=0;gy<=state.source.world.height;gy+=sector){var sy=worldToScreen(0,gy).y;ctx.beginPath();ctx.moveTo(origin.x,sy);ctx.lineTo(origin.x+worldW,sy);ctx.stroke();}}
    ctx.strokeStyle='rgba(84,231,220,.42)';ctx.lineWidth=1;for(var mx=0;mx<=state.source.world.width;mx+=chunk){var msx=worldToScreen(mx,0).x;ctx.beginPath();ctx.moveTo(msx,origin.y);ctx.lineTo(msx,origin.y+worldH);ctx.stroke();}for(var my=0;my<=state.source.world.height;my+=chunk){var msy=worldToScreen(0,my).y;ctx.beginPath();ctx.moveTo(origin.x,msy);ctx.lineTo(origin.x+worldW,msy);ctx.stroke();}
    ctx.restore();ctx.save();ctx.strokeStyle='#54e7dc';ctx.lineWidth=2;regionPath(ctx,region);ctx.stroke();ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(255,198,90,.72)';ctx.lineWidth=1;ctx.strokeRect(origin.x+.5,origin.y+.5,worldW-1,worldH-1);ctx.restore();
  }
  function drawScaleReference(ctx,w,h){
    if(state.referenceItem==='none')return;var cardW=166,cardH=190,x=w-cardW-18,y=h-cardH-18,cell=128;ctx.save();ctx.fillStyle='rgba(4,12,19,.92)';ctx.strokeStyle='rgba(84,231,220,.55)';ctx.lineWidth=1;ctx.fillRect(x,y,cardW,cardH);ctx.strokeRect(x+.5,y+.5,cardW-1,cardH-1);ctx.fillStyle='#86a2b5';ctx.font='10px ui-monospace,Consolas,monospace';ctx.fillText(state.canvasMode==='flat2d'?'128 px = 1 metre':'1 × 1 × 0.5 metre snap',x+12,y+17);
    var bx=x+19,by=y+31;if(state.canvasMode==='flat2d'){for(var iy=0;iy<8;iy+=1)for(var ix=0;ix<8;ix+=1){ctx.fillStyle=(ix+iy)%2?'#152733':'#0c1922';ctx.fillRect(bx+ix*16,by+iy*16,16,16);}ctx.strokeStyle='#54e7dc';ctx.strokeRect(bx+.5,by+.5,cell-1,cell-1);if(state.referenceItem==='crate'){ctx.fillStyle='#9d6b3e';ctx.fillRect(bx+8,by+8,112,112);ctx.strokeStyle='#e1ad68';ctx.lineWidth=5;ctx.strokeRect(bx+13,by+13,102,102);ctx.beginPath();ctx.moveTo(bx+16,by+16);ctx.lineTo(bx+112,by+112);ctx.moveTo(bx+112,by+16);ctx.lineTo(bx+16,by+112);ctx.stroke();}else{ctx.fillStyle='#5a8dff';ctx.beginPath();ctx.arc(bx+64,by+64,38.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b7d1ff';ctx.stroke();}}else{var cx=bx+64,cy=by+88;ctx.fillStyle='#0b2730';ctx.strokeStyle='#54e7dc';ctx.beginPath();ctx.moveTo(cx,cy-38);ctx.lineTo(cx+60,cy-8);ctx.lineTo(cx,cy+22);ctx.lineTo(cx-60,cy-8);ctx.closePath();ctx.fill();ctx.stroke();if(state.referenceItem==='crate'){ctx.fillStyle='#9d6b3e';ctx.strokeStyle='#e1ad68';ctx.fillRect(cx-27,cy-64,54,54);ctx.strokeRect(cx-27,cy-64,54,54);}else{ctx.strokeStyle='#b7d1ff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy-75,8,0,Math.PI*2);ctx.moveTo(cx,cy-67);ctx.lineTo(cx,cy-18);ctx.moveTo(cx,cy-48);ctx.lineTo(cx-20,cy-30);ctx.moveTo(cx,cy-48);ctx.lineTo(cx+20,cy-30);ctx.moveTo(cx,cy-18);ctx.lineTo(cx-18,cy+8);ctx.moveTo(cx,cy-18);ctx.lineTo(cx+18,cy+8);ctx.stroke();}}
    ctx.fillStyle='#edf8ff';ctx.font='700 11px Segoe UI,sans-serif';ctx.fillText(state.referenceItem==='crate'?'Crate · 1 × 1 × 1 m':'Human · 0.6 m footprint · 1.8 m tall',x+12,y+176);ctx.restore();
  }
  function hexAlpha(hex,alpha){var n=parseInt(hex.slice(1),16);return'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+alpha+')';}

  function hitTest(point){var world=screenToWorld(point.x,point.y),candidates=state.features.filter(function(f){if(!state.layerVisible[f.layer])return false;var r=f.geometry.world;return world.x>=r.x&&world.y>=r.y&&world.x<=r.x+r.width&&world.y<=r.y+r.height;});candidates.sort(function(a,b){return (b.navigationPriority-a.navigationPriority)||(a.geometry.world.width*a.geometry.world.height-b.geometry.world.width*b.geometry.world.height);});return candidates[0]||null;}
  function pointerDown(event){if(!state.source)return;el.worldCanvas.setPointerCapture(event.pointerId);var p=eventPoint(event);state.dragging=true;state.pointerStart=p;state.dragStart={x:state.offsetX,y:state.offsetY};if(state.mode==='draw'){var w=screenToWorld(p.x,p.y);state.drawStart=w;state.drawPreview={x:w.x,y:w.y,width:0,height:0};}}
  function pointerMove(event){if(!state.source)return;var p=eventPoint(event),world=screenToWorld(p.x,p.y),policy=state.source.canvasModes&&state.source.canvasModes.spatial3d&&state.source.canvasModes.spatial3d.heightPolicyMetres;el.coordinateReadout.textContent='x '+Math.round(world.x)+' m · '+(state.canvasMode==='spatial3d'?'z ':'y ')+Math.round(world.y)+' m'+(state.canvasMode==='spatial3d'&&policy?' · playable '+policy.playableMinimum+' to '+policy.playableMaximum+' m · reserved '+policy.reservedMinimum+' to '+policy.reservedMaximum+' m':'')+' · '+Math.round(state.scale*1000)+'%';if(!state.dragging)return;if(state.mode==='pan'){state.offsetX=state.dragStart.x+(p.x-state.pointerStart.x);state.offsetY=state.dragStart.y+(p.y-state.pointerStart.y);requestDraw();}else if(state.mode==='draw'){var x=clamp(Math.min(state.drawStart.x,world.x),0,state.source.world.width),y=clamp(Math.min(state.drawStart.y,world.y),0,state.source.world.height),x2=clamp(Math.max(state.drawStart.x,world.x),0,state.source.world.width),y2=clamp(Math.max(state.drawStart.y,world.y),0,state.source.world.height);state.drawPreview={x:x,y:y,width:x2-x,height:y2-y};requestDraw();}}
  function pointerUp(event){if(!state.dragging)return;var p=eventPoint(event);state.dragging=false;if(state.mode==='select'){var feature=hitTest(p);state.selectedId=feature?feature.id:'';renderSelection();requestDraw();}else if(state.mode==='draw'&&state.drawPreview&&state.drawPreview.width>8&&state.drawPreview.height>8){try{state.project=Foundry.addFeature(state.project,state.source,{layer:el.drawLayer.value,geometry:{world:{x:Math.round(state.drawPreview.x),y:Math.round(state.drawPreview.y),width:Math.round(state.drawPreview.width),height:Math.round(state.drawPreview.height)}},material:el.drawMaterial.value,role:el.drawRole.value,elevationMetres:0,heightMetres:state.canvasMode==='spatial3d'?(el.drawLayer.value==='ground'?0:0.5):0});rebuildFeatures();setStatus('New semantic rectangle added to '+(state.canvasMode==='spatial3d'?'metric spatial':'flat')+' patch');}catch(error){setStatus('Draw blocked: '+error.message);}state.drawPreview=null;requestDraw();}}
  function wheel(event){if(!state.source)return;event.preventDefault();var p=eventPoint(event),before=screenToWorld(p.x,p.y),factor=event.deltaY<0?1.18:1/1.18;state.scale=clamp(state.scale*factor,.015,2.5);state.offsetX=p.x-before.x*state.scale;state.offsetY=p.y-before.y*state.scale;requestDraw();}
  function setMode(mode){state.mode=mode;document.querySelectorAll('.tool').forEach(function(button){button.classList.toggle('active',button.dataset.mode===mode);});el.worldCanvas.style.cursor=mode==='pan'?'grab':mode==='draw'?'crosshair':'default';}

  function bind(){
    el.newProjectButton.addEventListener('click',newGameBuild);el.loadDefaultButton.addEventListener('click',loadDefault);el.loadCityButton.addEventListener('click',loadCity);el.packageInput.addEventListener('change',function(){loadPackage(el.packageInput.files);});el.applyGridProfileButton.addEventListener('click',applyGridProfile);el.fitButton.addEventListener('click',fitWorld);el.overlayToggle.addEventListener('change',function(){state.overlay=el.overlayToggle.checked;requestDraw();});el.canvasMode.addEventListener('change',function(){state.canvasMode=el.canvasMode.value;requestDraw();setStatus(state.canvasMode==='spatial3d'?'Spatial profile · metres · 1 × 1 × 0.5 m placement':'Flat profile · 128 × 128 px per metre');});el.referenceItem.addEventListener('change',function(){state.referenceItem=el.referenceItem.value;requestDraw();});el.frameTheme.addEventListener('change',function(){state.frameTheme=el.frameTheme.value;requestDraw();});el.farmButton.addEventListener('click',applyFarm);el.applyFeatureButton.addEventListener('click',applyFeature);el.restoreFeatureButton.addEventListener('click',restoreFeature);el.removeFeatureButton.addEventListener('click',removeFeature);el.saveDraftButton.addEventListener('click',saveDraft);el.loadDraftButton.addEventListener('click',loadDraft);el.downloadProjectButton.addEventListener('click',exportProject);el.downloadHandoffButton.addEventListener('click',exportHandoff);el.downloadComponentButton.addEventListener('click',exportComponent);el.projectInput.addEventListener('change',function(){importProject(el.projectInput.files[0]);});
    document.querySelectorAll('.tool').forEach(function(button){button.addEventListener('click',function(){setMode(button.dataset.mode);});});
    el.worldCanvas.addEventListener('pointerdown',pointerDown);el.worldCanvas.addEventListener('pointermove',pointerMove);el.worldCanvas.addEventListener('pointerup',pointerUp);el.worldCanvas.addEventListener('pointercancel',function(){state.dragging=false;state.drawPreview=null;requestDraw();});el.worldCanvas.addEventListener('wheel',wheel,{passive:false});
    new ResizeObserver(resizeCanvas).observe(el.canvasWrap);
  }

  document.addEventListener('DOMContentLoaded',function(){registerElements();bind();resizeCanvas();loadDefault();});
})();
