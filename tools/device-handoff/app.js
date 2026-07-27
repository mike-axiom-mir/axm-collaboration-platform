(function(){
  'use strict';
  const O=window.AXMOps,notice=document.getElementById('notice');
  function qr(url){
    const box=document.getElementById('qr');box.innerHTML='';
    if(typeof window.qrcode!=='function'){box.textContent='QR generator unavailable; copy the URL.';return;}
    try{const code=window.qrcode(0,'M');code.addData(url);code.make();box.innerHTML=code.createImgTag(5,8,'AXM device handoff QR');}
    catch(_){box.textContent='QR could not represent this URL; copy it below.';}
  }
  async function load(){
    try{
      const value=await O.get('/api/device-handoff');
      document.getElementById('facts').innerHTML='<span>sidecar '+(value.running?'RUNNING':'STOPPED')+'</span><span>port '+(value.port||'—')+'</span><span>'+value.activeSessions.length+' active session(s)</span><span>Workshop exposed to LAN: '+value.workshopExposedToLan+'</span>';
      document.getElementById('receipts').textContent=value.receipts.length?O.pretty(value.receipts):'No receipts yet.';
      return value;
    }catch(error){O.notice(notice,error.message,'bad');throw error;}
  }
  async function startSession(source){
    try{
      const value=await O.post('/api/device-handoff/session',{ttlMinutes:Number(document.getElementById('ttl').value),source:source||'device-handoff-ui'},{'x-axm-device-handoff':'explicit-session'});
      qr(value.url);
      document.getElementById('url').innerHTML='<a href="'+O.esc(value.localUrl)+'" target="_blank" rel="noopener">'+O.esc(value.url)+'</a>';
      document.getElementById('expiry').textContent='Expires '+O.date(value.expiresAt)+' · selected files only · whole-device scan false · listener stops when the last session expires';
      O.notice(notice,value.lanAddressAvailable?'Temporary LAN session ready.':'No private LAN address detected; local-device testing only.','ok');
      await load();
    }catch(error){O.notice(notice,error.message+' The device.listen permission remains Mike’s explicit gate.','bad');}
  }
  async function stopSession(){
    try{await O.post('/api/device-handoff/stop',{}, {'x-axm-device-handoff':'explicit-stop'});document.getElementById('qr').innerHTML='';document.getElementById('url').textContent='No active session.';document.getElementById('expiry').textContent='';O.notice(notice,'LAN handoff doorway stopped.','ok');await load();}
    catch(error){O.notice(notice,error.message,'bad');}
  }
  document.getElementById('start').onclick=()=>startSession('device-handoff-ui');
  document.getElementById('stop').onclick=stopSession;
  document.getElementById('refresh').onclick=load;
  const query=new URLSearchParams(location.search),commandDeckStart=query.get('start')==='1'&&query.get('from')==='command-deck',chromaStart=query.get('start')==='1'&&query.get('from')==='chroma-studio';
  if(commandDeckStart||chromaStart){history.replaceState(null,'',location.pathname);load().then(()=>startSession(commandDeckStart?'command-deck':'chroma-studio'));}
  else load();
})();
