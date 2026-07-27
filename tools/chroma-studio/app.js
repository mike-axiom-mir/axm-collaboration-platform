(function(){
  'use strict';
  const K=window.AXMChromaKeyer;
  const $=id=>document.getElementById(id);
  const MAX_PIXELS=32*1024*1024,MAX_DIMENSION=8192;
  const ACCEPTED=new Set(['.png','.jpg','.jpeg','.webp']);
  const state={outputMode:'downloads',directory:null,results:[],knownInbox:new Set(),queue:Promise.resolve(),polling:false,watchTimer:null};
  const reasonText={uneven_background:'Background is not one clean colour.',subject_blends_into_background:'The subject blends into the background.',ambiguous_background:'The background would require an unsafe wide cut.',unsupported_format:'Only JPEG, PNG and WebP are supported.',image_too_large_for_local_browser:'Image exceeds the bounded browser-memory ceiling.',decode_failed:'The browser could not decode this image.'};

  function ext(name){const match=/\.[^.]+$/.exec(String(name||'').toLowerCase());return match?match[0]:'';}
  function cleanStem(name){return String(name||'image').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,100)||'image';}
  function outputName(name){return cleanStem(name)+'-transparent.png';}
  function setNotice(message,tone){const node=$('notice');node.textContent=message;node.className='notice'+(tone?' '+tone:'');}
  function setInbox(stateName,detail,tone){$('inboxState').textContent=stateName;$('inboxState').className='state'+(tone?' '+tone:'');$('inboxDetail').textContent=detail;}
  function updateCounts(){
    $('cutCount').textContent=state.results.filter(x=>x.ok&&!x.passThrough).length;
    $('passCount').textContent=state.results.filter(x=>x.ok&&x.passThrough).length;
    $('manualCount').textContent=state.results.filter(x=>!x.ok).length;
    $('savedCount').textContent=state.results.filter(x=>x.saved).length;
  }
  function mimeFor(name,blob){if(blob&&blob.type)return blob.type;const x=ext(name);return x==='.png'?'image/png':x==='.webp'?'image/webp':'image/jpeg';}
  function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG encoding failed')),'image/png'));}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  async function saveNamedBlob(blob,name){
    if(state.outputMode==='folder'&&state.directory){const handle=await state.directory.getFileHandle(name,{create:true}),writer=await handle.createWritable();await writer.write(blob);await writer.close();return 'folder';}
    if(state.outputMode==='downloads'){downloadBlob(blob,name);return 'downloads';}
    return null;
  }
  async function saveResult(result){
    if(!result.ok||result.saved||!result.blob)return false;
    const destination=await saveNamedBlob(result.blob,result.outputName);
    if(!destination)return false;
    result.saved=true;result.destination=destination;renderResults();updateCounts();return true;
  }
  async function savePending(){for(const result of state.results)if(result.ok&&!result.saved)await saveResult(result);}
  function outputReady(label,detail){$('outputState').textContent=label;$('outputState').className='state ok';$('folderName').textContent=detail;$('outputDescription').textContent='New successful cuts save automatically here. You can change this choice at any time.';}
  async function chooseFolder(){
    if(typeof window.showDirectoryPicker!=='function'){setNotice('This browser cannot grant a save folder. Choose Browser Downloads instead.','bad');return;}
    try{state.directory=await window.showDirectoryPicker({mode:'readwrite'});state.outputMode='folder';outputReady('FOLDER READY',state.directory.name);setNotice('Save folder ready. Phone inbox watching can now auto-key and save new photos.','ok');await savePending();pollInbox();}
    catch(error){if(error&&error.name!=='AbortError')setNotice('Save folder was not granted: '+error.message,'bad');}
  }
  async function chooseDownloads(){state.directory=null;state.outputMode='downloads';outputReady('DOWNLOADS READY','Browser Downloads (explicit fallback)');setNotice('Browser Downloads selected explicitly. Your browser may ask before allowing multiple files.','ok');await savePending();pollInbox();}

  function makeResultCard(result){
    const card=document.createElement('article');card.className='result-card axm-panel';
    const preview=document.createElement('div');preview.className='preview';
    if(result.previewUrl){const image=document.createElement('img');image.src=result.previewUrl;image.alt='Preview of '+result.name;preview.appendChild(image);}
    const body=document.createElement('div');body.className='card-body';
    const title=document.createElement('h3');title.textContent=result.name;
    const meta=document.createElement('div');meta.className='card-meta';meta.innerHTML='<span>'+result.source.toUpperCase()+'</span><span>'+result.width+'×'+result.height+'</span>';
    const verdict=document.createElement('div');verdict.className='verdict'+(result.ok?'':' manual');verdict.textContent=result.ok?(result.passThrough?'ALREADY CLEAR':'CUT READY'):'NEEDS MANUAL';
    const reason=document.createElement('p');reason.className='reason';reason.textContent=result.ok?(result.saved?'Saved as '+result.outputName:'Ready, but output is not selected.'):result.reasons.map(x=>reasonText[x]||x).join(' ');
    const actions=document.createElement('div');actions.className='card-actions';
    if(result.ok){const save=document.createElement('button');save.className='axm-btn';save.type='button';save.textContent=result.saved?'SAVED':'SAVE PNG';save.disabled=result.saved;save.onclick=async()=>{try{if(!state.outputMode){setNotice('Output not selected. Choose a save folder or Browser Downloads first.','bad');return;}await saveResult(result);setNotice(result.outputName+' saved.','ok');}catch(error){setNotice('Save failed: '+error.message,'bad');}};actions.appendChild(save);}
    const note=document.createElement('span');note.className='save-note';note.textContent=result.meta&&result.meta.key?'key '+result.meta.key.join(', '):'no cut metadata';actions.appendChild(note);
    body.append(title,meta,verdict,reason,actions);card.append(preview,body);return card;
  }
  function renderResults(){const grid=$('results');grid.innerHTML='';if(!state.results.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No images processed yet.';grid.appendChild(empty);return;}state.results.slice().reverse().forEach(result=>grid.appendChild(makeResultCard(result)));}
  function addFailure(item,reasons,width,height){state.results.push({name:item.file.name,source:item.source,assetId:item.assetId||null,ok:false,passThrough:false,reasons,width:width||0,height:height||0,saved:false,meta:{}});renderResults();updateCounts();}
  async function decode(file){const bitmap=await createImageBitmap(file),width=bitmap.width,height=bitmap.height;if(width>MAX_DIMENSION||height>MAX_DIMENSION||width*height>MAX_PIXELS){bitmap.close();const error=new Error('image_too_large_for_local_browser');error.code='image_too_large_for_local_browser';throw error;}const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);bitmap.close();return{canvas,context,width,height};}
  async function processItem(item){
    if(!ACCEPTED.has(ext(item.file.name))){addFailure(item,['unsupported_format']);return;}
    let decoded;
    try{decoded=await decode(item.file);}catch(error){addFailure(item,[error.code||'decode_failed']);return;}
    const imageData=decoded.context.getImageData(0,0,decoded.width,decoded.height),verdict=K.cutImage(imageData.data,decoded.width,decoded.height);
    if(!verdict.ok){const original=await canvasBlob(decoded.canvas),previewUrl=URL.createObjectURL(original);state.results.push({name:item.file.name,source:item.source,assetId:item.assetId||null,ok:false,passThrough:false,reasons:verdict.reasons,width:decoded.width,height:decoded.height,saved:false,previewUrl,meta:verdict.meta});renderResults();updateCounts();return;}
    decoded.context.putImageData(imageData,0,0);const blob=await canvasBlob(decoded.canvas),result={name:item.file.name,source:item.source,assetId:item.assetId||null,ok:true,passThrough:!!verdict.passThrough,reasons:[],width:decoded.width,height:decoded.height,blob,previewUrl:URL.createObjectURL(blob),outputName:outputName(item.file.name),saved:false,destination:null,meta:verdict.meta};
    state.results.push(result);renderResults();updateCounts();if(state.outputMode)await saveResult(result);
  }
  function enqueue(items){
    state.queue=state.queue.then(async()=>{for(const item of items){setNotice('Processing '+item.file.name+'…');await processItem(item);}setNotice(items.length+' image'+(items.length===1?'':'s')+' processed. Failed cuts were not saved.','ok');}).catch(error=>setNotice('Processing stopped safely: '+error.message,'bad'));
    return state.queue;
  }
  function localFiles(files){const items=Array.from(files||[]).filter(file=>ACCEPTED.has(ext(file.name))).map(file=>({file,source:'local'}));if(!items.length){setNotice('No supported JPEG, PNG or WebP images were selected.','bad');return;}enqueue(items);}
  async function fetchJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Workshop asset index returned '+response.status);return response.json();}
  async function pollInbox(){
    if(state.polling||!$('watchInbox').checked)return;state.polling=true;setInbox('CHECKING','Reading bounded image metadata');
    try{
      const data=await fetchJson('/api/assets/filesystem?q=device-handoff&kind=image&limit=500');
      const rows=(data.assets||[]).filter(row=>String(row.path||'').startsWith('assets/inbox/device-handoff/')&&ACCEPTED.has(ext(row.name))&&!state.knownInbox.has(row.id));
      if(!rows.length){setInbox('WATCHING','No new phone photos','ok');return;}
      if(!state.outputMode){setInbox('OUTPUT NEEDED',rows.length+' phone photo'+(rows.length===1?'':'s')+' waiting','bad');setNotice('Output not selected. '+rows.length+' phone photo'+(rows.length===1?' is':'s are')+' waiting safely in the inbox.','bad');return;}
      const items=[];
      for(const row of rows){const response=await fetch('/api/assets/filesystem/file?id='+encodeURIComponent(row.id),{cache:'no-store'});if(!response.ok)throw new Error(row.name+': inbox file unavailable');const blob=await response.blob(),file=new File([blob],row.name,{type:mimeFor(row.name,blob),lastModified:Date.parse(row.modifiedAt)||Date.now()});state.knownInbox.add(row.id);items.push({file,source:'phone',assetId:row.id,path:row.path});}
      setInbox('RECEIVED',items.length+' new phone photo'+(items.length===1?'':'s'),'ok');await enqueue(items);
    }catch(error){setInbox('UNAVAILABLE',error.message,'bad');}
    finally{state.polling=false;}
  }
  function receipt(){return{schema:'axm.chroma-run-receipt/v1',tool:{id:'chroma-studio',version:'v0.1',status:'TEST'},createdAt:new Date().toISOString(),output:{mode:state.outputMode||'not-selected',name:state.directory?state.directory.name:null,workshopDefault:false},limits:{maxPixels:MAX_PIXELS,maxDimension:MAX_DIMENSION},results:state.results.map(item=>({name:item.name,source:item.source,assetId:item.assetId,verdict:item.ok?(item.passThrough?'PASS_THROUGH':'CUT'):'NEEDS_MANUAL',reasons:item.reasons,dimensions:{width:item.width,height:item.height},outputName:item.ok?item.outputName:null,saved:item.saved,destination:item.destination||null,meta:item.meta})),rawPixelsRetained:false,remoteUpload:false};}
  async function saveReceipt(){const blob=new Blob([JSON.stringify(receipt(),null,2)+'\n'],{type:'application/json'}),name='chroma-run-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';try{if(state.outputMode==='folder')await saveNamedBlob(blob,name);else downloadBlob(blob,name);setNotice('Compact run receipt saved. It contains no raw image pixels.','ok');}catch(error){setNotice('Receipt save failed: '+error.message,'bad');}}
  function clearResults(){for(const result of state.results)if(result.previewUrl)URL.revokeObjectURL(result.previewUrl);state.results=[];renderResults();updateCounts();setNotice('Previews cleared from browser memory. Saved files were not changed.','ok');}

  $('pickFolder').onclick=chooseFolder;$('useDownloads').onclick=chooseDownloads;$('pickFiles').onclick=()=>$('fileInput').click();$('fileInput').onchange=event=>localFiles(event.target.files);$('receiptBtn').onclick=saveReceipt;$('clearResults').onclick=clearResults;$('checkInbox').onclick=pollInbox;$('watchInbox').onchange=()=>{if($('watchInbox').checked)pollInbox();else setInbox('PAUSED','Phone inbox polling is off');};
  const drop=$('dropZone');drop.onclick=()=>$('fileInput').click();drop.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('fileInput').click();}};['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('hot');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('hot');}));drop.addEventListener('drop',event=>localFiles(event.dataTransfer.files));
  state.watchTimer=setInterval(pollInbox,2500);window.addEventListener('beforeunload',()=>{clearInterval(state.watchTimer);for(const result of state.results)if(result.previewUrl)URL.revokeObjectURL(result.previewUrl);});
  renderResults();updateCounts();pollInbox();
})();
