(function(){
  'use strict';
  var O=window.AXMOps;
  var notice=document.getElementById('notice');
  var lastSnapshot=null;
  var sourceCatalog=null;

  function stateClass(value){return 'state-'+String(value||'unknown').toLowerCase().replace(/_/g,'-');}
  function chip(value){return '<span class="state-chip '+stateClass(value)+'">'+O.esc(String(value||'UNKNOWN').replace(/_/g,' '))+'</span>';}
  function metric(label,value){return '<div class="metric"><span>'+O.esc(label)+'</span><strong>'+O.esc(value)+'</strong></div>';}
  function date(value){return value?O.date(value):'Not recorded';}
  function result(promise){return promise.then(function(value){return {ok:true,value:value};},function(error){return {ok:false,error:error};});}

  function probeSummary(probe){
    if(probe.issue&&probe.issue.message)return probe.issue.message;
    if(!probe.evidence)return probe.state==='NOT_CONFIGURED'?'No host adapter is configured for this optional probe.':'No evidence payload returned.';
    var keys=Object.keys(probe.evidence);
    return keys.length?'Evidence fields: '+keys.slice(0,5).join(', ')+(keys.length>5?' +'+(keys.length-5):''):'Probe returned an empty evidence object.';
  }

  function renderSnapshot(snapshot){
    lastSnapshot=snapshot;
    var stateChip=document.getElementById('stateChip');
    stateChip.className='state-chip '+stateClass(snapshot.state);
    stateChip.textContent=snapshot.state;
    document.getElementById('checked').textContent='Observed '+date(snapshot.checkedAt)+' / schema '+snapshot.schema;
    var recovery=snapshot.operations.recovery||{},assets=snapshot.operations.assets||{},exports=snapshot.operations.diagnosticExports||{};
    document.getElementById('facts').innerHTML=[
      metric('Snapshot',snapshot.state),
      metric('Configured probes',snapshot.coverage.configured+' / '+snapshot.coverage.total),
      metric('Unavailable',snapshot.coverage.counts.UNAVAILABLE),
      metric('Modules',snapshot.modules.count==null?'Unknown':snapshot.modules.count),
      metric('Recovery snapshots',recovery.snapshots==null?'Unknown':recovery.snapshots),
      metric('Export receipts',exports.count==null?'Unknown':exports.count)
    ].join('');
    var coverage=snapshot.coverage;
    document.getElementById('coverageBanner').innerHTML=chip('HEALTHY')+' '+coverage.counts.HEALTHY+' healthy '+chip('DEGRADED')+' '+coverage.counts.DEGRADED+' degraded '+chip('UNAVAILABLE')+' '+coverage.counts.UNAVAILABLE+' unavailable '+chip('NOT_CONFIGURED')+' '+coverage.counts.NOT_CONFIGURED+' optional source(s) not configured';

    document.getElementById('issueCount').textContent=snapshot.issues.length+' signal'+(snapshot.issues.length===1?'':'s');
    document.getElementById('issues').innerHTML=snapshot.issues.length?snapshot.issues.map(function(issue){
      return '<div class="issue '+O.esc(issue.severity)+'"><span class="issue-dot" aria-hidden="true"></span><div><b>'+O.esc(issue.area)+' / '+O.esc(issue.code)+'</b><p>'+O.esc(issue.message)+'</p></div></div>';
    }).join(''):'<div class="empty-state">No current diagnostic issue signal. This is an observation, not a certification.</div>';

    document.getElementById('probeLegend').innerHTML=['HEALTHY','DEGRADED','UNAVAILABLE','NOT_CONFIGURED'].map(chip).join('');
    document.getElementById('probeGrid').innerHTML=snapshot.probes.map(function(probe){
      return '<article class="probe-card" data-state="'+O.esc(probe.state)+'"><div class="probe-card-head"><h3>'+O.esc(probe.label)+'</h3>'+chip(probe.state)+'</div><p>'+O.esc(probeSummary(probe))+'</p><div class="probe-meta"><span>'+(probe.required?'REQUIRED':'OPTIONAL')+'</span><span>'+probe.durationMs+' ms</span></div></article>';
    }).join('');

    var jobs=snapshot.operations.machineHost&&snapshot.operations.machineHost.recent||[];
    document.getElementById('jobs').innerHTML=jobs.length?jobs.map(function(job){
      return '<tr><td>'+O.esc(job.action)+'</td><td>'+chip(job.state)+'</td><td>'+O.esc(date(job.startedAt))+'</td><td>'+O.esc(date(job.endedAt))+'</td></tr>';
    }).join(''):'<tr><td colspan="4">No recent allowlisted jobs.</td></tr>';
    document.getElementById('operations').textContent=O.pretty(snapshot.operations);
  }

  function renderSources(catalog){
    sourceCatalog=catalog;
    var select=document.getElementById('logKind'),previous=select.value;
    select.innerHTML=catalog.sources.map(function(source){return '<option value="'+O.esc(source.id)+'" '+(source.configured?'':'disabled')+'>'+O.esc(source.label)+' / '+O.esc(source.state.replace(/_/g,' '))+'</option>';}).join('');
    var available=catalog.sources.filter(function(source){return source.configured;});
    if(available.some(function(source){return source.id===previous;}))select.value=previous;
    else if(available.length)select.value=available[0].id;
    document.getElementById('loadLog').disabled=!available.length;
    document.getElementById('logSourceSummary').textContent=available.length+' / '+catalog.sources.length+' configured';
  }

  function renderExports(lineage){
    document.getElementById('exportCount').textContent=lineage.count+' receipt'+(lineage.count===1?'':'s');
    document.getElementById('exportRows').innerHTML=lineage.exports.length?lineage.exports.slice(0,20).map(function(receipt){
      return '<tr><td>'+O.esc(date(receipt.createdAt))+'</td><td>'+chip(receipt.snapshotState)+'</td><td>'+O.esc(O.bytes(receipt.bytes))+'</td><td><code>'+O.esc(receipt.sha256)+'</code></td></tr>';
    }).join(''):'<tr><td colspan="4">No diagnostic reports exported.</td></tr>';
  }

  function load(){
    document.getElementById('refresh').disabled=true;
    return Promise.all([
      result(O.get('/api/diagnostics')),
      result(O.get('/api/diagnostics/log-sources')),
      result(O.get('/api/diagnostics/exports'))
    ]).then(function(results){
      var failures=[];
      if(results[0].ok)renderSnapshot(results[0].value);else failures.push('snapshot: '+results[0].error.message);
      if(results[1].ok)renderSources(results[1].value);else failures.push('log catalog: '+results[1].error.message);
      if(results[2].ok)renderExports(results[2].value);else failures.push('export lineage: '+results[2].error.message);
      if(failures.length)O.notice(notice,'Some diagnostic surfaces are unavailable / '+failures.join(' / '),'warn');
    }).finally(function(){document.getElementById('refresh').disabled=false;});
  }

  document.getElementById('refresh').onclick=load;
  document.getElementById('loadLog').onclick=function(){
    var kind=document.getElementById('logKind').value,button=document.getElementById('loadLog');
    if(!kind)return;
    button.disabled=true;
    document.getElementById('logMeta').textContent='Loading the bounded redacted envelope...';
    O.get('/api/diagnostics/logs?kind='+encodeURIComponent(kind)+'&bytes=80000').then(function(envelope){
      document.getElementById('log').textContent=envelope.text||'The observed source has no retained entries.';
      document.getElementById('logMeta').textContent=envelope.bytesReturned+' bytes / SHA-256 '+envelope.contentSha256+' / '+envelope.safety.structuredFieldsRedacted+' structured fields and '+envelope.safety.patternMatchesRedacted+' patterns redacted / secret-free certification: NO';
    }).catch(function(error){O.notice(notice,error.message,'bad');document.getElementById('logMeta').textContent='Log envelope unavailable.';}).finally(function(){button.disabled=!(sourceCatalog&&sourceCatalog.sources.some(function(source){return source.id===kind&&source.configured;}));});
  };
  document.getElementById('export').onclick=function(){
    var button=document.getElementById('export');button.disabled=true;
    O.post('/api/diagnostics/export',{}, {'x-axm-diagnostics':'explicit-export'}).then(function(receipt){
      O.notice(notice,'Report and receipt saved / '+receipt.id+' / SHA-256 '+receipt.sha256,'ok');
      return Promise.all([O.get('/api/diagnostics/exports').then(renderExports),O.get('/api/diagnostics').then(renderSnapshot)]);
    }).catch(function(error){O.notice(notice,error.message,'bad');}).finally(function(){button.disabled=false;});
  };
  load();
})();
