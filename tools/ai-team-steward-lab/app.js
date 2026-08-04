(function(){
  'use strict';
  var state={catalog:null,operations:null,sampleVariant:null};
  function $(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function announce(message){$('announcer').textContent='';setTimeout(function(){$('announcer').textContent=message;},20);}
  function riskPill(risk){return'<span class="pill '+esc(String(risk).toLowerCase())+'">'+esc(risk)+'</span>';}
  function card(row,planned){return'<article class="seed-card">'+
    '<div class="seed-meta"><span class="pill">SEED '+esc(row.seedNumber)+'</span>'+riskPill(row.riskTier)+(row.localIntegrationStatus==='LOCAL_PREFLIGHT_AVAILABLE'?'<span class="pill local">LOCAL PREFLIGHT</span>':'')+(planned?'<span class="pill">SCORE '+esc(row.score)+'</span>':'')+'</div>'+
    '<h3>'+esc(row.name)+'</h3><div class="seed-id">'+esc(row.moduleId)+'</div>'+
    '<p class="focus">'+esc(row.capabilityFocus)+'</p><p class="hold"><strong>Hold when:</strong> '+esc(row.holdRule)+'</p>'+
    '<p class="seam"><strong>Candidate owner seam:</strong> '+esc(row.ownerSeamCandidate)+'</p>'+
    '<a href="'+esc(row.sourceUrl)+'">Inspect source registry</a></article>';}
  function renderCatalog(){
    if(!state.catalog)return;
    var query=$('search').value.trim().toLowerCase(),family=$('familyFilter').value,risk=$('riskFilter').value;
    var rows=state.catalog.entries.filter(function(row){
      var hay=[row.name,row.moduleId,row.familyLabel,row.capabilityFocus,row.criticalInvariant,row.holdRule,row.ownerSeamCandidate].join(' ').toLowerCase();
      return(!query||hay.indexOf(query)>=0)&&(!family||row.family===family)&&(!risk||row.riskTier===risk);
    });
    $('visibleCount').textContent=rows.length;
    $('catalogList').innerHTML=rows.length?rows.map(function(row){return card(row,false);}).join(''):'<p class="empty">No seed contracts match these filters.</p>';
  }
  function selectedGoals(){
    var goals=Array.prototype.slice.call(document.querySelectorAll('#goalGrid input:checked')).map(function(input){return input.value;});
    var custom=$('customGoal').value.trim();if(custom)goals.push(custom);return goals;
  }
  async function buildPlan(){
    var button=$('buildPlan'),goals=selectedGoals();
    if(!goals.length){$('planResult').innerHTML='<p class="empty">Choose at least one concern or add a short description.</p>';announce('Plan needs at least one concern.');return;}
    button.disabled=true;$('planResult').innerHTML='<p class="empty">Building a bounded review plan…</p>';
    try{
      var response=await fetch('/api/ai-team-steward/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({goals:goals,riskCeiling:$('riskCeiling').value,maxRecommendations:Number($('maxRecommendations').value)})});
      var body=await response.json();if(!response.ok)throw new Error(body.error||('HTTP '+response.status));
      var summary='<div class="plan-summary"><span class="pill">REVIEW ONLY</span><span class="pill">AUTHORITY NONE</span><span class="pill">'+esc(body.filters.riskCeiling)+' CEILING</span></div>';
      $('planResult').innerHTML='<h3>'+body.recommendations.length+' seed contracts recommended for review</h3>'+summary+(body.recommendations.length?'<div class="plan-grid">'+body.recommendations.map(function(row){return card(row,true);}).join('')+'</div>':'<p class="empty">No contracts matched within this risk ceiling.</p>');
      announce('Review plan ready with '+body.recommendations.length+' recommendations.');
    }catch(error){$('planResult').innerHTML='<p class="empty">Plan unavailable: '+esc(error.message||error)+'</p>';announce('Review plan unavailable.');}
    finally{button.disabled=false;}
  }
  async function post(url,body){
    var response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),parsed=await response.json();
    if(!response.ok)throw new Error(parsed.error||('HTTP '+response.status));return parsed;
  }
  function renderPreflight(result){
    var passed=result.ok===true,heading=passed?'PASS · packet clears local preflight':'HOLD · packet needs repair';
    var findings=(result.findings||[]).map(function(item){return'<li><code>'+esc(item.code)+'</code><span>'+esc(item.guidance)+'</span></li>';}).join('');
    $('preflightResult').className='preflight-result '+(passed?'pass':'hold');
    $('preflightResult').innerHTML='<div class="preflight-heading"><h3>'+heading+'</h3><span class="status '+(passed?'runtime-ready':'runtime-hold')+'">'+esc(result.status)+'</span></div>'+
      '<p><strong>'+esc(result.seed.name)+'</strong> · '+esc(result.seed.family.replace(/_/g,' '))+' · '+esc(result.seed.riskTier)+'</p>'+
      (findings?'<ul class="finding-list">'+findings+'</ul>':'<p>No family or binding violations were found in this packet.</p>')+
      '<p class="runtime-boundary">Observed: local contract preflight only. No live agent, provider, connector, authority, file, merge, approval, or CANON action occurred.</p>';
    announce(heading+'. '+(result.errorCodes||[]).length+' findings.');
  }
  async function loadSample(variant){
    var moduleId=$('preflightModule').value;if(!moduleId)return;
    $('preflightResult').className='preflight-result';$('preflightResult').innerHTML='<p class="empty">Loading '+esc(variant)+' sample…</p>';
    try{
      var sample=await post('/api/ai-team-steward/sample',{moduleId:moduleId,variant:variant});
      state.sampleVariant=sample.variant;$('preflightInput').value=JSON.stringify(sample.fixture,null,2);
      $('preflightResult').innerHTML='<p class="empty">'+esc(sample.variant)+' sample loaded. Run preflight to observe the validator result.</p>';
      announce(sample.variant+' sample loaded.');
    }catch(error){$('preflightResult').innerHTML='<p class="empty">Sample unavailable: '+esc(error.message||error)+'</p>';announce('Sample unavailable.');}
  }
  async function runPreflight(){
    var fixture;try{fixture=JSON.parse($('preflightInput').value);}catch(error){$('preflightResult').className='preflight-result hold';$('preflightResult').innerHTML='<p class="empty">HOLD · packet JSON is invalid: '+esc(error.message||error)+'</p>';announce('Packet JSON is invalid.');return;}
    var button=$('runPreflight');button.disabled=true;$('preflightResult').className='preflight-result';$('preflightResult').innerHTML='<p class="empty">Running retained guardrail logic locally…</p>';
    try{renderPreflight(await post('/api/ai-team-steward/validate',{moduleId:$('preflightModule').value,fixture:fixture}));}
    catch(error){$('preflightResult').innerHTML='<p class="empty">Preflight unavailable: '+esc(error.message||error)+'</p>';announce('Preflight unavailable.');}
    finally{button.disabled=false;}
  }
  function selectedOperation(){
    if(!state.operations)return null;
    return state.operations.operations.find(function(row){return row.id===$('operationSelect').value;})||null;
  }
  function loadOperationExample(variant){
    var operation=selectedOperation(),input=operation&&operation.examples?operation.examples[variant]:null;
    if(!operation||!input){$('operationResult').className='preflight-result hold';$('operationResult').innerHTML='<p class="empty">No '+esc(variant.toUpperCase())+' example is defined for this operation.</p>';announce('No '+variant+' operation example is available.');return;}
    $('operationInput').value=JSON.stringify(input,null,2);
    $('operationResult').className='preflight-result';$('operationResult').innerHTML='<p class="empty">'+esc(variant.toUpperCase())+' example loaded. Run the operation to calculate its result.</p>';
    announce(variant+' operation example loaded.');
  }
  function syncOperation(){
    var operation=selectedOperation();if(!operation)return;
    $('operationHelp').textContent=operation.family.replace(/_/g,' ')+' · retained source: '+operation.source;
    $('loadHeldOperation').disabled=!operation.examples.held;
    loadOperationExample('ready');
  }
  function renderOperation(response){
    var passed=response.ok===true,heading=(passed?'READY':'HOLD')+' · '+response.operation.name;
    $('operationResult').className='preflight-result '+(passed?'pass':'hold');
    $('operationResult').innerHTML='<div class="preflight-heading"><h3>'+esc(heading)+'</h3><span class="status '+(passed?'runtime-ready':'runtime-hold')+'">'+(passed?'READY':'HOLD')+'</span></div>'+
      '<p><code>'+esc(response.operationId)+'</code> · authority '+esc(response.authority)+' · side effects '+esc(response.sideEffects)+'</p>'+
      '<pre class="operation-output">'+esc(JSON.stringify(response.result,null,2))+'</pre>'+
      '<p class="runtime-boundary">Observed: retained source semantics executed locally. No live agent, provider, connector, workspace, merge, approval, or CANON action occurred.</p>';
    announce(heading+'.');
  }
  async function runOperation(){
    var input;try{input=JSON.parse($('operationInput').value);}catch(error){$('operationResult').className='preflight-result hold';$('operationResult').innerHTML='<p class="empty">HOLD · operation JSON is invalid: '+esc(error.message||error)+'</p>';announce('Operation JSON is invalid.');return;}
    var button=$('runOperation');button.disabled=true;$('operationResult').className='preflight-result';$('operationResult').innerHTML='<p class="empty">Running retained operation logic locally…</p>';
    try{renderOperation(await post('/api/ai-team-steward/execute',{operationId:$('operationSelect').value,input:input}));}
    catch(error){$('operationResult').className='preflight-result hold';$('operationResult').innerHTML='<p class="empty">Operation unavailable: '+esc(error.message||error)+'</p>';announce('Operation unavailable.');}
    finally{button.disabled=false;}
  }
  async function loadOperations(){
    var response=await fetch('/api/ai-team-steward/operations'),body=await response.json();if(!response.ok)throw new Error(body.error||('HTTP '+response.status));state.operations=body;
    $('operationCount').textContent=body.operationCount;$('operationState').textContent=body.status;$('operationState').className='status '+(body.ok?'runtime-ready':'runtime-hold');
    var groups={};body.operations.forEach(function(row){(groups[row.family]||(groups[row.family]=[])).push(row);});
    Object.keys(groups).sort().forEach(function(family){var group=document.createElement('optgroup');group.label=family.replace(/_/g,' ');groups[family].forEach(function(row){var option=document.createElement('option');option.value=row.id;option.textContent=row.name;group.appendChild(option);});$('operationSelect').appendChild(group);});
    syncOperation();
  }
  async function load(){
    try{
      var response=await fetch('/api/ai-team-steward/catalog'),body=await response.json();if(!response.ok)throw new Error(body.error||('HTTP '+response.status));state.catalog=body;
      $('seedCount').textContent=body.seedCount;$('familyCount').textContent=body.familyCount;$('testCount').textContent=body.sourceUnitTestsPassed;$('criticalCount').textContent=body.riskCounts.CRITICAL;
      var runtime=body.localRuntimeIntegration||{};$('runtimeSeedCount').textContent=runtime.seedCoverage||0;$('fixtureCheckCount').textContent=runtime.fixtureChecks||0;$('runtimeState').textContent=runtime.ok?'READY':'HOLD';$('runtimeState').className='status '+(runtime.ok?'runtime-ready':'runtime-hold');
      body.families.forEach(function(family){
        var goal=document.createElement('label');goal.innerHTML='<input type="checkbox" value="'+esc(family.label)+'"><span>'+esc(family.label)+'</span>';$('goalGrid').appendChild(goal);
        var option=document.createElement('option');option.value=family.id;option.textContent=family.label+' ('+family.count+')';$('familyFilter').appendChild(option);
      });
      body.entries.forEach(function(row){var option=document.createElement('option');option.value=row.moduleId;option.textContent='Seed '+row.seedNumber+' · '+row.name;$('preflightModule').appendChild(option);});
      renderCatalog();await Promise.all([loadSample('valid'),loadOperations()]);
    }catch(error){$('catalogList').innerHTML='<p class="empty">Catalog unavailable: '+esc(error.message||error)+'</p>';$('visibleCount').textContent='OFFLINE';announce('Steward catalog unavailable.');}
  }
  $('search').addEventListener('input',renderCatalog);$('familyFilter').addEventListener('change',renderCatalog);$('riskFilter').addEventListener('change',renderCatalog);$('buildPlan').addEventListener('click',buildPlan);$('preflightModule').addEventListener('change',function(){loadSample('valid');});$('loadPassingSample').addEventListener('click',function(){loadSample('valid');});$('loadUnsafeSample').addEventListener('click',function(){loadSample('unsafe');});$('runPreflight').addEventListener('click',runPreflight);$('operationSelect').addEventListener('change',syncOperation);$('loadReadyOperation').addEventListener('click',function(){loadOperationExample('ready');});$('loadHeldOperation').addEventListener('click',function(){loadOperationExample('held');});$('runOperation').addEventListener('click',runOperation);load();
}());
