(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.AXMCodeArtifactBuildWindowPopup=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const STYLE_ID='axm-code-build-window-style-v1';
  let nextId=1;

  function ensureStyles(doc){
    if(doc.getElementById(STYLE_ID)) return;
    const style=doc.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .axm-cbw{border:1px solid #5f6670;border-radius:14px;padding:0;background:#11151a;color:#eef2f6;width:min(1040px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;font:14px/1.4 system-ui,sans-serif}
      .axm-cbw::backdrop{background:rgba(0,0,0,.62)}
      .axm-cbw__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #343a42;position:sticky;top:0;background:#11151a;z-index:2}
      .axm-cbw__title{font-size:18px;font-weight:700;margin:0}.axm-cbw__sub{margin-top:3px;color:#aeb7c2;font-size:12px}
      .axm-cbw__actions{display:flex;gap:8px;flex-wrap:wrap}.axm-cbw button{min-height:36px;padding:7px 11px;border:1px solid #5f6670;border-radius:9px;background:#20262d;color:#f5f7fa;cursor:pointer}.axm-cbw button:disabled{opacity:.5;cursor:not-allowed}
      .axm-cbw__body{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(270px,.85fr);gap:14px;padding:14px}
      .axm-cbw__preview,.axm-cbw__panel{border:1px solid #343a42;border-radius:12px;background:#0b0e12;min-width:0}
      .axm-cbw__preview{min-height:430px;display:flex;flex-direction:column;overflow:hidden}.axm-cbw__previewbar{padding:10px 12px;border-bottom:1px solid #343a42;display:flex;justify-content:space-between;gap:8px;color:#aeb7c2;font-size:12px}.axm-cbw__viewport{flex:1;min-height:360px;display:grid;place-items:center;background:#171b20}.axm-cbw__viewport iframe{border:0;width:100%;height:100%;min-height:360px;background:#fff}.axm-cbw__viewport img{max-width:100%;max-height:520px;object-fit:contain}.axm-cbw__empty{padding:28px;text-align:center;color:#8d98a6}
      .axm-cbw__panel{padding:12px}.axm-cbw__section+ .axm-cbw__section{margin-top:14px}.axm-cbw__section h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9aa5b1;margin:0 0 8px}.axm-cbw__stage{font-size:15px;font-weight:650}.axm-cbw__grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px}.axm-cbw__grid dt{color:#8994a1}.axm-cbw__grid dd{margin:0;overflow-wrap:anywhere}.axm-cbw__pill{display:inline-flex;padding:3px 7px;border:1px solid #4c5662;border-radius:999px;font-size:11px;margin:2px 4px 2px 0}.axm-cbw__truth{color:#bdc6d0;font-size:12px}.axm-cbw__warn{margin-top:8px;padding:8px 10px;border:1px solid #705b36;border-radius:8px;color:#f0d49e;background:#241e15;font-size:12px}
      @media(max-width:760px){.axm-cbw__body{grid-template-columns:1fr}.axm-cbw__preview{min-height:340px}.axm-cbw__viewport iframe{min-height:300px}}
    `;
    doc.head.appendChild(style);
  }

  function el(doc,tag,className,text){
    const n=doc.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=String(text);return n;
  }

  function value(v){return v==null||v===''?'—':String(v)}

  function setSandbox(frame,tokens){
    frame.setAttribute('sandbox',(Array.isArray(tokens)?tokens:[]).join(' '));
    frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('title','AXM candidate artifact preview');
  }

  function renderViewport(handle,preview){
    const doc=handle.document,view=handle.viewport;
    while(view.firstChild)view.removeChild(view.firstChild);
    const p=preview||{};
    handle.previewMode.textContent=value(p.mode||p.result);
    handle.previewIsolation.textContent=value(p.isolation);
    if(p.srcdoc){
      const frame=doc.createElement('iframe');
      setSandbox(frame,p.sandboxTokens);
      frame.srcdoc=String(p.srcdoc);
      view.appendChild(frame);
      handle.frame=frame;
      return;
    }
    if(p.structuralPreview){
      const img=doc.createElement('img');
      img.alt='Prebuild structural twin preview';
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(String(p.structuralPreview));
      view.appendChild(img);
      handle.frame=null;
      return;
    }
    view.appendChild(el(doc,'div','axm-cbw__empty','No renderable artifact body yet. The structural/build state is still visible.'));
    handle.frame=null;
  }

  function addRow(doc,grid,key,val){
    grid.appendChild(el(doc,'dt','',key));grid.appendChild(el(doc,'dd','',value(val)));
  }

  function renderState(handle,state,observation){
    const s=state||{};
    handle.title.textContent=`Build Window · ${value(s.artifact?.artifactId||s.goal||'candidate')}`;
    handle.subtitle.textContent=`${value(s.actorClass)} · revision ${value(s.revision)} · ${value(s.sessionId)}`;
    handle.stage.textContent=value(s.stage);
    const g=handle.metaGrid;while(g.firstChild)g.removeChild(g.firstChild);
    addRow(handle.document,g,'Language',s.artifact?.languageId);
    addRow(handle.document,g,'Kind',s.artifact?.kind);
    addRow(handle.document,g,'MIME',s.artifact?.mime);
    addRow(handle.document,g,'Artifact digest',s.artifact?.digest);
    addRow(handle.document,g,'Plan',s.status?.plan);
    addRow(handle.document,g,'Source generation',s.status?.sourceGeneration);
    addRow(handle.document,g,'Edit program',s.status?.editProgram);
    addRow(handle.document,g,'Admission',s.status?.admission);
    addRow(handle.document,g,'Quick test',observation?.status||s.status?.quickTest);
    const truth=handle.truth;while(truth.firstChild)truth.removeChild(truth.firstChild);
    const facts=[
      'Preview is not verification',
      'Quick test is not promotion',
      'Raw source is not persisted by this popup',
      'Popup has no workspace mutation authority'
    ];
    for(const fact of facts)truth.appendChild(el(handle.document,'span','axm-cbw__pill',fact));
    handle.runtimeWarning.hidden=!(handle.preview?.mode==='BROWSER_QUICK_RUN');
  }

  function buildDialog(doc){
    ensureStyles(doc);
    const dialog=doc.createElement('dialog');dialog.className='axm-cbw';dialog.dataset.axmBuildWindow='v1';dialog.id=`axm-cbw-${nextId++}`;
    const head=el(doc,'div','axm-cbw__head');
    const titles=el(doc,'div');const title=el(doc,'h2','axm-cbw__title','Build Window');const subtitle=el(doc,'div','axm-cbw__sub','');titles.append(title,subtitle);
    const actions=el(doc,'div','axm-cbw__actions');
    const quick=el(doc,'button','','Request quick sandbox test');quick.type='button';
    const close=el(doc,'button','','Close');close.type='button';
    actions.append(quick,close);head.append(titles,actions);
    const body=el(doc,'div','axm-cbw__body');
    const preview=el(doc,'section','axm-cbw__preview');
    const previewBar=el(doc,'div','axm-cbw__previewbar');const previewMode=el(doc,'span','','');const previewIsolation=el(doc,'span','','');previewBar.append(previewMode,previewIsolation);
    const viewport=el(doc,'div','axm-cbw__viewport');preview.append(previewBar,viewport);
    const panel=el(doc,'aside','axm-cbw__panel');
    const stageSection=el(doc,'section','axm-cbw__section');stageSection.append(el(doc,'h3','','Current stage'));const stage=el(doc,'div','axm-cbw__stage','');stageSection.append(stage);
    const metaSection=el(doc,'section','axm-cbw__section');metaSection.append(el(doc,'h3','','Artifact/build state'));const metaGrid=el(doc,'dl','axm-cbw__grid');metaSection.append(metaGrid);
    const truthSection=el(doc,'section','axm-cbw__section');truthSection.append(el(doc,'h3','','Truth boundary'));const truth=el(doc,'div','axm-cbw__truth');truthSection.append(truth);
    const runtimeWarning=el(doc,'div','axm-cbw__warn','Browser quick-run uses an opaque-origin capability sandbox and blocked network, but it is not CPU or memory isolation. Use the disposable host sandbox for stronger quick testing.');runtimeWarning.hidden=true;truthSection.append(runtimeWarning);
    panel.append(stageSection,metaSection,truthSection);body.append(preview,panel);dialog.append(head,body);
    return{dialog,title,subtitle,quick,close,viewport,previewMode,previewIsolation,stage,metaGrid,truth,runtimeWarning};
  }

  function open({document:doc,state,preview,sandboxObservation=null,onQuickTestRequest=null,quickTestEnabled=true}={}){
    doc=doc||(typeof document!=='undefined'?document:null);if(!doc)throw new Error('BUILD_WINDOW_DOCUMENT_REQUIRED');
    const parts=buildDialog(doc);doc.body.appendChild(parts.dialog);
    const handle={document:doc,...parts,state,preview,sandboxObservation,onQuickTestRequest,frame:null};
    parts.quick.disabled=!quickTestEnabled;
    parts.quick.addEventListener('click',()=>{
      const detail={schema:'axm.code.build-window-quick-test-intent.v1',sessionId:handle.state?.sessionId||null,revision:handle.state?.revision||null,stateSha256:handle.state?.stateSha256||null,artifactDigest:handle.state?.artifact?.digest||null,authority:'NONE'};
      if(typeof handle.onQuickTestRequest==='function')handle.onQuickTestRequest(detail);
      parts.dialog.dispatchEvent(new CustomEvent('axm:code-quick-test-request',{detail,bubbles:false,composed:false}));
    });
    parts.close.addEventListener('click',()=>close(handle));
    renderViewport(handle,preview);renderState(handle,state,sandboxObservation);
    if(typeof parts.dialog.showModal==='function')parts.dialog.showModal();else parts.dialog.setAttribute('open','');
    return handle;
  }

  function update(handle,{state,preview,sandboxObservation}={}){
    if(!handle||!handle.dialog||!handle.dialog.isConnected)throw new Error('BUILD_WINDOW_HANDLE_INVALID');
    if(state)handle.state=state;if(preview)handle.preview=preview;if(sandboxObservation!==undefined)handle.sandboxObservation=sandboxObservation;
    if(preview)renderViewport(handle,handle.preview);renderState(handle,handle.state,handle.sandboxObservation);return handle;
  }

  function close(handle){
    if(!handle||!handle.dialog)return;
    if(typeof handle.dialog.close==='function'&&handle.dialog.open)handle.dialog.close();
    handle.dialog.remove();handle.frame=null;
  }

  function sourceSafetyContract(){
    return Object.freeze({
      schema:'axm.code.build-window-popup-safety.v1',
      usesNativeDialog:true,
      persistentStorage:false,
      automaticExecution:false,
      quickTestRequiresExplicitButton:true,
      previewIframeSandboxed:true,
      popupOwnsWorkspaceAuthority:false,
      rawSourceHistory:false,
      authority:'NONE'
    });
  }

  return{open,update,close,sourceSafetyContract};
});
