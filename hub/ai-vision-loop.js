(function(){
  'use strict';
  var stream=null,video=null,timer=null,busy=false,active=false,remaining=0,observationNo=0,targetIdentity='mirror',buffer=null,inFlightBuffer=null,requestAbort=null,lifecycle=0;
  var RECEIPTS_KEY='axm-eye2-ephemeral-receipts-v1';
  function $(id){return document.getElementById(id);}
  function targetName(){var select=$('visionTarget'),option=select&&select.options[select.selectedIndex];return option?option.textContent:String(targetIdentity||'recipient');}
  function setState(label,detail){var state=$('visionState'),summary=$('visionSummary');if(state)state.textContent=label;if(summary&&detail)summary.textContent=detail;}
  function render(){
    var top=$('aiEyesToggle'),start=$('visionStart'),stop=$('visionStop'),target=$('visionTarget');
    if(top){var label=top.querySelector('span:last-child');if(label)label.textContent=active?'Eyes ON':'Eyes';top.classList.toggle('paused',active);top.setAttribute('aria-pressed',active?'true':'false');top.title=active?'Stop Eye 2.0 now':'Open the finite Eye 2.0 controls';}
    if(start)start.disabled=active||busy;if(stop)stop.disabled=!active&&!busy;if(target)target.disabled=active||busy;
  }
  function openPanel(){var panel=$('visionPanel');if(panel)panel.hidden=false;}
  function closePanel(){var panel=$('visionPanel');if(panel)panel.hidden=true;}
  function receiptCount(){try{var rows=JSON.parse(localStorage.getItem(RECEIPTS_KEY)||'[]');return Array.isArray(rows)?rows.length:0;}catch(error){return 0;}}
  function retainTinyReceipt(receipt,deliveryState){
    if(!receipt)return;var rows=[];try{rows=JSON.parse(localStorage.getItem(RECEIPTS_KEY)||'[]');if(!Array.isArray(rows))rows=[];}catch(error){rows=[];}
    rows.push({schema:'axm.eye2-cleanup-digest/v1',bufferId:receipt.bufferId,openedAt:receipt.openedAt,sealedAt:receipt.sealedAt,cleanedAt:receipt.cleanedAt,framesObserved:receipt.framesObserved,evictedFrames:receipt.evictedFrames,bufferDigest:receipt.bufferDigest,temporaryFramesDeleted:receipt.temporaryFramesDeleted,temporaryBytesReleased:receipt.temporaryBytesReleased,cleanupComplete:receipt.cleanupComplete,rawVideoArchive:false,targetIdentity:targetIdentity,deliveryState:deliveryState||'UNKNOWN'});
    try{localStorage.setItem(RECEIPTS_KEY,JSON.stringify(rows.slice(-20)));}catch(error){}
  }
  function createBuffer(){
    if(!active||!video)return null;if(!window.AXMEphemeralVisionHand)throw new Error('Eye 2.0 rolling-buffer hand is not loaded');
    var capture=window.AXMEphemeralVisionHand.captureVideoFrame(video,{maxWidth:1280,quality:0.7});
    var next=window.AXMEphemeralVisionHand.create({captureFrame:capture,maxFrames:6,maxBytes:4200000});next.start(1000);return next;
  }
  function cleanupBuffer(receipt){if(!buffer)return receipt||null;var current=buffer;buffer=null;return current.cleanup(receipt);}
  function cleanupStream(){
    lifecycle++;if(timer){clearTimeout(timer);timer=null;}if(requestAbort){requestAbort.abort();requestAbort=null;}cleanupBuffer();if(inFlightBuffer){inFlightBuffer.cleanup();inFlightBuffer=null;}
    if(stream){stream.getTracks().forEach(function(track){track.onended=null;track.stop();});}
    stream=null;if(video){video.srcObject=null;}video=null;busy=false;active=false;render();
  }
  function stopEyes(reason){cleanupStream();var detail=reason==='BUDGET SLEEP'?'Finite observation budget complete. All raw rolling frames were released; share again when you want Eye 2.0 to look.':'Screen sharing stopped and the temporary rolling buffer was released.';setState(reason||'OFF',detail);}
  async function captureTurn(){
    if(!active||busy)return;if(remaining<=0){stopEyes('BUDGET SLEEP');return;}
    var turn=lifecycle,cycle=buffer;buffer=null;if(!cycle){try{cycle=createBuffer();buffer=null;}catch(error){setState('VISION ERROR',error.message);cleanupStream();return;}}inFlightBuffer=cycle;
    busy=true;render();setState('OBSERVING SEQUENCE','Eye 2.0 is freezing a bounded time-ordered sequence for '+targetName()+'. No raw video archive is being made.');
    var receipt=null,sheet=null,payload=null;
    try{
      await cycle.captureNow();await cycle.freeze();
      if(cycle.status().frames<2){await new Promise(function(resolve){setTimeout(resolve,260);});await cycle.captureNow();await cycle.freeze();}
      sheet=await cycle.contactSheet({columns:3,cellWidth:320,quality:0.68});
      receipt=await cycle.seal({order:sheet.order,targetIdentity:targetIdentity,observationIndex:observationNo+1});
      if(turn!==lifecycle||!active)return;
      var purpose=('The supplied JPEG is an ephemeral temporal contact sheet. Read tiles left-to-right, then top-to-bottom as successive moments from one shared screen. Judge change, motion, overlays, stale states and interaction consequences across the sequence. '+String($('visionPurpose').value||'')).slice(0,500);
      requestAbort=typeof AbortController==='function'?new AbortController():null;
      var response=await fetch('/api/vision/frame',{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},signal:requestAbort?requestAbort.signal:undefined,body:JSON.stringify({dataUrl:sheet.dataUrl,purpose:purpose,targetIdentity:targetIdentity,activeSurfaceConsent:true,sequence:{schema:'axm.ephemeral-contact-sheet/v1',frames:sheet.frames,order:sheet.order,bufferDigest:receipt.bufferDigest}})});
      sheet.dataUrl='';payload=await response.json();if(!response.ok)throw new Error(payload.error||('vision HTTP '+response.status));
      if(turn!==lifecycle||!active)return;
      observationNo++;remaining--;var summary=payload.observation&&payload.observation.summary||'Temporal sequence observed quietly; no attention notice raised.';if(payload.delivery&&payload.delivery.state==='DELIVERED')summary+='\nDelivered to '+targetName()+' as observation-only candidate context.';else if(payload.delivery&&payload.delivery.state==='HELD')summary+='\nDelivery held: '+(payload.delivery.error||'recipient inbox unavailable')+'.';summary+='\nRaw frames released after digest receipt.';setState('EYES ON · '+remaining+' LEFT',summary);
      if(window.AXMAIPresence&&window.AXMAIPresence.refresh)window.AXMAIPresence.refresh();
    }catch(error){if(sheet)sheet.dataUrl='';if(turn===lifecycle&&active){setState('VISION ERROR',String(error.message||error));cleanupStream();}}
    finally{requestAbort=null;if(cycle){var cleaned=cycle.cleanup(receipt);retainTinyReceipt(cleaned,payload&&payload.delivery&&payload.delivery.state);}if(inFlightBuffer===cycle)inFlightBuffer=null;busy=false;render();}
    if(turn!==lifecycle||!active)return;if(remaining<=0){stopEyes('BUDGET SLEEP');return;}
    try{buffer=createBuffer();}catch(error){setState('VISION ERROR',error.message);cleanupStream();return;}
    timer=setTimeout(captureTurn,Math.max(15000,Number($('visionInterval').value||30)*1000));
  }
  async function startEyes(){
    if(active)return;openPanel();
    if(!window.AXMEphemeralVisionHand){setState('UNAVAILABLE','The Eye 2.0 rolling-buffer hand is not loaded.');return;}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){setState('UNAVAILABLE','This browser does not expose active-screen sharing.');return;}
    try{
      targetIdentity=String($('visionTarget').value||'mirror');
      stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:1,max:2}},audio:false,preferCurrentTab:true});
      video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
      var track=stream.getVideoTracks()[0];if(track)track.onended=function(){stopEyes('SHARING ENDED');};
      remaining=Math.max(1,Math.min(10,Number($('visionBudget').value||4)));observationNo=0;active=true;lifecycle++;buffer=createBuffer();render();setState('EYES ON · '+remaining+' LEFT','Active screen shared for '+targetName()+'. Eye 2.0 is collecting a bounded six-frame rolling sequence in memory.');
      timer=setTimeout(captureTurn,1800);
    }catch(error){cleanupStream();setState(error&&error.name==='NotAllowedError'?'NOT SHARED':'VISION ERROR',error&&error.name==='NotAllowedError'?'You cancelled the screen chooser. Nothing was captured.':String(error.message||error));}
  }
  function topToggle(){if(active||busy)stopEyes('OFF');else openPanel();}
  $('aiEyesToggle').addEventListener('click',topToggle);$('visionStart').addEventListener('click',startEyes);$('visionStop').addEventListener('click',function(){stopEyes('OFF');});$('visionClose').addEventListener('click',closePanel);
  addEventListener('beforeunload',function(){cleanupStream();});render();
  window.AXMVisionLoop={start:startEyes,stop:stopEyes,state:function(){return{active:active,busy:busy,remaining:remaining,observation:observationNo,targetIdentity:targetIdentity,buffer:buffer?buffer.status():null,retainedDigestReceipts:receiptCount(),rawVideoArchive:false};}};
})();
