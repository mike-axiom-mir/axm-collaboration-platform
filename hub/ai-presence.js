(function(){
  'use strict';
  var BRIDGE='http://127.0.0.1:8787',POLL_MS=6000,timer=null,busy=false,paused=false;
  var members=new Map(),notices=new Map();

  function bridgeNode(){return document.getElementById('presenceBridge');}
  function setBridge(state,label,detail){
    var el=bridgeNode();if(!el)return;
    el.classList.remove('checking','connected','disconnected','paused');el.classList.add(state);
    var small=el.querySelector('small');if(small)small.textContent=label;
    el.setAttribute('aria-label','Bridge '+label);if(detail)el.title=detail;
  }
  function system(text,state){
    var el=document.getElementById('systemStatus');if(!el)return;
    el.textContent=text;el.classList.remove('checking','degraded','paused');if(state)el.classList.add(state);
  }
  function fetchTimed(url,ms,options){
    var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},ms||2600),opts=options||{};
    opts.cache='no-store';opts.signal=controller.signal;
    return fetch(url,opts).finally(function(){clearTimeout(timeout);});
  }
  function upsert(member){if(member&&member.id&&member.name)members.set(member.id,member);}
  function noticeFor(memberId){return notices.get(memberId)||null;}
  function noticeMark(type){return type==='question'?'?':type==='warning'?'!':type==='proposal'?'◆':'•';}
  function chipState(state){return state==='paused'||state==='tripped'?'paused':state==='offline'?'disconnected':'connected';}
  function chipLabel(member){
    if(member.label)return member.label;
    if(member.state==='thinking')return 'THINK';
    if(member.state==='acting')return 'WORK';
    if(member.state==='idle')return 'IDLE';
    if(member.state==='ready')return 'READY';
    if(member.state==='paused')return 'HOLD';
    return member.kind==='human'?'HERE':'ON';
  }
  function renderMembers(){
    var root=document.getElementById('presenceMembers');if(!root)return;
    var list=Array.from(members.values()).sort(function(a,b){return Number(a.order||50)-Number(b.order||50)||a.name.localeCompare(b.name);});
    root.innerHTML='';
    list.forEach(function(member){
      var el=document.createElement('span');el.className='ai-node '+chipState(member.state);
      var notice=noticeFor(member.id);
      if(notice){el.classList.add('attention','attention-'+notice.type);el.tabIndex=0;el.setAttribute('role','button');}
      el.title=notice?(notice.fromName+' · '+notice.type.toUpperCase()+' · '+notice.message):(member.detail||((member.kind||'participant')+' present'+(member.location?' at '+member.location:'')));
      var dot=document.createElement('i'),name=document.createElement('b'),small=document.createElement('small'),alert=document.createElement('em');
      name.textContent=member.name;small.textContent=chipLabel(member);
      alert.textContent=notice?noticeMark(notice.type):'';alert.setAttribute('aria-hidden','true');
      el.appendChild(dot);el.appendChild(name);el.appendChild(small);el.appendChild(alert);
      el.setAttribute('aria-label',member.name+' '+small.textContent+(notice?' has a '+notice.type+': '+notice.message:''));
      if(notice){el.addEventListener('click',function(){openNotice(notice);});el.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();openNotice(notice);}});}
      root.appendChild(el);
    });
  }
  async function loadNotices(){
    var response=await fetchTimed('/api/presence/notices',1800);if(!response.ok)return;
    var payload=await response.json();(payload.notices||[]).forEach(function(notice){
      if(notice&&notice.fromId&&!notices.has(notice.fromId))notices.set(notice.fromId,notice);
    });
  }
  async function acknowledgeNotice(notice){
    try{await fetchTimed('/api/presence/notice/ack',1800,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:notice.id,by:localStorage.getItem('axm.presence.name')||'Mike'})});}catch(error){}
  }
  function openNotice(notice){
    try{localStorage.setItem('axm.collaboration.notice.open',JSON.stringify(notice));}catch(error){}
    acknowledgeNotice(notice);notices.delete(notice.fromId);renderMembers();
    var moduleId='ai-team';
    if(window.AXMHubShell&&typeof window.AXMHubShell.open==='function')window.AXMHubShell.open(moduleId);
    else location.href='/tools/'+moduleId+'/index.html';
  }
  async function raiseNotice(input){
    var response=await fetchTimed('/api/presence/notice',2200,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input||{})});
    if(!response.ok)throw new Error('notice HTTP '+response.status);
    var payload=await response.json();await refresh();return payload.notice;
  }
  async function heartbeatSelf(){
    var name=localStorage.getItem('axm.presence.name')||'Mike';
    await fetchTimed('/api/presence/heartbeat',1800,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'mike',name:name,kind:'human',state:document.hidden?'idle':'active',location:location.pathname,ttlMs:20000})});
  }
  async function loadRegistered(){
    var response=await fetchTimed('/api/presence',1800);if(!response.ok)return;
    var payload=await response.json();(payload.members||[]).forEach(function(member){
      member.order=member.kind==='human'?10:20;member.detail=(member.kind||'participant')+' heartbeat'+(member.location?' · '+member.location:'');upsert(member);
    });
  }
  async function loadGrok(){
    try{
      var response=await fetchTimed('/api/grok/status',2200);if(!response.ok)return;
      var payload=await response.json(),g=payload.status||{};
      if(!g.installed)return;
      var state=g.state==='tripped'?'tripped':g.state==='offline'?'offline':g.state;
      upsert({id:'grok',name:'Grok',kind:'ai',state:state,order:40,label:state==='active'?'ACTIVE':state==='ready'?'READY':state==='tripped'?'TRIP':'OFF',detail:state==='tripped'?'Shell Guardian tripped · '+(g.guardianReason||'review required'):state==='active'?'Grok Build active · Guardian armed':state==='ready'?'Grok Build authenticated · Guardian armed':'Grok connector unavailable'});
    }catch(error){}
  }
  async function loadChatGPT(){
    try{
      var response=await fetchTimed('/api/chatgpt-connector/status',2200);if(!response.ok)return;
      var payload=await response.json(),status=payload.status||{},seat=status.codingSeat||{},app=status.chatApp||{},platform=status.platformMcp||{};
      if(seat.loginVerified){
        upsert({id:'codex',name:'Codex',kind:'ai',state:'ready',order:34,label:'READY',detail:'Codex coding seat login verified'});
      }
      if(platform.connected===true&&platform.safeTunnel===true){
        upsert({id:'chatgpt',name:'ChatGPT',kind:'ai',state:'ready',order:35,label:'READY',detail:'ChatGPT Platform MCP safe tunnel explicitly connected'});
      }else if(app.appOpen){
        upsert({id:'chatgpt',name:'ChatGPT',kind:'ai',state:'offline',order:35,label:'APP',detail:'ChatGPT app open · Platform MCP manual / unconnected'});
      }
    }catch(error){}
  }
  async function loadBridgeAndModels(){
    var health=await fetchTimed(BRIDGE+'/health',2200);if(!health.ok)throw new Error('bridge HTTP '+health.status);
    setBridge('connected','ON','AXM bridge connected · checked '+new Date().toLocaleTimeString());
    try{
      var stateResponse=await fetchTimed(BRIDGE+'/agent-state',2200);
      if(stateResponse.ok){var gate=await stateResponse.json();paused=!!gate.paused;}
    }catch(error){paused=false;}
    renderMaster();
    var ids=[];
    try{
      var response=await fetchTimed(BRIDGE+'/local-models',3200);
      if(response.ok){var payload=await response.json();ids=(payload&&payload.data||[]).map(function(item){return String(item.id||'').toLowerCase();});}
    }catch(error){}
    if(ids.indexOf('axm-llama-3.1-8b')>=0)upsert({id:'nova',name:'Nova',kind:'ai',state:paused?'paused':'active',order:30,label:paused?'HOLD':'ON',detail:'Nova · axm-llama-3.1-8b'});
    if(ids.indexOf('gemini-local')>=0)upsert({id:'gemini-local',name:'Gemini',kind:'ai',state:paused?'paused':'active',order:31,label:paused?'HOLD':'ON',detail:'Gemini Local · gemini-local'});
    return ids.length;
  }
  async function refresh(){
    if(busy)return;busy=true;members.clear();notices.clear();var bridgeOk=false;
    try{await heartbeatSelf();}catch(error){}
    try{await loadBridgeAndModels();bridgeOk=true;}catch(error){setBridge('disconnected','OFF','AXM local bridge is unreachable');paused=false;renderMaster();}
    await Promise.allSettled([loadRegistered(),loadChatGPT(),loadGrok(),loadNotices()]);renderMembers();
    var count=members.size;
    system(paused?'AI agents paused':bridgeOk?(count+' participant'+(count===1?'':'s')+' present'):'Bridge offline · '+count+' present',paused?'paused':bridgeOk?'':'degraded');
    busy=false;clearTimeout(timer);timer=setTimeout(refresh,POLL_MS);
  }
  function renderMaster(){
    var button=document.getElementById('aiMasterToggle');if(!button)return;
    var label=button.querySelector('span:last-child');if(label)label.textContent=paused?'Resume AI':'Pause AI';
    button.classList.toggle('paused',paused);button.setAttribute('aria-pressed',paused?'true':'false');
    button.title=paused?'Resume local AI agents':'Pause active local AI agents';button.disabled=false;
  }
  async function toggleMaster(){
    var button=document.getElementById('aiMasterToggle');if(button)button.disabled=true;
    try{
      var response=await fetch(BRIDGE+'/agents/pause',{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({paused:!paused})});
      if(!response.ok)throw new Error('pause gate HTTP '+response.status);
      var result=await response.json();paused=!!result.paused;renderMaster();await refresh();
    }catch(error){if(button){button.disabled=false;button.title='Could not reach the AI pause gate';}await refresh();}
  }
  addEventListener('online',refresh);
  document.addEventListener('visibilitychange',function(){refresh();});
  var master=document.getElementById('aiMasterToggle');if(master)master.addEventListener('click',toggleMaster);
  function snapshot(){return Array.from(members.values()).map(function(member){return Object.assign({},member);});}
  renderMaster();window.AXMAIPresence={refresh:refresh,toggle:toggleMaster,raiseNotice:raiseNotice,openNotice:openNotice,members:snapshot};refresh();
})();
