(function () {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const TOKEN_KEY = 'hexbound-quartermaster-token-v2';
  const state = {
    token: localStorage.getItem(TOKEN_KEY) || '', connected: false, busy: false, timer: null,
    tacticalMode: 'rally', tactical: null, rivalAnchor: null
  };
  const labels = {
    mobs:'Mischief Mob', hexbows:'Hexbow Choir', brooms:'Broom Patrol', lanterns:'Lantern Guard', signature:'Faction Signature',
    guard:'Guard', raid:'Comic Raid', march:'Grand March', rally:'Rally Beacon', wonderwork:'Commission Wonderwork', toggle:'Toggle Scout', pirates:'Frontline Pirates',
    reinforce:'Second Wind', parade:'Phantom Parade', 'pumpkin-market':'Pumpkin Night Market', 'junk-jamboree':'Junk Jamboree',
    'impossible-housing':'Impossible Housing', 'volunteer-seance':'Volunteer Séance'
  };

  function connection(kind, text) {
    const element=$('#connection'); element.className=kind; element.querySelector('b').textContent=text;
    state.connected=kind==='online'; $$('[data-type]').forEach(button=>button.disabled=!state.connected); updateTacticalAvailability();
  }

  async function json(url, options) {
    const response=await fetch(url,options); const body=await response.json().catch(()=>({ok:false,error:'invalid server response'}));
    if(!response.ok) throw new Error(body.error||('HTTP '+response.status)); return body;
  }

  async function join(force) {
    connection('', 'CONNECTING');
    if(force){state.token='';localStorage.removeItem(TOKEN_KEY);}
    try {
      const result=await json('/api/coop/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({player:'Quartermaster',token:state.token})});
      state.token=result.token;localStorage.setItem(TOKEN_KEY,state.token);connection('online','SEAT LINKED');poll();
    } catch(error) { connection('error',error.message.toUpperCase()); addReceipt('LINK',error.message,'rejected'); }
  }

  async function send(button) {
    if(!state.connected||state.busy)return; state.busy=true; button.classList.add('sent');
    const type=button.dataset.type,value=button.dataset.value;
    try {
      const result=await json('/api/coop/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:state.token,type,value})});
      addReceipt('#'+result.command.seq,(labels[value]||value)+' queued','queued');
    } catch(error) { addReceipt('NO',error.message,'rejected'); if(/token/i.test(error.message))connection('error','RECONNECT REQUIRED'); }
    finally { setTimeout(()=>button.classList.remove('sent'),260); state.busy=false; }
  }

  async function sendTactical(anchorId, button) {
    if(!state.connected||state.busy||!state.tactical)return; state.busy=true; button.classList.add('sent'); const value=state.tacticalMode;
    try {
      const result=await json('/api/coop/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:state.token,type:'target',value,target:anchorId})});
      addReceipt('#'+result.command.seq,(value==='pirates'?'Rooftop Pirates':value==='wonderwork'?'Commission Wonderwork':'Rally Beacon')+' · '+roofLabel(anchorId)+' queued','queued');
    } catch(error) { addReceipt('NO',error.message,'rejected'); if(/token/i.test(error.message))connection('error','RECONNECT REQUIRED'); }
    finally { setTimeout(()=>button.classList.remove('sent'),260); state.busy=false; }
  }

  async function poll() {
    clearTimeout(state.timer); if(!state.token)return;
    try {
      const result=await json('/api/coop/state?token='+encodeURIComponent(state.token));
      connection('online',result.host&&result.host.phase==='battle'?'LIVE WITH COMMANDER':'SEAT LINKED · HOST WAITING'); renderHost(result.host); renderReceipts(result.commands||[]);
    } catch(error) { connection('error',error.message.toUpperCase()); }
    state.timer=setTimeout(poll,900);
  }

  function renderHost(host) {
    renderMechanic(host&&host.mechanic); renderRival(host&&host.rival); renderRecruits(host&&host.recruits); renderPowers(host&&host.powers); renderSignature(host&&host.signature); renderCharter(host&&host.charter); renderDoctrine(host&&host.doctrine); renderTactical(host&&host.tactical);
    if(!host){$('#host-phase').textContent='WAITING FOR COMMANDER';$('#host-stance').textContent='—';$('#host-pop').textContent='— / —';return;}
    $('#host-phase').textContent=(host.map||host.phase||'BATTLE').toUpperCase(); $('#host-stance').textContent=(host.stance||'PROBE').toUpperCase();
    $('#host-pop').textContent=Math.floor(host.population)+' / '+Math.floor(host.cap); $('#host-time').textContent=formatTime(host.elapsed);
    $('#q-glow').textContent=Math.floor(host.resources.glow); $('#q-scrap').textContent=Math.floor(host.resources.scrap); $('#q-essence').textContent=Math.floor(host.resources.essence);
    $('#scout-state').textContent='Auto-scout is '+(host.autoScout?'ON':'OFF');
  }

  function renderMechanic(mechanic) {
    const panel=$('#host-mechanic');
    if(!mechanic||!mechanic.title){panel.classList.remove('active','warning');$('#host-mechanic-title').textContent='WAITING FOR BATTLEFIELD';$('#host-mechanic-effect').textContent='The Quartermaster will receive the same macro countdown as the Commander.';$('#host-mechanic-phase').textContent='—';return;}
    panel.style.setProperty('--hazard',mechanic.color||'#b27cff'); panel.classList.toggle('active',mechanic.phase==='active'); panel.classList.toggle('warning',mechanic.phase==='warning');
    $('#host-mechanic-title').textContent=mechanic.title.toUpperCase(); $('#host-mechanic-effect').textContent=mechanic.effect||'';
    let phase=mechanic.phase==='active'?'ACTIVE':mechanic.phase==='warning'?'INCOMING':'NEXT'; if(/Escalator/.test(mechanic.title)&&mechanic.phase==='active')phase=mechanic.direction>0?'EASTBOUND':'WESTBOUND';
    $('#host-mechanic-phase').textContent=phase+' · '+Math.ceil(mechanic.nextIn)+'s';
  }

  function renderRival(rival) {
    const panel=$('#host-rival');state.rivalAnchor=rival&&rival.targetAnchor||null;
    if(!rival||!rival.name){panel.classList.remove('staging','launched');$('#host-rival-icon').textContent='?';$('#host-rival-kicker').textContent='RIVAL SCHEME';$('#host-rival-title').textContent='READING THE RIVAL WAR ROOM';$('#host-rival-effect').textContent='The Quartermaster will receive the same strategic warning as the Commander.';$('#host-rival-phase').textContent='—';return;}
    panel.style.setProperty('--hazard',rival.color||'#ff657d');panel.classList.toggle('staging',rival.phase==='staging');panel.classList.toggle('launched',rival.phase==='launched');
    $('#host-rival-icon').textContent=rival.icon||'?';$('#host-rival-kicker').textContent='RIVAL SCHEME · '+(rival.kicker||'MACRO PLAN');$('#host-rival-title').textContent=rival.name.toUpperCase();
    $('#host-rival-effect').textContent='TARGET · '+(rival.target||'UNKNOWN')+' — '+(rival.counterplay||'Read the war table and counter-mass.');$('#host-rival-phase').textContent=(rival.phase==='staging'?'STAGING':'COMMITTED')+' · '+Math.ceil(rival.nextIn)+'s';
  }

  function renderSignature(signature) {
    const button=$('#signature-order');
    if(!signature||!signature.id){button.style.removeProperty('--signature');$('#signature-icon').textContent='★';$('#signature-name').textContent='Faction Signature';$('#signature-role').textContent='Waiting for Commander faction';$('#signature-cost').textContent='—';labels.signature='Faction Signature';return;}
    button.style.setProperty('--signature',signature.color||'#b27cff'); $('#signature-icon').textContent=signature.icon||'★'; $('#signature-name').textContent=signature.name;
    $('#signature-role').textContent=signature.role||'Automatic battlefield passive'; $('#signature-cost').textContent=Math.floor(signature.glow)+'·'+Math.floor(signature.scrap); labels.signature=signature.name;
  }

  function renderRecruits(recruits) {
    for(const item of Array.isArray(recruits)?recruits:[]){const button=document.querySelector('[data-type="train"][data-value="'+item.id+'"]');if(!button)continue;button.style.setProperty('--signature',item.color||'#b27cff');button.querySelector('i').textContent=item.icon;button.querySelector('b').textContent=item.name;button.querySelector('small').textContent=item.role+' · '+Math.floor(item.members);button.querySelector('kbd').textContent=Math.floor(item.glow)+'·'+Math.floor(item.scrap);labels[item.id]=item.name;}
  }

  function renderPowers(powers) {
    for(const item of Array.isArray(powers)?powers:[]){const button=document.querySelector('[data-type="support"][data-value="'+item.id+'"]');if(!button)continue;button.querySelector('kbd').textContent='✦'+Math.floor(item.essence);labels[item.id]=item.name;}
  }

  function renderCharter(charter) {
    const active=charter&&charter.id; $$('[data-type="charter"]').forEach(button=>{button.classList.toggle('active',button.dataset.value===active);if(button.dataset.value===active)button.style.setProperty('--charter',charter.color||'#ffb15b');else button.style.removeProperty('--charter');});
    $('#active-charter-plan').textContent=active?charter.name.toUpperCase():'WAITING FOR COMMANDER';
  }

  function renderDoctrine(doctrine) {
    const grid=$('#doctrine-grid'),active=doctrine&&doctrine.active||'',options=doctrine&&Array.isArray(doctrine.options)?doctrine.options:[];grid.innerHTML='';
    if(!options.length){const empty=document.createElement('p');empty.textContent='Waiting for the Commander faction’s council papers.';grid.appendChild(empty);$('#active-doctrine-plan').textContent='NOT YET CHOSEN';return;}
    for(const item of options){
      labels[item.id]=item.name;const button=document.createElement('button');button.dataset.type='doctrine';button.dataset.value=item.id;button.style.setProperty('--doctrine',item.color||'#b27cff');button.className=active===item.id?'active':'';
      const icon=document.createElement('i'),copy=document.createElement('span'),name=document.createElement('b'),detail=document.createElement('small');icon.textContent=item.icon||'★';name.textContent=item.name;detail.textContent=item.detail;copy.append(name,detail);button.append(icon,copy);button.disabled=!state.connected||!!active;button.addEventListener('click',()=>send(button));grid.appendChild(button);
    }
    const chosen=options.find(item=>item.id===active);$('#active-doctrine-plan').textContent=chosen?chosen.name.toUpperCase():'CHOOSE ONE — ONCE';
  }

  function roofLabel(id) { const anchor=state.tactical&&state.tactical.anchors&&state.tactical.anchors.find(item=>item.id===id);if(anchor&&anchor.name)return anchor.name;const value=Number(String(id||'').slice(1)); return Number.isFinite(value)?'Roof '+String(value+1).padStart(2,'0'):'Unknown roof'; }
  function updateTacticalAvailability() { $$('.tactical-node').forEach(button=>{button.disabled=!state.connected||button.dataset.explored!=='true';}); }

  function renderTactical(tactical) {
    state.tactical=tactical&&Array.isArray(tactical.anchors)?tactical:null;
    const links=$('#tactical-links'),nodes=$('#tactical-nodes'),forces=$('#tactical-forces'),empty=$('#tactical-empty'); links.innerHTML='';nodes.innerHTML='';forces.innerHTML='';
    if(!state.tactical||!state.tactical.anchors.length){empty.classList.remove('hidden');$('#tactical-intel').textContent='WAITING FOR COMMANDER INTELLIGENCE';return;}
    empty.classList.add('hidden'); const byId=new Map(state.tactical.anchors.map(anchor=>[anchor.id,anchor])),routeKeys=new Map((state.tactical.routes||[]).map(route=>[[route.from,route.to].sort().join('>'),route.count]));
    for(const pair of state.tactical.links||[]){
      const a=byId.get(pair[0]),b=byId.get(pair[1]);if(!a||!b)continue;const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      const marching=routeKeys.get([pair[0],pair[1]].sort().join('>'))||0;line.setAttribute('x1',a.x*100);line.setAttribute('y1',a.y*100);line.setAttribute('x2',b.x*100);line.setAttribute('y2',b.y*100);line.setAttribute('class','tactical-link'+(a.explored&&b.explored?' known':'')+(marching?' marching':''));if(marching)line.setAttribute('data-formations',marching);links.appendChild(line);
    }
    state.tactical.anchors.forEach(anchor=>{
      const button=document.createElement('button'),label=roofLabel(anchor.id);button.type='button';
      button.className='tactical-node '+anchor.owner+(anchor.visible?' visible':'')+(state.rivalAnchor===anchor.id?' rival-plan':'')+(state.tactical.signal&&state.tactical.signal.target===anchor.id?' signal '+state.tactical.signal.kind:'');
      button.style.left=(anchor.x*100)+'%';button.style.top=(anchor.y*100)+'%';button.dataset.anchor=anchor.id;button.dataset.explored=String(!!anchor.explored);
      button.title=label+' · '+(anchor.explored?(anchor.owner==='neutral'?'open roof':anchor.owner+' '+(anchor.kind||'district')):'unexplored fog');button.setAttribute('aria-label',button.title);
      const number=document.createElement('span');number.textContent=String(Number(anchor.id.slice(1))+1).padStart(2,'0');button.appendChild(number);button.addEventListener('click',()=>sendTactical(anchor.id,button));nodes.appendChild(button);
    });
    for(const force of state.tactical.forces||[]){const pip=document.createElement('span');pip.className='force-pip '+force.team+(force.members>=10?' large':'');pip.style.left=(force.x*100)+'%';pip.style.top=(force.y*100)+'%';pip.title=force.team+' formation · '+force.members+' fighters';forces.appendChild(pip);}
    const mapped=state.tactical.anchors.filter(anchor=>anchor.explored).length,enemies=(state.tactical.forces||[]).filter(force=>force.team==='enemy').length;
    const lanes=(state.tactical.routes||[]).length;$('#tactical-intel').textContent=(state.tactical.topology||'ROOFTOP NETWORK').toUpperCase()+' · '+mapped+' ROOFS MAPPED · '+enemies+' RIVAL FORMATIONS IN SIGHT'+(lanes?' · '+lanes+' ACTIVE LANES':''); updateTacticalAvailability();
  }

  function makeReceipt(prefix, message, kind, detail) {
    const row=document.createElement('p');row.className=kind==='rejected'?'rejected':'';const lead=document.createElement('span'),tail=document.createElement('span'),strong=document.createElement('b');strong.textContent=prefix;lead.appendChild(strong);lead.appendChild(document.createTextNode(' · '+message));tail.textContent=detail||kind;row.append(lead,tail);return row;
  }

  function renderReceipts(commands) {
    if(!commands.length)return;const list=$('#activity-list');list.innerHTML='';commands.slice().reverse().forEach(command=>{
      const receiptLabel=command.type==='target'?(command.value==='pirates'?'Rooftop Pirates':command.value==='wonderwork'?'Commission Wonderwork':'Rally Beacon')+' · '+roofLabel(command.target):command.value==='signature'&&command.message?String(command.message).replace(/\s+assembling$/,''):labels[command.value]||command.value;
      list.appendChild(makeReceipt('#'+command.seq+' '+String(command.status).toUpperCase(),receiptLabel,command.status,command.message||''));
    });
  }

  function addReceipt(prefix,message,kind){const list=$('#activity-list');if(list.querySelector('p')&&/Waiting/.test(list.textContent))list.innerHTML='';list.prepend(makeReceipt(prefix,message,kind,kind));}
  function formatTime(seconds){const value=Math.max(0,Number(seconds)||0);return String(Math.floor(value/60)).padStart(2,'0')+':'+String(Math.floor(value%60)).padStart(2,'0');}

  $$('[data-type]').forEach(button=>{button.disabled=true;button.addEventListener('click',()=>send(button));});
  $$('[data-tactical-mode]').forEach(button=>button.addEventListener('click',()=>{state.tacticalMode=button.dataset.tacticalMode;$$('[data-tactical-mode]').forEach(item=>item.classList.toggle('active',item===button));$('.tactical-section').style.setProperty('--atlas',state.tacticalMode==='pirates'?'var(--violet)':state.tacticalMode==='wonderwork'?'var(--gold)':'#6adfff');}));
  $('#reconnect').addEventListener('click',()=>join(false));
  window.addEventListener('beforeunload',()=>clearTimeout(state.timer));
  join(false);
})();
