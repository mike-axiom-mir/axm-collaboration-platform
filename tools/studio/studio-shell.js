(function () {
  'use strict';
  var Core = window.AXMStudioCore;
  var VisualActions = window.AXMVisualActions;
  var StudioActions = window.AXMStudioActions;
  var actionRegistry = VisualActions.createRegistry(StudioActions.ACTIONS);
  var STORE = 'axm.studio.workspace.v2';
  var $ = function (id) { return document.getElementById(id); };
  var state;
  try { state = Core.normalize(JSON.parse(localStorage.getItem(STORE) || 'null')); }
  catch (error) { state = Core.baseState(); }
  var pendingGoal = null;
  var pendingGoalDelivered = false;
  try {
    pendingGoal = JSON.parse(sessionStorage.getItem('axm.capability.goal-handoff.v1') || 'null');
    if (!pendingGoal || pendingGoal.schema !== 'axm.capability-goal-handoff/v1' || pendingGoal.destinationId !== 'studio') pendingGoal = null;
    else sessionStorage.removeItem('axm.capability.goal-handoff.v1');
  } catch (error) { pendingGoal = null; }
  if (pendingGoal && /\b(crest|logo|icon|vector|emblem|badge)\b/i.test(pendingGoal.goal || '')) state.mode = 'vector';

  var icons = {
    brush:'<path d="M4 20c3 0 5-2 5-5l8-8-4-4-8 8c-3 0-5 2-5 5"/><path d="M14 4l6 6"/>',
    vector:'<path d="M5 18l4-12 10 4-4 10z"/><circle cx="9" cy="6" r="1.5"/><circle cx="19" cy="10" r="1.5"/><circle cx="15" cy="20" r="1.5"/>',
    pixel:'<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-4 3 2 4-5 6 6"/>',
    pattern:'<path d="M4 4h6v6H4zM14 14h6v6h-6zM14 4h6M4 14v6M17 4v6M4 17h6"/>',
    type:'<path d="M5 5h14M12 5v14M8 19h8"/>',
    layout:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 10h13M13 14h5"/>',
    uiux:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/><circle cx="6" cy="6.5" r=".7"/>',
    skin:'<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.2-2.2-.7-1.1.1-2.3 1.4-2.3H17a4 4 0 004-4C21 7.2 17 3 12 3z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    pack:'<path d="M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>'
  };
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>'; }
  function toast(text) { var t=$('toast'); t.textContent=text; t.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(function(){t.classList.remove('show');},1800); }
  function persist(message) {
    state.updatedAt = new Date().toISOString(); localStorage.setItem(STORE, JSON.stringify(state));
    $('saveState').textContent = 'Saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if (window.AXMHub) AXMHub.save({ workspace:state });
    if (window.AXMWorkshopContinuity) AXMWorkshopContinuity.announce({
      workspaceId:'studio', workspaceName:'Studio', projectId:'studio-current',
      projectName:state.projectName, documentSchema:Core.FORMAT, updatedAt:state.updatedAt,
      resumeHint:'Continue in '+(Core.byId(state.mode).title||'Studio')+'.'
    });
    if (message) toast(message);
  }
  function renderNav() {
    var nav=$('modeNav'); nav.innerHTML=''; Core.groups().forEach(function(group){
      var section=document.createElement('section'); section.className='mode-group';
      var title=document.createElement('div'); title.className='mode-group-title'; title.textContent=group.name; section.appendChild(title);
      group.modes.forEach(function(mode){
        var b=document.createElement('button'); b.className='mode-button'; b.dataset.mode=mode.id; b.title=mode.title;
        b.innerHTML='<span class="nav-icon">'+svg(mode.icon)+'</span><b></b>'; b.querySelector('b').textContent=mode.short;
        b.onclick=function(){selectMode(mode.id);}; section.appendChild(b);
      }); nav.appendChild(section);
    });
  }
  function ensureFrame(frame) {
    if (frame && frame.dataset.src && !frame.dataset.loaded) { frame.src=frame.dataset.src; frame.dataset.loaded='1'; }
  }
  function selectMode(id, silent) {
    var mode=Core.byId(id); state.mode=mode.id;
    document.querySelectorAll('.mode-button').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode.id);});
    $('modeIcon').innerHTML=svg(mode.icon); $('modeGroup').textContent=mode.group+' mode'; $('modeTitle').textContent=mode.title; $('modeDescription').textContent=mode.description;
    $('modeRoute').textContent=mode.route==='canvas'?'Layered canvas':mode.route==='uiux'?'Human-first builder':mode.route==='skin'?'Safety-gated design':'Reviewable production';
    var frames={canvas:$('canvasFrame'),uiux:$('uiuxFrame'),skin:$('skinFrame'),pack:$('packFrame')};
    ensureFrame(frames[mode.route]);
    Object.keys(frames).forEach(function(key){frames[key].hidden=key!==mode.route;});
    if (mode.route==='canvas') frames.canvas.contentWindow.postMessage({type:'axm-studio-mode',mode:mode.id,goal:mode.goal,tool:mode.tool},'*');
    $('statusText').textContent=mode.title+' ready';
    if (!silent) persist('Switched to '+mode.title);
  }
  function openAssets() {
    var drawer=$('assetDrawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
    if (!$('vaultFrame').dataset.loaded) {$('vaultFrame').onload=function(){var s=$('vaultState');s.classList.remove('available');s.innerHTML='<i></i>Asset Vault connected';};$('vaultFrame').dataset.loaded='1';$('vaultFrame').src='../asset-vault/index.html?studio=1';}
  }
  function closeAssets() { var drawer=$('assetDrawer'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
  function handKindForMode(mode) {
    return { paint:'illustration', vector:'icon', pixel:'sprite', photo:'illustration', pattern:'texture', type:'poster', layout:'cover', uiux:'ui-component', skin:'panel', pack:'icon' }[mode] || 'icon';
  }
  function handCanvasForMode(mode) {
    return { uiux:{medium:'ui',use:'ui-component'},skin:{medium:'ui',use:'panel'},pixel:{medium:'game-world',use:'sprite'},pattern:{medium:'screen',use:'pattern'},vector:{medium:'screen',use:'icon'},type:{medium:'screen',use:'poster'},layout:{medium:'screen',use:'cover'} }[mode] || {medium:'screen',use:handKindForMode(mode)};
  }
  function openHands() {
    var drawer=$('handsDrawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
    if (!$('handsFrame').dataset.loaded) {
      $('handsFrame').dataset.loaded='1';
      var canvas=handCanvasForMode(state.mode);
      var handGoal=pendingGoal&&pendingGoal.goal||state.projectName||'studio';
      var params=new URLSearchParams({host:'studio',kind:handKindForMode(state.mode),medium:canvas.medium,use:canvas.use,target:handGoal,title:handGoal,purpose:handGoal});
      var requestedOutputs=[];
      if(/\bPNG\b/i.test(handGoal))requestedOutputs.push('image/png');
      if(/\bSVG\b/i.test(handGoal))requestedOutputs.push('image/svg+xml');
      if(requestedOutputs.length)params.set('outputs',requestedOutputs.join(','));
      if(/\b(editable|editability|source)\b/i.test(handGoal))params.set('editable','required');
      $('handsFrame').src='/shared/asset-hands/index.html?'+params.toString();
    }
  }
  function closeHands() { var drawer=$('handsDrawer'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }

  var commandSelection = 0;
  var commandReturnFocus = null;
  var commandHandlers = {
    'studio.mode':function(action, payload){ selectMode(payload.mode); return {completed:true}; },
    'studio.service':function(action, payload){ if(payload.service==='assets')openAssets();else if(payload.service==='hands')openHands();else throw new Error('unknown Studio service');return {completed:true}; },
    'studio.workspace':function(action, payload){ if(payload.command!=='save-workspace')throw new Error('unknown workspace command');$('saveWorkspace').click();return {completed:true}; },
    'studio.canvas':function(action, payload){
      if(!payload.command)throw new Error('canvas command is missing');
      $('canvasFrame').contentWindow.postMessage({type:'axm-studio-command',schema:VisualActions.SCHEMA,actionId:action.id,command:payload.command},'*');
      return {pending:true};
    }
  };
  function commandPlatform(){ return /Mac/i.test(navigator.platform||navigator.userAgent||'')?'macos':'windows'; }
  function commandContexts(){
    var mode=Core.byId(state.mode),contexts=['studio'];
    if(mode.route==='canvas')contexts.push('canvas',mode.id);
    else contexts.push(mode.id);
    return contexts;
  }
  function commandCapabilities(){
    var capabilities=['studio.shell'];
    if(!$('saveWorkspace').disabled)capabilities.push('studio.canvas');
    return capabilities;
  }
  function availableCommands(){
    return actionRegistry.search($('commandSearch').value,{
      contexts:commandContexts(),
      includeAdvanced:$('commandAdvanced').checked,
      platform:commandPlatform(),
      capabilities:commandCapabilities(),
      handlers:commandHandlers
    });
  }
  function selectCommand(index){
    var buttons=[].slice.call(document.querySelectorAll('.command-item'));
    if(!buttons.length){commandSelection=0;return;}
    commandSelection=(index+buttons.length)%buttons.length;
    buttons.forEach(function(button,i){button.classList.toggle('selected',i===commandSelection);button.setAttribute('aria-selected',i===commandSelection?'true':'false');});
    buttons[commandSelection].scrollIntoView({block:'nearest'});
  }
  function runCommand(id){
    var chosen=actionRegistry.get(id);
    var result=actionRegistry.dispatch(id,commandHandlers,{capabilities:commandCapabilities(),mode:state.mode});
    if(!result.ok){toast('Command unavailable · '+result.status);return;}
    closeCommandDeck();
    if(result.value&&result.value.pending)$('statusText').textContent='Running '+chosen.title+'…';
  }
  function renderCommandDeck(){
    var results=availableCommands(),list=$('commandResults');list.innerHTML='';
    $('commandCount').textContent=results.length+' action'+(results.length===1?'':'s');
    if(!results.length){var empty=document.createElement('div');empty.className='command-empty';empty.textContent='No matching action in this Studio mode. Try another word or enable advanced + specialist.';list.appendChild(empty);return;}
    results.forEach(function(action){
      var button=document.createElement('button');button.className='command-item';button.type='button';button.dataset.actionId=action.id;button.setAttribute('role','option');button.disabled=action.availability!=='READY';
      var copy=document.createElement('span');copy.className='command-copy';
      var titleRow=document.createElement('span');titleRow.className='command-title-row';
      var title=document.createElement('b');title.textContent=action.title;titleRow.appendChild(title);
      var level=document.createElement('span');level.className='command-level '+action.level;level.textContent=action.level;titleRow.appendChild(level);
      if(action.destructive){var danger=document.createElement('span');danger.className='command-danger';danger.textContent='◇';danger.title='Existing confirmation gate stays active';titleRow.appendChild(danger);}
      var summary=document.createElement('p');summary.textContent=action.summary;copy.appendChild(titleRow);copy.appendChild(summary);
      var meta=document.createElement('span');meta.className='command-meta';
      var family=document.createElement('span');family.className='command-family';family.textContent=action.family;meta.appendChild(family);
      if(action.trigger){var trigger=document.createElement('kbd');trigger.className='command-trigger';trigger.textContent=action.trigger;meta.appendChild(trigger);}
      button.appendChild(copy);button.appendChild(meta);button.onclick=function(){runCommand(action.id);};list.appendChild(button);
    });
    selectCommand(Math.min(commandSelection,results.length-1));
  }
  function openCommandDeck(){
    commandReturnFocus=document.activeElement;closeAssets();closeHands();
    $('commandDeck').classList.add('open');$('commandDeck').setAttribute('aria-hidden','false');
    commandSelection=0;renderCommandDeck();setTimeout(function(){$('commandSearch').focus();$('commandSearch').select();},0);
  }
  function closeCommandDeck(){
    $('commandDeck').classList.remove('open');$('commandDeck').setAttribute('aria-hidden','true');
    if(commandReturnFocus&&commandReturnFocus.focus)commandReturnFocus.focus();
  }

  renderNav(); $('projectName').value=pendingGoal&&pendingGoal.goal?String(pendingGoal.goal).slice(0,100):state.projectName;
  $('projectName').addEventListener('change',function(){state.projectName=this.value; persist('Project name saved');});
  $('saveWorkspace').onclick=function(){state.projectName=$('projectName').value;this.disabled=true;$('canvasFrame').contentWindow.postMessage({type:'axm-studio-save',download:false},'*');persist('Studio shell saved · artwork checkpoint pending');};
  $('openAssets').onclick=openAssets; $('openAssetsRail').onclick=openAssets;
  $('openHands').onclick=openHands; $('openHandsRail').onclick=openHands;
  $('openCommandDeck').onclick=openCommandDeck;
  document.querySelectorAll('[data-close-assets]').forEach(function(b){b.onclick=closeAssets;});
  document.querySelectorAll('[data-close-hands]').forEach(function(b){b.onclick=closeHands;});
  document.querySelectorAll('[data-close-commands]').forEach(function(b){b.onclick=closeCommandDeck;});
  $('commandSearch').addEventListener('input',function(){commandSelection=0;renderCommandDeck();});
  $('commandAdvanced').addEventListener('change',function(){commandSelection=0;renderCommandDeck();});
  $('commandSearch').addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selectCommand(commandSelection+(e.key==='ArrowDown'?1:-1));}
    else if(e.key==='Enter'){var selected=document.querySelector('.command-item.selected:not(:disabled)');if(selected){e.preventDefault();runCommand(selected.dataset.actionId);}}
  });
  window.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandDeck();return;}
    if(e.key==='Escape'){if($('commandDeck').classList.contains('open'))closeCommandDeck();else{closeAssets();closeHands();}}
  });
  function onCanvasReady(){
    $('saveWorkspace').disabled=false;selectMode(state.mode,true);
    if($('commandDeck').classList.contains('open'))renderCommandDeck();
    if(!pendingGoal||pendingGoalDelivered)return;
    pendingGoalDelivered=true;
    $('canvasFrame').contentWindow.postMessage({type:'axm-studio-goal',schema:pendingGoal.schema,goal:pendingGoal.goal,creationMode:pendingGoal.creationMode,automaticStart:false},'*');
    if(pendingGoal.creationMode==='deterministic'){$('statusText').textContent='Goal loaded · choose a deterministic Creation Hand';openHands();}
    else if(pendingGoal.creationMode==='ai')$('statusText').textContent='AI brief loaded · you choose when the AI takes a turn';
    else $('statusText').textContent='Goal loaded · editable Studio tools are ready';
  }
  $('canvasFrame').addEventListener('load',onCanvasReady);

  /* Nested Studio panels use their existing Hub bridge. Studio answers their
     ready/save/log messages and forwards the meaningful state to the real Hub. */
  window.addEventListener('message',function(ev){
    var msg=ev.data; if(!msg||typeof msg.type!=='string'||msg.type.indexOf('hub:')!==0)return;
    var child=[...document.querySelectorAll('.mode-frame,#vaultFrame,#handsFrame')].find(function(f){return f.contentWindow===ev.source;}); if(!child)return;
    var key='axm.studio.child.'+child.id;
    if(msg.type==='hub:ready') ev.source.postMessage({type:'hub:init',moduleId:'studio',settings:{},moduleState:JSON.parse(localStorage.getItem(key)||'null'),granted:[]},'*');
    if(msg.type==='hub:save'){localStorage.setItem(key,JSON.stringify(msg.state||{})); persist();}
    if(msg.type==='hub:settings:get')ev.source.postMessage({type:'hub:settings:value',settings:{}},'*');
    if(msg.type==='hub:log'&&window.AXMHub)AXMHub.log('Studio · '+String(msg.msg||''),msg.level||'info');
  });
  window.addEventListener('message',function(ev){if(ev.data&&ev.data.type==='axm-studio-saved'){$('saveWorkspace').disabled=false;if(ev.data.ok===false){$('statusText').textContent='Artwork save failed · '+(ev.data.error||'storage unavailable');toast('Artwork was not saved — '+(ev.data.error||'storage unavailable'));return;}$('statusText').textContent='Artwork checkpoint saved';$('saveState').textContent='Saved '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});toast('Studio workspace and artwork saved');}});
  window.addEventListener('message',function(ev){
    var msg=ev.data;if(ev.source!==$('canvasFrame').contentWindow||!msg)return;
    if(msg.type==='axm-studio-canvas-ready'){onCanvasReady();return;}
    if(msg.type==='axm-studio-open-command-deck'){openCommandDeck();return;}
    if(msg.type==='axm-studio-command-result'&&msg.schema===VisualActions.RESULT_SCHEMA){
      var command=actionRegistry.get(msg.actionId),label=command?command.title:'Studio command';
      $('statusText').textContent=msg.ok?label+' ready':label+' refused · '+String(msg.status||'unavailable');
      toast(msg.ok?label:(label+' unavailable · '+String(msg.status||'unknown')));
    }
  });
  window.addEventListener('message',function(ev){
    var msg=ev.data;if(!msg||msg.type!=='axm-asset-hand-result'||msg.schema!=='axm.asset-hand-result/v1'||ev.source!==$('handsFrame').contentWindow)return;
    var result=msg.result||{};
    if(result.schema!=='axm.asset-hand-result/v1'||!result.technical||result.technical.pass!==true||!result.validation_receipt||result.validation_receipt.status!=='PASS'||!result.target_canvas||!result.target_canvas_original||!result.hand||!Array.isArray(result.artifacts)){toast('Creation Hand result refused — invalid, unvalidated or missing canvas provenance');return;}
    var packetArtifact=result.artifacts.find(function(item){return item.metadata&&item.metadata.schema==='axm.drawpacket/v1'&&item.format==='JSON';});
    if(packetArtifact){
      try{
        var packet=JSON.parse(packetArtifact.text);
        if(packet.schema!=='axm.drawpacket/v1')throw new Error('draw packet schema mismatch');
        $('canvasFrame').contentWindow.postMessage({type:'axm-studio-apply-hand-drawpacket',packet:packet,source:{schema:result.schema,resultId:result.id,resultDigest:result.digest,handId:result.hand.id,handVersion:result.hand.version,handContract:result.hand.schema||'',operationMode:result.brief&&result.brief.operation_mode||'create',sourceArtifactDigests:result.creation_recipe&&result.creation_recipe.source_artifact_digests||[],artifactInventory:result.artifacts.map(function(item){return{id:item.id,role:item.role,mime:item.mime,format:item.format,digest:item.digest,editable:item.editable,contentSchema:item.metadata&&item.metadata.schema||''};}),artifactDigest:packetArtifact.digest,targetCanvas:result.target_canvas,targetCanvasOriginal:result.target_canvas_original,targetCanvasValidation:result.brief&&result.brief.target_canvas_validation||null,canvasTransformReceipt:result.canvas_transform_receipt||null,fallbackPolicy:result.brief&&result.brief.fallback_policy||null,creationRecipe:result.creation_recipe||null,validationReceipt:result.validation_receipt,referenceValidation:result.reference_validation||null}},'*');
        closeHands();$('statusText').textContent=result.hand.title+' sent editable instructions to the canvas';toast('Applied '+result.hand.title+' candidate through Studio tools');return;
      }catch(error){toast('Creation Hand packet refused — '+error.message);return;}
    }
    var artifact=result.artifacts.find(function(item){return item.id===result.previewArtifactId&&/^image\//.test(item.mime||'');})||result.artifacts.find(function(item){return /^image\//.test(item.mime||'');});
    if(!artifact){toast('Creation Hand result has no Studio-previewable image artifact');return;}
    var data='';
    if(artifact.mime==='image/svg+xml'&&artifact.format==='SVG'&&/^<svg[\s>]/.test(String(artifact.text||'')))data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artifact.text);
    else if(/^image\/(?:png|jpeg|webp)$/.test(artifact.mime)&&new RegExp('^data:'+artifact.mime.replace('/','\\/')+'(?:;|,)','i').test(artifact.dataUrl||''))data=artifact.dataUrl;
    else{toast('Creation Hand image artifact refused — format and MIME do not agree');return;}
    $('canvasFrame').contentWindow.postMessage({schema:'axm.studio-asset/v1',type:'axm-studio-import-asset',asset:{id:result.id,name:result.brief&&result.brief.title||artifact.name,mime:artifact.mime,dataUrl:data,sourceSchema:result.schema,resultDigest:result.digest,handId:result.hand.id,handVersion:result.hand.version,handContract:result.hand.schema||'',operationMode:result.brief&&result.brief.operation_mode||'create',sourceArtifactDigests:result.creation_recipe&&result.creation_recipe.source_artifact_digests||[],artifactInventory:result.artifacts.map(function(item){return{id:item.id,role:item.role,mime:item.mime,format:item.format,digest:item.digest,editable:item.editable,contentSchema:item.metadata&&item.metadata.schema||''};}),artifactDigest:artifact.digest,targetCanvas:result.target_canvas,targetCanvasOriginal:result.target_canvas_original,targetCanvasValidation:result.brief&&result.brief.target_canvas_validation||null,canvasTransformReceipt:result.canvas_transform_receipt||null,fallbackPolicy:result.brief&&result.brief.fallback_policy||null,creationRecipe:result.creation_recipe||null,validationReceipt:result.validation_receipt,referenceValidation:result.reference_validation||null}},'*');
    closeHands();$('statusText').textContent=result.hand.title+' candidate sent to layered canvas';toast('Added '+String(result.brief&&result.brief.title||artifact.name)+' from '+result.hand.title);
  });
  window.addEventListener('message',function(ev){
    var msg=ev.data;if(!msg||msg.schema!=='axm.studio-asset/v1'||msg.type!=='axm-studio-asset'||ev.source!==$('vaultFrame').contentWindow)return;
    var asset=msg.asset||{},data=String(asset.dataUrl||'');
    if(!/^data:image\//i.test(data)||data.length>28000000){toast('Vault handoff refused — invalid or oversized image');return;}
    $('canvasFrame').contentWindow.postMessage({schema:'axm.studio-asset/v1',type:'axm-studio-import-asset',asset:{id:String(asset.id||''),name:String(asset.name||'Vault asset').slice(0,80),mime:String(asset.mime||''),dataUrl:data}},'*');
    closeAssets();$('statusText').textContent='Vault asset sent to layered canvas';toast('Added '+String(asset.name||'Vault image')+' to Studio');
  });
  if(window.AXMHub){
    AXMHub.onInit(function(){AXMHub.log('Studio v2 ready · ten merged creative modes');});
    AXMHub.onShutdown(function(){persist();});
    AXMHub.ready({id:'studio',name:'AXM Studio',version:'v2.2',hubApiVersion:'1.0',permissions:[],savesState:true,handlesShutdown:true});
  }
  selectMode(state.mode,true);
}());
