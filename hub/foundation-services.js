(function(){
  'use strict';
  var Core=window.AXMFoundationServices;if(!Core)return;
  var state=Core.create(),busy=false,timer=null,probeFailures=Object.create(null),retrying=new Set();
  var $=function(id){return document.getElementById(id);};
  function now(){return new Date().toISOString();}
  function fetchTimed(url,ms,options){
    var c=new AbortController(),t=setTimeout(function(){c.abort();},ms||2600),o=Object.assign({cache:'no-store'},options||{});o.signal=c.signal;
    return fetch(url,o).finally(function(){clearTimeout(t);});
  }
  async function json(url,ms){var r=await fetchTimed(url,ms);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  async function text(url,ms){var r=await fetchTimed(url,ms);if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}
  function apply(id,result){
    var event=Object.assign({type:'PROBE',id:id,at:now()},result),failed=!!event.probeFailure;
    delete event.probeFailure;
    if(!failed){probeFailures[id]=0;retrying.delete(id);}
    state=Core.reduce(state,event);
  }
  function failure(id,error){
    var previous=state.services[id],count=Number(probeFailures[id]||0)+1,message=String(error&&error.message||error).slice(0,120);
    probeFailures[id]=count;
    if(count===1&&previous&&previous.lastCheckedAt&&['READY','AVAILABLE','PAUSED'].indexOf(previous.state)>=0){
      retrying.add(id);
      apply(id,{state:previous.state,detail:'Probe retrying · last observed '+previous.state+' · '+message,meta:{lines:(previous.meta&&previous.meta.lines||[]).slice(0,4).concat(['transient probe miss · retry pending'])},probeFailure:true});
      return;
    }
    retrying.delete(id);
    apply(id,{state:'OFFLINE',detail:'Probe unavailable after retry · '+message,meta:{lines:['still represented','not retired','two consecutive probe misses']},probeFailure:true});
  }
  async function probeFoundationBundle(){
    var source=await text('/launcher/axm-foundation.js',2200),installed=/AXMWisdom/.test(source)&&/AXMIdentity/.test(source)&&/AXMGate/.test(source)&&/AXMStore/.test(source);
    ['wisdom','identity','gate','storage'].forEach(function(id){
      var globalName={wisdom:'AXMWisdom',identity:'AXMIdentity',gate:'AXMGate',storage:'AXMStore'}[id],mounted=!!window[globalName];
      apply(id,{state:mounted?'READY':installed?'AVAILABLE':'OFFLINE',detail:mounted?'Mounted in this workspace':'Foundation bundle installed · activates in participating workspaces',meta:{lines:[mounted?'mounted now':'per-workspace service','local foundation']}});
    });
  }
  async function probeRuntime(){var p=await json('/api/health',2000);apply('runtime',{state:p.ok?'READY':'DEGRADED',detail:p.ok?'Local Hub runtime responding':'Runtime answered without a healthy receipt',meta:{lines:[p.version||'version unknown',p.host||'local host']}});}
  async function probeGuardian(){var p=await json('/api/shell-guardian/status',2000),g=p.status||{};apply('guardian',{state:g.tripped?'TRIPPED':'READY',detail:g.tripped?('Circuit breaker tripped · '+(g.reason||'review required')):'Circuit breaker armed · audit history retained',meta:{lines:['trips '+Number(g.tripCount||0),'resets '+Number(g.resetCount||0)]}});}
  async function probeMirror(){var p=await json('/api/mirror-core/status',2200),m=p.status||{};apply('mirror',{state:m.running?'READY':m.installed?'AVAILABLE':'OFFLINE',detail:m.running?'Isolated Mirror runtime responding · live adapters remain disabled':m.installed?'Installed · explicit start only · no live apply authority':'Mirror Core package unavailable',meta:{lines:[m.running?'runtime running':'runtime stopped',m.liveWorkshopApply?'live Workshop apply enabled':'live Workshop apply off',m.liveWorldApply?'live world apply enabled':'live world apply off']}});}
  async function probePlugins(){var values=await Promise.all([json('/api/tools',2500),text('/launcher/axm-registry.js',2200)]),tools=values[0].tools||[],installed=/AXMRegistry/.test(values[1]);apply('plugins',{state:installed?'READY':'DEGRADED',detail:tools.length+' module manifests discovered · compatibility routes retained',meta:{lines:['registry '+(installed?'installed':'missing'),tools.length+' modules']}});}
  async function probeBackup(){var p=await json('/api/workshop-packages',2600),packs=p.packages||[];apply('backup',{state:p.active?'DEGRADED':'READY',detail:p.active?'Package job running':'Backup and public-safe packaging engine ready',meta:{lines:[packs.length+' packages',p.active?'busy':'idle']}});}
  async function probeConnectors(){
    var probes=await Promise.allSettled([json('/api/presence',2000),json('/api/chatgpt-connector/status',2600),json('/api/grok/status',2200),json('http://127.0.0.1:8787/health',2200)]);
    var presence=probes[0].status==='fulfilled'?(probes[0].value.members||[]):[],chat=probes[1].status==='fulfilled'?(probes[1].value.status||{}):{},grok=probes[2].status==='fulfilled'?(probes[2].value.status||{}):{},bridge=probes[3].status==='fulfilled';
    var chatReady=!!(chat.codingSeat&&chat.codingSeat.loginVerified),grokReady=!!(grok.installed&&(grok.authenticated||grok.state==='ready'||grok.state==='active'));
    var disconnected=[];if(!bridge)disconnected.push('Bridge OFF');if(!chatReady)disconnected.push('Codex login unavailable');if(grok.installed&&!grokReady)disconnected.push('Grok OFF');
    var paused=$('aiMasterToggle')&&$('aiMasterToggle').getAttribute('aria-pressed')==='true';
    var connectorState=paused?'PAUSED':bridge?'READY':presence.length?'DEGRADED':'OFFLINE';
    apply('connectors',{state:connectorState,detail:(bridge?'Bridge responding':'Bridge disconnected')+' · '+presence.length+' live heartbeat'+(presence.length===1?'':'s')+(disconnected.length?' · '+disconnected.join(' · '):''),meta:{lines:presence.slice(0,5).map(function(m){return m.name+' '+String(m.state||'present').toUpperCase();}).concat(disconnected).slice(0,7)}});
  }
  function controls(def,service){
    var out=[];
    if(def.control==='permissions')out.push({action:'permissions',label:'Open permissions'});
    if(def.control==='dashboards')out.push({action:'dashboards',label:'Show dashboards'});
    if(def.control==='agents')out.push({action:'agents',label:service.state==='PAUSED'?'Resume AI agents':'Pause AI agents'});
    if(def.control==='guardian'&&service.state==='TRIPPED')out.push({action:'guardian-reset',label:'Human reset',danger:true});
    if(def.control==='mirror'){
      if(service.state==='READY')out.push({action:'mirror-open',label:'Open Mirror dashboard'});
      out.push({action:service.state==='READY'?'mirror-stop':'mirror-start',label:service.state==='READY'?'Stop isolated runtime':'Start isolated runtime'});
    }
    if(def.dashboard)out.push({action:'open',label:'Open '+(def.dashboard==='ai-team'?'AI Team':'Publish & Library')});
    return out;
  }
  function render(){
    var s=Core.summary(state),button=$('foundationToggle'),count=$('foundationCount'),root=$('foundationGrid');
    var retryCount=retrying.size;
    if(button){button.className='foundation-summary '+(s.attention?'bad':retryCount?'retrying':s.checking?'':'ready');button.setAttribute('aria-label','Foundation services: '+s.healthy+' healthy, '+s.attention+' need attention'+(retryCount?', '+retryCount+' probes retrying':''));button.innerHTML='<span>Foundation</span> '+(s.checking?'checking':s.healthy+'/'+s.total)+(s.attention?' · '+s.attention+'!':retryCount?' · '+retryCount+' retry':'');}
    if(count){count.textContent=s.checking?'CHECKING':s.attention?(s.attention+' NEED ATTENTION'):(s.healthy+'/'+s.total+' HEALTHY'+(retryCount?' · '+retryCount+' RETRYING':''));count.style.color=s.attention?'var(--red)':retryCount?'var(--gold)':'var(--green)';}
    if(!root)return;root.innerHTML='';
    Core.definitions.forEach(function(def){
      var service=state.services[def.id],card=document.createElement('article');card.className='foundation-service';card.dataset.service=def.id;card.dataset.tone=Core.tone(service.state);
      card.innerHTML='<div class="foundation-service-head"><div><h3></h3><div class="foundation-group"></div></div><span class="foundation-state"></span></div><div class="foundation-detail"></div><div class="foundation-meta"></div><div class="foundation-controls"></div>';
      card.querySelector('h3').textContent=def.name;card.querySelector('.foundation-group').textContent=def.group;card.querySelector('.foundation-state').textContent=service.state;card.querySelector('.foundation-detail').textContent=service.detail;
      var meta=card.querySelector('.foundation-meta');(service.meta.lines||[]).forEach(function(line){var chip=document.createElement('span');chip.textContent=line;meta.appendChild(chip);});
      var ctl=card.querySelector('.foundation-controls'),items=controls(def,service);
      if(!items.length){var stable=document.createElement('span');stable.className='foundation-control-result';stable.textContent='Status only · no stop control';ctl.appendChild(stable);}
      items.forEach(function(item){var b=document.createElement('button');b.type='button';b.textContent=item.label;b.dataset.action=item.action;b.dataset.service=def.id;if(item.danger)b.className='danger';b.onclick=function(){runControl(def,item.action);};ctl.appendChild(b);});
      if(service.control){var result=document.createElement('span');result.className='foundation-control-result';result.textContent=service.control.state+' · '+service.control.action+(service.control.detail?' · '+service.control.detail:'');ctl.appendChild(result);}
      root.appendChild(card);
    });
  }
  async function runControl(def,action){
    state=Core.reduce(state,{type:'CONTROL_REQUESTED',id:def.id,action:action,at:now()});render();
    try{
      if(action==='permissions')window.AXMHubShell.openPerm();
      else if(action==='dashboards')window.AXMHubShell.openModules();
      else if(action==='open')window.AXMHubShell.open(def.dashboard);
      else if(action==='agents'){if(!window.AXMAIPresence)throw new Error('AI gate unavailable');await window.AXMAIPresence.toggle();}
      else if(action==='guardian-reset'){
        if(!confirm('Reset the Shell Guardian circuit breaker? Audit history will be kept.'))throw new Error('cancelled');
        var r=await fetchTimed('/api/shell-guardian/reset',2600,{method:'POST',headers:{'x-axm-guardian':'human-reset'}});if(!r.ok)throw new Error('HTTP '+r.status);
      }
      else if(action==='mirror-open')window.open('/services/mirror-core/','_blank','noopener');
      else if(action==='mirror-start'||action==='mirror-stop'){
        var mirrorAction=action==='mirror-start'?'explicit-start':'explicit-stop';
        var mirrorResponse=await fetchTimed('/api/mirror-core/'+(action==='mirror-start'?'start':'stop'),4200,{method:'POST',headers:{'x-axm-mirror-action':mirrorAction}});if(!mirrorResponse.ok)throw new Error('HTTP '+mirrorResponse.status);
      }
      state=Core.reduce(state,{type:'CONTROL_RESULT',id:def.id,action:action,ok:true,detail:'completed',at:now()});
      if(action==='permissions'||action==='dashboards'||action==='open')$('foundationScreen').classList.remove('show');
      await refresh();
    }catch(error){state=Core.reduce(state,{type:'CONTROL_RESULT',id:def.id,action:action,ok:false,detail:String(error.message||error),at:now()});render();}
  }
  async function refresh(){
    if(busy)return;busy=true;
    var jobs=[probeFoundationBundle().catch(function(e){['wisdom','identity','gate','storage'].forEach(function(id){failure(id,e);});}),probeRuntime().catch(function(e){failure('runtime',e);}),probeGuardian().catch(function(e){failure('guardian',e);}),probeMirror().catch(function(e){failure('mirror',e);}),probePlugins().catch(function(e){failure('plugins',e);}),probeBackup().catch(function(e){failure('backup',e);}),probeConnectors().catch(function(e){failure('connectors',e);})];
    await Promise.all(jobs);busy=false;render();clearTimeout(timer);timer=setTimeout(refresh,12000);
  }
  function init(){
    $('foundationToggle').onclick=function(){$('foundationScreen').classList.add('show');refresh();};
    $('foundationRefresh').onclick=refresh;
    window.AXMFoundationServicePlane={refresh:refresh,state:function(){return JSON.parse(JSON.stringify(state));}};
    render();refresh();
  }
  init();
})();
