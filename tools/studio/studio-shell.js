(function () {
  'use strict';
  var Core = window.AXMStudioCore;
  var STORE = 'axm.studio.workspace.v2';
  var $ = function (id) { return document.getElementById(id); };
  var state;
  try { state = Core.normalize(JSON.parse(localStorage.getItem(STORE) || 'null')); }
  catch (error) { state = Core.baseState(); }

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

  renderNav(); $('projectName').value=state.projectName;
  $('projectName').addEventListener('change',function(){state.projectName=this.value; persist('Project name saved');});
  $('saveWorkspace').onclick=function(){state.projectName=$('projectName').value;this.disabled=true;$('canvasFrame').contentWindow.postMessage({type:'axm-studio-save',download:false},'*');persist('Studio shell saved · artwork checkpoint pending');};
  $('openAssets').onclick=openAssets; $('openAssetsRail').onclick=openAssets;
  document.querySelectorAll('[data-close-assets]').forEach(function(b){b.onclick=closeAssets;});
  window.addEventListener('keydown',function(e){if(e.key==='Escape')closeAssets();});
  $('canvasFrame').addEventListener('load',function(){$('saveWorkspace').disabled=false;selectMode(state.mode,true);});

  /* Nested Studio panels use their existing Hub bridge. Studio answers their
     ready/save/log messages and forwards the meaningful state to the real Hub. */
  window.addEventListener('message',function(ev){
    var msg=ev.data; if(!msg||typeof msg.type!=='string'||msg.type.indexOf('hub:')!==0)return;
    var child=[...document.querySelectorAll('.mode-frame,#vaultFrame')].find(function(f){return f.contentWindow===ev.source;}); if(!child)return;
    var key='axm.studio.child.'+child.id;
    if(msg.type==='hub:ready') ev.source.postMessage({type:'hub:init',moduleId:'studio',settings:{},moduleState:JSON.parse(localStorage.getItem(key)||'null'),granted:[]},'*');
    if(msg.type==='hub:save'){localStorage.setItem(key,JSON.stringify(msg.state||{})); persist();}
    if(msg.type==='hub:settings:get')ev.source.postMessage({type:'hub:settings:value',settings:{}},'*');
    if(msg.type==='hub:log'&&window.AXMHub)AXMHub.log('Studio · '+String(msg.msg||''),msg.level||'info');
  });
  window.addEventListener('message',function(ev){if(ev.data&&ev.data.type==='axm-studio-saved'){$('saveWorkspace').disabled=false;if(ev.data.ok===false){$('statusText').textContent='Artwork save failed · '+(ev.data.error||'storage unavailable');toast('Artwork was not saved — '+(ev.data.error||'storage unavailable'));return;}$('statusText').textContent='Artwork checkpoint saved';$('saveState').textContent='Saved '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});toast('Studio workspace and artwork saved');}});
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
