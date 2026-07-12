(function(){
  'use strict';
  var stream=null,video=null,canvas=null,timer=null,busy=false,active=false,remaining=0,frameNo=0;
  function $(id){return document.getElementById(id);}
  function setState(label,detail){
    var state=$('visionState'),summary=$('visionSummary');if(state)state.textContent=label;if(summary&&detail)summary.textContent=detail;
  }
  function render(){
    var top=$('aiEyesToggle'),start=$('visionStart'),stop=$('visionStop');
    if(top){top.textContent=active?'◉ Eyes ON':'◉ Eyes';top.classList.toggle('paused',active);top.setAttribute('aria-pressed',active?'true':'false');top.title=active?'Stop Claude shared vision now':'Share the active AXM screen with Claude on a finite heartbeat';}
    if(start)start.disabled=active||busy;if(stop)stop.disabled=!active&&!busy;
  }
  function openPanel(){var panel=$('visionPanel');if(panel)panel.hidden=false;}
  function closePanel(){var panel=$('visionPanel');if(panel)panel.hidden=true;}
  function cleanupStream(){
    if(timer){clearTimeout(timer);timer=null;}
    if(stream){stream.getTracks().forEach(function(track){track.onended=null;track.stop();});}
    stream=null;if(video){video.srcObject=null;}video=null;canvas=null;busy=false;active=false;render();
  }
  function stopEyes(reason){cleanupStream();setState(reason||'OFF',reason==='BUDGET SLEEP'?'Finite frame budget complete. Share again when you want Claude to look.':'Screen sharing stopped.');}
  function frameData(){
    if(!video||!video.videoWidth||!video.videoHeight)throw new Error('shared screen has no video frame yet');
    var maxWidth=1280,scale=Math.min(1,maxWidth/video.videoWidth),width=Math.max(320,Math.round(video.videoWidth*scale)),height=Math.max(180,Math.round(video.videoHeight*scale));
    if(!canvas)canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    var ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(video,0,0,width,height);
    return canvas.toDataURL('image/jpeg',0.76);
  }
  async function captureTurn(){
    if(!active||busy)return;if(remaining<=0){stopEyes('BUDGET SLEEP');return;}
    busy=true;render();setState('LOOKING', 'Claude is receiving frame '+(frameNo+1)+'. The screen is observation-only.');
    try{
      var response=await fetch('/api/vision/frame',{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({dataUrl:frameData(),purpose:$('visionPurpose').value})});
      var payload=await response.json();if(!response.ok)throw new Error(payload.error||('vision HTTP '+response.status));
      frameNo++;remaining--;setState('EYES ON · '+remaining+' LEFT',payload.observation&&payload.observation.summary||'Frame observed quietly; no attention notice raised.');
      if(window.AXMAIPresence&&window.AXMAIPresence.refresh)window.AXMAIPresence.refresh();
    }catch(error){setState('VISION ERROR',error.message);cleanupStream();return;}
    busy=false;render();if(remaining<=0){stopEyes('BUDGET SLEEP');return;}
    timer=setTimeout(captureTurn,Math.max(15000,Number($('visionInterval').value||30)*1000));
  }
  async function startEyes(){
    if(active)return;openPanel();
    if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){setState('UNAVAILABLE','This browser does not expose active-screen sharing.');return;}
    try{
      stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:1,max:2}},audio:false,preferCurrentTab:true});
      video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
      var track=stream.getVideoTracks()[0];if(track)track.onended=function(){stopEyes('SHARING ENDED');};
      remaining=Math.max(1,Math.min(10,Number($('visionBudget').value||4)));frameNo=0;active=true;render();setState('EYES ON · '+remaining+' LEFT','Active screen shared by Mike. First deliberate screenshot is being prepared.');
      setTimeout(captureTurn,350);
    }catch(error){cleanupStream();setState(error&&error.name==='NotAllowedError'?'NOT SHARED':'VISION ERROR',error&&error.name==='NotAllowedError'?'You cancelled the screen chooser. Nothing was captured.':String(error.message||error));}
  }
  function topToggle(){if(active||busy)stopEyes('OFF');else openPanel();}
  $('aiEyesToggle').addEventListener('click',topToggle);$('visionStart').addEventListener('click',startEyes);$('visionStop').addEventListener('click',function(){stopEyes('OFF');});$('visionClose').addEventListener('click',closePanel);
  addEventListener('beforeunload',function(){cleanupStream();});render();
  window.AXMVisionLoop={start:startEyes,stop:stopEyes,state:function(){return{active:active,busy:busy,remaining:remaining,frame:frameNo};}};
})();
