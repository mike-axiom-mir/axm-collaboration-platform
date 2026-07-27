(function () {
  'use strict';
  var API = '/game-api', STORE = 'axm.gameNight.party.v2', FEATURED = ['003-robo-pong-cross','006-lumenwake','007-casino-alpha','008-district-party','009-circuitseed-protocol-wilds','010-living-globe-tycoon'];
  var $ = function (id) { return document.getElementById(id); }, online = false, games = [], worlds = [], selectedGameId = null, selectedPlayMode = null, lastLaunch = null, extrasOpen = false, runtimeHealth = null, lobbyPoll = null, bootRetry = null, booting = false;
  var defaults = [
    { name:'Mike', type:'human' }, { name:'Errol', type:'human' }, { name:'Nova', type:'adapter' }, { name:'Codex', type:'adapter' },
    { name:'Gemini', type:'adapter' }, { name:'Claude', type:'adapter' }, { name:'Grok', type:'adapter' }, { name:'Guest', type:'human' }
  ];
  var party = loadParty(), readyOrder = party.readyOrder || [];

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function loadParty() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('axm.gameHub.party.v1') || 'null');
      if (saved && Array.isArray(saved.slots)) {
        while (saved.slots.length < 8) saved.slots.push(defaults[saved.slots.length]);
        saved.slots = saved.slots.slice(0,8);
        saved.readyOrder = (saved.readyOrder || []).filter(function(n,i,a){return n>=0&&n<8&&a.indexOf(n)===i;});
        saved.playModes = saved.playModes && typeof saved.playModes === 'object' ? saved.playModes : {};
        return saved;
      }
    } catch (e) {}
    return { slots: defaults.slice(), readyOrder: [], playModes: {} };
  }
  function persist() { party.readyOrder = readyOrder; party.selectedGameId = selectedGameId; party.playModes = party.playModes || {}; if(selectedGameId&&selectedPlayMode)party.playModes[selectedGameId]=selectedPlayMode; try { localStorage.setItem(STORE, JSON.stringify(party)); } catch (e) {} }
  async function call(route, body) {
    var response = await fetch(API + route, { method: body ? 'POST' : 'GET', headers: {'content-type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
    var value = await response.json().catch(function(){return{};});
    if (!response.ok || value.ok === false) throw new Error(value.error || ('HTTP ' + response.status));
    return value;
  }
  function seatPatch(index) {
    var slot=party.slots[index];
    return {type:slot.type,display_name:slot.name,adapter_id:slot.type==='adapter'?slot.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'):null};
  }
  async function syncSeatToServer(index) {
    if(!online)return;
    await call('/seat/ready',{seat_id:'seat_'+(index+1),ready:false});
    await call('/seat/assign',{seat_id:'seat_'+(index+1),patch:seatPatch(index)});
    if(readyOrder.indexOf(index)>=0&&party.slots[index].type!=='empty')await call('/seat/ready',{seat_id:'seat_'+(index+1),ready:true});
  }
  async function syncPartyToServer() { for(var i=0;i<8;i++)await syncSeatToServer(i); }
  function game() { return games.find(function(item){return item.game_id===selectedGameId;}) || null; }
  function playModes() { var item=game(); return item&&Array.isArray(item.play_modes)?item.play_modes:[]; }
  function playMode() { var modes=playModes(); return modes.find(function(mode){return mode.id===selectedPlayMode;})||modes[0]||null; }
  function visibleSeats() { var item=game(), mode=playMode(); return item && Number(item.max_players)>4 && (extrasOpen||(mode&&mode.party_rule==='balanced-parties')) ? 8 : 4; }
  function playModeIssue() {
    var mode=playMode(); if(!mode)return null;
    var ready=readyOrder.filter(function(index){return party.slots[index]&&party.slots[index].type!=='empty';}), partyA=ready.filter(function(index){return index<4;}), partyB=ready.filter(function(index){return index>=4;});
    if(mode.party_rule==='party-a-only') {
      if(partyB.length)return 'Story mode uses seats 1-4 only';
      if(partyA.length<1)return 'Ready at least one story player';
    }
    if(mode.party_rule==='balanced-parties') {
      if(!partyA.length||!partyB.length)return 'Ready both Party A and Party B';
      if(partyA.length!==partyB.length)return 'House War needs equal Party A and Party B teams';
    }
    return null;
  }
  function slotValue(index) {
    var name = $('seatName'+index), type = $('seatType'+index);
    return { name: name ? (name.value.trim() || ('Player '+(index+1))).slice(0,30) : party.slots[index].name, type: type ? type.value : party.slots[index].type };
  }
  function syncSlot(index) {
    party.slots[index] = slotValue(index);
    if (party.slots[index].type === 'empty') readyOrder = readyOrder.filter(function (seat) { return seat !== index; });
    persist(); renderState(); renderLobbyJoin();
    syncSeatToServer(index).catch(function(error){$('status').textContent='LOBBY SYNC FAILED · '+error.message;});
  }
  function toggleReady(index) {
    if (!party.slots[index] || party.slots[index].type === 'empty') return;
    var at=readyOrder.indexOf(index); if(at>=0)readyOrder.splice(at,1); else readyOrder.push(index); persist(); renderState();
    if(online)call('/seat/ready',{seat_id:'seat_'+(index+1),ready:readyOrder.indexOf(index)>=0}).catch(function(error){$('status').textContent='READY SYNC FAILED · '+error.message;});
  }

  function buildSeats() {
    var count=visibleSeats(), box=$('seats'); box.innerHTML='';
    for (var i=0;i<count;i++) (function(index){
      var slot=party.slots[index], card=document.createElement('article'); card.className='seat'; card.id='seat'+index;
      card.innerHTML='<div class="seat-head"><b>SEAT '+(index+1)+'</b><span class="seat-state" id="seatState'+index+'">NOT READY</span></div>'+
        '<input id="seatName'+index+'" maxlength="30" aria-label="Seat '+(index+1)+' name" value="'+esc(slot.name)+'">'+
        '<select id="seatType'+index+'" aria-label="Seat '+(index+1)+' type"><option value="empty"'+(slot.type==='empty'?' selected':'')+'>Empty / remove</option><option value="human"'+(slot.type==='human'?' selected':'')+'>Human</option><option value="adapter"'+(slot.type==='adapter'?' selected':'')+'>AI</option></select>'+
        '<button id="seatReady'+index+'">Ready up</button>';
      box.appendChild(card);
      $('seatName'+index).oninput=function(){syncSlot(index);}; $('seatType'+index).onchange=function(){syncSlot(index);}; $('seatReady'+index).onclick=function(){toggleReady(index);};
    })(i);
    renderState();
    renderLobbyJoin();
  }

  function lobbyControllerUrl(index, lan) {
    var port=runtimeHealth&&runtimeHealth.port||8789, host=lan&&runtimeHealth&&runtimeHealth.lan_addresses&&runtimeHealth.lan_addresses[0]&&runtimeHealth.lan_addresses[0].address||'127.0.0.1';
    return 'http://'+host+':'+port+'/lobby-controller?seat=seat_'+(index+1)+'&game='+encodeURIComponent(selectedGameId||'');
  }
  function gamePreviewUrl(lan) {
    var item=game(), join=item&&item.join||{}; if(!join.preview_path)return null;
    var host=lan&&runtimeHealth&&runtimeHealth.lan_addresses&&runtimeHealth.lan_addresses[0]&&runtimeHealth.lan_addresses[0].address||'127.0.0.1';
    var port=join.preview_via_game_hub?(runtimeHealth&&runtimeHealth.port||8789):8788;
    return 'http://'+host+':'+port+join.preview_path;
  }
  function renderLobbyJoin() {
    var panel=$('lobbyJoinPanel'), grid=$('lobbyControllerGrid'); if(!panel||!grid)return;
    var humans=[]; for(var i=0;i<visibleSeats();i++)if(party.slots[i]&&party.slots[i].type==='human')humans.push(i);
    panel.hidden=!online||humans.length===0; grid.innerHTML='';
    humans.forEach(function(index){
      var slot=party.slots[index], lanUrl=lobbyControllerUrl(index,true), localUrl=lobbyControllerUrl(index,false), card=document.createElement('article'); card.className='controller';
      var qr=document.createElement('div'); qr.className='qr'; qrInto(qr,lanUrl,slot.name);
      var info=document.createElement('div'); info.innerHTML='<b>SEAT '+(index+1)+' · '+esc(slot.name)+'</b><div class="url">'+esc(lanUrl)+'</div><small id="lobbySeatStatus'+index+'">'+(readyOrder.indexOf(index)>=0?'READY':'WAITING TO READY')+'</small>';
      var preview=gamePreviewUrl(false); if(preview){var previewButton=document.createElement('button');previewButton.textContent='Preview game controls · no ready';previewButton.onclick=function(){window.open(preview,'_blank','noopener');};info.appendChild(previewButton);}
      var open=document.createElement('button'); open.textContent='Open phone lobby'; open.onclick=function(){window.open(localUrl,'_blank','noopener');}; info.appendChild(open); card.appendChild(qr); card.appendChild(info); grid.appendChild(card);
    });
  }
  async function pollLobbySeats() {
    if(!online)return;
    try {
      var response=await call('/seats'), serverSeats=response.seats||[], next=[];
      serverSeats.forEach(function(seat,index){if(seat.ready&&seat.type!=='empty')next.push({index:index,order:Number.isInteger(seat.ready_order)?seat.ready_order:999999});});
      next.sort(function(a,b){return a.order-b.order;}); var nextOrder=next.map(function(item){return item.index;});
      if(JSON.stringify(nextOrder)!==JSON.stringify(readyOrder)){readyOrder=nextOrder;persist();renderState();}
      for(var i=0;i<visibleSeats();i++){var label=$('lobbySeatStatus'+i);if(label)label.textContent=readyOrder.indexOf(i)>=0?'READY':'WAITING TO READY';}
    } catch(error) {$('status').textContent='LOBBY CHECK FAILED · '+error.message;}
  }
  function startLobbyPolling(){if(lobbyPoll)clearInterval(lobbyPoll);lobbyPoll=setInterval(pollLobbySeats,900);}

  function renderState() {
    var item=game(), count=visibleSeats(), max=item?Number(item.max_players||2):2, min=item?Number(item.min_players||1):1;
    readyOrder = readyOrder.filter(function(index,pos,list){return index>=0&&index<8&&list.indexOf(index)===pos&&party.slots[index]&&party.slots[index].type!=='empty';});
    for(var i=0;i<count;i++){
      var at=readyOrder.indexOf(i), card=$('seat'+i), state=$('seatState'+i), button=$('seatReady'+i), name=$('seatName'+i), empty=party.slots[i].type==='empty'; if(!card)continue;
      card.className='seat'+(empty?' empty':at>=0&&at<max?' ready':at>=max?' wait':'');
      state.textContent=empty?'EMPTY':at<0?'NOT READY':at<max?('PLAY '+(at+1)):('WAIT '+(at-max+1));
      name.disabled=empty; button.disabled=empty; button.classList.toggle('on',!empty&&at>=0); button.textContent=empty?'Seat empty':at>=0?'Cancel ready':'Ready up';
    }
    var selected=readyOrder.slice(0,max).map(function(index){return party.slots[index];}), allowed=(item&&item.allowed_seat_types)||['human','adapter','ai'];
    var invalid=selected.filter(function(slot){return allowed.indexOf(slot.type)<0;}), modeIssue=playModeIssue();
    var occupied=party.slots.slice(0,count).filter(function(slot){return slot.type!=='empty';}).length;
    $('partyCount').textContent=readyOrder.length+' READY · '+occupied+' OCCUPIED';
    $('matchLabel').textContent=invalid.length?'This game requires human seats':modeIssue||(selected.length>=min?selected.map(function(s){return s.name;}).join(item&&item.rules&&item.rules.team_mode==='coop'?' + ':' · '):('Ready at least '+min+' seat'+(min===1?'':'s')));
    $('launch').disabled=!online||!item||selected.length<min||invalid.length>0||!!modeIssue;
    $('launch').textContent=!online?'Start AXM Full to play':!item?'Choose a game':invalid.length?'Fix unsupported seats':modeIssue||(selected.length<min?('Ready '+min+' seat'+(min===1?'':'s')+' to launch'):('Launch '+item.name));
    persist();
  }

  function featureCard(item) {
    var card=document.createElement('button'); card.className='game-card'+(item.game_id===selectedGameId?' selected':'');
    card.innerHTML='<div class="slot">'+esc(item.slot||'---')+'</div><h3>'+esc(item.name)+'</h3><p>'+esc(item.description||'Installed local game.')+'</p><small>'+esc(item.min_players)+'–'+esc(item.max_players)+' PLAYERS · '+esc(item.status||'TEST')+'</small>';
    card.onclick=function(){chooseGame(item.game_id);}; return card;
  }
  function renderLibrary() {
    var grid=$('gameGrid'); grid.innerHTML=''; FEATURED.forEach(function(id){var item=games.find(function(g){return g.game_id===id;});if(item)grid.appendChild(featureCard(item));});
    renderChooser();
  }
  function safeWorldPath(value) {
    var route=String(value||'');
    return /^\/worlds\/[a-z0-9._/-]+\/?$/i.test(route)&&route.indexOf('..')<0?route:'';
  }
  function enterableWorlds() {
    return worlds.filter(function(world){return safeWorldPath(world.path);}).sort(function(a,b){
      if(a.id==='world.axm.foundation-planet')return -1;
      if(b.id==='world.axm.foundation-planet')return 1;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });
  }
  function renderChooser() {
    var select=$('allGames'); if(!select)return; select.innerHTML='';
    var gameGroup=document.createElement('optgroup'); gameGroup.label='INSTALLED GAMES';
    games.forEach(function(item){var option=document.createElement('option');option.value=item.game_id;option.textContent=(item.slot||'---')+' · '+item.name;gameGroup.appendChild(option);});
    if(!games.length){var waiting=document.createElement('option');waiting.disabled=true;waiting.textContent=online?'No verified games found':'Reconnecting to installed games…';gameGroup.appendChild(waiting);}
    select.appendChild(gameGroup);
    var visible=enterableWorlds();
    if(visible.length){var worldGroup=document.createElement('optgroup');worldGroup.label='WORLD EXPERIENCES';visible.forEach(function(world){var option=document.createElement('option'),route=safeWorldPath(world.path);option.value='world:'+route;option.textContent=(world.id==='world.axm.foundation-planet'?'PLANET · ':'WORLD · ')+(world.name||world.id);worldGroup.appendChild(option);});select.appendChild(worldGroup);}
    select.value=selectedGameId;
  }
  function renderWorldLibrary() {
    var grid=$('worldGrid'), count=$('worldCount'); if(!grid||!count)return;
    grid.innerHTML='';
    var visible=enterableWorlds();
    count.textContent=visible.length+' WORLD'+(visible.length===1?'':'S');
    if(!visible.length){grid.innerHTML='<div class="world-empty">No enterable worlds are registered.</div>';return;}
    visible.forEach(function(world,index){
      var link=document.createElement('a'), foundation=world.id==='world.axm.foundation-planet';
      link.className='world-card'+(foundation?' foundation-world':''); link.href=safeWorldPath(world.path); link.target='_blank'; link.rel='noopener';
      link.innerHTML='<div class="world-kicker">'+(foundation?'PLANET SCALE':'LIVING WORLD')+' · '+String(index+1).padStart(2,'0')+'</div><h3>'+esc(world.name||world.id)+'</h3><p>'+(foundation?'The huge persistent Caelus foundation: orbit, deploy to its surface, inspect climates, water, geology and living systems.':'Open this registered persistent world in its own experience.')+'</p><footer><span>'+esc(world.status||'TEST')+'</span><strong>ENTER WORLD ↗</strong></footer>';
      grid.appendChild(link);
    });
    renderChooser();
  }
  async function loadWorldLibrary() {
    var grid=$('worldGrid'), count=$('worldCount');
    try {
      var response=await fetch('/worlds/world-registry.json',{cache:'no-store'}), value=await response.json();
      if(!response.ok||!Array.isArray(value.worlds))throw new Error('World registry unavailable');
      worlds=value.worlds; renderWorldLibrary();
    } catch(error) {
      worlds=[]; renderChooser(); if(count)count.textContent='WORLDS OFFLINE'; if(grid)grid.innerHTML='<div class="world-empty">World registry unavailable. Game packages remain usable.</div>';
    }
  }
  function setPlayMode(id) {
    var modes=playModes(), next=modes.find(function(mode){return mode.id===id;})||modes[0]||null; selectedPlayMode=next&&next.id||null;
    extrasOpen=!!(next&&next.party_rule==='balanced-parties');
    if(next&&next.party_rule==='party-a-only') {
      var removed=readyOrder.filter(function(index){return index>=4;}); readyOrder=readyOrder.filter(function(index){return index<4;});
      if(online)removed.forEach(function(index){call('/seat/ready',{seat_id:'seat_'+(index+1),ready:false}).catch(function(){});});
    }
    persist(); renderGame(); buildSeats();
  }
  function chooseGame(id) {
    selectedGameId=id; var item=game(), modes=item&&Array.isArray(item.play_modes)?item.play_modes:[];
    var savedMode=party.playModes&&party.playModes[id]; selectedPlayMode=modes.some(function(mode){return mode.id===savedMode;})?savedMode:modes[0]&&modes[0].id||null; extrasOpen=!!(playMode()&&playMode().party_rule==='balanced-parties');
    if(playMode()&&playMode().party_rule==='party-a-only')readyOrder=readyOrder.filter(function(index){return index<4;});
    persist(); renderGame(); renderLibrary(); buildSeats(); $('roomPanel').hidden=true;
  }
  function renderPlayModes() {
    var box=$('playModes'), modes=playModes(); if(!box)return; box.hidden=modes.length===0; box.innerHTML='';
    modes.forEach(function(mode){var button=document.createElement('button');button.className='play-mode'+(mode.id===selectedPlayMode?' selected':'');button.type='button';button.innerHTML='<strong>'+esc(mode.label||mode.id)+'</strong><small>'+esc(mode.description||'')+'</small>';button.onclick=function(){setPlayMode(mode.id);};box.appendChild(button);});
  }
  function renderGame() {
    var item=game(); if(!item)return;
    $('gameName').textContent=item.name; $('gameDescription').textContent=item.description||'Installed local game.';
    var features=[item.min_players+'–'+item.max_players+' players']; if(item.join&&item.join.supports_qr)features.push('QR controllers'); if(item.controls&&item.controls.profile_id)features.push(item.controls.profile_id); if(item.rules&&item.rules.team_mode)features.push(item.rules.team_mode);
    $('gameChips').innerHTML=features.map(function(value){return '<span class="chip">'+esc(value)+'</span>';}).join('');
    renderPlayModes();
    var mode=playMode(), modeSeats=visibleSeats();
    $('partyTitle').textContent=modeSeats===8?'Eight visible seats':Number(item.max_players)===1?'One active seat · party stays registered':'Four visible seats';
    $('extraSeats').hidden=Number(item.max_players)<=4||playModes().length>0; $('extraSeats').textContent=extrasOpen?'Hide seats 5–8':'Show seats 5–8';
    $('seatRule').textContent=mode&&mode.party_rule==='party-a-only'?'Story uses Party A seats 1–4. One human can play on this laptop; phones are optional.':mode&&mode.party_rule==='balanced-parties'?'House War uses equal teams: Party A seats 1–4 and Party B seats 5–8.':Number(item.max_players)>4?'Seats 1–4 are the default group. Seats 5–8 appear only by choice. A screen never occupies a seat.':'A screen never occupies a seat. A ready human gets a controller link; a ready AI gets the same declared action vocabulary.';
    renderState();
  }

  async function clearRunning() { try { var current=await call('/state'); if(current.state&&current.state.session&&current.state.session.phase==='RUNNING') await call('/game/end',{confirmed_finish:false,reflect:false,summary:{status:'replaced-by-next-game'}}); } catch(e){} }
  async function submitParty() {
    for(var i=0;i<8;i++){
      await call('/seat/ready',{seat_id:'seat_'+(i+1),ready:false});
      await call('/seat/assign',{seat_id:'seat_'+(i+1),patch:seatPatch(i)});
    }
    for(var q=0;q<readyOrder.length;q++)await call('/seat/ready',{seat_id:'seat_'+(readyOrder[q]+1),ready:true});
  }
  function withSession(url, launch) { if(!url)return null;if(/[?&]session=/.test(url))return url;return url+(url.indexOf('?')>=0?'&':'?')+'session='+encodeURIComponent(launch.session.session_id); }
  async function launch() {
    var button=$('launch'), label=button.textContent; button.disabled=true; button.textContent='Starting…';
    try { await clearRunning(); await submitParty(); lastLaunch=await call('/game/start',{game_id:selectedGameId,play_mode:selectedPlayMode}); showRoom(lastLaunch); $('status').textContent='ROOM '+lastLaunch.room_code+' · LIVE'; }
    catch(error){$('status').textContent='LAUNCH FAILED · '+error.message;} finally {button.textContent=label;renderState();}
  }
  function qrInto(box,url,name){box.innerHTML='';if(url&&typeof qrcode==='function'){try{var code=qrcode(0,'M');code.addData(url);code.make();var img=document.createElement('img');img.alt='QR controller for '+name;img.src=code.createDataURL(5,3);box.appendChild(img);return;}catch(e){}}box.innerHTML='<span style="color:#111;font-size:10px;text-align:center">Wi-Fi link unavailable</span>';}
  function showRoom(launch) {
    $('roomPanel').hidden=false; $('roomCode').textContent=launch.room_code||'AXM1'; $('roomTitle').textContent=(launch.session.selected_game&&launch.session.selected_game.name||'Game')+' is ready';
    var humans=(launch.controller_urls||[]).filter(function(c){return c.type==='human';}), primary=humans[0]||null, primaryButton=$('openPrimaryControls'), grid=$('controllerGrid');grid.innerHTML='';humans.forEach(function(c){var card=document.createElement('article');card.className='controller';var qr=document.createElement('div');qr.className='qr';qrInto(qr,c.lan_url,c.name);var info=document.createElement('div');info.innerHTML='<b>'+esc(c.player.toUpperCase()+' · '+c.name)+'</b><div class="url">'+esc(c.lan_url||'Same-Wi-Fi address unavailable')+'</div><small>Optional phone QR, or use these controls in a browser.</small>';var open=document.createElement('button');open.textContent='Open on this device';open.onclick=function(){window.open(withSession(c.local_url,launch),'_blank','noopener');};info.appendChild(open);card.appendChild(qr);card.appendChild(info);grid.appendChild(card);});
    if(!grid.children.length)grid.innerHTML='<p>No phone controller is needed for this game. Open its game screen below.</p>';
    primaryButton.disabled=!primary; primaryButton.textContent=primary?('Open '+primary.name+' controls'):'No human controls';
    $('openGame').disabled=!launch.client_url; $('openScreen').disabled=!(launch.spectator_url||launch.client_url); setTimeout(function(){$('roomPanel').scrollIntoView({behavior:'smooth',block:'start'});},50);
  }
  async function finish(reflect) {
    if(!lastLaunch)return; var launch=lastLaunch;
    var response=await call('/game/end',{confirmed_finish:!!reflect,reflect:!!reflect,summary:{status:reflect?'completed-by-party':'stopped-without-result'}});
    if(reflect&&window.AXMProfile){
      await AXMProfile.record({type:'game-played',dedupeKey:'game-result:'+response.result.session_id,candidates:(response.result.selected_players||[]).map(function(p){return{id:p.adapter_id||p.seat_id,name:p.display_name};}),evidence:'Game Night explicitly finished '+(response.result.game&&response.result.game.name||response.result.game_id)+' session '+response.result.session_id+'.',source:'Game Night result',meta:{gameId:response.result.game_id,sessionId:response.result.session_id}}).catch(function(){});
    }
    lastLaunch=null;$('roomPanel').hidden=true;$('status').textContent='ONLINE · SESSION CLOSED';
    if(reflect)location.href='/tools/game-hub/post-game/?session='+encodeURIComponent(response.result.session_id);
  }

  function brief(h){var p=h&&h.provenance||{};return String(p.brief||p.request_prompt||p.summary||p.generator||'No provenance brief supplied.').replace(/\s+/g,' ').trim().slice(0,240);}
  async function refreshAssets(){var box=$('assetInbox');try{var response=await call('/assets/inbox'),items=response.handoffs||[];if(!items.length){box.innerHTML='<p>No staged proposals.</p>';return;}box.innerHTML='';items.forEach(function(h){var row=document.createElement('div'),dims=h.dimensions&&h.dimensions.width&&h.dimensions.height?(h.dimensions.width+' × '+h.dimensions.height):'dimensions unavailable';row.className='asset';row.innerHTML='<img src="/tools/game-hub/asset-inbox/'+encodeURIComponent(h.id)+'/asset.png" alt=""><div><b>'+esc(h.name||'Unnamed asset')+'</b><small>'+esc(h.target_game_id)+' · '+esc(dims)+' · '+esc(h.status)+'</small><small>'+esc(brief(h))+'</small><small>'+(h.status==='proposal'?'Stored in proposal inbox · not activated':'Accepted into game package')+'</small></div>';if(h.status==='proposal'){var button=document.createElement('button');button.textContent='Accept into game package';button.onclick=async function(){button.disabled=true;try{await call('/assets/accept',{id:h.id});await refreshAssets();}catch(e){button.textContent='Failed';}};row.appendChild(button);}box.appendChild(row);});}catch(e){box.innerHTML='<p>Inbox unavailable: '+esc(e.message)+'</p>';}}
  async function boot(){
    if(booting)return;
    booting=true;
    loadWorldLibrary();
    try{
      var responses=await Promise.all([call('/health'),call('/games'),call('/active-launch')]);
      runtimeHealth=responses[0];games=(responses[1].games||[]).filter(function(item){return item.status!=='manifest-error';});lastLaunch=responses[2].launch||null;
      var runningGameId=lastLaunch&&lastLaunch.session&&lastLaunch.session.selected_game&&lastLaunch.session.selected_game.game_id;
      selectedGameId=runningGameId||(party.selectedGameId&&games.some(function(item){return item.game_id===party.selectedGameId;})?party.selectedGameId:(games.find(function(item){return item.game_id===FEATURED[0];})||games[0]||{}).game_id);
      var modes=playModes(),savedMode=party.playModes&&party.playModes[selectedGameId],liveMode=lastLaunch&&lastLaunch.play_mode;
      selectedPlayMode=modes.some(function(mode){return mode.id===liveMode;})?liveMode:modes.some(function(mode){return mode.id===savedMode;})?savedMode:modes[0]&&modes[0].id||null;
      extrasOpen=!!(playMode()&&playMode().party_rule==='balanced-parties');online=true;
      if(bootRetry){clearTimeout(bootRetry);bootRetry=null;}
      $('status').textContent='ONLINE · '+games.length+' GAMES';renderLibrary();renderGame();buildSeats();
      if(lastLaunch){showRoom(lastLaunch);$('status').textContent='ROOM '+lastLaunch.room_code+' · LIVE';}else await syncPartyToServer();
      await pollLobbySeats();startLobbyPolling();await refreshAssets();
    }catch(error){
      online=false;$('status').textContent='RECONNECTING · STARTING GAME SERVICE';renderChooser();buildSeats();
      if(!bootRetry)bootRetry=setTimeout(function(){bootRetry=null;boot();},1500);
    }finally{booting=false;}
  }

  $('allGames').onchange=function(){if(this.value.indexOf('world:')===0){var route=safeWorldPath(this.value.slice(6));this.value=selectedGameId;if(route)location.assign(route);return;}chooseGame(this.value);}; $('extraSeats').onclick=function(){extrasOpen=!extrasOpen;renderGame();buildSeats();}; $('launch').onclick=launch;
  $('openGame').onclick=function(){if(lastLaunch&&lastLaunch.client_url)window.open(withSession(lastLaunch.client_url,lastLaunch),'_blank','noopener');};
  $('openPrimaryControls').onclick=function(){if(!lastLaunch)return;var primary=(lastLaunch.controller_urls||[]).find(function(c){return c.type==='human';});if(primary&&primary.local_url)window.open(withSession(primary.local_url,lastLaunch),'_blank','noopener');};
  $('openScreen').onclick=function(){if(lastLaunch)window.open(withSession(lastLaunch.spectator_url||lastLaunch.client_url,lastLaunch),'_blank','noopener');};
  $('finishReflect').onclick=function(){finish(true).catch(function(e){$('status').textContent='FINISH FAILED · '+e.message;});}; $('stopOnly').onclick=function(){finish(false).catch(function(e){$('status').textContent='STOP FAILED · '+e.message;});};
  boot();
})();
