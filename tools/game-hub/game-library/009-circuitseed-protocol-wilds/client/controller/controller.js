(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const identity={roomCode:params.get('room')||'AXM1',sessionId:params.get('session'),seatId:params.get('seat'),token:params.get('token')};
  let seq=0,input={moveX:0,moveY:0,moveActive:false},pointer=null;
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const tactical=['Scan','Anchor','Shield','Patch','Reroute','Challenge','Isolate','Synchronize'];
  async function send(extra={},quiet=false){
    if(!identity.sessionId||!identity.seatId||!identity.token)return;
    const body={...identity,seq:seq++,input:{...input,...extra}};
    try{const r=await fetch('/api/input',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||d.ok===false){if(d.nextSequenceMinimum!=null)seq=d.nextSequenceMinimum;throw new Error(d.reason||d.error||'refused')}$('#sequence').textContent='SEQ '+(seq-1);$('#connection').textContent='CONNECTED';$('#connection').classList.add('connected')}
    catch(e){if(!quiet){$('#connection').textContent='PAUSED';$('#connection').classList.remove('connected')}}
  }
  function pulse(field){send({[field]:true});setTimeout(()=>send({[field]:false},true),90)}
  const zone=$('#stickZone'),base=$('#stickBase'),knob=$('#stickKnob');
  function updateStick(event){
    const rect=base.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,r=rect.width*.38;
    let dx=(event.clientX-cx)/r,dy=(event.clientY-cy)/r;const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length}
    const dead=.14;if(length<dead){dx=0;dy=0}else{const scaled=(Math.min(1,length)-dead)/(1-dead);const angle=Math.atan2(dy,dx);dx=Math.cos(angle)*scaled;dy=Math.sin(angle)*scaled}
    input.moveX=dx;input.moveY=dy;input.moveActive=length>=dead;knob.style.transform='translate(calc(-50% + '+(dx*r)+'px),calc(-50% + '+(dy*r)+'px))';
  }
  zone.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;zone.setPointerCapture(pointer);updateStick(e)});
  zone.addEventListener('pointermove',e=>{if(e.pointerId===pointer)updateStick(e)});
  function release(e){if(e.pointerId!==pointer)return;pointer=null;input={...input,moveX:0,moveY:0,moveActive:false};knob.style.transform='translate(-50%,-50%)';send({},true)}
  zone.addEventListener('pointerup',release);zone.addEventListener('pointercancel',release);
  $$('[data-pulse]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();pulse(b.dataset.pulse)}));
  $('#tacticalButtons').innerHTML=tactical.map(a=>'<button data-action="'+a+'">'+a.toUpperCase()+'</button>').join('');
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>send({tacticalAction:b.dataset.action})));
  setInterval(()=>send({},true),50);
  async function poll(){
    if(!identity.sessionId||!identity.seatId||!identity.token){$('#connection').textContent='PAIRING DATA MISSING';return}
    try{const q=new URLSearchParams({room:identity.roomCode,session:identity.sessionId,seat:identity.seatId,width:String(innerWidth),height:String(innerHeight)});const r=await fetch('/api/state?'+q,{headers:{'x-axm-seat-token':identity.token}});const d=await r.json();if(!r.ok||d.ok===false)throw new Error();seq=Math.max(seq,d.controls.nextSequenceMinimum);$('#playerName').textContent=d.self.displayName;$('#seatLabel').textContent=d.self.seatId+' · '+d.self.role;$('#missionText').textContent=d.hud.mission.title+' — '+d.hud.mission.brief;$('#fieldMeta').textContent='ARCHIVE '+d.hud.journal.recovered+'/'+d.hud.journal.total+' · REQUESTS '+d.hud.requests.claimed+'/'+d.hud.requests.total+(d.hud.requests.ready?' · '+d.hud.requests.ready+' READY':'');$('#vitalBar').style.width=(d.self.integrity/d.self.maxIntegrity*100)+'%';$('#vitalText').textContent=d.self.integrity+'/'+d.self.maxIntegrity;$('#tactics').classList.toggle('hidden',!d.hud.encounter||d.hud.encounter.status==='resolved');$('#connection').textContent='CONNECTED';$('#connection').classList.add('connected')}
    catch(e){$('#connection').textContent='WAITING';$('#connection').classList.remove('connected')}
  }
  setInterval(poll,300);poll();
  const keys=new Set();addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.key===' ')pulse('interact')});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  setInterval(()=>{if(!keys.size)return;input.moveX=(keys.has('d')?1:0)-(keys.has('a')?1:0);input.moveY=(keys.has('s')?1:0)-(keys.has('w')?1:0);input.moveActive=!!(input.moveX||input.moveY)},40);
})();
